
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6cc6c654036cce8b5cb360a33db5ab0df81d6e12`
- changed_artifact_paths: `docs/AI-지식-온톨로지-기획안.md`
- 충족해야 할 요구사항·불변식: 단일 권위, append-only 감사, 단조 HANDOFF, source SHA·snapshot 결속, lease 인계 전 복원
- 집중 검토 질문: stale HANDOFF·경쟁 권위·판본 역행·신호만으로 권한 획득하는 Critical/Major 반례가 있는가? 최대 3개로 합치고 재서술 없이 구조화 결과를 반환한다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 68/68. 타 문서의 교차 축은 compact evidence에 결속했다.
- 사람 결정이 필요한 항목: 유효 PASS 뒤에도 다른 세 DRAFT와 최종 네트워크 Fable 검수를 완료해야 한다.
- next_review_request: `FABLE_REVIEW`
