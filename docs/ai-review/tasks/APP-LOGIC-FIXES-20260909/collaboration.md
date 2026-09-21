# APP-LOGIC-FIXES-20260909 공동 작업 장부

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

## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c001`
- target_commit_sha: `634dc4055a600db9505f9db1614849c00df007a8`
- artifact_hashes: `[{"path":"apps/mobile/src/lib/queryClient.ts","sha256":"e63d608faf48f304c15df01eb89f898f529d1ef1a51405c56cec2e32a621514a","change_type":"MODIFIED"},{"path":"apps/mobile/src/features/master-data/hooks.ts","sha256":"f11a1b695dd030ab89813e60f3f2e2b104eea444489aad61bac8e3e60a9fba24","change_type":"MODIFIED"},{"path":"apps/mobile/tests/queryInvalidation.test.tsx","sha256":"4cc45200e879a7c16555e94431e630bcba18fb06b1d46db421beed813f64086c","change_type":"ADDED"}]`
- finding_ids: APP-AUDIT-08, APP-AUDIT-09, APP-AUDIT-10
- 최종 실행: verify 6단계 모두 실행. 타입·새 DB·업그레이드·웹 번들 통과; 개발 DB 버전 차이와 팀 운영 계약 시험으로 ②③ 실패, 종료1.
- 별도 최종 검사: mobile 242/242, core 194통과/12건너뜀, 새 DB parity13통과, 감사 재현183개 중172통과/11실패. 11실패는 UI 관련 미수정 결함10건.
- 새 DB: SQL50/50 및 ACL·2세션 경합 통과. 업그레이드23/23 통과. 임시 DB2개 삭제 확인.
- 무결성: 검증 종료 후 제품 소스322개 비교에서 공용 로직2개만 변경. 커밋0171ddf의 제품2개·시험1개와 작업본 hash 동일.
- 증거: docs/ai-review/evidence/APP-LOGIC-FIXES-20260909.md, .tmp/app-logic-fixes-20260909/verify.log, source-integrity-final.json, branch-receipt.json, db-cleanup-check.txt
- 독립검수: Fable은 비용 하드캡 제한으로 호출 전에 중단. 외부 검수·exact-SHA CI·전체 프로젝트 완료를 주장하지 않음.
- next_review_request: `HUMAN_DECISION`
