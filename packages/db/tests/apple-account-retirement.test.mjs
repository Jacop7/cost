import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webcrypto } from 'node:crypto';
import { appleClientSecret, handleRetireAppleAccount } from '../supabase/functions/retire-apple-account/index.mjs';

const key = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const der = new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', key.privateKey));
const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64')}\n-----END PRIVATE KEY-----`;
const values = {
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key',
  APPLE_TEAM_ID: 'TEAM', APPLE_KEY_ID: 'KEY', APPLE_CLIENT_ID: 'com.costkeep.app', APPLE_PRIVATE_KEY: privateKey,
};
const env = { get: (name) => values[name] };
const idToken = (sub) => `header.${Buffer.from(JSON.stringify({ sub, iss: 'https://appleid.apple.com', aud: 'com.costkeep.app', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url')}.signature`;
const request = () => new Request('https://example.supabase.co/functions/v1/retire-apple-account', {
  method: 'POST', headers: { authorization: 'Bearer user-jwt', 'content-type': 'application/json' },
  body: JSON.stringify({ authorizationCode: 'fresh-code' }),
});
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('Apple client secret has short lifetime and the configured audience', async () => {
  const token = await appleClientSecret({ teamId: 'TEAM', keyId: 'KEY', clientId: 'com.costkeep.app', privateKey }, 10_000, webcrypto);
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(claims.aud, 'https://appleid.apple.com');
  assert.equal(claims.exp - claims.iat, 300);
});

test('another Apple identity never revokes a token or retires the account', async () => {
  const calls = [];
  const result = await handleRetireAppleAccount(request(), env, async (url) => {
    calls.push(url);
    if (url.endsWith('/auth/v1/user')) return response({ id: 'owner', identities: [{ provider: 'apple', identity_id: 'real-sub' }] });
    if (url.endsWith('/auth/token')) return response({ id_token: idToken('other-sub'), refresh_token: 'refresh' });
    throw new Error('revocation or retirement must not run');
  });
  assert.equal(result.status, 403);
  assert.equal(calls.length, 2);
});

test('revocation failure preserves the account', async () => {
  const calls = [];
  const result = await handleRetireAppleAccount(request(), env, async (url) => {
    calls.push(url);
    if (url.endsWith('/auth/v1/user')) return response({ id: 'owner', identities: [{ provider: 'apple', identity_id: 'real-sub' }] });
    if (url.endsWith('/auth/token')) return response({ id_token: idToken('real-sub'), refresh_token: 'refresh' });
    if (url.endsWith('/auth/revoke')) return response({}, 503);
    throw new Error('retirement must not run');
  });
  assert.equal(result.status, 503);
  assert.equal(calls.length, 3);
});

test('successful retirement happens after Apple revocation', async () => {
  const calls = [];
  const result = await handleRetireAppleAccount(request(), env, async (url) => {
    calls.push(url);
    if (url.endsWith('/auth/v1/user')) return response({ id: 'owner', identities: [{ provider: 'apple', identity_id: 'real-sub' }] });
    if (url.endsWith('/auth/token')) return response({ id_token: idToken('real-sub'), refresh_token: 'refresh' });
    if (url.endsWith('/auth/revoke')) return response({});
    if (url.endsWith('/rest/v1/rpc/retire_my_account')) return response({ deleted: true, archived_store_count: 1 });
    throw new Error('unknown request');
  });
  assert.equal(result.status, 200);
  assert.deepEqual(calls.map((url) => new URL(url).pathname), [
    '/auth/v1/user', '/auth/token', '/auth/revoke', '/rest/v1/rpc/retire_my_account',
  ]);
});
