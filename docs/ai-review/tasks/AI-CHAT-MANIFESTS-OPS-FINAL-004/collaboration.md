# AI-CHAT-MANIFESTS-OPS-FINAL-004 공동 작업 장부

> 001~003의 provider 호출 전 준비·preflight 실패는 판정 없는 stale 원본으로 보존한다.
> 올바른 target tree와 모든 로컬 QA PASS를 처음부터 봉인한 현재 exact bytes만 r001로 단 한 번 독립 검수한다.
> 이후 모든 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `model plan/history`, `README.md`, `ARCHITECTURE.md`, `docs/작업큐.md`, 운영 기획안 2개, `packages/db/README.md`, setup doctor와 시험, team README/ROLE_CONTEXTS, `docs/team/chats/*.md`, canonical HANDOFF 원본, docs graph와 시험, AI plan simulator와 시험, verify 연결
- 검토 범위: 정확히 11개 필드·본문 없는 11개 chat manifest, role/context/team/Task/HANDOFF 결속, doctor 원격 prefix 계약, 권장가 국제 계산 권위, 해제 lease 복원 계약
- 실행한 테스트: doctor 6/6, docs graph 21/21, activation 40 files/19 contexts PASS, ai:plans:simulate 71/71, starter kit 2/2, `pnpm verify --no-db` 4/6 PASS, `git diff --check` PASS
- 미실행: Docker 엔진이 꺼져 새 DB·upgrade 2단계는 실행하지 않았으며 전체 6/6 PASS로 주장하지 않는다.
- 이전 실행: 001~003은 provider 호출 전 준비·preflight 흔적이며 verdict나 Finding이 없다. 현재 Task에 승계하지 않는다.
- 집중 검토 질문: chat shell이 새 권위·상태 저장소가 되는가, route·HANDOFF 권한 상승이 가능한가, doctor가 정상 원격 lag를 실패시켜 배포 deadlock을 만드는가, 과거 Task 복원이 현재 working tree를 잘못 요구하는가?
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-AUTONOMOUS-BUDGET-009`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 로컬 구현·QA 뒤 exact 대상 Fable 최종 검수를 진행하도록 지시했고, 기존 예산 위임에 따라 AI 부 오케스트레이터가 잔여 승인 envelope 안에서 이번 단일-pass soft cap을 USD 2.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 2.00을 넘을 수 있다.
- 허용 범위: task.json에 명시된 현재 작업본과 참조 문서에 대한 읽기 전용 Fable 검수 1회.
- 금지: 동일 목적 중복 Fable 호출, 동시 Opus 호출, 자동 증액.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
