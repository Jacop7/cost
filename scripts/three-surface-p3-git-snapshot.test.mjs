import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { collectP3GitSnapshot } from './three-surface-p3-git-snapshot.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'p3-git-snapshot-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Snapshot test');
  git('config', 'user.email', 'snapshot@example.invalid');
  git('config', 'core.autocrlf', 'false');
  git('config', 'core.filemode', 'false');
  const write = (path, content) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); };
  const commit = () => { git('add', '-A'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  write('.gitignore', '.env\nnode_modules/\n');
  write('apps/mobile/[id].tsx', 'export default 1;\n');
  write('apps/mobile/keep.ts', 'keep\n');
  write('packages/core/index.ts', 'core\n');
  write('package.json', '{}\n');
  write('README.md', 'docs\n');
  const anchorCommit = commit();
  const collect = (targetCommit = git('rev-parse', 'HEAD'), anchor = anchorCommit, customRoot = root) => collectP3GitSnapshot({ root: customRoot, anchorCommit: anchor, targetCommit });
  return { root, git, write, commit, anchorCommit, collect };
}

test('snapshot captures modification, add/delete, rename as add/delete, literal bracket path and whole tree seals', (t) => {
  const f = fixture(t);
  f.write('apps/mobile/[id].tsx', 'export default 2;\n');
  f.write('apps/mobile/id.tsx', 'not the bracket path\n');
  renameSync(join(f.root, 'packages/core/index.ts'), join(f.root, 'packages/core/renamed.ts'));
  f.write('babel.config.cjs', 'module.exports = {};\n');
  const target = f.commit();
  const result = f.collect(target);
  assert.deepEqual(result.changes.map(({ path, status }) => [path, status]), [
    ['apps/mobile/[id].tsx', 'M'], ['apps/mobile/id.tsx', 'A'], ['babel.config.cjs', 'A'],
    ['packages/core/index.ts', 'D'], ['packages/core/renamed.ts', 'A'],
  ]);
  assert.ok(result.scope.includes('babel.config.cjs'));
  assert.match(result.anchor.listSha256, /^[0-9a-f]{64}$/);
  assert.notEqual(result.anchor.listSha256, result.target.listSha256);
  assert.ok(result.target.entries.some(({ path }) => path === 'apps/mobile/keep.ts'));
  for (const change of result.changes) assert.match(change.beforeBlob, /^[0-9a-f]{40}$/);
  assert.deepEqual(f.collect(target), result);
});

test('mode-only changes keep blob identity and remain observable', (t) => {
  const f = fixture(t);
  f.git('update-index', '--chmod=+x', 'apps/mobile/keep.ts');
  f.git('commit', '-qm', 'executable mode');
  const result = f.collect();
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].beforeMode, '100644');
  assert.equal(result.changes[0].afterMode, '100755');
  assert.equal(result.changes[0].beforeBlob, result.changes[0].afterBlob);
});

test('deleted root config remains scoped from anchor', (t) => {
  const f = fixture(t);
  f.write('metro.config.js', 'module.exports = {};\n');
  const anchor = f.commit();
  rmSync(join(f.root, 'metro.config.js'));
  const target = f.commit();
  const result = f.collect(target, anchor);
  assert.ok(result.scope.includes('metro.config.js'));
  assert.equal(result.changes[0].status, 'D');
});

