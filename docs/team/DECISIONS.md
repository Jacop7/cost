# 사람 Decision 장부

이 파일은 사람의 승인·반려·보류·위험 수용 인스턴스만 보관한다. 정책 본문, 현재 Task 상태,
채팅 원문은 복사하지 않는다.

## DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027

- 상태: `ACTIVE`
- 승인자: `HUMAN-CHIEF`
- 승인 시각: `2026-09-03T16:28:22+09:00`
- 대상 commit: `d14ce2a838e003a57983c3772fb8b3a5b730fc0a`
- 대상 문서 SHA-256:
  - 팀 구성안: `c99203cc22647e6ae703dc8c12d1cf456b7ae5735e8ca347f0eafc34d53e629c`
  - 온톨로지: `b822a8798cea9c8b3651eb9483b77082d886ebf56d51ec74da7d18ae93e81b60`
  - 오케스트레이션: `794fab2d3842fa3d74a6f09f2485d19b69f21fc62b12cd371d8cb00b2f02b5da`
  - 디렉터리: `d7d7a4d94de4f3f8ef1a1b0bc05a216e6ab3d152c23c25fcd92eef83891e4108`
  - 품질·학습·자율성: `66883bb4ab9df23a7e44397a91f92d8e499b62fd70dce3ff0d90ac06acd9827a`
- 저장소 범위: 9단계의 중앙 장부·역할/팀 manifest·HANDOFF 골격과 후속 네 기획안의 원자 활성화
- 외부 상태 범위: `MarginCook · 마스터 작업`, `MarginCook · 부서 그룹` section과 승인된 정확한 제목의
  A0 shell 11개
- 제외: 제품 코드, DB migration, 스테이징·운영 배포, 비밀키, 새 통합 플러그인·공용 hook
- 근거: [작업큐 AI-ORCH-PLANS-SIM-1](../작업큐.md),
  [9단계 실행기획안](../ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-PLAN.md)

이 Decision은 채팅 자체에 권한을 주지 않는다. 모든 신규 route는
[ROLE_CONTEXTS](./ROLE_CONTEXTS.md)의 A0에서 시작한다.
