# AI-ORCH-PLANS-BUNDLE-A-FABLE-SOFTCAP-004 공동 작업 장부

> 1~5단계 다섯 공식 기획안의 구조 폐쇄성을 Fable이 읽기 전용으로 독립 검수한다.
> SOFTCAP-003은 provider 호출 전 로컬 commit 결속 검사에서 종료됐고 비용·외부 호출은 없었다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 단일 권위, 관계 방향, 사람 승인 경계, 모델 역할 분리, DRAFT 원자성
- 집중 검토 질문: 1~5단계가 6~7단계로 넘어갈 구조적 준비가 됐는가? 남은 Critical·Major·필수 Finding만 보고하라.
- 출력 절약 계약: 요약·칭찬을 생략하고 verdict·필수 Finding·근거·필요 패치만 간결하게 작성한다.
- 실행한 테스트·현재 증거: Sol high PASS, ai:plans:simulate 71/71, hard-cap guard self-test 51/51
- 검수 예산: `DEC-AI-REVIEW-BUDGET-A-SOFTCAP-003`의 미사용 외부 호출 1회를 r001 soft cap USD 4.00에 결속한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-REVIEW-BUDGET-A-SOFTCAP-003`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자가 승인한 새 Fable 외부 호출 1회의 soft cap USD 4.00과 실제 청구 초과 가능성을 이 정확한 회차에 적용한다.
- 허용 범위·기한: `AI-ORCH-PLANS-BUNDLE-A-FABLE-SOFTCAP-004/r001` 한 회차, 읽기 전용, 2026-09-03 현재 작업까지.
- 정정 근거: SOFTCAP-003은 provider 시작 전 로컬 commit 결속 오류로 끝나 승인된 외부 호출과 비용을 소비하지 않았다.
- 금지: 자동 재시도·증액·동일 목적 Opus 호출·다른 회차 재사용.
- 승인자·시각: `USER · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
