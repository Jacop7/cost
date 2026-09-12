# 변경 전파·수정 사유 전수 검수 — Claude 독립 검수 R1 (2026-09-12)

상태: 읽기 전용 독립 검수 결과. 공식 Fable CLI 게이트·전체 verify를 대체하지 않는다.
입력: `docs/ai-review/evidence/LINKED-CHANGE-AUDIT-20260912.md` (SHA256 `b67cae24471acccf9c0c42242385d5aa29719750cc437359efb64d7f5037d5e2` 일치, 8,590 bytes).
기준: HEAD `d33b3fa0aca0b76edbe426684a5668e76f156f23` + 미커밋 작업본. 검수 시각 기준 파일 상태로 판정했으며 이후 변경은 반영하지 않았다.
직접 읽은 근거: 0063/0078/0079/0082/0088/0172/0186/0191/0204(0911)/0204~0208(0912) migration, `linked-probe.sql`·`linked-probe.log`(74 관찰), `status-db-tests.log`(67 시험), `f2-catalog-functions-20260910.json`의 `save_material` 정의, 앱 `changes/*`, `master-data/hooks.ts`, `lib/queryClient.ts`, 대상 화면 diff.

## 1. 입력 문서 재현 항목 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 부자재 단가 변경 → 메뉴 자동 이력 0건 | **결함 확인 (F1)** | `save_material` 본문(카탈로그 L42–51): `recipe_extra_costs` 갱신·`recompute_recipe` 호출만 있고 `record_entity_change` 없음. probe `material_price` 4상태 모두 `menu_events:0` |
| 부자재 무변경 저장 → profit_trends 중복 | **결함 확인 (F2)** | 같은 함수 L48–51이 값 비교 없이 항상 recompute. probe `material_noop` before_open/closed `extra_profit_trends:1` |
| 같은 비용 부자재 교체 → 메뉴 이력 0건 | **결함 확인 (F4)** | 0079:282–305 `v_ch`는 이름·가격·인분·목표율·판매량·상태·비용 합계만 비교. 구성 행·카테고리는 change_line이 없어 0078:67에서 사건 자체가 생성되지 않음 |
| 세금 수정 → 메뉴 자동 이력·추이 0건 | **결함 확인, 단 범위 정정 (F3)** | probe는 국제 프로필 `save_store_tax_profile`만 호출. 이 경로(0186)는 `store_configuration_changes`만 기록. **legacy `save_store_tax`(0172:241–259)는 '세금 반영' 사건과 `recompute_recipe(...,'tax')`를 이미 기록**한다. 두 경로의 비대칭이 결함이다 |
| 대기 후 이름 수정 → 상단 대기 소실 | **결함 확인, 0208 후보가 해소 (F5)** | 0082 `last_entity_change`는 최신 사건 1건의 state만 반환. 0208 L12–28이 `has_pending_change`를 별도 계산. 시험 67 통과 |
| 부자재 저장 캐시 누락 | **결함 확인 (F6)** | `queryClient.ts:125 settingsSaved`에 `['changes']`·`qk.configurationHistory` 없음 |
| 실제 된장 참고가/용량 → 메뉴 단가 불변 | **계약 차이(결함 아님)** | `base_unit_price`는 입고 원장(0072 volume-weighted) 기준. §6에 최소 계약 제안 |
| 부자재 마스터 비활성화 → 메뉴 비용 유지 | **계약(소프트 삭제)**, 0207 트리거로 이력은 남음 | probe `material_master_delete retained_menu_extra:500` |
| 메모·재고 수량 | **정책 제외 유지** | 기획 §11.9, 0077 |

## 2. Findings

