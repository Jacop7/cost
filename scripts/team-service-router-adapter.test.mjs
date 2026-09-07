import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntentStore, effectKeyOf, intentKeyOf } from './team-service-intent-store.mjs';

const identity = (overrides = {}) => ({
  task_id: 'TASK-AC10',
  run_generation: 1,
  assignment_id: 'ASSIGN-01',
  leg_id: 'LEG-01',
  work_spec_revision: 3,
  logical_source: '02_MASTER',
  logical_target: '03_DEPUTY',
  message_kind: 'TASK_DISPATCH',
  ...overrides,
});
const payload = (overrides = {}) => ({ task_pointer: 'TASK:TASK-AC10', work_spec_revision: 3, ...overrides });
const effectIdentity = (overrides = {}) => ({
  task_id: 'TASK-AC10', subtask_id: 'SUBTASK-DATA', work_spec_revision: 3,
  effect_kind: 'APPLY_ASSIGNMENT', ...overrides,
});

function mockProvider({ delay = 0, loseFirstResult = false } = {}) {
  const prepared = new Map();
  let calls = 0;
  return {
    kind: 'INJECTED_LOCAL_IDEMPOTENT_MOCK',
    idempotent_by_intent_key_payload_hash: true,
    call_count: () => calls,
    async getOrPrepare({ intent_key, payload_hash }) {
      calls += 1;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const existing = prepared.get(intent_key);
      if (existing) {
        assert.equal(existing.payload_hash, payload_hash);
        return existing.result;
      }
      const result = { route_id: `ROUTE-${calls}`, delivery_token: `DELIVERY-${calls}` };
      prepared.set(intent_key, { payload_hash, result });
      if (loseFirstResult) {
        loseFirstResult = false;
        const error = new Error('SIMULATED_RESULT_LOSS');
        error.provider_committed = true;
        throw error;
      }
      return result;
    },
  };
}

test('AC-10-A01 같은 intent와 payload는 최초 route/token을 재사용한다', async () => {
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = await store.getOrPrepare({ identity: identity(), payload: payload() });
  const replay = await store.getOrPrepare({ identity: identity(), payload: payload() });
  assert.equal(first.intent_key, replay.intent_key);
  assert.equal(first.route_id, replay.route_id);
  assert.equal(first.delivery_token, replay.delivery_token);
  assert.equal(provider.call_count(), 1);
});

test('AC-10-A02 같은 intent의 다른 payload는 충돌로 닫힌다', async () => {
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  await store.getOrPrepare({ identity: identity(), payload: payload() });
  await assert.rejects(store.getOrPrepare({ identity: identity(), payload: payload({ work_spec_revision: 4 }) }), /INTENT_CONFLICT/);
  assert.equal(provider.call_count(), 1);
});

test('AC-10-A03 동시 요청은 intent별 하나의 논리 prepare로 직렬화된다', async () => {
  const provider = mockProvider({ delay: 20 });
  const store = createIntentStore({ provider });
  const results = await Promise.all(Array.from({ length: 8 }, () => store.getOrPrepare({ identity: identity(), payload: payload() })));
  assert.equal(new Set(results.map((item) => item.route_id)).size, 1);
  assert.equal(new Set(results.map((item) => item.delivery_token)).size, 1);
  assert.equal(provider.call_count(), 1);
});

test('AC-10-A04 provider 성공 뒤 결과 유실은 같은 key로 회수하며 blind retry와 선 UUID를 거부한다', async () => {
  const provider = mockProvider({ loseFirstResult: true });
  const store = createIntentStore({ provider });
  await assert.rejects(store.getOrPrepare({ identity: identity(), payload: payload() }), /PREPARE_RESULT_RECOVERY_REQUIRED/);
  const key = intentKeyOf(identity());
  assert.equal(store.inspect(key).state, 'RECOVERY_REQUIRED');
  const recovered = await store.recoverIntent({ intent_key: key, identity: identity(), payload: payload() });
  assert.equal(recovered.route_id, 'ROUTE-1');
  assert.equal(recovered.delivery_token, 'DELIVERY-1');
  assert.equal(provider.call_count(), 2);
  await assert.rejects(store.recoverIntent({ intent_key: 'UNKNOWN', identity: identity(), payload: payload() }), /BLIND_PREPARE_RETRY_REJECTED/);
  await assert.rejects(store.getOrPrepare({ identity: identity({ leg_id: 'LEG-02' }), payload: payload(), preallocated_route: { route_id: 'ROUTE-EARLY' } }), /UUID_BEFORE_KEY_RESERVATION_REJECTED/);
  const checkpoints = store.exportCheckpoints();
  createIntentStore({ provider, checkpoints });
  const tampered = structuredClone(checkpoints);
  tampered[1].records[0].state = 'PREPARED';
  assert.throws(() => createIntentStore({ provider, checkpoints: tampered }), /CHECKPOINT_HASH_CHAIN_INVALID/);
});

test('AC-10-A05 새 run_generation은 새 intent와 새 route/token을 만든다', async () => {
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = await store.getOrPrepare({ identity: identity({ run_generation: 1 }), payload: payload() });
  const resumed = await store.getOrPrepare({ identity: identity({ run_generation: 2 }), payload: payload() });
  assert.notEqual(first.intent_key, resumed.intent_key);
  assert.notEqual(first.route_id, resumed.route_id);
  assert.notEqual(first.delivery_token, resumed.delivery_token);
});

test('AC-10-A06 같은 세대 successor retry는 endpoint를 identity로 섞지 않고 기존 route/token을 유지한다', async () => {
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = await store.getOrPrepare({ identity: identity(), payload: payload() });
  const successorRetry = await store.getOrPrepare({ identity: identity(), payload: payload() });
  assert.equal(successorRetry.intent_key, first.intent_key);
  assert.equal(successorRetry.route_id, first.route_id);
  assert.equal(successorRetry.delivery_token, first.delivery_token);
  assert.equal(provider.call_count(), 1);
  await assert.rejects(
    store.getOrPrepare({ identity: identity({ endpoint_id: 'EP-2' }), payload: payload() }),
    /INVALID_INTENT_IDENTITY_FIELDS/,
  );
});

test('AC-10-A07 effect_key는 세대와 무관하고 같은 business effect의 중복 실행을 막는다', () => {
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = effectKeyOf(effectIdentity());
  const resumed = effectKeyOf(effectIdentity());
  assert.equal(first, resumed);
  store.claimEffect({ task_id: 'TASK-AC10', effect_key: first, run_generation: 1 });
  assert.throws(() => store.claimEffect({ task_id: 'TASK-AC10', effect_key: resumed, run_generation: 2 }), /DUPLICATE_BUSINESS_EFFECT/);
  assert.notEqual(first, effectKeyOf(effectIdentity({ subtask_id: 'SUBTASK-QUALITY' })));
  assert.notEqual(first, effectKeyOf(effectIdentity({ effect_kind: 'PUBLISH_RESULT' })));
  assert.notEqual(first, effectKeyOf(effectIdentity({ work_spec_revision: 4 })));
  assert.throws(() => effectKeyOf(identity()), /INVALID_EFFECT_IDENTITY_FIELDS/);
  assert.deepEqual(store.metrics(), { mock_prepare_calls: 0, actual_provider_calls: 0, dispatch_attempts: 0 });
});
