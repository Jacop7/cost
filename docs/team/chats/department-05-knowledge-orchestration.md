---
chat_id: DEPARTMENT-05-KNOWLEDGE-ORCHESTRATION
schema_version: 2
accepts_from: ["MASTER-03-DEPUTY-CONTEXT"]
sends_to: ["MASTER-03-DEPUTY-CONTEXT"]
route_edges: ["MASTER-03-DEPUTY-CONTEXT|TASK_RESULT"]
title: 05 Knowledge · Orchestration
purpose: 요청 문서망 Task Decision Learning HANDOFF 연결
role_context_ids: ["SOLAR-ORCH"]
input: ["user request pointer","Task or HANDOFF pointer"]
output: ["normalized route pointer","Decision or HANDOFF pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/ORCHESTRATION.md","docs/team/teams/05-knowledge-orchestration.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["ORCHESTRATION"]
stop_conditions: ["authority conflict","invalid HANDOFF lineage"]
handoff_in: ["HUMAN-CHIEF","ORCHESTRATION","SOLAR","CODEX","INDEPENDENT-AUDIT","OPERATIONS"]
handoff_out: ["ORCHESTRATION","SOLAR","CODEX","INDEPENDENT-AUDIT","OPERATIONS"]
---
