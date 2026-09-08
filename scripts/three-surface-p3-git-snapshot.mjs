import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE_SCOPE = ['apps/mobile', 'packages/core', 'package.json', 'pnpm-lock.yaml', '.npmrc'];
const ROOT_CONFIGS = [
  '.babelrc', '.babelrc.json', '.babelrc.js', '.babelrc.cjs', '.babelrc.mjs',
  'babel.config.json', 'babel.config.js', 'babel.config.cjs', 'babel.config.mjs', 'babel.config.ts', 'babel.config.cts', 'babel.config.mts',
  'metro.config.json', 'metro.config.js', 'metro.config.cjs', 'metro.config.mjs', 'metro.config.ts', 'metro.config.cts', 'metro.config.mts',
];
const BLOB_MODES = new Set(['100644', '100755']);
const ZERO_OID = '0'.repeat(40);
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const pathKey = (value) => process.platform === 'win32' ? value.toLowerCase() : value;

function safePath(path) {
  assert(typeof path === 'string' && path.length > 0 && !isAbsolute(path)
    && !/[\\:\x00-\x1f\x7f]/.test(path), `unsafe Git path: ${JSON.stringify(path)}`);
  for (const part of path.split('/')) assert(part && part !== '.' && part !== '..'
    && part.toLowerCase() !== '.git' && !/[. ]$/.test(part)
    && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part), `unsafe Git path: ${JSON.stringify(path)}`);
  return path;
}

function decode(buffer) {
  const text = buffer.toString('utf8');
  assert(Buffer.from(text, 'utf8').equals(buffer), 'Git output contains a non-UTF-8 path');
  return text;
}

function nulRecords(buffer) {
  if (buffer.length === 0) return [];
  const text = decode(buffer);
  assert(text.endsWith('\0'), 'Git NUL record is truncated');
  return text.slice(0, -1).split('\0');
}