for (const path of ['apps/mobile/keep.ts', 'README.md']) test(`rejects dirty tracked file ${path}`, (t) => {
  const f = fixture(t); f.write(path, 'dirty\n');
  assert.throws(() => f.collect(), /dirty tracked/);
});
test('rejects staged tracked changes', (t) => {
  const f = fixture(t); f.write('package.json', '{"x":1}\n'); f.git('add', 'package.json');
  assert.throws(() => f.collect(), /dirty tracked/);
});
test('rejects index flags that can hide dirty tracked files', (t) => {
  const f = fixture(t);
  f.git('update-index', '--assume-unchanged', 'apps/mobile/keep.ts');
  f.write('apps/mobile/keep.ts', 'hidden dirty change\n');
  assert.throws(() => f.collect(), /assume-unchanged\/skip-worktree/);
});
for (const path of ['apps/mobile/new.ts', 'packages/core/new.ts', 'metro.config.mjs']) test(`rejects product untracked file ${path}`, (t) => {
  const f = fixture(t); f.write(path, 'untracked\n');
  assert.throws(() => f.collect(), /untracked product/);
});
test('ignored runtime files and unrelated untracked docs are outside the observation', (t) => {
  const f = fixture(t);
  f.write('apps/mobile/.env', 'fixture-only\n');
  f.write('apps/mobile/node_modules/example/index.js', 'runtime\n');
  f.write('new-notes.md', 'notes\n');
  const result = f.collect();
  assert.equal(result.changes.length, 0);
  assert.equal(result.cleanlinessScope, 'git-tracked-and-nonignored-untracked-product-only');
  assert.equal(result.target.entries.some(({ path }) => path.includes('.env') || path.includes('node_modules')), false);
  assert.ok(result.limitations.some((text) => text.includes('not a runtime-input guarantee')));
});
test('rejects short SHA, noncommit object, HEAD mismatch and nested root', (t) => {
  const f = fixture(t);
  assert.throws(() => f.collect(f.anchorCommit.slice(0, 7)), /exact 40/);
  assert.throws(() => f.collect(f.git('rev-parse', 'HEAD^{tree}')), /not a commit object/);
  f.write('apps/mobile/keep.ts', 'changed\n'); f.commit();
  assert.throws(() => f.collect(f.anchorCommit), /HEAD does not equal/);
  assert.throws(() => f.collect(undefined, f.anchorCommit, join(f.root, 'apps/mobile')), /show-toplevel/);
});
test('rejects unrelated anchor commit', (t) => {
  const f = fixture(t);
  f.git('checkout', '--orphan', 'unrelated');
  f.git('commit', '-qm', 'unrelated root');
  assert.throws(() => f.collect(), /not an ancestor/);
});

for (const [mode, label] of [['120000', 'symlink'], ['160000', 'submodule']]) test(`rejects committed ${label} without following it`, (t) => {
  const f = fixture(t);
  const oid = mode === '160000' ? f.anchorCommit : f.git('rev-parse', 'HEAD:apps/mobile/keep.ts');
  f.git('update-index', '--add', '--cacheinfo', mode, oid, 'apps/mobile/unsafe');
  f.git('commit', '-qm', label);
  assert.throws(() => f.collect(), /symlink\/submodule\/unsupported mode/);
});

test('rejects unsafe control character path stored only in Git objects', (t) => {
  const f = fixture(t);
  const oid = f.git('rev-parse', 'HEAD:apps/mobile/keep.ts');
  const inputGit = (args, input) => execFileSync('git', args, { cwd: f.root, encoding: 'utf8', input }).trim();
  const mobileTree = inputGit(['mktree', '-z'], `100644 blob ${oid}\tunsafe\nname.ts\0`);
  const appsTree = inputGit(['mktree', '-z'], `040000 tree ${mobileTree}\tmobile\0`);
  const rootTree = inputGit(['mktree', '-z'], `040000 tree ${appsTree}\tapps\0`);
  const commit = inputGit(['commit-tree', rootTree, '-p', f.anchorCommit], 'unsafe path\n');
  f.git('update-ref', 'HEAD', commit);
  assert.throws(() => f.collect(), /unsafe Git path/);
});

test('collection does not rewrite index or tracked file bytes', (t) => {
  const f = fixture(t);
  const index = readFileSync(join(f.root, '.git/index'));
  const file = readFileSync(join(f.root, 'apps/mobile/[id].tsx'));
  f.collect();
  assert.deepEqual(readFileSync(join(f.root, '.git/index')), index);
  assert.deepEqual(readFileSync(join(f.root, 'apps/mobile/[id].tsx')), file);
});
