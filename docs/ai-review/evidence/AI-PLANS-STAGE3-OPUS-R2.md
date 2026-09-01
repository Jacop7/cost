# AI 기획안 누적 교차검수 — Stage 3 Opus r2

> 상태: `OPUS_DIRECT_ADVISORY`
> verdict: `CHANGES_REQUIRED`
> 실행일: 2026-09-01
> 모델: `claude-opus-5`
> 세션: `8d4cf866-14f2-4200-bebb-006f0687eac7`
> CLI 보고 사용량: `$1.430565`
> 누적 사용량: raw `$12.966753`, 회차별 센트 올림 합산 `$13.02`

## 판정

Stage 3 r1의 10건 중 9건은 해결됐고 `MOVE-IMMUT-58`은 부분 해결이다.

## 신규 Finding

| ID | 심각도 | 요약 |
|---|---|---|
| MOVE-SEALED-66 | Major | 봉인 task.json·append-only collaboration까지 이동 갱신 대상으로 읽힘 |
| ADV-PIN-67 | Minor | advisory 예산 상향 pin의 소유 Task·장부 미정 |
| ATTEST-SUB-68 | Minor | 외부 attestation이 필수 원격 job 실행을 대체할 여지 |
| MOVE-CHKSCOPE-69 | Minor | 옛 경로 검사 범위에 스크립트·CI·설정 누락 |
| PLAN-REG-70 | Minor | 디렉터리·후속 평가 기획안의 승격 추적 누락 |
| FIELD-EXTRA-71 | Improvement | 필수 복원 목록과 표현 YAML의 식별·파생 필드 관계 미설명 |

## 반영 방향

과거·현재 검수의 `task.json`, `collaboration.md`, `status.json`은 이동 과정에서 수정하지 않는다.
실행기 설정과 앞으로 발행할 Task만 새 경로를 쓰고, 진행 작업은 후속 Task와 경로 매핑 증거로 잇는다.
직접 advisory 묶음은 단일 작업큐 Task가 소유하며 비용 상향은 그 Task의 `HUMAN_DECISION` hash를
증거가 인용할 때만 허용한다.