/** Read-only Git observation; no state/evidence/review/scope approval is inferred. */
export function collectP3GitSnapshot({ root, anchorCommit, targetCommit }) {
  assert(typeof root === 'string' && root.length > 0, 'root is required');
  for (const [label, value] of Object.entries({ anchorCommit, targetCommit }))
    assert(/^[0-9a-f]{40}$/.test(value ?? ''), `${label} must be an exact 40-character SHA`);
  const repo = resolve(root);
  assert(pathKey(realpathSync.native(repo)) === pathKey(repo), 'root must not use a symlink or junction alias');
  const git = (args, allowedCodes = [0]) => {
    const result = spawnSync('git', ['--literal-pathspecs', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
      cwd: repo,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' },
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    assert(allowedCodes.includes(result.status), `Git ${args[0]} failed: ${decode(result.stderr).trim()}`);
    return result;
  };
  const gitText = (args) => decode(git(args).stdout).trim();
  assert(pathKey(resolve(gitText(['rev-parse', '--show-toplevel']))) === pathKey(repo), 'root must equal git show-toplevel');
  const exactCommit = (value, label) => {
    assert(gitText(['cat-file', '-t', value]) === 'commit', `${label} is not a commit object`);
    assert(gitText(['rev-parse', '--verify', `${value}^{commit}`]) === value, `${label} did not resolve exactly`);
  };
  exactCommit(anchorCommit, 'anchorCommit');
  exactCommit(targetCommit, 'targetCommit');
  assert(gitText(['rev-parse', 'HEAD']) === targetCommit, 'HEAD does not equal targetCommit');
  assert(git(['merge-base', '--is-ancestor', anchorCommit, targetCommit], [0, 1]).status === 0, 'anchorCommit is not an ancestor of targetCommit');

  const readTree = (commit, scope) => {
    const records = nulRecords(git(['ls-tree', '-r', '-z', '--full-tree', commit, '--', ...scope]).stdout);
    const entries = records.map((record) => {
      const split = record.indexOf('\t');
      assert(split >= 0, 'invalid ls-tree record');
      const header = record.slice(0, split).match(/^(\d{6}) (blob|commit) ([0-9a-f]{40})$/);
      assert(header, 'invalid ls-tree mode/type/OID');
      const [, mode, type, blob] = header;
      const path = safePath(record.slice(split + 1));
      assert(type === 'blob' && BLOB_MODES.has(mode), `symlink/submodule/unsupported mode in product tree: ${path} (${mode})`);
      return { path, mode, blob };
    }).sort((a, b) => order(a.path, b.path));
    assert(new Set(entries.map((entry) => pathKey(entry.path))).size === entries.length, 'duplicate/case-colliding product tree path');
    return entries;
  };
  // Union keeps deleted root configs in scope and catches new untracked configs too.
  const possibleScope = [...BASE_SCOPE, ...ROOT_CONFIGS];
  const anchorEntries = readTree(anchorCommit, possibleScope);
  const targetEntries = readTree(targetCommit, possibleScope);
  const exists = (path) => {
    try { lstatSync(resolve(repo, path)); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  };
  const scope = [...BASE_SCOPE, ...ROOT_CONFIGS.filter((path) => exists(path)
    || anchorEntries.some((entry) => entry.path === path) || targetEntries.some((entry) => entry.path === path))].sort(order);
  const assertClean = () => {
    // Tracked changes anywhere would make HEAD metadata ambiguous. Ignored runtime inputs are intentionally excluded.
    const trackedFlags = nulRecords(git(['ls-files', '-v', '-z']).stdout);
    assert(trackedFlags.every((record) => !/^[a-zS] /.test(record)), 'tracked assume-unchanged/skip-worktree flags can conceal dirty files');
    assert(git(['status', '--porcelain=v1', '-z', '--untracked-files=no']).stdout.length === 0, 'dirty tracked files are not an exact-SHA snapshot');
    const untracked = nulRecords(git(['ls-files', '--others', '--exclude-standard', '-z', '--', ...scope]).stdout);
    assert(untracked.length === 0, `untracked product files: ${untracked.map((path) => JSON.stringify(path)).join(', ')}`);
  };
  assertClean();
  const seen = new Set();
  for (const { path } of targetEntries) {
    let current = repo;
    for (const part of path.split('/')) {
      current = resolve(current, part);
      if (seen.has(current)) continue;
      seen.add(current);
      const rel = relative(repo, current);
      assert(rel && !rel.startsWith('..') && !isAbsolute(rel), 'product filesystem path escapes root');
      assert(!lstatSync(current).isSymbolicLink(), `symlink/junction in product filesystem: ${path}`);
    }
  }

  const raw = nulRecords(git(['diff', '--raw', '-z', '--no-renames', '--abbrev=40', '--no-ext-diff', '--no-textconv', anchorCommit, targetCommit, '--', ...scope]).stdout);
  assert(raw.length % 2 === 0, 'raw diff record count is invalid');
  const changes = [];
  for (let index = 0; index < raw.length; index += 2) {
    const header = raw[index].match(/^:(\d{6}) (\d{6}) ([0-9a-f]{40}) ([0-9a-f]{40}) ([AMD])$/);
    assert(header, 'raw diff has unsupported status/mode/OID');
    const [, beforeMode, afterMode, beforeBlob, afterBlob, status] = header;
    const path = safePath(raw[index + 1]);
    for (const [mode, blob] of [[beforeMode, beforeBlob], [afterMode, afterBlob]])
      assert(mode === '000000' ? blob === ZERO_OID : BLOB_MODES.has(mode) && blob !== ZERO_OID, `unsafe/inconsistent raw diff mode: ${path}`);
    changes.push({ path, beforeBlob, afterBlob, beforeMode, afterMode, status });
  }
  changes.sort((a, b) => order(a.path, b.path));
  const beforeByPath = new Map(anchorEntries.map((entry) => [entry.path, entry]));
  const afterByPath = new Map(targetEntries.map((entry) => [entry.path, entry]));
  const expectedPaths = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])].filter((path) => {
    const before = beforeByPath.get(path); const after = afterByPath.get(path);
    return before?.blob !== after?.blob || before?.mode !== after?.mode;
  }).sort(order);
  assert(JSON.stringify(changes.map((change) => change.path)) === JSON.stringify(expectedPaths), 'raw diff and full product tree differ');
  for (const change of changes) {
    const before = beforeByPath.get(change.path); const after = afterByPath.get(change.path);
    assert(change.beforeBlob === (before?.blob ?? ZERO_OID) && change.beforeMode === (before?.mode ?? '000000')
      && change.afterBlob === (after?.blob ?? ZERO_OID) && change.afterMode === (after?.mode ?? '000000'), 'raw diff blob/mode differs from tree');
    assert(change.status === (!before ? 'A' : !after ? 'D' : 'M'), 'raw diff status differs from tree');
  }
  assertClean();
  assert(gitText(['rev-parse', 'HEAD']) === targetCommit, 'HEAD changed during snapshot collection');
  const seal = (commit, entries) => ({ commit, entries, listSha256: sha256(`${JSON.stringify(entries)}\n`) });
  return {
    schemaVersion: 1,
    kind: 'p3-git-observation',
    scope,
    anchor: seal(anchorCommit, anchorEntries),
    target: seal(targetCommit, targetEntries),
    changes,
    cleanlinessScope: 'git-tracked-and-nonignored-untracked-product-only',
    limitations: [
      'Ignored files, including .env and node_modules, are not collected; this is not a runtime-input guarantee.',
      'Git environment, filters and ignore settings are inherited. Do not translate this observation alone into an unrestricted cleanUntrackedProduct assertion.',
      'Review, state mapping, evidence and approved-scope adapters are absent; this observation does not approve P3 changes.',
    ],
  };
}
