# APP-215-SURFACE-AUDIT-20260920 공동 작업 장부

> 이 파일은 `task.json`의 공식 산출물에 대한 append-only 검수 장부다. Fable 턴은 검수 실행기만,
> 다른 턴은 `corepack pnpm fable:append -- --task APP-215-SURFACE-AUDIT-20260920`만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- artifact_hashes: `[{"path":"docs/ai-review/tasks/APP-215-SURFACE-AUDIT-20260920/plan.md","sha256":"e3ff5f24e2d2cd2a9e42daf1b62fd61c0fee78250287f8fca2a27ee88299c434","change_type":"ADDED"},{"path":"scripts/app-surface-functional-audit.mjs","sha256":"a770e42aa35c73039f4ddd697ff73a4686c9a3dc305978d5ac7553af77c3ffe2","change_type":"ADDED"}]`
- changed_artifact_paths: `docs/ai-review/tasks/APP-215-SURFACE-AUDIT-20260920/plan.md`, `scripts/app-surface-functional-audit.mjs`
- 충족해야 할 요구사항·불변식: AppMap 215개 표면과 74개 화면 ID를 빠짐없이 추적하고, 재료·메뉴·발주·매출의 확정 계산과 원장은 DB RPC를 권위로 유지한다.
- 이번에 바꾼 내용: 구조 누락을 자동 검사하는 기준선 생성기와 8단계 전수조사·수정 계획을 만들었다. 215개 표면의 Expo 경로 매핑 누락은 0건이며, 이 결과를 기능 완료와 구분했다.
- 집중 검토 질문: 완료 판정 10개가 껍데기와 실제 구현을 충분히 구분하는지, 위험 순서와 핵심 흐름 반례가 빠지지 않았는지, 1~5개 판매 채널 최신 결정과 과거 3개 고정 문서의 충돌 처리 순서가 안전한지 검토해 달라.
- 실행한 테스트·현재 증거: `node scripts/app-surface-functional-audit.mjs` 종료 0. 총 215·활성 200·숨김 15·화면 75·팝업/상태 140·구조 누락 0. `inventory.json` SHA-256 `323d77443e6aee535ee3004d2de05c6ca6c002166810a090031b8344022ec489`.
- 사람 결정이 필요한 항목: 현재 없음. 최신 사용자 결정은 가변 판매 채널과 Fable 필수 검수다.
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- finding_ids: `[]`
- 실행 명령: `corepack pnpm fable:review -- --task APP-215-SURFACE-AUDIT-20260920 --round 1`
- 종료 코드·결과: 종료 64. 외부 모델 호출 전에 `PROVIDER_HARD_CAP_UNAVAILABLE`로 실패했다.
- 증거 파일·로그 위치: 실행기 표준 오류 및 현재 Task의 미생성 r001 상태. Fable 응답이나 Finding은 생성되지 않았다.
- 미실행 항목과 이유: Fable 검수는 제공자 결제 하드캡을 검증할 수 없어 시작되지 않았다. 검수 완료로 표시하지 않으며 같은 호출을 반복하지 않는다.
- next_review_request: `FABLE_REVIEW`

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

## CODEX_EVIDENCE · turn-c003 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- finding_ids: `[]`
- 전체 게이트 1차 결과: `corepack pnpm verify`에서 ① 타입, ⑤ 업그레이드 26/26, ⑥ 웹 번들이 통과했다. ②·④ DB는 118/119였고 원인은 새 내부 trigger 함수의 postgres SECURITY DEFINER 정확 목록 누락이었다. ③은 AppMap 생성 레지스트리와 터치 감사 기준선이 현재 작업 트리보다 뒤처져 실패했다.
- 수정·재검증: 권한 기대 목록을 갱신한 뒤 새 DB SQL 전체 119/119 통과. AppMap 레지스트리 화면 74·route 66·prototype 187·orphan 0, 터치 감사 회귀 66/66, byte artifact manifest와 음성 계약 13/13 통과. 전체 병렬 앱 시험에서 드러난 삭제 확인 동명 버튼 간헐 실패를 대화상자 제목 대기와 정확 버튼 선택으로 고정했다.
- 최종 선택 범위: `corepack pnpm verify --no-db` 종료 0, ① 타입·② core/mobile·③ CLI/ACL/문서/디자인·⑥ 웹 번들 4/6 통과. ④·⑤는 이 명령에서 건너뛰었고, 별도 새 DB 119/119와 앞선 업그레이드 26/26 증거를 보존한다. 같은 최종 작업 트리의 단일 6/6 재실행은 하지 않았으므로 전체 통과라고 표시하지 않는다.
- 전수조사 기준선: 215개 표면·구조 누락 0, RPC 후보 178, mutation 후보 102, 수동 추적 36, 명시적 부분 구현 12, fixture 진입 25. 첫 P1인 동적 판매 채널 세금 저장·상세 단절을 수정하고 회귀를 추가했다.
- 독립검수 상태: Fable round 1은 `PROVIDER_HARD_CAP_UNAVAILABLE`로 외부 호출 전에 중단됐다. Fable 응답·Finding은 없으며 필수 검수는 미완료다.
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c004 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `a8fe3157f742bbfb6c65b15230157d1ad7e7d7b6`
- finding_ids: `[]`
- 최종 전수조사 기준선: 현재 표면 207개(활성 192, 숨김·호환 15), 직접 시험 참조 207/207, 구조 누락 0, 활성 기능 화면 ID 대표 대상 누락 0, RPC 후보 203, mutation 후보 113.
- 최종 필수 게이트: 같은 작업 트리의 `corepack pnpm verify` 종료 0. ① 타입, ② core·DB·mobile, ③ CLI 계약·ACL·문서 그래프·디자인 품질, ④ 새 DB, ⑤ 업그레이드 경로, ⑥ Metro 웹 번들 6/6 통과. 모바일 148파일·1,729통과·4제외, 새 DB SQL 119/119, 업그레이드 26/26. 네이티브 기기 증빙 4종은 정책상 비차단 `ADVISORY_FAIL`이며 전체 접근성 기기 검수 완료로 표시하지 않는다.
- 추가 회귀 수정: 매장 영구 삭제 cascade 중 삭제 중인 부모 매장을 기준 변경 트리거가 다시 잠그며 FK 오류를 내던 문제를 `20260920000139_store_purge_basis_guard.sql`로 수정했다. 부모 매장이 존재할 때만 잠금·재계산하고 purge 관련 SQL 시험 3개와 전체 게이트로 검증했다.
- 독립검수 재시도: `corepack pnpm fable:review -- --task APP-215-SURFACE-AUDIT-20260920 --round 1`은 다시 외부 호출 전에 `PROVIDER_HARD_CAP_UNAVAILABLE`로 종료 64. Fable 응답·Finding은 생성되지 않았고 독립검수 완료로 표시하지 않는다.
- next_review_request: `FABLE_REVIEW`
