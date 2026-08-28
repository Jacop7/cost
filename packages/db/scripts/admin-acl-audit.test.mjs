/**
 * P1-1 원격 ACL audit의 실제 DB·모바일 RPC 허용 목록 회귀시험.
 *
 * 배포 audit 자체는 현재 미승인 authenticated RPC를 실패시킨다. 이 시험은 그 위험을
 * 성공으로 바꾸지 않고, 새 DB에서 SQL이 끝까지 실행되어 정확한 metric을 한 번씩 내며
 * 프로브를 rollback하는지와 모바일 .rpc 호출 이름이 허용 목록과 양방향 일치하는지를 잰다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SQL_PATH = join(HERE, 'admin-acl-audit.sql');
const MOBILE_SRC = join(ROOT, 'apps', 'mobile', 'src');
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_sikjae';
const DATABASE = process.argv[2] ?? process.env.PGDATABASE;

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

function sqlInsertBody(sql, tableName) {
  const marker = `insert into ${tableName}`;
  const start = sql.indexOf(marker);
  if (start < 0) fail(`${tableName} insert를 찾지 못했습니다`);
  const end = sql.indexOf(';', start);
  if (end < 0) fail(`${tableName} insert 종료를 찾지 못했습니다`);
  return sql.slice(start, end);
}

function signaturesFromInsert(sql, tableName) {
  return [...sqlInsertBody(sql, tableName).matchAll(/\('([^']+)'(?:\s*,\s*'[^']+')?\)/g)].map((m) => m[1]);
}

function filesBelow(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesBelow(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function mobileRpcNames() {
  const names = new Set();
  for (const path of filesBelow(MOBILE_SRC)) {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text === 'rpc'
          && node.arguments.length > 0
          && ts.isStringLiteralLike(node.arguments[0])) {
        names.add(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return names;
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

const sql = readFileSync(SQL_PATH, 'utf8');
const raw = psql(`set search_path to pg_catalog;\n${sql}`);
const rows = raw.split(/\r?\n/).filter(Boolean).map((line) => line.split('|'));
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

const probe = psql("select coalesce(to_regclass('public._acl_probe_postgres')::text, 'absent');").trim();
if (probe !== 'absent') fail(`rollback 뒤 프로브가 남았습니다: ${probe}`);

const approvedSignatures = signaturesFromInsert(sql, '_acl_approved_rpc(signature)');
const nonMobileSignatures = signaturesFromInsert(sql, '_acl_non_mobile_rpc(signature, consumer)');
if (new Set(approvedSignatures).size !== approvedSignatures.length) fail('허용 RPC 시그니처가 중복됐습니다');
const approvedNames = new Set(approvedSignatures.map((signature) => signature.slice(0, signature.indexOf('('))));
const nonMobileNames = new Set(nonMobileSignatures.map((signature) => signature.slice(0, signature.indexOf('('))));
const expectedMobileNames = new Set([...approvedNames].filter((name) => !nonMobileNames.has(name)));
const sourceNames = mobileRpcNames();
const missingFromAllowlist = difference(sourceNames, expectedMobileNames);
const unusedAllowlist = difference(expectedMobileNames, sourceNames);
if (missingFromAllowlist.length || unusedAllowlist.length) {
  fail(`모바일 RPC↔허용 목록 불일치 — 미허용=[${missingFromAllowlist.join(', ')}] 미사용=[${unusedAllowlist.join(', ')}]`);
}

console.log(`admin-acl audit 실제 DB 계약 통과 — metric ${seen.size}개 · 모바일 RPC ${sourceNames.size}개 · 비-mobile 예외 ${nonMobileNames.size}개`);
console.log(`  관측값: rls_disabled_app_tables=${seen.get('rls_disabled_app_tables').value} ledger_write_paths=${seen.get('ledger_write_paths').value} unapproved_authenticated_rpc=${seen.get('unapproved_authenticated_rpc').value}`);
