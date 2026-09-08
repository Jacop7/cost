import { spawnSync } from 'node:child_process';

// 런타임 UI 증거의 제품 범위에서 제외하는 기계 생성 메타데이터다. 이 파일은 앱 번들 경로에
// 있지만 화면 구현이 아니며, 프로토타입 DESIGN_SYNC 표식만 바뀌어도 재생성된다.
export const PRODUCT_GENERATED_EXCLUSIONS = [
  'apps/mobile/src/dev/surfaceRegistry.generated.json',
];

export function scopedPathspec(includes, exclusions = PRODUCT_GENERATED_EXCLUSIONS) {
  return [...includes, ...exclusions.map((path) => `:(exclude)${path}`)];
}

export function productScopeChanged(repoRoot, fromCommit, toCommit = 'HEAD', includes = ['apps/mobile']) {
  return productScopeChangedPaths(repoRoot, fromCommit, toCommit, includes).length > 0;
}

export function productScopeChangedPaths(repoRoot, fromCommit, toCommit = 'HEAD', includes = ['apps/mobile']) {
  const result = spawnSync('git', ['diff', '--name-only', fromCommit, toCommit, '--', ...scopedPathspec(includes)], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`제품 범위 git diff 실패: ${result.stderr.trim()}`);
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

export function dirtyProductScope(repoRoot, includes = ['apps/mobile']) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all', '--', ...scopedPathspec(includes)], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`제품 범위 git status 실패: ${result.stderr.trim()}`);
  return result.stdout.trim();
}
