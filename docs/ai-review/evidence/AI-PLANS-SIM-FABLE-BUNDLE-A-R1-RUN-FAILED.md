# AI-PLANS-SIM-FABLE-BUNDLE-A-R1-RUN-FAILED

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `RUN_FAILED · NO_VERDICT · FABLE_GATE_OPEN`
> 기록 시각: `2026-09-03T08:52:19+09:00`

## 판정

`AI-ORCH-PLANS-BUNDLE-A-FABLE-001/r001`은 유효한 Fable 검수 회차가 아니다. Claude Code CLI는
`claude-fable-5`를 `high` effort와 `max_budget_usd=2.00`으로 실행했으나 최종 review JSON을 반환하기
전에 `error_max_budget_usd`로 끝났다. 실행기의 종결 사유는 `budget_exhausted`, run 상태는
`RUN_FAILED`, 프로세스 exit code는 `69`다. `review_sha256`, `review_markdown_sha256`, `verdict`는 모두
없으므로 이 실행을 PASS·CHANGES_REQUIRED·유효 독립검수로 합성하지 않는다.

## 비용·사용량

- 제공자 집계 실비: `USD 2.118396`
- 승인된 프로젝트 envelope: `USD 2.00`
- 관측 초과액: `USD 0.118396`
- 남은 승인 잔액: `USD 0.00`
- 입력: `8`, cache creation input: `39,367`, cache read input: `88,228`, 출력: `11,343`
- 모델별 집계: input `10`, output `22,221`, cache read `133,376`, cache creation `43,344`

제공자 집계가 명령의 상한보다 늦게 확정되어 소액 초과가 관측됐다. 자동 증액이나 동일 목적 Opus
호출은 하지 않았고, 새 사람 결정 전 외부 검수 호출을 중지한다.

## 원본 결속

| 원본 | SHA-256 |
|---|---|
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-001/task.json` | `e74e57d2f1468631f6c4510f3dd8bb3bf5eaf72830018b61faed72fcd314420c` |
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-001/status.json` | `31b963b94ae8178d4fce0796642b19f4ad25eaffd186add086618a367d4e057c` |
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-001/rounds/r001/manifest.json` | `cc00c4e12ef484a11e3873bb776600e49be29bf63ae4af01022460d40c3c7faa` |
| `docs/ai-review/tasks/AI-ORCH-PLANS-BUNDLE-A-FABLE-001/rounds/r001/run.json` | `6988c004fdc4e6e5d1be7c2566a98f945f24c6b9a00f62e9de960bc8fa43fddf` |

검수 입력 manifest는 다섯 공식 기획안의 exact SHA와 `WORKING_TREE_HASHED` 스냅샷을 보존한다.
실패 후 공식 기획안 바이트는 수정하지 않았다.

## 단계 상태

- 1~4단계: 내부 작성·정합성 기준 `completed`
- 5단계: 공식본 `DRAFT_READY`, Sol high 재검수 PASS, Fable 게이트 미통과로 `active`
- 6~12단계: `pending`

후속 선택은 추가 exact USD 상한의 compact Fable 재시도 또는 사용자가 별도로 지시하는 Opus successor다.
어느 선택도 이 실패 실행을 검수 승인으로 바꾸지 않는다.
