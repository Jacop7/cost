# 휴대형 AI 팀 서비스 아키텍처 v0.1

상태: `DRAFT_FOR_FABLE_REVIEW`

이 문서는 다른 PC와 다른 프로젝트에서 설치 직후 안전한 초기 상태까지 재현되는 AI 팀 서비스의
공통 설계다. 실제 채팅 발송이나 운영 권한을 부여하는 문서가 아니다. 구현·설치·활성화는 각각
별도 후보 SHA와 검수·사람 Decision을 요구한다.

## 1. 목표와 완료 정의

설치 직후 다음이 자동으로 가능해야 한다.

1. 호스트·모델·실행환경·기존 플러그인 호환성을 진단한다.
2. 대상 저장소에 프로젝트별 계약과 역할 manifest를 결정적으로 생성한다.
3. 같은 입력은 다른 PC에서도 같은 Git 추적 파일 해시를 만든다.
4. 무발송 harness가 `dispatch_attempts=0`, `actual_provider_calls=0`을 증명한다.
5. 호스트 증거 수준에 맞는 capability tier를 봉인하고 그보다 강한 동작을 거부한다.

`설치 성공`은 실제 채팅 왕복 성공이 아니다. 실제 왕복은 별도 ACK-only probe와 파일럿을 통과한
경우에만 해당 tier의 표현으로 보고한다.

## 2. 기본 조직 profile

기본 profile은 다음 11개 논리 채팅을 제공하되 개수와 명칭은 프로젝트 adapter가 바꿀 수 있다.

- 사람 결정: `01 통합 작업큐 · 사람 결정`
- 전체 CEO: `02 마스터 오케스트레이션`
- 서비스 총괄: `03 부 오케스트레이션 · 토큰/컨텍스트 관리`
- 배포 게이트: `04 개발·스테이징 배포 검증`, `05 운영 배포 · 복구 게이트`
- 팀 그룹: `00 모든 팀 상황실`, `01 Product · Mobile`, `02 Data · Backend`,
  `03 Server · Supabase · Operations`, `04 Quality · Review`, `05 Knowledge · Orchestration`

기본 업무 흐름은 `사람 → 마스터 → 부 오케스트라 → 상황실/각 팀`이다. 팀 간 허용 edge와
문제 발견 시 사람 escalation을 지원한다. 상황실은 집계·가시화 표면이며 업무 완료의 필수 병목이
아니다. 채팅 제목은 권한을 만들지 않는다.

## 3. 세 층 분리

### 3.1 전역 플러그인 본체

읽기 전용으로 배포되는 버전 봉인 계층이다.

- plugin manifest와 skill
- 계약 schema·기본 profile·템플릿
- doctor·init·verify·migration·recovery helper
- 4개 기존 플러그인 호환 매트릭스
- 무발송 harness와 acceptance test

프로젝트 이름, 실제 경로, 계정, 비밀, thread/endpoint ID를 포함하지 않는다. 새 플러그인을 제거해도
기존 4개 플러그인이 각자 이전 의미로 동작해야 한다.

### 3.2 프로젝트 생성 파일

Git으로 추적할 결정적 계층이다.

```text
.codex/team-service/
├─ project-profile.json
├─ compatibility.json
├─ capability-policy.json
├─ acceptance.json
├─ CURRENT.json
├─ generated-files.json
├─ known-open.json
└─ chats/
   └─ <logical-chat-id>.json
```

상대 경로와 논리 ID만 허용한다. 실제 endpoint, 계정 식별자, 절대경로, 비밀, 원시 대화를 금지한다.
init은 기존 파일을 덮어쓰지 않고 생성 계획과 충돌 목록을 먼저 출력한다. 같은 profile·schema·template
SHA 입력은 byte-identical 출력을 만들어야 한다.

### 3.3 사용자 전용 runtime

Git 밖의 사용자 ACL 보호 계층이다. Windows는 KnownFolder LocalAppData 아래
`Codex-Team-Service/<project-id>/`를 사용한다. macOS/Linux는 별도 OS adapter 검증 전까지
`UNVERIFIED_PLATFORM`이다.

