# AI 기획안 누적 교차검수 — Stage 3 Opus r1

> 상태: `OPUS_DIRECT_ADVISORY`
> verdict: `CHANGES_REQUIRED`
> 실행일: 2026-09-01
> 모델: `claude-opus-5`
> 세션: `cd2fc6c4-7a60-43f1-a753-0e63a15089f4`
> CLI 보고 사용량: `$1.524794`
> 누적 사용량: raw `$11.536188`, 회차별 센트 올림 합산 `$11.58`

## 검수 대상

- `docs/팀구성_상세기획안.md`
- `docs/AI-지식-온톨로지-기획안.md`
- `docs/AI-오케스트레이션-상세기획안.md`
- `docs/디렉터리-문서신경망-재설계-기획안.md`

승인한 텍스트 스냅샷만 전달했고 파일·셸 도구는 부여하지 않았다. 공식 Fable 게이트를 종결하지 않는다.

## 직전 Finding 재확인

- 해결: `LOCK-ACQ-50`, `DISP-DEF-51`, `ADV-FAIL-COST-54`, `ROUTE-OPUS-55`
- 부분 해결: `QUEUE-RISK-53`, `STATE-ENUM-52`

## 신규 Finding

| ID | 심각도 | 요약 |
|---|---|---|
| LEASE-DUP-56 | Major | 가변 lease와 불변 task.json의 이중 소유 |
| RESUME-FIELDS-57 | Major | 필수 복원 필드 집합의 단일 소유자 부재 |
| MOVE-IMMUT-58 | Major | 불변 감사·배포 원본의 옛 경로까지 금지해 이동 불가 |
| DRAFT-DELEG-59 | Minor | ACTIVE 문서의 DRAFT 위임 링크 유형 미구분 |
| DISPUTED-ACTOR-60 | Minor | DISPUTED 제안·확정 주체 충돌 |
| BUDGET-PIN-61 | Minor | fallback/advisory 비용 승인 키 충돌 |
| MOVE-REFSCOPE-62 | Minor | 이동 갱신 대상에 스크립트·CI·매니페스트 누락 |
| QUEUE-WRITE-63 | Minor | Task lock이 단일 작업큐의 교차 Task 쓰기 경합을 못 막음 |
| README-AUTH-64 | Minor | 중앙 권위 README를 중복 규칙 검사가 오탐할 수 있음 |
| GENIDX-SELF-65 | Improvement | 생성 색인의 자기참조 hash 규칙 미정 |

## 반영 방향

lease 현재값은 작업큐 하나만 소유하고 검수 입력에는 발행 시점 스냅샷으로만 남긴다. 복원 필드의
단일 정의는 활성 팀 문서 §11로 고정하고 다른 문서는 표현·파생값만 참조한다. 옛 경로 검사는 가변
권위·소스·시험에만 적용하고 불변 감사·배포·역사 원본은 경로 매핑 후속 기록으로 해석한다.
