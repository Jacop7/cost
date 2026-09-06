import assert from 'node:assert/strict';
import test from 'node:test';
import { applyServiceEvent, createServiceWorkflow, nextServiceAction } from './team-service-workflow.mjs';
import { roles, teams } from './team-routing-contract-audit.mjs';

const fixtureVerifier = { verifyReceipt: () => true };
const initial = () => createServiceWorkflow({
  taskId: 'TASK-BUGFIX',
  correlationId: 'CORR-BUGFIX',
  team: teams[0],
  taskPointer: 'TASK:TASK-BUGFIX',
});
const acceptedEvent = (state, extra = {}) => ({
  eventId: 'EVENT-BUGFIX',
  expectedRevision: state.revision,
  taskId: state.taskId,
  correlationId: state.correlationId,
  type: 'TOOL_ACCEPTED',
  actor: roles.human,
  evidencePointer: 'RECEIPT:BUGFIX',
  deliveryToken: 'DELIVERY-BUGFIX',
  ...extra,
});

test('BF-C1 rejects non-string IDs', () => {
  'BF-C1-A1';
  for (const invalid of [['TASK-BUGFIX'], { toString: () => 'TASK-BUGFIX' }, 1, null]) {
    assert.throws(() => createServiceWorkflow({
      taskId: invalid,
      correlationId: 'CORR-BUGFIX',
      team: teams[0],
      taskPointer: 'TASK:TASK-BUGFIX',
    }), /INVALID_TASK_ID/);
    assert.throws(() => createServiceWorkflow({
      taskId: 'TASK-BUGFIX',
      correlationId: invalid,
      team: teams[0],
      taskPointer: 'TASK:TASK-BUGFIX',
    }), /INVALID_CORRELATION_ID/);
  }
  const state = initial();
  const before = JSON.stringify(state);
  assert.throws(() => applyServiceEvent(state, acceptedEvent(state, { eventId: ['EVENT-BUGFIX'] }), fixtureVerifier), /INVALID_EVENT_ID/);
  assert.throws(() => nextServiceAction(state, [roles.human]), /INVALID_ACTOR/);
  assert.equal(JSON.stringify(state), before);
  assert.equal(nextServiceAction(state, roles.human).type, 'PREPARE_ROUTE');
  'BF-C1-A2';
});

test('BF-C2 canonical event dedupe', () => {
  const state = initial();
  const event = acceptedEvent(state, { metadata: { z: 'last', nested: { b: 2, a: 1 } } });
  const applied = applyServiceEvent(state, event, fixtureVerifier);
  const reordered = {
    metadata: { nested: { a: 1, b: 2 }, z: 'last' },
    deliveryToken: event.deliveryToken,
    evidencePointer: event.evidencePointer,
    actor: event.actor,
    type: event.type,
    correlationId: event.correlationId,
    taskId: event.taskId,
    expectedRevision: event.expectedRevision,
    eventId: event.eventId,
  };
  assert.equal(applyServiceEvent(applied, reordered, fixtureVerifier), applied);
  'BF-C2-A1';

  assert.throws(() => applyServiceEvent(applied, { ...reordered, metadata: { nested: { a: 1, b: 3 }, z: 'last' } }, fixtureVerifier), /EVENT_ID_CONFLICT/);
  'BF-C2-A2';

  const collision = acceptedEvent(state);
  collision['\u00e9'] = 1;
  collision['e\u0301'] = 1;
  assert.throws(() => applyServiceEvent(state, collision, fixtureVerifier), /CANONICAL_KEY_COLLISION/);
  for (const unsupported of [undefined, 1n, () => true, Number.NaN]) {
    assert.throws(() => applyServiceEvent(state, acceptedEvent(state, { unsupported }), fixtureVerifier), /UNSUPPORTED_CANONICAL_VALUE/);
  }
  const ordered = applyServiceEvent(state, acceptedEvent(state, { values: [1, 2] }), fixtureVerifier);
  assert.throws(() => applyServiceEvent(ordered, acceptedEvent(state, { values: [2, 1] }), fixtureVerifier), /EVENT_ID_CONFLICT/);
  'BF-C2-A3';
});
