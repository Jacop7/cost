import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveResult, sha256, validateReport, repositorySources, manifestSources, externalSources, commands } from './team-service-baseline.mjs';

function fixture() {
  return { schemaVersion: 1, targetCommit: 'a'.repeat(40), serviceReady: false, implementationAuthorized: false,
    historicalFullVerify: { status: 'HISTORICAL_UNPINNED_NOT_REPRODUCED' },
    sources: [...repositorySources, ...manifestSources].map((path) => ({ scope: 'repository', path, text: '', sha256: sha256('') }))
      .concat(externalSources.map((path) => ({ scope: 'external-plugin', path, text: '', sha256: sha256('') }))),
    results: commands.map((command) => {
      const result = { ...command, exitCode: null, error: 'ETIMEDOUT', stdout: '', stderr: '' };
      return { ...result, stdoutSha256: sha256(''), stderrSha256: sha256(''), derived: deriveResult(result.id, result) };
    }) };
}

test('BL-07 integrity validation permits an honestly failed run, never promotes service readiness', () => {
  assert.equal(validateReport(fixture()), true);
  const report = fixture(); report.serviceReady = true;
  assert.throws(() => validateReport(report), /UNSUPPORTED_READINESS/);
});

test('BL-08 source content, exact manifest set and duplicate sources are checked', () => {
  let report = fixture(); report.sources[0].text = 'changed';
  assert.throws(() => validateReport(report), /SOURCE_HASH/);
  report = fixture(); report.sources[8].path = 'docs/team/chats/invented.md';
  assert.throws(() => validateReport(report), /SOURCE_SET/);
  report = fixture(); report.sources[1] = report.sources[0];
  assert.throws(() => validateReport(report), /DUPLICATE_SOURCE/);
});

test('BL-09 output hashes, derived verdict and commands cannot be silently changed', () => {
  let report = fixture(); report.results[0].stdout = 'PASS';
  assert.throws(() => validateReport(report), /OUTPUT_HASH/);
  report = fixture(); report.results[0].derived.status = 'PASS';
  assert.throws(() => validateReport(report), /DERIVED_RESULT/);
  report = fixture(); report.results[0].args = ['--version'];
  assert.throws(() => validateReport(report), /COMMAND_MISMATCH/);
});

test('BL-10 historical verification cannot be promoted to a reproduced result', () => {
  const report = fixture(); report.historicalFullVerify.status = 'PASS';
  assert.throws(() => validateReport(report), /HISTORICAL_CLAIM/);
});

test('BL-01 42 passing TAP tests are derived from output, not a manual PASS', () => {
  const output = { exitCode: 0, stdout: '# tests 42\n# pass 42\n# fail 0\n# skipped 0\n', stderr: '', error: null };
  assert.equal(deriveResult('NODE-42', output).status, 'EXPECTED_BASELINE_REPRODUCED');
  assert.equal(deriveResult('NODE-42', { ...output, stdout: 'PASS' }).status, 'BASELINE_CHANGED_OR_FAILED');
});
test('BL-02 a skipped case or nonzero exit is not the 42/42 baseline', () => {
  const output = { exitCode: 0, stdout: '# tests 42\n# pass 41\n# fail 0\n# skipped 1\n', stderr: '', error: null };
  assert.equal(deriveResult('NODE-42', output).status, 'BASELINE_CHANGED_OR_FAILED');
  assert.equal(deriveResult('NODE-42', { ...output, error: 'ETIMEDOUT' }).status, 'RUN_FAILED');
});
test('BL-03 Python test count requires exit zero and actual OK', () => {
  const output = { exitCode: 0, stdout: '', stderr: 'Ran 38 tests in 0.8s\n\nOK\n', error: null };
  assert.equal(deriveResult('ROUTER-38', output).status, 'EXPECTED_BASELINE_REPRODUCED');
  assert.equal(deriveResult('ROUTER-38', { ...output, exitCode: 1 }).status, 'BASELINE_CHANGED_OR_FAILED');
});
test('BL-04 expected coverage exit 1 remains requirements not met', () => {
  const data = { status: 'REQUIREMENTS_NOT_MET', serviceReady: false, messageSent: false,
    findings: Array.from({ length: 44 }, () => ({ code: 'MISSING' })) };
  const output = { exitCode: 1, stdout: JSON.stringify(data), stderr: '', error: null };
  const derived = deriveResult('COVERAGE-44', output);
  assert.equal(derived.status, 'KNOWN_REQUIREMENT_GAPS_REPRODUCED');
  assert.equal(derived.serviceReady, false);
  assert.equal(derived.findingCount, 44);
  assert.equal(deriveResult('COVERAGE-44', { ...output, exitCode: 0 }).status, 'BASELINE_CHANGED_OR_FAILED');
});
test('BL-05 invalid coverage output and null exit cannot become PASS', () => {
  assert.equal(deriveResult('COVERAGE-44', { exitCode: 1, stdout: 'PASS', stderr: '', error: null }).status, 'INVALID_COVERAGE_OUTPUT');
  assert.equal(deriveResult('COVERAGE-44', { exitCode: null, stdout: '', stderr: '', error: null }).status, 'RUN_FAILED');
});
test('BL-06 source hash includes exact bytes, including line endings', () => {
  assert.notEqual(sha256('a\n'), sha256('a\r\n'));
});
