/**
 * 세션 · 매장 컨텍스트 — 모든 실데이터 조회의 전제.
 *
 * 왜 필요한가:
 *   RLS 정책이 `store_id in (select my_store_ids())` 이고, `my_store_ids()` 는
 *   `select id from stores where owner_id = auth.uid()` 다(20260608000001_tenancy.sql).
 *   즉 **로그인하지 않으면 auth.uid() 가 null 이라 어떤 행도 보이지 않는다.**
 *   화면이 "데이터 없음"으로 보이면 대개 빈 테이블이 아니라 세션이 없는 것이다 —
 *   이 둘을 구분해서 보여줘야 한다(가이드 §9.8).
 *
 * 1차 범위에서는 로그인 화면이 아직 없다. 로컬 개발에서는 시드 계정으로 자동 로그인해
 * 데이터 계층을 먼저 완성하고, 실제 로그인 화면은 별도 미션으로 붙인다.
 */
import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

/** 로컬 시드 계정 (packages/db/supabase/seed.sql). 운영 빌드에서는 쓰이지 않는다. */
const DEV_EMAIL = 'demo@sikjae.local';
const DEV_PASSWORD = 'demo1234';

export type SessionPhase =
  | 'loading'
  | 'unconfigured' // 환경변수 미설정 — 네트워크 오류와 구분해야 한다
  | 'signed-out'
  | 'ready'
  | 'error';

export interface SessionState {
  phase: SessionPhase;
  userId: string | null;
  storeId: string | null;
  /** 사용자에게 보여줄 오류 문구. 내부 코드·테이블명을 노출하지 않는다(가이드 §9.2). */
  message: string | null;
  /** 실패 후 다시 시도. 오류 화면의 '다시 시도' 버튼이 이걸 부른다. */
  retry: () => void;
}

const INITIAL = { phase: 'loading' as SessionPhase, userId: null, storeId: null, message: null };

/** 로그인된 사용자의 매장 id. 매장이 여러 개면 첫 번째(1차 범위는 단일 매장). */
async function resolveStoreId(): Promise<{ storeId: string | null; message: string | null }> {
  const { data, error } = await supabase.from('stores').select('id').limit(1);
  if (error) return { storeId: null, message: '매장 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' };
  const first = data?.[0]?.id ?? null;
  if (first === null) {
    return { storeId: null, message: '연결된 매장이 없어요. 매장을 먼저 등록해 주세요.' };
  }
  return { storeId: first, message: null };
}

/**
 * 앱 전역 세션. 개발 환경에서는 시드 계정으로 자동 로그인한다.
 *
 * ⚠ 자동 로그인은 `__DEV__` 에서만 동작한다. 운영 빌드에서는 로그인 화면이 필요하며,
 *   그 전까지는 'signed-out' 으로 남아 화면이 "로그인이 필요해요"를 보여준다.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<Omit<SessionState, 'retry'>>(INITIAL);
  // 값이 바뀌면 아래 effect 가 다시 돌아 세션을 새로 잡는다.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState(INITIAL);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;

    const settle = (next: Omit<SessionState, 'retry'>) => {
      if (alive) setState(next);
    };

    (async () => {
      if (!isSupabaseConfigured) {
        settle({ phase: 'unconfigured', userId: null, storeId: null, message: '서버 연결 설정이 없어요.' });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      let userId = sessionData.session?.user.id ?? null;

      if (userId === null && __DEV__) {
        // 로컬 시드 계정으로 자동 로그인 — 로그인 화면이 붙기 전까지의 개발 편의.
        const { data, error } = await supabase.auth.signInWithPassword({
          email: DEV_EMAIL,
          password: DEV_PASSWORD,
        });
        if (error) {
          settle({
            phase: 'error',
            userId: null,
            storeId: null,
            message: '서버에 연결하지 못했어요. 로컬 Supabase 가 켜져 있는지 확인해 주세요.',
          });
          return;
        }
        userId = data.user?.id ?? null;
      }

      if (userId === null) {
        settle({ phase: 'signed-out', userId: null, storeId: null, message: '로그인이 필요해요.' });
        return;
      }

      const { storeId, message } = await resolveStoreId();
      settle({
        phase: storeId === null ? 'error' : 'ready',
        userId,
        storeId,
        message,
      });
    })();

    // 세션이 만료·갱신되면 매장 컨텍스트도 다시 잡는다.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session?.user.id == null) {
        setState({ phase: 'signed-out', userId: null, storeId: null, message: '로그인이 필요해요.' });
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [attempt]);

  return { ...state, retry };
}
