---
role_id: ORCHESTRATION
context_ids: ["SOLAR-MASTER-ORCH","SOLAR-ORCH","CONTEXT-STEWARD"]
context_refs: ["SOLAR-MASTER-ORCH@1#1e9f8217226fffc577e84198f323666ad8ac36fb7351b6150a4cdc17b203e96a","SOLAR-ORCH@1#cef6e53d5ee3b6321fce2bbffaf8ce38afd98c5107c35606cec3edffd46ce5e6","CONTEXT-STEWARD@1#9c0fcd11ad10e3a61e2c92e0007f96b721ce77c3802df8cd74424745709eaae4"]
allowed_routes: ["ORCHESTRATION","STATUS_ONLY"]
input_allowlist: ["normalized request","sealed Task Packet","Decision pointer","HANDOFF pointer","model plan receipt"]
authority_links: ["docs/팀구성_상세기획안.md","docs/AI-오케스트레이션-상세기획안.md","docs/작업큐.md"]
required_outputs: ["Task graph or route","Decision request","status and evidence pointers","single-successor HANDOFF"]
verification_checklist: ["scope and dependency","edit lease","exact SHA","open Finding and Decision"]
handoff_in: ["HUMAN-CHIEF","SOLAR","CODEX","INDEPENDENT-AUDIT","OPERATIONS"]
handoff_out: ["HUMAN-CHIEF","SOLAR","CODEX","INDEPENDENT-AUDIT","OPERATIONS"]
stop_conditions: ["missing human Decision","unverified model plan","conflicting edit lease","invalid HANDOFF lineage"]
human_escape: HUMAN-CHIEF
---

# ORCHESTRATION 역할 manifest

AI 마스터는 승인된 목표의 순서·작업 그래프·담당·라우팅 계획을 확정하고, AI 부는 요청 정규화와
확정 경로 실행·상태·증거·HANDOFF를 관리한다. Context Steward는 관측 신호만 낸다. 현재 Task와
토큰 임계값, 플러그인 판정 알고리즘은 이 문서에 복사하지 않는다.
