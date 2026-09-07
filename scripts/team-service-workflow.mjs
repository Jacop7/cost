import { roles, teams } from './team-routing-contract-audit.mjs';
import { canonicalHash as hash } from './team-service-canonical.mjs';

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
    revision: 0, status: 'READY', leg: 0, activeDeliveryToken: null,
    legs: kinds.map((kind, index) => ({ source: path[index], target: path[index + 1], kind })),
    seen: {}, receipts: [], resultPointer: null, blocker: null,
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

export function applyServiceEvent(state, event, { verifyReceipt } = {}) {
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
  requireValue(!['COMPLETED', 'STOPPED', 'REJECTED'].includes(state.status), 'TERMINAL_WORKFLOW');
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
      next.blocker = { source: event.actor, target: roles.human, kind: 'DECISION_POINTER', evidencePointer: event.evidencePointer };
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