- 실제 thread/endpoint binding과 HMAC reference
- capability tier 판정과 근거 hash
- install receipt·activation receipt·epoch
- raw tool response와 관측 참조
- 미확인 outbox·dedupe·lock·recovery checkpoint

runtime 값은 프로젝트 생성 파일로 역류하지 않는다. runtime이 사라지면 자동 재생성·상향 복구하지
않고 `RUNTIME_RESTORE_REQUIRED`로 실패 폐쇄한다.

## 4. 공통 플러그인의 소유 범위

새 플러그인의 역할은 **제공·대체가 아니라 조합·검증**이다.

| 기능 | 단일 소유자 | 공통 플러그인의 허용 행동 |
| --- | --- | --- |
| 채팅별 1.7 계산·HANDOFF·Study Gate | Mission Relay | 영수증 schema/version/hash 확인 |
| 모델·추론·검수·가중 토큰 계획 | Project Orchestrator | 봉인 계획을 읽고 호환성 확인 |
| route edge·dedupe·endpoint generation·activation | Team Router | policy/receipt를 읽고 무발송·tier 조건 확인 |
| 동일 소유자 계정 연속성 | Account Continuity | 계정 변경이 보고된 경우 검증 영수증 참조 |
| profile·adapter·tier doctor·설치 영수증·자가감사 | 공통 플러그인 | 직접 소유 |

공통 플러그인은 네 플러그인의 정책, plan, receipt, budget, endpoint를 생성·수정하지 않는다.

## 5. 필수 15개 구성요소

초기 8개 구성에 Fable 1차 차단 7개를 합쳐 다음을 최소 패키지로 고정한다.

1. 조합·검증 전용 공통 플러그인 본체
2. 충돌 감지·무덮어쓰기 프로젝트 init
3. 팀·역할·edge·문서 경로 project adapter
4. Codex·모델·host API·ACL·경로·Node/Python·Shell doctor
5. 기본 `SIMULATION_ONLY`와 exact 승인 뒤 단계적 활성화
6. Git 밖 사용자 ACL runtime
7. schema migration·rollback·구 epoch 감사 보존
8. 샘플 프로젝트·자동시험·운영 매뉴얼
9. 근거와 함께 봉인되는 capability tier
10. 기존 4개 플러그인 version/schema compatibility matrix
11. plugin·project files·runtime·doctor 결과를 묶는 `install-receipt.json`
12. AC-24형 전이적 import closure 무발송 harness
13. candidate/review/Decision/epoch를 묶는 activation envelope
14. Bash marker·exit 보존·Node/Python·Unicode·CRLF 실행환경 probe
15. 생성된 역할 manifest와 edge의 요구 coverage 자가감사

## 6. capability tier 계약

doctor가 tool schema와 관측 결과에서 tier를 계산하고 runtime에 hash와 함께 봉인한다. 설정 파일이나
사용자 문자열만으로 상향할 수 없다.

doctor의 고정 입력은 `send_message_to_thread`, `read_thread`, `wait_threads`, `create_thread`의 tool
schema, caller/receipt/send-fence/trusted-time 필드 matrix, exact `HOST-SCOPE-<N>` 결과 SHA다. doctor는
이 과정에서 실제 send/create를 호출하지 않는다. 같은 입력은 같은 tier hash를 내야 한다.

| tier | 허용 | 금지 및 표시 |
| --- | --- | --- |
| `LOCAL_CORE_ONLY` | Task 정규화, event chain, intent/effect CAS, outbox/replay, blocker, 로컬 STOP, simulation | provider send 0. `로컬 조정만 가능` |
| `COOPERATIVE_OBSERVED` | 축소 신뢰 Decision 후 ACK-only probe와 관측 왕복 | strict ACK/DELIVERED/COMPLETED 금지. `OBSERVED`, 오관측 시 의존 결과 재개방 |
| `AUTHENTICATED` | 양성 host scope가 증명한 범위의 인증 왕복 | 증명되지 않은 필드는 `UNVERIFIED`; 전체 assurance는 가장 약한 필수 leg |

공통 결과 어휘는 `UNVERIFIED`, `OBSERVED`, `ATTESTED`다. `APP_QUEUED`는 완료가 아니며
`사람 방 게시 관측`은 사람이 읽거나 승인했다는 뜻이 아니다. `완전 자동 왕복` 표현은
`AUTHENTICATED` 외에서 금지한다.

