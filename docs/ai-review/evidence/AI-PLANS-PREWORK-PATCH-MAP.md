# 컨텍스트 롤오버 v2 → 다섯 기획안 반영 후보표

> 상태: `PATCH_MAP_CANDIDATE v1` · 비권위 선작업
> Task: `AI-ORCH-PLANS-PREWORK-1`
> 입력: `AI-CONTEXT-MISSION-CONTINUITY-V1.md`, `V2.md`, `OPUS-R1.md`
> 제한: 이 표는 반영 위치 후보만 정하며 정책 채택·문서 수정·ACTIVE 승격을 수행하지 않는다.

## 1. 단일 소유 후보

| 요구사항 | v2 근거 | 단일 소유 후보 | 다른 문서의 연결 방향 | 현재 판정 | 승인 주체 |
|---|---|---|---|---|---|
| Mission Continuity Controller 역할·권한 상한 | §0, §2, §3 | 팀 구성안 | 나머지 문서는 역할 ID만 참조 | 결정 대기 | `HUMAN-CHIEF` 재승인 |
| 자동 Session 생성 사전 승인 범위 | §22, §23 | 팀 구성안 | 오케스트레이션은 승인 ID만 소비 | 결정 대기 | `HUMAN-CHIEF` |
| Mission·Session·Event node와 관계 | §4, §6 | 온톨로지 | 오케스트레이션은 상태 ID 참조 | 반영 후보 | `HUMAN-CHIEF` |
| Capsule·Restore/Activation Receipt schema | §9, §13 | 온톨로지 | 디렉터리는 저장 경로, 오케스트레이션은 처리 순서 참조 | 반영 후보 | `HUMAN-CHIEF` |
| Session Chain·고아·거부 Session 관계 | §15, §16 | 온톨로지 | 오케스트레이션이 전이 집행 | 반영 후보 | `HUMAN-CHIEF` |
| capability probe·write-ahead create | §10, §11 | 오케스트레이션 | 온톨로지 schema ID와 디렉터리 장부 경로 참조 | 반영 후보 | `HUMAN-CHIEF` |
| 봉인 중 `INTAKE_ONLY`·pending 입력 | §12 | 오케스트레이션 | 온톨로지는 사건/필드만 소유 | 반영 후보 | `HUMAN-CHIEF` |
| 외부 결정적 Restore Verifier | §13 | 오케스트레이션 | 품질안은 합격 지표만 소유 | 반영 후보 | `HUMAN-CHIEF` |
| fencing lease·`NO_OWNER` 인계 | §14 | 오케스트레이션 | 팀 구성안은 권한 상한, 온톨로지는 lease snapshot 관계만 참조 | 결정 대기 | `HUMAN-CHIEF` |
| 실패 폐쇄·복구 상태 기계 | §16, §19 | 오케스트레이션 | 품질안은 실패율·강등 기준 참조 | 반영 후보 | `HUMAN-CHIEF` |
| Protected Mission Control Store | §7 | 디렉터리 기획안 | 온톨로지는 logical node만 참조 | 결정 대기 | `HUMAN-CHIEF` |
| canonical serialization·worktree fingerprint | §8 | 디렉터리 기획안 | 오케스트레이션은 verifier 함수 ID만 참조 | 반영 후보 | `HUMAN-CHIEF` |
| redacted manifest·원본/색인 보존 경로 | §7, §9.4, §17 | 디렉터리 기획안 | 품질안은 보존 위반 지표 참조 | 결정 대기 | `HUMAN-CHIEF` |
| token 임계·hysteresis·전환 손익 | §5 | 품질 평가안 | 팀 구성안의 Steward는 신호만 소비 | 결정 대기 | `HUMAN-CHIEF` |
| 결정적 시험·실제 A→B→C E2E | §20 | 품질 평가안 | 오케스트레이션 구현과 디렉터리 fixture를 검증 | 반영 후보 | `HUMAN-CHIEF` |
| 복원·중복·손실·비밀·비인가 쓰기 지표 | §21 | 품질 평가안 | 다른 문서는 metric ID만 참조 | 반영 후보 | `HUMAN-CHIEF` |
| Learning 재검증·RETIRED 차단 | §18 | 품질 평가안 | 온톨로지는 Learning 관계 schema만 참조 | 반영 후보 | `HUMAN-CHIEF` |

## 2. Opus Finding disposition 후보

| Finding | v2 반영 | 공식 문서 반영 전 상태 |
|---|---|---|
| `RC-01` 외부 결정적 검증자 | v2 §3·§13 | `CANDIDATE` |
| `RC-02` fencing·NO_OWNER | v2 §14 | `CANDIDATE` |
| `RC-03` write-ahead·capability probe | v2 §10·§11 | `CANDIDATE` |
| `RC-04` Mission 활성 Session 유일성 | v2 §4·§16 | `CANDIDATE` |
| `RC-05` 봉인 중 사용자 입력 | v2 §12 | `CANDIDATE` |
| `RC-06` canonical hash·drift | v2 §8 | `CANDIDATE` |
| `RC-07` 재귀 생성·Activation Receipt | v2 §9·§13·§15 | `CANDIDATE` |
| `RC-08` 격리·redaction·Learning 갱신 | v2 §7·§9·§18 | `CANDIDATE` |

`V2에 반영됨`은 공식 정책 채택이나 Finding 종결을 뜻하지 않는다. 사람 승인과 같은 공식 문서의
수정·판본·검수 증거가 연결되기 전에는 모두 후보 상태다.

## 3. 반영 순서 후보

1. 팀 구성안에서 Controller 권한 상한과 사람 승인 범위를 결정한다.
2. 온톨로지에 schema와 관계를 먼저 고정한다.
3. 오케스트레이션이 상태 기계·생성·복원·lease를 schema ID로 연결한다.
4. 디렉터리 기획안이 보호 장부·manifest·색인의 물리 경로를 고정한다.
5. 품질안이 임계·시험·지표·Learning gate를 고정한다.
6. 다섯 문서 누적 그래프와 중복 권위를 검사한다.

