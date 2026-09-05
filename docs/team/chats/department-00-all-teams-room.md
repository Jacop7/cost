---
chat_id: DEPARTMENT-00-ALL-TEAMS-ROOM
schema_version: 2
accepts_from: ["MASTER-02-ORCHESTRATION"]
sends_to: []
route_edges: []
title: 00 모든 팀 상황실
purpose: 검증된 상태와 Release 및 차단 포인터 공지
role_context_ids: ["CONTEXT-STEWARD"]
input: ["verified status pointer","blocker or Release pointer"]
output: ["status announcement pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/ORCHESTRATION.md","docs/team/teams/00-all-teams-room.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["STATUS_ONLY"]
stop_conditions: ["unverified status","implementation request"]
handoff_in: ["ORCHESTRATION","SOLAR","CODEX","INDEPENDENT-AUDIT","OPERATIONS"]
handoff_out: ["ORCHESTRATION"]
---
