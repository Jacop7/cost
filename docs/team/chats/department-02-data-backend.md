---
chat_id: DEPARTMENT-02-DATA-BACKEND
schema_version: 2
accepts_from: ["MASTER-03-DEPUTY-CONTEXT"]
sends_to: ["MASTER-03-DEPUTY-CONTEXT"]
route_edges: ["MASTER-03-DEPUTY-CONTEXT|TASK_RESULT"]
title: 02 Data · Backend
purpose: DB RPC 원장 계산 요청 발견과 의존 분석
role_context_ids: ["SOLAR-ARCH"]
input: ["data or calculation request","architecture pointer"]
output: ["normalized architecture Task pointer"]
authority_links: ["AGENTS.md","ARCHITECTURE.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/SOLAR.md","docs/team/teams/02-data-backend.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["ARCHITECTURE"]
stop_conditions: ["unapproved formula change","conflicting DB lease"]
handoff_in: ["ORCHESTRATION","HUMAN-CHIEF"]
handoff_out: ["SOLAR","CODEX","OPERATIONS","INDEPENDENT-AUDIT"]
---
