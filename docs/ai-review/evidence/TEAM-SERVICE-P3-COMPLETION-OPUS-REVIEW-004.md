# TEAM-SERVICE P3 completion — direct Opus review 004

- Engine: Claude Opus 5 high, existing Cowork review session
- Route: direct Opus Cowork advisory; formal CLI receipt 아님
- Candidate: `TEAM-SERVICE-P3-COMPLETION-REVIEW-CANDIDATE-004.json`
- Candidate SHA-256: `28deaf950e108fe69edcf1691fc300d74038d41fee0bbbc6e3c729a0b8daf365`
- Verdict: `CHANGES_REQUIRED`
- `p3_completion_may_be_recorded`: `false`
- `p4_prework_may_begin`: `false`
- `service_ready`: `false`
- `real_send_authorized`: `false`

## 구현 판정

Opus는 AC-01/03/06/07/22 구현, live-test 격리, provider 접근 전 거부, 공유 effect-key 유도,
14개 target 및 18개 전이 closure를 실질 통과로 판정했다. 차단 사유는 구현 로직이 아니라 완료
증거의 형식과 등록 결속이었다.

## Blocking findings

1. C-1: 완료 증거 004에 raw TAP 참조와 SHA가 없고 `.tap` 파일도 없었다.
2. C-2: 003 TAP은 원시 stdout이 아닌 정규화 요약이었으며 완료 상태 결속 전 바이트를 대상으로 했다.
3. C-3: 완료 회차가 AC-24 `runs[]`, `active_run_id`, P3 scenario에 등록되지 않았고 음성 시도 횟수도 없었다.
4. C-4: 계약·gate·case row는 003을, 검수 후보는 004를 가리켜 권위가 갈렸다.

## Nonblocking findings

- N-1: 로컬 allowlist의 bugfix 시험이 18개 closure 밖에 있다.
- N-2: 계약이 선언한 `scripts/team-service.live.test.mjs`는 아직 P4+/P9 예정 파일이다.
- N-3: launcher 여섯 술어 중 일부 음성 경로만 provider counter로 시험한다.
- N-4: intake `sendAttempts`는 현재 발송 경로가 없어 상수 0이다.
- N-5: 입장 AST import 검사와 완료 정규식 import 검사가 이원화돼 있다.
- N-6: 주 작업 트리의 `verify.mjs`에는 다른 작업의 미커밋 변경이 있어 clean bundle 실행과 분리해야 한다.
- N-7: P3 gate-owner 결정은 포괄 자동진행 위임을 근거로 한다.
- N-8: completion rerun 표시는 완료 등록 시점에만 닫는 편이 안전하다.
- N-9: CURRENT와 catalog P3 상태를 완료 등록 시 정렬해야 한다.
- N-10: 임시 worktree stage-2 후속 실행은 별도 원시 전사가 없다.

## Required closure

raw 004 TAP 결속, AC-24 완료 run 등록, 모든 003 포인터의 004 정렬, 등록 후 exact bundle 재검증,
stage 3 비회귀 처분을 요구했다. 이 기록은 이후 반영 결과를 PASS로 소급하지 않는다.
