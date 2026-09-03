# AI-ORCH-PLANS-BUNDLE-A-FABLE-001 공동 작업 장부

> 1~5단계 다섯 공식 기획안의 권위·역할·상태·게이트와 묶음 A DRAFT_READY 판본을 Fable이
> 읽기 전용으로 독립 검수한다. 이 장부는 append-only이며 직접 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- input_files_sha256: `r001 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `r001 manifest에서 실행기가 봉인·검증 예정`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 단일 권위, 올바른 관계 방향, 사람 승인 경계, Terra/Sol/Fable/Opus 역할, DRAFT 원자성, 외부 검수 비용 fail-closed
- 이번에 바꾼 내용: Sol high의 Critical 2·Major 3·Minor 1을 반영해 입력 역할, FABLE-ARCH route, 증거 결속, 관계 어휘, fallback 절 참조와 01 채팅 권위 표현을 보완했다.
- 집중 검토 질문: 1~5단계가 다음 6~7단계로 넘어갈 만큼 구조적으로 닫혔는가? 남은 Critical·Major·명세상 필수 Finding이 있는가?
- 실행한 테스트·현재 증거: Sol high 재검수 PASS, `corepack pnpm ai:plans:simulate` 71/71 PASS, 모델 계획 `121fa4c68e066f7448eaebfc3c26918870bbd6a5f3f0c9d8e8beb7b6a4f0f5ba` VERIFIED
- 사람 결정이 필요한 항목: 네 DRAFT의 ACTIVE 승격은 8단계에서 별도 결정한다.
- 검수 예산: `DEC-AI-REVIEW-BUDGET-A-001`의 단일 Task 상한 USD 2.00. 자동 증액·동일 목적 Opus 동시 호출 금지.
- next_review_request: `FABLE_REVIEW`
