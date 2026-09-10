/** Current-contract F2 defect reproduction, NOT a future v2 acceptance suite.
 * Opt-in only; commits synthetic recipes to the explicitly assigned fresh DB.
 * Exit 1 means a present integrity assertion failed; observations distinguish
 * those REDs from setup/transport failures. Never creates grants or migrations.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = process.argv[2];
if (db !== 'fresh_recipe_f1_20260910_02') throw new Error('Only the assigned synthetic fresh_recipe_f1_20260910_02 is authorized');
const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';
const store = '00000000-0000-0000-0000-0000000000b1';
const claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-qAt', '-v', 'ON_ERROR_STOP=1'];
const quote = v => `'${String(v).replaceAll("'", "''")}'`;
const begin = `begin; set local role authenticated; set local request.jwt.claims=${quote(claims)}; set local lock_timeout='8s'; set local statement_timeout='12s';`;
function q(sql, { observer = false } = {}) {
  const r = spawnSync('docker', args, { input: observer ? `begin read only; ${sql}; commit;` : `${begin} ${sql}; commit;`, encoding: 'utf8', timeout: 15000 });
  if (r.status !== 0) throw new Error(`SQL/transport failure: ${r.stderr || r.error}`);
  return JSON.parse(r.stdout.trim());
}
const saveSql = payload => `select to_jsonb(save_recipe(${quote(store)}::uuid,${quote(JSON.stringify(payload))}::jsonb))`;
const detailSql = id => `select recipe_detail(${quote(id)}::uuid)`;
const save = payload => q(saveSql(payload));
const detail = id => q(detailSql(id));
const header = r => ({ id: r.id, name: r.name, price: r.price, base_servings: r.base_servings, target_profit_rate: r.target_profit_rate });
const runId = randomUUID();
const fixtures = [];
function fixture(label) {
  const id = save({ name: `F2 repro ${runId} ${label}`, price: 12000, base_servings: 10, target_profit_rate: 30, memo: 'initial' });
  fixtures.push(id);
  return detail(id);
}
function stableSnapshot() {
  return q(`select jsonb_build_object('inventory',(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from inventory_events e where store_id=${quote(store)}::uuid),
    'days',(select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) from business_days where store_id=${quote(store)}::uuid))`);
}

class Session {
  constructor() {
    this.child = spawn('docker', args); this.buffer = ''; this.rows = []; this.errors = ''; this.pending = null; this.closed = false;
    this.child.stderr.on('data', d => { this.errors += d; });
    this.child.stdout.on('data', d => {
      this.buffer += d;
      let at;
      while ((at = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, at).replace(/\r$/, ''); this.buffer = this.buffer.slice(at + 1);
        if (this.pending && line === this.pending.marker) {
          const p = this.pending; this.pending = null; clearTimeout(p.timer);
          const rows = this.rows; this.rows = []; p.resolve(rows);
        } else if (line) this.rows.push(line);
      }
    });
    this.child.on('error', err => this.fail(err));
    this.child.on('close', code => { this.closed = true; this.fail(new Error(`session exited ${code}: ${this.errors}`)); });
  }
  fail(error) { if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; } }
  command(sql) {
    if (this.pending || this.closed) throw new Error('Session unavailable');
    return new Promise((resolve, reject) => {
      const marker = `F2_DONE_${randomUUID()}`;
      const timer = setTimeout(() => { this.fail(new Error('session timed out')); this.child.kill(); }, 15000);
      this.pending = { marker, resolve, reject, timer };
      this.child.stdin.write(`${sql};\n\\echo ${marker}\n`);
    });
  }
  async json(sql) { const rows = await this.command(sql); return JSON.parse(rows.at(-1)); }
  async close() {
    if (this.closed) return;
    if (!this.pending) await this.command('rollback').catch(() => {});
    this.child.stdin.end('\\q\n');
  }
}

const observations = [];
async function test(name, action) {
  const observation = { name };
  try { await action(observation); observation.result = 'PASS'; }
  catch (error) { observation.result = error instanceof assert.AssertionError ? 'RED_OBSERVED_DEFECT' : 'HARNESS_ERROR'; observation.error = error.message; }
  observations.push(observation);
  console.log(`${observation.result} ${name}\n${JSON.stringify(observation)}`);
}
const stableBefore = stableSnapshot();

await test('stale memo header must not overwrite another saved price', o => {
  const original = fixture('memo');
  save({ ...header(original), price: 13000 });
  o.recipeId = original.id; o.priceBeforeStaleSave = detail(original.id).price;
  save({ ...header(original), memo: 'memo from old screen' });
  const after = detail(original.id); o.finalPrice = after.price; o.finalMemo = after.memo;
  assert.equal(o.priceBeforeStaleSave, 13000, 'setup must save the intervening price');
  assert.equal(o.finalMemo, 'memo from old screen', 'current memo save must actually execute');
  assert.equal(o.finalPrice, 13000, 'memo save lost the intervening price');
});

await test('old editor must detect an intervening price ABA', o => {
  const original = fixture('aba'); o.recipeId = original.id; o.observedPrices = [original.price];
  save({ ...header(original), price: 13000 }); o.observedPrices.push(detail(original.id).price);
  save({ ...header(original), price: 12000 }); o.observedPrices.push(detail(original.id).price);
  assert.deepEqual(o.observedPrices, [12000, 13000, 12000], 'ABA must be observed on the current RPC');
  save({ ...header(original), memo: 'stale editor accepted after ABA' });
  o.finalMemo = detail(original.id).memo;
  o.staleWriteAccepted = o.finalMemo === 'stale editor accepted after ABA';
  assert.equal(o.staleWriteAccepted, false, 'unchanged visible price hid intervening edits; stale write succeeded');
});

await test('two sessions reading one basis must not silently lose the first edit', async o => {
  const original = fixture('two-sessions'); o.recipeId = original.id;
  const a = new Session(); const b = new Session();
  let bWrite;
  try {
    await Promise.all([a.command(begin), b.command(begin)]);
    const [aPid, bPid] = await Promise.all([a.json('select to_jsonb(pg_backend_pid())'), b.json('select to_jsonb(pg_backend_pid())')]);
    const [ra, rb] = await Promise.all([a.json(detailSql(original.id)), b.json(detailSql(original.id))]);
    o.backendPids = [aPid, bPid]; o.sameBasis = ra.price === rb.price && ra.name === rb.name;
    assert.notEqual(aPid, bPid, 'must use separate PostgreSQL connections');
    assert.equal(o.sameBasis, true, 'both clients must read before either write');
    await a.json(saveSql({ ...header(ra), price: 13000 }));
    // B is sent while A still holds its recipe row lock. Observe exact B->A edge.
    bWrite = b.json(saveSql({ ...header(rb), name: `${rb.name} renamed` })).then(value => ({ value }), error => ({ error }));
    const deadline = Date.now() + 6000; o.blockedOnA = false;
    while (Date.now() < deadline) {
      o.blockedOnA = q(`select to_jsonb(${aPid} = any(pg_blocking_pids(${bPid})))`, { observer: true });
      if (o.blockedOnA) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(o.blockedOnA, true, 'must observe actual B waiting on A, not infer concurrency from sleeps');
    await a.command('commit'); o.firstCommitted = true;
    const second = await bWrite;
    if (second.error) throw second.error;
    await b.command('commit'); o.secondCommitted = true;
    const after = detail(original.id); o.finalPrice = after.price; o.finalName = after.name;
    assert.equal(o.finalName, `${rb.name} renamed`, 'second edit must have reached the database');
    assert.equal(o.finalPrice, 13000, 'both saves committed and the second stale header lost the first price edit');
  } finally {
    await a.close(); if (bWrite) await bWrite; await b.close();
  }
});

await test('authenticated direct recipe DML must be denied outside RPC', o => {
  const original = fixture('direct-dml'); o.recipeId = original.id;
  const result = spawnSync('docker', args, {
    input: `${begin} update recipes set price=1 where id=${quote(original.id)}::uuid;
      select jsonb_build_object('role',current_user,'price',price) from recipes where id=${quote(original.id)}::uuid; rollback;`,
    encoding: 'utf8', timeout: 15000,
  });
  if (result.status !== 0) throw new Error(`Unexpected setup/SQL failure (record separately): ${result.stderr || result.error}`);
  o.observedInsideRolledBackTransaction = JSON.parse(result.stdout.trim());
  o.priceAfterRollback = detail(original.id).price;
  assert.equal(o.observedInsideRolledBackTransaction.role, 'authenticated');
  assert.equal(o.priceAfterRollback, 12000, 'direct-write observation must be rolled back');
  assert.notEqual(o.observedInsideRolledBackTransaction.price, 1, 'authenticated updated recipe.price directly, bypassing save_recipe');
});

const stableAfter = stableSnapshot();
const unchanged = JSON.stringify(stableBefore) === JSON.stringify(stableAfter);
const evidence = { mode: 'CURRENT_DEFECT_REPRO_NOT_FUTURE_ACCEPTANCE', database: db, runId, fixtureRecipeIds: fixtures,
  committedSyntheticFixturesRetained: true, futureFieldsOrRpcRequired: false, grantsOrMigrationsChanged: false,
  inventoryAndBusinessSnapshotsUnchanged: unchanged, stableBefore, stableAfter, observations };
writeFileSync('.codex/recipe-study/f2-current-repro-observations-20260910.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`Inventory/business snapshots unchanged: ${unchanged}`);
process.exitCode = unchanged && observations.every(o => o.result === 'PASS') ? 0 : 1;
