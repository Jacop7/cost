import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntakeService, NON_HUMAN_ROLE_IDS } from './team-service-intake.mjs';
import { roles } from './team-routing-contract-audit.mjs';

const intake = () => createIntakeService({
  allowedScopes: ['LOCAL_P3'],
  authorizeRequest: (request) => request.logical_source === roles.human,
  createTask: (request) => ({ task_id: `TASK-${request.request_id}`, work_spec_revision: request.work_spec_revision }),
});
const request = (overrides = {}) => ({
  request_id: 'REQ-01',
  request_kind: 'REQUEST',
  logical_source: roles.human,
  requested_scope: 'LOCAL_P3',
  work_spec_revision: 1,
  payload: { task_pointer: 'TASK:REQ-01' },
  ...overrides,
});

test('AC-01 service contract', () => {
  const service = intake();
  const question = service.receive(request({ request_id: 'QUESTION-01', request_kind: 'QUESTION' }));
  assert.equal(question.disposition, 'RETURN_ANSWER_WITHOUT_TASK_OR_SEND');
  assert.equal(question.task, null);
  assert.equal(question.send_attempts, 0);

  const ambiguous = service.receive(request({ request_id: 'AMBIGUOUS-01', request_kind: 'AMBIGUOUS' }));
  assert.equal(ambiguous.disposition, 'HOLD_FOR_HUMAN_CLARIFICATION');
  assert.equal(ambiguous.task, null);

  assert.throws(() => service.receive(request({ request_id: 'DENIED-SCOPE', requested_scope: 'P4' })), /REQUEST_SCOPE_NOT_ALLOWED/);
  assert.throws(() => service.receive(request({ request_id: 'DENIED-ACTOR', logical_source: roles.master })), /REQUEST_AUTHORITY_NOT_VERIFIED/);
  const created = service.receive(request());
  assert.equal(created.task.task_id, 'TASK-REQ-01');
  assert.equal(created.execution_authorized, false);
  assert.equal(service.receive(request()).task.task_id, 'TASK-REQ-01');
  assert.throws(() => service.receive(request({ payload: { task_pointer: 'TASK:CHANGED' } })), /REQUEST_CONFLICT_HOLD/);
  assert.deepEqual(service.metrics(), {
    request_count: 3,
    task_count: 1,
    report_count: 0,
    required_report_count: 10,
    all_reports_non_authorizing: true,
    send_attempts: 0,
  });
});

test('AC-06 service contract', () => {
  const service = intake();
  assert.equal(NON_HUMAN_ROLE_IDS.length, 10);
  for (const [index, role] of NON_HUMAN_ROLE_IDS.entries()) {
    const result = service.receive(request({
      request_id: `REPORT-${String(index + 1).padStart(2, '0')}`,
      request_kind: 'REPORT',
      logical_source: role,
      requested_scope: 'STATUS_ONLY',
      payload: { status_pointer: `ARTIFACT:STATUS-${index + 1}` },
    }));
    assert.equal(result.disposition, 'RECORD_NON_AUTHORIZING_STATUS_ONLY');
    assert.equal(result.execution_authorized, false);
    assert.equal(result.task, null);
  }
  const metrics = service.metrics();
  assert.equal(metrics.report_count, 10);
  assert.equal(metrics.required_report_count, 10);
  assert.equal(metrics.all_reports_non_authorizing, true);
  assert.equal(metrics.task_count, 0);
  assert.equal(metrics.send_attempts, 0);
  assert.throws(() => service.receive(request({
    request_id: 'REPORT-HUMAN', request_kind: 'REPORT', logical_source: roles.human,
  })), /INVALID_REPORTER/);
});
