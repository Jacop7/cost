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
  for (const key of ['prototype', 'baseline']) {
    mkdirSync(dirname(full(key)), { recursive: true });
    cpSync(resolve(sourceRoot, paths[key]), full(key));
  }
  for (const key of ['declarations', 'generated', 'readme', 'prototype']) save(key);

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

  expectPass(run('--write'));
  const onceRegistry = readFileSync(full('generated'), 'utf8');
  const onceReadme = readFileSync(full('readme'), 'utf8');
  expectPass(run('--write'));
  assert.equal(readFileSync(full('generated'), 'utf8'), onceRegistry);
  assert.equal(readFileSync(full('readme'), 'utf8'), onceReadme);
  passed += 1;

  assert.equal(passed, 26);
  console.log(`three-surface P1 동기화 음성 계약 ${passed}/26 PASS`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
