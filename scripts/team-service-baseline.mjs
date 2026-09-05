// Evidence capture only. No service implementation, dispatch, DB, or model calls.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const evidenceDirectory = 'docs/ai-review/evidence';
const pluginRoot = 'C:/Codex-AI-Operations/Codex-Team-Router/plugins/codex-team-router';
const runnerPath = 'scripts/team-service-baseline.mjs';
export const repositorySources = [runnerPath, 'scripts/team-service-baseline.test.mjs',
  'scripts/team-service-workflow.mjs', 'scripts/team-service-workflow.test.mjs',
  'scripts/team-routing-contract-audit.mjs', 'scripts/team-routing-contract-audit.test.mjs',
  'scripts/docs-graph-check.mjs', 'scripts/docs-graph-check.test.mjs'];
export const manifestSources = ['department-00-all-teams-room', 'department-01-product-mobile',
  'department-02-data-backend', 'department-03-server-operations', 'department-04-quality-review',
  'department-05-knowledge-orchestration', 'master-01-human-decisions', 'master-02-orchestration',
  'master-03-deputy-context', 'master-04-development-staging', 'master-05-production-recovery']
  .map((name) => `docs/team/chats/${name}.md`);
export const externalSources = ['scripts/team_router.py', 'tests/test_team_router.py'];
export const commands = [
  { id: 'NODE-42', executable: process.execPath, args: ['--test', '--test-reporter=tap',
    'scripts/team-service-workflow.test.mjs', 'scripts/team-routing-contract-audit.test.mjs',
    'scripts/docs-graph-check.test.mjs'] },
  { id: 'ROUTER-38', executable: 'python', args: ['-B', '-m', 'unittest', 'discover', '-s',
    `${pluginRoot}/tests`, '-p', 'test_*.py'] },
  { id: 'COVERAGE-44', executable: process.execPath, args: ['scripts/team-routing-contract-audit.mjs'] },
];
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function requireCondition(value, code) { if (!value) throw new Error(code); }
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', shell: false,
    windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  return { executable, args, exitCode: result.status, error: result.error?.code ?? null,
    stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}
