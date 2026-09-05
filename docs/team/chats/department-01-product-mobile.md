---
chat_id: DEPARTMENT-01-PRODUCT-MOBILE
schema_version: 2
accepts_from: ["MASTER-03-DEPUTY-CONTEXT"]
sends_to: ["MASTER-03-DEPUTY-CONTEXT"]
route_edges: ["MASTER-03-DEPUTY-CONTEXT|TASK_RESULT"]
title: 01 Product · Mobile
purpose: 제품 모바일 UX 요청 발견과 Task 후보 분해
role_context_ids: ["SOLAR-PO"]
input: ["product or mobile request","screen authority pointer"]
output: ["normalized Task candidate pointer"]
authority_links: ["AGENTS.md","docs/작업큐.md","docs/team/DECISIONS.md","docs/team/handoffs/README.md","docs/team/roles/SOLAR.md","docs/team/teams/01-product-mobile.md","docs/team/MODEL-ACCESS.md"]
allowed_routes: ["PRODUCT_POLICY"]
stop_conditions: ["missing product Decision","conflicting edit lease"]
handoff_in: ["ORCHESTRATION","HUMAN-CHIEF"]
handoff_out: ["SOLAR","CODEX","ORCHESTRATION"]
---
