import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { canonicalHash } from './team-service-canonical.mjs';
import { acquireStoreLock, openTaskStore, resolveTeamServiceDirectory } from './team-service-store.mjs';

const roots = new Set();
const makeRoot = (name) => {
  const root = resolve(tmpdir(), `team-service-${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  roots.add(root);
  return root;
};

test.afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

const identity = (runGeneration = 0) => ({
  task_id: 'TASK-P4',
  run_generation: runGeneration,
  assignment_id: 'ASSIGN-1',
  leg_id: 'LEG-1',
  work_spec_revision: 1,
  logical_source: '02-master',
  logical_target: '03-sub-orchestrator',
  message_kind: 'ASSIGNMENT',
});

test('AC-09 service contract', () => {
  const root = makeRoot('ac09');
  const store = openTaskStore({ projectId: 'ac09', rootTaskId: 'TASK-P4', testRoot: root });
  try {
    assert.equal(store.assertDispatchFence({
      expectedRevision: 0, expectedDagRevision: 0, rootTaskId: 'TASK-P4', runGeneration: 0, stopEpoch: 0,
    }), true);
    store.claimEffect({
      eventId: 'EVENT-CLAIM-1', expectedRevision: 0, expectedDagRevision: 0,
      rootTaskId: 'TASK-P4', runGeneration: 0, stopEpoch: 0,
      taskId: 'TASK-P4', effectKey: 'EFFECT-1',
    });
    assert.throws(() => store.claimEffect({
      eventId: 'EVENT-CLAIM-2', expectedRevision: 1, expectedDagRevision: 0,
      rootTaskId: 'TASK-P4', runGeneration: 0, stopEpoch: 0,
      taskId: 'TASK-P4', effectKey: 'EFFECT-1',
    }), /DUPLICATE_EFFECT/);

    store.stopRoot({ eventId: 'EVENT-STOP-1', expectedRevision: 1, rootTaskId: 'TASK-P4', newStopEpoch: 1 });
    assert.throws(() => store.assertDispatchFence({
      expectedRevision: 2, expectedDagRevision: 0, rootTaskId: 'TASK-P4', runGeneration: 0, stopEpoch: 1,
    }), /STOP_FENCE_CLOSED/);
    assert.throws(() => store.stopRoot({
      eventId: 'EVENT-CHILD-STOP', expectedRevision: 2, rootTaskId: 'TASK-CHILD', newStopEpoch: 2,
    }), /CHILD_STOP_EPOCH_REJECTED/);

    store.resumeRoot({
      eventId: 'EVENT-RESUME-1', expectedRevision: 2, rootTaskId: 'TASK-P4',
      expectedRunGeneration: 0, newRunGeneration: 1, newStopEpoch: 2,
    });
    assert.equal(store.classifyResult({ runGeneration: 0 }), 'AUDIT_ONLY');
    assert.equal(store.classifyResult({ runGeneration: 1 }), 'CURRENT');
    assert.throws(() => store.assertDispatchFence({
      expectedRevision: 3, expectedDagRevision: 0, rootTaskId: 'TASK-P4', runGeneration: 0, stopEpoch: 2,
    }), /STALE_GENERATION_AUDIT_ONLY/);
    assert.throws(() => store.advanceDag({ eventId: 'EVENT-DAG-STALE', expectedRevision: 3, expectedDagRevision: 9 }), /DAG_REVISION_CAS_FAILED/);
    assert.equal(store.snapshot().generation_audit[0].disposition, 'AUDIT_ONLY');
  } finally {
    store.close();
  }
});

test('AC-12 service contract', () => {
  const root = makeRoot('ac12');
  const store = openTaskStore({ projectId: 'ac12', rootTaskId: 'TASK-P4', testRoot: root });
  const directory = store.directory;
  assert.throws(
    () => openTaskStore({ projectId: 'ac12', rootTaskId: 'TASK-P4', testRoot: root, isOwnerAlive: () => true }),
    /LIVE_LOCK_MAY_NOT_BE_STOLEN/,
  );
  store.persistIntent({ eventId: 'EVENT-INTENT-1', expectedRevision: 0, identity: identity(), payload: { text: 'hello' } });
  assert.throws(
    () => store.advanceDag({ eventId: 'EVENT-INTENT-1', expectedRevision: 1, expectedDagRevision: 0 }),
    /DUPLICATE_EVENT_ID/,
  );
  assert.throws(
    () => store.persistIntent({ eventId: 'EVENT-INTENT-2', expectedRevision: 1, identity: identity(), payload: { text: 'changed' } }),
    /INTENT_CONFLICT/,
  );
  assert.throws(
    () => store.persistIntent({ eventId: 'EVENT-BAD-ID', expectedRevision: 1, identity: { ...identity(), task_id: 7 }, payload: {} }),
    /INVALID_TASK_ID/,
  );
  assert.throws(
    () => store.persistIntent({ eventId: 'EVENT-NFC', expectedRevision: 1, identity: identity(), payload: { '\u00e9': 1, 'e\u0301': 2 } }),
    /CANONICAL_KEY_COLLISION/,
  );
  store.close();

  const reopened = openTaskStore({ projectId: 'ac12', rootTaskId: 'TASK-P4', testRoot: root });
  assert.equal(reopened.snapshot().revision, 1);
  assert.equal(reopened.events().length, 1);
  assert.equal(reopened.events()[0].event_hash, reopened.snapshot().last_event_hash);
  reopened.close();

  appendFileSync(join(directory, 'events.ndjson'), '{"broken":true}\n', 'utf8');
  assert.throws(
    () => openTaskStore({ projectId: 'ac12', rootTaskId: 'TASK-P4', testRoot: root }),
    /STORE_CORRUPT_QUARANTINED/,
  );
  assert.equal(existsSync(join(directory, 'state.json')), false);
  assert.equal(existsSync(join(directory, 'events.ndjson')), false);
});

test('prepared results are idempotent and delivery states cannot skip ACK', () => {
  const root = makeRoot('delivery-transitions');
  const store = openTaskStore({ projectId: 'delivery-transitions', rootTaskId: 'TASK-P4', testRoot: root });
  const intent = store.persistIntent({ eventId: 'EVENT-I-1', expectedRevision: 0, identity: identity(), payload: { text: 'x' } });
  store.recordPrepared({
    eventId: 'EVENT-P-1', expectedRevision: 1, intentKey: intent.intent_key,
    routeId: 'ROUTE-1', deliveryToken: 'TOKEN-1',
  });
  const repeated = store.recordPrepared({
    eventId: 'EVENT-P-RETRY', expectedRevision: 2, intentKey: intent.intent_key,
    routeId: 'ROUTE-1', deliveryToken: 'TOKEN-1',
  });
  assert.equal(repeated.route_id, 'ROUTE-1');
  assert.equal(store.snapshot().revision, 2);
  assert.throws(() => store.recordPrepared({
    eventId: 'EVENT-P-CONFLICT', expectedRevision: 2, intentKey: intent.intent_key,
    routeId: 'ROUTE-2', deliveryToken: 'TOKEN-2',
  }), /PREPARED_RESULT_CONFLICT/);
  assert.throws(() => store.recordDelivery({
    eventId: 'EVENT-COMPLETE-EARLY', expectedRevision: 2, intentKey: intent.intent_key,
    nextState: 'COMPLETED', attemptIncrement: 0,
  }), /INVALID_DELIVERY_TRANSITION/);
  store.recordDelivery({
    eventId: 'EVENT-SEND-1', expectedRevision: 2, intentKey: intent.intent_key,
    nextState: 'SEND_ATTEMPTED', attemptIncrement: 1,
  });
  store.recordDelivery({
    eventId: 'EVENT-ACK-1', expectedRevision: 3, intentKey: intent.intent_key,
    nextState: 'ACKNOWLEDGED', attemptIncrement: 0,
  });
  assert.equal(store.getIntent(intent.intent_key).terminal, false);
  store.recordDelivery({
    eventId: 'EVENT-COMPLETE-1', expectedRevision: 4, intentKey: intent.intent_key,
    nextState: 'COMPLETED', attemptIncrement: 0,
  });
  assert.equal(store.getIntent(intent.intent_key).terminal, true);
  store.close();
});

test('stale lock replacement requires a negative liveness proof', () => {
  const root = makeRoot('stale-lock');
  const directory = resolve(root, 'project');
  const first = acquireStoreLock(directory, { pid: 999_999, nonce: 'old', isOwnerAlive: () => false });
  first.release();
  writeFileSync(join(directory, '.writer.lock'), '{"nonce":"old","pid":999999,"schema_version":1}\n', 'utf8');
  const replacement = acquireStoreLock(directory, { pid: process.pid, nonce: 'new', isOwnerAlive: () => false });
  assert.equal(replacement.record.nonce, 'new');
  replacement.release();
});

test('store path is contained and rejects traversal, OneDrive and reparse paths', { skip: process.platform !== 'win32' }, () => {
  const root = makeRoot('paths');
  assert.equal(resolveTeamServiceDirectory({ projectId: 'safe-project', testRoot: root }), join(root, 'safe-project'));
  assert.throws(() => resolveTeamServiceDirectory({ projectId: '../escape', testRoot: root }), /INVALID_PROJECT_ID/);
  const oneDrive = resolve(tmpdir(), 'OneDrive', `team-service-${process.pid}`);
  assert.throws(() => resolveTeamServiceDirectory({ projectId: 'safe', testRoot: oneDrive }), /ONEDRIVE_STORE_FORBIDDEN/);

  const target = resolve(root, 'real');
  const linked = resolve(root, 'linked');
  mkdirSync(target);
  try {
    symlinkSync(target, linked, 'junction');
    assert.throws(() => resolveTeamServiceDirectory({ projectId: 'child', testRoot: linked }), /REPARSE_PATH_FORBIDDEN/);
  } catch (error) {
    if (!['EPERM', 'EACCES'].includes(error?.code)) throw error;
  }
});

test('event log hash is stable and excludes only its self pointer', () => {
  const root = makeRoot('hash');
  const store = openTaskStore({ projectId: 'hash', rootTaskId: 'TASK-P4', testRoot: root });
  store.persistIntent({ eventId: 'EVENT-HASH-1', expectedRevision: 0, identity: identity(), payload: { text: 'x' } });
  const [event] = store.events();
  assert.match(event.event_hash, /^[0-9a-f]{64}$/);
  assert.equal(event.next_state.last_event_hash, event.event_hash);
  assert.notEqual(canonicalHash(event.next_state), event.event_hash);
  store.close();
  const replayed = openTaskStore({ projectId: 'hash', rootTaskId: 'TASK-P4', testRoot: root });
  assert.equal(replayed.snapshot().last_event_hash, event.event_hash);
  replayed.close();
});

test('a real runtime path fails closed without combined ACL evidence', () => {
  const root = makeRoot('real-acl-required');
  assert.throws(
    () => openTaskStore({ projectId: 'real-path', rootTaskId: 'TASK-P4', localAppData: root }),
    /RUNTIME_ACL_PATH_MISMATCH/,
  );
});

test('crash after durable append requires reopen and replay before any new write', () => {
  const root = makeRoot('crash-replay');
  let injected = false;
  const store = openTaskStore({
    projectId: 'crash-replay', rootTaskId: 'TASK-P4', testRoot: root,
    faultInjector(point) {
      if (!injected && point === 'AFTER_EVENT_APPEND_BEFORE_STATE_PUBLISH') {
        injected = true;
        throw new Error('SIMULATED_PROCESS_CRASH');
      }
    },
  });
  assert.throws(
    () => store.persistIntent({ eventId: 'EVENT-CRASH-1', expectedRevision: 0, identity: identity(), payload: { text: 'durable' } }),
    /STORE_COMMIT_RECOVERY_REQUIRED:SIMULATED_PROCESS_CRASH/,
  );
  assert.throws(
    () => store.advanceDag({ eventId: 'EVENT-POISONED', expectedRevision: 0, expectedDagRevision: 0 }),
    /STORE_RECOVERY_REQUIRED/,
  );
  store.close();

  const recovered = openTaskStore({ projectId: 'crash-replay', rootTaskId: 'TASK-P4', testRoot: root });
  assert.equal(recovered.snapshot().revision, 1);
  assert.equal(recovered.events().length, 1);
  assert.equal(recovered.getIntent(recovered.events()[0].payload.intent_key).payload.text, 'durable');
  recovered.close();
});
