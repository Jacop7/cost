/**
 * 시험 공통 준비.
 *
 * ⚠ `@/lib/supabase` 를 **모듈째 대신 세운다.** 그 파일은 불러오는 순간 환경변수로
 *   클라이언트를 만든다 — 시험에는 그 환경변수가 없고, 있어도 시험이 진짜 서버에
 *   붙으면 안 된다. 훅을 따로 대신 세우더라도 import 사슬 어딘가에서 딸려 오므로
 *   여기서 한 번에 막는다.
 */
import { createElement } from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// react-native-web 안쪽이 `__DEV__` 를 본다. 번들러가 넣어 주는 값이라 여기선 우리가 준다.
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

/*
 * ⚠ RN 생태계 패키지 둘을 **모듈째** 대신 세운다.
 *   `react-native-safe-area-context` 와 `react-native-svg` 는
 *   `react-native/Libraries/Utilities/codegenNativeComponent` 를 **깊은 경로**로 가져오는데,
 *   그 파일은 Flow 타입이 붙어 있어 esbuild 가 `Unexpected token 'typeof'` 로 죽는다.
 *   별칭(`resolve.alias`)과 `server.deps.inline` 을 다 걸어 봤지만 안 먹었다 —
 *   `vi.mock` 은 모듈 그래프에서 가로채므로 진짜 파일을 아예 안 읽는다.
 *
 * ⚠ **무엇을 포기하는지 적어 둔다.** 아이콘·차트의 *생김새*와 노치 여백은 여기서 안 재진다.
 *   시험이 잡는 것은 글자와 접근성 이름(버튼·행)이고, 아이콘은 장식이라 그걸로 충분하다.
 *   실제로 그려지는지는 `pnpm verify` ⑤ 의 웹 번들이 본다.
 */
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: { children?: unknown }) => children,
  SafeAreaView: ({ children }: { children?: unknown }) => children,
}));

vi.mock('react-native-svg', () => {
  const el = (tag: string) => ({ children }: { children?: unknown }) =>
    createElement(tag, { 'data-stub': 'svg' }, children as never);
  return {
    default: el('svg'),
    Circle: el('circle'), Defs: el('defs'), G: el('g'), Line: el('line'),
    LinearGradient: el('linearGradient'), Path: el('path'), Rect: el('rect'),
    Stop: el('stop'), Text: el('text'),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: () => Promise.reject(new Error('시험에서 supabase 를 직접 부르면 안 됩니다')),
    auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
  },
  /*
   * 화면이 코드로 분기하므로(0145) 시험도 같은 모양의 오류를 만들 수 있어야 한다.
   * ⚠ 인자 모양을 **진짜와 똑같이** 둔다. 다르면 시험은 진짜가 아닌 것을 만들어 놓고
   *   통과한다 — 실제로 `detail` 을 선택값으로 뒀다가 타입 검사에서 걸렸다.
   */
  RpcError: class RpcError extends Error {
    readonly code: string | null;
    readonly detail: string | null;
    constructor(message: string, code: string | null, detail: string | null) {
      super(message);
      this.name = 'RpcError';
      this.code = code;
      this.detail = detail;
    }
  },
  rpcError: (e: unknown) => e,
}));

/** ⚠ 렌더한 것을 안 치우면 다음 시험이 **앞 시험의 화면**을 찾아 통과한다. */
afterEach(() => {
  cleanup();
});
