#!/usr/bin/env node
/** S4 컴포넌트·레이아웃 계약을 소스와 터치 감사 결과에 직접 결속한다. */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';

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

export function loadBaselineSources(root, commit) {
  const sources = new Map();
  const list = spawnSync('git', ['ls-tree', '-r', '--name-only', commit, '--', 'apps/mobile/app', 'apps/mobile/src'], { cwd: root, encoding: 'utf8' });
  if (list.status !== 0) throw new Error(`baseline ${commit} 파일 목록을 읽지 못했다`);
  for (const file of list.stdout.split(/\r?\n/).filter((name) => /\.(?:ts|tsx)$/.test(name) && !/\.(?:test|d)\.tsx?$/.test(name))) {
    const shown = spawnSync('git', ['show', `${commit}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    if (shown.status !== 0) throw new Error(`baseline 파일을 읽지 못했다: ${file}`);
    sources.set(file, shown.stdout);
  }
  return sources;
}

const geometryProps = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingHorizontal', 'paddingVertical',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginHorizontal', 'marginVertical',
  'gap', 'rowGap', 'columnGap', 'top', 'right', 'bottom', 'left', 'position',
  'flexDirection', 'flexWrap', 'flexShrink',
]);
const geometryAttrs = new Set(['hitSlop', 'numberOfLines', 'maxFontSizeMultiplier']);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const compact = (value) => value.replace(/\s+/g, ' ').trim();

/** S4가 허용하는 기하·터치·줄바꿈 변화의 AST 투영. 건수 정규식과 달리 위치가 바뀌거나 상쇄돼도 잡는다. */
export function astGeometryInventory(sources) {
  const result = new Map();
  for (const [file, text] of sources) {
    if (!/\.(?:ts|tsx)$/.test(file)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const rows = [];
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && geometryProps.has(node.name.getText(sf).replace(/^['"]|['"]$/g, '')))
        rows.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}:prop:${compact(node.getText(sf))}`);
      if (ts.isJsxAttribute(node) && geometryAttrs.has(node.name.text))
        rows.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}:attr:${compact(node.getText(sf))}`);
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (rows.length) result.set(file, rows);
  }
  return result;
}

export function astDiffManifest(beforeSources, afterSources) {
  const before = astGeometryInventory(beforeSources), after = astGeometryInventory(afterSources);
  const files = [...new Set([...before.keys(), ...after.keys()])].sort();
  return files.flatMap((file) => {
    const a = before.get(file) ?? [], b = after.get(file) ?? [];
    const beforeHash = sha(a.join('\n')), afterHash = sha(b.join('\n'));
    return beforeHash === afterHash ? [] : [{ file, beforeHash, afterHash, beforeCount: a.length, afterCount: b.length }];
  });
}

export function astDiffContract(beforeSources, afterSources) {
  const items = astDiffManifest(beforeSources, afterSources);
  return {
    files: items.map((item) => item.file),
    beforeHash: sha(JSON.stringify(items.map(({ file, beforeHash, beforeCount }) => ({ file, beforeHash, beforeCount })))),
    afterHash: sha(JSON.stringify(items.map(({ file, afterHash, afterCount }) => ({ file, afterHash, afterCount })))),
  };
}

/**
 * 허용 파일 해시는 범위를 막지만 무엇을 승인했는지는 설명하지 못한다. 같은 속성의 등장
 * 순서를 안정 key로 삼아 선언별 `before → after`를 보존한다. 추가·삭제는 null로 표시한다.\n+ * 계약 검토자가 파일명·속성·값을 직접 읽을 수 있고, 값 하나만 바뀌어도 정확히 실패한다.
 */
export function astGeometryDeclarations(sources) {
  const result = new Map();
  for (const [file, text] of sources) {
    if (!/\.(?:ts|tsx)$/.test(file)) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const counts = new Map();
    const rows = new Map();
    const add = (kind, prop, value) => {
      const base = `${kind}:${prop}`;
      const occurrence = (counts.get(base) ?? 0) + 1;
      counts.set(base, occurrence);
      rows.set(`${base}#${occurrence}`, compact(value));
    };
    const visit = (node) => {
      if (ts.isPropertyAssignment(node)) {
        const prop = node.name.getText(sf).replace(/^['"]|['"]$/g, '');
        if (geometryProps.has(prop)) add('prop', prop, node.initializer.getText(sf));
      }
      if (ts.isJsxAttribute(node) && geometryAttrs.has(node.name.text))
        add('attr', node.name.text, node.initializer?.getText(sf) ?? 'true');
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (rows.size) result.set(file, rows);
  }
  return result;
}

export function astChangePlan(beforeSources, afterSources) {
  const before = astGeometryDeclarations(beforeSources), after = astGeometryDeclarations(afterSources);
  const files = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes = [];
  for (const file of files) {
    const a = before.get(file) ?? new Map(), b = after.get(file) ?? new Map();
    for (const declaration of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      const beforeValue = a.get(declaration) ?? null;
      const afterValue = b.get(declaration) ?? null;
      if (beforeValue !== afterValue) changes.push({ file, declaration, before: beforeValue, after: afterValue });
    }
  }
  return changes;
}

const occurrences = (sources, regex) => {
  let count = 0;
  for (const text of sources.values()) count += [...text.matchAll(regex)].length;
  return count;
};

export function evaluateS4(sources, contract, baselineSources) {
  const failures = [];
  const fail = (message) => failures.push(message);
  if (!baselineSources) fail('S4 baseline AST 입력이 없다');
  else {
    const actual = astDiffContract(baselineSources, sources);
    const expected = contract.allowedAstDiff ?? {};
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      const actualFiles = actual.files?.join(', ') ?? '';
      const expectedFiles = expected.files?.join(', ') ?? '';
      fail(`S4 허용 AST diff 불일치 — 실제 [${actualFiles}] · 계약 [${expectedFiles}]`);
    }
    const actualChanges = astChangePlan(baselineSources, sources);
    const expectedChanges = contract.allowedAstChanges;
    if (!Array.isArray(expectedChanges)) fail('S4 선언별 AST 변경 계약이 없다');
    else {
      const stageCounts = expectedChanges.reduce((counts, item) => {
        counts[item.stage] = (counts[item.stage] ?? 0) + 1;
        return counts;
      }, {});
      const expectedWithoutStage = expectedChanges.map(({ stage: _stage, ...item }) => item);
      if (expectedChanges.some((item) => !['S4', 'S3b', 'S4a', 'S4b'].includes(item.stage)))
        fail('S4 선언별 AST 변경에 유효한 소유 단계가 없는 행이 있다');
      if (stageCounts.S3b !== contract.downstreamStage.geometryChangesIncludedHere)
        fail(`S3b 소유 AST 변경 ${stageCounts.S3b ?? 0} ≠ ${contract.downstreamStage.geometryChangesIncludedHere}`);
      if (stageCounts.S4a !== contract.nativeStage.geometryChangesIncludedHere)
        fail(`S4a 소유 AST 변경 ${stageCounts.S4a ?? 0} ≠ ${contract.nativeStage.geometryChangesIncludedHere}`);
      if ((stageCounts.S4b ?? 0) !== (contract.nativeFollowupStage?.geometryChangesIncludedHere ?? 0))
        fail(`S4b 소유 AST 변경 ${stageCounts.S4b ?? 0} ≠ ${contract.nativeFollowupStage?.geometryChangesIncludedHere ?? 0}`);
      const expectedS4 = expectedChanges.length - contract.downstreamStage.geometryChangesIncludedHere
        - contract.nativeStage.geometryChangesIncludedHere - (contract.nativeFollowupStage?.geometryChangesIncludedHere ?? 0);
      if (stageCounts.S4 !== expectedS4) fail(`S4 소유 AST 변경 ${stageCounts.S4 ?? 0} ≠ ${expectedS4}`);
      if (JSON.stringify(actualChanges) !== JSON.stringify(expectedWithoutStage)) {
        const first = actualChanges.find((item, index) => JSON.stringify(item) !== JSON.stringify(expectedWithoutStage[index]))
          ?? expectedWithoutStage[actualChanges.length];
        fail(`S4 선언별 AST 변경 불일치 — ${first?.file ?? '건수'} ${first?.declaration ?? `${actualChanges.length}≠${expectedWithoutStage.length}`}`);
      }
    }
  }
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
    /\+\s*bottomPad/, /paddingBottom\s*:\s*bottomPad/, /useWindowDimensions\(\)/,
    /\[bottomPad,\s*fontScale\]/, /key=\{`\$\{label\}-\$\{fontScale\}`\}/,
    /tabBarInactiveTintColor\s*:\s*COLOR\.text\.tertiary/]) if (!pattern.test(tabs)) fail(`탭바 계약 누락: ${pattern}`);
  if ((tabs.match(/insets\.bottom/g) ?? []).length !== 1) fail('safe-area bottom을 정확히 한 번만 읽지 않는다');

  const provider = get('apps/mobile/src/components/layout/TabBarMetrics.tsx');
  if (!/useBottomTabBarHeight\(\)/.test(provider)) fail('실제 탭바 높이 관측이 없다');
  if (!/Tabs[^\n]*전용|Tabs[^\n]*아래/.test(provider)) fail('TabBarMetrics의 Tabs 전용 생명주기 계약이 문서화되지 않았다');
  const stacks = ['ingredients', 'recipes', 'orders', 'sales', 'my'];
  const wrapped = stacks.filter((name) => /<ObservedTabBarHeightProvider>/.test(get(`apps/mobile/app/(tabs)/${name}/_layout.tsx`))).length;
  if (wrapped !== contract.counts.tabStackProviders) fail(`탭 Stack provider ${wrapped} ≠ ${contract.counts.tabStackProviders}`);

  const button = get('apps/mobile/src/components/kit/Button.tsx');
  for (const pattern of [/sm:\s*\{[^}]*hs:\s*0\b[^}]*minHeight:\s*44\b/, /md:\s*\{[^}]*hs:\s*1\b/, /lg:\s*\{[^}]*hs:\s*0\b/,
    /hitSlop=\{\{\s*top:\s*s\.hs,\s*bottom:\s*s\.hs\s*\}\}/])
    if (!pattern.test(button)) fail(`Button 크기·hitSlop 계약 누락: ${pattern}`);
  if (/minHeight\s*:\s*minTouchTarget/.test(button)) fail('Button에 시각 높이를 바꾸는 minTouchTarget이 돌아왔다');

  const sheet = get('apps/mobile/src/components/kit/Sheet.tsx');
  for (const pattern of [/useSafeAreaInsets\(\)/, /paddingBottom\s*:\s*LAYOUT\.scroll\.end\s*\+\s*insets\.bottom/])
    if (!pattern.test(sheet)) fail(`Modal Sheet safe-area 계약 누락: ${pattern}`);

  const category = get('apps/mobile/src/features/recipes/screens/CategoryEditScreen.tsx');
  if (!/accessibilityLabel=\{`\$\{c\.name\} 순서 변경`\}/.test(category) || !/width\s*:\s*44,\s*height\s*:\s*44/.test(category))
    fail('카테고리 순서 변경 단일 44×44 진입점이 없다');
  if (/width\s*:\s*28|height\s*:\s*20/.test(category)) fail('옛 28×20 재정렬 상자가 남아 있다');
  if (!/visible=\{reordering\s*!==\s*null\}/.test(category) || !/위로 이동/.test(category) || !/아래로 이동/.test(category))
    fail('웹에서도 두 방향이 동작하는 kit Sheet 순서 선택이 없다');

  const profit = get('apps/mobile/src/features/sales/components/ProfitBlocks.tsx');
  if (!/매장 \{m\.qtyHall\}[\s\S]*?폐기 \$\{m\.qtyWaste\}/.test(profit)) fail('sales-menu-sub 요약을 찾지 못했다');
  const summaryTag = profit.match(/<Text[^>]*>\s*매장 \{m\.qtyHall\}[\s\S]*?<\/Text>/)?.[0] ?? '';
  if (!summaryTag || /numberOfLines=/.test(summaryTag)) fail('sales-menu-sub 줄바꿈이 열려 있지 않다');

  let touch;
  try { touch = JSON.parse(get('scripts/touch-target-known.json')); } catch { fail('touch-target-known.json을 읽지 못했다'); }
  if (touch) {
    if (touch.entries?.length !== 0) fail(`터치 미달 ${touch.entries?.length ?? '없음'}건`);
    if (touch.siblingOverlaps?.length !== 0) fail(`형제 중첩 ${touch.siblingOverlaps?.length ?? '없음'}건`);
    const componentState = new Map((touch.components ?? []).map((item) => [item.컴포넌트, item.판정]));
    if (componentState.get('Button size="sm"') !== '통과'
      || componentState.get('Button size="md"') !== '부모판정불가'
      || componentState.get('Button size="lg"') !== '통과')
      fail('Button variant 부모 clipping 상태가 계약과 다르다');
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
  let contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  let baselineSources;
  try { baselineSources = loadBaselineSources(root, contract.baselineCommit); }
  catch (error) { baselineSources = null; console.error(String(error)); }
  if (opt['update-ast-contract'] !== undefined) {
    if (!baselineSources) throw new Error('baseline AST 입력 없이 계약을 갱신할 수 없다');
    const sources = loadSources(root);
    const previousStages = new Map((contract.allowedAstChanges ?? []).map(({ stage, ...item }) => [JSON.stringify(item), stage]));
    const allowedAstChanges = astChangePlan(baselineSources, sources)
      .map((item) => ({ ...item, stage: previousStages.get(JSON.stringify(item)) ?? 'S4a' }));
    contract = {
      ...contract,
      allowedAstDiff: astDiffContract(baselineSources, sources),
      nativeStage: { ...(contract.nativeStage ?? {}), stage: 'S4a', geometryChangesIncludedHere: allowedAstChanges.filter((item) => item.stage === 'S4a').length },
      nativeFollowupStage: { ...(contract.nativeFollowupStage ?? {}), stage: 'S4b', geometryChangesIncludedHere: allowedAstChanges.filter((item) => item.stage === 'S4b').length },
      allowedAstChanges,
    };
    writeFileSync(contractPath, JSON.stringify(contract, null, 2) + '\n');
  }
  const failures = evaluateS4(loadSources(root), contract, baselineSources);
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
