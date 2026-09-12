# 변경 전파·수정 사유 검수 — Claude 독립 검수 R2 (2026-09-12)

상태: R1(`LINKED-CHANGE-CLAUDE-20260912-R1.md`, 보존) 이후 Codex 추가 관찰·반박에 대한 대조 판정. 읽기 전용. 공식 게이트 대체 아님.
입력: `docs/ai-review/evidence/LINKED-CHANGE-EDGE-20260912.md`(SHA256 `9624376d7969bbc1d3925b41ff1719a57fb3278157473b77fce098a0a938f2a1`), `.codex/material-history-20260912/edge-probe.sql|log`(28 관찰, 오류 0), `status-db-all.log`(69/69, 15:54), `cache-before.log`(3 실패)→`cache-after.log`(17 통과, 16:00), 현재 `queryClient.ts`(settingsSaved에 `['changes','recipe']`, businessDay에 `configurationHistory` 반영됨).
HEAD `d33b3fa` 미커밋 작업본. 0207은 로컬 DB 적용, 0208은 미적용(입력 문서 기준).

## 1. R1 finding별 반박 수용 여부

| ID | R1 판정 | R2 판정 | 근거 |
|---|---|---|---|
| F1 부자재 단가 자동 이력 누락 | P1 | **유지** | edge 추가 관찰 없음. `save_material` 본문에 `record_entity_change` 부재 그대로 |
| F2 무변경 저장 추이 중복 | P2 | **유지·범위 확대** | edge `material_name_only` before_open/closed `trends:1`(이름만 바꿔도 추이). 동일 원인 L48–51 |
| F3 국제 세금 프로필 이력·추이 누락 | P2 | **유지** | 반박 없음 |
| F4 같은 비용 구성 교체 이력 누락 | P2 | **유지·설계 수정** | edge `same_cost_ingredient_swap` 4상태 `events:0`. affects_sales 제안은 §3에서 철회·재설계 |
| F5 대기 소실(0208) | 해소 | **유지** | 69/69·UI29 통과 확인 |
| F6 캐시 | P2 | **부분 오탐 인정·부분 유지** | `qk.configurationHistory=['settings','configuration-history']`는 `qk.settings=['settings']`의 prefix 하위라 `settingsSaved`가 이미 무효화한다 — R1의 configurationHistory 지적은 **오탐, 철회**. `['changes',…]` 누락은 실제였고 `settingsSaved`에 `['changes','recipe']` 추가로 해소(cache-after 17/17). 남은 것: §4-② |
| F7-1 원복 대기 | P3 | **결함 아님으로 종결(문구 메모만)** | §2 |
| F7-2 미래 월 고정지출 next_business | P3 | **유지** | 0206:131–132가 월과 무관하게 open이면 next_business 기록 |
| F7-3 read_enabled=false 국제 프로필 | P3 | 유지(저빈도) | — |
| F7-4 part 1 성능 | P3 | 유지 | — |
| F8 legacy 세금 source `'fixed_cost'` | P3 | 유지 | — |
| F9 부자재 추이 cause | P3 | 유지(문서화) | — |

새 관찰에서 추가된 결함:

**F10 · P3 · 고정지출 같은 합계 구성 변경이 즉시 모드에서 profit_trends를 만든다.** edge `same_total_fixed_composition` before_open/closed `trends:1, events:0`. 비율이 같으므로 메뉴 손익은 불변인데 추이 점이 생긴다(F2와 같은 유형, `save_fixed_costs`/`e4_fixed_cost_saved`가 비율 비교 없이 recompute — 본문 미열람, 관찰로 확정). 수정: 비율 `prev_rate is distinct from new_rate`일 때만 recompute. 회귀: 같은 합계 구성 변경 → 설정 이력 1·메뉴 사건 0·추이 0.

**F11 · P3 · 목록에 대기 신호가 없다(UX 신호 공백, §4-④).**

## 2. F7-1 원복 계약 판정

0063:17 이후 주석과 `recipe_change_state`(0063:131–153)는 "사건 시각 > basis_at → not_reflected"로 **사건 시점 기준**을 계약으로 못 박았고, 0208은 이를 그대로 요약한다. 값 기준으로 바꾸면 (a) 읽기마다 snapshot 대 현재값 diff가 필요하고, (b) 중간값이 존재했던 사실이 화면에서 사라지며, (c) 종료 루프(0206:220–221)는 이미 값 기준으로 추이를 만들지 않으므로 이중 기준이 생긴다. **사건 시점 계약 유지가 맞다.** 남는 것은 문구뿐이다: '영업 종료 후 반영 예정'은 값이 바뀔 것을 암시하므로 '영업 중 수정은 영업 종료 후 재계산돼요' 같은 중립 문구를 권한다(P4, 선택).