### F1 · P1 · 부자재 단가 변경이 연결 메뉴 수정 내역을 만들지 않는다
- 위치: `public.save_material(uuid,jsonb)` 본문 L42–51(카탈로그 정의; 0911-0204는 이 본문을 `recipe_edit_material_apply_v2`로 md5 고정 복사하고 facade L287에 advisory lock만 추가).
- 재현: 부자재 unit_cost 300→500 저장 → 연결 메뉴 `recipe_extra_costs.amount_per_serving` 갱신, 영업 전/종료면 profit_trends +1, `entity_change_events` 0건(4상태 공통).
- 영향: 메뉴 수정 내역에 '부자재 단가 반영' 사건이 없어 사용자 결정 "빠짐없이 반영"에 위배. 영업 중에는 `entity_change_state` 기반 대기 판정도 불가능해 0208 part 2의 material 분기가 이를 우회하고 있다(사건이 없는데 대기만 표시되는 비대칭).
- 수정 제안: facade에 단가 변경 시에만(old.unit_cost is distinct from new) 연결 활성 메뉴마다 `record_entity_change(p_store,'recipe',r.id,<source>,'부자재 단가 반영', change_line('extra_cost','부자재비',before,after,'원','derived') || change_line('profit',...,'derived'), true, v_id, v_corr, '<부자재명> 단가 변경')`. `change_source` enum(0063:35–40)에는 material 값이 없으므로 `'ingredient'` 재사용보다 enum 값 `'material'` 추가 + `sourceLabel`(changes/hooks.ts:254–265) 분기 추가를 권한다. 고정 helper 본문은 건드리지 말고 facade 패치로.
- 회귀시험: material_price → 연결 메뉴 수 = 사건 수, 미연결 0, source/제목/summary 고정, 영업 중 state=not_reflected·종료 후 reflected, 같은 correlation_id로 부자재 측 사건 1건(선택).

### F2 · P2 · 부자재 무변경 저장·이름/메모만 수정 시 profit_trends 중복
- 위치: 같은 본문 L43–51.
- 재현: 동일 unit_cost 재저장 또는 이름만 변경 → 영업 전/종료 상태에서 연결 메뉴 profit_trends +1(값 동일). 재시도·더블클릭도 동일(save_material은 idempotency key 없음).
- 영향: 손익 추이 그래프에 무의미한 점 누적, 수정 내역과 추이 불일치.
- 수정 제안: update 전 `unit_cost`를 읽어 변경된 경우에만 extra_costs 갱신·recompute 실행.
- 회귀시험: material_noop 4상태 0건, 이름만 변경 → `store_configuration_changes` 1건·trend 0건.

### F3 · P2 · 국제 세금 프로필(market/tax_profile/menu override) 변경이 메뉴 자동 이력·추이를 만들지 않는다
- 위치: 0186 `save_store_market_profile`/`save_store_tax_profile`/`save_menu_tax_override`, 0204:53–73 패치(설정 이력만 추가). 대조: 0172:241–259 legacy `save_store_tax`는 '세금 반영' 사건(source `'fixed_cost'`)과 `recompute_recipe(...,'tax')` 기록.
- 재현: probe tax_modify/add/delete 4상태 모두 `menu_events:0, profit_trends:0`; 영업 전/종료(즉시 적용)에서도 추이 없음.
- 영향: 즉시 적용된 세율 변경이 손익 추이에 남지 않고, 메뉴 수정 내역에서 세금 원인이 보이지 않는다. 영업 중 대기는 0208 part 2 `kind='tax'`로만 표시된다.
- 수정 제안: 프로필 writer의 `changed=true` 분기 끝에서 활성 메뉴마다 `recipe_tax_quote_for_price(id, 적용일, price)` 전후로 '세금 반영' 사건 기록(derived 세금/순이익 줄), `application_mode='immediate'`면 `recompute_recipe(id,'tax',today)`까지 호출. 영업 중이면 사건만 남기고(0206 종료 루프가 cause 'tax'로 추이 생성). legacy와 같은 source 값·제목을 쓰되 `'fixed_cost'` source 재사용은 F8 참조.
- 회귀시험: 4상태 × modify/add/delete → 사건 수 = 활성 메뉴 수, 즉시 상태 trend +1(cause tax), 영업 중 0 후 종료 시 1, 프로필 무변경 재저장 0.

