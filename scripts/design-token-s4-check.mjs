#!/usr/bin/env node
/** S4 컴포넌트·레이아웃 계약을 소스와 터치 감사 결과에 직접 결속한다. */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = fileURLToPath(import.meta.url);
const defaultRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function loadSources(root = defaultRoot) {
  const sources = new Map();
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.expo', 'dist', 'build', '__tests__'].includes(name)) continue;
      const absolute = join(dir, name);
      const stat = statSync(absolute);
      if (stat.isDirectory()) visit(absolute);
      else if (/\.(?:ts|tsx)$/.test(name) && !/\.(?:test|d)\.tsx?$/.test(name))
        sources.set(relative(root, absolute).replaceAll('\\', '/'), readFileSync(absolute, 'utf8'));
    }
  };
  visit(join(root, 'apps/mobile/app'));
  visit(join(root, 'apps/mobile/src'));
  sources.set('scripts/touch-target-known.json', readFileSync(join(root, 'scripts/touch-target-known.json'), 'utf8'));
  sources.set('scripts/design-token-s3a-known.json', readFileSync(join(root, 'scripts/design-token-s3a-known.json'), 'utf8'));
  return sources;
}

const occurrences = (sources, regex) => {
  let count = 0;
  for (const text of sources.values()) count += [...text.matchAll(regex)].length;
  return count;
};

