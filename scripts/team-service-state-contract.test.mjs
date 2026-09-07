import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contract = JSON.parse(readFileSync(new URL('../docs/team/service-flow-state-contract.json', import.meta.url), 'utf8'));
const clone = (value) => structuredClone(value);

function canonicalJson(value, stack = new Set()) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('UNSUPPORTED_CANONICAL_VALUE');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== 'object' || stack.has(value)) throw new Error('UNSUPPORTED_CANONICAL_VALUE');
  if (Object.getOwnPropertySymbols(value).length) throw new Error('UNSUPPORTED_CANONICAL_VALUE');
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      const names = Object.getOwnPropertyNames(value);
      if (names.length !== value.length + 1 || !names.includes('length')) throw new Error('UNSUPPORTED_CANONICAL_VALUE');
      return `[${value.map((item) => canonicalJson(item, stack)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('UNSUPPORTED_CANONICAL_VALUE');
    const normalizedKeys = new Set();
    const entries = Object.getOwnPropertyNames(value).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, 'value')) throw new Error('UNSUPPORTED_CANONICAL_VALUE');
      const normalizedKey = key.normalize('NFC');
      if (normalizedKeys.has(normalizedKey)) throw new Error('CANONICAL_KEY_COLLISION');
      normalizedKeys.add(normalizedKey);
      return [normalizedKey, canonicalJson(descriptor.value, stack)];
    }).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, encoded]) => `${JSON.stringify(key)}:${encoded}`).join(',')}}`;
  } finally {
    stack.delete(value);
  }
}

const digest = (value) => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

function requireExactKeys(value, expected, code) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), code);
}

function transitionEntity(entityType, entity, nextState, expectedRevision) {
  const states = contract.entities[entityType]?.states;
  const allowed = contract.entity_transition_contract.allowed[entityType];
  if (!states || !allowed) throw new Error('UNKNOWN_ENTITY');
  if (expectedRevision !== entity.revision) throw new Error('REVISION_CONFLICT');
  if (!allowed[entity.state]?.includes(nextState)) throw new Error('INVALID_TRANSITION');
  return { ...entity, state: nextState, revision: entity.revision + contract.entity_transition_contract.revision_increment };
}

function acknowledgeDelivery({ delivery, nextDelivery, assignment, finalOwner }) {
  const acknowledged = transitionEntity('delivery', delivery, 'ACKNOWLEDGED', delivery.revision);
  if (finalOwner) {
    assert.equal(assignment.state, 'ACKNOWLEDGED');
    return {
      delivery: acknowledged,
      assignment: transitionEntity('assignment', assignment, contract.ack_progression.final_owner_leg.assignment_state, assignment.revision),
      taskCompleted: contract.ack_progression.final_owner_leg.task_completion,
    };
  }
  assert.equal(nextDelivery.state, contract.ack_progression.intermediate_leg.next_delivery_state);
  return { delivery: acknowledged, nextDelivery: clone(nextDelivery), taskCompleted: contract.ack_progression.intermediate_leg.task_completion };
}

function updateExactSibling(entities, keyFields, key, update) {
  if (Object.values(key).some((value) => value === '*')) throw new Error('WILDCARD_UPDATE_FORBIDDEN');
  const matches = entities.map((entity) => keyFields.every((field) => entity[field] === key[field]));
  if (matches.filter(Boolean).length !== 1) throw new Error('EXACT_ENTITY_REQUIRED');
  return entities.map((entity, index) => matches[index] ? { ...entity, ...update, revision: entity.revision + 1 } : entity);
}

function canCompleteTask(snapshot) {
  const rule = contract.task_completion_rollup;
  if (snapshot.task.state !== rule.required_task_state) return false;
  if (rule.forbidden_task_states.includes(snapshot.task.state)) return false;
  if (!snapshot.requiredSubtasks.length || snapshot.requiredSubtasks.some((item) =>
    item.run_generation !== snapshot.task.run_generation || item.state !== rule.all_required_subtasks_state)) return false;
  return snapshot.quality.run_generation === snapshot.task.run_generation
    && snapshot.quality.state === rule.independent_quality_state
    && snapshot.humanDelivery.run_generation === snapshot.task.run_generation
    && snapshot.humanDelivery.state === rule.human_final_delivery_state
    && snapshot.unresolvedBlockers === rule.unresolved_blockers
    && snapshot.pendingDeliveries === rule.pending_deliveries
    && snapshot.pendingEffects === rule.pending_effects;
}

