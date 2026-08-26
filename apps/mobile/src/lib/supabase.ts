/**
 * Supabase 클라이언트. 세션은 네이티브에서 expo-secure-store, 웹에서 localStorage 에 저장.
 * 환경변수: EXPO_PUBLIC_SUPABASE_URL · EXPO_PUBLIC_SUPABASE_ANON_KEY (.env)
 *
 * ⚠ 화면은 여기를 직접 부르지 않는다. 도메인별 features 하위 hooks.ts 가 유일한 경계다.
 *   예전에는 이 파일에 RPC 래퍼(rpc.e1ConfirmInbound 등)를 따로 뒀는데,
 *   훅이 생기면서 같은 호출을 두 군데서 하게 되어 무효화 규칙이 갈라졌다. 래퍼는 걷어냈다.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@sikjae/db';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * 세션 저장소는 플랫폼마다 다르다.
 *
 * ⚠ 웹에서 expo-secure-store 는 **빈 껍데기**다(ExpoSecureStore.web.js 가 `export default {}`).
 *   구분 없이 쓰면 앱이 뜨자마자 세션을 읽다가 죽는다:
 *     "ExpoSecureStore.default.getValueWithKeyAsync is not a function"
 *   CLAUDE.md 가 `--web` 을 미리보기 수단으로 두고 있으므로 웹도 동작해야 한다.
 *
 * 웹은 localStorage 를 쓴다. 브라우저 미리보기는 개발용이라 기기 보안 저장소가 필요 없고,
 * SSR/비브라우저 환경에서 localStorage 가 없을 수 있어 접근 전에 확인한다.
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const hasLocalStorage = (): boolean =>
  typeof globalThis !== 'undefined' && typeof globalThis.localStorage !== 'undefined';

const WebStorageAdapter = {
  getItem: async (key: string) => (hasLocalStorage() ? globalThis.localStorage.getItem(key) : null),
  setItem: async (key: string, value: string) => {
    if (hasLocalStorage()) globalThis.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (hasLocalStorage()) globalThis.localStorage.removeItem(key);
  },
};

const sessionStorage = Platform.OS === 'web' ? WebStorageAdapter : SecureStoreAdapter;

const ENV_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * ⚠ **웹 미리보기는 LAN IP 를 탈 이유가 없다.**
 *
 * .env 의 주소는 **폰(Expo Go)** 이 PC 에 닿기 위한 것이다. 그런데 브라우저는
 * Supabase 와 같은 기계에서 도니 localhost 로 충분하다. LAN IP 를 쓰면
 * PC 의 IP 가 바뀔 때마다(오늘만 세 번) 웹이 조용히 옛 주소로 요청해
 * "정보를 불러오지 못했어요"가 된다 — 서버는 멀쩡한데.
 *
 * 그래서 웹은 항상 로컬 주소를 쓰고, .env 의 IP 는 네이티브에만 쓴다.
 * 포트는 .env 에서 가져와 로컬 Supabase 포트를 바꿔도 따라간다.
 */
const localPort = (() => {
  const m = /:(\d+)\s*$/.exec(ENV_URL.trim());
  return m ? m[1] : '54321';
})();

const SUPABASE_URL = Platform.OS === 'web' ? `http://127.0.0.1:${localPort}` : ENV_URL;

/**
 * 환경변수 설정 여부. 화면은 "로딩"과 "환경 미설정"을 구분해서 보여야 한다.
 * 미설정 상태로 조회하면 네트워크 오류처럼 보여 원인을 오해하게 된다.
 */
export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

// 생성 타입을 물려 RPC 인자·반환과 테이블 컬럼이 **컴파일 단계에서** 검증되게 한다.
// 스키마를 바꾸면 `pnpm db:types` 로 타입을 다시 만들어야 여기 오류가 드러난다.
export const supabase = createClient<Database>(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * 입고 확정 1회분의 멱등성 키.
 * 버튼을 누른 시점에 한 번 만들어 state 에 보관하고, 재시도에는 같은 값을 다시 넘긴다.
 * 보안 토큰이 아니라 중복 제거용 식별자라 난수 품질 요구가 낮다(crypto 의존을 피한다).
 */
export const makeInboundKey = (orderId: string): string =>
  `${orderId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;

/**
 * 서버가 거절한 이유를 **코드로** 들고 다니는 오류.
 *
 * ⚠ 예전엔 `new Error(error.message)` 로 문구만 남겼고, 화면은 그 한국어를 검사해
 *   분기했다(`isClosedError` 등). 그래서 0140 에서 문구 하나를 고칠 때 판별식도
 *   같이 고쳐야 했고, 한쪽만 고치면 **화면이 오류를 못 알아봤다.**
 *
 * ⚠ 코드베이스 주석에는 "PostgREST 응답에 SQLSTATE 가 그대로 오지 않는 경우가 있다"
 *   고 적혀 있었는데 **실측해 보니 틀렸다.** 그대로 온다:
 *       {"code":"45010","details":"SALE_DATE_OUT_OF_RANGE","hint":null,"message":"…"}
 *   `code` 가 SQLSTATE, `details` 가 서버가 붙인 안정된 이름이다(0144).
 */
export class RpcError extends Error {
  /** SQLSTATE. 45001 BEFORE_OPEN · 45002 DAY_CLOSED · 45009 REVISION_CONFLICT · 45010 SALE_DATE_OUT_OF_RANGE · 45011 DAY_IS_LIVE */
  readonly code: string | null;
  /** 서버가 `detail` 로 붙인 이름. 로그에서 읽기 좋다. */
  readonly detail: string | null;

  constructor(message: string, code: string | null, detail: string | null) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.detail = detail;
  }
}

/** supabase-js 의 오류를 `RpcError` 로 옮긴다. 문구는 그대로 두고 코드를 살린다. */
export function rpcError(e: { message: string; code?: string | null; details?: string | null }): RpcError {
  return new RpcError(e.message, e.code ?? null, e.details ?? null);
}
