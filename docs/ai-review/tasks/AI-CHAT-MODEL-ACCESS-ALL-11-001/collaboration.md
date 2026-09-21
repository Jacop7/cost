# AI-CHAT-MODEL-ACCESS-ALL-11-001 공동 작업 장부

> 이 장부의 비-Fable 턴은 `pnpm fable:append`로만 추가한다. Fable은 이 Task의 지정 artifact와
> reference/evidence snapshot을 읽기 전용으로 검수하며 제품·정책 파일을 직접 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: `docs/team/MODEL-ACCESS.md`, 공식 11개 chat manifest의 authority link, `.codex/mission-relay/model-plan.json`과 SHA sidecar
- 충족해야 할 요구사항·불변식: 11개 채팅 모두 Fable·Opus 호출 허용, maker/editor와 독립 reviewer 분리, Fable 우선·Opus 구조화 승계 유지, 00 상황실 read-only, 운영 사람 게이트 유지
- 이번에 바꾼 내용: 단일 모델 접근 계약을 작성하고 11개 manifest가 이를 참조하게 했으며, Stage 13 계획에 Opus fallback 검수 책임을 추가한 뒤 계획을 재봉인했다.
- 집중 검토 질문: 이 계약이 static manifest를 자동 라우터로 과장하는가, Opus 편집 허용이 같은 artifact 독립검수를 허용하는가, 00/운영 게이트가 권한 상승하는가, plan과 manifest의 허용 범위가 모순되는가?
- 실행한 테스트·현재 증거: `node scripts/docs-graph-check.mjs --activation` PASS (40 files, 19 contexts); Project Orchestrator validate/budget/seal/verify PASS; 11개 manifest의 common authority link 존재 확인.
- 사람 결정이 필요한 항목: 없음. 사용자는 Fable·Opus를 11개 채팅에서 허용했고, 이전 예산 위임에 따라 이 단일 read-only 회차의 USD 2.00 soft cap을 사용한다.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-MODEL-ACCESS-ALL-11-001`
- task_budget_usd_approved: `2.00`
- soft_budget_overrun_risk_accepted: `r001@2.00`
- 결정: 사용자는 Fable과 Opus를 모두 허용하고, 공식 11개 채팅에서도 사용하도록 지시했다. 두 모델의 편집은 확정 Task·edit lease·권위 경로 안에서만 허용하고, 자기 편집물의 독립 PASS는 금지한다.
- 허용 범위·기한: task.json의 artifact/reference/evidence snapshot을 대상으로 하는 Fable 읽기 전용 독립검수 1회. provider soft cap은 결제 하드캡이 아님을 수용한다.
- 금지: 같은 목적의 동시 Opus 호출, 자동 예산 배수 증액, 제품 파일 직접 수정, 사람 승인·운영 게이트 우회.
- 승인자·시각: `USER 명시 지시 · 2026-09-04 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- verified_input_files_sha256: `Fable 실행기 preflight 전 중단으로 manifest 미생성`
- artifact_hashes: `MODEL-ACCESS.md 및 11개 manifest, model-plan은 WORKING_TREE_HASHED Task 입력으로 지정됨`
- finding_ids: `[]`
- 실행 명령: `node scripts/docs-graph-check.mjs --activation`; Project Orchestrator validate/budget/seal/verify; `corepack pnpm fable:review -- --task AI-CHAT-MODEL-ACCESS-ALL-11-001 --round 1 --max-budget-usd 2.00 --allow-soft-budget --single-pass`
- 종료 코드·결과: 문서 그래프 PASS (40 files, 19 contexts), model plan SHA `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e` VERIFIED. Fable 호출은 exit 69로 모델 호출 전 차단: 설치된 Claude Code `2.1.259`은 실행기 허용 regex `2.1.248|250`에 없음.
- 미실행 항목과 이유: Fable 구조화 verdict 없음. 이는 provider budget/rate/capacity가 아닌 로컬 runner version gate이므로 Opus fallback 조건이 아니며 대체 호출하지 않았다.
- next_review_request: `HUMAN_DECISION`
