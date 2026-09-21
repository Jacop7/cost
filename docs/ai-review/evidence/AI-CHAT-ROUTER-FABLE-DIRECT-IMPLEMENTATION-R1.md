# Team Router 구현 — Fable 직접 독립검수 R1

> 상태: `ADVISORY · READY_FOR_IMPLEMENTATION_ONLY · NOT_AN_OFFICIAL_FABLE_VERDICT`
> 실행일: 2026-09-04
> 모델: `claude-fable-5`
> Claude Code: `2.1.259`
> 비용: `$3.366744`
> 실제 채팅 전송/생성: 없음

정식 `pnpm fable:review` 실행기는 Claude Code `2.1.248|2.1.250` allowlist 때문에 현재 설치본
`2.1.259`를 모델 호출 전에 차단한다. 이 기록은 새 Fable 세션의 Read/Glob/Grep 전용 직접 검수이며
공식 protocol PASS나 외부 gate 종결을 대체하지 않는다.

## 판정

Fable은 현재 `ACTIVE_IMPLEMENTATION_ONLY` 승인을 차단하는 Finding은 0건이라고 판정했다. 실제
dispatch 활성화 전 필수 Medium 4건과 Low 6건을 제시했다.

| Finding | 심각도 | 요지 | R1 판정 |
|---|---|---|---|
| FTR-001 | Medium | attempt 동결로 retry 상한 우회 가능 | 활성화 전 필수 |
| FTR-002 | Medium | policy 없는 append-event로 전달 계열 원장 작성 가능 | 활성화 전 필수 |
| FTR-003 | Medium | verify-chain이 schema·상태 의미를 재검증하지 않음 | 활성화 전 필수 |
| FTR-004 | Medium | successor receipt가 자기주장이고 동일 handoff 재사용 미차단 | 활성화 전 필수 |
| FTR-005 | Low | human relay에 activation Decision ID 미강제 | 활성화 전 필수 |
| FTR-006 | Low | Windows에서 HMAC key ACL 보호 한계 미문서화 | 보완 권고 |
| FTR-007 | Low | JSON 중복 key·NFC key 충돌 무음 병합 | 보완 권고 |
| FTR-008 | Low | PowerShell 큰따옴표 here-string이 백틱을 소비 | 보완 권고 |
| FTR-009 | Low | validator 선택 실행·절대경로 테스트·부정 경로 누락 | 활성화 전 필수 |
| FTR-010 | Low | design SHA 실파일 미대조·policy schema delta 미문서화 | 보완 권고 |

Fable 원문 최종 판정:

`FINAL VERDICT: READY_FOR_IMPLEMENTATION_ONLY`

## Codex 반영

R1 뒤 10건 모두 같은 구현에 반영했다. retry 단조 증가·종결, policy-aware append, 의미형 chain 검증과
checkpoint tail, Mission Relay 실파일/sidecar/상태/회차 검증, 동일 handoff 재사용 차단, relay Decision,
Windows key 한계, JSON 충돌 거부, 설치 here-string, 독립 fixture와 31개 시험, design path/hash 대조를
추가했다. 다음 Fable 회차에는 전체를 다시 보내지 않고 이 변경분과 시험 결과만 재검수한다.
