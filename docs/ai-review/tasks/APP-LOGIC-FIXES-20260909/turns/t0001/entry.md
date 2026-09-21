
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `null`
- target_commit_sha: `634dc4055a600db9505f9db1614849c00df007a8`
- artifact_hashes: `[{"path":"apps/mobile/src/lib/queryClient.ts","sha256":"e63d608faf48f304c15df01eb89f898f529d1ef1a51405c56cec2e32a621514a","change_type":"MODIFIED"},{"path":"apps/mobile/src/features/master-data/hooks.ts","sha256":"f11a1b695dd030ab89813e60f3f2e2b104eea444489aad61bac8e3e60a9fba24","change_type":"MODIFIED"},{"path":"apps/mobile/tests/queryInvalidation.test.tsx","sha256":"4cc45200e879a7c16555e94431e630bcba18fb06b1d46db421beed813f64086c","change_type":"ADDED"}]`
- finding_ids: APP-AUDIT-08, APP-AUDIT-09, APP-AUDIT-10
- 수정: 판매 후 레시피 재조회, 카테고리명과 구매처명 소비 쿼리 갱신. 부자재 저장·비활성화의 레시피 중복 조회 제거.
- 검증: 최종 앱 242/242 및 타입 통과. 새 회귀 9개 포함. 기존 감사 캐시 재현 4/4 통과. core 194 통과, 12 건너뜀. 전체 verify 진행 중.
- 변경 분리: 최신 origin/main 기반 로컬 커밋 0171ddf05fb6ae5ef0418b85ebc4d79471293bcf에 3개 파일만 포함. 사용자의 체크아웃·HEAD·index 보존.
- 독립검수: Fable 기본 경로가 PROVIDER_HARD_CAP_UNAVAILABLE로 호출 전 종료64. 우회 승인 생성 또는 Opus 대체 호출 없음.
- 증거: docs/ai-review/evidence/APP-LOGIC-FIXES-20260909.md 및 .tmp/app-logic-fixes-20260909/
- 한계: 화면 로직 결함10건은 UI 작업과 겹칠 수 있어 미수정. 전체 검증·독립검수·exact-SHA CI 완료 판정 아님.
- next_review_request: `HUMAN_DECISION`
