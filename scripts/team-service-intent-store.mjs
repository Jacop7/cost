import { canonicalHash, canonicalJson } from './team-service-canonical.mjs';

export const INTENT_IDENTITY_FIELDS = Object.freeze([
  'task_id',
  'run_generation',
  'assignment_id',
  'leg_id',
  'work_spec_revision',
  'logical_source',
  'logical_target',
  'message_kind',
]);

const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};

const clone = (value) => structuredClone(value);

function exactIdentity(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_INTENT_IDENTITY');
  requireValue(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...INTENT_IDENTITY_FIELDS].sort()), 'INVALID_INTENT_IDENTITY_FIELDS');
  for (const field of INTENT_IDENTITY_FIELDS) {
    if (field === 'run_generation' || field === 'work_spec_revision') {
      requireValue(Number.isSafeInteger(value[field]) && value[field] >= 0, `INVALID_${field.toUpperCase()}`);
    } else {
      requireValue(typeof value[field] === 'string' && value[field].length > 0, `INVALID_${field.toUpperCase()}`);
    }
  }
  return Object.fromEntries(INTENT_IDENTITY_FIELDS.map((field) => [field, value[field]]));
}

export function intentKeyOf(identity) {
  return canonicalHash(exactIdentity(identity));
}

export function effectKeyOf(identity) {
  const exact = exactIdentity(identity);
  const { run_generation: ignored, ...stableIdentity } = exact;
  return canonicalHash(stableIdentity);
}

function validateCheckpoints(checkpoints) {
  requireValue(Array.isArray(checkpoints) && checkpoints.length > 0, 'CHECKPOINTS_REQUIRED');
  checkpoints.forEach((checkpoint, index) => {
    requireValue(checkpoint?.schema_version === 1, 'CHECKPOINT_SCHEMA_MISMATCH');
    requireValue(checkpoint.revision === index, 'CHECKPOINT_REVISION_GAP');
    requireValue(Array.isArray(checkpoint.records) && Array.isArray(checkpoint.effects), 'INVALID_CHECKPOINT');
    const expectedPrevious = index === 0 ? null : canonicalHash(checkpoints[index - 1]);
    requireValue(checkpoint.previous_hash === expectedPrevious, 'CHECKPOINT_HASH_CHAIN_INVALID');
  });
  return clone(checkpoints);
}

function initialCheckpoint() {
  return { schema_version: 1, revision: 0, previous_hash: null, records: [], effects: [] };
}

