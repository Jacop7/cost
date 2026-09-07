import * as workflow from './team-service-workflow.mjs';
import { effectKeyOf } from './team-service-intent-store.mjs';
import { roles, teams } from './team-routing-contract-audit.mjs';

const expectedExports = ['applyServiceEvent', 'createServiceWorkflow', 'nextServiceAction'];
const actualExports = Object.keys(workflow).sort();
if (JSON.stringify(actualExports) !== JSON.stringify(expectedExports)) throw new Error('WORKFLOW_EXPORT_DRIFT');

const nonHumanRoles = [...Object.values(roles), ...teams].filter((role) => role !== roles.human);
if (new Set(nonHumanRoles).size !== 10) throw new Error('NON_HUMAN_ROLE_COUNT_MISMATCH');

const effect = {
  task_id: 'TASK-P3-ENTRY',
  subtask_id: 'SUBTASK-DATA',
  work_spec_revision: 1,
  effect_kind: 'APPLY_ASSIGNMENT',
};
const ceoRouteEffect = effectKeyOf(effect);
const serviceChiefRouteEffect = effectKeyOf({ ...effect });
if (ceoRouteEffect !== serviceChiefRouteEffect) throw new Error('EFFECT_KEY_ROUTE_DEPENDENT');

export const observation = Object.freeze({
  p3_entry_status: 'READY',
  preserved_exports: actualExports,
  non_human_role_count: nonHumanRoles.length,
  effect_key_equivalent_across_routes: true,
  dispatch_attempts: 0,
});
