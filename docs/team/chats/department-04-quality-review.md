---
chat_id: DEPARTMENT-04-QUALITY-REVIEW
schema_version: 2
accepts_from: ["MASTER-03-DEPUTY-CONTEXT"]
sends_to: ["MASTER-03-DEPUTY-CONTEXT"]
route_edges: ["MASTER-03-DEPUTY-CONTEXT|REVIEW_RESULT,TASK_RESULT"]
title: 04 Quality · Review
purpose: QA 독립검수 일정과 대상 차단 증거 링크 조정
role_context_ids: ["SOLAR-ORCH"]
input: ["review request pointer","maker evidence pointer"]
output: ["review Task pointer","Finding or verdict pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/ORCHESTRATION.md","docs/team/teams/04-quality-review.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["ORCHESTRATION"]
stop_conditions: ["missing exact target","self-review substitution"]
handoff_in: ["ORCHESTRATION","SOLAR","CODEX","INDEPENDENT-AUDIT"]
handoff_out: ["CODEX","INDEPENDENT-AUDIT","ORCHESTRATION"]
---