## 3. F4 재설계 — 금액 변화와 적용 대기의 분리

Codex 지적을 수용한다. R1의 "같은 비용 교체는 affects_sales=false" 제안은 **철회**한다. 이유: 열린 영업일 snapshot의 `lines`가 판매 소진과 원가 기준을 소유하므로(0058/0062 day basis, 0206 basis), 같은 단가 식재료로 교체해도 오늘 판매는 **이전 식재료 재고를 계속 차감**한다. affects_sales=false면 `entity_change_state`가 'irrelevant'를 돌려 상단 대기가 빠지고, 사용자는 교체가 이미 살아있다고 오해한다.

수정 제안(대체안):
- `save_recipe` 감사 카드의 `v_money`(0079 근방)를 `cost_changed OR composition_changed`로 확장. `composition_changed`는 v2 `recipe_edit_shape_v2` 비교 결과(lines/extras 다중집합, base_servings)를 재사용.
- 구성 변경 시 direct 줄을 추가: `change_line('lines','재료 구성', '<이름 수량 …>', '<이름 수량 …>')`, `change_line('extras','부자재 구성', …)`, `change_line('category','카테고리', old_name, new_name)`. 비용 줄(derived)은 기존대로 전후가 같으면 비어 있어도 된다.
- 결과: 같은 비용 교체 → 사건 1(직접 수정 배지), affects_sales=true → 영업 중 not_reflected·상단 대기 표시, 종료 시 값 동일이라 추이 0(0206 루프), 다음 영업일 state reflected. "금액 변화"는 derived 줄 유무로, "적용 대기"는 affects_sales로 분리된다.
- 카테고리·이름·목표율·월 판매량만 변경: affects_sales=false 유지(소진·원가 무관).
- 회귀: 같은 단가 식재료 교체 4상태 → 사건 1·affects true·open/break에서 `has_pending_change=true`·closed/before_open에서 false, 종료 후 추이 0; 부자재 같은 비용 교체 동일.

## 4. "영업 전/종료 후 즉시, 영업 중 종료 후 적용이 화면에 안 보인다" — 원인 분리

DB reader(`recipe_list`, `recipe_detail` effective, `recipe_price_simulation`, `recipe_tax_app_state`)는 0206·DB64/65·probe `inbound_price`/`after_close`에서 4상태 모두 요구대로 동작한다. 따라서 **계산·적용 자체의 미구현은 없다.** 화면에서 보이지 않는 원인은 다음 넷으로 나뉜다.

① **후보 미적용(환경)**: 0208이 로컬 개발 DB에 없으면 앱은 `has_pending_change`를 못 받아 `RecentChangeRow`가 `displayState` fallback으로 떨어진다 → 이름 수정 등 irrelevant 사건 뒤 상단 대기가 사라진다. 로컬 재현이 여기 해당할 가능성이 크다.
② **캐시(수정 진행 중)**: `businessDay.ts:155` 폴링 경로는 상태 변화 시 `internationalTax, recipes`만 무효화한다. `['changes']`(수정 내역 화면 배지)와 `qk.configurationHistory`(설정 링크 대기)는 60초 폴링으로 자동 종료를 감지해도 갱신되지 않는다. `invalidateOn.businessDay()`(수동 전이)에는 이미 포함돼 있으므로 폴링 경로를 같은 키 목록으로 맞추면 된다. 60초 지연은 설계 한계로 문서화.
③ **실제 미구현(이력)**: F1/F3/F4가 만들지 않는 사건은 화면에도 없다. 값(원가·세금)은 맞게 보이지만 "왜 바뀌었는지"와 "대기 중인 원인"이 빠진다. 부자재·국제 세금은 0208 part 2가 설정 이력을 근거로 대기만 보여 주는 상태다.
④ **UX 신호 공백(F11)**: `recipe_list`는 행별 `application_mode`/대기 여부를 돌려주지 않는다. 영업 중 메뉴를 저장하면 목록은 시작 기준 값을 계속 보여 주는데 행에 아무 표시가 없어 "저장이 안 됐다"로 읽힌다. 상세에만 `Notice`가 있다(RecipeDetailScreen). 최소 수정: `recipe_list`에 `application_mode text`(basis 유무) 열 추가 + 목록 행 우측 회색 모래시계. 회귀: 영업 중 저장 후 목록 행 신호 표시, 종료 후 소거.

