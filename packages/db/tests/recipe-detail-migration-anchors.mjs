// Transactional negative/CRLF/response-preservation tests for 0198, isolated DB only.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const db = process.argv[2];
if (!db || !/^fresh_[a-z0-9_]+$/.test(db)) throw new Error('Explicit fresh_* database required');
const migration = readFileSync(new URL('../supabase/migrations/20260910000198_recipe_detail_edit_contract.sql', import.meta.url), 'utf8')
  .replace(/^begin;\r?\n/m, '').replace(/^commit;\s*$/m, '');
const oldCat = "'memo', r.memo,";
const newCat = "'memo', r.memo, 'category_id', r.category_id,";
const oldExtra = "'id', ec.id, 'name', ec.name, 'amount', ec.amount_per_serving";
const newExtra = `${oldExtra}, 'material_id', ec.material_id, 'qty', ec.qty`;
const quote = s => `'${s.replaceAll("'", "''")}'`;
let failed = 0;
for (const kind of ['missing-category', 'duplicate-category', 'missing-extra', 'duplicate-extra', 'lf', 'crlf', 'reapply']) {
  const old = `replace(replace(replace(pg_get_functiondef('public.recipe_detail(uuid)'::regprocedure),chr(13),''),${quote(newCat)},${quote(oldCat)}),${quote(newExtra)},${quote(oldExtra)})`;
  let transform = kind === 'reapply' ? "pg_get_functiondef('public.recipe_detail(uuid)'::regprocedure)" : 'd';
  if (kind === 'missing-category') transform = `replace(d,${quote(oldCat)},${quote("'memo_renamed', r.memo,")})`;
  if (kind === 'duplicate-category') transform = `replace(d,${quote(oldCat)},${quote(oldCat + '\n-- ' + oldCat + '\n')})`;
  if (kind === 'missing-extra') transform = `replace(d,${quote(oldExtra)},${quote(oldExtra.replace("'amount'", "'total'"))})`;
  if (kind === 'duplicate-extra') transform = `replace(d,${quote(oldExtra)},${quote(oldExtra + '\n-- ' + oldExtra + '\n')})`;
  if (kind === 'crlf') transform = 'replace(d,chr(10),chr(13)||chr(10))';
  const sql = `begin;
    set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
    do $setup$ declare d text := ${old}; begin execute ${transform}; end $setup$;
    create temporary table before_detail as select id, recipe_detail(id) payload from recipes
      where store_id='00000000-0000-0000-0000-0000000000b1';
    do $fixture$ begin
      if not exists(select 1 from before_detail) or exists(select 1 from before_detail where payload is null) then
        raise exception 'missing accessible recipe fixture';
      end if;
    end $fixture$;
    ${migration}
    do $check$ declare r record; after_payload jsonb; begin
      for r in select * from before_detail loop
        after_payload := recipe_detail(r.id)-'category_id';
        after_payload := jsonb_set(after_payload,'{extras}',coalesce((select jsonb_agg(e-'material_id'-'qty')
          from jsonb_array_elements(after_payload->'extras') e),'[]'::jsonb));
        if after_payload is distinct from r.payload then raise exception 'existing JSON values changed'; end if;
      end loop;
    end $check$;
    rollback;`;
  const result = spawnSync('docker', ['exec', '-i', process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook',
    'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'], { input: sql, encoding: 'utf8', timeout: 30000 });
  const negative = kind.startsWith('missing') || kind.startsWith('duplicate') || kind === 'reapply';
  const expectedError = kind === 'reapply' ? 'already contains edit fields' : 'edit anchors must each occur exactly once';
  const ok = negative ? result.status !== 0 && result.stderr.includes(expectedError) : result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${kind}`);
  if (!ok) { failed++; console.error(result.stderr || result.error); }
}
process.exitCode = failed ? 1 : 0;
