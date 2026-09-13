import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assessDeploymentEvidence,
  compareVersions,
  collectDoctor,
  inspectEnvExample,
  sanitizedDeploymentEvidence,
} from './setup-doctor.mjs';

const migrations = [
  '20260101000001_first.sql',
  '20260101000002_second.sql',
  '20260101000003_third.sql',
];

function deploymentEvidence(overrides = {}) {
  const sha = 'a'.repeat(40);
  return {
    schema_version: 1,
    target: 'staging',
    status: 'APPLIED',
    recorded_at: '2026-09-01T00:00:00Z',
    branch: 'main',
    deploy_sha: sha,
    protected_gate: { sha, conclusion: 'success' },
    migration_count: 3,
    pending_migrations: [...migrations],
    applied_migrations: [...migrations],
    evidence_hashes: {
      migration_list_before_sha256: 'b'.repeat(64),
      dry_run_before_sha256: 'c'.repeat(64),
      migration_list_after_sha256: 'd'.repeat(64),
      dry_run_after_sha256: 'e'.repeat(64),
    },
    ...overrides,
  };
}

test('Node semver 하한을 숫자로 비교한다', () => {
  assert.equal(compareVersions('20.19.4', '20.19.4'), 0);
  assert.equal(compareVersions('24.15.0', '20.19.4'), 1);
  assert.equal(compareVersions('20.18.9', '20.19.4'), -1);
  assert.equal(compareVersions('invalid', '20.19.4'), null);
});

test('환경 예시는 공개 앱 키만 허용한다', () => {
  const safe = inspectEnvExample([
    'EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key',
  ].join('\n'));
  assert.equal(safe.requiredPresent, true);
  assert.deepEqual(safe.forbiddenNames, []);

  const forbiddenName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
  const unsafe = inspectEnvExample([
    'EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder',
    `${forbiddenName}=placeholder`,
  ].join('\n'));
  assert.deepEqual(unsafe.forbiddenNames, [forbiddenName]);
});

test('배포 증거 요약은 project ref와 비밀 필드를 노출하지 않는다', () => {
  const opaqueRef = 'abcdefghij' + 'klmnopqrst';
  const projectRefField = ['project', 'ref'].join('_');
  const summary = sanitizedDeploymentEvidence({
    target: 'staging',
    status: 'APPLIED',
    recorded_at: '2026-09-01T00:00:00Z',
    migration_count: 1,
    pending_migrations: ['20260901000191_example.sql'],
    applied_migrations: ['20260901000191_example.sql'],
    [projectRefField]: opaqueRef,
    untrusted_metadata: 'private-placeholder',
  }, 'evidence.json');
  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes(opaqueRef), false);
  assert.equal(serialized.includes('private-placeholder'), false);
  assert.equal(summary.latestApplied, '20260901000191_example.sql');
  assert.equal(summary.appliedMatchesPlanned, true);
});

test('배포 증거의 schema·target·main·SHA·protected-gate·hash·전체 migration set을 검증한다', () => {
  assert.equal(assessDeploymentEvidence(deploymentEvidence(), 'evidence.json', migrations, 'staging').level, 'PASS');

  const sabotages = [
    { schema_version: 2 },
    { target: 'production' },
    { status: 'PLANNED' },
    { recorded_at: 'not-an-iso-time' },
    { branch: 'feature' },
    { deploy_sha: 'short' },
    { protected_gate: { sha: 'f'.repeat(40), conclusion: 'success' } },
    { protected_gate: { sha: 'a'.repeat(40), conclusion: 'failure' } },
    { evidence_hashes: { ...deploymentEvidence().evidence_hashes, dry_run_after_sha256: 'short' } },
    { applied_migrations: [migrations[0], '20260101000099_unknown.sql'], pending_migrations: [migrations[0], '20260101000099_unknown.sql'] },
    { applied_migrations: [migrations[1], migrations[0], migrations[2]], pending_migrations: [migrations[1], migrations[0], migrations[2]] },
    { applied_migrations: [migrations[2], migrations[1]], pending_migrations: [migrations[2], migrations[1]] },
    { applied_migrations: [migrations[0], migrations[2]], pending_migrations: [migrations[0], migrations[2]] },
  ];
  for (const sabotage of sabotages) {
    assert.equal(assessDeploymentEvidence(deploymentEvidence(sabotage), 'evidence.json', migrations, 'staging').level, 'FAIL');
  }
});

test('원격 migration lag는 기본 doctor에서 WARN이고 엄격 동기화에서만 FAIL이다', () => {
  const lag = deploymentEvidence({
    migration_count: 2,
    pending_migrations: [],
    applied_migrations: [],
  });
  const normal = assessDeploymentEvidence(lag, 'lag.json', migrations, 'staging');
  assert.equal(normal.level, 'WARN');
  assert.equal(normal.reason, 'valid-prefix-lag');
  assert.equal(normal.remoteLatest, migrations[1]);

  const strict = assessDeploymentEvidence(lag, 'lag.json', migrations, 'staging', { strictRemoteSync: true });
  assert.equal(strict.level, 'FAIL');
  assert.equal(strict.reason, 'strict-remote-sync');
});

test('no-op APPLIED의 applied 목록과 latestApplied가 비어도 prefix 기준선으로 판정한다', () => {
  const noOp = deploymentEvidence({ pending_migrations: [], applied_migrations: [] });
  const summary = sanitizedDeploymentEvidence(noOp, 'noop.json');
  assert.equal(summary.latestApplied, null);
  assert.equal(assessDeploymentEvidence(noOp, 'noop.json', migrations, 'staging').level, 'PASS');
});

test('필수 운영 파일이 빠진 checkout도 예외 대신 FAIL 보고서를 만든다', () => {
  const root = mkdtempSync(join(tmpdir(), 'costkeep-setup-doctor-'));
  try {
    mkdirSync(join(root, 'packages', 'db'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.12.0' }));
    writeFileSync(join(root, 'packages', 'db', 'package.json'), JSON.stringify({
      devDependencies: { supabase: '2.116.0' },
    }));

    const report = collectDoctor({
      root,
      run: () => ({ ok: false, value: '' }),
    });

    assert.equal(report.readiness, 'NOT_READY');
    assert.equal(report.checks.find((check) => check.id === 'repository')?.level, 'FAIL');
    assert.equal(report.checks.find((check) => check.id === 'node-linker')?.level, 'FAIL');
    assert.equal(report.checks.find((check) => check.id === 'upgrade-contract')?.level, 'FAIL');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
