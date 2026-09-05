import assert from 'node:assert/strict';
import test from 'node:test';
import { createServiceWorkflow, nextServiceAction, applyServiceEvent } from './team-service-workflow.mjs';
import { roles, teams } from './team-routing-contract-audit.mjs';

const initial = () => createServiceWorkflow({ taskId: 'TASK-PILOT', correlationId: 'CORR-PILOT', team: teams[1], taskPointer: 'TASK:TASK-PILOT' });
// Synthetic receipts are test-only. Production MUST supply its real verifier.
const fixtureVerifier = { verifyReceipt: () => true };
const eventFor = (s, type, extra = {}) => ({ eventId: `EVENT-${s.revision}`, expectedRevision: s.revision,
  taskId: s.taskId, correlationId: s.correlationId, type, actor: s.legs[s.leg].target,
  evidencePointer: `RECEIPT:TEST-${s.revision}`, deliveryToken: s.activeDeliveryToken, ...extra });
const send = (s) => applyServiceEvent(s, eventFor(s, 'TOOL_ACCEPTED', { actor: s.legs[s.leg].source, deliveryToken: `DELIVERY-${s.leg}` }), fixtureVerifier);
const ack = (s) => applyServiceEvent(s, eventFor(s, 'ACK'), fixtureVerifier);

test('ordinary assignment goes 01 to CEO to service chief to team, never via room', () => {
  const state = initial();
  assert.deepEqual(state.legs.slice(0, 3).map(({ source, target }) => [source, target]),
    [[roles.human, roles.master], [roles.master, roles.deputy], [roles.deputy, teams[1]]]);
  assert.equal(nextServiceAction(state, roles.human).requiresRouterValidation, true);
  assert.equal(nextServiceAction(state, roles.master).type, 'WAIT_FOR_ACTOR');
});

test('tool acceptance is not ACK, and ACK is not task completion', () => {
  const sent = send(initial());
  assert.equal(sent.status, 'SENT_UNCONFIRMED');
  assert.equal(sent.leg, 0);
  assert.throws(() => applyServiceEvent(sent, eventFor(sent, 'LEG_COMPLETED', { resultPointer: 'ARTIFACT:RESULT' }), fixtureVerifier), /INVALID_RESULT_STATE/);
  assert.equal(ack(sent).status, 'ACKNOWLEDGED');
  assert.equal(ack(sent).leg, 0);
});

test('six-leg synthetic roundtrip advances only on verified result at each hop', () => {
  let state = initial();
  for (let i = 0; i < 6; i++) {
    state = ack(send(state));
    state = applyServiceEvent(state, eventFor(state, 'LEG_COMPLETED', { resultPointer: `ARTIFACT:RESULT-${i}` }), fixtureVerifier);
    state = JSON.parse(JSON.stringify(state));
  }
  assert.equal(state.status, 'COMPLETED');
  assert.equal(state.revision, 18);
  assert.equal(nextServiceAction(state, roles.human).type, 'TERMINAL');
});

test('missing or negative receipt verification fails closed', () => {
  const s = initial();
  const e = eventFor(s, 'TOOL_ACCEPTED', { actor: roles.human, deliveryToken: 'DELIVERY-0' });
  assert.throws(() => applyServiceEvent(s, e), /RECEIPT_NOT_VERIFIED/);
  assert.throws(() => applyServiceEvent(s, e, { verifyReceipt: () => false }), /RECEIPT_NOT_VERIFIED/);
});

test('same event is idempotent; changed event, wrong scope and stale revision fail', () => {
  const s = send(initial());
  const e = eventFor(s, 'ACK');
  const result = applyServiceEvent(s, e, fixtureVerifier);
  assert.equal(applyServiceEvent(result, e, fixtureVerifier), result);
  assert.throws(() => applyServiceEvent(result, { ...e, evidencePointer: 'RECEIPT:OTHER' }, fixtureVerifier), /EVENT_ID_CONFLICT/);
  assert.throws(() => applyServiceEvent(s, { ...e, taskId: 'OTHER' }, fixtureVerifier), /TASK_SCOPE_MISMATCH/);
  assert.throws(() => applyServiceEvent(s, { ...e, expectedRevision: 0 }, fixtureVerifier), /REVISION_CONFLICT/);
});

test('wrong actor or delivery token cannot acknowledge', () => {
  const s = send(initial());
  assert.throws(() => applyServiceEvent(s, eventFor(s, 'ACK', { actor: roles.deputy }), fixtureVerifier), /INVALID_ACK_STATE/);
  assert.throws(() => applyServiceEvent(s, eventFor(s, 'ACK', { deliveryToken: 'DELIVERY-WRONG' }), fixtureVerifier), /DELIVERY_TOKEN_MISMATCH/);
});

test('rejection is terminal and not retried as an ACK', () => {
  const s = send(initial());
  const rejected = applyServiceEvent(s, eventFor(s, 'REJECTED'), fixtureVerifier);
  assert.equal(nextServiceAction(rejected, roles.human).type, 'TERMINAL');
  assert.throws(() => applyServiceEvent(rejected, eventFor(rejected, 'ACK'), fixtureVerifier), /TERMINAL_WORKFLOW/);
});

test('blocker goes directly to human intake; human stop prevents new work', () => {
  const s = initial();
  const blocked = applyServiceEvent(s, eventFor(s, 'BLOCKED'), fixtureVerifier);
  assert.equal(nextServiceAction(blocked, roles.master).target, roles.human);
  assert.equal(nextServiceAction(blocked, roles.deputy).type, 'WAIT_FOR_ACTOR');
  const stopped = applyServiceEvent(blocked, eventFor(blocked, 'HUMAN_STOP', { actor: roles.human }), fixtureVerifier);
  assert.equal(nextServiceAction(stopped, roles.master).status, 'STOPPED');
});

test('transition does not mutate the prior checkpoint', () => {
  const s = initial();
  const before = JSON.stringify(s);
  send(s);
  assert.equal(JSON.stringify(s), before);
});

test('invalid team and empty or raw task payload are refused', () => {
  assert.throws(() => createServiceWorkflow({ taskId: 'TASK-A', correlationId: 'CORR-A', team: roles.room, taskPointer: 'TASK:A' }), /INVALID_TEAM/);
  assert.throws(() => createServiceWorkflow({ taskId: 'TASK-A', correlationId: 'CORR-A', team: teams[0], taskPointer: 'raw conversation' }), /INVALID_TASK_POINTER/);
});
