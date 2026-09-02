import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const exactUserOwned = new Set([
  'apps/mobile/src/theme/tokens.ts',
  'apps/mobile/src/lib/appAlert.ts',
  'scripts/prototype_server.py',
]);

const exactInScope = new Set([
  'docs/작업큐.md',
  'docs/ai-review/evidence/AI-CONTEXT-MISSION-CONTINUITY-V1.md',
  'docs/ai-review/evidence/AI-CONTEXT-MISSION-CONTINUITY-V2.md',
  'docs/ai-review/evidence/AI-CONTEXT-MISSION-CONTINUITY-OPUS-R1.md',
  'docs/ai-review/evidence/AI-PLANS-PREWORK-BASELINE.md',
  'docs/ai-review/evidence/AI-PLANS-PREWORK-PATCH-MAP.md',
  'docs/ai-review/evidence/AI-PLANS-PREWORK-DECISIONS.md',
  'docs/ai-review/evidence/AI-PLANS-PREWORK-VERIFICATION.md',
  'docs/ai-review/evidence/AI-PLANS-PREWORK-VERIFICATION-V2.md',
  'docs/ai-review/evidence/AI-PLANS-PREWORK-OPUS-R1.md',
  'docs/ai-review/evidence/AI-PLANS-PREWORK-USER-STATE.json',
  'scripts/ai-plan-prework-status-check.mjs',
]);

const prefixRules = [
  ['USER_OWNED', 'apps/mobile/src/components/kit/'],
  ['USER_OWNED', 'apps/mobile/src/features/'],
  ['USER_OWNED', 'docs/prototypes/'],
  ['USER_OWNED', 'docs/ai-review/tasks/PROTOTYPE-TERMINOLOGY-001/'],
  ['USER_OWNED', '.codex-share/'],
  ['USER_OWNED', '.tmp/'],
  ['AI_OWNED_UNCOMMITTED', 'docs/ai-review/evidence/AI-CONTEXT-CROSS-STUDY-'],
  ['IN_SCOPE', 'docs/ai-review/tasks/AI-PLANS-PREWORK-REVIEW-'],
];

function classify(path) {
  const categories = [];
  if (exactUserOwned.has(path) || /^\.claude\/settings(?:\.local)?\.json$/.test(path)) {
    categories.push('USER_OWNED');
  }
  if (exactInScope.has(path)) categories.push('IN_SCOPE');
  for (const [category, prefix] of prefixRules) {
    if (path.startsWith(prefix)) categories.push(category);
  }
  return [...new Set(categories)];
}

function sha256(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) return null;
  return createHash('sha256').update(readFileSync(absolute)).digest('hex');
}

function loadEntries() {
  const raw = execFileSync(
    'git',
    ['-c', 'core.quotePath=false', 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { cwd: root },
  );
  const records = raw.toString('utf8').split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const status = record.slice(0, 2);
    let path = record.slice(3).replaceAll('\\', '/');
    if (status.includes('R') || status.includes('C')) {
      const destination = records[index + 1];
      if (!destination) throw new Error(`rename/copy destination missing: ${path}`);
      path = destination.replaceAll('\\', '/');
      index += 1;
    }
    const categories = classify(path);
    entries.push({ path, status, categories, sha256: sha256(path) });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

function fail(message, details) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(1);
}

const entries = loadEntries();
const unclassified = entries.filter((entry) => entry.categories.length === 0);
const multiplyClassified = entries.filter((entry) => entry.categories.length !== 1);
if (unclassified.length > 0 || multiplyClassified.length > 0) {
  fail('STATUS_CLASSIFICATION_FAILED', { unclassified, multiplyClassified });
}

const normalized = entries.map(({ path, status, categories, sha256: hash }) => ({
  path,
  status,
  category: categories[0],
  sha256: hash,
}));
const counts = Object.fromEntries(
  ['USER_OWNED', 'AI_OWNED_UNCOMMITTED', 'IN_SCOPE'].map((category) => [
    category,
    normalized.filter((entry) => entry.category === category).length,
  ]),
);
const manifestSha256 = createHash('sha256')
  .update(JSON.stringify(normalized))
  .digest('hex');

if (process.argv.includes('--print-user-manifest')) {
  const userEntries = normalized.filter((entry) => entry.category === 'USER_OWNED');
  console.log(JSON.stringify({
    schema_version: 1,
    scope: 'AI-ORCH-PLANS-PREWORK-1 user-owned path/status/content fingerprint',
    entries_sha256: createHash('sha256').update(JSON.stringify(userEntries)).digest('hex'),
    entries: userEntries,
  }, null, 2));
  process.exit(0);
}

const compareIndex = process.argv.indexOf('--compare-user-manifest');
let userManifestMatch = null;
if (compareIndex >= 0) {
  const manifestPath = process.argv[compareIndex + 1];
  if (!manifestPath) fail('USER_MANIFEST_PATH_REQUIRED', null);
  const manifest = JSON.parse(readFileSync(resolve(root, manifestPath), 'utf8'));
  const actual = normalized.filter((entry) => entry.category === 'USER_OWNED');
  const expected = manifest.entries;
  userManifestMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (!userManifestMatch) fail('USER_STATE_MISMATCH', { expected, actual });
}

console.log(JSON.stringify({
  ok: true,
  counts,
  unclassified: 0,
  multiplyClassified: 0,
  manifestSha256,
  userManifestMatch,
}, null, 2));