tier 집행 지점은 bootstrap 자체 명령에 한정한다. activation envelope 검증기는 runtime의
`sealed_tier`를 읽고 `PROBE_ONLY`는 최소 `COOPERATIVE_OBSERVED`, strict `PILOT`은
`AUTHENTICATED`가 아니면 거부한다. `verify-install`과 `dry-run`은 Team Router policy의
`dispatchEnabled`, activation receipt, sealed tier를 대조하고 불일치를 `TIER_POLICY_INCONSISTENT`로
종료한다. 실제 Router 스위치는 Team Router만 소유한다.

## 7. 설치와 활성화 수명주기

```text
plugin install
  → doctor/preflight
  → compatibility fail-closed
  → init --plan
  → init --apply (no overwrite)
  → install receipt seal + verify
  → routing coverage audit
  → no-send harness
  → SIMULATION_ONLY
  → 별도 후보·검수·사람 Decision
  → PROBE_ONLY 1회
  → 별도 파일럿 Decision
  → PILOT
  → 범위 내 운영
```

활성화 envelope는 `candidate_manifest_sha256`, `review_receipt_sha256`,
`human_decision_sha256`, `sealed_tier`, `epoch_id`, `previous_epoch`, `expected_epoch`를 포함한다.
runtime의 단일 `current_epoch`를 expected 값과 CAS로 소비한다. Decision은 자기 SHA를 포함하지 않으며,
이미 승인된 envelope를 다른 candidate SHA나 epoch에 재사용할 수 없다.

## 8. 호환성과 실행환경

호환 매트릭스는 각 기존 플러그인의 지원 version 범위, 소비 schema, 필수 명령/파일, 불일치 처분을
선언한다. 한 항목이라도 지원 범위 밖이면 `INCOMPATIBLE_DEPENDENCY`로 멈춘다.

각 dependency는 `consumes`에 실제 artifact, schema selector, 검증 명령/sidecar 방식을 기계 판독형으로
선언한다. cachebuster를 포함한 현재 판본은 호환 시험 전까지 exact version만 허용한다.

Shell probe는 실행 전에 실제 자식 프로세스로 marker와 exit code를 확인한다. PowerShell을 Bash로
해석하지 않는다. v1 Windows 기준 Node `>=24.15.0 <25`, Python `>=3.13 <3.14`, TypeScript `5.9.x`,
`--experimental-vm-modules`, Unicode 경로, CRLF/LF 정책을 검사한다.

라우팅 coverage의 요구 집합은 전역 검사기에 하드코딩하지 않고 project profile의
`edge_requirements`가 소유한다. 감사기는 profile↔생성 manifest↔Team Router policy를 삼자 대조한다.
기본 profile에서 Quality 팀도 peer consultation에는 참여하지만 그 결과는 독립검수나 업무 배정 권한을
충족하지 않는다. 운영 게이트의 반환 kind가 `VERIFIED_STATUS`인 것은 일반 `TASK_RESULT`와 구분하기
위한 의도된 비대칭이다.

## 9. 업데이트·삭제·복구

- migration은 schema version별 forward/rollback을 제공하고 왕복 hash 시험을 한다.
- 새 epoch만 새 send를 만들 수 있고 구 epoch는 수신·감사만 유지한다.
- uninstall은 프로젝트 생성 파일을 자동 삭제하지 않는다. runtime은 백업·폐기 선택을 명시한다.
- plugin source 유실은 재제작 설계서로 복구하고, runtime 유실은 endpoint 재결속과 새 영수증 없이는
  복구 완료를 선언하지 않는다.
- 공급망 입력은 release manifest, dependency lock, 파일 SHA 목록으로 고정한다.
- init은 `.gitattributes`와 `.gitignore` 제안을 생성하고, verify는 추적 root 아래 runtime 성 파일이
  0개인지 검사한다.

## 10. 완료 전 금지 주장

이 설계의 작성·검수만으로 플러그인 구현, 다른 PC 설치, 11개 채팅 연결, 실제 발송, 운영 준비,
host identity/receipt 제공을 주장하지 않는다.
