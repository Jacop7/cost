const json = (body, status) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const base64url = (bytes) => {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

const encode = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)));

/** Apple private key is used only inside the Edge Function; it must never enter EXPO_PUBLIC_* or a client response. */
export async function appleClientSecret(config, now = Date.now(), cryptoImpl = crypto) {
  const pem = config.privateKey.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(pem);
  const der = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const key = await cryptoImpl.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const issuedAt = Math.floor(now / 1000);
  const unsigned = `${encode({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })}.${encode({
    iss: config.teamId, iat: issuedAt, exp: issuedAt + 300, aud: 'https://appleid.apple.com', sub: config.clientId,
  })}`;
  const signature = await cryptoImpl.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

const appleClaims = (idToken) => {
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return claims;
  } catch { return null; }
};

const appleIdentityMatches = (user, subject) =>
  user?.identities?.some((identity) => identity.provider === 'apple' &&
    (identity.identity_data?.sub === subject || identity.identity_id === subject));

/** One fresh Apple authorization code is exchanged, revoked, then the existing user-scoped retirement RPC runs. */
export async function handleRetireAppleAccount(req, env = Deno.env, fetchImpl = fetch) {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const jwt = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  let code;
  try {
    const body = await req.json();
    code = typeof body?.authorizationCode === 'string' ? body.authorizationCode : '';
  } catch { return json({ error: 'invalid_request' }, 400); }
  if (!code || code.length > 4096) return json({ error: 'invalid_request' }, 400);

  const url = env.get('SUPABASE_URL');
  const anonKey = env.get('SUPABASE_ANON_KEY') || env.get('SUPABASE_PUBLISHABLE_KEY');
  const config = {
    teamId: env.get('APPLE_TEAM_ID'), keyId: env.get('APPLE_KEY_ID'),
    clientId: env.get('APPLE_CLIENT_ID'), privateKey: env.get('APPLE_PRIVATE_KEY'),
  };
  if (!url || !anonKey || Object.values(config).some((value) => !value)) return json({ error: 'unavailable' }, 503);

  const authHeaders = { authorization: `Bearer ${jwt}`, apikey: anonKey };
  const userResponse = await fetchImpl(`${url}/auth/v1/user`, { headers: authHeaders });
  if (!userResponse.ok) return json({ error: 'unauthorized' }, 401);
  const user = await userResponse.json();
  if (!user?.id || !user.identities?.some((identity) => identity.provider === 'apple')) {
    return json({ error: 'apple_identity_required' }, 403);
  }

  let secret;
  try { secret = await appleClientSecret(config); }
  catch { return json({ error: 'unavailable' }, 503); }
  const tokenResponse = await fetchImpl('https://appleid.apple.com/auth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: secret,
      code, grant_type: 'authorization_code' }).toString(),
  });
  if (!tokenResponse.ok) return json({ error: 'apple_reauthentication_failed' }, 409);
  const tokens = await tokenResponse.json();
  // The token is obtained directly from Apple's authenticated token endpoint.
  // Validate its audience and linked subject before accepting the fresh code as this user's reauthentication.
  const claims = typeof tokens.id_token === 'string' ? appleClaims(tokens.id_token) : null;
  if (claims?.iss !== 'https://appleid.apple.com' || claims?.aud !== config.clientId ||
    typeof claims?.exp !== 'number' || claims.exp <= Date.now() / 1000 ||
    !claims.sub || !appleIdentityMatches(user, claims.sub) || !tokens.refresh_token) {
    return json({ error: 'apple_identity_mismatch' }, 403);
  }
  const revokeResponse = await fetchImpl('https://appleid.apple.com/auth/revoke', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: secret,
      token: tokens.refresh_token, token_type_hint: 'refresh_token' }).toString(),
  });
  if (!revokeResponse.ok) return json({ error: 'apple_revocation_failed' }, 503);

  const retirement = await fetchImpl(`${url}/rest/v1/rpc/retire_my_account`, {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body: '{}',
  });
  if (!retirement.ok) return json({ error: 'account_retirement_failed_after_revocation' }, 503);
  const result = await retirement.json();
  if (result?.deleted !== true || !Number.isSafeInteger(result.archived_store_count)) {
    return json({ error: 'account_retirement_unconfirmed' }, 503);
  }
  return json(result, 200);
}

if (typeof Deno !== 'undefined') {
  Deno.serve((req) => handleRetireAppleAccount(req));
}
