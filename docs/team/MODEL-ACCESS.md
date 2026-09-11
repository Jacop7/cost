# Fable · Opus 11개 채팅 모델 접근 계약

> 상태: `CONFIRMED`
>
> Decision: `DEC-MODEL-ACCESS-ALL-11-001`
>
> 범위: `docs/team/chats/`의 공식 11개 chat manifest

## 1. 공통 허용

Claude Fable과 Claude Opus는 공식 11개 채팅 모두에서 호출할 수 있다. 호출은 해당 채팅의
`authority_links`, 확정 Task, 현재 봉인된 model-plan SHA 및 Task별 edit lease를 넘지 않는다.
두 모델은 원시 대화, 계정 식별자, 비밀값, 운영 자격 증명을 route·검수·영수증에 넣지 않는다.

이 계약은 채팅 간 자동 메시지 전송, 새 채팅 생성, 사람 승인 대행, DB·배포·운영 mutation 권한을
만들지 않는다. Mission Relay의 1.7 rollover와 Project Orchestrator의 봉인 계획은 각 채팅에
독립적으로 계속 적용된다.

## 2. 편집과 독립검수의 분리

| 사용 목적 | Fable | Opus | 필수 경계 |
| --- | --- | --- | --- |
| 조언·발견·문서 독해 | 허용 | 허용 | 읽기 전용, Task 포인터에 결과를 남김 |
| Task 산출물 편집 | 허용 | 허용 | `CONFIRMED` Task, edit lease, canonical authority path 안에서만 허용 |
| 독립검수 | 기본 엔진 | Fable의 구조화된 rate/capacity/budget 승계 때만 | 검수 대상 산출물을 편집한 같은 모델·세션은 독립 PASS를 낼 수 없음 |

Fable 또는 Opus가 maker로 편집한 경우에는 다른 독립 세션·모델 또는 사람이 검수 역할을 맡는다.
동일 모델을 다시 쓰더라도 이전 editor session, 편집 diff, reviewer session을 분리해 audit 원본에
남긴다. 필수 독립검수의 Fable 우선·Opus 승계 조건은 `AGENTS.md`와 봉인 model plan이 우선한다.

## 3. 채팅별 실행 한계

| 채팅 | Fable·Opus 허용 범위 | 금지 또는 추가 게이트 |
| --- | --- | --- |
| 01 통합 작업큐 · 사람 결정 | 조언·Task/Decision 초안 | 사람 Decision 대행·승인 추정 금지 |
| 02 마스터 오케스트레이션 | 작업 그래프·route 근거 작성·검토 | 확정 없는 dispatch 금지 |
| 03 부 오케스트레이션 | 컨텍스트·토큰·HANDOFF 점검, lease 범위 편집 | route 재정의·자동 채팅 생성 금지 |
| 04 개발·스테이징 배포 검증 | 비운영 검증·증거·후보 문서 편집 | 운영 DB/비밀키/배포 실행 금지 |
| 05 운영 배포 · 복구 게이트 | 읽기 감사·Go/No-Go 증거 정리 | 사람 승인, exact SHA, 보호 CI, 복구 게이트 없는 mutation 금지 |
| 00 모든 팀 상황실 | 조언·독립 읽기 검수만 | 편집·Task 배정·승인 권한 금지 |
| 01 Product · Mobile | 제품·모바일 Task의 lease 범위 편집·검토 | 승인되지 않은 제품 정책 변경 금지 |
| 02 Data · Backend | DB 설계·migration 후보의 lease 범위 편집·검토 | 운영 적용·계산 불변식 무단 변경 금지 |
| 03 Server · Supabase · Operations | 운영 문서·비밀 없는 검증 산출물 편집·검토 | 운영 환경 mutation은 사람 게이트 필수 |
| 04 Quality · Review | maker와 분리된 독립검수, 검수 Task 산출물 편집 | self-review 대체·대상 산출물 직접 수정 금지 |
| 05 Knowledge · Orchestration | 공식 권위 문서의 lease 범위 편집·검토 | 경쟁 공식본 생성·권위 우회 금지 |

## 4. 호출 영수증과 중단

- 호출은 `task_id`, 목적(`maker`·`advisory`·`independent-review`), target SHA 또는 canonical path,
  모델·세션 분리 정보, 결과 포인터만 남긴다.
- 범위·lease·봉인 plan SHA가 없거나 일치하지 않으면 호출 또는 편집을 `BLOCKED_POLICY`로 기록하고
  02 마스터 오케스트레이션에 회신한다.
- provider 제한 또는 전달 실패는 `FAILED_TRANSIENT`로 기록한다. 이것이 Fable 독립검수 승계 조건을
  만족할 때만 Opus로 바꿀 수 있으며, 두 모델을 같은 검수 목적으로 동시에 호출하지 않는다.
- 사람은 언제든 외부 모델 호출을 중단할 수 있다. 중단은 새 호출과 편집만 막고 기존 audit·Task·route
  영수증은 삭제하거나 되감지 않는다.
