/**
 * `src/**\/*.check.ts` 를 전부 찾아 돌린다.
 *
 * 왜 있나 — 서버 응답 계약 검사를 손으로만 돌리다가 검토에서 지적받았다.
 * `pnpm test` 나 `tsc` 가 깨져도 안 잡히면 그건 회귀 시험이 아니라 한 번 해 본 것이다.
 * 루트의 `pnpm -r test` 가 이 스크립트를 타고 들어온다.
 *
 * ⚠ 검사 파일은 **앱 의존이 없어야 한다.** `@/` 별칭이나 react-native 를 import 하면
 *   node 가 못 읽는다 — 그런 것은 검사가 아니라 화면이므로 다른 방법으로 재야 한다.
 * ⚠ `.ts` 를 그대로 돌린다(node 24 의 타입 스트립). 그래서 검사 파일 안에서는
 *   import 에 `.ts` 확장자를 붙인다. 그 규칙 때문에 `tsconfig` 에서 빠져 있다.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const src = join(root, 'src');

/** `src` 아래를 훑어 `*.check.ts` 를 모은다. */
function collect(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...collect(p));
    else if (name.endsWith('.check.ts')) out.push(p);
  }
  return out;
}

const files = collect(src).sort();
if (files.length === 0) {
  // ⚠ 하나도 없으면 **성공이 아니다.** 파일이 옮겨졌는데 초록으로 끝나면 아무도 모른다.
  console.error('검사 파일(*.check.ts)을 하나도 못 찾았습니다 — 경로가 바뀌었는지 보세요.');
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  const rel = relative(root, f).replace(/\\/g, '/');
  console.log(`\n── ${rel}`);
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', f], {
    stdio: 'inherit',
    cwd: root,
  });
  if (r.status !== 0) failed++;
}

console.log(failed === 0 ? `\n검사 ${files.length}개 통과` : `\n검사 실패 ${failed}/${files.length}`);
process.exit(failed === 0 ? 0 : 1);
