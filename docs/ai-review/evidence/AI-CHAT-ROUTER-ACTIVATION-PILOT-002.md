# Team Router 활성화·격리 재파일럿 결과 002

> 완료일: 2026-09-04
>
> Decision: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
>
> 범위: 11개 Codex 작업 간 allowlist 비운영 메시지 운반
>
> 최종 상태: `ACTIVE · ISOLATION REPILOT PASS`

## 활성화 결과

- Team Router 설치 판본: `0.1.0+codex.20260903223631`
- 프로젝트 policy: `ACTIVE_DISPATCH`, `dispatchEnabled=true`, `humanRelayEnabled=false`
- manifest: 11 chats, 21 reciprocal edges
- runtime endpoint: 11개 모두 generation 1
- runtime ACL: inheritance protected, 현재 Windows 사용자와 SYSTEM만 FullControl
- 제품·DB·Supabase·git·staging·production·배포 mutation: 없음
- staging/production gate message kind: 별도 Decision 전 `BLOCKED_POLICY`

## 정식 Fable

| Task | 결과 | 비용(USD) | 의미 |
|---|---:|---:|---|
| `AI-CHAT-ROUTER-ACTIVATION-002` | `RUN_FAILED` | `8.383760` | 불필요하게 큰 runner 원문 입력으로 soft cap 소진, verdict 없음 |
| `AI-CHAT-ROUTER-ACTIVATION-003` | `PASS` | `2.862472` | 활성화 계약 필수 Finding 0 |
| `AI-CHAT-ROUTER-ISOLATION-004` | `CHANGES_REQUIRED` | `2.354175` | prompt-only 격리의 기계적 강제 부족 발견 |
| `AI-CHAT-ROUTER-ISOLATION-005` | `PASS` | `2.647874` | scope lock·설계 v0.5·갱신 bytes 증거, 필수 Finding 0 |

이번 활성화 정식 Fable 누적은 `$16.248281`이다. 첫 실패 원본과 비용을 삭제하거나 성공으로 바꾸지 않는다.

## 최초 실제 왕복과 발견 사항

1. `MASTER-01-HUMAN-DECISIONS → MASTER-02-ORCHESTRATION`, `REQUEST`
   - route: `ROUTE-55205809-2ad2-449a-8bd3-78d750f0c896`
   - 결과: 동일 delivery token `TEAM_ROUTER_ACK`, `DELIVERED`
   - chain: 6 events, tail `9b80c97a24d13d697d244ae768a9092262571be49fe86089286208d83889e7e3`
2. `MASTER-02-ORCHESTRATION → MASTER-01-HUMAN-DECISIONS`, `AGGREGATE_RESULT`
   - route: `ROUTE-1ab3b6e8-2224-43f8-9cd8-51999cdb1b28`
   - 결과: `DELIVERED`
   - chain: 6 events, tail `0ef904fa223c5a4188759ceeafae1c2a68344b7de61ba8bbb136bb3b4fce9d84`

두 번째 수신에서 01이 ACK 뒤 과거 대화의 별도 DB Decision을 새 `DECISION_POINTER`로 한 번 더 보냈다.
해당 route는 `ROUTE-a8877d01-77cf-4059-b768-614b872977b8`, 6 events, tail
`e55c978325cd393c186ce2ad695b27ee57af34a7987a5bbe3fb3a914a8761b74`이며 02는 ACK만 반환했다.
DB·Supabase·git·배포 mutation은 없었다. 이 예상 밖 route를 숨기지 않고 격리 결함으로 처리했다.

## 기계적 격리와 재파일럿

- 발송 준비 시 target logical chat에 `scope_isolation` runtime lock을 먼저 만든다.
- `child_routes_allowed=false` scope가 ACK 전 활성인 동안 해당 수신 chat의 새 `prepare-dispatch`는 허용
  edge라도 `BLOCKED_POLICY` event를 남기고 거부한다.
- sabotage test `test_active_no_child_scope_blocks_unrelated_allowed_route_until_ack` 포함 Router `36/36 PASS`.

재파일럿:

- route: `ROUTE-a8524761-178e-4ccb-b172-154b4406cc25`
- kind: `AGGREGATE_RESULT`, `child_routes_allowed=false`, `expected_response=TEAM_ROUTER_ACK`
- route 파일 수: 준비 전 `3`, 준비 직후 `4`, 수신 완료 후 `4`
- 추가 route: `0`
- 수신 작업 추가 도구 호출·out-of-band 발신: `0` (`latestToolMarkerId=null`)
- ACK: 동일 delivery token 한 줄만 반환
- scope: `ACTIVE → ACKED`
- chain: 6 events, tail `7470d779da8a08fd44653d69b8d282e24dd8a3edfce32e86bcc90b5de40c81f7`

따라서 11개 endpoint의 비운영 자동 라우팅은 활성 상태이며, ACK-only envelope의 과거 문맥 재개와
묵시적 child route는 재파일럿 기준으로 차단됐다. 명시적 다단계 업무는 source가
`child_routes_allowed=true`로 봉인할 때만 다음 leg를 만들 수 있다.
