/**
 * 로컬 개발·검증 준비 상태를 한 번에 점검한다.
 *
 * 이 명령은 원격 GitHub/Supabase API를 직접 조회하지 않고, 실제 env 파일과 Supabase
 * link 내용을 읽지 않는다. 저장소의 배포 JSON은 파싱하지만 project ref·secret은 요약과
 * 출력에 포함하지 않는다.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MIN_NODE = '20.19.4';
const EXPECTED_PNPM = '9.12.0';
const EXPECTED_SUPABASE = '2.116.0';
const EXPECTED_MIGRATION_COUNT = 181;
const EXPECTED_LATEST_MIGRATION = '20260904000192_get_settings_security_definer.sql';
const EXPECTED_DB_TEST_COUNT = 50;
const EXPECTED_UPGRADE_STEPS = 23;

function parseVersion(value) {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)/.exec(String(value).trim());
  return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function command(commandName, args, options = {}) {
  const useCorepackShim = process.platform === 'win32' && commandName === 'corepack';
  const executable = useCorepackShim ? (process.env.ComSpec || 'cmd.exe') : commandName;
  const executableArgs = useCorepackShim
    ? ['/d', '/s', '/c', `corepack ${args.join(' ')}`]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 7_000,
    windowsHide: true,
    ...options,
  });
  return {
    ok: result.status === 0,
    value: String(result.stdout ?? '').trim(),
    errorCode: result.error?.code ?? null,
  };
}

function result(level, id, message, details = undefined) {
  return { level, id, message, ...(details === undefined ? {} : { details }) };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** 읽을 수 없는 파일·디렉터리는 예외 대신 각 검사의 FAIL 판정으로 떨어뜨린다. */
function readTextOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function listEntries(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

function migrationFiles(root) {
  const directory = join(root, 'packages', 'db', 'supabase', 'migrations');
  return listEntries(directory)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
}

function dbTestFiles(root) {
  const directory = join(root, 'packages', 'db', 'tests');
  return listEntries(directory)
    .filter((name) => /^\d{2}_.+\.sql$/.test(name))
    .sort();
}

export function inspectEnvExample(content) {
  const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  const names = [...content.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
  const forbiddenNames = names.filter((name) => (
    /(?:SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|OPS_HEALTH_TOKEN)/.test(name)
  ));
  return {
    requiredPresent: required.every((name) => names.includes(name)),
    forbiddenNames,
  };
}

export function sanitizedDeploymentEvidence(document, fileName) {
  const applied = Array.isArray(document.applied_migrations) ? document.applied_migrations : [];
  const pending = Array.isArray(document.pending_migrations) ? document.pending_migrations : [];
  return {
    file: fileName,
    target: document.target,
    status: document.status,
    recordedAt: document.recorded_at,
    migrationCount: document.migration_count,
    appliedCount: applied.length,
    pendingCount: pending.length,
    latestApplied: applied.at(-1) ?? null,
    appliedMatchesPlanned: JSON.stringify(applied) === JSON.stringify(pending),
  };
}

export function assessDeploymentEvidence(document, fileName, migrations, target, { strictRemoteSync = false } = {}) {
  const summary = sanitizedDeploymentEvidence(document, fileName);
  const applied = Array.isArray(document.applied_migrations) ? document.applied_migrations : null;
  const pending = Array.isArray(document.pending_migrations) ? document.pending_migrations : null;
  const hashes = document.evidence_hashes;
  const remoteCount = document.migration_count;
  const remotePrefix = Number.isInteger(remoteCount) && remoteCount >= 0 && remoteCount <= migrations.length
    ? migrations.slice(0, remoteCount)
    : null;
  const hashesValid = hashes && typeof hashes === 'object'
    && ['migration_list_before_sha256', 'dry_run_before_sha256', 'migration_list_after_sha256', 'dry_run_after_sha256']
      .every((key) => /^[0-9a-f]{64}$/.test(hashes[key] ?? ''));
  const listedVersionsValid = applied && pending && JSON.stringify(applied) === JSON.stringify(pending)
    && new Set(applied).size === applied.length
    && remotePrefix
    && applied.every((migration) => remotePrefix.includes(migration))
    && (applied.length === 0
      || JSON.stringify(applied) === JSON.stringify(remotePrefix.slice(remoteCount - applied.length)));
  const internalIntegrity = document.schema_version === 1
    && document.target === target
    && document.status === 'APPLIED'
    && typeof document.recorded_at === 'string'
    && Number.isFinite(Date.parse(document.recorded_at))
    && document.branch === 'main'
    && /^[0-9a-f]{40}$/.test(document.deploy_sha ?? '')
    && document.protected_gate?.conclusion === 'success'
    && document.protected_gate?.sha === document.deploy_sha
    && hashesValid
    && listedVersionsValid;
  if (!internalIntegrity) return { level: 'FAIL', summary, remoteCount, remoteLatest: null, reason: 'internal-integrity' };
  const remoteLatest = remotePrefix.at(-1) ?? null;
  if (strictRemoteSync && remoteCount !== migrations.length) {
    return { level: 'FAIL', summary, remoteCount, remoteLatest, reason: 'strict-remote-sync' };
  }
  if (remoteCount < migrations.length) {
    return { level: 'WARN', summary, remoteCount, remoteLatest, reason: 'valid-prefix-lag' };
  }
  return { level: 'PASS', summary, remoteCount, remoteLatest, reason: 'exact-sync' };
}

function latestAppliedEvidence(root, target) {
  const directory = join(root, 'docs', 'deployments');
  const matches = [];
  for (const file of listEntries(directory).filter((name) => name.endsWith('.json'))) {
    const path = join(directory, file);
    try {
      const document = readJson(path);
      if (document.target === target && document.status === 'APPLIED') {
        matches.push(sanitizedDeploymentEvidence(document, file));
      }
    } catch {
      // 개별 비-배포 증거가 JSON이 아니면 아래 배포 기준선 판정에서 제외한다.
    }
  }
  matches.sort((a, b) => String(a.recordedAt).localeCompare(String(b.recordedAt)));
  return matches.at(-1) ?? null;
}

function fileContains(root, path, patterns) {
  const content = readTextOrNull(join(root, path));
  return content !== null && patterns.every((pattern) => pattern.test(content));
}

export function collectDoctor({ root = ROOT, run = command, strictRemoteSync = false } = {}) {
  const checks = [];
  const requiredPaths = [
    'package.json',
    'pnpm-lock.yaml',
    '.npmrc',
    'apps/mobile/.env.example',
    'packages/db/supabase/config.toml',
    'packages/db/supabase/functions/ops-health/index.mjs',
    'packages/db/scripts/deploy-guard.mjs',
    '.github/workflows/verify.yml',
  ];
  const missing = requiredPaths.filter((path) => !existsSync(join(root, path)));
  checks.push(missing.length === 0
    ? result('PASS', 'repository', '저장소 루트와 필수 운영 파일 확인')
    : result('FAIL', 'repository', `필수 파일 ${missing.length}개 누락`, missing));

  let packageJson;
  let dbPackageJson;
  try {
    packageJson = readJson(join(root, 'package.json'));
    dbPackageJson = readJson(join(root, 'packages', 'db', 'package.json'));
  } catch {
    checks.push(result('FAIL', 'package-json', 'package.json을 해석할 수 없음'));
    return finish(checks);
  }

  const nodeComparison = compareVersions(process.versions.node, MIN_NODE);
  checks.push(nodeComparison !== null && nodeComparison >= 0
    ? result('PASS', 'node', `Node ${process.versions.node} (최소 ${MIN_NODE})`)
    : result('FAIL', 'node', `Node ${MIN_NODE} 이상 필요`));
  if (![20, 24].includes(Number(process.versions.node.split('.')[0]))) {
    checks.push(result('WARN', 'node-ci-band', 'CI 검증 주 버전은 Node 20과 24'));
  }

  const pinnedPnpm = String(packageJson.packageManager ?? '').replace(/^pnpm@/, '');
  const pnpm = run('corepack', ['pnpm', '--version']);
  checks.push(pinnedPnpm === EXPECTED_PNPM && pnpm.ok && pnpm.value === EXPECTED_PNPM
    ? result('PASS', 'pnpm', `pnpm ${EXPECTED_PNPM} 고정·실행 확인`)
    : result('FAIL', 'pnpm', `packageManager와 실행 pnpm이 ${EXPECTED_PNPM}이어야 함`));

  const npmrc = readTextOrNull(join(root, '.npmrc')) ?? '';
  checks.push(/^node-linker=hoisted\s*$/m.test(npmrc)
    ? result('PASS', 'node-linker', 'node-linker=hoisted 확인')
    : result('FAIL', 'node-linker', 'node-linker=hoisted 누락'));

  const pinnedSupabase = dbPackageJson.devDependencies?.supabase;
  const supabaseCli = join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  const supabase = existsSync(supabaseCli)
    ? run(process.execPath, [supabaseCli, '--version'])
    : { ok: false, value: '' };
  checks.push(pinnedSupabase === EXPECTED_SUPABASE && supabase.ok && supabase.value === EXPECTED_SUPABASE
    ? result('PASS', 'supabase-cli', `Supabase CLI ${EXPECTED_SUPABASE} 고정·실행 확인`)
    : result('FAIL', 'supabase-cli', `의존성 설치 후 Supabase CLI ${EXPECTED_SUPABASE} 필요`));

  const env = inspectEnvExample(readTextOrNull(join(root, 'apps', 'mobile', '.env.example')) ?? '');
  checks.push(env.requiredPresent && env.forbiddenNames.length === 0
    ? result('PASS', 'env-example', '모바일 공개 환경 변수 예시 확인')
    : result('FAIL', 'env-example', '환경 변수 예시에 필수 공개 키 누락 또는 서버 비밀 이름 포함'));

  const migrations = migrationFiles(root);
  const dbTests = dbTestFiles(root);
  const latestMigration = migrations.at(-1) ?? null;
  checks.push(migrations.length === EXPECTED_MIGRATION_COUNT && latestMigration === EXPECTED_LATEST_MIGRATION
    ? result('PASS', 'migrations', `migration ${EXPECTED_MIGRATION_COUNT}개 · 최신 ${EXPECTED_LATEST_MIGRATION}`)
    : result('FAIL', 'migrations', `migration 기준선은 ${EXPECTED_MIGRATION_COUNT}개 · 최신 ${EXPECTED_LATEST_MIGRATION}이어야 함`));
  checks.push(dbTests.length === EXPECTED_DB_TEST_COUNT
    ? result('PASS', 'db-tests', `번호 DB 회귀 스위트 ${EXPECTED_DB_TEST_COUNT}개`)
    : result('FAIL', 'db-tests', `번호 DB 회귀 스위트는 ${EXPECTED_DB_TEST_COUNT}개여야 함`));

  const upgradeScript = readTextOrNull(join(root, 'packages', 'db', 'scripts', 'upgrade-check.sh')) ?? '';
  checks.push(new RegExp(`업그레이드 경로 ${EXPECTED_UPGRADE_STEPS}/${EXPECTED_UPGRADE_STEPS} 통과`).test(upgradeScript)
    ? result('PASS', 'upgrade-contract', `업그레이드 경로 ${EXPECTED_UPGRADE_STEPS}단계 계약 확인`)
    : result('FAIL', 'upgrade-contract', `업그레이드 경로는 ${EXPECTED_UPGRADE_STEPS}/${EXPECTED_UPGRADE_STEPS} 계약이어야 함`));

  for (const target of ['staging', 'production']) {
    const evidence = latestAppliedEvidence(root, target);
    if (!evidence) {
      checks.push(result('FAIL', `deployment-${target}`, `${target} APPLIED 증거가 없음`));
      continue;
    }
    const document = readJson(join(root, 'docs', 'deployments', evidence.file));
    const assessment = assessDeploymentEvidence(document, evidence.file, migrations, target, { strictRemoteSync });
    const sync = assessment.level === 'PASS'
      ? `로컬과 exact sync ${assessment.remoteCount}개`
      : assessment.reason === 'valid-prefix-lag'
        ? `로컬의 유효한 prefix ${assessment.remoteCount}/${migrations.length}개로 정상 lag`
        : assessment.reason === 'strict-remote-sync'
          ? `엄격 동기화 불일치 ${assessment.remoteCount}/${migrations.length}개`
          : '내부 무결성 또는 migration prefix 불일치';
    checks.push(result(assessment.level, `deployment-${target}`, `${target} APPLIED 증거 · ${sync}`));
  }

  const ciOk = fileContains(root, '.github/workflows/verify.yml', [
    /20\.19\.4/,
    /full-db-required/,
    /protected-gate/,
    /pnpm verify --no-db/,
    /pnpm verify(?:\s|$)/,
  ]);
  checks.push(ciOk
    ? result('PASS', 'ci-gate', 'Node 20.19.4·24, full DB, protected-gate 계약 확인')
    : result('FAIL', 'ci-gate', 'CI 보호 게이트 계약 불완전'));

  const deployGuardOk = fileContains(root, 'packages/db/scripts/deploy-guard.mjs', [
    /COSTKEEP_APPROVED_DEPLOY_SHA/,
    /protected-gate/,
    /--dry-run/,
    /COSTKEEP_DEPLOY_CONFIRM/,
  ]);
  checks.push(deployGuardOk
    ? result('PASS', 'deploy-guard', '대상·SHA·보호 게이트·dry-run·확인문 계약 확인')
    : result('FAIL', 'deploy-guard', '원격 배포 가드 계약 불완전'));

  const configOk = fileContains(root, 'packages/db/supabase/config.toml', [
    /\[functions\.ops-health\]/,
    /verify_jwt\s*=\s*false/,
  ]);
  const healthOk = fileContains(root, 'packages/db/supabase/functions/ops-health/index.mjs', [
    /OPS_HEALTH_TOKEN/,
    /ops_health_status/,
    /safeEqual/,
  ]);
  checks.push(configOk && healthOk
    ? result('PASS', 'ops-health', '전용 토큰·상수시간 비교·service RPC 헬스 계약 확인')
    : result('FAIL', 'ops-health', 'ops-health 보안 또는 함수 계약 불완전'));

  const linkMarker = join(root, 'packages', 'db', 'supabase', '.temp', 'project-ref');
  checks.push(existsSync(linkMarker) && statSync(linkMarker).isFile()
    ? result('PASS', 'supabase-link', 'Supabase 링크 메타데이터 존재 (대상 값 미출력)')
    : result('WARN', 'supabase-link', 'Supabase 링크 메타데이터 없음; 원격 계획 전 대상별 링크 필요'));

  const gitBranch = run('git', ['branch', '--show-current']);
  const gitHead = run('git', ['rev-parse', '--short=12', 'HEAD']);
  const gitStatus = run('git', ['status', '--porcelain', '--untracked-files=all']);
  if (gitBranch.ok && gitHead.ok && gitStatus.ok) {
    const dirtyCount = gitStatus.value ? gitStatus.value.split(/\r?\n/).length : 0;
    checks.push(result(dirtyCount ? 'WARN' : 'PASS', 'git', dirtyCount
      ? `Git ${gitBranch.value}@${gitHead.value} · 변경 경로 ${dirtyCount}개 (내용 미출력)`
      : `Git ${gitBranch.value}@${gitHead.value} · clean`));
  } else {
    checks.push(result('FAIL', 'git', 'Git 저장소 상태 확인 실패'));
  }

  const bash = process.platform === 'win32'
    ? ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe']
      .some((path) => existsSync(path))
    : run('bash', ['--version']).ok;
  checks.push(bash
    ? result('PASS', 'git-bash', 'DB 셸 검증용 Bash 확인')
    : result('WARN', 'git-bash', '전체 DB 검증에는 Git Bash 필요'));

  const docker = run('docker', ['info', '--format', '{{.ServerVersion}}']);
  checks.push(docker.ok
    ? result('PASS', 'docker', 'Docker 엔진 사용 가능')
    : result('WARN', 'docker', 'Docker 엔진 미사용; 우선 corepack pnpm verify --no-db 실행'));

  const gh = run('gh', ['--version']);
  checks.push(gh.ok
    ? result('PASS', 'github-cli', 'GitHub CLI 사용 가능 (선택 도구)')
    : result('WARN', 'github-cli', 'GitHub CLI 없음 (로컬 검증·배포 가드의 필수 조건 아님)'));

  return finish(checks);
}

function finish(checks) {
  const counts = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const check of checks) counts[check.level] += 1;
  const readiness = counts.FAIL > 0
    ? 'NOT_READY'
    : checks.some((check) => check.id === 'docker' && check.level === 'WARN')
      ? 'READY_LOCAL_NO_DB'
      : 'READY_LOCAL';
  return { readiness, counts, checks };
}

function printHuman(report) {
  for (const check of report.checks) {
    console.log(`[${check.level}] ${check.message}`);
  }
  console.log(`\n${report.readiness} — PASS ${report.counts.PASS} · WARN ${report.counts.WARN} · FAIL ${report.counts.FAIL}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = collectDoctor({ strictRemoteSync: process.argv.includes('--strict-remote-sync') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  process.exitCode = report.counts.FAIL === 0 ? 0 : 1;
}
