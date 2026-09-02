
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6deaf4d1beca913dde06af9721c70ada5d927577`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`
- 충족해야 할 요구사항·불변식: 팀·승인·Steward 경계, node/edge 단일 권위, 요청 판정 enum, HANDOFF 비권위 snapshot, L0~L4 최소 복원, stale·동일 판본 실패 폐쇄
- 이번에 바꾼 내용: ONTOLOGY-001과 같은 commit의 팀 구성안 v1.3·온톨로지 v0.2를 검수한다. 이전 두 회차는 verdict 없이 실패했으며 어떤 PASS나 Finding으로도 합성하지 않는다.
- 집중 검토 질문: 두 문서 권위가 중복되는가? 추가 어휘는 최소인가? HANDOFF와 L0~L4가 lease·사용자 변경·exact SHA를 보존하는가? 사보타주가 실제 위반을 직접 잡는가?
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 65/65. TEAM-003 PASS와 필수 Finding 2건 VERIFIED. ONTOLOGY-001 r001·r002 RUN_FAILED 원본 보존.
- 사람 결정이 필요한 항목: 필수 Finding은 같은 공식 파일에 반영하고 새 commit successor로 재검수한다.
- next_review_request: `HUMAN_DECISION`
