import { roles, teams } from './team-routing-contract-audit.mjs';
import { canonicalHash as hash } from './team-service-canonical.mjs';
import { effectKeyOf } from './team-service-intent-store.mjs';

// A deterministic foreground workflow reducer, not a transport or approval engine.
// The adapter must validate the sealed router contract and real receipts. No IDs
// for provider threads, raw conversations, or credentials belong in this state.
const idPattern = /^[A-Z][A-Z0-9_-]{0,100}$/;
const evidencePattern = /^(TASK|ARTIFACT|RECEIPT):[A-Za-z0-9_.:/#-]{1,240}$/;
function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}
function requireId(value, code) {
  requireValue(typeof value === 'string' && idPattern.test(value), code);
}
function requireActor(value) {
  requireValue(typeof value === 'string', 'INVALID_ACTOR');
}

function requireDecision(state, event, decision, verifyDecision, nowMs) {
  requireValue(decision && typeof decision === 'object' && !Array.isArray(decision), 'HUMAN_DECISION_REQUIRED');
  requireValue(typeof verifyDecision === 'function'
    && verifyDecision({ state, event, decision }) === true, 'HUMAN_DECISION_NOT_VERIFIED');
  requireValue(decision.actor === roles.human, 'HUMAN_DECISION_REQUIRED');
  requireValue(decision.taskId === state.taskId && decision.correlationId === state.correlationId, 'DECISION_SCOPE_MISMATCH');
  requireValue(decision.expectedRevision === state.revision, 'DECISION_REVISION_CONFLICT');
  requireValue(decision.revoked === false, 'DECISION_REVOKED');
  const expiresAt = Date.parse(decision.expiresAt);
  requireValue(Number.isFinite(expiresAt) && expiresAt > nowMs, 'DECISION_EXPIRED');
}

export function createServiceWorkflow({ taskId, correlationId, team, taskPointer }) {
  requireId(taskId, 'INVALID_TASK_ID');
  requireId(correlationId, 'INVALID_CORRELATION_ID');
  requireValue(typeof team === 'string' && teams.includes(team), 'INVALID_TEAM');
  requireValue(typeof taskPointer === 'string' && evidencePattern.test(taskPointer), 'INVALID_TASK_POINTER');
  // The situation room is a status consumer, not a mandatory dispatch hop.
  const path = [roles.human, roles.master, roles.deputy, team, roles.deputy, roles.master, roles.human];
  const kinds = ['REQUEST', 'TASK_DISPATCH', 'TASK_DISPATCH', 'TASK_RESULT', 'AGGREGATE_RESULT', 'AGGREGATE_RESULT'];
  return {
    schemaVersion: 1, taskId, correlationId, taskPointer, team,
    revision: 0, workSpecRevision: 0, runGeneration: 0,
    status: 'READY', leg: 0, activeDeliveryToken: null,
    legs: kinds.map((kind, index) => ({ source: path[index], target: path[index + 1], kind })),
    seen: {}, receipts: [], resultPointer: null, blocker: null,
    assignmentEffects: [], generationAudit: [], blockerSequence: 0,
  };
}

export function nextServiceAction(state, actor) {
  requireId(state?.taskId, 'INVALID_TASK_ID');
  requireId(state?.correlationId, 'INVALID_CORRELATION_ID');
  requireActor(actor);
  if (['COMPLETED', 'STOPPED', 'REJECTED'].includes(state.status)) return { type: 'TERMINAL', status: state.status };
  if (state.status === 'BLOCKED') {
    if (actor !== state.blocker.source) return { type: 'WAIT_FOR_ACTOR', logicalActor: state.blocker.source };
    return { type: 'REPORT_BLOCKER', ...state.blocker, requiresRouterValidation: true };
  }
  const leg = state.legs[state.leg];
  if (state.status !== 'READY') return { type: 'WAIT_FOR_RECEIPT', deliveryToken: state.activeDeliveryToken };
  if (actor !== leg.source) return { type: 'WAIT_FOR_ACTOR', logicalActor: leg.source };
  return {
    type: 'PREPARE_ROUTE', ...leg, taskId: state.taskId, correlationId: state.correlationId,
    payload: { task_pointer: state.taskPointer, result_pointer: state.resultPointer, workflow_leg: state.leg },
    // Only direction, never execution permission. prepare-dispatch still enforces
    // caller endpoint, mission, activation, kind, scope, lock and dedupe.
    childRoutesNeeded: state.leg < state.legs.length - 1,
    requiresRouterValidation: true,
  };
}

