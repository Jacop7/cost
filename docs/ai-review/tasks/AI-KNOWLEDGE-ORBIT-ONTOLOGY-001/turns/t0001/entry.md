
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6deaf4d1beca913dde06af9721c70ada5d927577`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`
- 충족해야 할 요구사항·불변식: 팀 역할·사람 승인·Steward 관측 전용 경계, 온톨로지 node/edge 단일 권위, 요청 판정 enum 단일 권위, HANDOFF 비권위 snapshot, L0~L4 최소 복원, 동일·낮은 판본 거부
- 이번에 바꾼 내용: 팀 구성안 v1.3의 확정 라우팅 위에서 온톨로지를 v0.2로 개정했다. HANDOFF·ROLE_CONTEXT·RELEASE와 HANDOFF_TO를 추가하고 TOUCHES 등 중복 관계는 기각했으며, §6.4에 L0~L4 기억 캡슐과 필수 복원 검사를 통합했다.
- 집중 검토 질문: 두 문서의 권위가 중복되는가? HANDOFF 필드·저장 위치가 새 공식본을 만드는가? L0~L4가 lease·사용자 변경·증거 SHA를 생략하게 하는가? 추가 node·edge가 과설계이거나 빠진 필수 어휘가 있는가?
- 실행한 테스트·현재 증거: `git diff --check`; `corepack pnpm ai:plans:simulate` 65/65 통과. 신규 시험은 HANDOFF/ROLE_CONTEXT 누락, TOUCHES 재도입, L0~L4 순서 변경, 동일·낮은 판본 허용을 각각 실패시킨다.
- 사람 결정이 필요한 항목: 필수 Finding이 있으면 같은 공식 파일에 반영하고 새 commit successor로 재검수한다. 일반 Task HANDOFF 물리 형식·보존 기간은 후속 구현 결정으로 남긴다.
- next_review_request: `FABLE_REVIEW`
