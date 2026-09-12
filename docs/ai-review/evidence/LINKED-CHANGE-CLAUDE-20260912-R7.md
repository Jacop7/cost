# LINKED-CHANGE 검수 R7 — 0215/0216/0217 세금 설정·메뉴 기준 필드·원자 저장 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 개발 DB 0214, 0215~0217 은 `fresh_linked_audit_20260912` 에만 적용이라는 전제 유지.
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. 전체 DB 회귀·앱 시험이 진행 중이므로 **완료를 전제하지 않는다**. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론.
- 입력 지문(직접 산출, sha256 앞 16):
  - `20260912000215_tax_menu_change_propagation.sql` 8,116 B · 17:10:18 · `b3dec2484c9055d7`
  - `20260912000216_menu_basis_pending_fields.sql` 757 B · 17:09:51 · `b02717a0e7e85321`
  - `20260912000217_atomic_tax_configuration.sql` 6,501 B · 17:11:28 · `b6cc6dc4d75f4107`
  - `tests/75_tax_menu_propagation.sql` 5,450 B · `09c1caba116dcb96` · `tests/76_menu_basis_fields.sql` 3,032 B · `6752e883a24f227a` · `tests/77_atomic_tax_configuration.sql` 6,663 B · `152764692dde68c1`
  - `apps/mobile/src/features/international-tax/hooks.ts` 7,652 B · `489ed35c7122f73c` · `apps/mobile/src/lib/queryClient.ts` 9,295 B · `a545994f406c2e72` · `apps/mobile/src/features/my/screens/InternationalTaxScreen.tsx` 25,057 B · `777102add9e3c1ee`
  - 대조: `.codex/material-history-20260912/market-writer.sql`(0217 전 `save_store_market_profile`), `menu-writer-v3.sql`, 0214 이전 백업 dump(`save_menu_tax_override`, `current_recipe_tax_quote`, `current_tax_settings_date`, `recipe_tax_quote_for_price`, `store_has_money_ledger`), 0206 마감 루프.
  - 로그(관찰): `tax-0217-all-second.log`(17:16:14) **78/79** — `34_rpc_least_privilege` 의 "허용한 도우미 밖 postgres definer 노출 0" 이 실제 1 로 실패. `tests/34` 는 그 뒤 17:17:39 에 `tax_menu_change_basis` 허용 목록·facade 82개로 갱신됐으므로 재실행 결과가 나와야 판정 가능. 75/76/77 과 16 은 그 로그에서 PASS.

## 1. 결론 요약

- **0215** 세금 프로필/메뉴 과세 변경 → 메뉴별 실제 quote(세금·순매출·구성·가격기준·과세상태·규칙) 를 유효일 기준으로 전후 비교해 `tax`(설정) / `direct`(메뉴 과세) 이력을 남기고, 금액이 달라진 활성 메뉴만 `recompute_recipe(...,'tax')`. 프로필 id 교체만으로는 사건이 생기지 않는다(재저장 무사건 시험 ok). 레거시 `save_store_tax` 의 source 를 `'fixed_cost'`→`'tax'` 로 고쳐 F8 해소. 설계 적절.
- **0216** `base_servings`·`target_profit_rate` 단독 변경을 `v_money` 에 넣어 affects_sales/대기 판정을 만들되, 0212 의 e3 게이트가 그대로라 추이는 생기지 않는다(시험 ok). 기준 스냅샷이 표시하는 두 필드와 정확히 일치.
- **0217** `save_tax_configuration` 은 한 트랜잭션에서 두 판본 CAS → 시장 적용(v2 사본, 원장 이후엔 국가·지역·통화·언어만 차단) → 세금 적용(v2 사본) → override carry 복원 → 메뉴 전파 1회. 예외는 전부 롤백(시험 ok). 명시 면세 override 는 시장 교체·프로필 교체 양쪽에서 보존(시험 ok).
- **앱** MY 세금 화면은 단일 mutation 으로 바뀌었고 45009/45017 처리·refetch 후 adopt·캐시 무효화(`taxSaved`) 는 적절.
- **P2 1건**: 아직 라우팅되는 `MyCountryScreen`(MY-12, `/my/country`) 이 레거시 `save_store_market_profile` 로 국가·**가격 기준**만 저장한다 — 이 경로는 시장을 교체하면서 세금 프로필을 닫거나 지우고 새 프로필을 만들지 않으며(0217 이 없애려던 부분 상태), 메뉴 전파도 없고(0215 미패치), 원장 이후 가격기준 변경은 45017 로 거부되어 새 계약과 모순된다.
- P3 4건(generic `tax_rules` 사건의 affects/노이즈, tests/77 의 "원장 이후" 미검증, 레거시 시장 writer 전파 부재, 시험 공백), P4 5건.

