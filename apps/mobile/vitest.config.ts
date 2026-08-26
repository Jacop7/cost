/**
 * 앱 시험 설정.
 *
 * 화면을 재려면 RN 컴포넌트를 실제로 그려야 하는데, 길이 둘이다.
 *
 *   ① `@testing-library/react-native` + `react-test-renderer`
 *      → **못 쓴다.** `react-native` 소스는 Flow 타입이 붙은 채로 배포되고, 그걸 벗기는 건
 *        Jest 의 `@react-native/babel-preset` 이다. vitest 의 esbuild 는 Flow 를 못 읽는다.
 *   ② `react-native-web` + jsdom + `@testing-library/react`   ← 이쪽
 *      → `react-native` 를 `react-native-web` 으로 바꿔 붙인다. 평범한 JS 라 esbuild 가 읽는다.
 *
 * ⚠ ②는 **웹으로 그린 결과**를 재는 것이다. 네이티브에서만 다르게 도는 것(제스처·네이티브
 *   모듈)은 여기서 안 잡힌다. 그래도 이 앱은 웹 번들을 배포 검증에 쓰고 있으므로
 *   (`pnpm verify` ⑤) 같은 표면을 재는 셈이다. 무엇을 재고 무엇을 안 재는지 적어 둔다.
 */
// ⚠ `URL` 도 node 것을 가져온다. tsconfig 의 `lib: DOM` 때문에 전역 URL 은 DOM 것이고,
//   `fileURLToPath` 는 node 의 URL 을 받는다 — 섞이면 타입 검사가 깨진다.
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // ⚠ 정확히 `react-native` 만 바꾼다. `react-native-svg` 같은 이름이 걸리면 안 된다.
      { find: /^react-native$/, replacement: 'react-native-web' },
      /*
       * ⚠ `react-native-svg` 가 이 **깊은 경로**를 그대로 가져온다. 위 별칭은
       *   `^react-native$` 만 바꾸므로 이건 진짜 RN 패키지로 가고, 그 파일은 Flow 라
       *   esbuild 가 `Unexpected token 'typeof'` 로 죽는다. 네이티브 코드 생성용이라
       *   웹에서는 안 쓰인다 — 껍데기로 바꾼다.
       */
      { find: /^@\//, replacement: src },
    ],
  },
  // tsconfig 의 `jsx: react-native` 는 esbuild 가 모른다. 여기서 명시한다.
  esbuild: { jsx: 'automatic' },
  test: {
    /*
     * RN 계열은 안으로 끌어와 우리 별칭·변환을 태운다. 기본값은 `node_modules` 를
     * 바깥에 두고 Node 가 직접 읽게 하는 것이라 별칭이 안 걸린다.
     */
    server: { deps: { inline: [/react-native/, /^expo/, /@expo\//] } },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
