---
team_id: KNOWLEDGE-ORCHESTRATION
display_name: 05 Knowledge · Orchestration
task_types: ["REQUEST_NORMALIZATION","TASK_ROUTING","DECISION","LEARNING","HANDOFF","CONTEXT_STATUS"]
role_ids: ["ORCHESTRATION","INDEPENDENT-AUDIT"]
authority_links: ["docs/작업큐.md","docs/AI-지식-온톨로지-기획안.md","docs/AI-오케스트레이션-상세기획안.md"]
announcement_chat: 05 Knowledge · Orchestration
temporary_task_condition: normalized request and sealed Task Packet with one successor
handoff_in: ["user request","team status","review result"]
handoff_out: ["Task route","Decision request","single-successor HANDOFF"]
chat_is_approval_authority: false
---

# Knowledge · Orchestration 팀 manifest

권위 문서망·작업큐·Decision·Learning·HANDOFF·컨텍스트 조립을 라우팅한다. 사람 결정, 문서 편집,
독립 감사 판정은 각각의 공식 역할과 권위를 유지한다.
