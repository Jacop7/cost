
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `74a9f85f683bd18a3af8d7fcd544786766b758fe`
- changed_artifact_paths: `docs/AI-지식-온톨로지-기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: Fable 필수 검수, 단일 권위, 채팅 비권위, Steward 신호 전용, L0~L4·단조 HANDOFF·lease 인계, DRAFT 전 materialization 금지
- 집중 검토 질문: 네 DRAFT와 동일 blob PASS를 계승한 팀 구성안 사이에 경쟁 장부·권한 우회·인계 원자성·활성화 순서의 Critical/Major 반례가 있는가? 같은 원인은 합치고 필수 Finding 최대 5개로 답한다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 68/68. 팀 구성안은 `AI-KNOWLEDGE-ORBIT-TEAM-003/r001`의 exact blob VERIFIED/PASS 증거를 함께 제공한다.
- 사람 결정이 필요한 항목: 유효 Fable 결과와 후속 재검수 뒤 네 DRAFT를 ACTIVE로 원자 승격할지 여부.
- next_review_request: `FABLE_REVIEW`