function claimEffect(registry, claim) {
  const key = contract.effect_uniqueness_contract.unique_fields.map((field) => claim[field]).join('\u0000');
  if (registry.has(key)) throw new Error(contract.effect_uniqueness_contract.duplicate_across_generations);
  registry.set(key, clone(claim));
}

function validateAuthority(authority, clock) {
  const rule = contract.authority_validation_contract;
  const clockRule = rule.clock_provenance;
  if (!clock?.source || !Number.isFinite(clock.now)) throw new Error(clockRule.missing);
  if (clock.source === 'OWNER_APPROVED_LOCAL_ALTERNATIVE') {
    if (clock.decision_id !== clockRule.owner_approval_decision || clock.decision_status !== 'APPROVED') {
      throw new Error(clockRule.unapproved_alternative);
    }
  } else if (clock.source !== 'TRUSTED_HOST_UTC') {
    throw new Error(clockRule.missing);
  }
  requireExactKeys(authority, rule.required_fields, 'AUTHORITY_FIELDS_MISMATCH');
  assert.match(authority.decision_id, new RegExp(rule.decision_id_pattern));
  assert.ok(Array.isArray(authority.allowed_actions) && authority.allowed_actions.length > 0, 'AUTHORITY_ACTIONS_EMPTY');
  assert.ok(authority.scope && typeof authority.scope === 'object' && Object.keys(authority.scope).length > 0, 'AUTHORITY_SCOPE_EMPTY');
  assert.match(authority.human_provenance_ref, new RegExp(rule.human_provenance_pattern));
  const issued = Date.parse(authority.issued_at);
  const notBefore = Date.parse(authority.not_before);
  const expires = Date.parse(authority.expires_at);
  assert.ok(Number.isFinite(issued) && issued <= notBefore && notBefore < expires, 'AUTHORITY_TIME_ORDER');
  if (authority.revoked_at !== null || clock.now < notBefore || clock.now >= expires) throw new Error(rule.expired_or_revoked);
}

function applyRootCommand(state, event, seen, clock) {
  const rule = contract.root_command_contract;
  if (Object.hasOwn(event, 'stop_epoch')) throw new Error(rule.child_stop_epoch);
  requireExactKeys(event, rule.required_event_fields, 'ROOT_EVENT_FIELDS_MISMATCH');
  const fingerprint = digest(event);
  if (seen.has(event.event_id)) {
    if (seen.get(event.event_id) !== fingerprint) throw new Error(rule.duplicate_changed_payload);
    return state;
  }
  if (event.expected_task_revision !== state.task_revision) throw new Error(rule.stale_revision);
  if (event.expected_command_seq !== state.command_seq) throw new Error(rule.stale_command_seq);
  if (event.run_generation !== state.run_generation) throw new Error('REJECT_STALE_RUN_GENERATION');
  validateAuthority(event.authority, clock);
  if (!event.authority.allowed_actions.includes(event.kind)) throw new Error('REJECT_ACTION_OUTSIDE_AUTHORITY');
  const next = clone(state);
  if (event.kind === 'STOP') {
    next.task_revision += 1;
    next.command_seq += 1;
    next.stop_epoch += 1;
    next.state = 'STOP_REQUESTED';
  } else {
    throw new Error('UNKNOWN_ROOT_COMMAND');
  }
  seen.set(event.event_id, fingerprint);
  return next;
}

test('AC-18 service contract', () => {
  const assertionMarkers = ['AC-18-A01', 'AC-18-A02', 'AC-18-A03', 'AC-18-A04', 'AC-18-A05', 'AC-18-A06'];
  assert.equal(assertionMarkers.length, contract.entities ? 6 : 0);
  assert.equal(contract.entity_transition_contract.expected_revision_required, true);
  for (const [entityType, definition] of Object.entries(contract.entities)) {
    assert.equal(definition.revision_field, 'revision');
    const allowed = contract.entity_transition_contract.allowed[entityType];
    assert.deepEqual(Object.keys(allowed).sort(), [...definition.states].sort());
    for (const [from, targets] of Object.entries(allowed)) {
      for (const target of targets) assert.ok(definition.states.includes(target), `${entityType}:${from}->${target}`);
    }
    const from = definition.states.find((state) => allowed[state].length > 0);
    const entity = { state: from, revision: 7 };
    assert.equal(transitionEntity(entityType, entity, allowed[from][0], 7).revision, 8);
    assert.throws(() => transitionEntity(entityType, entity, allowed[from][0], 6), /REVISION_CONFLICT/);
    assert.throws(() => transitionEntity(entityType, entity, '__UNKNOWN__', 7), /INVALID_TRANSITION/);
  }
});