### F4 · P2 · 같은 비용 구성 교체·카테고리 변경이 메뉴 직접 수정 이력을 만들지 않는다
- 위치: 0079:282–305(0191 패치로 순매출만 교체). `category_id`, lines/extras 행 자체는 change_line 대상이 아님. v2 `recipe_edit_shape_v2`는 구성 차이를 감지해 `edit_revision`을 올리지만 감사 카드는 비용 합계만 본다.
- 재현: probe menu_material_same_cost_swap `menu_events:0`. 동일 조건: 같은 단가 식재료 교체, 사용량 반올림 동일, 부자재 이름만 변경, 카테고리 변경.
- 영향: 판본은 올라가는데 이력이 없어 "누가 무엇을 바꿨나"를 재구성할 수 없다.
- 수정 제안: `v_ch`에 직접 줄 추가 — `change_line('category','카테고리',old_name,new_name)`, 구성 diff는 행 단위 라벨('부자재 구성': '검수 용기 1개' → '새 검수 용기 1개', '재료 구성': '된장 100g' → …). `affects_sales`(`v_money`)는 비용 변화 여부를 유지해 같은 비용 교체는 state 'irrelevant'로 남긴다.
- 회귀시험: same_cost_swap → 사건 1·affects false·요약 '부자재 구성 변경'; 카테고리만 변경 → 사건 1; 비용 변화 교체 → 사건 1에 direct+derived 줄 공존.

### F5 · P2 · 최신 사건이 irrelevant면 상단 대기 소실 — 0208 후보로 해소, 잔존 항목은 F7
- 위치: 0082:31–40 → 0208:12–28. 시험 67 10건 통과(`status-db-tests.log`).
- 판정: 후보 로직은 "대기 사건 존재 OR (영업 중 && snapshot에 메뉴 존재 && basis 이후 next_business 설정 변경 중 tax 전체/해당 월 fixed/연결 material)"로 설계 의도와 일치. 앱 `RecentChangeRow`는 `hasPendingChange ?? (hasHistory && state∈{not_reflected,partial})` fallback으로 구 API와 호환.

### F6 · P2 · 부자재 저장 후 수정 내역·설정 이력 캐시가 갱신되지 않는다
- 위치: `apps/mobile/src/lib/queryClient.ts:125` `settingsSaved = [settings, ingredients, sales, recipes, orders]`; `master-data/hooks.ts:240, 251`.
- 재현: 부자재 단가 저장 → 메뉴 상세(`qk.recipes` 포함이라 `last_change`는 갱신) 그러나 `ChangeHistoryScreen`(`['changes',…]`)과 새 `ConfigurationHistoryLink kind="material"`(`qk.configurationHistory`)는 stale.
- 수정 제안: `settingsSaved`에 `['changes']`, `qk.configurationHistory` 추가 또는 `materialSaved` 키 신설(F1 적용 후 메뉴 사건이 생기므로 필수).
- 회귀시험: 저장 성공 후 두 쿼리 refetch 호출 검증(UI 시험).

### F7 · P3 · 0208 대기 요약의 오탐·성능
1. **원복**: 영업 중 A→B→A(가격, 세율, 부자재 단가 모두 해당)는 사건/설정 이력이 남아 종료까지 `has_pending_change=true`이지만 종료 루프(0206:220–221)는 무변경으로 추이를 만들지 않는다. 화면은 "반영 예정"인데 실제 변화는 없다. 허용 가능한 의미("변경 요청이 있었다")라면 문구를 '영업 종료 후 재계산 예정'으로 완화하거나, 현재 basis와 현 값이 같으면 pending을 접는다.
2. **미래 월 고정지출**: 영업 중 다음 달 고정지출 편집은 `record_configuration_change`(0206:131–132)가 next_business로 기록. `store_configuration_history`의 요약(0208:36–40)은 `p_month`가 null이면 월을 보지 않아 설정 링크에 대기가 뜬다. part 2(0208:22)는 월을 필터하므로 메뉴 상단은 정상. 다음 달 편집은 애초에 immediate가 맞다(종료로 적용되는 값이 아님).
3. **국제 세금 read_enabled=false 매장**의 프로필 편집도 `kind='tax'`로 전 메뉴 대기 표시(표시 세금은 legacy라 실제 변화 없음). 저빈도.
4. **성능**: part 1은 엔티티의 모든 사건에 `entity_change_state`를 평가한다(사건마다 `current_business_day`+snapshot 조회). 입고가 많은 식재료 상세에서 지연. `e.business_day_id = 현재 영업일 id` 조건을 추가하면 의미 동일하게 축소된다(0063:144: 다른 영업일 사건은 항상 reflected).