## 2. 항목별 검토

### 2.1 0215 전파 함수 (확인 + 추정)
- `tax_menu_change_basis(store,date,recipe)`: 메뉴별 `{tax, net, components(component_id 제거·순서), price_basis, treatment(카탈로그→override→기본), rules(프로필 components 전체)}`. 시장·프로필은 **날짜 범위**로, override 는 `effective_from<=date` 최신으로 조인 → before 는 옛 프로필, after 는 v_effective 부터의 새 프로필을 본다.
- `propagate_tax_menu_change`: `a=b → continue`, `monetary = (tax,net) distinct`, 라벨은 "이름 요율% 납부주체" 결합, change_line 5종(derived) → 빈 배열이면 `rules` 차이만으로 generic `tax_rules` 1줄. 비활성 메뉴도 사건은 남기고 recompute 만 생략(0211 과 동일 태도). correlation 1개.
- 앵커: `save_store_tax_profile` 의 `v_effective:=greatest(next_unopened,v_market.effective_from);` 와 `return jsonb_build_object('changed',true,'profile_id',v_new,`; `save_menu_tax_override` 의 `v_effective:=greatest(next_unopened,v_profile.effective_from);`(dump L11062) 와 `'changed',true,'revision',v_revision,`(무변경 반환은 `'changed',false,'revision',v_row.revision` 이라 매치되지 않음). 정확히-1회 가드 있음. `declare` → `declare v_menu_before jsonb;` 는 regexp 첫 매치 치환(함수 머리 `declare` 1회).
- 영업 상태: recompute 는 `store_local_date` 로 호출 → open/break 는 0206 조기 반환, 마감 루프가 `recipe_snapshot_entry` 의 `tax` 비교로 `tax` cause 반영. closed 는 `current_recipe_tax_quote(today)` → `current_tax_settings_date` = 다음 유효일 → 새 세금으로 점을 찍는다(tests/75 closed stage 2000 ok). 스냅샷은 쓰지 않는다(tests/75 스냅샷 불변 ok).
- ACL: 두 함수 executor 에만 execute. `tax_menu_change_basis` 는 SECURITY DEFINER(postgres 소유) 라 tests/34 허용 목록에 추가가 필요했고(17:17:39 갱신), tests/16 목록도 갱신됨.

### 2.2 0216 (확인)
- 앵커 `    v_money := v_composition or (v_before.price` 는 0212 이후에도 1회 존재. 두 필드의 비교식은 v2 본문의 change_line 계산식과 동일(`coalesce(payload, before)`).
- 결과: affects_sales=true → open/break 대기, close 후 basis 교체. lines 가 있으면 base_servings 변경은 per_serving 을 바꿔 v_mat 차이로 e3(추이) 가 정당하게 생기고, 없으면 추이 없음(tests/76 은 lines 없음).

### 2.3 0217 원자 저장 (확인 + 추정)
| 점검 | 판정 |
|---|---|
| 두 판본 CAS | L65–67 `m`/`t` 를 `for update` 후 4값 비교 → 45009. 이후 apply v2 들이 같은 값으로 재검사(같은 트랜잭션). 시장이 바뀌면 세금 base 를 null 로 넘겨 새 시장의 첫 프로필(revision 1) 로 만든다 |
| 원자성 | 단일 plpgsql 함수 안의 예외는 전체 롤백(tests/77 22000 ok). 순서: before basis → carry → 시장 → 세금 → carry 복원 → 전파 |
| 시장 guard | `tax_market_apply_v2` 만 완화(L42–48: 국가·지역·통화·언어 distinct 일 때만 45017). 원본 `save_store_market_profile` 은 그대로 엄격 |
| override carry | `tax_override_carry(t.id,d)` 는 recipe 별 최신 유효 행(revision·updated_at 포함), `restore…` 는 새 프로필에 `effective_from=d` 로 재삽입, 카테고리는 새 카탈로그에 활성으로 있을 때만, 매장 일치 join, `on conflict do nothing`. 시장이 바뀌면 옛 프로필이 지워지거나 닫히므로(market-writer L85–93) 사전 capture 가 필수이며 그렇게 돼 있다. 시장 불변 경로는 `save_store_tax_profile`/`tax_profile_apply_v2` 내부 복원(0217 L29–35) 이 담당, 시장 변경 경로는 L77 이 담당 — 이중 복원 없음(apply_v2 의 v_current 가 null 이라 carry '[]') |
| 사건 1회 | apply_v2 사본에서는 propagate 호출만 제거(L38) 하고, facade 가 최종 before/after 로 1회 호출(tests/77 메뉴당 1건 ok). 설정 이력은 시장·프로필 각 1건씩 남는다(의도된 구분) |
| 미래일 | `d` = next_unopened → 프로필 유효일 = greatest(d, 시장 유효일) = d. 새 시장도 같은 d 로 생성 |
| 권한 | `save_tax_configuration` authenticated·service_role 에 execute(기존 세금 writer 와 동일 부류의 postgres 소유 definer), 내부 writer 2개·복원 helper 는 전부 revoke(tests/77 ok). `notify pgrst` 있음 |
| 동시성 | `lock_business_scope` 로 직렬화, 마감 루프도 같은 잠금을 먼저 잡음(0206). 두 기기 경합은 두 번째가 45009 |

