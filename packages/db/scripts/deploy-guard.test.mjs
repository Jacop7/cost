import assert from 'node:assert/strict';
import {
  confirmationPhrase,
  DeployGuardError,
  deploymentCommands,
  expectedRefEnv,
  parseDeployArgs,
  pendingMigrationFiles,
  validateDeployContext,
} from './deploy-guard.mjs';

const ref = 'abcdefghijklmnopqrst';
const sha = 'a'.repeat(40);
const good = { target: 'production', mode: 'plan', expectedRef: ref, linkedRef: ref, approvedSha: sha,
  headSha: sha, remoteMainSha: sha, branch: 'main', clean: true, protectedGate: { sha, conclusion: 'success' } };
let passed = 0;
const ok = (name, fn) => { fn(); passed += 1; console.log(`  ok   ${name}`); };
const rejects = (name, patch, pattern) => ok(name, () => assert.throws(() => validateDeployContext({ ...good, ...patch }),
  (error) => error instanceof DeployGuardError && pattern.test(error.message)));

ok('명시적 target/mode만 수용', () => assert.deepEqual(parseDeployArgs(['--target', 'production', '--mode', 'plan']), { target: 'production', mode: 'plan' }));
ok('production 환경 변수 이름', () => assert.equal(expectedRefEnv('production'), 'MARGINCOOK_PRODUCTION_PROJECT_REF'));
ok('staging 환경 변수 이름', () => assert.equal(expectedRefEnv('staging'), 'MARGINCOOK_STAGING_PROJECT_REF'));
rejects('기대 project ref 누락 거부', { expectedRef: '' }, /PRODUCTION_PROJECT_REF/);
rejects('링크 project ref 누락 거부', { linkedRef: '' }, /링크/);
rejects('다른 project ref 거부', { linkedRef: 'bbbbbbbbbbbbbbbbbbbb' }, /다릅니다/);
rejects('승인 SHA 누락 거부', { approvedSha: '' }, /APPROVED_DEPLOY_SHA/);
rejects('feature 브랜치 거부', { branch: 'codex/probe' }, /main 브랜치/);
rejects('dirty worktree 거부', { clean: false }, /깨끗/);
rejects('origin main과 다른 HEAD 거부', { remoteMainSha: 'b'.repeat(40) }, /같지 않습니다/);
rejects('승인 SHA와 다른 HEAD 거부', { approvedSha: 'c'.repeat(40) }, /같지 않습니다/);
rejects('다른 SHA의 protected gate 거부', { protectedGate: { sha: 'd'.repeat(40), conclusion: 'success' } }, /protected-gate/);
rejects('실패 protected gate 거부', { protectedGate: { sha, conclusion: 'failure' } }, /protected-gate/);
ok('정확한 main·SHA·gate 수용', () => assert.equal(validateDeployContext(good).sha, sha));
ok('확인 문구가 대상·ref·SHA를 모두 묶는다', () => assert.equal(confirmationPhrase({ target: 'production', projectRef: ref, sha }), `APPLY:production:${ref}:${sha}`));
ok('plan은 ref가 고정된 list와 dry-run뿐', () => assert.deepEqual(deploymentCommands('plan', ref), [
  ['migration', 'list', '--project-ref', ref],
  ['db', 'push', '--project-ref', ref, '--dry-run'],
]));
ok('apply는 같은 ref의 계획 뒤 적용·재대조', () => {
  const commands = deploymentCommands('apply', ref);
  assert.equal(commands.length, 5);
  assert(commands.every((command) => command.includes(ref)));
});
ok('dry-run에서 저장소 migration 파일만 추린다', () => assert.deepEqual(pendingMigrationFiles('Apply 20260801000001 and 20260801000003', [
  '20260801000001_one.sql', '20260801000002_two.sql', '20260801000003_three.sql',
]), ['20260801000001_one.sql', '20260801000003_three.sql']));
ok('실제 CLI 파일명처럼 버전 뒤에 밑줄이 와도 추린다', () => assert.deepEqual(pendingMigrationFiles(
  'Would push these migrations:\n • 20260801000001_one.sql\n • 20260801000003_three.sql', [
    '20260801000001_one.sql', '20260801000002_two.sql', '20260801000003_three.sql',
  ],
), ['20260801000001_one.sql', '20260801000003_three.sql']));
ok('CLI JSON의 migration 파일명에서도 추린다', () => assert.deepEqual(pendingMigrationFiles(
  '{"upToDate":false,"dryRun":true,"migrations":["20260801000002_two.sql"]}', [
    '20260801000001_one.sql', '20260801000002_two.sql',
  ],
), ['20260801000002_two.sql']));
ok('긴 숫자 일부를 migration 버전으로 오인하지 않는다', () => assert.deepEqual(pendingMigrationFiles(
  'unrelated 1202608010000019', ['20260801000001_one.sql'],
), []));

console.log(`deploy guard ${passed}/${passed} 통과`);
