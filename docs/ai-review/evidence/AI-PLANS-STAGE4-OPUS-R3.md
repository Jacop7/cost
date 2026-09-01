# AI 기획안 누적 교차검수 — Stage 4 Opus r3

> 상태: `OPUS_DIRECT_ADVISORY`
> verdict: `CHANGES_REQUIRED`
> 실행일: 2026-09-02
> 모델: `claude-opus-5`
> 세션: `8cee16bc-7b02-4ea7-914f-b9ee5a22c225`
> 대상 commit: `006000bdcb60783cf34f96d83e298e54277d2e0b`
> 대상 tree: `5e7da399e5a1f845188873f66d6af4a332df266f`
> CLI 보고 사용량: `$1.402057` (센트 올림 `$1.41`)
> 승인된 누적 상한: `$22.00` (`$20.00` + 사람 추가 승인 `$2.00`)
> 보수 누적: `$21.37`, 남은 승인 envelope: `$0.63`

## 사람 승인 pin

- Task: `AI-ORCH-PLANS-1`
- turn: `turn-h001` / `t0001`
- decision: `advisory_budget_usd_approved = 2.00`
- collaboration entry SHA-256:
  `2d72ca5aa170abe4ddca710c8d3c6be88da227657a405e15e8a29c3bde91b87c`
- append run의 collaboration after SHA-256:
  `7d17c8e7728252f6b56f4d92defd47bcb9bc61136ec927ddc3f2d54c96f314b5`

호출 직전 빈 MCP 설정을 잘못된 모양으로 전달한 명령은 로컬 CLI가 모델 요청 전에 거부했다.
세션 `b8ce621f-6dc5-4b68-969b-1db27f6b03ec`에는 비용 envelope·모델 결과·검수 판정이 없으며,
advisory 회차가 아니라 실행 전 구성 검증 실패로 보존한다. 실제 모델 호출은 위 세션 한 번이다.

## 기존 Finding 재확인

`QUEUE-LOST-UPDATE-80`, `AUTO-BASELINE-81`, `PLAN-COUNT-82`, `METRIC-ANCHOR-83`,
`LRN-VERIFIER-84`, `LOCK-NEST-86`, `OWNER-LOCK-ORDER-87`은 모두 `RESOLVED`로 판정됐다.

## 신규 Finding

| ID | 심각도 | 필수 | 판정·조치 |
|---|---|---:|---|
| `ADVISORY-BUDGET-88` | Major | 예 | 승인 장부가 실제로 있었지만 이번 Opus 입력 스냅샷에서 빠져 검증자가 확인하지 못했다. 본 증거에 pin hash·회차 비용·누적액을 기록했으나 다음 유효 재검수가 필요하다. |
| `A0-DELEGATE-89` | Minor | 아니오 | 팀 구성안 §4.5에 A0 최소 권한과 평가안 §8의 `DELEGATED_PENDING` 소유 관계를 추가했다. |
| `ONTO-REF-90` | Improvement | 아니오 | 팀 구성안 §3.2의 온톨로지 소유 문구를 `ACTIVE` 승격 뒤로 한정했다. |

## 판정 경계

이번 결과는 기존 Stage 4 r2의 실질 Finding 7건이 해결됐음을 확인했지만, 검수 입력이 승인 pin을
포함하지 않아 `ADVISORY-BUDGET-88`을 남겼다. 따라서 잔여 필수 Finding 0건이나 최종 PASS로
합성하지 않는다. 다음 재검수는 다섯 기획안과 함께 이 증거, `collaboration.md`, `t0001/run.json`을
읽기 전용 입력에 포함해야 한다. 직접 Opus advisory는 이후에도 공식 Fable gate를 대체하지 않는다.
