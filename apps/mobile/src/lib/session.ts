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
 * 첫 출시부터 이메일 가입과 로그인을 제공한다. 가입 직후 세션이 발급되면 바로 사용자·매장을
 * 재검증하고, 이메일 확인이 필요한 환경이면 확인 안내 뒤 로그인으로 이어진다.
 * 연결 매장이 없으면 사용자가 첫 매장 이름을 입력하고 서버 `create_store`가 초기화한다.
 * 로컬 개발에서는 기존처럼 시드 계정으로 자동 로그인한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from './supabase';

/** 로컬 시드 계정 (packages/db/supabase/seed.sql). 운영 빌드에서는 쓰이지 않는다. */
const DEV_EMAIL = 'demo@costkeep.local';
const DEV_PASSWORD = 'demo1234';

export type SessionPhase =
  | 'loading'
  | 'unconfigured' // 환경변수 미설정 — 네트워크 오류와 구분해야 한다
  | 'signed-out'
  | 'needs-store'
  | 'ready'
  | 'error';

export interface SessionState {
  phase: SessionPhase;
  userId: string | null;
  storeId: string | null;
  /** 같은 소유자의 로그아웃·재로그인도 구별한다. 토큰 갱신에는 바뀌지 않는다. */
  sessionGeneration?: number;
  /** 사용자에게 보여줄 오류 문구. 내부 코드·테이블명을 노출하지 않는다(가이드 §9.2). */
  message: string | null;
  /** 실패 후 다시 시도. 오류 화면의 '다시 시도' 버튼이 이걸 부른다. */
  retry: () => void;
  /** 이메일 계정 로그인. 실패하면 사용자 표시용 문구를 반환한다. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** 이메일 계정 가입. 세션이 바로 발급되지 않으면 확인 대기 상태를 반환한다. */
  signUp: (email: string, password: string, passwordConfirmation: string) => Promise<SignUpResult>;
  /** 로그인 사용자의 최초 매장을 서버 RPC로 만들고 세션 범위를 다시 해석한다. */
  createStore: (name: string) => Promise<string | null>;
  /** 최초 매장 단계에서 다른 계정으로 바꾸기 위한 로컬 로그아웃. */
  signOut: () => Promise<string | null>;
}

export interface SignUpResult {
  error: string | null;
  confirmationRequired: boolean;
}

export async function signOutCurrentSession(storeId: string | null): Promise<string | null> {
  // 네이티브 알림 모듈을 세션 부팅 경로에서 미리 읽지 않는다. 실제 로그아웃 때만 로드해
  // 현재 기기 등록을 먼저 폐기한다. 오프라인 폐기는 보류 기록 후 다음 로그인에서 재시도한다.
  // 푸시 정리는 부가 작업이므로 모듈 로드나 보류 기록까지 실패해도 인증 로그아웃은 계속한다.
  if (storeId !== null && Platform.OS !== 'web') {
    try {
      const { preparePushDeviceSignOut } = await import('@/features/notifications/pushRegistration');
      await preparePushDeviceSignOut(storeId);
    } catch {
      // 인증 세션 종료가 기기 알림 정리에 종속되지 않게 한다.
    }
  }

  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return error ? '로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.' : null;
  } catch {
    return '로그아웃하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.';
  }
}

const INITIAL = { phase: 'loading' as SessionPhase, userId: null, storeId: null, message: null };
type SessionSnapshot = Omit<SessionState, 'retry' | 'signIn' | 'signUp' | 'createStore' | 'signOut'>;

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

async function resolveStoreId(): Promise<{ storeId: string | null; message: string | null; missing: boolean }> {
  const { data, error } = await (pickStoreQuery((t) => supabase.from(t) as unknown as StoreQueryBuilder) as Promise<{
    data: { id: string }[] | null; error: unknown;
  }>);
  if (error) return { storeId: null, message: '매장 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', missing: false };
  const first = data?.[0]?.id ?? null;
  if (first === null) {
    return { storeId: null, message: '연결된 매장이 없어요. 매장을 먼저 등록해 주세요.', missing: true };
  }
  return { storeId: first, message: null, missing: false };
}

