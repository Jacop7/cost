/**
 * 세션 · 매장 컨텍스트 — 모든 실데이터 조회의 전제.
 *
 * 왜 필요한가:
 *   RLS 정책이 `store_id in (select my_store_ids())` 이고, `my_store_ids()` 는
 *   `select id from stores where owner_id = auth.uid() and archived_at is null` 다(0173).
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

/**
 * 로그인된 사용자의 매장 id. 1차 범위는 매장 하나다(기획서 §12).
 *
 * ⚠ **정렬 없이 첫 행을 고르면 안 된다**(0166 검토). 매장이 둘 이상이면 어느 쪽이
 *   잡힐지 실행마다 달라지고, 앱이 어제와 다른 매장을 열 수 있다. 서버의 공식 문
 *   (`create_store`)도 같은 기준(created_at, id)으로 매장을 고른다 — 양쪽이 같은
 *   매장을 가리켜야 한다.
 */
/** 매장 선택 질의가 요구하는 빌더 모양 — `supabase.from` 의 부분집합. 시험이 가짜를 끼운다. */
export interface StoreQueryBuilder {
  select: (cols: string) => {
    order: (col: string, opts: { ascending: boolean }) => {
      order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => unknown };
    };
  };
}

/**
 * 매장 선택 질의 — 서버 create_store 와 같은 기준(created_at, id)으로 **정렬해서** 하나.
 * 정렬 없이 limit(1) 이면 매장이 둘일 때 실행마다 다른 매장이 잡힌다(검토 지적).
 */
export function pickStoreQuery(from: (table: 'stores') => StoreQueryBuilder) {
  return from('stores').select('id')
    .order('created_at', { ascending: true }).order('id', { ascending: true }).limit(1);
}

async function resolveStoreId(): Promise<{ storeId: string | null; message: string | null }> {
  const { data, error } = await (pickStoreQuery((t) => supabase.from(t) as unknown as StoreQueryBuilder) as Promise<{
    data: { id: string }[] | null; error: unknown;
  }>);
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

      /**
       * ⚠ **저장된 세션을 믿지 말고 살아 있는지 확인한다.**
       *
       * getSession 은 저장소에 있는 토큰을 그대로 돌려준다. 로컬 Supabase 를 다시
       * 올리거나 토큰이 만료돼 갱신에 실패하면, 옛 토큰이 그대로 남아 자동 로그인이
       * 건너뛰어지고 **그때부터 모든 조회가 401** 이 된다.
       *
       * 그 실패는 눈에 안 띈다 — supabase-js 는 오류를 던지지 않고 객체로 돌려주고,
       * 훅이 그걸 throw 하면 react-query 가 삼켜 화면에만 "정보를 불러오지 못했어요"가
       * 뜬다. 콘솔에는 아무것도 안 남아 원인을 찾는 데 오래 걸렸다(실측).
       *
       * getUser 는 서버에 물어 토큰을 검증한다. 죽었으면 지우고 다시 로그인한다.
       * ⚠ 네트워크 오류로 로그아웃시키면 안 된다 — 인증이 거부된 경우(401·403)만 본다.
       */
      if (userId !== null) {
        const { error } = await supabase.auth.getUser();
        if (error && (error.status === 401 || error.status === 403)) {
          await supabase.auth.signOut();
          userId = null;
        }
      }

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
