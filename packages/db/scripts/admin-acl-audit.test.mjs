/**
 * P1-1 원격 ACL audit의 실제 DB·모바일 RPC 허용 목록 회귀시험.
 *
 * 배포 audit 자체는 현재 미승인 authenticated RPC를 실패시킨다. 이 시험은 그 위험을
 * 성공으로 바꾸지 않고, 새 DB에서 SQL이 끝까지 실행되어 정확한 metric을 한 번씩 내며
 * 이미 닫힌 사후조건 값을 유지하는지를 잰다. 프로브 rollback과 모바일 .rpc 호출 이름↔허용 목록의
 * 양방향 일치도 확인하며, 대조할 수 없는 동적 .rpc 이름은 허용하지 않는다.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanMobileRpcNames } from './admin-acl-source-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SQL_PATH = join(HERE, 'admin-acl-audit.sql');
const MOBILE_ROOTS = [
  join(ROOT, 'apps', 'mobile', 'src'),
  join(ROOT, 'apps', 'mobile', 'app'),
];
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_sikjae';
const DATABASE = process.argv[2] ?? process.env.PGDATABASE;

if (!/^[A-Za-z0-9_.-]{1,128}$/.test(CONTAINER)) {
  console.error('SUPABASE_DB_CONTAINER 형식이 아닙니다');
  process.exit(2);
}
if (!DATABASE || !/^[a-z_][a-z0-9_]{0,62}$/.test(DATABASE)) {
  console.error('사용법: node packages/db/scripts/admin-acl-audit.test.mjs <DB 식별자>');
  process.exit(2);
}

const EXPECTED_METRICS = new Map([
  ['migrations', 'expected=2'],
  ['probe_owner', 'expected=postgres'],
  ['probe_dangerous', 'expected=0'],
  ['public_dangerous', 'expected=0'],
  ['rls_disabled_app_tables', 'expected=0'],
  ['protected_objects', 'expected=6'],
  ['protected_writes', 'expected=0'],
  ['ledger_write_paths', 'expected=0'],
  ['source_schema_grants', 'expected=0'],
  ['supabase_admin_objects', 'expected=0'],
  ['anon_rpc', 'expected=0'],
  ['blocked_internal_rpc', 'expected=0'],
  ['blocked_internal_rpc_objects', 'expected=11'],
  ['rpc_executor_role', 'expected=1'],
  ['rpc_executor_facades_invalid', 'expected=0'],
  ['rpc_executor_privileged_maintenance', 'expected=0'],
  ['rls_policy_helper_calls', 'expected=0'],
  ['facade_rpc_objects', 'expected=64'],
  ['facade_rpc_missing', 'expected=0'],
  ['unapproved_authenticated_rpc', 'expected=0'],
  ['platform_default_open', 'informational'],
]);

function fail(message) {
  console.error(`admin-acl audit 회귀시험 실패: ${message}`);
  process.exit(1);
}

function psql(input) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', DATABASE, '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A'],
    { input, encoding: 'utf8' },
  );
  if (result.status !== 0) fail(`${result.stderr || result.stdout || 'psql 실행 실패'}`.trim());
  return String(result.stdout ?? '');
}

function auditSqlWithAllowlistExports(sql) {
  const finalRollback = /rollback;\s*$/i.exec(sql);
  if (!finalRollback) fail('감사 SQL의 마지막 rollback을 찾지 못했습니다');
  const beforeRollback = sql.slice(0, finalRollback.index);
  return `${beforeRollback}
select '__acl_approved_rpc|' || signature from _acl_approved_rpc order by signature;
select '__acl_non_mobile_rpc|' || signature || '|' || consumer
  from _acl_non_mobile_rpc order by signature;
rollback;
`;
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

const sql = readFileSync(SQL_PATH, 'utf8');
const raw = psql(`set search_path to pg_catalog;\n${auditSqlWithAllowlistExports(sql)}`);
const outputLines = raw.split(/\r?\n/).filter(Boolean);
const approvedSignatures = outputLines
  .filter((line) => line.startsWith('__acl_approved_rpc|'))
  .map((line) => line.slice('__acl_approved_rpc|'.length));
const nonMobileRows = outputLines
  .filter((line) => line.startsWith('__acl_non_mobile_rpc|'))
  .map((line) => line.split('|'));
const nonMobileSignatures = nonMobileRows.map(([, signature]) => signature);
const rows = outputLines
  .filter((line) => !line.startsWith('__acl_approved_rpc|') && !line.startsWith('__acl_non_mobile_rpc|'))
  .map((line) => line.split('|'));
const seen = new Map();

for (const [metric, value, expected, ...extra] of rows) {
  if (!metric || value === undefined || expected === undefined || extra.length) fail(`잘못된 metric 행: ${[metric, value, expected, ...extra].join('|')}`);
  if (seen.has(metric)) fail(`중복 metric: ${metric}`);
  seen.set(metric, { value, expected });
}
for (const [metric, expected] of EXPECTED_METRICS) {
  if (!seen.has(metric)) fail(`누락 metric: ${metric}`);
  if (seen.get(metric).expected !== expected) fail(`${metric} 기대 설명 불일치: ${seen.get(metric).expected}`);
}
for (const metric of seen.keys()) if (!EXPECTED_METRICS.has(metric)) fail(`알 수 없는 metric: ${metric}`);
if (seen.get('probe_owner').value !== 'postgres') fail(`프로브 소유자: ${seen.get('probe_owner').value}`);
if (seen.get('facade_rpc_missing').value !== '0') fail(`허용 facade가 DB에 없습니다: ${seen.get('facade_rpc_missing').value}`);

// 새 DB가 이미 만족하는 사후조건은 값까지 고정해 후속 migration의 GRANT·RLS 회귀를 즉시 잡는다.
const FRESH_DB_VALUES = new Map([
  ['probe_dangerous', '0'],
  ['public_dangerous', '0'],
  ['rls_disabled_app_tables', '0'],
  ['protected_objects', '6'],
  ['protected_writes', '0'],
  ['source_schema_grants', '0'],
  ['supabase_admin_objects', '0'],
  ['anon_rpc', '0'],
  ['blocked_internal_rpc', '0'],
  ['blocked_internal_rpc_objects', '11'],
  ['rpc_executor_role', '1'],
  ['rpc_executor_facades_invalid', '0'],
  ['rpc_executor_privileged_maintenance', '0'],
  ['rls_policy_helper_calls', '0'],
  ['facade_rpc_objects', '64'],
]);
for (const [metric, expectedValue] of FRESH_DB_VALUES) {
  const observed = seen.get(metric).value;
  if (observed !== expectedValue) fail(`${metric} 사후조건 불일치: 관측=${observed} 기대=${expectedValue}`);
}

// CLI 장부가 없으면 0만, 있으면 0166·0167 둘 모두를 의미하는 2만 허용한다.
const migrationLedger = psql("select case when to_regclass('supabase_migrations.schema_migrations') is null then 'absent' else 'present' end;").trim();
const expectedMigrations = migrationLedger === 'present' ? '2' : '0';
if (seen.get('migrations').value !== expectedMigrations) {
  fail(`migrations 값이 하네스 계약 밖입니다: 관측=${seen.get('migrations').value} 장부=${migrationLedger} 기대=${expectedMigrations}`);
}

const probe = psql("select coalesce(to_regclass('public._acl_probe_postgres')::text, 'absent');").trim();
if (probe !== 'absent') fail(`rollback 뒤 프로브가 남았습니다: ${probe}`);

if (approvedSignatures.length === 0) fail('허용 RPC 시그니처를 하나도 추출하지 못했습니다');
if (new Set(approvedSignatures).size !== approvedSignatures.length) fail('허용 RPC 시그니처가 중복됐습니다');
if (nonMobileRows.some((row) => row.length !== 3 || !row[1] || !row[2])) fail('비-mobile RPC 출력 형식이 잘못됐습니다');
const approvedNames = new Set(approvedSignatures.map((signature) => signature.slice(0, signature.indexOf('('))));
if (approvedNames.has('comment_only_rpc')) fail('SQL 주석을 허용 RPC로 잘못 읽었습니다');
const nonMobileNames = new Set(nonMobileSignatures.map((signature) => signature.slice(0, signature.indexOf('('))));
const strayNonMobile = difference(nonMobileNames, approvedNames);
if (strayNonMobile.length) fail(`비-mobile 예외가 허용 목록에 없습니다: ${strayNonMobile.join(', ')}`);
const expectedMobileNames = new Set([...approvedNames].filter((name) => !nonMobileNames.has(name)));
let sourceNames;
try {
  sourceNames = scanMobileRpcNames(MOBILE_ROOTS);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const missingFromAllowlist = difference(sourceNames, expectedMobileNames);
const unusedAllowlist = difference(expectedMobileNames, sourceNames);
if (missingFromAllowlist.length || unusedAllowlist.length) {
  fail(`모바일 RPC↔허용 목록 불일치 — 미허용=[${missingFromAllowlist.join(', ')}] 미사용=[${unusedAllowlist.join(', ')}]`);
}

// P0-5 이후에는 부채 상한이 아니라 0이 계약이다. 하나라도 다시 열리면 즉시 실패한다.
for (const metric of ['ledger_write_paths', 'unapproved_authenticated_rpc']) {
  const observed = seen.get(metric).value;
  if (observed !== '0') fail(`${metric} 최소 권한 회귀: 관측=${observed} 기대=0`);
}

console.log(`admin-acl audit 실제 DB 계약 통과 — metric ${seen.size}개 · 모바일 RPC ${sourceNames.size}개 · 비-mobile 예외 ${nonMobileNames.size}개`);
console.log(`  관측값: rls_disabled_app_tables=${seen.get('rls_disabled_app_tables').value} ledger_write_paths=${seen.get('ledger_write_paths').value} unapproved_authenticated_rpc=${seen.get('unapproved_authenticated_rpc').value}`);