export function createIntentStore({ provider, checkpoints = [initialCheckpoint()] } = {}) {
  requireValue(provider?.kind === 'INJECTED_LOCAL_IDEMPOTENT_MOCK', 'LOCAL_IDEMPOTENT_PROVIDER_REQUIRED');
  requireValue(provider.idempotent_by_intent_key_payload_hash === true, 'BLIND_PREPARE_RETRY_REJECTED');
  requireValue(typeof provider.getOrPrepare === 'function', 'INVALID_PROVIDER');
  let history = validateCheckpoints(checkpoints);
  let state = clone(history.at(-1));
  const locks = new Map();

  const commit = (mutator) => {
    const next = clone(state);
    mutator(next);
    next.revision = state.revision + 1;
    next.previous_hash = canonicalHash(state);
    next.records.sort((left, right) => left.intent_key.localeCompare(right.intent_key));
    next.effects.sort((left, right) => `${left.task_id}\0${left.effect_key}`.localeCompare(`${right.task_id}\0${right.effect_key}`));
    state = next;
    history.push(clone(next));
  };

  const withIntentLock = async (intentKey, operation) => {
    const predecessor = locks.get(intentKey) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const tail = predecessor.then(() => current);
    locks.set(intentKey, tail);
    await predecessor;
    try {
      return await operation();
    } finally {
      release();
      if (locks.get(intentKey) === tail) locks.delete(intentKey);
    }
  };

  const inspect = (intentKey) => clone(state.records.find((record) => record.intent_key === intentKey) ?? null);

  async function prepareReserved(record, payload) {
    requireValue(record, 'BLIND_PREPARE_RETRY_REJECTED');
    requireValue(['PREPARE_PENDING', 'RECOVERY_REQUIRED'].includes(record.state), 'PREPARE_WITHOUT_RESERVATION_REJECTED');
    try {
      const prepared = await provider.getOrPrepare({
        intent_key: record.intent_key,
        payload_hash: record.payload_hash,
        payload: clone(payload),
      });
      requireValue(prepared && typeof prepared === 'object', 'INVALID_PREPARE_RESULT');
      requireValue(typeof prepared.route_id === 'string' && prepared.route_id.length > 0, 'INVALID_ROUTE_ID');
      requireValue(typeof prepared.delivery_token === 'string' && prepared.delivery_token.length > 0, 'INVALID_DELIVERY_TOKEN');
      commit((next) => {
        const target = next.records.find((item) => item.intent_key === record.intent_key);
        requireValue(target?.payload_hash === record.payload_hash, 'INTENT_CONFLICT');
        target.state = 'PREPARED';
        target.route_id = prepared.route_id;
        target.delivery_token = prepared.delivery_token;
        target.record_revision += 1;
      });
      return inspect(record.intent_key);
    } catch (error) {
      commit((next) => {
        const target = next.records.find((item) => item.intent_key === record.intent_key);
        if (target && target.state !== 'PREPARED') {
          target.state = 'RECOVERY_REQUIRED';
          target.record_revision += 1;
        }
      });
      if (error?.provider_committed === true) throw new Error('PREPARE_RESULT_RECOVERY_REQUIRED');
      throw error;
    }
  }

  async function getOrPrepare({ identity, payload, preallocated_route = null, retry_mode = null }) {
    requireValue(preallocated_route === null, 'UUID_BEFORE_KEY_RESERVATION_REJECTED');
    requireValue(retry_mode !== 'BLIND_PREPARE', 'BLIND_PREPARE_RETRY_REJECTED');
    const exact = exactIdentity(identity);
    const intentKey = canonicalHash(exact);
    const payloadHash = canonicalHash(payload);
    return withIntentLock(intentKey, async () => {
      let record = inspect(intentKey);
      if (record) {
        requireValue(record.payload_hash === payloadHash, 'INTENT_CONFLICT');
        if (record.state === 'PREPARED') return record;
        return prepareReserved(record, payload);
      }
      commit((next) => {
        next.records.push({
          intent_key: intentKey,
          payload_hash: payloadHash,
          identity: exact,
          state: 'RESERVED',
          route_id: null,
          delivery_token: null,
          record_revision: 0,
        });
      });
      commit((next) => {
        const target = next.records.find((item) => item.intent_key === intentKey);
        target.state = 'PREPARE_PENDING';
        target.record_revision += 1;
      });
      record = inspect(intentKey);
      return prepareReserved(record, payload);
    });
  }

  async function recoverIntent({ intent_key, identity, payload }) {
    requireValue(typeof intent_key === 'string' && intent_key.length > 0, 'INVALID_INTENT_KEY');
    requireValue(inspect(intent_key), 'BLIND_PREPARE_RETRY_REJECTED');
    requireValue(intentKeyOf(identity) === intent_key, 'INTENT_KEY_MISMATCH');
    return getOrPrepare({ identity, payload });
  }

  function claimEffect({ task_id, effect_key, run_generation }) {
    requireValue(typeof task_id === 'string' && task_id.length > 0, 'INVALID_TASK_ID');
    requireValue(typeof effect_key === 'string' && effect_key.length > 0, 'INVALID_EFFECT_KEY');
    requireValue(Number.isSafeInteger(run_generation) && run_generation >= 0, 'INVALID_RUN_GENERATION');
    requireValue(!state.effects.some((effect) => effect.task_id === task_id && effect.effect_key === effect_key), 'DUPLICATE_BUSINESS_EFFECT');
    commit((next) => next.effects.push({ task_id, effect_key, run_generation }));
  }

  return Object.freeze({
    getOrPrepare,
    recoverIntent,
    claimEffect,
    inspect,
    checkpoint: () => clone(state),
    exportCheckpoints: () => clone(history),
    serialize: () => canonicalJson(state),
    metrics: () => ({ mock_prepare_calls: provider.call_count?.() ?? null, actual_provider_calls: 0, dispatch_attempts: 0 }),
  });
}
