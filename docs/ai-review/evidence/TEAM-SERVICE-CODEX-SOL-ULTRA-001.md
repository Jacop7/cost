# Codex 실행 검증 + Sol ultra 교차검수

날짜: 2026-09-05. 사용자 요청: 현재 담당자와 Sol ultra가 테스트한다.
범위: 팀 서비스 workflow·정적 요구 감사·관련 시험. 결과: **CHANGES_REQUIRED / 실서비스 미완료**.

## 실행 구분

- 주담당: 관련 시험 재실행, 식별자·멱등성 반례, 5개 팀 JSON 체크포인트 왕복, 실제 호출부 검색.
- 교차검수: 사용자 지정 `gpt-5.6-sol`, `ultra`로 별도 subagent 실행. 전체 대화는 전달하지 않고
  범위·사용자 조직 요구·안전 제한을 전달했다. Sol의 하위 읽기 전용 검토 2개가 추가 실행됐으며,
  주담당이 추가 확장을 중단하고 확보된 결과로 종합하도록 요청했다.
- Sol은 최종 비교 전 독립 분석을 수행했으나 기존 C1/C2가 문서 검색에 먼저 노출됐다고 명시했다.
  따라서 두 항목은 독립 신규 발견이 아닌 **별도 재현 확인**으로 기록한다.
- 이 요청의 읽기 전용 교차시험을 기존 팀 라우팅 실행 모델 전환으로 취급하지 않았다.
  `.codex/mission-relay/model-plan.json`은 MODEL_PLAN_VERIFIED,
  SHA `60d7cb6a85cc43a76532f9047bcc5c4ed5113ebc3fd1708b0c954da91f85d96e`이며 변경하지 않았다.
  Sol ultra의 비용 가중치는 보정하지 않았고 이 호출로 1.7 경제성 판정을 계산하지 않았다.
- Fable/Opus 유료 호출, 공식 독립검수 게이트 변경, endpoint 재결속, 실제 채팅 발송은 하지 않았다.
  이전 Opus 시간 초과 원본은 보존하며 Sol 결과를 Opus PASS로 바꾸지 않는다.

## 시험 결과

| 검사 | 주담당 | Sol |
| --- | --- | --- |
| workflow + 정적 요구 감사 + 기존 docs graph | 42/42 PASS | 앞의 두 모듈 16/16 PASS |
| Team Router Python | 38/38 PASS | 중복 실행 안 함 |
| 실제 프로젝트 요구 감사 | REQUIREMENTS_NOT_MET, 44개 finding | 같은 결과, CLI exit 1 |
| 5개 팀 각각 JSON 직렬화/복원 포함 왕복 | 5/5 COMPLETED, 각각 revision 18 | 기본 단일팀 경로와 대체 경로 부재 확인 |
| 배열 taskId | acceptedArray=true | arrayTaskIdAccepted=true |
| 같은 event의 key 순서 변경 | EVENT_ID_CONFLICT | 같은 결과 |
| blocker 보고 후보 이후 전송/재개 | INVALID_SEND_STATE / UNSUPPORTED_EVENT | 같은 결과 및 상황실 INVALID_BLOCKER |

왕복·반례의 verifier는 테스트용 합성 함수다. 실제 승인·ACK·작업 완료 또는 전송 증거가 아니다.
방금 완료된 전체 `pnpm verify`는 재실행하지 않았다. 앞선 4/6 단계 PASS, 2개 FAIL 기록은
`TEAM-SERVICE-CODEX-TEST-001.final.md`에서 그대로 유지한다.

## 확정 코드 결함

1. **C1 / 중간: 식별자 타입 검사 누락** — `scripts/team-service-workflow.mjs:15`, `:49`.
   정규식이 배열을 문자열로 강제 변환한다. taskId·correlationId·eventId를 문자열로 먼저 검증하고
   배열 및 비문자열 회귀시험을 추가해야 한다. JSON 복원 후 strict equality 실패 가능성이 있다.
2. **C2 / 중간: 비정규 이벤트 hash** — 같은 파일 `:7`, `:50`.
   JSON.stringify 키 순서에 의존해 같은 의미의 이벤트가 재전송 충돌한다.
   허용된 JSON 필드의 canonical serialization과 재직렬화 회귀시험이 필요하다.

## 미구현 요구 — 코드 결함과 별도 분류

1. **실제 전송 연결 없음**: workflow 호출부는 검색 범위 scripts/package.json/.codex/docs/team에서
   해당 시험 외에는 발견되지 않았다. 실제 transport·영수증 검증·영구 outbox·복구 실행기가 필요하다.
2. **대체 경로 없음**: CEO→팀 직접 지시와 deputy 동기화, 팀 간 협업 subflow,
   비차단 상황실 상태 집계 action/event가 없다. 기본 01→CEO→총괄→선택 팀과 역방향 결과는 맞다.
   상황실을 필수 배정 중계로 넣지 않은 것은 결함이 아니다.
3. **차단 보고·재개 lifecycle 단절**: workflow `:31`, `:92`.
   REPORT_BLOCKER 후보는 있지만 전송 기록·ACK·사람 결정 후 resume/retry 전이가 없다.
   현재 leg 양끝이 아닌 역할의 보고도 거부된다. 검증된 참여 역할과 원 Task/correlation/revision에
   연결된 blocker subflow가 필요하다. 현존 보안 우회가 아니라 미완성 실행 계약이다.
4. **실제 manifest 요구 누락 44개**: 상황실 왕복 2, CEO↔5팀 10, 팀→상황실 5,
   방향성 팀 협업 20, 사람01 직접 보고 7. 44개는 코드 버그 개수가 아닌 요구 커버리지 finding이다.
   정책·중앙 validator·manifest·실행기·봉인 증거를 함께 변경해야 하며 manifest만 바꾸면 안 된다.

## 개선 후보 / 과대 판정 제외

- 일부 message kind만 빠져도 감사 finding은 필요한 kind 전체를 출력한다. missingKinds 분리가
  진단을 더 정확하게 하지만 현재 필드가 missingKinds라고 선언된 것은 아니므로 기능 결함과 구분한다.
- TASK/ARTIFACT/RECEIPT prefix 혼용은 재현됐으나 역할별 명시 계약과 실제 verifier가 필요해
  확정 보안 결함 대신 계약 명료화 후보로 남긴다.
- 제안된 COLLAB kind가 현 정책에 없다는 사실은 통합 작업의 잔여 조건이다. 정적 요구 감사는
  명시적으로 STATIC_COVERAGE_ONLY 및 serviceReady=false를 반환하므로 활성화 검증으로 보지 않는다.

## 소스 및 변경 경계

HEAD `6497666e655609a4f4bfe10bfaea6070dad01286`, 브랜치 `codex/ai-team-knowledge-orchestration-plans`.
검사한 소스·시험 네 파일 SHA는 이전 최종 보고서와 동일했다.
이번 회차는 코드 수정·DB reset·브랜치 변경·재봉인·실제 채팅 전송 없이 테스트와 이 증거 기록만 수행했다.

다음 구현 우선순위: C1/C2 회귀시험 및 수정 → blocker 보고/재개 → 실제 adapter/outbox →
CEO·팀 협업·상황실 경로 통합 → 정확한 계약 검수/봉인 및 endpoint 증거 → 실제 비운영 왕복 파일럿.
현재 상태를 전체 완료 또는 자동 팀 운영 정상으로 보고하지 않는다.
