# AI 기획 선작업 사람 Decision 대기표

> 상태: `DECISION_PACKET v1` · 비권위 선작업
> Task: `AI-ORCH-PLANS-PREWORK-1`
> 원칙: 아래 권고값은 자동 채택되지 않는다. 결정 ID가 작업큐에 기록되기 전에는 본작업 입력이 아니다.

| Decision 후보 ID | 질문 | 권고 기본값 | 필요 시점 | 승인자 | 상태 |
|---|---|---|---|---|---|
| `DEC-AI-BRANCH-001` | 기존 AI 기획 브랜치를 `022840a`까지 fast-forward할 것인가 | 새 브랜치 없이 fast-forward | 선작업 | `HUMAN-CHIEF` | 사용자 지시로 실행됨 |
| `DEC-AI-LEASE-002` | `AI-ORCH-PLANS-SIM-1`의 기존 lease를 누구에게 넘길 것인가 | 기존 소유자 HANDOFF 뒤 실행 주체로 인계 | 본작업 시작 전 | `HUMAN-CHIEF` | 결정 대기 |
| `DEC-AI-ONTOLOGY-003` | 낡은 AGENTS blob의 `ONTOLOGY-005`를 어떻게 처리할 것인가 | 원본 보존 후 현재 정책 기준 successor 발행 | 온톨로지 재검수 전 | `HUMAN-CHIEF` | 권고 확정 대기 |
| `DEC-AI-ROLLOVER-004` | 롤오버 v2 요구를 다섯 문서에 채택할 범위 | patch map의 `반영 후보`부터 조문화 | 2~5단계 전 | `HUMAN-CHIEF` | 결정 대기 |
| `DEC-AI-AUTOCREATE-005` | 자동 Session 생성을 프로젝트/미션 중 어디까지 사전 승인할 것인가 | Mission 단위·R0/R1만 | 구현 전 | `HUMAN-CHIEF` | 결정 대기 |
| `DEC-AI-STORE-006` | Mission Control Store 위치·암호화·백업·보존은 무엇인가 | Git 밖 로컬 보호 장부 + redacted manifest만 Git | 4·9단계 전 | `HUMAN-CHIEF` | 결정 대기 |
| `DEC-AI-RETENTION-007` | transcript·Capsule pointer 보존 기간은 얼마인가 | 원문 최소 보존, 사건·hash 중심 | 4·9단계 전 | `HUMAN-CHIEF` | 결정 대기 |
| `DEC-AI-NOOWNER-008` | `NO_OWNER` 자동 복구를 어디까지 허용할 것인가 | 자동 재부여 금지, 사람 승인 | 3·11단계 전 | `HUMAN-CHIEF` | 결정 대기 |
| `DEC-AI-SESSION-CLEANUP-009` | 시험 Session archive·삭제 정책은 무엇인가 | 성공/실패 모두 우선 archive, 삭제는 별도 승인 | 11단계 전 | `HUMAN-CHIEF` | 결정 대기 |
| `DEC-AI-FABLE-BUDGET-010` | 문서별·최종 Fable 추가 비용 상한은 얼마인가 | Task별 최소 입력·개별 승인 pin | Fable 실행 전 | `HUMAN-CHIEF` | 결정 대기 |

팀 구성안은 이미 `CONFIRMED v1.3`이다. Controller 역할이나 승인 범위를 반영해 수정하면 같은 commit의
다섯 문서 정합 검증과 `HUMAN-CHIEF` 재승인이 필요하다.