export function evaluateS4(sources, contract) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const count = (name, regex) => {
    const actual = occurrences(sources, regex);
    const expected = contract.counts[name];
    if (actual !== expected) fail(`${name} ${actual} ≠ ${expected}`);
  };
  count('scrollStart', /paddingTop\s*:\s*LAYOUT\.scroll\.start\b/g);
  count('scrollEnd', /paddingBottom\s*:\s*LAYOUT\.scroll\.end\b(?!WithFab)/g);
  count('scrollEndWithFab', /paddingBottom\s*:\s*LAYOUT\.scroll\.endWithFab\b/g);
  count('rowMinHeightOneLine', /minHeight\s*:\s*rowMinHeight\.oneLine\b/g);
  count('rowMinHeightTwoLine', /minHeight\s*:\s*rowMinHeight\.twoLine\b/g);
  const get = (file) => sources.get(file) ?? '';
  const adjacentSources = [
    get('apps/mobile/src/features/my/screens/MyVendorsScreen.tsx'),
    get('apps/mobile/src/features/recipes/screens/MaterialManageScreen.tsx'),
  ].join('\n');
  const adjacentCount = (name, regex) => {
    const actual = [...adjacentSources.matchAll(regex)].length;
    if (actual !== contract.counts[name]) fail(`${name} ${actual} ≠ ${contract.counts[name]}`);
  };
  adjacentCount('adjacentActionDimensions', /(?:width|height)\s*:\s*controlVisualHeight\.sm\b/g);
  adjacentCount('adjacentActionHitSlop', /hitSlop\s*=\s*\{COMPONENT\.adjacentActions\.hitSlop\}/g);
  adjacentCount('adjacentActionGaps', /gap\s*:\s*COMPONENT\.adjacentActions\.gap\b/g);

  const tokens = get('apps/mobile/src/theme/tokens.ts');
  for (const pattern of [
    /baseHeight\s*:\s*60\b/, /labelBaseLineHeight\s*:\s*TYPE\.captionSm\.lineHeight/,
    /bottom\s*:\s*space\.xxl/, /visualHeight\s*:\s*48\b/,
    /endWithFab\s*:\s*COMPONENT\.fab\.bottom\s*\+\s*COMPONENT\.fab\.visualHeight\s*\+\s*space\.xxl/,
    /adjacentActions\s*:\s*\{[\s\S]*?gap\s*:\s*space\.md[\s\S]*?hitSlop\s*:\s*6/,
  ]) if (!pattern.test(tokens)) fail(`tokens.ts 계약 누락: ${pattern}`);

  const tabs = get('apps/mobile/app/(tabs)/_layout.tsx');
  if ([...tabs.matchAll(/tabBarLabel\s*:\s*tabLabel\(/g)].length !== contract.counts.tabScreens) fail('탭 화면 5개의 custom label 연결이 아니다');
  for (const pattern of [/numberOfLines=\{2\}/, /maxFontSizeMultiplier=\{2\}/, /onLayout=/,
    /Math\.max\(0,\s*labelHeight\s*-\s*COMPONENT\.tabBar\.labelBaseLineHeight\)/,
    /\+\s*bottomPad/, /paddingBottom\s*:\s*bottomPad/]) if (!pattern.test(tabs)) fail(`탭바 계약 누락: ${pattern}`);
  if ((tabs.match(/insets\.bottom/g) ?? []).length !== 1) fail('safe-area bottom을 정확히 한 번만 읽지 않는다');

  const provider = get('apps/mobile/src/components/layout/TabBarMetrics.tsx');
  if (!/useBottomTabBarHeight\(\)/.test(provider)) fail('실제 탭바 높이 관측이 없다');
  const stacks = ['ingredients', 'recipes', 'orders', 'sales', 'my'];
  const wrapped = stacks.filter((name) => /<ObservedTabBarHeightProvider>/.test(get(`apps/mobile/app/(tabs)/${name}/_layout.tsx`))).length;
  if (wrapped !== contract.counts.tabStackProviders) fail(`탭 Stack provider ${wrapped} ≠ ${contract.counts.tabStackProviders}`);

  const button = get('apps/mobile/src/components/kit/Button.tsx');
  const caller = button.indexOf('\n        style,');
  const locked = button.indexOf('{ minHeight: minTouchTarget }');
  if (caller < 0 || locked < 0 || locked < caller) fail('Button minTouchTarget이 호출부 style 뒤에서 잠기지 않았다');

  const category = get('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx');
  if (!/accessibilityLabel=\{`\$\{c\.name\} 순서 변경`\}/.test(category) || !/width\s*:\s*44,\s*height\s*:\s*44/.test(category))
    fail('카테고리 순서 변경 단일 44×44 진입점이 없다');
  if (/width\s*:\s*28|height\s*:\s*20/.test(category)) fail('옛 28×20 재정렬 상자가 남아 있다');
  if (!/Alert\.alert\(`\$\{name\} 순서 변경`/.test(category)) fail('순서 변경 방향 선택이 없다');

  const profit = get('apps/mobile/src/features/sales/components/ProfitBlocks.tsx');
  if (!/매장 \{m\.qtyHall\}[\s\S]*?폐기 \$\{m\.qtyWaste\}/.test(profit)) fail('sales-menu-sub 요약을 찾지 못했다');
  const summaryTag = profit.match(/<Text[^>]*>\s*매장 \{m\.qtyHall\}[\s\S]*?<\/Text>/)?.[0] ?? '';
  if (!summaryTag || /numberOfLines=/.test(summaryTag)) fail('sales-menu-sub 줄바꿈이 열려 있지 않다');

  let touch;
  try { touch = JSON.parse(get('scripts/touch-target-known.json')); } catch { fail('touch-target-known.json을 읽지 못했다'); }
  if (touch) {
    if (touch.entries?.length !== 0) fail(`터치 미달 ${touch.entries?.length ?? '없음'}건`);
    if (touch.siblingOverlaps?.length !== 0) fail(`형제 중첩 ${touch.siblingOverlaps?.length ?? '없음'}건`);
    if (!touch.components?.length || touch.components.some((item) => item.판정 !== '통과')) fail('Button variant 정적 통과가 닫히지 않았다');
  }

  // S4가 구조를 소유해 대체한 파일을 빼고, S3a의 1,042개 토큰 치환이 현재 소스에 남아
  // 있는지 파일·속성·표현식별 최소 개수로 재단언한다. 이전 단계 검사기를 단순 삭제하지 않는다.
  let prior;
  try { prior = JSON.parse(get(contract.priorStage.contract)); } catch { fail('S3a 계약을 읽지 못했다'); }
  if (prior) {
    const superseded = new Set(contract.priorStage.supersededFiles ?? []);
    const groups = new Map();
    for (const item of prior.assignmentPlan ?? []) {
      const file = item.key.replace(/:\d+:[^:]+$/, '');
      if (superseded.has(file)) continue;
      const prop = item.key.match(/:([^:]+)$/)?.[1];
      const key = JSON.stringify([file, prop, item.expression]);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [key, expected] of groups) {
      const [file, prop, expression] = JSON.parse(key);
      const actual = [...get(file).matchAll(new RegExp(`${escape(prop)}\\s*:\\s*${escape(expression)}\\b`, 'g'))].length;
      if (actual < expected) fail(`S3a 회귀 ${file} ${prop}:${expression} ${actual} < ${expected}`);
    }
  }
  return failures;
}

function main() {
  const opt = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--')).map((arg) => {
    const i = arg.indexOf('='); return i < 0 ? [arg.slice(2), ''] : [arg.slice(2, i), arg.slice(i + 1)];
  }));
  const root = resolve(opt.root ?? defaultRoot);
  const contractPath = resolve(opt.contract ?? join(root, 'scripts/design-token-s4-contract.json'));
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const failures = evaluateS4(loadSources(root), contract);
  let head = null; let dirty = null;
  if (existsSync(join(root, '.git'))) {
    head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
    dirty = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout.trim().split(/\r?\n/).filter(Boolean).length;
  }
  if (opt['expect-commit']) {
    const resolved = spawnSync('git', ['rev-parse', `${opt['expect-commit']}^{commit}`], { cwd: root, encoding: 'utf8' }).stdout.trim();
    if (!resolved || resolved !== head) failures.push(`측정 커밋 불일치: 기대 ${opt['expect-commit']} · 현재 ${head}`);
    if (dirty !== 0) failures.push(`작업 트리 변경 ${dirty}건 — exact SHA 증거가 아니다`);
  }
  const result = { schemaVersion: 1, stage: 'S4', contract, head, dirty, failures };
  if (opt.out) writeFileSync(resolve(opt.out), JSON.stringify(result, null, 2) + '\n');
  console.log(`S4 계약 — scroll ${contract.counts.scrollStart}/${contract.counts.scrollEnd}/${contract.counts.scrollEndWithFab} · row ${contract.counts.rowMinHeightOneLine}/${contract.counts.rowMinHeightTwoLine}`);
  if (failures.length) { console.error(failures.map((failure) => `  - ${failure}`).join('\n')); process.exit(1); }
  console.log('S4 계약 PASS');
}

if (resolve(process.argv[1] ?? '') === resolve(here)) main();