### 2.4 앱 (확인)
- `useSaveTaxConfiguration` 은 시장·세금 두 base(id/revision) 를 함께 보내고, 결과는 `parseProfileSaveResult`(changed/profile_id/revision/effective_from/application_mode) 로 읽는다. 화면은 성공 후 `state.refetch()` → `adopt`, 실패 시 45009 → `saveBlocked`, 45017 메시지는 "국가·지역·통화" 로 완화된 guard 와 일치.
- `taxSaved` = internationalTax(=recipeTax 접두) · configurationHistory · recipes · sales(salesTaxDetail 포함) · `['changes','recipe']`. 세금 변경이 건드리는 소비자를 모두 덮는다. `businessDay` 에 configurationHistory 추가도 마감 후 이력 갱신에 맞다.
- 레거시 `useSaveMarketProfile`/`useSaveTaxProfile` 은 남아 있고 전자는 `MyCountryScreen` 이 사용(§3 R7-1).

## 3. 발견 사항

### R7-1 · P2 · `MyCountryScreen`(MY-12) 이 여전히 시장 단독 저장 경로를 노출
- 위치: `apps/mobile/src/features/my/screens/MyCountryScreen.tsx` L6/13/26–29(`useSaveMarketProfile` → `save_store_market_profile`), 라우트 `app/(tabs)/my/country.tsx`, 진입 `MyHomeScreen.tsx:23`. 화면은 국가·주도·**메뉴판 가격(price_basis)** 을 편집한다.
- 문제(추정): ① 원장 이전 매장에서 국가/가격기준을 바꾸면 market-writer L85–98 이 세금 프로필을 지우거나 닫고 새 프로필은 만들지 않는다 → 0217 이 막으려던 "프로필 없는 교체 시장" 상태가 이 경로로 그대로 생긴다(`recipe_tax_quote_for_price` 가 null 을 돌려 메뉴 세금 미상). ② 0215 는 이 writer 를 패치하지 않아 가격기준 변경의 메뉴 사건이 없다. ③ 원장 이후 가격기준 변경은 45017 로 거부되어 MY 세금 화면(허용) 과 계약이 다르다.
- 최소 수정(안): 화면을 `useSaveTaxConfiguration`(현재 세금 payload 재전송) 으로 바꾸거나 가격기준 편집을 제거하고 국가 확인만 남기기; 서버 측은 `save_store_market_profile` 을 0215 전파에 포함하거나 앱 이전 뒤 authenticated 에서 닫기. tests/34 facade 수(82) 갱신 동반.

### R7-2 · P3 · generic `tax_rules` 사건의 affects_sales=true 범위 과다 (구체화 계획과 연결)
- 위치: 0215 L46–51. `rules` 는 `tax_profile_payload(t.id)->'components'` 전체라 `sort_order`·`key`·이름 순서 등 표시성 변경도 규칙 차이로 잡혀 모든 메뉴에 affects_sales=true 사건(대기 배지) 이 생긴다. 반대로 납부주체(hall 제외 채널)·계산기준·적용 treatment 변경은 실제로 매출 계산을 바꾸므로 true 가 맞다.
- 제안: 비교 전에 `sort_order`·`name`(이름은 이미 구성 라벨로 잡힘) 를 제거하고, 채널별 remittance / calculation_basis / applies_to_treatments 를 필드별 change_line 으로 풀어 generic 문구를 대체(ROOT 계획과 일치). 첫 국제 프로필 생성 시 모든 메뉴에 "세금 설정 반영" 이 붙는 것(before 는 레거시 quote) 도 같은 자리에서 판단.

