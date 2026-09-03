# AI-ORCH-PLANS-STAGE-9-MATERIALIZATION-RECHECK-025 공동 작업 장부

> 이전 WORKING_TREE_HASHED 검수는 protocol 1.2 COMMIT successor로 직접 승계할 수 없다. 기존 원본을 보존하고,
> 수정 commit에서 같은 Finding 4건을 증거로 독립 COMMIT 재감사한다. 이후 비-Fable 턴은
> `corepack pnpm fable:append -- --task AI-ORCH-PLANS-STAGE-9-MATERIALIZATION-RECHECK-025`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `1b3fd6767787adec6cd2a991b81d72b2d40c906f`
- changed_artifact_paths: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md`
- predecessor_review_sha256: `43ef20e4e397f2892326584d88d4685194858a05abb1db1f288f3e71e96fbb28`
- finding_ids: `FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001, FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002, FAB-ARCH-024-RISKS-PATH-OWNER-003, FAB-ARCH-024-STAGE10-STEP-PIN-004`
- 적용 내용: activation 전 planned tree에 필수 중앙 노드를 조립하고 ACTIVE 전환과 같은 원자 commit에 포함하도록 순서를 보정했다. 사이드바·채팅 shell은 명시적 사람 Decision 범위에 결속했고, RISKS.md는 소유권 수렴 실패 시 생성하지 않도록 했다. 단계 10의 verify 연결 위치 소유권도 복구했다.
- 집중 검토 질문: 이전 검수의 Finding 4건이 현재 commit에서 모두 해소됐고, stage 9 물질화 전 fail-closed 게이트가 맞물려 있는가?
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001, FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002, FAB-ARCH-024-RISKS-PATH-OWNER-003, FAB-ARCH-024-STAGE10-STEP-PIN-004`
- decision_id: `DEC-AI-FABLE-STAGE-9-MATERIALIZATION-RECHECK-BUDGET-025`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 독립 COMMIT 재감사의 soft cap을 USD 4.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 4.00을 넘을 수 있다.
- 허용 범위: 이전 Finding registry와 수정 target commit의 단계 9 실행기획안에 대한 읽기 전용 재검수 1회.
- 금지: 실제 stage 9 물질화, 동일 회차 중복 호출, 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`

## SOLAR_RESPONSE · turn-s002 · r002

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-h001`
- reply_to_review_sha256: `null`
- target_commit_sha: `1b3fd6767787adec6cd2a991b81d72b2d40c906f`
- finding_ids: `FAB-ARCH-024-PREFLIGHT-MANIFEST-WINDOW-001, FAB-ARCH-024-CHAT-SHELL-DECISION-SCOPE-002, FAB-ARCH-024-RISKS-PATH-OWNER-003, FAB-ARCH-024-STAGE10-STEP-PIN-004`
- 재시도 사유: r001 후보는 내용상 네 과거 지적이 모두 해소됐다고 판정했으나 독립 INITIAL Task의 findings 배열에 VERIFIED 전이를 발행해 RESULT_FINDINGS_CONTRACT로 거부됐다.
- 결과 계약 보정: 이번 Task는 predecessor_review가 없는 INITIAL 재감사다. 과거 네 ID의 해소 확인은 summary와 evidence에만 기록하고 findings 배열에 VERIFIED 또는 previous_finding_id 전이로 재발행하지 않는다. 현재 commit에서 새로 발견한 Finding만 OPEN으로 반환한다. 필수 새 Finding이 없으면 PASS를 반환할 수 있다.
- 변경 없음: target commit과 입력 파일은 바꾸지 않았고 r001 후보 원본·실패 run을 보존한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-s002`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-STAGE-9-MATERIALIZATION-RETRY-BUDGET-026`
- soft_budget_overrun_risk_accepted: `r002@1.65`
- 결정: Task cap USD 4.00에서 r001 보수 정산 USD 2.35를 제외한 잔여 USD 1.65 범위로 결과 계약 보정 재시도 1회를 수행한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 1.65를 넘을 수 있다.
- 허용 범위: 동일 입력·동일 target commit의 결과 형식 보정 재검수 1회.
- 금지: 입력 확대, stage 9 물질화, 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
