import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compareResponsiveChecks, gitBlobOid, validateVisualManifest } from './three-surface-visual-diff-check.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceManifest = JSON.parse(readFileSync(join(repoRoot, 'docs/prototypes/three-surface-approved-visual-changes.json'), 'utf8'));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'three-surface-visual-'));
  for (const screen of sourceManifest.screens) {
    for (const side of ['before', 'after']) {
      for (const key of ['png', 'tree']) {
        const rel = screen[side][key];
        mkdirSync(dirname(join(root, rel)), { recursive: true });
        cpSync(join(repoRoot, rel), join(root, rel));
      }
    }
  }
  return root;
}

function clone() { return structuredClone(sourceManifest); }

test('repository manifest is valid', () => assert.deepEqual(validateVisualManifest(sourceManifest), []));

test('tampered screenshot fails its bound blob OID', () => {
  const root = fixture();
  try {
    const m = clone();
    const rel = m.screens[0].after.png;
    writeFileSync(join(root, rel), Buffer.from('tampered'));
    assert.match(validateVisualManifest(m, { root }).join('\n'), /pngBlob is stale/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('changed evidence without an approval fails', () => {
  const m = clone();
  m.screens[0].changes = [];
  assert.match(validateVisualManifest(m).join('\n'), /has no approval entry/);
});

test('stale approval without evidence change fails', () => {
  const m = clone();
  m.screens[0].after = structuredClone(m.screens[0].before);
  assert.match(validateVisualManifest(m).join('\n'), /stale approval/);
});

test('accessibility text changes fail the header-only pilot', () => {
  const root = fixture();
  try {
    const m = clone();
    const rel = m.screens[0].after.tree;
    writeFileSync(join(root, rel), '다른 접근성 이름\n');
    m.screens[0].after.treeBlob = gitBlobOid(readFileSync(join(root, rel)));
    assert.match(validateVisualManifest(m, { root }).join('\n'), /accessibility tree changed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing and extra pilot screens both fail', () => {
  const missing = clone();
  missing.screens.pop();
  assert.match(validateVisualManifest(missing).join('\n'), /must be exactly/);
  const extra = clone();
  extra.screens.push({ ...structuredClone(extra.screens[0]), screenId: 'EXTRA-01' });
  assert.match(validateVisualManifest(extra).join('\n'), /must be exactly/);
});

test('duplicate element keys fail', () => {
  const m = clone();
  m.screens[1].changes[0].elementKey = m.screens[0].changes[0].elementKey;
  assert.match(validateVisualManifest(m).join('\n'), /unstable elementKey|duplicate elementKey/);
});

test('environment drift fails', () => {
  const m = clone();
  m.environment.expoSdk = '55';
  assert.match(validateVisualManifest(m).join('\n'), /environment\.expoSdk/);
});

test('missing responsive mode and overflow both fail', () => {
  const missing = clone();
  missing.responsiveChecks.pop();
  assert.match(validateVisualManifest(missing).join('\n'), /four modes exactly once/);
  const overflow = clone();
  overflow.responsiveChecks[0].escapees = 1;
  assert.match(validateVisualManifest(overflow).join('\n'), /escapees must be zero/);
});

test('arbitrary positive header height, safe-area bypass, and vertical clipping fail', () => {
  const height = clone();
  height.responsiveChecks[0].headerHeight += 1;
  assert.match(compareResponsiveChecks(height.responsiveChecks, sourceManifest.responsiveChecks).join('\n'), /headerHeight/);
  const safeArea = clone();
  safeArea.responsiveChecks.find(({ mode }) => mode === 'androidSafe24').safeTop = 0;
  assert.match(validateVisualManifest(safeArea).join('\n'), /safe-area context mismatch/);
  const vertical = clone();
  vertical.responsiveChecks[0].verticalEscapees = 1;
  assert.match(validateVisualManifest(vertical).join('\n'), /verticalEscapees must be zero/);
});

test('unbound data plane fails', () => {
  const m = clone();
  m.dataPlane.captureScope = 'full-page';
  assert.match(validateVisualManifest(m).join('\n'), /dataPlane must bind/);
});
