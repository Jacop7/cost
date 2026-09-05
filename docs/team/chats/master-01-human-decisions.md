---
chat_id: MASTER-01-HUMAN-DECISIONS
schema_version: 2
accepts_from: ["MASTER-02-ORCHESTRATION","MASTER-04-DEVELOPMENT-STAGING","MASTER-05-PRODUCTION-RECOVERY"]
sends_to: ["MASTER-02-ORCHESTRATION"]
route_edges: ["MASTER-02-ORCHESTRATION|REQUEST,DECISION_POINTER"]
title: 01 통합 작업큐 · 사람 결정
purpose: 미결 Decision과 Task 상태 포인터 통합
role_context_ids: ["SOLAR-ORCH"]
input: ["Decision request","Task status pointer"]
output: ["Decision pointer","Task route pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/ORCHESTRATION.md","docs/team/teams/05-knowledge-orchestration.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["ORCHESTRATION"]
stop_conditions: ["missing human Decision","conflicting edit lease"]
handoff_in: ["HUMAN-CHIEF","ORCHESTRATION"]
handoff_out: ["ORCHESTRATION"]
---
