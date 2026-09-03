---
team_id: QUALITY-REVIEW
display_name: 04 Quality · Review
task_types: ["QA_SCHEDULING","REVIEW_SCHEDULING","BLOCKER","EVIDENCE_INDEX"]
role_ids: ["CODEX","INDEPENDENT-AUDIT","ORCHESTRATION"]
authority_links: ["docs/팀구성_상세기획안.md","docs/ai-review/README.md","docs/AI-품질-학습-자율성-평가기획안.md"]
announcement_chat: 04 Quality · Review
temporary_task_condition: sealed review Task Packet in a clean context
handoff_in: ["maker evidence","review request"]
handoff_out: ["Finding and verdict pointers","ORCHESTRATION blocker"]
chat_is_approval_authority: false
---

# Quality · Review 팀 manifest

시험·감사 일정, 차단, 결과 링크만 조정한다. 이 상설 채팅은 Codex/Fable의 회차별 독립 컨텍스트가
아니며 검수 판정을 직접 만들지 않는다.
