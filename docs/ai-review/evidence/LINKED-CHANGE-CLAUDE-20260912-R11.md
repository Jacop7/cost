# LINKED-CHANGE 검수 R11 — admin-acl 감사 동기화 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 개발 DB 0214 유지. 전체 verify 는 진행 중이며 **완료로 쓰지 않는다**. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론.
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. R1~R10 원문 보존, 본 문서 1개만 신규. 범위: 감사 스크립트 4파일(`packages/db/scripts/admin-acl-audit.sql` 19,716 B · 17:54:26 · `f83ce2af5b294838`, `admin-acl-audit.test.mjs` 10,670 B · 17:55:05 · `4617364dc1838834`, `admin-acl.sh` 17,900 B · `e1db403e3f6dc2a1`, `admin-acl.test.sh` 16,972 B · 17:55:05 — 요청문의 `test.sh` 는 이 파일) 와 DB16(`16_change_retention.sql` L465–472)·DB34(`34_rpc_least_privilege.sql` L17, L61–70) 계약, 로그 `final-acl-after.log`(17:54:28)·`final-acl-negative.log`(17:55:08).

## 1. 결론 요약

- **동기화 정확(확인)**. 감사 SQL 의 executor 소유 private invoker 예외 5개는 DB16 L465–469 와 시그니처까지 동일하고, postgres SECURITY DEFINER 예외 10개는 DB34 L61–70 과 집합·시그니처가 동일하다. 공개 facade 목록은 `save_tax_configuration(uuid,jsonb,jsonb,uuid,integer,uuid,integer)` 1건이 추가되어 82개이며 0217 의 실제 시그니처와 일치하고, DB34 L17 의 82 와 같다. 주석 표식 `('comment_only_rpc(uuid)')`(L13, P2-6 회귀 표식) 를 제외한 실제 값 행은 82개다.
- **부정 시험 설계 적절(확인)**. 감사 SQL 은 L1 `begin;` … L316 `rollback;` 로 감싸여 있어 probe 의 `alter function`/`grant` 는 같은 트랜잭션에서 버려지고, `.test.mjs` 는 `fresh_` 접두 DB 에서만 probe 를 실행하며, 각 probe 뒤 원본 감사를 다시 돌려 3개 metric 이 `0|expected=0` 인지 확인한다. `replace(/^begin;/, …)` 가 매치되지 않으면 metric 이 0 이라 "반례를 놓침" 으로 실패하므로 자기 검증형이다. `final-acl-negative.log` 는 3개 탐지·rollback 후 통과, `final-acl-after.log` 는 metric 22개·모바일 RPC 80 + 비-mobile 예외 2 = 82 로 통과.
- 실제 DB 권한·함수·데이터 변경 없음(추정: 스크립트 diff 는 목록·기대값·probe 추가뿐, DDL 은 rollback 트랜잭션 안에서만).
- 신규 P1/P2 없음. P4 메모 2건.

## 2. 대조 표

| 항목 | 감사 SQL | DB 계약 | 판정 |
|---|---|---|---|
| executor 소유 invoker 예외 | L246–250: `recipe_edit_extra_rows_v2(jsonb)`, `recipe_edit_shape_v2(uuid,jsonb)`, `recipe_edit_extra_rows_v3(jsonb)`, `recipe_edit_shape_v3(uuid,jsonb)`, `recipe_edit_revision_header_v2()` — 예외라도 `prosecdef` 이거나 authenticated/anon/service_role 에 열리면 invalid | DB16 L465–469 동일 5개, L472 v3 두 개 앱 비공개 단언 | 일치 |
| postgres definer 중 executor 에 열린 예외 | L272–281: current_tax_settings_date, tax_menu_change_basis, pending_recipe_tax_quote, pending_recipe_tax_quote_for_price, record_configuration_change, current_recipe_tax_quote, recipe_tax_quote_for_price, recipe_draft_preview_internal, sales_item_accounting_totals, daily_sales_etc_accounting_totals | DB34 L61–70 동일 10개 | 일치 |
| 공개 facade 수 | L291 `expected=82`, `_acl_approved_rpc` 실제 값 82 | DB34 L17 82 | 일치 |
| 신규 facade 시그니처 | L58 `save_tax_configuration(uuid,jsonb,jsonb,uuid,integer,uuid,integer)` | 0217 L53–54 정의 | 일치 |
| shell 상한 | `admin-acl.sh` L166 `"82"`, `admin-acl.test.sh` L186 기대 출력 `82|expected=82` | — | SQL·mjs·sh 4곳 동일 |
| 부정 probe | v3 shape definer 승격 → `rpc_executor_facades_invalid`; v3 rows authenticated grant → 동일 metric; `pending_recipe_tax_quote` authenticated grant → `unapproved_authenticated_rpc` | 예외 5·10개의 "정확한 시그니처만 허용" 의도와 부합 | 적절 |

## 3. 발견 사항 (신규 P1/P2 없음)

### R11-1 · P4 · 기대값이 4곳에 복제됨(과거 drift 흔적)
- HEAD 기준 `admin-acl.sh` 는 80, 감사 SQL·mjs 는 81 로 이미 어긋나 있었다(이번 diff 의 `-80`/`-81`). 지금은 4곳 모두 82 로 맞췄으나 다음 facade 추가 때 같은 drift 가 재발할 수 있다. mjs/sh 가 SQL 의 `expected=` 를 읽어 비교하거나, DB34 L17 과 감사 SQL 을 한 소스에서 생성하는 것을 권고.

### R11-2 · P4 · postgres 소유 **invoker** helper 가 어느 metric 에도 잡히지 않음
- `current_ingredient_unit_price`, `tax_rule_change_label`, `fixed_change_label`, `applicable_tax_change_items`, `tax_financial_change_rules` 는 postgres 소유·invoker·executor grant·앱 비공개라 `rpc_executor_facades_invalid`(executor 소유만)·`rpc_executor_privileged_maintenance`(definer 만)·`unapproved_authenticated_rpc`(authenticated 만) 어디에도 들어가지 않는다. 현재 계약상 위험은 없으나(앱에 닫힘, RLS 실행 역할 컨텍스트), "executor 에 열린 postgres invoker" 인벤토리 metric 을 두면 향후 grant 확대가 감사에 드러난다. 기록만.

## 4. 상태 표

| 항목 | 상태 |
|---|---|
| admin-acl-audit `executor_facades_invalid=2` | 해소(0209 v3 예외 2개 동기화, 부정 probe 2개로 고정) |
| postgres definer 예외 3개 누락 | 해소(DB34 와 10개 일치) |
| facade 82 | SQL·mjs·sh·DB34 동기화 |
| R10-1 P4 primary 적용 판정 | ROOT 가 0179 CHECK·0181 L170–171·core `internationalTax.ts` L78/80 으로 taxable 전용 계약 확인 보고 — 본 검수 범위 밖이라 보고 내용을 기록만 함 |
| R4-1·R5-1·R6-1~3·R7-4·R7-5·R9-2 | 변동 없음 |