export function applyServiceEvent(state, event, { verifyReceipt, verifyDecision, nowMs = Date.now() } = {}) {
  requireValue(event && typeof event === 'object' && !Array.isArray(event), 'INVALID_EVENT');
  requireId(state?.taskId, 'INVALID_TASK_ID');
  requireId(state?.correlationId, 'INVALID_CORRELATION_ID');
  requireId(event.eventId, 'INVALID_EVENT_ID');
  requireId(event.taskId, 'INVALID_TASK_ID');
  requireId(event.correlationId, 'INVALID_CORRELATION_ID');
  requireActor(event.actor);
  const fingerprint = hash(event);
  if (Object.hasOwn(state.seen, event.eventId)) {
    requireValue(state.seen[event.eventId] === fingerprint, 'EVENT_ID_CONFLICT');
    return state;
  }
  requireValue(event.expectedRevision === state.revision, 'REVISION_CONFLICT');
  requireValue(event.taskId === state.taskId && event.correlationId === state.correlationId, 'TASK_SCOPE_MISMATCH');
  requireValue(!['COMPLETED', 'STOPPED', 'REJECTED'].includes(state.status)
    || event.type === 'HUMAN_RESUME', 'TERMINAL_WORKFLOW');
  requireValue(state.receipts.length < 100, 'EVENT_LIMIT_REQUIRES_CHECKPOINT');
  requireValue(typeof event.evidencePointer === 'string' && evidencePattern.test(event.evidencePointer), 'EVIDENCE_REQUIRED');
  const leg = state.legs[state.leg];
  requireValue(typeof verifyReceipt === 'function'
    && verifyReceipt({ state, event, leg }) === true, 'RECEIPT_NOT_VERIFIED');
  const next = structuredClone(state);
  switch (event.type) {
    case 'TOOL_ACCEPTED':
      requireValue(state.status === 'READY' && event.actor === leg.source, 'INVALID_SEND_STATE');
      requireValue(typeof event.deliveryToken === 'string' && /^DELIVERY-[A-Za-z0-9-]{1,100}$/.test(event.deliveryToken), 'DELIVERY_TOKEN_REQUIRED');
      requireValue(!state.receipts.some((receipt) => receipt.type === 'TOOL_ACCEPTED'
        && receipt.deliveryToken === event.deliveryToken), 'DELIVERY_TOKEN_REUSED');
      next.activeDeliveryToken = event.deliveryToken;
      next.status = 'SENT_UNCONFIRMED';
      break;
    case 'ACK':
      requireValue(state.status === 'SENT_UNCONFIRMED' && event.actor === leg.target, 'INVALID_ACK_STATE');
      requireValue(event.deliveryToken === state.activeDeliveryToken, 'DELIVERY_TOKEN_MISMATCH');
      next.status = 'ACKNOWLEDGED';
      break;
    case 'LEG_COMPLETED':
      requireValue(state.status === 'ACKNOWLEDGED' && event.actor === leg.target, 'INVALID_RESULT_STATE');
      requireValue(event.deliveryToken === state.activeDeliveryToken, 'DELIVERY_TOKEN_MISMATCH');
      requireValue(typeof event.resultPointer === 'string' && evidencePattern.test(event.resultPointer), 'RESULT_POINTER_REQUIRED');
      next.resultPointer = event.resultPointer;
      next.leg += 1;
      next.activeDeliveryToken = null;
      next.status = next.leg === next.legs.length ? 'COMPLETED' : 'READY';
      break;
    case 'REJECTED':
      requireValue(['SENT_UNCONFIRMED', 'ACKNOWLEDGED'].includes(state.status)
        && event.actor === leg.target && event.deliveryToken === state.activeDeliveryToken, 'INVALID_REJECTION');
      next.status = 'REJECTED';
      break;
    case 'BLOCKED':
      requireValue(state.status !== 'BLOCKED' && [leg.source, leg.target].includes(event.actor), 'INVALID_BLOCKER');
      next.status = 'BLOCKED';
      next.blockerSequence += 1;
      next.blocker = {
        blockerId: `BLOCKER-${next.blockerSequence}`,
        source: event.actor,
        owner: event.actor,
        target: roles.human,
        kind: 'DECISION_POINTER',
        status: 'OPEN',
        revision: 0,
        evidencePointer: event.evidencePointer,
      };
      break;
    case 'BLOCKER_REPORTED':
      requireValue(state.status === 'BLOCKED' && state.blocker?.status === 'OPEN', 'INVALID_BLOCKER_REPORT');
      requireValue(event.actor === state.blocker.owner, 'BLOCKER_OWNER_REQUIRED');
      requireValue(event.blockerId === state.blocker.blockerId, 'BLOCKER_ID_MISMATCH');
      requireValue(event.expectedBlockerRevision === state.blocker.revision, 'BLOCKER_REVISION_CONFLICT');
      next.blocker.revision += 1;
      break;
    case 'BLOCKER_RESOLVED':
    case 'BLOCKER_SUPERSEDED':
      requireValue(state.status === 'BLOCKED' && state.blocker?.status === 'OPEN', 'INVALID_BLOCKER_RESOLUTION');
      requireValue(event.actor === state.blocker.owner, 'BLOCKER_OWNER_REQUIRED');
      requireValue(event.blockerId === state.blocker.blockerId, 'BLOCKER_ID_MISMATCH');
      requireValue(event.expectedBlockerRevision === state.blocker.revision, 'BLOCKER_REVISION_CONFLICT');
      requireDecision(state, event, event.decision, verifyDecision, nowMs);
      requireValue(event.decision.blockerId === state.blocker.blockerId, 'DECISION_BLOCKER_MISMATCH');
      requireValue(event.decision.action === (event.type === 'BLOCKER_RESOLVED' ? 'RESOLVE' : 'SUPERSEDE'), 'DECISION_ACTION_MISMATCH');
      next.blocker.status = event.type === 'BLOCKER_RESOLVED' ? 'RESOLVED' : 'SUPERSEDED';
      next.blocker.revision += 1;
      next.status = 'READY';
      break;
    case 'ASSIGNMENT_EFFECT': {
      requireValue([roles.master, roles.deputy].includes(event.actor), 'ASSIGNMENT_ACTOR_REQUIRED');
      const effectKey = effectKeyOf({
        task_id: state.taskId,
        subtask_id: event.subtaskId,
        work_spec_revision: state.workSpecRevision,
        effect_kind: event.effectKind,
      });
      requireValue(!state.assignmentEffects.some((effect) => effect.effectKey === effectKey), 'DUPLICATE_ASSIGNMENT_EFFECT');
      next.assignmentEffects.push({
        effectKey,
        subtaskId: event.subtaskId,
        workSpecRevision: state.workSpecRevision,
        effectKind: event.effectKind,
        actor: event.actor,
      });
      break;
    }
    case 'RETRY':
      requireValue(state.status === 'SENT_UNCONFIRMED', 'INVALID_RETRY_STATE');
      requireValue(event.runGeneration === state.runGeneration, 'RUN_GENERATION_MISMATCH');
      requireValue(event.deliveryToken === state.activeDeliveryToken, 'DELIVERY_TOKEN_MISMATCH');
      break;
    case 'AMEND':
      requireValue(event.actor === roles.human, 'HUMAN_DECISION_REQUIRED');
      requireValue(event.expectedWorkSpecRevision === state.workSpecRevision, 'WORK_SPEC_REVISION_CONFLICT');
      requireValue(event.newWorkSpecRevision === state.workSpecRevision + 1, 'INVALID_NEW_WORK_SPEC_REVISION');
      requireDecision(state, event, event.decision, verifyDecision, nowMs);
      requireValue(event.decision.action === 'AMEND', 'DECISION_ACTION_MISMATCH');
      next.workSpecRevision = event.newWorkSpecRevision;
      break;
    case 'HUMAN_RESUME':
      requireValue(event.actor === roles.human, 'HUMAN_DECISION_REQUIRED');
      requireDecision(state, event, event.decision, verifyDecision, nowMs);
      requireValue(event.decision.action === 'RESUME', 'DECISION_ACTION_MISMATCH');
      if (state.blocker?.status === 'OPEN') {
        requireValue(event.decision.blockerId === state.blocker.blockerId, 'DECISION_BLOCKER_MISMATCH');
        next.blocker.status = 'SUPERSEDED';
        next.blocker.revision += 1;
      }
      next.generationAudit.push({ runGeneration: state.runGeneration, result: 'AUDIT_ONLY' });
      next.runGeneration += 1;
      next.activeDeliveryToken = null;
      next.status = 'READY';
      break;
    case 'HUMAN_STOP':
      // The adapter must verify an actual human decision; a role name is not proof.
      requireValue(event.actor === roles.human, 'HUMAN_DECISION_REQUIRED');
      next.status = 'STOPPED';
      break;
    default:
      throw new Error('UNSUPPORTED_EVENT');
  }
  next.revision += 1;
  next.seen[event.eventId] = fingerprint;
  next.receipts.push({ type: event.type, leg: state.leg, evidencePointer: event.evidencePointer,
    deliveryToken: event.deliveryToken ?? null });
  return next;
}