## 5. 참고 구매가·용량 계약 — A안 vs B안

**A안(R1)**: `ingredients.cost_basis_mode` + `base_unit_price` 자체가 모드에 따라 참고가/입고가를 반환. 변경 1곳이지만 `base_unit_price` 호출처가 17개(카탈로그 09-10 기준: add_to_day_basis, build_day_snapshot, day_unit_price, discard_stock_noted, e11_inbound_reverted, e1_confirm_inbound, e2_discard, e2_discard_reverted, ingredient_detail, ingredient_list, ingredient_loss, quick_inbound_preview, recipe_detail, recipe_list, recipe_material_cost, recipe_snapshot_entry, save_ingredient)라 **입고 단가 카드·폐기/취소 평가·입고 감사 줄까지 참고가로 바뀐다.** Codex 우려가 맞다. 철회.

**B안(권고)**: `base_unit_price`는 입고 원장 진실로 유지하고, 메뉴 원가 전용 `menu_unit_price(p_ingredient uuid)`를 신설: `case cost_basis_mode when 'reference' then nullif(purchase_price,0)/nullif(per_volume,0) else base_unit_price(p_ingredient) end`(null이면 '단가 미확인'). 교체 대상은 **메뉴 원가 reader만**: `recipe_material_cost`, `recipe_snapshot_entry`(lines.unit_price), `build_day_snapshot`(ingredients 맵 unit_price), `recipe_detail`(lines.unit_price), `recipe_list`(unknown_cost_lines), `recipe_draft_preview_internal`(0206:149–150), `day_unit_price`/`add_to_day_basis`(영업 중 처음 팔린 메뉴의 basis 추가). 유지: ingredient_detail/list의 기준단가 카드, e1/e11/e2/discard/quick_inbound_preview(원장 평가), save_ingredient 감사 줄.
- 적용 시점: 기존 basis 규칙 그대로(영업 전/종료 즉시, 영업 중 snapshot 유지, 종료 루프가 material cause 추이).
- 이력: `save_ingredient`가 reference 모드에서 purchase_price/per_volume/mode 변경 시 식재료 direct 사건 + 연결 메뉴 `'ingredient'` 사건('식재료 단가 반영') + 즉시 상태 recompute(e1 경로 재사용). 입고는 재고만 갱신하고 단가 사건 없음(원장 기록은 그대로). 모드 전환 자체도 사건.
- 리스크와 통제: 호출처 누락 시 목록/상세/시뮬레이션 원가가 갈린다. 승인 조건으로 "reference 모드 fixture에서 recipe_list·recipe_detail·recipe_price_simulation·recipe_snapshot_entry·day basis의 재료비가 동일" DB 시험 1개와, 입고 카드/폐기 평가는 입고가를 유지한다는 반대 단언을 요구한다.
- 기본값 'inbound'라 기존 매장 동작 불변. 사용자가 원하는 "참고가 30,000/3,000g → 10원/g 즉시 반영"은 해당 식재료를 reference 모드로 두면 충족된다.

## 6. 남은 상태 전환 결함(우선순위)

1. F1 · P1 부자재 단가 자동 이력(0208 우회 해소 포함).
2. F4(재설계) · P2 구성 변경 이력 + affects_sales=true.
3. F3 · P2 국제 세금 이력·즉시 추이.
4. F2·F10 · P2/P3 무변경·이름만·같은 합계 재저장 추이 중복.
5. ②·④ 캐시 폴링 키와 목록 대기 신호(수정 진행 중/신규).
6. F7-2 미래 월 고정지출 application_mode, F8 source 라벨, F7-4 성능.

## 7. 미확인
- 0208 로컬 적용 후 실기기 화면 재현(①의 확인은 Codex 측).
- `e4_fixed_cost_saved`/`save_fixed_costs` 본문(F10은 관찰만).
- 폴링 경로 수정본은 아직 읽지 않았다(진행 중이라 함).
- B안 호출처 목록은 09-10 카탈로그 기준이며 0912 migration에서 추가된 호출(0206:117/149/150)만 별도 확인했다. 최신 카탈로그로 재열거 필요.