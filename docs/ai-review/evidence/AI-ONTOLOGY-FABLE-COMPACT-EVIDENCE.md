# AI 온톨로지 누적 검수 압축 증거

> 상태: 비권위 검수 증거
>
> 범위: `docs/팀구성_상세기획안.md` v1.3 + `docs/AI-지식-온톨로지-기획안.md` v0.2
>
> 제품·DB·배포 변경: 없음

## 1. 이 문서의 목적과 한계

Fable은 두 공식 기획안의 의미·책임 경계·상호 참조를 검토한다. 시뮬레이터 구현의 실행 정확성은
Codex와 로컬 기계 게이트가 담당한다. 이 문서는 실행 코드 전체를 두 번째 공식본으로 복제하지 않고,
검수에 필요한 소스 결속과 행동 증거만 압축한다.

- 팀 구성안 Git blob: `ce68e2cc85b8973bcb968a8f968a153b65c3dfa0`
- 온톨로지 Git blob: `548f54e25dc46a5f353c4919d4e7ee8e751b7c3e`
- 시뮬레이터 Git blob: `38b932c67846809cb0668cabc27db203a72a85fb`
- 시뮬레이션 시험 Git blob: `6adcfb849e211d2f6cfaf6d87f14926fe1c62f21`
- 실행 명령: `corepack pnpm ai:plans:simulate`
- 2026-09-02 결과: `65/65 PASS`

Git blob과 실행 결과는 검수 시점 target commit에서 다시 확인한다. 이 문서만으로 제품 동작이나
Fable PASS를 주장하지 않는다.

## 2. 앞선 실행 실패와 패킷 축소 근거

| 회차 | 입력 파일 바이트 | 결과 | 실제 사용량 |
| --- | ---: | --- | ---: |
| TEAM-003 r001 | 236,048 | `RESULT_RECEIVED` | USD 2.341082 |
| ONTOLOGY-001 r001 | 391,339 | `RUN_FAILED` · verdict 없음 | USD 2.630461 |
| ONTOLOGY-001 r002 | 391,339 | `RUN_FAILED` · verdict 없음 | USD 1.303113 |
| ONTOLOGY-002 r001 | 391,339 | `RUN_FAILED` · verdict 없음 | USD 3.138931 |

세 실패는 permission denial 없이 구조화 결과를 만들지 못했다. 로컬 `fable:check`, wrapper self-test
50개 묶음, protocol 1.2 시험 22/22는 통과했다. 입력 크기만이 원인이라고 단정하지 않지만, 실패
패킷에 121,969바이트 시뮬레이터 구현과 72,470바이트 시험 전체를 동시에 넣은 것은 문서 구조 감사에
불필요하게 넓었다. 후속 검수에서는 이 압축 증거와 두 공식 문서 자체만 사용한다.

## 3. 검수 축 A — node·edge·권위 경계

Fable이 의미적으로 확인할 질문은 다음으로 제한한다.

1. `HANDOFF`, `ROLE_CONTEXT`, `RELEASE`가 기존 node로 표현할 수 없는 최소 어휘인가.
2. `HANDOFF_TO`가 방향·카디널리티·증거 계약을 가진 최소 관계인가.
3. `TOUCHES`, `BLOCKS`, `DECIDED_BY`, `OWNED_BY`, `ANNOUNCED_IN`을 저장 관계로 추가하지 않은 판단이
   중앙 권위와 파생 탐색을 구분하는가.
4. 팀 구성안의 역할·다섯 팀 그룹·사람 승인 경계와 온톨로지 registry의 소유권이 경쟁 공식본을
   만들지 않는가.
5. 요청 판정 enum `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY`의 단일 권위와 사람 승인 전
   `SUPERSEDE_PROPOSAL` 무효 계약이 일치하는가.

Codex 행동 검증은 다음 위반을 각각 실패시켰다.

- node registry에서 `HANDOFF` 또는 `ROLE_CONTEXT` 제거
- 저장 관계에 `TOUCHES` 재도입
- 중앙 권위 표의 소유자 제거·변경 또는 같은 주제 복제
- 탐색 링크 단절과 권위 DAG 순환
- 코드 블록·HTML 주석을 이용한 가짜 registry·참조 위조

## 4. 검수 축 B — HANDOFF·기억 복원·다중 채팅

Fable이 의미적으로 확인할 질문은 다음으로 제한한다.

1. HANDOFF가 공식 Task·Decision·Risk·Finding의 비권위 snapshot이고 새 공식 기억을 만들지 않는가.
2. L0~L4가 최소 복원을 지키면서도 lease, 사용자 소유 변경, exact commit·Task snapshot hash,
   최신 HANDOFF 판본을 빠뜨리지 않는가.
3. 동일·낮은 HANDOFF 판본, 최신 HANDOFF 무시, source commit 불일치가 실패 폐쇄되는가.
4. Context & Token Steward가 관측·신호만 하고 Task 수정·승인·검수 판정을 대신하지 않는가.
5. 여러 채팅의 요청이 `request_dispositions[]` append로 보존되고 edit lease 소유자만 공식 산출물을
   바꾸는가.

Codex 행동 검증은 다음 위반을 각각 실패시켰다.

- L0~L4 순서 변경 또는 필수 단계 누락
- 동일·낮은 HANDOFF 판본 수용
- lease 소유자 stale prefix 쓰기로 다른 채팅 append 유실
- 만료 lease 자동 인수와 잠금 역순
- 사용자 변경·target SHA·protected gate가 다른 상태의 디렉터리 물질화
- HANDOFF를 공식 정책 또는 감사 원본으로 승격

## 5. 두 축의 결합 조건

두 축은 별도 Fable Task로 읽되 다음 공통 조건을 유지한다.

- 둘 다 팀 구성안과 온톨로지 전체를 `ARTIFACT`로 읽는다.
- 하나는 registry 최소성, 다른 하나는 복원 동작에 집중하지만 서로의 필수 Finding을 덮어쓰지 않는다.
- 두 결과는 같은 artifact blob과 target commit에 결속한다.
- 한 축의 필수 Finding이 열려 있으면 누적 온톨로지 단계는 PASS가 아니다.
- 판정 없는 실패 회차는 유효 검수 횟수로 세지 않는다.
- 두 유효 Fable 결과와 두 Codex 검증, 사람 승인 전에는 후속 기획안을 ACTIVE로 만들거나 실제 팀
  디렉터리·채팅을 물질화하지 않는다.
