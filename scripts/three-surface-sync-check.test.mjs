#!/usr/bin/env node
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tempBase = resolve(sourceRoot, '.tmp');
mkdirSync(tempBase, { recursive: true });
const temp = mkdtempSync(join(tempBase, 'three-surface-p1-'));
const script = resolve(sourceRoot, 'scripts/three-surface-sync-check.mjs');
const run = (...args) => spawnSync(process.execPath, [script, `--root=${temp}`, ...args], { encoding: 'utf8', maxBuffer: 100_000_000 });
const output = (result) => `${result.stdout ?? ''}${result.stderr ?? ''}`;
let passed = 0;
const expectPass = (result) => { assert.equal(result.status, 0, output(result)); passed += 1; };
const expectFail = (result, pattern) => { assert.notEqual(result.status, 0, output(result)); assert.match(output(result), pattern); passed += 1; };
const paths = {
  declarations: 'apps/mobile/src/dev/surfaceRegistry.declarations.json',
  generated: 'apps/mobile/src/dev/surfaceRegistry.generated.json',
  readme: 'apps/mobile/src/features/README.md',
  prototype: 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html',
  baseline: 'docs/prototypes/three-surface-baseline.json',
  stubRegistry: 'apps/mobile/src/dev/surfaceFixtureStubs.json',
  tsconfig: 'apps/mobile/tsconfig.json',
};
const full = (key) => resolve(temp, paths[key]);
const restore = new Map();
const save = (key) => { if (!restore.has(key)) restore.set(key, readFileSync(full(key), 'utf8')); };
const reset = (key) => writeFileSync(full(key), restore.get(key), 'utf8');
const mutateJson = (key, change) => {
  save(key);
  const value = JSON.parse(readFileSync(full(key), 'utf8'));
  change(value);
  writeFileSync(full(key), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

try {
  cpSync(resolve(sourceRoot, 'apps/mobile/app'), resolve(temp, 'apps/mobile/app'), { recursive: true });
  cpSync(resolve(sourceRoot, 'apps/mobile/src'), resolve(temp, 'apps/mobile/src'), { recursive: true });
  cpSync(resolve(sourceRoot, 'apps/mobile/assets'), resolve(temp, 'apps/mobile/assets'), { recursive: true });
  cpSync(resolve(sourceRoot, 'apps/mobile/tsconfig.json'), full('tsconfig'));
  cpSync(resolve(sourceRoot, 'tsconfig.base.json'), resolve(temp, 'tsconfig.base.json'));
  cpSync(resolve(sourceRoot, 'apps/mobile/app.json'), resolve(temp, 'apps/mobile/app.json'));
  for (const packageName of ['core', 'db', 'types'])
    cpSync(resolve(sourceRoot, `packages/${packageName}/src`), resolve(temp, `packages/${packageName}/src`), { recursive: true });
  for (const key of ['prototype', 'baseline']) {
    mkdirSync(dirname(full(key)), { recursive: true });
    cpSync(resolve(sourceRoot, paths[key]), full(key));
  }
  for (const key of ['declarations', 'generated', 'readme', 'prototype', 'baseline', 'stubRegistry', 'tsconfig']) save(key);

  expectPass(run());

  const removedRoute = resolve(temp, 'apps/mobile/app/(tabs)/my/country.tsx');
  const removedRouteText = readFileSync(removedRoute, 'utf8');
  rmSync(removedRoute);
  expectFail(run(), /inventory floor|route가 없다|README ID 없는 Expo route/);
  writeFileSync(removedRoute, removedRouteText);

  const addedRoute = resolve(temp, 'apps/mobile/app/(tabs)/orphan.tsx');
  writeFileSync(addedRoute, 'export default function Orphan(){ return null }\n');
  expectFail(run(), /README ID 없는 Expo route/);
  rmSync(addedRoute);

  save('prototype');
  writeFileSync(full('prototype'), restore.get('prototype').replace("const screens={", "const screens={\n      orphan_probe:{domain:'my',route:'MY-99'},"));
  expectFail(run(), /미등록 prototype target/);
  reset('prototype');

  save('readme');
  writeFileSync(full('readme'), restore.get('readme').replace('| `my` | MY-12 |', '| `my` | MY-11 |'));
  expectFail(run(), /중복 screenId/);
  reset('readme');

  mutateJson('declarations', (value) => { value.surfaces.find(({ screenId }) => screenId === 'ING-05').routeBinding.sourceComponent = 'apps/mobile/src/missing.tsx#Missing'; });
  expectFail(run(), /sourceComponent 파일이 없다/);
  reset('declarations');

  mutateJson('declarations', (value) => { value.surfaces.find(({ screenId }) => screenId === 'ING-01').expoRoute = 'ingredients'; });
  expectFail(run(), /사람 선언에 생성 컬럼 금지/);
  reset('declarations');

  mutateJson('declarations', (value) => { delete value.surfaces.find(({ screenId }) => screenId === 'ING-05').fixtureRef; });
  expectFail(run(), /fixture 계약 누락/);
  reset('declarations');

  mutateJson('declarations', (value) => {
    const row = value.surfaces.find(({ screenId }) => screenId === 'ING-05');
    row.fixtureKind = 'devSeedEntity';
    row.fixtureRef = { seedVersion: 'v1', entityKind: 'ingredient', selector: { id: '123e4567-e89b-12d3-a456-426614174000' } };
  });
  expectFail(run(), /bare UUID/);
  reset('declarations');

  mutateJson('declarations', (value) => {
    const row = value.surfaces.find(({ screenId }) => screenId === 'ING-01');
    row.catalogMode = 'unsupported'; delete row.reason; delete row.states;
  });
  expectFail(run(), /reason 필수/);
  reset('declarations');

  save('generated');
  writeFileSync(full('generated'), restore.get('generated').replace('"stage": "P1"', '"stage": "TAMPERED"'));
  expectFail(run(), /committed bytes/);
  reset('generated');

  writeFileSync(full('readme'), restore.get('readme').replace('| `ING-01` | `aligned` |', '| `ING-01` | `expoOnly` |'));
  expectFail(run(), /README 생성 상태 블록/);
  reset('readme');

  const product = resolve(temp, 'apps/mobile/src/theme/tokens.ts');
  const productText = readFileSync(product, 'utf8');
  writeFileSync(product, `import '../dev/surfaceRegistry';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText);

  const boundaryProduct = resolve(temp, 'apps/mobile/src/deviceProbe.ts');
  writeFileSync(boundaryProduct, "import './dev/surfaceRegistry';\nexport const deviceProbe = true;\n");
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  rmSync(boundaryProduct);

  writeFileSync(product, `${productText}\nconst HiddenSurface = null;\n`);
  mutateJson('declarations', (value) => { value.surfaces.find(({ screenId }) => screenId === 'ING-05').routeBinding.sourceComponent = 'apps/mobile/src/theme/tokens.ts#HiddenSurface'; });
  expectFail(run(), /sourceComponent export가 없다/);
  reset('declarations'); writeFileSync(product, productText);

  writeFileSync(full('declarations'), `\ufeff${restore.get('declarations')}`);
  expectFail(run(), /BOM 없음/);
  reset('declarations');

  writeFileSync(full('declarations'), restore.get('declarations').replaceAll('\n', '\r\n'));
  expectFail(run(), /LF 계약/);
  reset('declarations');

  writeFileSync(full('readme'), `${restore.get('readme')}\n<!-- THREE-SURFACE-STATUS:START -->`);
  expectFail(run(), /정확히 1쌍/);
  reset('readme');

  mutateJson('declarations', (value) => { delete value.surfaces.find(({ screenId }) => screenId === 'ING-03b').prototypeSharingReason; });
  expectFail(run(), /prototypeSharingReason/);
  reset('declarations');

  mutateJson('declarations', (value) => { delete value.surfaces.find(({ screenId }) => screenId === 'ING-03').prototypeSharingReason; });
  expectFail(run(), /1:N prototype 매핑/);
  reset('declarations');

  mutateJson('declarations', (value) => { value.routeExclusions[0].route = 'my/country'; });
  expectFail(run(), /redirect로 입증되지 않은/);
  reset('declarations');

  mutateJson('declarations', (value) => { value.surfaces.find(({ screenId }) => screenId === 'ING-05').routeBinding.sourceComponent = 'apps/mobile/src/theme/tokens.ts#StockEditSheet'; });
  expectFail(run(), /sourceComponent export가 없다/);
  reset('declarations');

  writeFileSync(full('generated'), restore.get('generated').replaceAll('\n', '\r\n'));
  expectFail(run(), /committed bytes/);
  reset('generated');

  writeFileSync(full('readme'), restore.get('readme').replace('| `my` | MY-01 |', '| `my` | MY-99 | Spec probe | prototype only | 미구현 |\n| `my` | MY-01 |'));
  writeFileSync(full('prototype'), restore.get('prototype').replace("const screens={", "const screens={\n      spec_probe:{domain:'my',route:'MY-99'},"));
  mutateJson('declarations', (value) => value.surfaces.push({
    screenId: 'MY-99', parity: 'specOnly', reason: 'prototype-only 음성 fixture', prototypeScreenKeys: ['spec_probe'],
  }));
  expectPass(run('--write'));
  let generated = JSON.parse(readFileSync(full('generated'), 'utf8'));
  assert.ok(generated.surfaces.find(({ screenId }) => screenId === 'MY-99').prototypeTargets.length > 0);
  assert.equal(generated.catalogProjection.some(({ screenId }) => screenId === 'MY-99'), false);
  passed += 1;
  reset('declarations'); reset('generated'); reset('readme'); reset('prototype');

  mutateJson('declarations', (value) => {
    const row = value.surfaces.find(({ screenId }) => screenId === 'ING-01');
    row.catalogMode = 'unsupported'; row.reason = 'catalog 미지원 음성 fixture';
  });
  expectPass(run('--write'));
  generated = JSON.parse(readFileSync(full('generated'), 'utf8'));
  assert.equal(generated.surfaces.find(({ screenId }) => screenId === 'ING-01').states, undefined);
  assert.equal(generated.catalogProjection.some(({ screenId }) => screenId === 'ING-01'), false);
  passed += 1;
  reset('declarations'); reset('generated'); reset('readme');

  const duplicateRoute = resolve(temp, 'apps/mobile/app/ingredients/index.ts');
  mkdirSync(dirname(duplicateRoute), { recursive: true });
  writeFileSync(duplicateRoute, 'export default function Duplicate(){ return null }\n');
  expectFail(run(), /Expo route 이름 중복/);
  rmSync(resolve(temp, 'apps/mobile/app/ingredients'), { recursive: true, force: true });

  writeFileSync(product, `import '../DEV/surfaceRegistry';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지|해석할 수 없는 내부 module specifier/);
  writeFileSync(product, productText);

  writeFileSync(product, `import '../dev/surfaceRegistry.js';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText);

  const nativeDev = resolve(temp, 'apps/mobile/src/dev/nativeProbe.native.ts');
  writeFileSync(nativeDev, 'export const nativeProbe = true;\n');
  writeFileSync(product, `import '../dev/nativeProbe.native';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText); rmSync(nativeDev);

  const webDev = resolve(temp, 'apps/mobile/src/dev/webProbe.web.ts');
  writeFileSync(webDev, 'export const webProbe = true;\n');
  writeFileSync(product, `import '../dev/webProbe';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText); rmSync(webDev);

  writeFileSync(product, `${productText}\nexport const parseProbe = {;\n`);
  expectFail(run(), /TypeScript parse 오류/);
  writeFileSync(product, productText);

  const packageBridge = resolve(temp, 'packages/core/src/p1Bridge.ts');
  writeFileSync(packageBridge, "export * from '../../../apps/mobile/src/dev/surfaceRegistry';\n");
  writeFileSync(product, `import '../../../../packages/core/src/p1Bridge';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText);

  mutateJson('tsconfig', (value) => { delete value.compilerOptions.paths; delete value.compilerOptions.baseUrl; });
  writeFileSync(product, `import '@margincook/core/p1Bridge';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText); reset('tsconfig'); rmSync(packageBridge);

  writeFileSync(product, `void import(\`../dev/surfaceRegistry\`);\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText);

  writeFileSync(product, `require('../dev/surfaceRegistry', 'ignored');\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText);

  writeFileSync(product, `import type { SurfaceRegistryEntry } from '../dev/surfaceRegistry';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText);

  const bridge = resolve(temp, 'apps/mobile/src/lib/devBridge.ts');
  writeFileSync(bridge, "export * from '../dev/surfaceRegistry';\n");
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  rmSync(bridge);

  save('tsconfig');
  writeFileSync(full('tsconfig'), restore.get('tsconfig').replace('"@/*"', '"~/*"'));
  writeFileSync(product, `import '~/dev/surfaceRegistry';\n${productText}`);
  expectFail(run(), /제품 코드의 src\/dev import 금지/);
  writeFileSync(product, productText); reset('tsconfig');

  writeFileSync(product, `import './definitely-missing.js';\n${productText}`);
  expectFail(run(), /해석할 수 없는 내부 module specifier/);
  writeFileSync(product, productText);

  mutateJson('declarations', (value) => {
    value.surfaces.find(({ screenId }) => screenId === 'ING-03b').fixtureRef.stubName = 'missingStub';
  });
  expectFail(run(), /stubName이 registry에 결속되지 않았다/);
  reset('declarations');

  mutateJson('stubRegistry', (value) => { value.stubs.unusedStub = { screenIds: ['ING-01'] }; });
  expectFail(run(), /사용되지 않는 stub registry 항목/);
  reset('stubRegistry');

  mutateJson('declarations', (value) => {
    value.surfaces.find(({ screenId }) => screenId === 'ING-05').routeBinding.sourceComponent = 'apps/mobile/src/features/my/screens/MyHoursScreen.tsx#MyHoursScreen';
  });
  expectFail(run(), /route import graph에서 도달 불가/);
  reset('declarations');

  mutateJson('declarations', (value) => {
    value.surfaces.find(({ screenId }) => screenId === 'ING-03b').routeBinding.expoRoute = 'ingredients/[id]';
  });
  expectFail(run(), /README locator와 routeBinding route가 다르다/);
  reset('declarations');

  mutateJson('baseline', (value) => { value.floors.routeFiles = 1; });
  expectFail(run(), /baseline floors hash가 고정 계약과 다르다/);
  reset('baseline');

  mutateJson('baseline', (value) => { value.thresholds.status = 'deferredUntilP2'; });
  expectFail(run(), /thresholds는 active\/P2/);
  reset('baseline');

  mutateJson('baseline', (value) => { value.thresholds.migrationBacklogMax = -1; });
  expectFail(run(), /migrationBacklogMax는 0 이상 정수/);
  reset('baseline');

  mutateJson('declarations', (value) => {
    value.surfaces.find(({ screenId }) => screenId === 'ING-01').temporaryDivergence = {
      axes: ['visual'], owner: 'DESIGN-SYSTEM', approvedBy: 'negative-fixture',
      expiresAt: '2026-09-20T00:00:00Z', targets: ['screen:ingredient_main'],
    };
  });
  expectFail(run(), /emergency divergence 1건이 상한 0/);
  reset('declarations');

  mutateJson('declarations', (value) => { value.surfaces[0].typoField = true; });
  expectFail(run(), /알 수 없는 사람 선언 필드/);
  reset('declarations');

  save('prototype');
  writeFileSync(full('prototype'), restore.get('prototype').replace('const screens={', 'const spreadProbe={}; const screens={...spreadProbe,'));
  expectFail(run(), /property assignment만 허용/);
  reset('prototype');

  writeFileSync(full('prototype'), restore.get('prototype').replace('const screens={', 'const screens={}; const screens={'));
  expectFail(run(), /top-level에 정확히 1개/);
  reset('prototype');

  writeFileSync(full('prototype'), restore.get('prototype').replace("const screens={", "const screens={\n      ingredient_main:{domain:'ingredient',route:'ING-01'},"));
  expectFail(run(), /prototype registry object 중복 key/);
  reset('prototype');

  const collisionFile = resolve(temp, 'apps/mobile/app/collision.tsx');
  const collisionIndex = resolve(temp, 'apps/mobile/app/collision/index.tsx');
  writeFileSync(collisionFile, 'export default function Collision(){ return null }\n');
  mkdirSync(dirname(collisionIndex), { recursive: true });
  writeFileSync(collisionIndex, 'export default function CollisionIndex(){ return null }\n');
  expectFail(run(), /Expo route 이름 중복/);
  rmSync(collisionFile); rmSync(dirname(collisionIndex), { recursive: true, force: true });

  expectPass(run('--write'));
  const onceRegistry = readFileSync(full('generated'), 'utf8');
  const onceReadme = readFileSync(full('readme'), 'utf8');
  expectPass(run('--write'));
  assert.equal(readFileSync(full('generated'), 'utf8'), onceRegistry);
  assert.equal(readFileSync(full('readme'), 'utf8'), onceReadme);
  passed += 1;

  assert.equal(passed, 57);
  console.log(`three-surface P1/P2 동기화 음성 계약 ${passed}/57 PASS`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
