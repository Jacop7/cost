import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { createForegroundDriver } from './team-service-driver.mjs';
import { openTaskStore } from './team-service-store.mjs';

const roots = new Set();
const makeRoot = () => {
  const root = resolve(tmpdir(), `team-service-driver-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  roots.add(root);
  return root;
};
test.afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

const identity = {
  task_id: 'TASK-P4', run_generation: 0, assignment_id: 'ASSIGN-1', leg_id: 'LEG-1',
  work_spec_revision: 1, logical_source: '02-master', logical_target: '03-sub-orchestrator', message_kind: 'ASSIGNMENT',
};

function preparedStore(name = 'driver') {
  const store = openTaskStore({ projectId: name, rootTaskId: 'TASK-P4', testRoot: makeRoot() });
  const intent = store.persistIntent({ eventId: 'EVENT-INTENT', expectedRevision: 0, identity, payload: { text: 'test' } });
  store.recordPrepared({
    eventId: 'EVENT-PREPARED', expectedRevision: 1, intentKey: intent.intent_key,
    routeId: 'ROUTE-LOCAL-1', deliveryToken: 'TOKEN-LOCAL-1',
  });
  return { store, intentKey: intent.intent_key };
}

const requestFor = (intentKey) => ({
  intentKey, expectedDagRevision: 0, rootTaskId: 'TASK-P4', runGeneration: 0, stopEpoch: 0,
});

test('AC-11 service contract', async () => {
  const unknown = preparedStore('unknown');
  let sends = 0;
  const driver = createForegroundDriver({
    store: unknown.store,
    transport: {
      kind: 'IN_PROCESS_FAKE_ONLY',
      send: async () => { sends += 1; return { status: 'UNKNOWN_DELIVERY' }; },
      reconcile: async () => ({ status: 'STILL_UNKNOWN' }),
    },
  });
  assert.deepEqual(await driver.sendPrepared(requestFor(unknown.intentKey)), { status: 'UNKNOWN_DELIVERY', retry_allowed: false });
  assert.equal(sends, 1);
  await assert.rejects(() => driver.sendPrepared(requestFor(unknown.intentKey)), /INTENT_NOT_SENDABLE/);
  assert.deepEqual(await driver.reconcileUnknown(requestFor(unknown.intentKey)), { status: 'UNKNOWN_DELIVERY', retry_allowed: false });
  assert.equal(sends, 1, 'unknown delivery must never be resent without a conclusive reconciliation');
  assert.equal(driver.metrics().actual_provider_calls, 0);
  unknown.store.close();

  const transient = preparedStore('transient');
  let attempts = 0;
  const retrying = createForegroundDriver({
    store: transient.store,
    maxTransientRetries: 1,
    transport: {
      kind: 'IN_PROCESS_FAKE_ONLY',
      send: async () => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('temporary'), { transient: true, delivery_committed: false });
        return { status: 'ACKNOWLEDGED' };
      },
    },
  });
  assert.deepEqual(await retrying.sendPrepared(requestFor(transient.intentKey)), { status: 'ACKNOWLEDGED', completed: false });
  assert.equal(attempts, 2);
  assert.equal(transient.store.getIntent(transient.intentKey).state, 'ACKNOWLEDGED');
  assert.equal(transient.store.getIntent(transient.intentKey).attempts, 2);
  transient.store.close();
});

test('reconciliation is required before retry and ACK is not completion', async () => {
  const { store, intentKey } = preparedStore('reconcile');
  let sends = 0;
  let reconciliation = 'NOT_DELIVERED';
  const driver = createForegroundDriver({
    store,
    transport: {
      kind: 'IN_PROCESS_FAKE_ONLY',
      send: async () => { sends += 1; return sends === 1 ? { status: 'UNKNOWN_DELIVERY' } : { status: 'ACKNOWLEDGED' }; },
      reconcile: async () => ({ status: reconciliation }),
    },
  });
  await driver.sendPrepared(requestFor(intentKey));
  assert.deepEqual(await driver.reconcileUnknown(requestFor(intentKey)), { status: 'RETRY_READY', retry_allowed: true });
  assert.deepEqual(await driver.sendPrepared(requestFor(intentKey)), { status: 'ACKNOWLEDGED', completed: false });
  assert.equal(store.getIntent(intentKey).terminal, false);
  assert.equal(store.getIntent(intentKey).state, 'ACKNOWLEDGED');
  assert.equal(sends, 2);
  reconciliation = 'DELIVERED';
  store.close();
});

test('a crash-window SEND_ATTEMPTED record is reconciled and never blindly resent', async () => {
  const { store, intentKey } = preparedStore('send-attempted-recovery');
  store.recordDelivery({
    eventId: 'EVENT-CRASH-WINDOW', expectedRevision: 2, intentKey,
    nextState: 'SEND_ATTEMPTED', attemptIncrement: 1,
  });
  let sends = 0;
  let reconciles = 0;
  const driver = createForegroundDriver({
    store,
    transport: {
      kind: 'IN_PROCESS_FAKE_ONLY',
      send: async () => { sends += 1; return { status: 'SENT' }; },
      reconcile: async () => { reconciles += 1; return { status: 'DELIVERED' }; },
    },
  });
  await assert.rejects(() => driver.sendPrepared(requestFor(intentKey)), /INTENT_NOT_SENDABLE/);
  assert.deepEqual(await driver.reconcileUnknown(requestFor(intentKey)), { status: 'SENT', retry_allowed: false });
  assert.equal(sends, 0);
  assert.equal(reconciles, 1);
  store.close();
});

test('STOP and stale generation close the boundary immediately before the fake effect', async () => {
  const stopped = preparedStore('stop-race');
  const driver = createForegroundDriver({
    store: stopped.store,
    transport: {
      kind: 'IN_PROCESS_FAKE_ONLY',
      beforeSend: async (_request, store) => {
        const revision = store.snapshot().revision;
        store.stopRoot({ eventId: 'EVENT-STOP-RACE', expectedRevision: revision, rootTaskId: 'TASK-P4', newStopEpoch: 1 });
      },
      send: async () => assert.fail('fake effect must not run after STOP'),
    },
  });
  await assert.rejects(() => driver.sendPrepared(requestFor(stopped.intentKey)), /STOP_EPOCH_MISMATCH|STOP_FENCE_CLOSED/);
  assert.equal(driver.metrics().fake_transport_attempts, 0);
  stopped.store.close();

  const stale = preparedStore('stale-generation');
  stale.store.stopRoot({ eventId: 'EVENT-STOP', expectedRevision: 2, rootTaskId: 'TASK-P4', newStopEpoch: 1 });
  stale.store.resumeRoot({
    eventId: 'EVENT-RESUME', expectedRevision: 3, rootTaskId: 'TASK-P4',
    expectedRunGeneration: 0, newRunGeneration: 1, newStopEpoch: 2,
  });
  const staleDriver = createForegroundDriver({
    store: stale.store,
    transport: { kind: 'IN_PROCESS_FAKE_ONLY', send: async () => assert.fail('stale generation must not send') },
  });
  await assert.rejects(() => staleDriver.sendPrepared(requestFor(stale.intentKey)), /STALE_GENERATION_AUDIT_ONLY/);
  assert.equal(stale.store.classifyResult({ runGeneration: 0 }), 'AUDIT_ONLY');
  stale.store.close();
});

test('real or unspecified transports are rejected at construction', () => {
  const { store } = preparedStore('real-transport');
  assert.throws(() => createForegroundDriver({ store, transport: { kind: 'TEAM_ROUTER', send() {} } }), /REAL_TRANSPORT_FORBIDDEN/);
  store.close();
});