function git(args, raw = false) {
  const result = spawnSync('git', args, { cwd: root, encoding: raw ? undefined : 'utf8',
    shell: false, windowsHide: true, timeout: 15000, maxBuffer: 16 * 1024 * 1024 });
  requireCondition(result.status === 0, 'GIT_READ_FAILED');
  return raw ? result.stdout : result.stdout.trim();
}
function safeRead(base, path) {
  const canonicalBase = realpathSync(base);
  const absolute = realpathSync(join(base, path));
  const part = relative(canonicalBase, absolute);
  requireCondition(part !== '..' && !part.startsWith('..\\') && !part.startsWith('../') && !isAbsolute(part), 'SOURCE_PATH_ESCAPE');
  return readFileSync(absolute);
}
export function deriveResult(id, result) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.error || result.exitCode === null) return { status: 'RUN_FAILED' };
  if (id === 'NODE-42') {
    const count = (key) => Number(output.match(new RegExp(`^# ${key} (\\d+)$`, 'm'))?.[1] ?? NaN);
    const tests = count('tests'), passed = count('pass'), failed = count('fail'), skipped = count('skipped');
    return { status: result.exitCode === 0 && tests === 42 && passed === 42 && failed === 0 && skipped === 0
      ? 'EXPECTED_BASELINE_REPRODUCED' : 'BASELINE_CHANGED_OR_FAILED', tests, passed, failed, skipped };
  }
  if (id === 'ROUTER-38') {
    const tests = Number(output.match(/Ran (\d+) tests? in /)?.[1] ?? NaN);
    return { status: result.exitCode === 0 && tests === 38 && /^OK\s*$/m.test(output)
      ? 'EXPECTED_BASELINE_REPRODUCED' : 'BASELINE_CHANGED_OR_FAILED', tests };
  }
  requireCondition(id === 'COVERAGE-44', 'UNKNOWN_CHECK');
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { return { status: 'INVALID_COVERAGE_OUTPUT' }; }
  const counts = {};
  if (Array.isArray(parsed.findings)) for (const finding of parsed.findings) counts[finding.code] = (counts[finding.code] ?? 0) + 1;
  return { status: result.exitCode === 1 && parsed.status === 'REQUIREMENTS_NOT_MET'
    && parsed.serviceReady === false && parsed.messageSent === false && parsed.findings?.length === 44
    ? 'KNOWN_REQUIREMENT_GAPS_REPRODUCED' : 'BASELINE_CHANGED_OR_FAILED',
  auditStatus: parsed.status, serviceReady: parsed.serviceReady, messageSent: parsed.messageSent,
  findingCount: parsed.findings?.length ?? null, counts };
}
function captureSources(targetCommit) {
  const manifests = readdirSync(join(root, 'docs/team/chats')).filter((name) => name.endsWith('.md')).sort();
  requireCondition(same(manifests.map((name) => `docs/team/chats/${name}`), manifestSources), 'MANIFEST_SET_CHANGED');
  requireCondition(same(readdirSync(join(pluginRoot, 'tests')).filter((name) => /^test_.*\.py$/.test(name)).sort(), ['test_team_router.py']), 'EXTERNAL_TEST_SET_CHANGED');
  return [
    ...[...repositorySources, ...manifests.map((name) => `docs/team/chats/${name}`)].map((path) => {
      const bytes = safeRead(root, path);
      const commitBytes = git(['show', `${targetCommit}:${path}`], true);
      requireCondition(bytes.equals(commitBytes), `UNCOMMITTED_SOURCE:${path}`);
      return { scope: 'repository', path, sha256: sha256(bytes), text: bytes.toString('utf8') };
    }),
    ...externalSources.map((path) => {
      const bytes = safeRead(pluginRoot, path);
      return { scope: 'external-plugin', path, sha256: sha256(bytes), text: bytes.toString('utf8') };
    }),
  ];
}
export function validateReport(report) {
  requireCondition(report.schemaVersion === 1 && /^[0-9a-f]{40}$/.test(report.targetCommit), 'REPORT_SCHEMA');
  requireCondition(report.serviceReady === false && report.implementationAuthorized === false, 'UNSUPPORTED_READINESS_CLAIM');
  requireCondition(report.historicalFullVerify?.status === 'HISTORICAL_UNPINNED_NOT_REPRODUCED', 'HISTORICAL_CLAIM_PROMOTED');
  requireCondition(Array.isArray(report.sources) && report.sources.length === repositorySources.length + 11 + 2, 'SOURCE_SET');
  requireCondition(new Set(report.sources.map((source) => `${source.scope}:${source.path}`)).size === report.sources.length, 'DUPLICATE_SOURCE');
  const fixedSources = new Set([...repositorySources, ...manifestSources].map((path) => `repository:${path}`).concat(
    externalSources.map((path) => `external-plugin:${path}`)));
  const actualSources = new Set(report.sources.map((source) => `${source.scope}:${source.path}`));
  requireCondition([...fixedSources].every((key) => actualSources.has(key)), 'SOURCE_SET');
  for (const source of report.sources) {
    requireCondition(typeof source.text === 'string' && sha256(source.text) === source.sha256, 'SOURCE_HASH_MISMATCH');
    requireCondition(source.scope === 'repository' || source.scope === 'external-plugin', 'SOURCE_SCOPE');
    requireCondition(!source.path.includes('..') && !isAbsolute(source.path), 'SOURCE_PATH_ESCAPE');
  }
  requireCondition(report.results.length === commands.length, 'CHECK_SET');
  for (const [index, result] of report.results.entries()) {
    const command = commands[index];
    requireCondition(result.id === command.id && same(result.args, command.args), 'COMMAND_MISMATCH');
    requireCondition(result.executable === command.executable, 'EXECUTABLE_MISMATCH');
    requireCondition(result.stdoutSha256 === sha256(result.stdout) && result.stderrSha256 === sha256(result.stderr), 'OUTPUT_HASH_MISMATCH');
    requireCondition(same(result.derived, deriveResult(result.id, result)), 'DERIVED_RESULT_MISMATCH');
  }
  return true;
}
function capture() {
  const targetCommit = git(['rev-parse', 'HEAD']);
  const sources = captureSources(targetCommit);
  const results = commands.map((command) => {
    const result = { id: command.id, ...run(command.executable, command.args) };
    return { ...result, stdoutSha256: sha256(result.stdout), stderrSha256: sha256(result.stderr), derived: deriveResult(command.id, result) };
  });
  requireCondition(git(['rev-parse', 'HEAD']) === targetCommit, 'HEAD_CHANGED_DURING_CAPTURE');
  requireCondition(same(sources, captureSources(targetCommit)), 'SOURCE_CHANGED_DURING_CAPTURE');
  const report = { schemaVersion: 1, capturedAt: new Date().toISOString(), targetCommit,
    nodeVersion: process.version, platform: process.platform, pythonVersion: run('python', ['--version']).stdout.trim(),
    serviceReady: false, implementationAuthorized: false, sources, results,
    historicalFullVerify: { status: 'HISTORICAL_UNPINNED_NOT_REPRODUCED', reportedPassedStages: 4,
      reportedTotalStages: 6, command: ['corepack', 'pnpm', 'verify'],
      source: 'docs/ai-review/evidence/TEAM-SERVICE-CODEX-TEST-001.final.md',
      limitation: 'Historical runner/dependency hashes and mutable development DB state were not captured. No retroactive SHA or commit reproducibility claim.' } };
  validateReport(report);
  return report;
}
function reportPath(name) {
  requireCondition(/^TEAM-SERVICE-BASELINE-[A-Z0-9-]+\.json$/.test(name), 'INVALID_REPORT_NAME');
  return join(root, evidenceDirectory, name);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, name, extra] = process.argv.slice(2);
    requireCondition(!extra && ['--capture', '--verify'].includes(mode), 'USAGE: --capture|--verify TEAM-SERVICE-BASELINE-ID.json');
    const path = reportPath(name);
    if (mode === '--capture') {
      const report = capture();
      writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      console.log(JSON.stringify({ status: 'BASELINE_CAPTURED_NOT_SERVICE_PASS', targetCommit: report.targetCommit,
        report: relative(root, path), results: report.results.map(({ id, derived }) => ({ id, ...derived })) }));
    } else {
      const bytes = readFileSync(path);
      const report = JSON.parse(bytes);
      validateReport(report);
      requireCondition(bytes.equals(git(['show', `HEAD:${evidenceDirectory}/${name}`], true)), 'EVIDENCE_NOT_COMMITTED_OR_CHANGED');
      requireCondition(git(['merge-base', report.targetCommit, 'HEAD']) === report.targetCommit, 'TARGET_NOT_ANCESTOR');
      for (const source of report.sources.filter((source) => source.scope === 'repository')) {
        requireCondition(sha256(git(['show', `${report.targetCommit}:${source.path}`], true)) === source.sha256, 'COMMIT_SOURCE_MISMATCH');
      }
      console.log(JSON.stringify({ status: 'COMMITTED_EVIDENCE_INTEGRITY_VERIFIED', targetCommit: report.targetCommit,
        reportSha256: sha256(bytes), serviceReady: false, testsRerun: false }));
    }
  } catch (error) {
    console.error(JSON.stringify({ status: 'BASELINE_EVIDENCE_REJECTED', reason: error.message }));
    process.exitCode = 1;
  }
}
