import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { canonicalHash, canonicalJson } from './team-service-canonical.mjs';
import { intentKeyOf } from './team-service-intent-store.mjs';

const IDENTIFIER_FIELDS = new Set(['task_id', 'subtask_id', 'event_id', 'intent_key', 'effect_key']);
const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const HASH = /^[0-9a-f]{64}$/;

const requireValue = (condition, code) => {
  if (!condition) throw new Error(code);
};

const clone = (value) => structuredClone(value);
const posix = (value) => value.split(sep).join('/');
const isWithin = (parent, child) => {
  const path = relative(resolve(parent), resolve(child));
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};

function validateIdentifiers(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return;
  requireValue(!seen.has(value), 'CYCLIC_STORE_VALUE');
  seen.add(value);
  try {
    for (const [key, item] of Object.entries(value)) {
      if (IDENTIFIER_FIELDS.has(key)) {
        requireValue(typeof item === 'string' && item.length > 0, `INVALID_${key.toUpperCase()}`);
      }
      validateIdentifiers(item, seen);
    }
    // Reuse the single canonical interpreter for NFC key-collision rejection.
    canonicalJson(value);
  } finally {
    seen.delete(value);
  }
}

function rejectReparseComponents(path) {
  let cursor = resolve(path);
  const checked = [];
  while (true) {
    if (existsSync(cursor)) {
      const stat = lstatSync(cursor);
      requireValue(!stat.isSymbolicLink(), 'REPARSE_PATH_FORBIDDEN');
      checked.push(cursor);
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return checked;
}

export function resolveTeamServiceDirectory({
  projectId,
  localAppData = process.env.LOCALAPPDATA,
  repositoryRoot = null,
  testRoot = null,
} = {}) {
  requireValue(typeof projectId === 'string' && PROJECT_ID.test(projectId), 'INVALID_PROJECT_ID');
  requireValue(basename(projectId) === projectId && !['.', '..'].includes(projectId), 'PROJECT_ID_MUST_BE_SINGLE_SEGMENT');
  let base;
  if (testRoot !== null) {
    requireValue(typeof testRoot === 'string' && isAbsolute(testRoot), 'INVALID_TEST_ROOT');
    requireValue(isWithin(tmpdir(), testRoot), 'TEST_ROOT_MUST_BE_TEMPORARY');
    base = resolve(testRoot);
  } else {
    requireValue(typeof localAppData === 'string' && isAbsolute(localAppData), 'LOCALAPPDATA_KNOWN_FOLDER_REQUIRED');
    base = resolve(localAppData, 'Codex-Team-Service');
  }
  const target = resolve(base, projectId);
  requireValue(isWithin(base, target), 'STORE_PATH_ESCAPE');
  requireValue(!posix(target).toLowerCase().includes('/onedrive/'), 'ONEDRIVE_STORE_FORBIDDEN');
  if (repositoryRoot) requireValue(!isWithin(repositoryRoot, target), 'GIT_STORE_FORBIDDEN');
  rejectReparseComponents(base);
  if (existsSync(target)) rejectReparseComponents(target);
  return target;
}

function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

export function acquireStoreLock(directory, {
  pid = process.pid,
  isOwnerAlive = processAlive,
  nonce = randomUUID(),
} = {}) {
  requireValue(typeof isOwnerAlive === 'function', 'OWNER_LIVENESS_PROBE_REQUIRED');
  mkdirSync(directory, { recursive: true });
  rejectReparseComponents(directory);
  const path = resolve(directory, '.writer.lock');
  const record = { schema_version: 1, pid, nonce };
  try {
    const fd = openSync(path, 'wx', 0o600);
    writeFileSync(fd, `${canonicalJson(record)}\n`, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    let prior;
    try {
      prior = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      throw new Error('LOCK_CORRUPT_FAIL_CLOSED');
    }
    if (isOwnerAlive(prior.pid) === true) throw new Error('LIVE_LOCK_MAY_NOT_BE_STOLEN');
    // A negative liveness probe is the required stale-owner proof. Compare the
    // bytes again immediately before removal so a replacement lock is not stolen.
    const priorBytes = readFileSync(path, 'utf8');
    requireValue(priorBytes === `${canonicalJson(prior)}\n`, 'LOCK_CHANGED_DURING_STALE_PROOF');
    rmSync(path);
    const fd = openSync(path, 'wx', 0o600);
    writeFileSync(fd, `${canonicalJson(record)}\n`, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
  }
  let released = false;
  return Object.freeze({
    path,
    record: clone(record),
    release() {
      if (released) return;
      const current = JSON.parse(readFileSync(path, 'utf8'));
      requireValue(current.pid === pid && current.nonce === nonce, 'LOCK_OWNERSHIP_LOST');
      rmSync(path);
      released = true;
    },
  });
}

const initialState = ({ projectId, rootTaskId }) => ({
  schema_version: 1,
  project_id: projectId,
  root_task_id: rootTaskId,
  revision: 0,
  dag_revision: 0,
  run_generation: 0,
  stop_epoch: 0,
  stopped: false,
  last_sequence: 0,
  last_event_hash: null,
  outbox: {},
  effects: {},
  generation_audit: [],
});

const eventHash = (event) => {
  const body = Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'event_hash'));
  // last_event_hash points at this event, so it cannot participate in its own
  // digest. Replay applies the same projection and verifies the pointer after.
  if (body.next_state) body.next_state = { ...body.next_state, last_event_hash: null };
  return canonicalHash(body);
};

function atomicWrite(path, bytes) {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(temp, 'wx', 0o600);
  try {
    writeFileSync(fd, bytes, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temp, path);
}

function appendDurable(path, bytes) {
  const fd = openSync(path, 'a', 0o600);
  try {
    appendFileSync(fd, bytes, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function quarantine(path) {
  if (!existsSync(path)) return null;
  const target = `${path}.quarantine-${Date.now()}-${randomUUID()}`;
  renameSync(path, target);
  return target;
}

function readEventLog(path) {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  if (text === '') return [];
  requireValue(text.endsWith('\n'), 'EVENT_LOG_TRUNCATED');
  return text.trimEnd().split('\n').map((line) => JSON.parse(line));
}

function replayEvents(events, seed) {
  let state = clone(seed);
  let previous = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    requireValue(event.schema_version === 1, 'EVENT_SCHEMA_MISMATCH');
    requireValue(event.sequence === index + 1, 'EVENT_SEQUENCE_GAP');
    requireValue(event.previous_hash === previous, 'EVENT_PREVIOUS_HASH_MISMATCH');
    requireValue(HASH.test(event.event_hash) && eventHash(event) === event.event_hash, 'EVENT_HASH_MISMATCH');
    validateIdentifiers(event);
    requireValue(event.next_state?.last_sequence === event.sequence, 'EVENT_STATE_SEQUENCE_MISMATCH');
    requireValue(event.next_state?.last_event_hash === event.event_hash, 'EVENT_STATE_HASH_MISMATCH');
    state = clone(event.next_state);
    previous = event.event_hash;
  }
  return state;
}

export function openTaskStore({
  projectId,
  rootTaskId,
  repositoryRoot = null,
  localAppData = process.env.LOCALAPPDATA,
  testRoot = null,
  isOwnerAlive = processAlive,
  faultInjector = () => {},
  runtimeAclEvidence = null,
} = {}) {
  requireValue(typeof rootTaskId === 'string' && rootTaskId.length > 0, 'INVALID_ROOT_TASK_ID');
  requireValue(typeof faultInjector === 'function', 'INVALID_FAULT_INJECTOR');
  const directory = resolveTeamServiceDirectory({ projectId, localAppData, repositoryRoot, testRoot });
  if (testRoot === null) {
    requireValue(runtimeAclEvidence?.resolved_path === directory, 'RUNTIME_ACL_PATH_MISMATCH');
    requireValue(runtimeAclEvidence?.owner_read_result === 'PASS', 'RUNTIME_ACL_OWNER_UNVERIFIED');
    requireValue(runtimeAclEvidence?.other_principal_denial_result === 'PASS', 'ACL_NEGATIVE_UNVERIFIED');
    requireValue(runtimeAclEvidence?.principal_type === 'OTHER_NON_ADMIN_VERIFIED', 'RUNTIME_ACL_PRINCIPAL_UNVERIFIED');
    requireValue(HASH.test(runtimeAclEvidence?.sddl_sha256), 'RUNTIME_ACL_SDDL_UNVERIFIED');
    requireValue(HASH.test(runtimeAclEvidence?.checker_sha256), 'RUNTIME_ACL_CHECKER_UNVERIFIED');
  }
  mkdirSync(directory, { recursive: true });
  rejectReparseComponents(directory);
  const lock = acquireStoreLock(directory, { isOwnerAlive });
  const statePath = resolve(directory, 'state.json');
  const eventPath = resolve(directory, 'events.ndjson');
  const seed = initialState({ projectId, rootTaskId });
  let events;
  let state;
  let poisoned = false;
  try {
    events = readEventLog(eventPath);
    state = replayEvents(events, seed);
    if (existsSync(statePath)) {
      const disk = JSON.parse(readFileSync(statePath, 'utf8'));
      validateIdentifiers(disk);
      if (disk.last_sequence === state.last_sequence && canonicalHash(disk) !== canonicalHash(state)) {
        throw new Error('STATE_LOG_DIVERGENCE');
      }
      if (disk.last_sequence > state.last_sequence) throw new Error('STATE_AHEAD_OF_APPEND_ONLY_LOG');
      if (disk.last_sequence < state.last_sequence) {
        const prefix = events[disk.last_sequence - 1];
        requireValue(disk.last_sequence === 0 || prefix?.event_hash === disk.last_event_hash, 'STATE_NOT_LOG_PREFIX');
        atomicWrite(statePath, `${canonicalJson(state)}\n`);
      }
    } else {
      atomicWrite(statePath, `${canonicalJson(state)}\n`);
    }
  } catch (error) {
    const quarantined = [quarantine(statePath), quarantine(eventPath)].filter(Boolean);
    lock.release();
    const wrapped = new Error(`STORE_CORRUPT_QUARANTINED:${error.message}`);
    wrapped.quarantined = quarantined;
    throw wrapped;
  }

  function commit(type, eventId, expectedRevision, mutator, payload = {}) {
    requireValue(poisoned === false, 'STORE_RECOVERY_REQUIRED');
    requireValue(typeof eventId === 'string' && eventId.length > 0, 'INVALID_EVENT_ID');
    requireValue(Number.isSafeInteger(expectedRevision) && expectedRevision === state.revision, 'REVISION_CAS_FAILED');
    validateIdentifiers(payload);
    const next = clone(state);
    mutator(next);
    next.revision = state.revision + 1;
    next.last_sequence = state.last_sequence + 1;
    const event = {
      schema_version: 1,
      sequence: next.last_sequence,
      previous_hash: state.last_event_hash,
      event_id: eventId,
      type,
      payload: clone(payload),
      next_state: next,
    };
    event.event_hash = eventHash(event);
    next.last_event_hash = event.event_hash;
    event.next_state = clone(next);
    requireValue(eventHash(event) === event.event_hash, 'EVENT_HASH_CONSTRUCTION_FAILED');
    try {
      appendDurable(eventPath, `${canonicalJson(event)}\n`);
      faultInjector('AFTER_EVENT_APPEND_BEFORE_STATE_PUBLISH', clone(event));
      atomicWrite(statePath, `${canonicalJson(next)}\n`);
    } catch (error) {
      poisoned = true;
      try { lock.release(); } catch {}
      throw new Error(`STORE_COMMIT_RECOVERY_REQUIRED:${error.message}`);
    }
    state = next;
    events.push(clone(event));
    return clone(state);
  }

  function assertFence({ expectedRevision, expectedDagRevision, rootTaskId: suppliedRoot, runGeneration, stopEpoch }) {
    requireValue(expectedRevision === state.revision, 'REVISION_CAS_FAILED');
    requireValue(expectedDagRevision === state.dag_revision, 'STALE_DAG_REJECTED');
    requireValue(suppliedRoot === state.root_task_id, 'ROOT_TASK_FENCE_REQUIRED');
    requireValue(runGeneration === state.run_generation, 'STALE_GENERATION_AUDIT_ONLY');
    requireValue(stopEpoch === state.stop_epoch, 'STOP_EPOCH_MISMATCH');
    requireValue(state.stopped === false, 'STOP_FENCE_CLOSED');
    return true;
  }

  function getIntent(intentKey) {
    requireValue(typeof intentKey === 'string' && intentKey.length > 0, 'INVALID_INTENT_KEY');
    return clone(state.outbox[intentKey] ?? null);
  }

  return Object.freeze({
    directory,
    statePath,
    eventPath,
    snapshot: () => clone(state),
    events: () => clone(events),
    getIntent,
    assertDispatchFence: assertFence,
    persistIntent({ eventId, expectedRevision, identity, payload }) {
      const intentKey = intentKeyOf(identity);
      const payloadHash = canonicalHash(payload);
      const existing = state.outbox[intentKey];
      if (existing) {
        requireValue(existing.payload_hash === payloadHash, 'INTENT_CONFLICT');
        return clone(existing);
      }
      commit('INTENT_PERSISTED', eventId, expectedRevision, (next) => {
        next.outbox[intentKey] = {
          intent_key: intentKey,
          payload_hash: payloadHash,
          identity: clone(identity),
          payload: clone(payload),
          state: 'INTENT_PERSISTED',
          route_id: null,
          delivery_token: null,
          attempts: 0,
          terminal: false,
        };
      }, { intent_key: intentKey, identity, payload });
      return getIntent(intentKey);
    },
    recordPrepared({ eventId, expectedRevision, intentKey, routeId, deliveryToken }) {
      requireValue(typeof routeId === 'string' && routeId.length > 0, 'INVALID_ROUTE_ID');
      requireValue(typeof deliveryToken === 'string' && deliveryToken.length > 0, 'INVALID_DELIVERY_TOKEN');
      return commit('PREPARED_RESULT_PERSISTED', eventId, expectedRevision, (next) => {
        const item = next.outbox[intentKey];
        requireValue(item?.state === 'INTENT_PERSISTED', 'PREPARE_WITHOUT_PERSISTED_INTENT');
        item.state = 'PREPARED';
        item.route_id = routeId;
        item.delivery_token = deliveryToken;
      }, { intent_key: intentKey, route_id: routeId, delivery_token: deliveryToken });
    },
    recordDelivery({ eventId, expectedRevision, intentKey, nextState, attemptIncrement = 0 }) {
      const allowed = ['SEND_ATTEMPTED', 'SENT', 'UNKNOWN_DELIVERY', 'RETRY_READY', 'REJECTED', 'ACKNOWLEDGED', 'COMPLETED'];
      requireValue(allowed.includes(nextState), 'INVALID_DELIVERY_STATE');
      return commit(`DELIVERY_${nextState}`, eventId, expectedRevision, (next) => {
        const item = next.outbox[intentKey];
        requireValue(item, 'INTENT_NOT_FOUND');
        requireValue(item.terminal === false, 'TERMINAL_DELIVERY');
        item.state = nextState;
        item.attempts += attemptIncrement;
        if (['REJECTED', 'COMPLETED'].includes(nextState)) item.terminal = true;
      }, { intent_key: intentKey, next_state: nextState });
    },
    claimEffect({ eventId, expectedRevision, expectedDagRevision, rootTaskId: root, runGeneration, stopEpoch, taskId, effectKey }) {
      assertFence({ expectedRevision, expectedDagRevision, rootTaskId: root, runGeneration, stopEpoch });
      requireValue(typeof taskId === 'string' && taskId.length > 0, 'INVALID_TASK_ID');
      requireValue(typeof effectKey === 'string' && effectKey.length > 0, 'INVALID_EFFECT_KEY');
      const key = `${taskId}\0${effectKey}`;
      requireValue(!state.effects[key], 'DUPLICATE_EFFECT');
      return commit('EFFECT_CLAIMED', eventId, expectedRevision, (next) => {
        next.effects[key] = { task_id: taskId, effect_key: effectKey, run_generation: runGeneration };
      }, { task_id: taskId, effect_key: effectKey });
    },
    advanceDag({ eventId, expectedRevision, expectedDagRevision }) {
      requireValue(expectedDagRevision === state.dag_revision, 'DAG_REVISION_CAS_FAILED');
      return commit('DAG_REVISION_ADVANCED', eventId, expectedRevision, (next) => { next.dag_revision += 1; }, {
        dag_revision: expectedDagRevision,
      });
    },
    stopRoot({ eventId, expectedRevision, rootTaskId: root, newStopEpoch }) {
      requireValue(root === state.root_task_id, 'CHILD_STOP_EPOCH_REJECTED');
      requireValue(newStopEpoch === state.stop_epoch + 1, 'INVALID_ROOT_STOP_EPOCH');
      return commit('ROOT_STOPPED', eventId, expectedRevision, (next) => {
        next.stop_epoch = newStopEpoch;
        next.stopped = true;
      }, { task_id: root, stop_epoch: newStopEpoch });
    },
    resumeRoot({ eventId, expectedRevision, rootTaskId: root, expectedRunGeneration, newRunGeneration, newStopEpoch }) {
      requireValue(root === state.root_task_id, 'ROOT_TASK_FENCE_REQUIRED');
      requireValue(state.stopped === true, 'RESUME_REQUIRES_STOPPED_ROOT');
      requireValue(expectedRunGeneration === state.run_generation, 'RUN_GENERATION_CAS_FAILED');
      requireValue(newRunGeneration === state.run_generation + 1, 'INVALID_NEW_RUN_GENERATION');
      requireValue(newStopEpoch === state.stop_epoch + 1, 'INVALID_ROOT_STOP_EPOCH');
      return commit('ROOT_RESUMED', eventId, expectedRevision, (next) => {
        next.generation_audit.push({ run_generation: next.run_generation, disposition: 'AUDIT_ONLY' });
        next.run_generation = newRunGeneration;
        next.stop_epoch = newStopEpoch;
        next.stopped = false;
      }, { task_id: root, run_generation: newRunGeneration, stop_epoch: newStopEpoch });
    },
    classifyResult({ runGeneration }) {
      requireValue(Number.isSafeInteger(runGeneration) && runGeneration >= 0, 'INVALID_RUN_GENERATION');
      return runGeneration === state.run_generation ? 'CURRENT' : 'AUDIT_ONLY';
    },
    close: () => lock.release(),
  });
}
