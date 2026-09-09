/** 0194 -> 0195 deployment preflight. Only a fresh_* test DB is accepted.
 * Every injected function drift and migration attempt is rolled back.
 * Usage: node packages/db/tests/ingredient-migration-anchors.mjs fresh_<0194-db>
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const database = process.argv[2];
assert.match(database ?? '', /^fresh_[a-z0-9_]{1,50}$/, 'A disposable fresh_* DB at 0194 is required');
const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';
const migration = readFileSync(new URL('../supabase/migrations/20260909000195_ingredient_write_integrity.sql', import.meta.url), 'utf8').replaceAll('\r', '');
assert.equal((migration.match(/^begin;$/gm) ?? []).length, 1);
assert.equal((migration.match(/^commit;$/gm) ?? []).length, 1);
const transaction = migration.replace(/^begin;$/m, '').replace(/^commit;$/m, 'rollback;');
const quote = value => `'${value.replaceAll("'", "''")}'`;
function sql(input) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'], { input, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
function state() {
  const result = sql(`select concat_ws('|',
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='ingredients' and column_name='purchase_price'),
    to_regclass('public.stock_quantity_receipts') is not null,
    (select count(*) from inventory_events),
    (select md5(string_agg(p.oid::text || pg_get_functiondef(p.oid),'' order by p.oid))
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind='f'));
  `);
  assert.equal(result.status, 0, result.out);
  return result.out.trim();
}
const before = state();
assert.match(before, /^f\|f\|/, 'Refusing a DB that already contains 0195');
const anchors = [
  ['save_ingredient(uuid,jsonb)', 'safety_stock, min_order_qty, default_vendor_id, memo, active'],
  ['save_ingredient(uuid,jsonb)', "nullif(p_payload->>'memo',''),\n      true"],
  ['save_ingredient(uuid,jsonb)', "memo              = nullif(p_payload->>'memo',''),"],
  ['save_ingredient(uuid,jsonb)', 'into v_ch;'],
  ['ingredient_detail(uuid)', "'per_volume', i.per_volume,"],
  ['save_purchase_option(uuid,jsonb)', 'perform assert_my_store(p_store);'],
  ['quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,date,text)', 'if p_idempotency_key is not null then'],
  ['quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,date,text)', 'if v_order is not null then'],
  ['e2_discard(uuid,numeric,date)', 'volume_delta, occurred_at, unit_normalized)'],
  ['e2_discard(uuid,numeric,date)', "'discard', -v_taken, v_taken,"],
];
let passed = 0;
for (const [signature, anchor] of anchors) {
  for (const mode of ['missing', 'duplicate']) {
    const replacement = mode === 'missing' ? anchor.replace(' ', '  ') : `${anchor} /* ${anchor} */`;
    assert.notEqual(replacement, anchor);
    const setup = `do $drift$ declare d text; a text := ${quote(anchor)}; begin
      d:=replace(pg_get_functiondef(${quote(`public.${signature}`)}::regprocedure),chr(13),'');
      if (length(d)-length(replace(d,a,'')))/length(a) <> 1 then raise exception 'test fixture anchor mismatch'; end if;
      execute replace(d,a,${quote(replacement)});
    end; $drift$;`;
    // First prove drift is valid PL/pgSQL, so a syntax failure cannot be mistaken for guard success.
    const fixture = sql(`begin; ${setup} rollback;`);
    assert.equal(fixture.status, 0, fixture.out);
    const result = sql(`begin; ${setup}\n${transaction}`);
    assert.notEqual(result.status, 0, `${mode} ${signature}: migration silently accepted drift`);
    const expected = signature.startsWith('e2_') ? 'discard note' : signature.split('(')[0];
    assert.ok(result.out.includes(`${expected} anchor must occur exactly once`), result.out);
    assert.equal(state(), before, 'Failed migration or fixture changed the DB');
    console.log(`PASS ${mode}: ${signature} / ${JSON.stringify(anchor)}`);
    passed++;
  }
}
for (const newline of ['LF', 'CRLF']) {
  const setup = `do $lineend$ declare r record; d text; begin
    for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      join pg_language l on l.oid=p.prolang where n.nspname='public' and l.lanname='plpgsql' and p.prokind='f'
    loop
      d:=replace(pg_get_functiondef(r.oid),chr(13),'');
      execute ${newline === 'CRLF' ? "replace(d,chr(10),chr(13)||chr(10))" : 'd'};
    end loop;
  end; $lineend$;`;
  const checks = `do $check$ begin
    if position('동일 요청 키의 입고 내용이 다릅니다' in pg_get_functiondef('public.quick_inbound(uuid,uuid,numeric,numeric,numeric,uuid,date,text)'::regprocedure))=0
      or position('v_taken, p_note,' in pg_get_functiondef('public.discard_stock_noted(uuid,numeric,date,text)'::regprocedure))=0 then
      raise exception 'Expected protection was not installed';
    end if;
  end; $check$;`;
  const result = sql(`begin; ${setup}\n${transaction.replace('rollback;', `${checks}\nrollback;`)}`);
  assert.equal(result.status, 0, result.out);
  assert.equal(state(), before, 'Successful trial did not roll back');
  console.log(`PASS ${newline}: normal upgrade installs protections and rolls back`);
  passed++;
}
console.log(`${passed}/${passed} migration-anchor scenarios PASS; DB state unchanged`);
