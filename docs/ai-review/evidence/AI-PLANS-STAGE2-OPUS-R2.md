# AI 기획안 누적 교차검수 — Stage 2 Opus r2

> 상태: `OPUS_DIRECT_ADVISORY`
> verdict: `CHANGES_REQUIRED`
> 실행일: 2026-09-01
> 모델: `claude-opus-5`
> 세션: `e6c7d2c3-fc38-406f-88ec-6fdf062a686a`
> CLI 보고 사용량: `$1.722003`
> 이 기획안 묶음 누적 CLI 보고 사용량: raw `$10.011394`, 회차별 센트 올림 합산 `$10.05`

## 검수 대상

- `docs/팀구성_상세기획안.md`
- `docs/AI-지식-온톨로지-기획안.md`
- `docs/AI-오케스트레이션-상세기획안.md`

승인한 문서의 텍스트 스냅샷만 전달했으며 Opus에는 파일·셸 도구를 부여하지 않았다. 본 검수는
공식 Fable 게이트를 종결하지 않는다.

## r1 재확인

- 해결: `ORCH-AUTH-40`, `OPUS-ADV-41`, `DONE-STATE-45`, `ADV-EVIDENCE-46`,
  `CTX-ROUTE-47`, `UNTRACKED-ORCH-48`
- 부분 해결: `QUEUE-FIELD-42`, `MERGE-OWNER-43`, `LOCK-44`, `ADV-COST-49`

## 신규 Finding

| ID | 심각도 | 요약 | 반영 방향 |
|---|---|---|---|
| LOCK-ACQ-50 | Major | edit lease의 원자적 획득·만료 인계가 없음 | 활성 팀 문서에 기록 후 재확인과 만료 인계 계약 고정 |
| DISP-DEF-51 | Minor | 판정 enum이 DRAFT에만 있고 단수 필드가 이력을 덮음 | 팀 문서에 4값 경계 고정, 배열 이력으로 전환 |
| STATE-ENUM-52 | Minor | gate/run 상태 값과 전이 주체 미정 | 활성 팀 문서에 폐쇄형 enum 표 추가 |
| QUEUE-RISK-53 | Minor | 작업큐 최소 필드에 위험·가정·경로 누락 | Task Packet·온톨로지와 필드 집합 일치 |
| ADV-FAIL-COST-54 | Minor | 실패 비용 합산이 DRAFT에만 있음 | 활성 직접 advisory 계약에 합산·상향 규칙 추가 |
| ROUTE-OPUS-55 | Minor | 라우팅표가 fallback과 advisory를 혼동 | 독립 감사 칸은 Fable 또는 역할 승계 fallback만 허용 |

## 종합 판단

권위 전이, 직접 advisory 경계, 미추적 파일, 완료 상태 구분은 닫혔다. 다중 채팅의 안전한 공동 작업을
위해서는 요청 판정을 누적 이력으로 보존하고, edit lease를 빈 값 확인만으로 획득하지 못하게 해야 한다.
수정 뒤 Stage 3 r1에서 이 여섯 건을 재확인한다.
