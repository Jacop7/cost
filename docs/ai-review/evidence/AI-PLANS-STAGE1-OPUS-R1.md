# AI 기획안 누적 교차검수 — Stage 1 / Opus r1

> 상태: `OPUS_DIRECT_ADVISORY`
> 실행일: 2026-09-01
> 모델: `claude-opus-5`
> Claude Code: `2.1.250`
> 세션: `a6cf25c3-89b0-4742-b398-206a606f1f50`
> 사용 상한: `$2.00`
> 보고 사용액: `$1.733549`
> verdict: `CHANGES_REQUIRED`

이 기록은 사용자가 명시적으로 요청한 Opus 누적 교차검수의 정규화된 증거다. Fable 소진
fallback handoff를 거친 공식 protocol 1.2 결과가 아니므로 Fable gate 종결 근거로 사용하지 않는다.
검수는 별도 임시 스냅샷에서 `Read,Glob,Grep`만 허용하고 두 기획안과 `AGENTS.md`만 제공했다.

## 검토 산출물

- `docs/팀구성_상세기획안.md`
- `docs/AI-지식-온톨로지-기획안.md`

## 필수 Finding 레지스트리

| ID | 등급 | 요약 | 반영 |
|---|---|---|---|
| ONT-AUTH-01 | Critical | 확정 팀 문서가 미승인 온톨로지로 권위를 넘겨 권위 공백 | 승인 전 위임 효력 없음 명시 |
| ONT-CONTRACT-02 | Critical | 정규화 필드와 작업큐·Task Packet 계약 단절 | 필드 매핑표와 필수 패킷 필드 추가 |
| ONT-AUDIT-03 | Critical | 독립 감사에 VERIFIED Learning이 주입될 여지 | route별 학습 금지·제한 명시 |
| ROLE-INTAKE-04 | Major | 요청 접수·정규화 RACI와 독점 책임 부재 | RACI 및 분리 규칙 추가 |
| ROLE-RISK-05 | Major | Task 신설·위험 등급 자기판정의 견제 부재 | L1 배치와 표본 재판정 추가 |
| ROLE-CANCEL-06 | Major | Task 취소·범위 축소·대체 승인자 부재 | 사람 승인 경계 추가 |
| DUP-RESUME-07 | Major | 새 채팅 재개 절차 이중 소유 | 온톨로지 단일 상세 소유로 통합 |
| DUP-PRECEDENCE-08 | Major | 충돌 우선순위 사다리 이중 소유 | 팀 문서를 단일 소유자로 유지 |
| RESTORE-QUEUE-09 | Major | 작업큐에 복원 필수 필드 생산 의무 없음 | Task 필수 필드와 미검증 처리 추가 |
| RESTORE-PIN-10 | Major | 재개 시 AGENTS 판본 고정 누락 | blob/content hash 필드·재발행 규칙 추가 |
| REL-DECISION-11 | Major | Decision·Risk 항목 상태·승인 스키마 부재 | 항목 단위 스키마 추가 |
| REL-FIXED-12 | Major | 채팅 발화가 Decision ID 없이 고정될 수 있음 | ACTIVE Decision ID·commit 필수화 |
| REL-LEARN-13 | Major | Learning 충돌 판정 필드 부재 | conflicts_with·supersedes 추가 |
| REL-SUPERSEDE-14 | Major | SUPERSEDES의 승인 근거 강제 없음 | 검증 규칙 추가 |
| PRIV-RETENTION-15 | Major | thread 참조·미검증 주장의 Git 영구 보존 위험 | 비식별 참조·종결 전 치환 규칙 추가 |
| PRIV-USEROWN-16 | Major | 사용자 소유 변경과 겹칠 때 행동 미정 | excluded_paths·stop_conditions 추가 |
| AUTH-README-17 | Major | `docs/README.md`가 경쟁 권위가 될 위험 | 비권위 탐색 색인으로 제한 |
| AUTH-VERIFY-18 | Major | 하위 기획안이 verify 계약을 먼저 변경 | 사람 결정·AGENTS/G3 동시 변경 조건 추가 |
| AUTH-DEPLOY-19 | Major | 배포 증거 위치와 운영 문서 구조 매핑 부족 | 브랜치·DB 기획안의 인스턴스 저장소로 명시 |
| AUTH-REG-20 | Major | 미승인 온톨로지가 AGENTS 책임 목록에 없음 | 최종 승인 전 등재 금지로 전이 규칙 명시 |
| AUTH-STAGE2-21 | Major | 팀 장부를 조건 없이 생성하도록 표현 | 기존 소유자 부재 시에만 생성하도록 수정 |
| META-FM-22 | Major | front matter 의무와 현재 문서 형식 모순 | 도입 Task부터 이관하도록 시점 고정 |

## 후속 Finding

- `NODE-REVIEW-23`: 감사 `rounds`, 공동 장부, 파생 상태를 별도 노드로 분리했다.
- `TERM-USER-24`: 요청자와 앱 실사용자를 구분해 사람 주 오케스트레이터/실사용자로 고정했다.
- `TERM-AUDIT-25`: 감사 route별 학습 입력을 명시했다.
- `META-EXAMPLE-26`: front matter 예시가 미승인 문서의 권위를 자칭하지 않게 바꿨다.
- `PKT-DUP-27`: 근거가 불명확한 `Current AGENTS.md version` 필드를 제거했다.
- `ASSUM-CARRY-28`: 가정·책임자·무효화 조건을 Task Packet과 게이트 증거에 추가했다.

## 회차 한계

임시 스냅샷에는 세 파일만 있어 링크 대상 존재 여부와 실제 작업큐·감사 실행기 계약은 확인하지
못했다. r2에서는 수정된 두 문서의 구조적 종결 여부를 확인하고, 이후 누적 단계는 관련 기존 권위
문서를 reference로 추가한다.