### F8 · P3 · legacy 세금 사건의 source가 `'fixed_cost'`
- 위치: 0172:252. 앱 `sourceLabel`(changes/hooks.ts:260–261)이 '고정지출 설정'으로 표기. 배지('자동 갱신')는 맞지만 하위 설명이 틀린다. F3에서 세금 source를 통일할 때 함께 정리.

### F9 · P3 · 종료 시 부자재 단가 변경 추이 cause
- 0206:227은 extra_cost 변화를 `'recipe'`로 귀속(legacy save_material도 'recipe'). 부자재 단가 변경은 사장님 메뉴 편집이 아니므로 별도 cause가 없다면 문서에 명시. enum 확장 시 F1과 함께.

## 3. 표 밖 사례 점검 결과

| 사례 | 판정 | 근거/공백 |
|---|---|---|
| 재시도·중복 클릭 | 메뉴 v2는 receipt 재생으로 무사건(F2 v5). 부자재·고정지출·프로필은 key 없음 → F2 중복 추이; 고정지출 무변경 재저장 시 `e4_fixed_cost_saved` 재기록 여부 **미확인** | 0070/0079 e4 본문 미열람 |
| 동시성(저장 vs 종료) | 0206이 save_fixed_costs/save_ingredient/quick_inbound/close에 scope lock 추가, save_material facade도 lock(0911-0204:287) | 프로필 writer 0186은 별도 검수에서 lock 확인됨 |
| 여러 대기 | part 1이 사건 전체를 보므로 첫 페이지 밖도 포함(시험 67) | — |
| 원복 | F7-1 | — |
| 동일 총액 다른 구성(고정지출 항목 교체) | `record_configuration_change`는 items jsonb 전체 비교 → 이력 남음. 메뉴 사건은 e4가 비율 동일이면 change_line 빈 배열 → 사건 없음(비용 불변이므로 정책상 허용 가능) | e4 본문 미열람 |
| 삭제 | 부자재 마스터: 소프트 삭제·이력 ✓. 메뉴 판매중지: 0079:290 '판매 상태' direct 줄 ✓. 식재료 비활성/카테고리 삭제 후 연결 메뉴 사건 **미확인** | — |
| 연결 없음/다수 | 미연결 부자재 0건 ✓(probe). 다수 메뉴 각 1건은 F1 수정 후 검증 필요 | — |
| 다른 매장 격리 | 시험 67 42501 ✓ | — |
| 과거 원장 보존 | 0206 DB65/64 마감 snapshot·판매 불변 ✓; 프로필 promote는 미래 행만 삭제 | — |
| 자정·월 경계 | 0206 next_unopened/basis_date 검증 완료(이전 검수) | — |
| 자동 종료 시 화면 갱신 | `useBusinessDay` 60초 폴링 + 상태 변화 시 recipes/internationalTax 무효화; `['changes']`·`configurationHistory`는 폴링 경로에서 무효화되지 않음 → 종료 후 상세 상단은 갱신되나 수정 내역 화면의 배지 상태는 재진입 전까지 stale 가능 | businessDay.ts:153–155 |
| 입고 취소/수정 상태 | e11 사건 존재(0079:465) — 영업 중 state·종료 후 전환은 probe 범위 밖 **미확인** | — |

