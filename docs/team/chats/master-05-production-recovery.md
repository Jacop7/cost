---
chat_id: MASTER-05-PRODUCTION-RECOVERY
schema_version: 2
accepts_from: ["MASTER-02-ORCHESTRATION"]
sends_to: ["MASTER-02-ORCHESTRATION","MASTER-01-HUMAN-DECISIONS"]
route_edges: ["MASTER-02-ORCHESTRATION|DECISION_POINTER,VERIFIED_STATUS","MASTER-01-HUMAN-DECISIONS|DECISION_POINTER"]
title: 05 운영 배포 · 복구 게이트
purpose: 운영 Go No-Go와 복구 증거 연결
role_context_ids: ["SOLAR-OPS"]
input: ["human gate Decision pointer","release and recovery evidence pointer"]
output: ["production gate pointer","deployment or recovery result pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/OPERATIONS.md","docs/team/teams/03-server-supabase-operations.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["OPERATIONS"]
stop_conditions: ["missing production approval","unrecoverable change"]
handoff_in: ["HUMAN-CHIEF","ORCHESTRATION","OPERATIONS"]
handoff_out: ["HUMAN-CHIEF","ORCHESTRATION","OPERATIONS"]
---
