# AI-CHAT-MANIFESTS-OPS-COMPACT-006 공동 작업 장부

> 모든 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다. Fable 턴은 검수 실행기만 추가한다.
> FINAL-005 r001의 budget_exhausted 원본을 보존하고, 이 Task는 핵심 운영 산출물만 담은 단 한 번의 compact 재검수다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: 11개 chat manifest, team context 연결, 범용 starter template, setup doctor와 시험, docs graph와 시험, verify 연결, DB·서버·운영 문서
- 검토 범위: FINAL-005 r001의 1.09MB 입력 실패 뒤 핵심 운영 산출물 약 1/4 크기로 줄인 exact WORKING_TREE_HASHED snapshot
- 집중 검토 질문: chat manifest가 새 권위를 만들거나 route 권한을 상승시키는가, graph 검사가 우회 가능한가, doctor가 배포 증거를 거짓 양성으로 승인하거나 비밀·project ref를 노출하는가, production/staging 상태를 과장하는가?
- 실행한 테스트: setup doctor 6/6, docs graph 22/22, activation PASS, verify --no-db 4/6 PASS, git diff --check PASS
- 미실행: Docker 엔진 미실행으로 fresh DB와 upgrade 두 단계는 재실측하지 않았다.
- 이전 실패: FINAL-005 r001은 실제 USD 13.70059에서 budget_exhausted로 종료되어 verdict와 Finding이 없다.
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `6497666e655609a4f4bfe10duino`
- finding_ids: `[]`
- structure_contract_review: `PASS` — 11개 manifest exact set·bodyless 11필드, role/team/context/authority 결속과 12번째 경쟁 manifest 거부를 대조했다.
- data_db_review: `PASS` — deployment evidence의 recorded_at, main SHA, protected gate, exact migration prefix/suffix, reverse·noncontinuous 거부와 no-op 허용을 대조했다.
- operations_review: `PASS` — doctor의 local-only·secret-safe 경계, production DB 0191 적용과 production Edge 미배포, staging-only ops-health 표기를 대조했다.
- 실행 명령·결과: `node --test scripts/setup-doctor.test.mjs` 6/6; `node --test scripts/docs-graph-check.test.mjs` 22/22; activation PASS; `corepack pnpm verify --no-db` 4/6 선택 범위 PASS; `git diff --check` PASS.
- 판정 경계: CODEX PASS는 Fable 독립 verdict를 대신하지 않으며 Docker DB 두 단계는 미실행이다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-COMPACT-AUTONOMY-010`
- review_budget_envelope_approved: `16.00`
- review_budget_used_before_this_task: `13.70059`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 이전 초과 사용과 무판정 종료를 고지받은 뒤 알아서 진행하도록 위임했다. AI 부 오케스트레이터는 추가 호출을 이 compact 회차 한 번으로 제한한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 2.00을 넘을 수 있다.
- 허용 범위: task.json의 exact 핵심 산출물에 대한 읽기 전용 Fable single-pass 1회.
- 금지: 자동 재시도, 추가 증액, 동시 Opus 호출, 원격 mutation.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c001`
- correction: `turn-c001`의 target_commit_sha 전송 문자열은 오타이며 저장소 판본이나 검증 결과 변경이 아니다.
- superseded_field: `turn-c001.target_commit_sha`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- snapshot_identity: `target_tree=ca59fa2944c2b8d56a32c86a73cd469d473176be`, `AGENTS_blob=67b83fceda960e3c4428a0119b5d88c5c4331ed0`, `AGENTS_sha256=911f8c9afd1bc6458f6c96f2b8d8547086e5a79714e92a2c362bce532fccf7cf`
- unchanged_evidence: `turn-c001`의 세 CODEX 검수 PASS와 테스트·미실행 경계는 그대로 유효하다.
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c003 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- run_state: `RUN_FAILED`
- terminal_reason: `budget_exhausted`
- verdict: `null`
- finding_ids: `[]`
- max_budget_usd: `2.00`
- actual_cost_usd: `6.087975`
- predecessor_actual_cost_usd: `13.70059`
- cumulative_actual_cost_usd: `19.788565`
- input_snapshot_bytes: `393132`
- evidence: `docs/ai-review/tasks/AI-CHAT-MANIFESTS-OPS-COMPACT-006/status.json`, `docs/ai-review/tasks/AI-CHAT-MANIFESTS-OPS-COMPACT-006/rounds/r001/run.json`
- 판정 경계: 유효 Fable review가 생성되지 않았으므로 PASS·CHANGES_REQUIRED·BLOCKED 어떤 verdict도 합성하지 않는다.
- 정책 처리: 원본 호출 뒤 허용된 compact 재시도 1회도 실패했으므로 자동 증액·추가 Fable·Opus 우회를 중단한다.
- next_review_request: `NONE`