test('AC-18-A02 ACK는 중간 hop READY 또는 최종 담당 EXECUTING만 만들고 Task를 완료하지 않는다', () => {
  const delivery = { state: 'SENT_UNCONFIRMED', revision: 2 };
  const middle = acknowledgeDelivery({ delivery, nextDelivery: { state: 'READY', revision: 0 }, finalOwner: false });
  assert.equal(middle.delivery.state, 'ACKNOWLEDGED');
  assert.equal(middle.nextDelivery.state, 'READY');
  assert.equal(middle.taskCompleted, false);
  const final = acknowledgeDelivery({ delivery, assignment: { state: 'ACKNOWLEDGED', revision: 4 }, finalOwner: true });
  assert.equal(final.assignment.state, 'EXECUTING');
  assert.equal(final.taskCompleted, false);
  assert.equal(contract.ack_progression.queued_is_ack, false);
  assert.equal(contract.ack_progression.ack_is_result, false);
  assert.equal(contract.ack_progression.ack_is_task_completion, false);
});

test('AC-18-A03 keyed sibling 갱신은 정확히 하나만 바꾸고 wildcard·미일치를 거부한다', () => {
  const siblings = [
    { task_id: 'TASK-A', subtask_id: 'SUB-1', state: 'ACTIVE', revision: 1 },
    { task_id: 'TASK-A', subtask_id: 'SUB-2', state: 'BLOCKED', revision: 3 },
  ];
  const updated = updateExactSibling(siblings, ['task_id', 'subtask_id'], { task_id: 'TASK-A', subtask_id: 'SUB-1' }, { state: 'RESULT_SUBMITTED' });
  assert.equal(updated[0].state, 'RESULT_SUBMITTED');
  assert.equal(updated[0].revision, 2);
  assert.equal(updated[1], siblings[1]);
  assert.throws(() => updateExactSibling(siblings, ['task_id', 'subtask_id'], { task_id: 'TASK-A', subtask_id: '*' }, {}), /WILDCARD_UPDATE_FORBIDDEN/);
  assert.throws(() => updateExactSibling(siblings, ['task_id', 'subtask_id'], { task_id: 'TASK-A', subtask_id: 'SUB-3' }, {}), /EXACT_ENTITY_REQUIRED/);
});

test('AC-18-A04 완료 roll-up은 현 세대 필수 결과·Quality·사람 receipt와 무차단 상태를 모두 요구한다', () => {
  const complete = {
    task: { state: 'ACTIVE', run_generation: 2 },
    requiredSubtasks: [
      { state: 'RESULT_VERIFIED', run_generation: 2 },
      { state: 'RESULT_VERIFIED', run_generation: 2 },
    ],
    quality: { state: 'RESULT_VERIFIED', run_generation: 2 },
    humanDelivery: { state: 'ACKNOWLEDGED', run_generation: 2 },
    unresolvedBlockers: 0,
    pendingDeliveries: 0,
    pendingEffects: 0,
  };
  assert.equal(canCompleteTask(complete), true);
  for (const mutate of [
    (s) => { s.requiredSubtasks[0].state = 'RESULT_SUBMITTED'; },
    (s) => { s.requiredSubtasks[0].run_generation = 1; },
    (s) => { s.quality.state = 'RESULT_SUBMITTED'; },
    (s) => { s.humanDelivery.state = 'SENT_UNCONFIRMED'; },
    (s) => { s.unresolvedBlockers = 1; },
    (s) => { s.pendingDeliveries = 1; },
    (s) => { s.pendingEffects = 1; },
    (s) => { s.task.state = 'STOP_REQUESTED'; },
  ]) {
    const candidate = clone(complete);
    mutate(candidate);
    assert.equal(canCompleteTask(candidate), false);
  }
});

test('AC-18-A05 effect는 (task_id,effect_key)로 세대 전체에서 유일하고 run_generation은 claim metadata다', () => {
  assert.deepEqual(contract.effect_uniqueness_contract.unique_fields, ['task_id', 'effect_key']);
  assert.equal(contract.effect_uniqueness_contract.run_generation_in_unique_key, false);
  const registry = new Map();
  claimEffect(registry, { task_id: 'TASK-A', effect_key: 'EFFECT-1', run_generation: 1 });
  assert.throws(() => claimEffect(registry, { task_id: 'TASK-A', effect_key: 'EFFECT-1', run_generation: 2 }), /REJECT_DUPLICATE_EFFECT/);
  claimEffect(registry, { task_id: 'TASK-A', effect_key: 'EFFECT-2', run_generation: 2 });
  claimEffect(registry, { task_id: 'TASK-B', effect_key: 'EFFECT-1', run_generation: 1 });
  assert.equal(registry.size, 3);
});

