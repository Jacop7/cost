# Team Router 구현 — Fable 직접 변경분 재검수 R2

> 상태: `ADVISORY · READY_FOR_IMPLEMENTATION_ONLY · NOT_AN_OFFICIAL_FABLE_VERDICT`
> 실행일: 2026-09-04
> 모델: `claude-fable-5`
> Claude Code: `2.1.259`
> 비용: `$2.024283`
> R1+R2 누적 직접검수 비용: `$5.391027`

## 판정

Fable은 R1의 `FTR-001`~`FTR-010`을 모두 `CLOSED`로 판정했고, 현재 구현 승인 차단 Finding은
0건이라고 재확인했다. 실제 dispatch 활성화는 승인하지 않았다.

| Finding | R2 상태 |
|---|---|
| FTR-001 retry attempt·종결 | `CLOSED` |
| FTR-002 policy-aware append·kill-switch | `CLOSED` |
| FTR-003 의미형 chain·exported tail | `CLOSED` |
| FTR-004 Mission Relay 실증거·동일 handoff 차단 | `CLOSED` |
| FTR-005 relay activation Decision | `CLOSED` |
| FTR-006 Windows HMAC key 한계 문서화 | `CLOSED` |
| FTR-007 중복/NFC JSON key | `CLOSED` |
| FTR-008 PowerShell here-string | `CLOSED` |
| FTR-009 validator·독립 fixture·부정 시험 | `CLOSED` |
| FTR-010 design path/hash·schema delta | `CLOSED` |

새 `FTR-011`은 Low 보완 권고였다. `resolve()` 뒤의 symlink 검사는 실효가 낮으므로 resolve 전 원본
경로의 모든 구성요소에서 symlink와 Windows reparse point를 거부하라는 내용이다. R2 직후
`reject_reparse_components`를 추가해 design·handoff·successor·restore·Study Gate·sidecar를 resolve
전에 검사하도록 반영했다. 이 변경은 권한을 늘리지 않는 fail-closed 강화이므로 추가 외부 호출 없이
로컬 회귀검사로 확인한다.

Fable 원문 최종 판정:

`FINAL VERDICT: READY_FOR_IMPLEMENTATION_ONLY`

정식 runner는 버전 allowlist 때문에 여전히 실행 전 차단되므로 이 기록은 공식 protocol PASS가 아니다.
