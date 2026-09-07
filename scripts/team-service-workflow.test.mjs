import assert from 'node:assert/strict';
import test from 'node:test';
import { createServiceWorkflow, nextServiceAction, applyServiceEvent } from './team-service-workflow.mjs';
import { roles, teams } from './team-routing-contract-audit.mjs';
import { canonicalHash } from './team-service-canonical.mjs';

const initial = () => createServiceWorkflow({ taskId: 'TASK-PILOT', correlationId: 'CORR-PILOT', team: teams[1], taskPointer: 'TASK:TASK-PILOT' });
// Synthetic receipts are test-only. Production MUST supply its real verifier.
const fixtureVerifier = { verifyReceipt: () => true };
const decisionVerifier = { verifyReceipt: () => true, verifyDecision: () => true, nowMs: Date.parse('2030-01-01T00:00:00Z') };
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
  const reported = applyServiceEvent(blocked, eventFor(blocked, 'BLOCKER_REPORTED', {
    actor: blocked.blocker.owner,
    blockerId: blocked.blocker.blockerId,
    expectedBlockerRevision: 0,
  }), fixtureVerifier);
  assert.equal(reported.status, 'BLOCKED');
  assert.equal(reported.blocker.status, 'OPEN');
  assert.equal(reported.blocker.revision, 1);
  assert.throws(() => applyServiceEvent(reported, eventFor(reported, 'BLOCKER_RESOLVED', {
    actor: roles.master,
    blockerId: reported.blocker.blockerId,
    expectedBlockerRevision: 0,
    decision: {},
  }), decisionVerifier), /BLOCKER_REVISION_CONFLICT/);
  const resolved = applyServiceEvent(reported, eventFor(reported, 'BLOCKER_RESOLVED', {
    actor: reported.blocker.owner,
    blockerId: reported.blocker.blockerId,
    expectedBlockerRevision: 1,
    decision: {
      actor: roles.human,
      taskId: reported.taskId,
      correlationId: reported.correlationId,
      blockerId: reported.blocker.blockerId,
      expectedRevision: reported.revision,
      action: 'RESOLVE',
      revoked: false,
      expiresAt: '2031-01-01T00:00:00Z',
    },
  }), decisionVerifier);
  assert.equal(resolved.status, 'READY');
  assert.equal(resolved.blocker.status, 'RESOLVED');
  const stopped = applyServiceEvent(blocked, eventFor(blocked, 'HUMAN_STOP', { actor: roles.human }), fixtureVerifier);
  assert.equal(nextServiceAction(stopped, roles.master).status, 'STOPPED');
});

test('AC-03 service contract', () => {
  const state = initial();
  const first = applyServiceEvent(state, eventFor(state, 'ASSIGNMENT_EFFECT', {
    eventId: 'EVENT-EFFECT-CEO',
    actor: roles.master,
    subtaskId: 'SUBTASK-DATA',
    effectKind: 'APPLY_ASSIGNMENT',
  }), fixtureVerifier);
  assert.equal(first.assignmentEffects.length, 1);
  assert.throws(() => applyServiceEvent(first, eventFor(first, 'ASSIGNMENT_EFFECT', {
    eventId: 'EVENT-EFFECT-DEPUTY',
    actor: roles.deputy,
    subtaskId: 'SUBTASK-DATA',
    effectKind: 'APPLY_ASSIGNMENT',
  }), fixtureVerifier), /DUPLICATE_ASSIGNMENT_EFFECT/);
  assert.equal(first.assignmentEffects.length, 1);
});

test('AC-07 service contract', () => {
  const sent = send(initial());
  const retried = applyServiceEvent(sent, eventFor(sent, 'RETRY', {
    eventId: 'EVENT-RETRY',
    actor: roles.human,
    runGeneration: sent.runGeneration,
  }), fixtureVerifier);
  assert.equal(retried.status, 'SENT_UNCONFIRMED');
  assert.equal(retried.activeDeliveryToken, sent.activeDeliveryToken);
  assert.equal(retried.runGeneration, sent.runGeneration);
  assert.throws(() => applyServiceEvent(retried, eventFor(retried, 'RETRY', {
    eventId: 'EVENT-RETRY-OLD-GENERATION',
    actor: roles.human,
    runGeneration: retried.runGeneration + 1,
  }), fixtureVerifier), /RUN_GENERATION_MISMATCH/);

  const base = initial();
  const amended = applyServiceEvent(base, eventFor(base, 'AMEND', {
    eventId: 'EVENT-AMEND',
    actor: roles.human,
    expectedWorkSpecRevision: 0,
    newWorkSpecRevision: 1,
    decision: {
      actor: roles.human,
      taskId: base.taskId,
      correlationId: base.correlationId,
      expectedRevision: base.revision,
      action: 'AMEND',
      revoked: false,
      expiresAt: '2031-01-01T00:00:00Z',
    },
  }), decisionVerifier);
  assert.equal(amended.workSpecRevision, 1);
  assert.throws(() => applyServiceEvent(amended, eventFor(amended, 'AMEND', {
    eventId: 'EVENT-AMEND-STALE',
    actor: roles.human,
    expectedWorkSpecRevision: 0,
    newWorkSpecRevision: 1,
    decision: {
      actor: roles.human,
      taskId: amended.taskId,
      correlationId: amended.correlationId,
      expectedRevision: amended.revision,
      action: 'AMEND',
      revoked: false,
      expiresAt: '2031-01-01T00:00:00Z',
    },
  }), decisionVerifier), /WORK_SPEC_REVISION_CONFLICT/);

  const stopped = applyServiceEvent(base, eventFor(base, 'HUMAN_STOP', { actor: roles.human }), fixtureVerifier);
  const resumeEvent = (decisionOverrides = {}) => eventFor(stopped, 'HUMAN_RESUME', {
    eventId: `EVENT-RESUME-${decisionOverrides.revoked ? 'REVOKED' : decisionOverrides.expiresAt === '2029-01-01T00:00:00Z' ? 'EXPIRED' : 'VALID'}`,
    actor: roles.human,
    decision: {
      actor: roles.human,
      taskId: stopped.taskId,
      correlationId: stopped.correlationId,
      expectedRevision: stopped.revision,
      action: 'RESUME',
      revoked: false,
      expiresAt: '2031-01-01T00:00:00Z',
      ...decisionOverrides,
    },
  });
  const resumed = applyServiceEvent(stopped, resumeEvent(), decisionVerifier);
  assert.equal(resumed.status, 'READY');
  assert.equal(resumed.runGeneration, 1);
  assert.deepEqual(resumed.generationAudit, [{ runGeneration: 0, result: 'AUDIT_ONLY' }]);
  assert.throws(() => applyServiceEvent(stopped, resumeEvent({ revoked: true }), decisionVerifier), /DECISION_REVOKED/);
  assert.throws(() => applyServiceEvent(stopped, resumeEvent({ expiresAt: '2029-01-01T00:00:00Z' }), decisionVerifier), /DECISION_EXPIRED/);
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

test('workflow event dedupe uses the shared canonical interpreter', () => {
  assert.equal(canonicalHash({ b: 2, a: 1 }), canonicalHash({ a: 1, b: 2 }));
  assert.throws(() => canonicalHash({ '\u00e9': 1, 'e\u0301': 2 }), /CANONICAL_KEY_COLLISION/);
});
