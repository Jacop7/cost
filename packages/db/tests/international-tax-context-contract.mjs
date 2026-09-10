// 0202 exact upgrade, old-response/ACL preservation, negative anchors and two sessions.
// Executes only when explicitly invoked against a fresh_* DB; never the development DB.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const target = process.argv[2];
assert.match(target ?? '', /^fresh_[a-z0-9_]{1,50}$/);
const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';
assert.match(container, /^[a-zA-Z0-9_.-]+$/);
const context = spawnSync('docker', ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], { encoding: 'utf8' });
assert.equal(context.status, 0, context.stderr);
const endpoint = process.env.DOCKER_HOST || JSON.parse(context.stdout);
assert.match(endpoint, /^(npipe|unix):/, 'Local Docker endpoint required');
const db = `fresh_ctx_0202_${process.pid}_${Date.now().toString(36)}`;
const root = fileURLToPath(new URL('../../../', import.meta.url));
const migration = readFileSync(new URL('../supabase/migrations/20260911000202_international_tax_current_context.sql', import.meta.url), 'utf8');
const body = migration.replace(/^begin;\r?\n/m, '').replace(/^commit;\s*$/m, '');
const prelude = readFileSync(new URL('./_prelude.sql', import.meta.url), 'utf8');
const helpers = readFileSync(new URL('./59_international_tax_current_context.sql', import.meta.url), 'utf8').split('-- CONTEXT-CASES:')[0];
const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
if (process.platform === 'win32') assert.ok(existsSync(bash), 'Git Bash required');
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const hash = value => createHash('sha256').update(value).digest('hex');
const args = database => ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-qAt', '-v', 'ON_ERROR_STOP=1'];
function raw(sql, database = db) {
  return spawnSync('docker', args(database), { input: "set statement_timeout='20s';\n" + sql,
    encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
}
function q(sql, database = db) {
  const r = raw(sql, database); assert.equal(r.status, 0, r.stderr || String(r.error)); return r.stdout.trim();
}
const signatures = ['public.international_tax_app_state(uuid)', 'public.recipe_tax_app_state(uuid,uuid)'];
const allSignatures = [...signatures, 'public.current_recipe_tax_quote(uuid,date)',
  'public.recipe_tax_quote_for_price(uuid,date,numeric)', 'public.app_capabilities()'];
function definitions() {
  return JSON.parse(q(`select jsonb_agg(jsonb_build_object('signature',s,'definition',pg_get_functiondef(s::regprocedure),
    'attributes',jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,
      'definer',p.prosecdef,'volatility',p.provolatile,'return_type',p.prorettype,'args',p.proargtypes::text,'argnames',p.proargnames)) order by s)
    from unnest(array[${allSignatures.map(literal).join(',')}]) s join pg_proc p on p.oid=s::regprocedure;`));
}
function dataFingerprint() {
  const tables = ['store_market_profiles', 'store_tax_profiles', 'menu_tax_overrides', 'store_tax_components',
    'channel_tax_remittance', 'international_tax_activation_boundaries', 'inventory_events', 'daily_sales_item_tax_snapshots'];
  return tables.map(table => [table, q(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) from public.${table} t;`)]);
}
function owner(x) { return `set request.jwt.claims=${literal(JSON.stringify({ sub: x.owner, role: 'authenticated' }))};`; }
function response(x) {
  return JSON.parse(q(`${owner(x)} set role authenticated; select jsonb_build_object(
    'app',public.international_tax_app_state(${literal(x.store)}::uuid),
    'recipe',public.recipe_tax_app_state(${literal(x.store)}::uuid,${literal(x.recipe)}::uuid));`));
}
function oldProjection(result) {
  const { current_market, ...app } = result.app;
  const { quote_context, ...recipe } = result.recipe;
  return { app, recipe };
}

// Validate target and absence of our new name before fresh-db.sh's drop/create.
assert.equal(q('select current_database();', target), target);
assert.equal(q(`select count(*) from pg_database where datname=${literal(db)};`, 'postgres'), '0');
let passed = false;
try {
  const built = spawnSync(bash, ['packages/db/scripts/fresh-db.sh', '--until', '20260911000201', db],
    { cwd: root, encoding: 'utf8', env: { ...process.env, SUPABASE_DB_CONTAINER: container }, timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(built.status, 0, built.stderr || built.stdout || String(built.error));
  console.log(`0202 isolated predecessor DB: ${db}`);
  const fixtures = JSON.parse(q(`${prelude}\n${helpers}
    create temporary table ctx_cases(x jsonb);
    do $setup$ declare x jsonb; s uuid; d date; m0 uuid; p0 uuid; m1 uuid; p1 uuid; kind text; begin
      foreach kind in array array['reserved','current','none'] loop
        x:=pg_temp.ctx_store(); s:=(x->>'store')::uuid; d:=(x->>'date')::date;
        if kind<>'none' then
          m0:=pg_temp.ctx_market(s,d-2,case when kind='reserved' then d else null end,'US');
          p0:=pg_temp.ctx_tax(s,m0,d-2,case when kind='reserved' then d else null end,10);
          if kind='reserved' then
            m1:=pg_temp.ctx_market(s,d+1,null,'GB'); p1:=pg_temp.ctx_tax(s,m1,d+1,null,20);
          end if;
          x:=x||jsonb_build_object('m0',m0,'p0',p0,'m1',m1,'p1',p1);
        end if;
        insert into ctx_cases values(x||jsonb_build_object('kind',kind));
      end loop;
    end $setup$;
    select jsonb_agg(x order by x->>'kind') from ctx_cases;
    commit;`));
  const before = fixtures.map(response);
  const oldDefs = definitions();
  const dataBefore = dataFingerprint();
  // Apply the actual file, with its own BEGIN/COMMIT, to the actual 0201 DB.
  q(migration);
  const newDefs = definitions();
  for (let i = 0; i < fixtures.length; i++) {
    assert.deepEqual(oldProjection(response(fixtures[i])), before[i], 'old JSON keys/quote changed');
  }
  assert.deepEqual(dataFingerprint(), dataBefore, 'migration changed table data');
  for (const old of oldDefs) {
    const now = newDefs.find(item => item.signature === old.signature);
    assert.deepEqual(now.attributes, old.attributes, `execution contract changed: ${old.signature}`);
    if (!signatures.includes(old.signature)) assert.equal(hash(now.definition), hash(old.definition), 'internal calculation changed');
  }
  console.log('PASS exact 0201→0202 file upgrade, old JSON/quote/data and execution contracts');

  const restore = oldDefs.filter(item => signatures.includes(item.signature))
    .map(item => `do $restore$ begin execute ${literal(item.definition)}; end $restore$;`).join('\n');
  const stableAfter = definitions();
  const checks = [
    ['missing-app', signatures[0], "'local_date',public.store_local_date(p_store)", "'renamed_date',public.store_local_date(p_store)", 'app date anchor'],
    ['duplicate-app', signatures[0], "'local_date',public.store_local_date(p_store),", "'local_date',public.store_local_date(p_store),\n--     'local_date',public.store_local_date(p_store),", 'app date anchor'],
    ['missing-recipe', signatures[1], 'p_recipe,public.store_local_date(p_store)', 'p_recipe,null::date', 'recipe date anchor'],
    ['duplicate-recipe', signatures[1], '  v_quote:=public.current_recipe_tax_quote(p_recipe,public.store_local_date(p_store));',
      '  v_quote:=public.current_recipe_tax_quote(p_recipe,public.store_local_date(p_store));\n--   v_quote:=public.current_recipe_tax_quote(p_recipe,public.store_local_date(p_store));', 'recipe date anchor'],
  ];
  for (const [name, signature, from, to, expected] of checks) {
    const changed = oldDefs.find(item => item.signature === signature).definition.replace(from, to);
    const result = raw(`begin; ${restore} do $inject$ begin execute ${literal(changed)}; end $inject$; ${body} rollback;`);
    assert.notEqual(result.status, 0, name); assert.ok(result.stderr.includes(expected), result.stderr);
    assert.deepEqual(definitions(), stableAfter, `${name}: aborted replacement leaked`);
    console.log(`PASS ${name} specific guard and rollback`);
  }
  const loop = '  foreach v_new in array v_defs loop execute v_new; end loop;';
  assert.equal(body.split(loop).length, 2);
  const fault = body.replace(loop, "  v_defs[2]:=replace(v_defs[2],'v_quote_context jsonb;','v_quote_context ctx_0202_missing_type;');\n" + loop);
  const failedSecond = raw(`begin; ${restore} ${fault} rollback;`);
  assert.notEqual(failedSecond.status, 0);
  assert.ok(failedSecond.stderr.includes('ctx_0202_missing_type'), failedSecond.stderr);
  assert.deepEqual(definitions(), stableAfter, 'first replacement persisted after second failed');
  console.log('PASS second-function execution fault rolls back both replacements');
  for (const ending of ['lf', 'crlf']) {
    const restoreEnding = oldDefs.filter(item => signatures.includes(item.signature)).map(item =>
      `do $restore$ begin execute ${literal(ending === 'crlf' ? item.definition.replace(/\r?\n/g, '\r\n') : item.definition)}; end $restore$;`).join('\n');
    q(`begin; ${restoreEnding} ${body} rollback;`);
    assert.deepEqual(definitions(), stableAfter);
    console.log(`PASS ${ending} input`);
  }
  const reapply = raw(migration);
  assert.notEqual(reapply.status, 0); assert.ok(reapply.stderr.includes('already contains current context'), reapply.stderr);
  assert.deepEqual(definitions(), stableAfter);
  console.log('PASS reapply rejected without side effects');

  // B holds an uncommitted *future* market replacement; reads must not block
  // waiting for a lock, and today's quote must keep its M0/P0 provenance.
  const x = fixtures.find(item => item.kind === 'reserved');
  const beforeRace = response(x);
  const b = spawn('docker', args(db));
  let output = '', errors = '';
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const timer = setTimeout(() => { readyReject(new Error('writer did not reach ready')); b.stdin.end('rollback;'); }, 15000);
  b.stdout.on('data', bytes => { output += bytes; if (output.includes('CTX_READY')) readyResolve(); });
  b.stderr.on('data', bytes => { errors += bytes; });
  b.on('error', error => readyReject(error));
  const done = new Promise(resolve => b.on('close', code => { if (!output.includes('CTX_READY')) readyReject(new Error(errors)); resolve(code); }));
  try {
    b.stdin.write(`begin; set local statement_timeout='10s'; ${owner(x)} set local role authenticated;
      set local request.headers='{"x-margincook-app-version":"0.2.0"}';
      select public.save_store_market_profile(${literal(x.store)}::uuid,
        '{"country_code":"AU","region_code":null,"currency_code":"AUD","business_locale_code":"en-AU","price_basis":"tax_inclusive"}'::jsonb,
        ${literal(x.m1)}::uuid,1); select 'CTX_READY';\n`);
    await ready; clearTimeout(timer);
    assert.deepEqual(response(x), beforeRace, 'uncommitted reservation leaked');
    b.stdin.end('commit;\n'); assert.equal(await done, 0, errors);
    const afterRace = response(x);
    assert.equal(afterRace.app.market_profile.currency_code, 'AUD');
    assert.deepEqual(afterRace.recipe.quote, beforeRace.recipe.quote);
    assert.deepEqual(afterRace.recipe.quote_context, beforeRace.recipe.quote_context);
    assert.deepEqual(afterRace.app.current_market, beforeRace.app.current_market);
    console.log('PASS two real sessions: reservation changed, current quote/context remained atomic');
  } finally {
    clearTimeout(timer);
    if (b.exitCode === null) { if (!b.stdin.writableEnded) b.stdin.end('rollback;\n'); await done; }
  }
  passed = true;
} finally {
  if (passed) {
    const dropped = spawnSync(bash, ['packages/db/scripts/fresh-db.sh', '--drop', db],
      { cwd: root, encoding: 'utf8', env: { ...process.env, SUPABASE_DB_CONTAINER: container }, timeout: 30000 });
    assert.equal(dropped.status, 0, dropped.stderr || 'scratch cleanup failed');
  } else console.error(`Preserved failed isolated DB for diagnosis: ${db}`);
}
