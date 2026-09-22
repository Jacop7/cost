import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@costkeep/db';
import { acquireSocialCredential } from './socialAuth';
import type { SocialProvider } from './socialAuthTypes';
import { clearLoginMethod, rememberLoginMethod } from './loginMethod';

type Auth = SupabaseClient<Database>['auth'];

/** 취소는 오류가 아니다. 제공자 오류와 계정 유무는 사용자에게 구별해 노출하지 않는다. */
export async function signInWithSocial(auth: Auth, provider: SocialProvider): Promise<string | null> {
  try {
    const result = await acquireSocialCredential(provider);
    if (result.type === 'cancelled') return null;
    const { credential } = result;
    // 이전 Apple 세션의 표식이 Google 재로그인에 남지 않게 한다.
    await clearLoginMethod();
    const { data, error } = await auth.signInWithIdToken({
      provider, token: credential.token, nonce: credential.nonce,
      access_token: credential.accessToken,
    });
    if (!error && !data?.user?.id) {
      await auth.signOut({ scope: 'local' });
      return '로그인 계정을 확인하지 못했어요. 다시 시도해 주세요.';
    }
    if (!error && data.user?.id) {
      try { await rememberLoginMethod(data.user.id, provider); }
      catch {
        // 표식을 기록하지 못하면 Apple 철회 감시를 보장할 수 없다.
        await auth.signOut({ scope: 'local' });
        return '이 기기에서 로그인 상태를 안전하게 저장하지 못했어요. 다시 시도해 주세요.';
      }
    }
    return error ? '로그인하지 못했어요. 제공자 설정과 네트워크를 확인해 주세요.' : null;
  } catch {
    return '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}

/** 로그인 중인 기존 Auth 사용자에게만 identity를 추가한다. 매장 소유권은 건드리지 않는다. */
export async function linkSocialIdentity(
  auth: Auth, provider: SocialProvider, isCurrent: () => boolean = () => true,
): Promise<string | null> {
  try {
    const before = await auth.getUser();
    const userId = before.data.user?.id;
    if (before.error || !userId) return '로그인 정보를 확인한 뒤 다시 시도해 주세요.';
    if (!isCurrent()) return '로그인 계정이 바뀌었어요. 다시 시도해 주세요.';
    const result = await acquireSocialCredential(provider);
    if (result.type === 'cancelled') return null;
    const candidate = await auth.getUser();
    if (candidate.error || candidate.data.user?.id !== userId || !isCurrent()) {
      return '로그인 계정이 바뀌었어요. 다시 시도해 주세요.';
    }
    const { credential } = result;
    const { error } = await auth.linkIdentity({
      provider, token: credential.token, nonce: credential.nonce,
      access_token: credential.accessToken,
    });
    if (error) return '계정을 연결하지 못했어요. 이미 다른 계정에 연결되어 있는지 확인해 주세요.';
    const after = await auth.getUser();
    if (after.error || after.data.user?.id !== userId) {
      return '연결 후 계정을 확인하지 못했어요. 다시 로그인해 주세요.';
    }
    return null;
  } catch {
    return '계정을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}