test('AC-18-A06 root command_seq·revision·authority exact schema가 stale CAS·replay를 fail-closed한다', () => {
  const now = Date.parse('2026-09-06T10:00:00.000Z');
  const clock = { source: 'TRUSTED_HOST_UTC', now };
  const authority = {
    decision_id: 'DEC-P2-STOP-001',
    authority_revision: 3,
    issued_at: '2026-09-06T09:00:00.000Z',
    not_before: '2026-09-06T09:30:00.000Z',
    expires_at: '2026-09-06T11:00:00.000Z',
    revoked_at: null,
    allowed_actions: ['STOP'],
    scope: { task_id: 'TASK-A' },
    human_provenance_ref: 'RECEIPT:HUMAN-001',
  };
  const event = {
    event_id: 'EVENT-STOP-001',
    task_id: 'TASK-A',
    expected_task_revision: 4,
    expected_command_seq: 9,
    run_generation: 2,
    kind: 'STOP',
    authority,
  };
  const initial = { task_id: 'TASK-A', task_revision: 4, command_seq: 9, stop_epoch: 1, run_generation: 2, state: 'ACTIVE' };
  const seen = new Map();
  const stopped = applyRootCommand(initial, event, seen, clock);
  assert.deepEqual(stopped, { ...initial, task_revision: 5, command_seq: 10, stop_epoch: 2, state: 'STOP_REQUESTED' });
  assert.equal(applyRootCommand(stopped, event, seen, clock), stopped);
  const reordered = { authority: event.authority, kind: event.kind, run_generation: event.run_generation,
    expected_command_seq: event.expected_command_seq, expected_task_revision: event.expected_task_revision,
    task_id: event.task_id, event_id: event.event_id };
  assert.equal(applyRootCommand(stopped, reordered, seen, clock), stopped);
  assert.throws(() => digest({ '\u00e9': 1, 'e\u0301': 2 }), /CANONICAL_KEY_COLLISION/);
  assert.throws(() => digest({ value: undefined }), /UNSUPPORTED_CANONICAL_VALUE/);
  assert.throws(() => applyRootCommand(initial, { ...event, expected_task_revision: 3, event_id: 'EVENT-STALE-REV' }, new Map(), clock), /REJECT_STALE_TASK_REVISION/);
  assert.throws(() => applyRootCommand(initial, { ...event, expected_command_seq: 8, event_id: 'EVENT-STALE-SEQ' }, new Map(), clock), /REJECT_STALE_COMMAND_SEQ/);
  assert.throws(() => applyRootCommand(stopped, { ...event, kind: 'RESUME' }, seen, clock), /REJECT_EVENT_ID_CONFLICT/);
  assert.throws(() => applyRootCommand(initial, { ...event, event_id: 'EVENT-CHILD', stop_epoch: 1 }, new Map(), clock), /CHILD_STOP_EPOCH_FORBIDDEN/);
  assert.throws(() => applyRootCommand(initial, { ...event, event_id: 'EVENT-NO-CLOCK' }, new Map()), /REJECT_NO_CLOCK_PROVENANCE/);
  assert.throws(() => applyRootCommand(initial, { ...event, event_id: 'EVENT-ALT-CLOCK' }, new Map(),
    { source: 'OWNER_APPROVED_LOCAL_ALTERNATIVE', now, decision_id: 'D-CLOCK-ALT', decision_status: 'PENDING' }), /REJECT_UNAPPROVED_CLOCK_ALTERNATIVE/);
  assert.throws(() => applyRootCommand(initial, { ...event, event_id: 'EVENT-EXTRA-AUTH', authority: { ...authority, actor: 'human' } }, new Map(), clock), /AUTHORITY_FIELDS_MISMATCH/);
  assert.throws(() => applyRootCommand(initial, { ...event, event_id: 'EVENT-EXPIRED', authority: { ...authority, expires_at: '2026-09-06T10:00:00.000Z' } }, new Map(), clock), /REJECT_AUTHORITY_INACTIVE/);
  assert.throws(() => applyRootCommand(initial, { ...event, event_id: 'EVENT-REVOKED', authority: { ...authority, revoked_at: '2026-09-06T09:45:00.000Z' } }, new Map(), clock), /REJECT_AUTHORITY_INACTIVE/);
});
