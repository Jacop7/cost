---
chat_id: MASTER-02-ORCHESTRATION
schema_version: 2
accepts_from: ["MASTER-01-HUMAN-DECISIONS","MASTER-03-DEPUTY-CONTEXT","MASTER-04-DEVELOPMENT-STAGING","MASTER-05-PRODUCTION-RECOVERY"]
sends_to: ["MASTER-01-HUMAN-DECISIONS","MASTER-03-DEPUTY-CONTEXT","MASTER-04-DEVELOPMENT-STAGING","MASTER-05-PRODUCTION-RECOVERY","DEPARTMENT-00-ALL-TEAMS-ROOM"]
route_edges: ["MASTER-01-HUMAN-DECISIONS|AGGREGATE_RESULT,VERIFIED_STATUS,DECISION_POINTER","MASTER-03-DEPUTY-CONTEXT|CONFIRMED_ROUTE,TASK_DISPATCH","MASTER-04-DEVELOPMENT-STAGING|STAGING_GATE_REQUEST","MASTER-05-PRODUCTION-RECOVERY|PRODUCTION_GATE_REQUEST","DEPARTMENT-00-ALL-TEAMS-ROOM|VERIFIED_STATUS"]
title: 02 마스터 오케스트레이션
purpose: 승인 목표의 작업 그래프와 담당 route 확정
role_context_ids: ["SOLAR-MASTER-ORCH"]
input: ["approved objective","Task and Decision pointers"]
output: ["Task graph pointer","confirmed route pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/ORCHESTRATION.md","docs/team/teams/05-knowledge-orchestration.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["ORCHESTRATION"]
stop_conditions: ["unapproved objective","missing required Decision"]
handoff_in: ["HUMAN-CHIEF","ORCHESTRATION"]
handoff_out: ["ORCHESTRATION"]
---
