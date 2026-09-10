/** 0200 real two-session acceptance. Only an explicitly leased synthetic DB.
 * Usage (after ROOT assigns a single lease): node .../purchase-option-concurrency.mjs <lease.json>
 * Lease fields: leaseId, expiresAt, containerId (full 64 hex), database (fresh_*),
 * databaseOid, systemIdentifier, socketDirectory, actorId, storeId, inputSha256.
 * inputSha256 maps each required repository-relative path below to its exact SHA256.
 * This runner commits synthetic fixtures; it must never target a user's database.
 * It does not create a lease or apply migrations. --check is Node's syntax-only flag.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const requiredInputs = [
  'packages/db/supabase/migrations/20260910000200_purchase_option_edit_revision.sql',
  'packages/db/tests/53_purchase_option_change_history.sql',
  'packages/db/tests/57_purchase_option_edit_revision.sql',
  'packages/db/tests/purchase-option-concurrency.mjs',
];
assert.ok(process.argv[2], 'An explicitly assigned lease JSON is required; no default DB');
const lease = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.match(lease.leaseId ?? '', /^[a-zA-Z0-9_-]{1,128}$/);
assert.match(lease.containerId ?? '', /^[0-9a-f]{64}$/);
assert.match(lease.database ?? '', /^fresh_[a-z0-9_]{1,50}$/);
assert.ok(Number.isInteger(lease.databaseOid) && lease.databaseOid > 0);
assert.match(lease.systemIdentifier ?? '', /^[0-9]+$/);
assert.match(lease.socketDirectory ?? '', /^\/[a-zA-Z0-9_/-]+$/);
for (const key of ['actorId', 'storeId']) assert.match(lease[key] ?? '', /^[0-9a-f-]{36}$/i);
const expiresAt = Date.parse(lease.expiresAt);
function liveLease() { assert.ok(Number.isFinite(expiresAt) && Date.now() < expiresAt, 'Lease expired or missing'); }
liveLease();
for (const path of requiredInputs) {
  const actual = createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
  assert.equal(lease.inputSha256?.[path], actual, `Unbound/changed input: ${path}`);
}
const args = ['exec', '-i', lease.containerId, 'psql', '-X', '-h', lease.socketDirectory,
  '-U', 'postgres', '-d', lease.database, '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
const lit = value => `'${String(value).replaceAll("'", "''")}'`;
const auth = `set local request.jwt.claims=${lit(JSON.stringify({ sub: lease.actorId, role: 'authenticated' }))}; set local role authenticated;`;
function q(sql, authenticated = false) {
  liveLease();
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 15000,
    input: `begin; set local statement_timeout='10s'; ${authenticated ? auth : ''} ${sql}; commit;` });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}
const identity = q(`select jsonb_build_object('database',current_database(),'oid',
  (select oid from pg_database where datname=current_database()),'system',
  (select system_identifier::text from pg_control_system()))`);
assert.deepEqual(identity, { database: lease.database, oid: String(lease.databaseOid), system: lease.systemIdentifier });
assert.equal(q(`select to_jsonb(exists(select 1 from information_schema.columns
  where table_schema='public' and table_name='purchase_options' and column_name='edit_revision'))`), true,
  '0200 must be installed and verified before this runner');

class Session {
  constructor(label) {
    liveLease();
    this.label = label; this.buffer = ''; this.rows = []; this.errors = ''; this.pending = null; this.closed = false;
    this.child = spawn('docker', args);
    this.done = new Promise(resolve => {
      this.child.on('close', code => {
        this.closed = true;
        this.fail(Object.assign(new Error(`${label}: psql exit ${code}: ${this.errors}`), {
          code: this.errors.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1],
          detail: this.errors.match(/DETAIL:\s*([^\r\n]*)/)?.[1],
        }));
        resolve();
      });
    });
    this.child.on('error', error => this.fail(error));
    this.child.stdin.on('error', error => this.fail(error));
    this.child.stderr.on('data', chunk => { this.errors += chunk; });
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk;
      let newline;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline).replace(/\r$/, '');
        this.buffer = this.buffer.slice(newline + 1);
        if (this.pending && line === this.pending.marker) {
          const pending = this.pending; this.pending = null; clearTimeout(pending.timer);
          const rows = this.rows; this.rows = []; pending.resolve(rows);
        } else if (line) this.rows.push(line);
      }
    });
  }
  fail(error) {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
  }
  command(sql) {
    liveLease();
    assert.ok(!this.pending && !this.closed, `${this.label}: session unavailable`);
    return new Promise((resolve, reject) => {
      const marker = `END_${randomUUID()}`;
      const timer = setTimeout(() => { this.fail(new Error(`${this.label}: timeout`)); this.child.kill(); }, 15000);
      this.pending = { marker, resolve, reject, timer };
      this.child.stdin.write(`${sql};\n\\echo ${marker}\n`);
    });
  }
  async json(sql) { return JSON.parse((await this.command(sql)).at(-1)); }
  async close() {
    // Cleanup is permitted even when the lease expired. Closing psql rolls back.
    if (this.closed) return;
    this.child.stdin.end('rollback;\n\\q\n');
    const timer = setTimeout(() => this.child.kill(), 15000);
    try { await this.done; } finally { clearTimeout(timer); }
  }
}
const call = payload => `select to_jsonb(save_purchase_option(${lit(lease.storeId)},${lit(JSON.stringify(payload))}::jsonb))`;
const runId = randomUUID();
function fixture(label) {
  const ingredientId = q(`select to_jsonb(save_ingredient(${lit(lease.storeId)},${lit(JSON.stringify({
    name: `U6 ${runId} ${label}`, base_unit: 'g', per_volume: 1000, safety_stock: 0, min_order_qty: 1,
  }))}::jsonb))`, true);
  const payload = { ingredient_id: ingredientId, base_unit: 'g', purchase_name: `U6 ${label}`, volume: 1000, amount: 4000 };
  const id = q(call(payload), true);
  const detail = q(`select ingredient_detail(${lit(ingredientId)})`, true);
  const option = detail.options.find(row => row.id === id);
  assert.match(option?.edit_revision ?? '', /^[1-9][0-9]*$/);
  return { ingredientId, id, payload: { ...payload, id, expected_revision: option.edit_revision } };
}
function state(f) {
  return q(`select jsonb_build_object('option',(select to_jsonb(o) from purchase_options o where id=${lit(f.id)}),
    'changes',(select count(*) from entity_change_events where entity_id=${lit(f.ingredientId)}),
    'state',(select to_jsonb(s) from inventory_states s where ingredient_id=${lit(f.ingredientId)}),
    'events',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]'::jsonb) from inventory_events e where ingredient_id=${lit(f.ingredientId)}),
    'prices',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]'::jsonb) from price_trends p where ingredient_id=${lit(f.ingredientId)}))`);
}
for (const mode of ['commit', 'rollback', 'delete']) {
  const f = fixture(mode); const before = state(f);
  const a = new Session(`u6-a-${runId}`); const b = new Session(`u6-b-${runId}`);
  let writing;
  try {
    await Promise.all([a.command(`begin; set local statement_timeout='12s'; ${auth}`),
      b.command(`begin; set local statement_timeout='12s'; ${auth}`)]);
    const [ap, bp] = await Promise.all([a.json('select to_jsonb(pg_backend_pid())'), b.json('select to_jsonb(pg_backend_pid())')]);
    assert.notEqual(ap, bp);
    // Both sessions observe the same real server revision before A writes.
    const read = `select to_jsonb(edit_revision::text) from purchase_options where id=${lit(f.id)}`;
    const [ar, br] = await Promise.all([a.json(read), b.json(read)]);
    assert.equal(ar, f.payload.expected_revision); assert.equal(br, ar);
    await a.command(mode === 'delete' ? `select delete_purchase_option(${lit(f.id)})` : call({ ...f.payload, amount: 5000 }));
    writing = b.json(call({ ...f.payload, purchase_name: 'B explicit edit' }))
      .then(id => ({ ok: true, id }), error => ({ ok: false, code: error.code, detail: error.detail, error: error.message }));
    let blocked = false;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      blocked = q(`select to_jsonb(${ap}=any(pg_blocking_pids(${bp})))`);
      if (blocked) break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.ok(blocked, 'Exact B -> A lock wait must be observed');
    await a.command(mode === 'rollback' ? 'rollback' : 'commit');
    const result = await writing;
    if (mode === 'rollback') {
      assert.equal(result.ok, true, result.error); assert.equal(result.id, f.id);
      await b.command('commit');
    } else {
      assert.equal(result.ok, false, 'Stale B unexpectedly accepted; its open transaction will roll back');
      assert.equal(result.code, mode === 'delete' ? 'P0002' : '45009', result.error);
      assert.equal(result.detail, mode === 'delete' ? 'OPTION_NOT_FOUND' : 'REVISION_CONFLICT', result.error);
    }
    const after = state(f);
    assert.deepEqual({ ...after, option: null, changes: null }, { ...before, option: null, changes: null }, 'Inventory/price changed');
    assert.equal(after.changes, before.changes + 1, 'Only the committed winner records a change');
    if (mode === 'delete') assert.equal(after.option, null);
    else {
      assert.equal(after.option.amount, mode === 'rollback' ? 4000 : 5000);
      assert.equal(after.option.purchase_name, mode === 'rollback' ? 'B explicit edit' : before.option.purchase_name);
      assert.equal(after.option.edit_revision, 2);
      assert.deepEqual({ ...after.option, amount: null, purchase_name: null, edit_revision: null },
        { ...before.option, amount: null, purchase_name: null, edit_revision: null }, 'Unrelated option fields changed');
    }
    console.log(JSON.stringify({ result: 'PASS', mode, backendPids: [ap, bp], blockedOnA: blocked,
      second: { ok: result.ok, code: result.code, detail: result.detail }, fixture: f.id }));
  } finally {
    await a.close();
    if (writing) await writing;
    await b.close();
  }
}
console.log(`PASS 3 actual purchase-option races; lease ${lease.leaseId}; synthetic fixtures retained in ${lease.database}`);
