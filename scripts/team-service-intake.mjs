import { roles, teams } from './team-routing-contract-audit.mjs';
import { canonicalHash } from './team-service-canonical.mjs';

export const INTAKE_KINDS = Object.freeze(['QUESTION', 'AMBIGUOUS', 'REQUEST', 'REPORT']);
export const NON_HUMAN_ROLE_IDS = Object.freeze(
  [...Object.values(roles), ...teams].filter((role) => role !== roles.human),
);

const requestIdPattern = /^[A-Z][A-Z0-9_-]{0,100}$/;
const requiredFields = Object.freeze([
  'request_id',
  'request_kind',
  'logical_source',
  'requested_scope',
  'work_spec_revision',
  'payload',
]);

function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}

function normalize(input) {
  requireValue(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INTAKE');
  requireValue(
    JSON.stringify(Object.keys(input).sort()) === JSON.stringify([...requiredFields].sort()),
    'INVALID_INTAKE_FIELDS',
  );
  requireValue(typeof input.request_id === 'string' && requestIdPattern.test(input.request_id), 'INVALID_REQUEST_ID');
  requireValue(INTAKE_KINDS.includes(input.request_kind), 'INVALID_REQUEST_KIND');
  requireValue(typeof input.logical_source === 'string' && input.logical_source.length > 0, 'INVALID_LOGICAL_SOURCE');
  requireValue(typeof input.requested_scope === 'string' && input.requested_scope.length > 0, 'INVALID_REQUEST_SCOPE');
  requireValue(Number.isSafeInteger(input.work_spec_revision) && input.work_spec_revision >= 0, 'INVALID_WORK_SPEC_REVISION');
  requireValue(input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload), 'INVALID_PAYLOAD');
  return structuredClone(input);
}

export function createIntakeService({ allowedScopes = [], authorizeRequest, createTask } = {}) {
  requireValue(Array.isArray(allowedScopes) && allowedScopes.every((scope) => typeof scope === 'string'), 'INVALID_ALLOWED_SCOPES');
  requireValue(typeof authorizeRequest === 'function', 'AUTHORIZE_REQUEST_REQUIRED');
  requireValue(typeof createTask === 'function', 'CREATE_TASK_REQUIRED');
  const allowed = new Set(allowedScopes);
  const byRequest = new Map();
  const reports = new Map();
  let taskCount = 0;
  let sendAttempts = 0;

  const existingOrConflict = (request, fingerprint) => {
    const existing = byRequest.get(request.request_id);
    if (!existing) return null;
    requireValue(existing.fingerprint === fingerprint, 'REQUEST_CONFLICT_HOLD');
    return structuredClone(existing.result);
  };

  function receive(raw) {
    const request = normalize(raw);
    const fingerprint = canonicalHash(request);
    const existing = existingOrConflict(request, fingerprint);
    if (existing) return existing;

    let result;
    switch (request.request_kind) {
      case 'QUESTION':
        result = {
          request_id: request.request_id,
          disposition: 'RETURN_ANSWER_WITHOUT_TASK_OR_SEND',
          task: null,
          execution_authorized: false,
          send_attempts: 0,
        };
        break;
      case 'AMBIGUOUS':
        result = {
          request_id: request.request_id,
          disposition: 'HOLD_FOR_HUMAN_CLARIFICATION',
          task: null,
          execution_authorized: false,
          send_attempts: 0,
        };
        break;
      case 'REPORT':
        requireValue(NON_HUMAN_ROLE_IDS.includes(request.logical_source), 'INVALID_REPORTER');
        reports.set(request.logical_source, {
          request_id: request.request_id,
          source: request.logical_source,
          payload_hash: canonicalHash(request.payload),
          work_spec_revision: request.work_spec_revision,
          execution_authorized: false,
        });
        result = {
          request_id: request.request_id,
          disposition: 'RECORD_NON_AUTHORIZING_STATUS_ONLY',
          task: null,
          execution_authorized: false,
          send_attempts: 0,
        };
        break;
      case 'REQUEST': {
        requireValue(allowed.has(request.requested_scope), 'REQUEST_SCOPE_NOT_ALLOWED');
        requireValue(authorizeRequest(structuredClone(request)) === true, 'REQUEST_AUTHORITY_NOT_VERIFIED');
        const task = createTask(structuredClone(request));
        requireValue(task && typeof task === 'object' && typeof task.task_id === 'string', 'INVALID_CREATED_TASK');
        taskCount += 1;
        result = {
          request_id: request.request_id,
          disposition: 'CREATE_TASK_ONLY_AFTER_SCHEMA_SCOPE_AND_AUTHORITY_CHECKS',
          task: structuredClone(task),
          execution_authorized: false,
          send_attempts: 0,
        };
        break;
      }
      default:
        throw new Error('INVALID_REQUEST_KIND');
    }
    byRequest.set(request.request_id, { fingerprint, result: structuredClone(result) });
    return structuredClone(result);
  }

  return Object.freeze({
    receive,
    metrics: () => Object.freeze({
      request_count: byRequest.size,
      task_count: taskCount,
      report_count: reports.size,
      required_report_count: NON_HUMAN_ROLE_IDS.length,
      all_reports_non_authorizing: [...reports.values()].every((report) => report.execution_authorized === false),
      send_attempts: sendAttempts,
    }),
    reports: () => structuredClone([...reports.values()]),
  });
}