## 4. 계약 차이·정책 제외 구분
- **참고 구매가·용량**: `save_ingredient`의 purchase_price/per_volume는 참고값이고 원가 기준은 입고 원장(0072). 결함이 아니라 계약이다. 사용자 기대는 §6의 새 계약으로만 충족된다.
- **메모**: 기획 §11.9 명시 제외(0077). 메뉴 memo patch는 revision만 올린다(probe pending_after_memo). 유지.
- **재고 수량**: 재고 원장에만 남기고 기준단가가 변할 때만 수정 내역 연결(입력 문서 §점검 원칙). 유지.

## 5. 회귀시험 목록(신규 후보 승인 전 필수)
1. DB: F1/F2/F3/F4 각 4상태 × 사건 수·source·affects·state·trend cause; 무변경·재시도 0건; 원복 시 종료 추이 0건.
2. DB: 0208 part 1 범위 축소 후 시험 67 재통과 + 다른 영업일 사건 대량 fixture 성능 비교.
3. UI: settingsSaved 무효화 키; ChangeSourceBadge 규칙(`sourceType!=='direct'`); ConfigurationHistoryScreen material 제목/삭제 표기.
4. 전체: 0207/0208 포함 fresh migration + SQL 68+ 재실행, 앱 전체 vitest, verify ②.

## 6. 참고가/용량 기대를 만족하는 최소 계약 제안(과거 원장 불변)
- 원칙: 입고 원장(`inventory_events`)·판매 원장·과거 snapshot은 쓰지 않는다. 변경은 "다음 원가 기준"에만 작용한다.
- 계약: `ingredients`에 `cost_basis_mode text check in ('inbound','reference') default 'inbound'` 1열 추가. `base_unit_price(ingredient)`는 mode='reference'이면 `purchase_price/per_volume`(용량 0·null이면 null=단가 미확인)을, 'inbound'면 기존 volume-weighted 값을 반환. 입고가 한 번도 없는 식재료는 mode와 무관하게 reference로 fallback(현재 null 표시 대체, 선택).
- 적용 시점: 기존 basis 규칙을 그대로 탄다 — 영업 전/종료 후 즉시(`base_unit_price`가 바로 바뀜), 영업 중은 `active_menu_business_basis` snapshot이 유지하고 종료 루프가 material cause 추이를 만든다(0206:224–226 구성 비교는 per_serving만 보므로 단가 변경은 material로 귀속됨).
- 이력: `save_ingredient`가 mode='reference'에서 purchase_price/per_volume/mode 변경 시 식재료 direct 사건('식재료 수정', 줄: 참고 구매가·개당 용량·원가 기준) + 연결 메뉴 `'ingredient'` source 사건('식재료 단가 반영', derived 재료비/순이익) + `recompute_recipe(id,'material',today)`(즉시 상태에서만). e1 입고 반영 경로(0066/0072)와 동일한 correlation 구조를 재사용.
- 입고 발생 시: mode='reference'면 입고는 재고 수량만 갱신하고 단가 사건은 만들지 않는다(원장은 그대로 기록). 사용자가 mode를 'inbound'로 되돌리면 그 시점부터 기존 volume-weighted 값으로 복귀하며 그 전환도 사건으로 남긴다.
- 화면: 식재료 상세 기준단가 카드에 '원가 기준: 입고 평균 / 참고 구매가' 토글 1개. 기본값은 'inbound'라 기존 매장 동작 불변.

## 7. 미확인 범위
- 0208 전체 회귀(입력 문서 인정), 0207/0208 포함 fresh apply 로그 미열람.
- `e4_fixed_cost_saved` 무변경 재저장 동작, `deactivate_ingredient`·카테고리 삭제 전파, e11 상태 전환은 본문을 읽지 않았다.
- `recipe_edit_material_apply_v2` 고정 helper가 카탈로그 정의와 동일하다는 것은 0911-0204의 md5 검사에 의존했다.
- UI 29 시험·타입 통과는 로그 제목만 확인했고 개별 시험 내용은 열람하지 않았다.