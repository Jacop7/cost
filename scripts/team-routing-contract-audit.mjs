import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter } from './docs-graph-check.mjs';

// Read-only requirement coverage, NOT routing permission or a delivery verifier.
// Keep separate from the currently sealed v2 graph until a reviewed migration.
export const roles = Object.freeze({
  human: 'MASTER-01-HUMAN-DECISIONS',
  master: 'MASTER-02-ORCHESTRATION',
  deputy: 'MASTER-03-DEPUTY-CONTEXT',
  room: 'DEPARTMENT-00-ALL-TEAMS-ROOM',
  staging: 'MASTER-04-DEVELOPMENT-STAGING',
  production: 'MASTER-05-PRODUCTION-RECOVERY',
});
export const teams = Object.freeze([
  'DEPARTMENT-01-PRODUCT-MOBILE', 'DEPARTMENT-02-DATA-BACKEND',
  'DEPARTMENT-03-SERVER-OPERATIONS', 'DEPARTMENT-04-QUALITY-REVIEW',
  'DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION',
]);
const expectedIds = [...Object.values(roles), ...teams];

export function auditRoutingCoverage(manifests) {
  const byId = new Map();
  const findings = [];
  const add = (code, source = null, target = null, kinds = []) =>
    findings.push({ code, source, target, kinds });
  for (const manifest of manifests) {
    if (!expectedIds.includes(manifest.chat_id) || byId.has(manifest.chat_id)) {
      add('INVALID_OR_DUPLICATE_ROLE');
      continue;
    }
    const arrays = ['accepts_from', 'sends_to', 'route_edges'];
    if (arrays.some((field) => !Array.isArray(manifest[field])
      || manifest[field].some((entry) => typeof entry !== 'string'))) {
      add('INVALID_ROUTE_FIELDS', manifest.chat_id);
      continue;
    }
    byId.set(manifest.chat_id, manifest);
  }
  for (const id of expectedIds) if (!byId.has(id)) add('MISSING_ROLE', id);
  function requireEdge(code, source, target, kinds) {
    const from = byId.get(source);
    const to = byId.get(target);
    const granted = new Set((from?.route_edges ?? []).flatMap((edge) => {
      const parts = edge.split('|');
      return parts.length === 2 && parts[0] === target ? parts[1].split(',') : [];
    }));
    if (!from?.sends_to.includes(target) || !to?.accepts_from.includes(source)
      || kinds.some((kind) => !granted.has(kind))) add(code, source, target, kinds);
  }
  requireEdge('INTAKE_ROUTE_MISSING', roles.human, roles.master, ['REQUEST']);
  requireEdge('ASSIGNMENT_ROUTE_MISSING', roles.master, roles.deputy, ['TASK_DISPATCH']);
  requireEdge('ROOM_STATUS_MISSING', roles.deputy, roles.room, ['VERIFIED_STATUS']);
  requireEdge('RESULT_RETURN_MISSING', roles.room, roles.deputy, ['AGGREGATE_RESULT']);
  requireEdge('RESULT_RETURN_MISSING', roles.deputy, roles.master, ['AGGREGATE_RESULT']);
  requireEdge('HUMAN_RESULT_MISSING', roles.master, roles.human, ['AGGREGATE_RESULT']);
  for (const team of teams) {
    requireEdge('TEAM_ASSIGNMENT_MISSING', roles.deputy, team, ['TASK_DISPATCH']);
    requireEdge('TEAM_RESULT_MISSING', team, roles.deputy, ['TASK_RESULT']);
    requireEdge('CEO_DIRECT_ASSIGNMENT_MISSING', roles.master, team, ['TASK_DISPATCH']);
    requireEdge('CEO_DIRECT_RESULT_MISSING', team, roles.master, ['TASK_RESULT']);
    requireEdge('TEAM_STATUS_MISSING', team, roles.room, ['VERIFIED_STATUS']);
    for (const peer of teams.filter((id) => id !== team)) {
      // Explicit proposed kinds keep consultation separate from authority to assign.
      requireEdge('PEER_COLLABORATION_MISSING', team, peer, ['COLLAB_REQUEST', 'COLLAB_RESULT']);
    }
  }
  for (const role of expectedIds.filter((id) => id !== roles.human)) {
    requireEdge('DIRECT_ESCALATION_MISSING', role, roles.human, ['DECISION_POINTER']);
  }
  requireEdge('QUALITY_REQUEST_MISSING', roles.deputy, teams[3], ['REVIEW_REQUEST']);
  requireEdge('QUALITY_RESULT_MISSING', teams[3], roles.deputy, ['REVIEW_RESULT']);
  return {
    status: findings.length ? 'REQUIREMENTS_NOT_MET' : 'STATIC_COVERAGE_ONLY',
    requirementRevision: '2026-09-05-ceo-service-chief-direct-teams',
    serviceReady: false,
    messageSent: false,
    notVerified: ['activation', 'endpoint-binding', 'handoff-study-gate',
      'intake-executor', 'task-authorization', 'ack-result-roundtrip', 'retry-dedupe'],
    findings,
  };
}

export function auditProject(root) {
  const directory = join(root, 'docs/team/chats');
  return auditRoutingCoverage(readdirSync(directory).filter((name) => name.endsWith('.md'))
    .map((name) => parseFrontMatter(readFileSync(join(directory, name), 'utf8'), name)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('No CLI arguments supported');
    const report = auditProject(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.findings.length ? 1 : 0;
  } catch {
    // Do not print arbitrary malformed input, provider IDs, or local credentials.
    console.error(JSON.stringify({ status: 'AUDIT_INPUT_INVALID', serviceReady: false }));
    process.exitCode = 2;
  }
}
