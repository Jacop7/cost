# DEC-TEAM-ROUTER-DISPATCH-001 후보

> 상태: `APPROVED · IMPLEMENTATION_ONLY · DISPATCH_INACTIVE`
>
> 승인자 후보: `HUMAN-CHIEF`
>
> 최초 승인 설계 SHA-256:
> `2e4a22ba69844dfdba1a2e23fb5797ede96e43a6bb3346e7f74bd765eda684a4`
>
> Fable 구현검수 Finding 반영 후 전진 정정 SHA-256:
> `83baffef091d646180e20d6e04316f8653cf9c99490030571093027031942b91`
>
> Fable 직접 delta 자문: `READY_FOR_HUMAN_DECISION`, R5
>
> 사람 판정: `APPROVE_IMPLEMENTATION_ONLY`, `2026-09-04 Asia/Seoul`

## 결정 질문

v0.4 Router 계약을 기준으로 11개 chat manifest v2, 별도 `Codex-Team-Router` 로컬 플러그인,
무발송 simulation과 sabotage test 구현을 승인할 것인가. 실제 채팅 발송 활성화는 구현·시험·공식 검수
증거가 같은 exact SHA에 결속된 뒤 별도 활성화 항목으로 판단한다.

## 권장 결정

`APPROVE_IMPLEMENTATION_ONLY`

승인 범위:

- 11개 manifest의 전역 논리 chat ID, `accepts_from`, `sends_to`, edge별 message kind schema v2
- `C:\Codex-AI-Operations\Codex-Team-Router` 별도 플러그인 scaffold
- envelope·route JSONL chain·canonical hash·lock·CAS·dedupe·kill-switch의 로컬 구현
- Mission Relay 영수증을 읽는 successor binding adapter
- `SIMULATION_ONLY`와 정상·변조·경합·rollover sabotage test
- `.codex/team-router/policy.json` 생성. 기본값은 `dispatchEnabled=false`,
  `humanRelayEnabled=false`

승인하지 않는 범위:

- 실제 task 메시지 전송과 `ACTIVE_DISPATCH`
- 실제 `HUMAN_RELAY`
- 자동 새 task 생성
- Mission Relay·Project Orchestrator·Account Continuity 정책 수정
- 제품 코드, DB, Supabase, staging, production, 비밀키, 외부 서비스 mutation
- git commit·push·merge와 배포

## 활성 dispatch의 별도 조건

다음이 모두 충족된 exact implementation SHA에 별도 `ACTIVATE_NON_PRODUCTION_DISPATCH` 사람 결정이
있어야 `dispatchEnabled=true`를 고려할 수 있다.

1. 11개 manifest v2와 문서 그래프 검사 통과
2. shared-runtime lock·CAS·dedupe preflight 통과
3. generation 경합·이중 successor·조기 활성화·변조 sabotage test 통과
4. Mission Relay `HANDOFF_SEALED → link-successor → RESTORE_VERIFIED → STUDY_GATE_PASSED` adapter 증거
5. Fable 공식 독립검수의 필수 OPEN Finding 0건
6. 비운영 R0 파일럿의 사람 승인

운영·DB·배포 route는 이 결정으로 열리지 않는다.

## 가능한 사람 판정값

- `APPROVE_IMPLEMENTATION_ONLY` — 권장. 무발송 구현·시험만 착수
- `HOLD` — 후보와 증거만 보존
- `REJECT` — 이유를 DecisionPointer로 기록하고 구현하지 않음

`착수`, `진행` 같은 일반 지시는 이 후보의 존재와 pre-decision 작업을 허용하지만, 위 판정값이나 동등한
명시적 표현 없이 Router 구현 승인 또는 실제 발송 승인으로 확대 해석하지 않는다.
