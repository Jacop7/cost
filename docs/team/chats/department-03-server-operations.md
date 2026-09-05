---
chat_id: DEPARTMENT-03-SERVER-OPERATIONS
schema_version: 2
accepts_from: ["MASTER-03-DEPUTY-CONTEXT"]
sends_to: ["MASTER-03-DEPUTY-CONTEXT"]
route_edges: ["MASTER-03-DEPUTY-CONTEXT|TASK_RESULT"]
title: 03 Server · Supabase · Operations
purpose: 서버 Supabase 보안 배포 관측 복구 요청 분해
role_context_ids: ["SOLAR-OPS"]
input: ["environment or operations request","verification evidence pointer"]
output: ["operations Task or gate pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/OPERATIONS.md","docs/team/teams/03-server-supabase-operations.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["OPERATIONS"]
stop_conditions: ["unknown target environment","missing human gate"]
handoff_in: ["ORCHESTRATION","SOLAR","CODEX"]
handoff_out: ["OPERATIONS","CODEX","INDEPENDENT-AUDIT","ORCHESTRATION"]
---
