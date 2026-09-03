# AI-PLANS-SIM-FABLE-COMPACT-R1-RUN-FAILED

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `RUN_FAILED · NO_VERDICT · EXTERNAL_REVIEW_STOPPED`
> 기록 시각: `2026-09-03T09:06:30+09:00`

## 판정

`AI-ORCH-PLANS-BUNDLE-A-FABLE-COMPACT-002/r001`은 유효한 Fable 검수 회차가 아니다. 선행 실패 뒤
사용자가 추가 승인한 USD 1.50으로 입력 범위를 다섯 공식 문서·AGENTS·필수 증거 두 개로 줄이고
간결한 출력 계약을 명시했으나, Claude Code CLI는 최종 review JSON을 반환하기 전에 다시
`error_max_budget_usd`로 끝났다. 종결 사유는 `budget_exhausted`, run 상태는 `RUN_FAILED`, 프로세스
exit code는 `69`다. `review_sha256`, `review_markdown_sha256`, `verdict`가 없으므로 PASS나
CHANGES_REQUIRED로 합성하지 않는다.

## 비용·사용량

- 명령 상한: `USD 1.50`
- 제공자 집계 실비: `USD 2.609863`
- 관측 초과액: `USD 1.109863`
- 남은 승인 잔액: `USD 0.00`
- 입력: `6`, cache creation input: `61,551`, cache read input: `48,882`, 출력: `2,385`
- 모델별 집계: input `8`, output `12,063`, cache read `116,214`, cache creation `94,202`

`--max-budget-usd`는 이 실행에서 실제 지출의 하드 캡으로 작동하지 않았다. 따라서 추가 Fable·Opus
호출과 자동 증액을 모두 중단하며, 다음 외부 검수는 사람의 새 결정뿐 아니라 실행기 비용 통제 방식의
재설계·검증 전에는 시작하지 않는다.

## 원본 결속

| 원본 | SHA-256 |
|---|---|
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-COMPACT-002/task.json` | `fd66e0064e7df9127501ffc7911fe807f6f1084e8e250ae55255d40514a88b14` |
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-COMPACT-002/status.json` | `d09d9769c527a07f54a74452727349a5a465044955061fce56ce23caeec1d00d` |
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-COMPACT-002/rounds/r001/manifest.json` | `c195a5888f7e9a8c0a61073d2dcecfaa023c657a21370c649614b316b962d486` |
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-COMPACT-002/rounds/r001/run.json` | `72c4156676b8924661c0d2aad8f69367179d49ec62b8a66e5387039d49c09db2` |

실패 뒤 다섯 공식 기획안 바이트는 수정하지 않았다. 단계 1~4는 내부 완료, 5단계는 Fable 게이트가
열린 `active` 상태를 유지한다.

## 실패 기록 반영 후 로컬 검증

- `corepack pnpm ai:plans:simulate`: `71/71 PASS`
- `corepack pnpm verify --no-db`: 선택 범위 `4/6 PASS`
- 생략: 새 DB, 업그레이드 경로 — 문서·검수 장부 작업이며 전체 `pnpm verify` 통과로 표현하지 않는다.
- Project Orchestrator: 모델 계획 `c1d6eb419d018d97fe2a3ec46dd7ea59af58cbcbc75fc4470fe8182b1ac3f608` `MODEL_PLAN_VERIFIED`
