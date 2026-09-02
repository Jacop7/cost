# AI-KNOWLEDGE-ORBIT-ONTOLOGY-001 공동 작업 장부

> 팀 구성안 v1.3과 온톨로지 v0.2만 누적 검수하는 append-only 장부다. 미완성 후속 기획안은
> 검수 범위에서 제외하며, 비-Fable 턴은 전용 append 명령으로만 추가한다.


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

## CODEX_EVIDENCE · turn-c001 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `6deaf4d1beca913dde06af9721c70ada5d927577`
- finding_ids: `[]`
- 실행 명령: `corepack pnpm ai:plans:simulate`; `corepack pnpm fable:review -- --task AI-KNOWLEDGE-ORBIT-ONTOLOGY-001 --round 1 --max-budget-usd 4.00`; 같은 명령의 r002 `--max-budget-usd 1.30`
- 종료 코드·결과: 문서망 시뮬레이션 65/65 통과. Fable r001은 `CLAUDE_EXECUTION_FAILED`·결과 없음·사용량 USD 2.630461, r002는 `budget_exhausted`·결과 없음·사용량 USD 1.303113. 누적 USD 3.933574, verdict와 Finding은 생성되지 않았다.
- 증거 파일·로그 위치: `rounds/r001/run.json`, `rounds/r002/run.json`, `status.json`
- 판정: 두 실패를 유효 검수나 PASS로 합성하지 않는다. 실행기가 `TASK_CAP_APPROVAL_REQUIRED`를 기록했으므로 같은 Task 추가 호출에는 사람의 새 사용량 상한 승인이 필요하다.
- next_review_request: `HUMAN_DECISION`
