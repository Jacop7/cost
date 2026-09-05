import assert from 'node:assert/strict';
import test from 'node:test';
import { auditRoutingCoverage, roles, teams } from './team-routing-contract-audit.mjs';

function fixture() {
  const ids = [...Object.values(roles), ...teams];
  const manifests = ids.map((chat_id) => ({ chat_id, accepts_from: [], sends_to: [], route_edges: [] }));
  function edge(source, target, kinds) {
    const from = manifests.find((item) => item.chat_id === source);
    const to = manifests.find((item) => item.chat_id === target);
    if (!from.sends_to.includes(target)) from.sends_to.push(target);
    if (!to.accepts_from.includes(source)) to.accepts_from.push(source);
    from.route_edges.push(`${target}|${kinds.join(',')}`);
  }
  edge(roles.human, roles.master, ['REQUEST']);
  edge(roles.master, roles.deputy, ['TASK_DISPATCH']);
  edge(roles.deputy, roles.room, ['VERIFIED_STATUS']);
  edge(roles.room, roles.deputy, ['AGGREGATE_RESULT']);
  edge(roles.deputy, roles.master, ['AGGREGATE_RESULT']);
  edge(roles.master, roles.human, ['AGGREGATE_RESULT']);
  for (const team of teams) {
    edge(roles.deputy, team, ['TASK_DISPATCH']);
    edge(team, roles.deputy, ['TASK_RESULT']);
    edge(roles.master, team, ['TASK_DISPATCH']);
    edge(team, roles.master, ['TASK_RESULT']);
    edge(team, roles.room, ['VERIFIED_STATUS']);
    for (const peer of teams.filter((id) => id !== team)) edge(team, peer, ['COLLAB_REQUEST', 'COLLAB_RESULT']);
  }
  for (const role of ids.filter((id) => id !== roles.human)) edge(role, roles.human, ['DECISION_POINTER']);
  edge(roles.deputy, teams[3], ['REVIEW_REQUEST']);
  edge(teams[3], roles.deputy, ['REVIEW_RESULT']);
  return manifests;
}

test('static coverage never claims activation or service delivery', () => {
  const result = auditRoutingCoverage(fixture());
  assert.equal(result.status, 'STATIC_COVERAGE_ONLY');
  assert.equal(result.serviceReady, false);
  assert.equal(result.messageSent, false);
  assert.equal(result.findings.length, 0);
});

test('room is not a mandatory assignment hop; deputy dispatch remains required', () => {
  const manifests = fixture();
  assert(!manifests.find((item) => item.chat_id === roles.room).route_edges.some((edge) => edge.includes('TASK_DISPATCH')));
  assert.equal(auditRoutingCoverage(manifests).findings.length, 0);
  const deputy = manifests.find((item) => item.chat_id === roles.deputy);
  deputy.route_edges = deputy.route_edges.filter((edge) => !edge.startsWith(teams[0] + '|'));
  assert(auditRoutingCoverage(manifests).findings.some((item) => item.code === 'TEAM_ASSIGNMENT_MISSING'));
});

test('peer consultation needs both request and response kinds', () => {
  const manifests = fixture();
  manifests.find((item) => item.chat_id === teams[0]).route_edges =
    manifests.find((item) => item.chat_id === teams[0]).route_edges
      .map((edge) => edge.replace('COLLAB_REQUEST,COLLAB_RESULT', 'COLLAB_REQUEST'));
  assert.equal(auditRoutingCoverage(manifests).findings.filter((item) => item.code === 'PEER_COLLABORATION_MISSING').length, 4);
});

test('escalation must be accepted by the human intake, not merely declared by sender', () => {
  const manifests = fixture();
  manifests.find((item) => item.chat_id === roles.human).accepts_from = [roles.master];
  assert.equal(auditRoutingCoverage(manifests).findings.filter((item) => item.code === 'DIRECT_ESCALATION_MISSING').length, 9);
});

test('generic task result does not substitute for independent quality review result', () => {
  const manifests = fixture();
  const quality = manifests.find((item) => item.chat_id === teams[3]);
  quality.route_edges = quality.route_edges.filter((edge) => !edge.includes('REVIEW_RESULT'));
  assert(auditRoutingCoverage(manifests).findings.some((item) => item.code === 'QUALITY_RESULT_MISSING'));
});

test('missing, duplicate and malformed roles fail coverage', () => {
  assert.equal(auditRoutingCoverage([]).status, 'REQUIREMENTS_NOT_MET');
  assert(auditRoutingCoverage([...fixture(), fixture()[0]]).findings.some((item) => item.code === 'INVALID_OR_DUPLICATE_ROLE'));
  const manifests = fixture();
  manifests[0].route_edges = 'not-an-array';
  assert(auditRoutingCoverage(manifests).findings.some((item) => item.code === 'INVALID_ROUTE_FIELDS'));
});
