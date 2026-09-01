# AI 기획안 누적 교차검수 — Stage 2 Opus r1

> 상태: `OPUS_DIRECT_ADVISORY`
> verdict: `CHANGES_REQUIRED`
> 실행일: 2026-09-01
> 모델: `claude-opus-5`
> 세션: `3344920f-adb4-4a72-96d2-e2b709d88c5b`
> CLI 보고 사용량: `$1.440473`

## 검수 대상

- `docs/팀구성_상세기획안.md`
- `docs/AI-지식-온톨로지-기획안.md`
- `docs/AI-오케스트레이션-상세기획안.md`

선별한 문서의 텍스트 스냅샷만 전달했으며 Opus에는 저장소 파일·셸 도구를 부여하지 않았다.
본 검수는 공식 Fable 게이트를 종결하지 않는다.

## 직전 지적 재확인

`GATE-CI-30`, `LEARN-SECR1-31`, `MAP-FIELD-32`, `RISK-STATE-33`,
`LIFECYCLE-ENUM-34`, `SECT-NUM-35`, `LEARN-EXCL-36`, `PKT-TERM-37`,
`UNTRACKED-38`은 모두 `RESOLVED`로 판정됐다.

## 신규 Finding

| ID | 심각도 | 요약 | 반영 방향 |
|---|---|---|---|
| ORCH-AUTH-40 | Critical | DRAFT 오케스트레이션 문서의 전이 권위 부재 | 비권위 선언·승격 조건·팀 문서 목록 추가 |
| OPUS-ADV-41 | Major | 직접 Opus advisory가 확정 역할 계약에 없음 | fallback과 분리한 역할·RACI·컨텍스트 추가 |
| QUEUE-FIELD-42 | Major | 작업큐 필드가 다중 채팅 재개 패킷보다 좁음 | 정책 hash·결정·Finding·역할·완료조건·대화 참조 추가 |
| MERGE-OWNER-43 | Major | 요청 병합 판정 enum의 소유·저장 위치 부재 | 온톨로지 단일 정의와 `request_disposition` 추가 |
| LOCK-44 | Major | 공유 worktree 편집 소유권 탐지 계약 부재 | 편집 소유자·lease·세션 참조와 정지 조건 추가 |
| DONE-STATE-45 | Major | `기술 완료`와 공식 상태·gate_state 매핑 부재 | VERIFIED/CLOSED 경계와 closure successor 명시 |
| ADV-EVIDENCE-46 | Minor | advisory 증거 경로가 구조·노드 모델에 없음 | evidence 디렉터리와 불변 노드 추가 |
| CTX-ROUTE-47 | Minor | route별 Learning 금지 규칙 누락 | 온톨로지 §9 우선·부분집합 관계 명시 |
| UNTRACKED-ORCH-48 | Minor | 오케스트레이션의 사용자 변경에 미추적 파일 누락 | 재개·잠금·실패 계약에 명시 |
| ADV-COST-49 | Minor | advisory 전체 비용·실패 회차 합산 계약 부재 | 작업 전체 상한·합산·상향 Decision 추가 |

## 종합 판단

세 문서의 큰 방향은 맞지만, 현재 채팅을 떠나 다른 채팅에서 재개할 때 필요한 상태와 편집 소유권이
공식 저장 계약에 모두 들어가지 않았다. 또한 직접 Opus advisory와 공식 Fable fallback의 역할 경계가
팀 문서까지 연결되지 않았다. 위 항목을 같은 권위 문서에 반영한 뒤 Stage 2 r2에서 재검증한다.
