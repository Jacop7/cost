# AI 채팅 라우팅 실행 초안 — Fable 직접 자문 R1

> 상태: `ADVISORY · NOT_AN_OFFICIAL_FABLE_VERDICT`
>
> 대상: `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md`
>
> 실행 경계: `pnpm fable:review`는 설치된 Claude Code `2.1.259`이 허용 버전 범위 밖이라 실행 전
> 차단됐다. 이 기록은 별도 읽기 전용 Fable 세션의 직접 자문이며 공식 PASS·검수 원본을 대체하지 않는다.

## 자문 판정

`CHANGES_REQUIRED`

## 필수 Finding

1. **Major — MODEL-ACCESS와 자동 발송 충돌.** `MODEL-ACCESS.md`는 자동 메시지 전송 권한을 만들지
   않는다고 하지만 초안은 실제 dispatch를 제안한다. 사람 Decision으로 Router 예외를 먼저 확정하고,
   그 전 파일럿은 발송 없는 ledger 시뮬레이션으로 제한해야 한다.
2. **Major — 11개 manifest에 chat endpoint 계약이 없다.** 현재 `allowed_routes`·`handoff_*`는 역할
   토큰이지 chat ID allowlist가 아니다. `DEPARTMENT-02-DATA-BACKEND`의 결과를 03으로 회신하는
   경로도 현재 명시되지 않는다. `accepts_from`/`sends_to` 같은 논리 chat ID 계약과 11개 delta 표가
   사람 Decision 전에 필요하다.
3. **Major — 공유 route ledger append의 원자성 부재.** 01·02·03이 같은 ledger에 쓸 때 lock 계약이
   없어서 route 중복·attempt 경합이 가능하다. 기존 공통 task lock과 lock 증거를 명시해야 한다.
4. **Major — route/receipt hash chain과 payload canonicalization 부재.** `previous_route_sha256`만으로는
   receipt 누락·순서 변조를 잡지 못한다. 모든 entry의 `previous_entry_sha256`와 UTF-8·키 정렬 JSON
   같은 canonical 직렬화, receipt sabotage test가 필요하다.
5. **Major — rollover 재시도 규칙 모순.** target 변경은 새 `route_id`를 요구하지만 retry는 동일
   `route_id`만 허용한다. target은 불변 논리 chat ID, endpoint는 attempt 때마다 HANDOFF로 해석하며
   rollover는 target 변경이 아니라고 정의해야 한다.
6. **Major — 메시지 API와 발신 주체가 검증되지 않았다.** "기존 Codex 작업 메시지 API"의 근거·권한
   모델이 없고, "수신자가 발송"이라는 표현도 모순이다. 구현 전에 읽기 전용 spike로 API와 발신자
   제약을 확인하고, 발신은 출발 채팅의 활성 에이전트만 한다고 바로잡아야 한다.
7. **Minor — 사람 결정의 04/05 발화 경계.** v0.1이 01발 요청만 등록하고 04/05 사람 결정은 기존
   Decision 포인터로만 참조한다는 범위를 명시해야 한다.

## 선택 개선과 잔여 위험

- 정의 없는 `DEPLOYMENT_DISPATCH`, enum에 없는 `Decision required`, 원시 thread ID 사용을 정리한다.
- Fable 편집 기록에는 Task·목적·target SHA·editor/reviewer session 분리를 남긴다.
- manifest delta의 rollback을 kill-switch와 별도로 정의한다.
- 수신자 측 `route_id`+`payload_sha256` dedupe, retry 상한·kill-switch 경로·활성 작업 판정 경쟁 조건은
  사람 결정을 거쳐야 한다.

## 강점

소유 경계, `BLOCKED_POLICY`/`FAILED_TRANSIENT` 구분, ledger를 보존하는 kill-switch, Mission Relay와
Project Orchestrator를 수정하지 않는 별도 플러그인 범위는 기존 계약과 정렬돼 있다.
