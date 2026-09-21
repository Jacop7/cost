
## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- finding_ids: `[]`
- 전수조사 진행: AppMap 215개·화면 ID 74개·구조 누락 0건. 직접 import 훅 정의 추적으로 RPC 후보 178개, mutation 후보 102개, 훅/RPC 수동 추적 대상 36개를 inventory.json에 갱신했다.
- 발견 결함: 동적 판매 채널 v2 세금 snapshot을 sales_tax_app_detail이 읽지 않았고 앱 파서는 고정 3개 code만 허용했다. 세금 적용일에는 refresh_dynamic_sales_item_tax 소유자의 내부 계산 EXECUTE 부재로 매출 완료도 실패했다.
- 수정: 20260920000134_dynamic_sales_tax_detail.sql에서 trigger 함수의 내부 definer 경계를 복원하고, 상세 RPC가 v2 채널 UUID·code·판매 당시 이름과 legacy fallback을 반환하게 했다. 앱 계약·SALES-18 표시·회귀를 함께 갱신했다.
- 실행 증거: 새 DB 전체 migration 적용 성공. DB 99_dynamic_sales_channels, 34_rpc_least_privilege, 40_international_tax_calculation, 41_international_tax_app_contract 통과. 모바일 typecheck 통과. internationalTaxContract.test.ts와 internationalTaxScreens.test.tsx 64/64 통과.
- 미실행/남은 항목: 전체 corepack pnpm verify, 나머지 핵심 흐름 전수 추적, Fable 독립검수. Fable은 앞선 round 1에서 PROVIDER_HARD_CAP_UNAVAILABLE로 외부 호출 전에 차단됐으며 검수 완료로 표시하지 않는다.
- next_review_request: `FABLE_REVIEW`
