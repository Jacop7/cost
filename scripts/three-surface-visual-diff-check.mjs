#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifest = 'docs/prototypes/three-surface-approved-visual-changes.json';
const requiredScreens = ['ING-01', 'MY-01', 'ORD-01', 'RCP-01', 'SALES-01'];
const requiredResponsiveModes = ['androidSafe24', 'iosSafe47', 'mobile320', 'mobile320Text200English'];

const codeUnitSort = (values) => [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

export function gitBlobOid(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

function inside(root, candidate) {
  const prefix = `${root.toLowerCase()}${sep}`;
  return candidate.toLowerCase().startsWith(prefix);
}

function readArtifact(root, relativePath, failures) {
  if (typeof relativePath !== 'string' || relativePath.includes('\\')) {
    failures.push(`artifact path must use repository-relative forward slashes: ${relativePath}`);
    return null;
  }
  const absolute = resolve(root, relativePath);
  if (!inside(root, absolute)) {
    failures.push(`artifact escapes repository root: ${relativePath}`);
    return null;
  }
  try {
    return readFileSync(absolute);
  } catch {
    failures.push(`artifact missing: ${relativePath}`);
    return null;
  }
}

export function validateVisualManifest(manifest, { root = repoRoot } = {}) {
  const failures = [];
  if (manifest?.schemaVersion !== 1 || manifest?.stage !== 'P2') failures.push('manifest schemaVersion/stage must be 1/P2');
  if (manifest?.status !== 'candidate' && manifest?.status !== 'approved') failures.push('manifest status must be candidate or approved');
  if (!/^[0-9a-f]{40}$/.test(manifest?.approval?.decisionCommit ?? '')) failures.push('approval.decisionCommit must be an exact commit SHA');

  const env = manifest?.environment ?? {};
  const expectedEnv = {
    renderer: 'react-native-web via Expo Metro', os: 'Windows 11', expoSdk: '54.0.35',
    playwright: '1.62.1', browser: 'Chromium 151', deviceScaleFactor: 1, fontScale: 1,
    locale: 'ko-KR', state: 'ready',
  };
  for (const [key, expected] of Object.entries(expectedEnv)) {
    if (env[key] !== expected) failures.push(`environment.${key} expected ${expected}, got ${env[key]}`);
  }
  if (env?.viewport?.width !== 390 || env?.viewport?.height !== 844) failures.push('environment.viewport must be 390x844');
  const knownResponses = manifest?.knownLocalDataPlaneResponses;
  const expectedKnownPaths = [
    '/rest/v1/rpc/get_user_preferences',
    '/rest/v1/rpc/international_tax_app_state',
    '/rest/v1/rpc/report_client_rpc_error',
  ];
  if (!Array.isArray(knownResponses) || knownResponses.length !== 1 || knownResponses[0].screenId !== 'MY-01'
    || knownResponses[0].status !== 404
    || JSON.stringify(knownResponses[0].paths) !== JSON.stringify(expectedKnownPaths)) {
    failures.push('knownLocalDataPlaneResponses must exactly describe the three observed MY-01 404 paths');
  }

  const responsiveChecks = Array.isArray(manifest?.responsiveChecks) ? manifest.responsiveChecks : [];
  const responsiveKeys = responsiveChecks.map(({ screenId, mode }) => `${screenId}:${mode}`);
  const expectedResponsiveKeys = requiredScreens.flatMap((screenId) => requiredResponsiveModes.map((mode) => `${screenId}:${mode}`));
  if (new Set(responsiveKeys).size !== responsiveKeys.length
    || JSON.stringify(codeUnitSort(responsiveKeys)) !== JSON.stringify(codeUnitSort(expectedResponsiveKeys))) {
    failures.push('responsiveChecks must contain every pilot screen x four modes exactly once');
  }
  for (const check of responsiveChecks) {
    if (!Number.isFinite(check.headerHeight) || check.headerHeight <= 0) failures.push(`${check.screenId}:${check.mode} headerHeight invalid`);
    if (check.documentOverflow !== 0 || check.escapees !== 0) failures.push(`${check.screenId}:${check.mode} responsive overflow`);
  }

  const screens = Array.isArray(manifest?.screens) ? manifest.screens : [];
  const ids = screens.map((screen) => screen.screenId);
  if (new Set(ids).size !== ids.length) failures.push('duplicate screenId in visual manifest');
  if (JSON.stringify(codeUnitSort(ids)) !== JSON.stringify(requiredScreens)) {
    failures.push(`visual pilot screens must be exactly ${requiredScreens.join(', ')}`);
  }

  const elementKeys = new Set();
  for (const screen of screens) {
    if (!/^\/[a-z][a-z0-9/-]*$/.test(screen.route ?? '')) failures.push(`${screen.screenId}: invalid route`);
    if (!/^screen:[a-z0-9_]+$/.test(screen.prototypeTarget ?? '')) failures.push(`${screen.screenId}: invalid prototypeTarget`);

    for (const side of ['before', 'after']) {
      const record = screen[side] ?? {};
      for (const [pathKey, blobKey] of [['png', 'pngBlob'], ['tree', 'treeBlob']]) {
        const bytes = readArtifact(root, record[pathKey], failures);
        if (bytes && gitBlobOid(bytes) !== record[blobKey]) failures.push(`${screen.screenId}.${side}.${blobKey} is stale`);
      }
    }

    const pngChanged = screen.before?.pngBlob !== screen.after?.pngBlob;
    const treeChanged = screen.before?.treeBlob !== screen.after?.treeBlob;
    const changes = Array.isArray(screen.changes) ? screen.changes : [];
    if ((pngChanged || treeChanged) && changes.length === 0) failures.push(`${screen.screenId}: changed evidence has no approval entry`);
    if (!pngChanged && !treeChanged && changes.length > 0) failures.push(`${screen.screenId}: stale approval has no evidence change`);
    if (treeChanged) failures.push(`${screen.screenId}: accessibility tree changed in P2 header-only pilot`);
    for (const change of changes) {
      if (typeof change.elementKey !== 'string' || !change.elementKey.startsWith(`${screen.screenId}/ready/`)) {
        failures.push(`${screen.screenId}: unstable elementKey ${change.elementKey}`);
      }
      if (elementKeys.has(change.elementKey)) failures.push(`duplicate elementKey ${change.elementKey}`);
      elementKeys.add(change.elementKey);
      if (!Array.isArray(change.props) || change.props.length === 0 || new Set(change.props).size !== change.props.length) {
        failures.push(`${screen.screenId}: props must be a non-empty unique array`);
      }
      if (typeof change.reason !== 'string' || change.reason.trim().length < 10) failures.push(`${screen.screenId}: change reason is missing`);
    }
  }
  return failures;
}

export function runVisualCheck(manifestPath = defaultManifest, root = repoRoot) {
  const absolute = resolve(root, manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    return [`manifest unreadable: ${error instanceof Error ? error.message : String(error)}`];
  }
  return validateVisualManifest(manifest, { root });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = runVisualCheck(process.argv[2] ?? defaultManifest);
  if (failures.length) {
    console.error(`three-surface visual diff: FAIL (${failures.length})`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('three-surface visual diff: PASS (5 screens, approved pixel changes, accessibility diff 0, responsive 20/20)');
  }
}
