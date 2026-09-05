---
chat_id: MASTER-04-DEVELOPMENT-STAGING
schema_version: 2
accepts_from: ["MASTER-02-ORCHESTRATION"]
sends_to: ["MASTER-02-ORCHESTRATION","MASTER-01-HUMAN-DECISIONS"]
route_edges: ["MASTER-02-ORCHESTRATION|STAGING_GATE_RESULT,DECISION_POINTER","MASTER-01-HUMAN-DECISIONS|DECISION_POINTER"]
title: 04 개발·스테이징 배포 검증
purpose: 개발과 스테이징 진행 결정 및 비운영 검증 증거 연결
role_context_ids: ["SOLAR-OPS"]
input: ["approved candidate pointer","staging evidence pointer"]
output: ["development gate pointer","staging result pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/OPERATIONS.md","docs/team/teams/03-server-supabase-operations.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["OPERATIONS"]
stop_conditions: ["unknown environment","missing exact SHA"]
handoff_in: ["ORCHESTRATION","SOLAR","CODEX"]
handoff_out: ["OPERATIONS","ORCHESTRATION"]
---