### R7-3 · P3 · tests/77 "금액 원장 이후" 단언이 원장 없이 통과
- L35 "금액 원장 이후에도 가격 기준·세율 동시 변경 가능" 시점에 매장에는 `daily_sales/order_records/fixed_costs_monthly/price_trends/profit_trends` 가 없다(`store_has_money_ledger` false). 완화된 guard(0217 L45–48) 의 양쪽 — 가격기준 허용·국가/통화 거부(45017) — 이 실제로 검증되지 않았다. `quick_inbound` 1건 뒤 두 케이스를 추가해야 R7-1 ③ 과의 계약 차이도 시험으로 고정된다.

### R7-4 · P3 · 레거시 `save_store_market_profile` 에 메뉴 전파 없음
- R7-1 의 서버 측 원인. 0215 는 프로필·override writer 만 패치했다. 가격기준은 순매출을 바꾸므로 시장 writer 도 전파 대상이어야 한다(원자 facade 는 사본 `tax_market_apply_v2` 로 우회했지만 원본은 남아 있고 authenticated 에 열려 있음).

### R7-5 · P4 · closed 상태 추이 점 날짜
- 0215 L57 은 `store_local_date`(오늘) 로 점을 찍지만 변경 유효일은 다음 영업일(d) 이다. 값은 새 세금(§2.1) 이나 날짜는 오늘. 레거시 `save_store_tax` 와 같은 관행이라 기록만 남긴다.

### R7-6 · P4 · 불필요한 definer/노출
- `tax_menu_change_basis` 는 호출자가 모두 postgres 소유 definer 인데 SECURITY DEFINER + executor grant 라 tests/34 허용 목록에 들어가야 했다. invoker 로 두고 grant 를 없애면 목록 변경 없이 닫힌다. `propagate_tax_menu_change` 의 executor grant 도 같은 이유로 불필요.

### R7-7 · P4 · 활성 경계 이전/읽기 비활성 매장의 사건
- `recipe_tax_quote_for_price` 가 null 인 매장(활성일 이전, read 비활성) 에서는 tax/net/components 가 레거시로 같아지지만 `treatment`·`rules` 는 프로필에서 읽혀 사건이 생길 수 있다. 활성 이전 매장에서 프로필을 손질하면 메뉴 대기 배지가 뜨는 노이즈. `v_boundary>p_date` 면 전파를 건너뛰는 가드 검토.

### R7-8 · P4 · 시험 공백 (75/76/77)
1. tests/75: `profit_trends` 단언 없음 — 세율 변경 1점, 납부주체만 변경 0점, 재저장 0점, 비활성 메뉴 0점.
2. tests/75: generic `tax_rules` 사건의 `before_rules/after_rules` 존재와 affects 값 단언 없음(R7-2 구체화 후 갱신).
3. tests/77: 원장 이후 두 케이스(R7-3), 동시 세션(두 번째 45009) 은 단일 세션 stale 로 대체됨(수용 가능), carry 에서 **카테고리가 사라진 override** 가 탈락하고 `tax_treatment` 변경 사건이 남는지 단언 없음.
4. tests/76: lines 가 있는 메뉴의 base_servings 변경 → 추이 1점(재료비 변동) 인지 단언 없음.

### R7-9 · P4 · `MyCountryScreen` 외 레거시 훅 잔존
- `useSaveTaxProfile` 는 사용처가 없다(grep). 삭제 또는 테스트 전용으로 표시하면 두 요청 저장 경로가 코드에서 사라진다.

## 4. 캐시·순매출·전파 요약 (확인)
- 순매출: basis 의 `net` 은 quote `net_sales`, 가격기준 변경(포함→미포함) 은 net 10909→12000 으로 잡히고 profit 라인에 반영(tests/77 L40).
- 메뉴 가격/원가: 세금 변경은 price/material 을 건드리지 않고 tax/net/profit 만 움직인다. 재료비·부자재비는 사건 시점 값으로 profit 계산에만 쓰인다.
- 캐시: `taxSaved` 가 recipeTax(id)·recipes·changes/recipe·sales·configurationHistory 를 덮고, 화면은 refetch 후 adopt. 메뉴 override 저장도 같은 키.

## 5. 미해결·전제
- F3 는 0215 로 사실상 해소 대상(국제 프로필 writer 가 메뉴 이력을 남김) 이나 전체 회귀 결과 전이라 "해소 후보" 로만 표기. F8 해소 후보(0215 L89–92).
- R4-1, R5-1, R6-1~3 그대로. tests/34 갱신 뒤 재실행 결과(79/79 여부) 는 ROOT 확인 사항.