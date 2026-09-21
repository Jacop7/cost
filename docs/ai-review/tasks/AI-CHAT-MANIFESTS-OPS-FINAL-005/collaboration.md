# AI-CHAT-MANIFESTS-OPS-FINAL-005 공동 작업 장부

> 001~003의 provider 호출 전 준비·preflight 실패와 004의 중단된 stale prepared 원본은 판정 없이 보존한다.
> 최신 late fixes와 CODEX 3개 검수 범위를 포함한 현재 exact bytes만 향후 r001 독립 검수 대상으로 준비한다.
> 모든 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: model plan/history, 운영 기준 문서, 범용 starter kit, 11개 chat manifest, 두 canonical HANDOFF, setup doctor와 시험, docs graph와 시험, AI plan simulator와 시험, verify 연결
- 검토 범위: 현재 git diff와 사용자 소유·stale 검수 원본을 제외한 untracked 구현 파일 전체. PLATFORM §11 Task packet, 실제 최신 HANDOFF 0001, 범용 CHAT-MANIFEST adapter 경계, doctor migration suffix·recorded_at, production/staging 운영 상태를 포함한다.
- 실행한 테스트: doctor 6/6, docs graph 22/22, activation 40 files/19 contexts PASS, ai:plans:simulate 71/71, starter kit 3/3, `pnpm verify --no-db` 4/6 PASS, `git diff --check` PASS
- CODEX 선행 검수: 구조·계약, Data·DB, Operations 세 범위 모두 PASS. 최신 late fixes가 반영된 뒤 재검수했다.
- 미실행: Docker 엔진이 꺼져 새 DB·upgrade 2단계는 실행하지 않았으며 전체 6/6 PASS로 주장하지 않는다.
- 보존·제외: 001~003의 provider 호출 전 실패와 004의 중단된 stale prepared 원본은 verdict 없이 보존한다. `.codex-share/**`와 `.tmp/**`는 사용자 소유이므로 검수 입력에서 제외한다.
- 집중 검토 질문: chat shell·starter template이 새 권위가 되는가, Task/HANDOFF hash가 자기모순인가, doctor가 원격 suffix를 느슨하게 허용하거나 운영 배포 상태를 과장하는가, 국제 가격 계산 권위를 legacy 공식이 침범하는가?
- next_review_request: `HUMAN_DECISION`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- finding_ids: `[]`
- structure_contract_review: `PASS` — 11개 chat manifest exact set·bodyless 11필드, PLATFORM §11 필드 31개, 실제 latest HANDOFF 0001, generic CHAT-MANIFEST와 project adapter 경계를 대조했다.
- data_db_review: `PASS` — deployment evidence의 valid recorded_at, nonempty applied/pending exact consecutive remotePrefix suffix, reverse·noncontinuous 거부, empty no-op 허용을 구현·부정 시험과 대조했다.
- operations_review: `PASS` — doctor가 원격 API/env/link 내용을 읽지 않음, production DB 0191 적용과 production Edge/자동 알림 미배포 구분, ops-health 10분 점검 staging-only 표기를 대조했다.
- 실행 명령·결과: `node --test scripts/setup-doctor.test.mjs` 6/6; `node --test scripts/docs-graph-check.test.mjs` 22/22; activation 40 files/19 contexts PASS; `corepack pnpm ai:plans:simulate` 71/71; `corepack pnpm ai:starter-kit:check` 3/3; `corepack pnpm verify --no-db` 4/6 선택 범위 PASS; `git diff --check` PASS.
- snapshot_identity: `target_commit=6497666e655609a4f4bfe10bfaea6070dad01286`, `target_tree=ca59fa2944c2b8d56a32c86a73cd469d473176be`, `AGENTS_blob=67b83fceda960e3c4428a0119b5d88c5c4331ed0`, `AGENTS_sha256=911f8c9afd1bc6458f6c96f2b8d8547086e5a79714e92a2c362bce532fccf7cf`.
- 미실행 항목과 이유: Docker 엔진이 꺼져 fresh DB·upgrade 2단계는 미실행이다. 로컬 4/6 결과를 전체 6/6 PASS로 확대하지 않는다.
- 판정 경계: CODEX 3범위 PASS는 Fable·Opus 독립검수 verdict를 대신하지 않으며, 001~004에는 유효 외부 verdict가 없다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-AUTONOMOUS-BUDGET-009`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 로컬 구현·QA 뒤 exact 대상 독립검수를 진행하도록 지시했고, 기존 예산 위임에 따라 AI 부 오케스트레이터가 잔여 승인 envelope 안에서 이번 단일-pass soft cap을 USD 2.00으로 선택한다.
- 계정 연속성: 동일 소유자 계정군 내부 전환은 새 작업·문서 재독해·재스터디·재검수를 만들지 않는다. 계정 확인은 인증·과금 귀속 확인일 뿐 검수 독립성 조건이 아니다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 2.00을 넘을 수 있다.
- 허용 범위: task.json에 명시된 현재 작업본과 참조 문서에 대한 읽기 전용 Fable 검수 1회.
- 금지: 동일 목적 중복 Fable 호출, 동시 Opus 호출, 자동 증액.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
