import { createIntentStore, effectKeyOf, intentKeyOf } from './team-service-intent-store.mjs';

const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};
const rejected = async (operation, pattern) => {
  try {
    await operation();
  } catch (error) {
    requireValue(pattern.test(String(error?.message ?? error)), 'UNEXPECTED_REJECTION');
    return true;
  }
  throw new Error('EXPECTED_REJECTION');
};
const identity = (overrides = {}) => ({
  task_id: 'TASK-AC10', run_generation: 1, assignment_id: 'ASSIGN-01', leg_id: 'LEG-01',
  work_spec_revision: 3, logical_source: '02_MASTER', logical_target: '03_DEPUTY',
  message_kind: 'TASK_DISPATCH', ...overrides,
});
const payload = (overrides = {}) => ({ task_pointer: 'TASK:TASK-AC10', work_spec_revision: 3, ...overrides });
function mockProvider({ loseFirstResult = false } = {}) {
  const prepared = new Map();
  let calls = 0;
  return {
    kind: 'INJECTED_LOCAL_IDEMPOTENT_MOCK',
    idempotent_by_intent_key_payload_hash: true,
    call_count: () => calls,
    async getOrPrepare({ intent_key, payload_hash }) {
      calls += 1;
      await Promise.resolve();
      const existing = prepared.get(intent_key);
      if (existing) {
        requireValue(existing.payload_hash === payload_hash, 'MOCK_PAYLOAD_CONFLICT');
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

const assertions = {};
{
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = await store.getOrPrepare({ identity: identity(), payload: payload() });
  const replay = await store.getOrPrepare({ identity: identity(), payload: payload() });
  assertions['AC-10-A01'] = first.route_id === replay.route_id && first.delivery_token === replay.delivery_token && provider.call_count() === 1;
}
{
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  await store.getOrPrepare({ identity: identity(), payload: payload() });
  assertions['AC-10-A02'] = await rejected(
    () => store.getOrPrepare({ identity: identity(), payload: payload({ work_spec_revision: 4 }) }),
    /INTENT_CONFLICT/,
  ) && provider.call_count() === 1;
}
{
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const results = await Promise.all(Array.from({ length: 8 }, () => store.getOrPrepare({ identity: identity(), payload: payload() })));
  assertions['AC-10-A03'] = new Set(results.map((item) => item.route_id)).size === 1
    && new Set(results.map((item) => item.delivery_token)).size === 1 && provider.call_count() === 1;
}
{
  const provider = mockProvider({ loseFirstResult: true });
  const store = createIntentStore({ provider });
  const lost = await rejected(() => store.getOrPrepare({ identity: identity(), payload: payload() }), /PREPARE_RESULT_RECOVERY_REQUIRED/);
  const key = intentKeyOf(identity());
  const recovered = await store.recoverIntent({ intent_key: key, identity: identity(), payload: payload() });
  const blind = await rejected(() => store.recoverIntent({ intent_key: 'UNKNOWN', identity: identity(), payload: payload() }), /BLIND_PREPARE_RETRY_REJECTED/);
  const early = await rejected(() => store.getOrPrepare({ identity: identity({ leg_id: 'LEG-02' }), payload: payload(), preallocated_route: { route_id: 'EARLY' } }), /UUID_BEFORE_KEY_RESERVATION_REJECTED/);
  const tampered = store.exportCheckpoints();
  tampered[1].records[0].state = 'PREPARED';
  let tamperRejected = false;
  try { createIntentStore({ provider, checkpoints: tampered }); } catch (error) { tamperRejected = /CHECKPOINT_HASH_CHAIN_INVALID/.test(String(error.message)); }
  assertions['AC-10-A04'] = lost && blind && early && tamperRejected && recovered.route_id === 'ROUTE-1' && recovered.delivery_token === 'DELIVERY-1';
}
{
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = await store.getOrPrepare({ identity: identity({ run_generation: 1 }), payload: payload() });
  const resumed = await store.getOrPrepare({ identity: identity({ run_generation: 2 }), payload: payload() });
  assertions['AC-10-A05'] = first.intent_key !== resumed.intent_key && first.route_id !== resumed.route_id && first.delivery_token !== resumed.delivery_token;
}
{
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = await store.getOrPrepare({ identity: identity(), payload: payload() });
  const successor = await store.getOrPrepare({ identity: identity(), payload: payload() });
  const polluted = await rejected(() => store.getOrPrepare({ identity: identity({ endpoint_id: 'EP-2' }), payload: payload() }), /INVALID_INTENT_IDENTITY_FIELDS/);
  assertions['AC-10-A06'] = polluted && first.route_id === successor.route_id && first.delivery_token === successor.delivery_token && provider.call_count() === 1;
}
{
  const provider = mockProvider();
  const store = createIntentStore({ provider });
  const first = effectKeyOf(identity({ run_generation: 1 }));
  const resumed = effectKeyOf(identity({ run_generation: 2 }));
  store.claimEffect({ task_id: 'TASK-AC10', effect_key: first, run_generation: 1 });
  let duplicate = false;
  try { store.claimEffect({ task_id: 'TASK-AC10', effect_key: resumed, run_generation: 2 }); } catch (error) { duplicate = /DUPLICATE_BUSINESS_EFFECT/.test(String(error.message)); }
  assertions['AC-10-A07'] = first === resumed && duplicate;
}

for (const [id, passed] of Object.entries(assertions)) requireValue(passed === true, `ASSERTION_FAILED:${id}`);
export const observation = Object.freeze({
  scenario_id: 'AC-10', assertions, passed: Object.values(assertions).filter(Boolean).length,
  failed: Object.values(assertions).filter((value) => !value).length,
});