/**
 * 앱 전역 세션. 개발 환경에서는 시드 계정으로 자동 로그인한다.
 *
 * ⚠ 자동 로그인은 `__DEV__` 에서만 동작한다. 운영 빌드는 가입·로그인 화면을 사용한다.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionSnapshot>(INITIAL);
  const generation = useRef(0);
  const actor = useRef<string | null | undefined>(undefined);
  // 값이 바뀌면 아래 effect 가 다시 돌아 세션을 새로 잡는다.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    generation.current += 1;
    actor.current = undefined;
    setState(INITIAL);
    setAttempt((n) => n + 1);
  }, []);
  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const normalizedEmail = email.trim();
    if (normalizedEmail === '' || password === '') return '이메일과 비밀번호를 모두 입력해 주세요.';
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      return error ? '이메일 또는 비밀번호를 확인해 주세요.' : null;
    } catch {
      return '로그인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.';
    }
  }, []);
  const signUp = useCallback(async (
    email: string,
    password: string,
    passwordConfirmation: string,
  ): Promise<SignUpResult> => {
    const normalizedEmail = email.trim();
    if (normalizedEmail === '' || password === '' || passwordConfirmation === '') {
      return { error: '이메일과 비밀번호 확인까지 모두 입력해 주세요.', confirmationRequired: false };
    }
    if (password.length < 8) {
      return { error: '비밀번호는 8자 이상 입력해 주세요.', confirmationRequired: false };
    }
    if (password !== passwordConfirmation) {
      return { error: '비밀번호 확인이 일치하지 않아요.', confirmationRequired: false };
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (error) {
        const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
        const message = code === 'email_address_invalid'
          ? '이메일 형식을 확인해 주세요.'
          : code === 'weak_password'
            ? '더 안전한 비밀번호를 입력해 주세요.'
            : code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit'
              ? '요청이 많아요. 잠시 후 다시 시도해 주세요.'
              : code === 'signup_disabled'
                ? '현재 회원가입을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.'
                : '회원가입하지 못했어요. 입력 내용을 확인한 뒤 다시 시도해 주세요.';
        return { error: message, confirmationRequired: false };
      }
      // 이메일 존재 여부를 노출하지 않는다. 세션이 없으면 확인 메일을 거쳐 로그인하도록 안내한다.
      const confirmationRequired = data.session === null;
      if (!confirmationRequired) retry();
      return { error: null, confirmationRequired };
    } catch {
      return {
        error: '회원가입하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.',
        confirmationRequired: false,
      };
    }
  }, [retry]);
  const createStore = useCallback(async (name: string): Promise<string | null> => {
    const normalizedName = name.trim();
    if (normalizedName === '') return '매장 이름을 입력해 주세요.';
    try {
      const { error } = await supabase.rpc('create_store', { p_name: normalizedName });
      if (error) return '매장을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';
      retry();
      return null;
    } catch {
      return '매장을 만들지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.';
    }
  }, [retry]);
  const signOut = useCallback(() => signOutCurrentSession(state.storeId), [state.storeId]);

  useEffect(() => {
    let alive = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // 인증 거절 정리 중 발생한 첫 로그아웃만 개발용 재로그인의 근거로 쓴다.
    // 그 뒤 다른 인증 이벤트가 왔다면 그 이벤트의 세대가 우선한다.
    let expectedSignOut: { generation: number | null } | null = null;
    const current = (ticket: number) => alive && generation.current === ticket;
    const settle = (ticket: number, next: SessionSnapshot) => {
      if (current(ticket)) setState({ ...next, sessionGeneration: ticket });
    };
    const signedOut = (ticket: number) => settle(ticket, {
      phase: 'signed-out', userId: null, storeId: null, message: '로그인이 필요해요.',
    });
    const failed = (ticket: number) => settle(ticket, {
      phase: 'error', userId: null, storeId: null, message: '로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    });

    const resolveActor = async (userId: string, ticket: number): Promise<void> => {
      try {
        if (!current(ticket)) return;
        // 저장된 세션만 믿지 않는다. 실제 인증 주체가 맞는지 확인한 뒤 매장을 읽는다.
        const { data, error } = await supabase.auth.getUser();
        if (!current(ticket)) return;
        if (error && (error.status === 401 || error.status === 403)) {
          const signOut = { generation: null as number | null };
          expectedSignOut = signOut;
          await supabase.auth.signOut();
          if (expectedSignOut === signOut) expectedSignOut = null;
          if (!alive) return;
          if (signOut.generation === null && current(ticket)) {
            actor.current = null; signedOut(++generation.current);
            signOut.generation = generation.current;
          }
          if (__DEV__ && signOut.generation !== null && current(signOut.generation) && actor.current === null) {
            const next = ++generation.current;
            setState(INITIAL);
            await loginForDevelopment(next);
          }
          return;
        }
        // 접속 오류는 로그아웃하지 않는다. 다른 사용자의 응답으로 ready를 만들지도 않는다.
        if (error || data.user?.id !== userId) { failed(ticket); return; }
        const { storeId, message, missing } = await resolveStoreId();
        if (!current(ticket)) return;
        settle(ticket, {
          phase: missing ? 'needs-store' : storeId === null ? 'error' : 'ready',
          userId, storeId, message,
        });
      } catch { failed(ticket); }
    };

    const loginForDevelopment = async (ticket: number): Promise<void> => {
      try {
        if (!current(ticket)) return;
        const { data, error } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
        if (!current(ticket)) return;
        if (error) {
          settle(ticket, { phase: 'error', userId: null, storeId: null,
            message: '서버에 연결하지 못했어요. 로컬 Supabase 가 켜져 있는지 확인해 주세요.' });
          return;
        }
        const userId = data.user?.id ?? null;
        actor.current = userId;
        if (userId === null) { signedOut(ticket); return; }
        await resolveActor(userId, ticket);
      } catch { failed(ticket); }
    };

    // 인증 콜백 안에서는 범위를 즉시 닫기만 한다. Supabase의 인증 잠금 밖에서 재조회한다.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      // 최초 저장 세션은 아래 getSession/getUser 경로가 검증한다. 늦은 초기 알림은 무시한다.
      if (event === 'INITIAL_SESSION') return;
      const nextActor = session?.user.id ?? null;
      if (nextActor === null) {
        actor.current = null;
        const ticket = ++generation.current;
        if (expectedSignOut && expectedSignOut.generation === null) expectedSignOut.generation = ticket;
        signedOut(ticket);
        return;
      }
      // 같은 사용자의 토큰 갱신은 현재 입력·캐시·매장 조회를 초기화하지 않는다.
      if (actor.current === nextActor) return;
      actor.current = nextActor;
      const ticket = ++generation.current;
      setState(INITIAL);
      const timer = setTimeout(() => { timers.delete(timer); void resolveActor(nextActor, ticket); }, 0);
      timers.add(timer);
    });

    const ticket = ++generation.current;
    void (async () => {
      try {
        if (!isSupabaseConfigured) {
          settle(ticket, { phase: 'unconfigured', userId: null, storeId: null, message: '서버 연결 설정이 없어요.' });
          return;
        }
        const { data, error } = await supabase.auth.getSession();
        if (!current(ticket)) return;
        if (error) { failed(ticket); return; }
        const userId = data.session?.user.id ?? null;
        actor.current = userId;
        if (userId !== null) { await resolveActor(userId, ticket); return; }
        if (__DEV__) { await loginForDevelopment(ticket); return; }
        signedOut(ticket);
      } catch { failed(ticket); }
    })();

    return () => {
      alive = false;
      generation.current += 1;
      for (const timer of timers) clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [attempt]);

  return { ...state, retry, signIn, signUp, createStore, signOut };
}
