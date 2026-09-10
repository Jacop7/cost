/** F2 standalone acceptance under development. Real PostgreSQL only, no stubs.
 * RED_OBSERVED: an executed operation violated an assertion.
 * CONTRACT_UNAVAILABLE: a future prerequisite is absent; this is a failure,
 * never a skip, expected failure, or green implementation result.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = process.argv[2];
if (db !== 'fresh_recipe_f1_20260910_02') throw new Error('Only assigned synthetic fresh_recipe_f1_20260910_02 is allowed');
const store = '00000000-0000-0000-0000-0000000000b1';
const actor = '00000000-0000-0000-0000-0000000000a1';
const args = ['exec', '-i', process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook', 'psql', '-U', 'postgres', '-d', db,
  '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
const lit = x => `'${String(x).replaceAll("'", "''")}'`;
const claims = who => lit(JSON.stringify({ sub: who, role: 'authenticated' }));
const begin = (who = actor) => `begin; set local role authenticated; set local request.jwt.claims=${claims(who)}; set local lock_timeout='8s'; set local statement_timeout='12s';`;
const stateOf = stderr => stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1] ?? null;
function run(sql, { who = actor, admin = false, rollback = false } = {}) {
  const r = spawnSync('docker', args, { input: `${admin ? 'begin;' : begin(who)} ${sql}; ${rollback ? 'rollback' : 'commit'};`, encoding: 'utf8', timeout: 15000 });
  return r.status === 0 ? { ok: true, data: JSON.parse(r.stdout.trim()) } : { ok: false, code: stateOf(r.stderr), error: r.stderr || String(r.error) };
}
function q(sql, options) { const r = run(sql, options); if (!r.ok) throw Object.assign(new Error(r.error), { code: r.code }); return r.data; }
const call = (payload, targetStore = store) => `select to_jsonb(save_recipe(${lit(targetStore)}::uuid,${lit(JSON.stringify(payload))}::jsonb))`;
const read = id => q(`select recipe_detail(${lit(id)}::uuid)`);
const runId = randomUUID(); const fixtures = []; const observations = [];
const createInput = label => ({ contract_version: 2, patch: 'create', request_id: randomUUID(), name: `F2 acceptance ${runId} ${label}`,
  price: 12000, base_servings: 10, target_profit_rate: 30, lines: [], extras: [] });
function create(label) { const payload = createInput(label); const id = q(call(payload)); fixtures.push(id); return { payload, id, detail: read(id) }; }
function full(r, changes = {}) {
  return { contract_version: 2, patch: 'full', request_id: randomUUID(), id: r.id,
    // Initial revision1 is the proposed create invariant, not a mocked server value.
    // The two-session probe records whether the response actually supplied it.
    expected_revision: r.edit_revision ?? '1', name: r.name, price: r.price,
    base_servings: r.base_servings, target_profit_rate: r.target_profit_rate, ...changes };
}
class ContractUnavailable extends Error {}
function requireRevision(r) { if (typeof r.edit_revision !== 'string' || !/^[1-9]\d*$/.test(r.edit_revision)) throw new ContractUnavailable('recipe_detail.edit_revision string is absent; dependent v2 assertion not executed'); }
function snapshot() { return q(`select jsonb_build_object('inventory',(select md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'')) from inventory_events e where store_id=${lit(store)}::uuid),
  'days',(select md5(coalesce(jsonb_agg(jsonb_build_array(id,snapshot) order by id)::text,'')) from business_days where store_id=${lit(store)}::uuid))`); }
async function test(name, body) {
  const o = { name };
  try { await body(o); o.result = 'PASS_ASSERTION'; }
  catch (e) { o.result = e instanceof ContractUnavailable ? 'CONTRACT_UNAVAILABLE' : e instanceof assert.AssertionError ? 'RED_OBSERVED' : 'HARNESS_ERROR'; o.error = e.message; }
  observations.push(o); console.log(`${o.result} ${name}\n${JSON.stringify(o)}`);
}
class Session {
  constructor() {
    this.child = spawn('docker', args); this.buffer = ''; this.rows = []; this.errors = ''; this.pending = null; this.closed = false;
    this.child.stderr.on('data', d => { this.errors += d; });
    this.child.stdout.on('data', d => {
      this.buffer += d; let pos;
      while ((pos = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, pos).replace(/\r$/, ''); this.buffer = this.buffer.slice(pos + 1);
        if (this.pending && line === this.pending.marker) {
          const p = this.pending; this.pending = null; clearTimeout(p.timer); const rows = this.rows; this.rows = []; p.resolve(rows);
        } else if (line) this.rows.push(line);
      }
    });
    this.child.on('error', e => this.fail(e));
    this.child.on('close', code => { this.closed = true; this.fail(Object.assign(new Error(`session exit ${code}: ${this.errors}`), { code: stateOf(this.errors) })); });
  }
  fail(e) { if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(e); this.pending = null; } }
  command(sql) {
    if (this.pending || this.closed) throw new Error('Session unavailable');
    return new Promise((resolve, reject) => {
      const marker = `END_${randomUUID()}`;
      const timer = setTimeout(() => { this.fail(new Error('session timeout')); this.child.kill(); }, 15000);
      this.pending = { marker, resolve, reject, timer }; this.child.stdin.write(`${sql};\n\\echo ${marker}\n`);
    });
  }
  async json(sql) { return JSON.parse((await this.command(sql)).at(-1)); }
  async close() { if (this.closed) return; if (!this.pending) await this.command('rollback').catch(() => {}); this.child.stdin.end('\\q\n'); }
}
const before = snapshot();

await test('exact create retry returns the original UUID', o => {
  const f = create('create-retry'); o.firstId = f.id; o.revisionFieldPresent = typeof f.detail.edit_revision === 'string';
  const replay = run(call(f.payload)); o.replay = { ok: replay.ok, code: replay.code, id: replay.data };
  assert.equal(replay.ok, true, 'same submitted create failed on replay instead of returning its original UUID');
  assert.equal(replay.data, f.id);
});
await test('same request key with different create contents is rejected', o => {
  const f = create('key-mismatch'); const changed = run(call({ ...f.payload, name: `${f.payload.name} changed` }));
  if (changed.ok) fixtures.push(changed.data);
  o.firstId = f.id; o.secondId = changed.data; o.code = changed.code;
  assert.equal(changed.ok, false, 'one request key created two different recipes'); assert.equal(changed.code, '22000');
});
await test('authenticated direct recipe aggregate and master DML is denied', o => {
  const f = create('acl');
  const category = q(`select to_jsonb(save_category(${lit(store)}::uuid,${lit(JSON.stringify({ name: `F2 acl ${runId}`, kind: 'recipe' }))}::jsonb))`);
  const material = q(`select to_jsonb(save_material(${lit(store)}::uuid,${lit(JSON.stringify({ name: `F2 acl ${runId}`, unit_cost: 10, unit_label: '개' }))}::jsonb))`);
  const ingredient = q(`select to_jsonb(id) from ingredients where store_id=${lit(store)}::uuid order by id limit 1`);
  q(call(full(f.detail, { lines: [{ ingredient_id: ingredient, input_qty: 1 }], extras: [{ material_id: material, qty: 1 }] })));
  const cases = [
    ['recipes', `update recipes set price=1 where id=${lit(f.id)}::uuid`],
    ['recipe_lines', `update recipe_lines set input_qty=2 where recipe_id=${lit(f.id)}::uuid`],
    ['recipe_extra_costs', `update recipe_extra_costs set qty=2 where recipe_id=${lit(f.id)}::uuid`],
    ['materials', `update materials set unit_cost=1 where id=${lit(material)}::uuid`],
    ['categories', `update categories set name='direct bypass' where id=${lit(category)}::uuid`],
  ];
  o.results = cases.map(([table, sql]) => { const r = run(`with changed as (${sql} returning 1) select jsonb_build_object('role',current_user,'changed',(select count(*) from changed))`, { rollback: true });
    return { table, ok: r.ok, code: r.code, observed: r.data }; });
  assert.ok(o.results.every(r => !r.ok && r.code === '42501'), 'authenticated direct UPDATE succeeded; each successful probe is rolled back');
});
await test('two real sessions cannot both commit conflicting full edits from one basis', async o => {
  const f = create('concurrency'); const a = new Session(); const b = new Session(); let writing;
  try {
    await Promise.all([a.command(begin()), b.command(begin())]);
    const [ap, bp] = await Promise.all([a.json('select to_jsonb(pg_backend_pid())'), b.json('select to_jsonb(pg_backend_pid())')]);
    const [ra, rb] = await Promise.all([a.json(`select recipe_detail(${lit(f.id)}::uuid)`), b.json(`select recipe_detail(${lit(f.id)}::uuid)`)]);
    o.backendPids = [ap, bp]; o.revisionFieldPresent = typeof ra.edit_revision === 'string'; o.sameBasis = ra.price === rb.price && ra.name === rb.name;
    assert.notEqual(ap, bp); assert.equal(o.sameBasis, true);
    await a.json(call(full(ra, { price: 13000 })));
    writing = b.json(call(full(rb, { name: `${rb.name} B` }))).then(id => ({ ok: true, id }), e => ({ ok: false, code: e.code }));
    o.blockedOnA = false; const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      o.blockedOnA = q(`select to_jsonb(${ap}=any(pg_blocking_pids(${bp})))`, { admin: true });
      if (o.blockedOnA) break;
      await new Promise(r => setTimeout(r, 20));
    }
    assert.equal(o.blockedOnA, true, 'exact B->A blocking edge must be observed');
    await a.command('commit'); o.firstCommitted = true; o.second = await writing;
    if (o.second.ok) await b.command('commit');
    o.finalPrice = read(f.id).price;
    assert.equal(o.second.ok, false, 'both real sessions committed, despite the same submitted initial revision');
    assert.equal(o.second.code, '40001'); assert.equal(o.finalPrice, 13000);
  } finally { await a.close(); if (writing) await writing; await b.close(); }
});
await test('foreign actor and foreign store cannot reuse an owner request', o => {
  const f = create('scope');
  const foreignActor = run(call(f.payload), { who: randomUUID() });
  const foreignStore = run(call(f.payload, randomUUID()));
  o.actorCode = foreignActor.code; o.storeCode = foreignStore.code;
  o.coverage = 'existing access control only unless v2 receipt exists; does not prove receipt actor binding';
  assert.equal(foreignActor.ok, false); assert.equal(foreignStore.ok, false);
  assert.equal(foreignActor.code, '42501'); assert.equal(foreignStore.code, '42501');
});
await test('future replay after deletion must not recreate its target', o => {
  const f = create('deleted-replay'); requireRevision(f.detail);
  q(`with gone as (delete from recipes where id=${lit(f.id)}::uuid returning id) select to_jsonb(count(*)) from gone`, { admin: true });
  const replay = run(call(f.payload)); o.code = replay.code;
  assert.equal(replay.ok, false); assert.equal(replay.code, 'P0002');
});
await test('future semantic no-op does not erase strict request fingerprint differences', o => {
  const f = create('noop-fingerprint'); requireRevision(f.detail);
  const request = full(f.detail); q(call(request));
  const after = read(f.id); o.revisionBefore = f.detail.edit_revision; o.revisionAfter = after.edit_revision;
  assert.equal(after.edit_revision, f.detail.edit_revision);
  const changedPresence = run(call({ ...request, memo: null })); o.mismatchCode = changedPresence.code;
  assert.equal(changedPresence.ok, false); assert.equal(changedPresence.code, '22000');
});
const after = snapshot(); const stable = JSON.stringify(before) === JSON.stringify(after);
writeFileSync('.codex/recipe-study/f2-new-db-test-observations-20260910.json', JSON.stringify({ runId, database: db,
  fixtureRecipeIds: fixtures, baselineAndV2PrerequisiteFailuresSeparated: true, inventoryAndBusinessSnapshotsUnchanged: stable,
  before, after, observations }, null, 2) + '\n');
console.log(`Stable inventory/business snapshots: ${stable}`);
process.exitCode = stable && observations.every(o => o.result === 'PASS_ASSERTION') ? 0 : 1;
