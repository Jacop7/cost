# AI-CHAT-MANIFESTS-OPS-FINAL-001 공동 작업 장부

> 운영 기준선·setup doctor와 정확한 제목 11개 chat manifest의 현재 작업본을 독립 검수한다.
> 이후 모든 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `README.md`, `ARCHITECTURE.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`, `packages/db/README.md`, `scripts/verify.mjs`, `scripts/setup-doctor.mjs`, `scripts/setup-doctor.test.mjs`, `docs/team/README.md`, `docs/team/ROLE_CONTEXTS.md`, `docs/team/chats/*.md`, `scripts/docs-graph-check.mjs`, `scripts/docs-graph-check.test.mjs`
- 검토 범위: 비밀 비노출 setup doctor, 현재 운영 기준선, 정확한 제목 11개 chat manifest와 role/context/team/Task/HANDOFF 결속
- 실행한 테스트: doctor 3/3, docs graph 16/16, activation 40 files PASS, starter kit 2/2, `pnpm verify --no-db` 4/6 PASS, `git diff --check` PASS
- 미실행: Docker 엔진이 꺼져 새 DB·upgrade 2단계는 실행하지 않았으며 전체 6/6 PASS로 주장하지 않는다.
- 집중 검토 질문: 채팅이 새 권위가 되거나 제목·context·team/role·Task/HANDOFF 결속을 우회할 수 있는가? doctor가 비밀값/ref를 노출하거나 거짓 준비 완료를 만드는가?
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
- 허용 범위: task.json의 명시된 현재 작업본과 참조 문서에 대한 읽기 전용 Fable 검수 1회.
- 금지: 동일 목적 중복 Fable 호출, 동시 Opus 호출, 자동 증액.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
