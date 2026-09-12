# LINKED-CHANGE 검수 R6 — 0214 현재 메뉴 원가(구매가·용량 수동 수정 우선) (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 0214 는 `fresh_linked_audit_20260912` 에만 적용, 개발 DB 는 0213 까지라는 전제 유지.
- 입력: `packages/db/supabase/migrations/20260912000214_current_ingredient_cost.sql` (7,839 B · 16:50:31 · sha256 `b6386f125f07f01bc10262b8bb04c2009270d47c4b72508e796511285de39693`). 대조 원문: `.codex/material-history-20260912/price-callers.sql` (81,040 B · 16:14:56 · sha256 `4f75968a0efab7e0c681a5699b30302a7d7789268bcce6222297d82dc21c1743`), 0208 이전 백업 dump(호출자 전수·`price_trends` 스키마·트리거·정책), 0206(마감 루프·recipe_list).
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. 시험 작성·전체 회귀가 진행 중이므로 **통과를 전제하지 않는다**. "확인" 은 파일 대조, "추정" 은 미실행 추론.
- 사용자 확정 계약(ROOT 전달): 구매가/용량 직접 수정 → 현재 메뉴 원가 반영; 다음 성공한 입고/취소 → 실입고 가중평균으로 복귀; 영업 전·종료 후 즉시, open/break 는 기존 기준 보존 후 종료 시 반영. 원장 `base_unit_price` 유지, 과거 수동 수정 backfill 없음.

## 1. 결론 요약

- 설계는 R2 의 B안(메뉴용 읽기 함수 분리) 을 override 컬럼 + `coalesce(override, base_unit_price)` 로 구현한 것이며, 원장 계산(`base_unit_price`, 입고·취소·폐기·재고 평가, `monthly_pl`) 은 문장 그대로 남아 있다(확인). 사용자 계약과 부합한다.
- **명시 reader 목록** 11개 + writer 3개(save_ingredient, e1, e11) 로 닫혀 있고, 0208 dump 의 `base_unit_price(` 호출자 전수(20개 함수) 와 대조한 결과 **누락 없음**. 전환하지 않은 6개(`day_unit_price` ③ fallback, `discard_stock_noted`, `e2_discard`, `e2_discard_reverted`, `ingredient_loss`, `quick_inbound_preview` 의 after 공식) 는 모두 원장·폐기 평가 또는 과거 fallback 으로 정책상 제외가 타당하다(§2.1).
- `save_ingredient`: before(`v_price0`, `v_costs`) 는 update 전, after(`v_after`, override 갱신, `v_price1`) 는 update 후에 잡히고, 이력에 `v_corr` 가 붙으며, 연결 메뉴 전파는 `not v_new and v_price0 is distinct from v_price1` 로만 실행된다(확인). 재시도·같은 값 재저장은 override 재기록·추이·전파 모두 없음(추정, §2.4).
- e1/e11: override 초기화는 두 함수 모두 `v_unit :=` 직전에 삽입되어 **duplicate/already_received/nothing_to_revert 반환과 예외 경로보다 뒤, 원장 쓰기(발주 상태·재고·이벤트) 뒤**에 있으므로 "성공 경로만" 조건을 만족한다(확인). `quick_inbound` 는 e1 을 호출하므로 같은 경로다.
- 영업 freeze: 모든 전파는 `recompute_recipe` 의 open/break 조기 반환(0206) 과 마감 루프의 `recipe_snapshot_entry`(전환됨) 비교에 의존하며, 스냅샷 작성 reader(`build_day_snapshot`, `recipe_snapshot_entry`, `add_to_day_basis`) 가 함께 전환되어 open 기준 보존 → 종료 반영이 성립한다(추정).
- 신규 P1/P2 없음. **P3 3건**(입고 이력·급등 판정의 before 값 의미 변경, 취소 후 남은 입고가 없을 때 원가 미상 복귀, 활성 기준 미노출·backfill 부재로 인한 신구 식재료 불일치), P4 4건, 시험 권고 10건.

## 2. 항목별 검토

### 2.1 호출 경계 (확인)
| 함수 | 0214 처리 | 판정 |
|---|---|---|
| add_to_day_basis, build_day_snapshot, recipe_snapshot_entry | 전환 | 스냅샷·기준 진입이 현재 메뉴 단가를 담아야 마감 비교가 맞다 |
| recipe_material_cost, recipe_detail, recipe_list(0206 재정의, unknown_cost_lines 포함), recipe_draft_preview_internal(0206 의 active_snapshot 분기 뒤 fallback), recipe_price_simulation | 전환 | 메뉴 원가 reader 전부 |
| ingredient_detail.base_price, ingredient_list.base_price | 전환 | 카드에 "현재 메뉴 단가" 하나만 보이게 됨(R2 C안 함정 1 회피). 단 어느 기준인지 표시 없음(§3 R6-3) |
| quick_inbound_preview | `base_price_before` 만 전환, `base_price_after` 는 원장 공식 유지 | e1 의 "before=현재, after=초기화 후 평균" 과 동일 의미 |
| save_ingredient, e1_confirm_inbound, e11_inbound_reverted | 전환 + writer 패치 | §2.2~2.3 |
| day_unit_price ③ | 미전환 | 영업 기록 없는 과거일 fallback. ①② 스냅샷은 전환된 reader 로 작성되므로 실사용 경로는 일관 |
| discard_stock_noted, e2_discard, e2_discard_reverted, ingredient_loss | 미전환 | 폐기·재고 평가는 원장(실입고) 기준 — 사용자 계약. 손익 원가(메뉴) 와 폐기 손실(원장) 이 다른 단가를 쓰는 이원화는 **의도된 결과**로 남는다(R2 C안 함정 5) |
| 마감 루프(0206 L216–229) | 간접 | `recipe_snapshot_entry` 를 통해 현재 단가 비교, cause `material` |
| quick_inbound | 간접 | e1 호출 → 초기화 동일 |

### 2.2 save_ingredient (확인 + 추정)
- 앵커 5개(선언 `v_new boolean;`, `v_price0 := …` 4칸 들여쓰기, `-- 안전재고·개당용량…` 주석, `v_ch, v_price0 is distinct from v_price1);`, `\n\n  return v_id;`) 는 원문 L1336/1383/1437/1473/1475–1477 에 각 1회 존재(메모 patch 의 `return v_id;` 는 들여쓰기·선행 공백줄이 달라 매치되지 않음).
- before: `v_price0` 는 L1383(update 전, `for update` 잠금 후), `v_costs` 는 그 직후 → 연결 메뉴별 재료비를 옛 단가로 고정(e1 의 `v_mat_before` 와 같은 기법).
- override 갱신: L1437 앞에 삽입되어 update(L1423–1434) **뒤**. 조건 `v_new or row(purchase_price,per_volume) is distinct` → 이름·카테고리·안전재고만 바꾼 저장은 override 를 건드리지 않아 입고로 초기화된 상태가 유지된다(계약 부합). 값 `purchase_price/nullif(per_volume,0)`; per_volume>0 강제(L1389) 라 0 나눗셈 없음; purchase_price null → override null(=평균 복귀), 0 → override 0(명시적 0원, check 통과).
- after: `v_price1`(L1449) 는 override 갱신 뒤라 현재 메뉴 단가. 이력 `unit_price` 라인 before/after 와 `affects` 모두 메뉴 기준으로 일관. `record_entity_change(..., null, v_corr)` 로 correlation 부여(인자 순서 0078 과 일치).
- 전파 블록: `price_trends` 에 `order_record_id null` 점(v_price1 not null 시), 연결 메뉴 전부 순회(비활성 포함), recompute 는 `rec.active and 재료비 distinct` 만, cause `material`·source 식재료 → `profit_trends.source_label` 에 식재료명(0211 의 부자재 전파보다 나은 표기). 이벤트는 `change_line` 이 둘 다 [] 면 0078 규칙으로 기록되지 않음.
- 영업 freeze: `lock_business_scope` 후 실행, recompute 는 open/break 시 조기 반환, 이벤트 affects=true 로 대기 표시, 마감 시 `material` 로 반영(추정).

### 2.3 e1 / e11 (확인)
- 전역 치환으로 e1 4곳(L410/421 멱등 반환, L436 `v_avg_prev`, L462 `v_unit`), e11 2곳(L287 `v_prev`, L301 `v_unit`) 이 현재 단가로 바뀌고, 초기화 update 는 `v_unit :=` 앵커(각 1회) 직전에 들어간다.
- e1 순서: 잠금 → 중복 반환 → 취소 예외 → 이미 수령 반환 → 수량 예외 → **발주 상태·재고·inventory_events 원장 쓰기** → 초기화 → `v_unit = base_unit_price`(override null 이므로) → price_trends(원장 점, order_record_id 있음) → 급등 판정·이력·메뉴 전파. 부분 입고(`partial`) 도 성공 경로라 초기화된다(가중평균에 포함되는 상태와 일치).
- e11 순서: 잠금 → nothing_to_revert 반환 → 재고 되돌림 → `v_prev`(현재) → 발주 상태 복귀 → 초기화 → `v_unit`(취소 건 제외 평균) → 추이·이력·전파.
- 초기화 조건 `menu_unit_price_override is not null` 로 불필요한 `ingredients_touch`(updated_at) 갱신을 피한다. 실패 시 같은 트랜잭션이라 함께 롤백.

### 2.4 재시도·no-op (추정)
- 같은 payload 재저장: `row(purchase_price,per_volume)` 불변 → override 재기록 없음 → `v_price0 = v_price1` → 추이·전파 없음, 이력은 달라진 필드 없음. 첫 응답 유실 후 재시도도 두 번째엔 `v_before` 가 이미 새 값이라 동일.
- 입고로 초기화된 뒤 값 변경 없는 재저장: override 는 null 유지 → 평균 계속 사용(계약: 다음 입고부터 평균).
- e1 중복 키 반환의 `unit_price` 는 현재 단가(초기화 이후라 평균) → 첫 응답과 같은 의미.

### 2.5 null / 0 / 비활성 / 다중 메뉴 (추정)
- purchase_price null: override null → 평균; 평균도 null(입고 없음) 이면 종전대로 원가 미상(`unknown_cost_lines`).
- purchase_price 0: override 0 → 메뉴 원가 0, price_trends 0 점. 명시적 0원으로 취급(0213 의 부자재 0원과 같은 태도).
- 비활성 식재료: save_ingredient 가 P0002 로 거부(L1369). 비활성 메뉴: 이력은 남고 recompute 만 생략(0211 과 동일).
- 다중 메뉴: `v_costs` 키 `recipe_id::text` 와 루프 `rec.id::text` 일치, correlation 공유.
- check 제약 `>=0 and < Infinity` 는 NaN 도 거부(PG 비교 규칙).

### 2.6 원장 영향 (확인)
- `base_unit_price` 본문·`order_records`·`inventory_*`·`monthly_pl`·폐기 평가 문장 무변경. 새 컬럼은 `ingredients` 에만, 데이터 backfill 없음.
- 변화 1: `price_trends` 에 수동 수정 점이 `order_record_id null` 로 추가된다(append-only 유지, 삽입 정책은 executor). 이 원장은 "단가 추이" 이므로 수동 점 포함이 계약과 맞지만, 앱이 null 을 구분하지 않으면 입고 점처럼 보인다(§3 R6-6).
- 변화 2: e1/e11 의 식재료 이력 `unit_price` 라인·급등 판정의 before 가 원장 평균이 아니라 현재 메뉴 단가가 된다(§3 R6-1).

### 2.7 ACL (확인)
- `current_ingredient_unit_price`: SQL STABLE invoker, postgres 소유(=`base_unit_price` 와 동일 부류), `revoke all from public,anon,authenticated,service_role` + executor grant. tests/16 의 "executor 소유 invoker 5개" 집합에는 들어가지 않는다(postgres 소유).
- reader/writer 재정의는 `create or replace` 라 소유·ACL 유지. 마감·크론(`close_due_business_days` 등 postgres 소유 definer) 은 postgres 로 실행되므로 grant 와 무관하게 호출 가능.
- 새 컬럼은 `ingredients` RLS(select) 를 통해 앱 역할에 보일 수 있으나 매장 범위 내이며 쓰기는 facade 만.

## 3. 발견 사항

### R6-1 · P3 · 입고 확정/취소의 "기준 단가" before 와 급등 판정이 수동 override 를 기준으로 바뀜 (의미 변경, 정책 판단)
- 위치: 0214 L124 전역 치환 → e1 L436 `v_avg_prev`, L474–481 이력, L466–467 `v_spike`; e11 L287 `v_prev`, L316–321.
- 내용: override 가 있을 때 입고 이력의 before 는 사용자가 친 값, after 는 원장 평균이 되어 "입고로 평균이 얼마에서 얼마로 움직였는가" 가 기록되지 않는다. 급등 경고도 원장 평균 대비가 아니라 수동가 대비로 판정된다(수동가를 낮게 넣어 두면 정상 입고도 20% 초과로 경고).
- 최소 수정(안): `v_ledger_prev := base_unit_price(...)` 를 별도로 잡아 급등 판정과 `unit_price` derived 라인은 원장 평균 기준으로 두고, 메뉴 관점 변화는 이미 메뉴 이벤트(`v_mat_before` 기반) 가 담고 있으므로 그대로 둔다. 또는 현재 동작을 계약으로 명시.

### R6-2 · P3 · 취소 후 남은 입고가 없으면 원가가 미상(null) 로 떨어짐
- 위치: e11 초기화 + `base_unit_price` null 반환(L90–95).
- 재현(추정): 신규 식재료에 구매가 입력(override) → 첫 입고(초기화) → 그 입고 취소 → `current = coalesce(null, null)` → 연결 메뉴 `unknown_cost_lines` 증가, 재료비 0 으로 계산.
- 계약("취소 건 제외 평균") 의 문자 그대로지만 사용자가 직전에 입력한 구매가를 알고 있는데 미상으로 돌아가는 것이 의도인지 확인 필요. 대안: e11 에서 초기화 후 평균이 null 이면 override 를 `purchase_price/per_volume` 로 두거나, reader 를 `coalesce(override, base, purchase_price/per_volume)` 로 확장(후자는 모든 미입고 식재료의 원가를 바꾸는 큰 정책 변경).

### R6-3 · P3 · 활성 기준(수동/입고평균) 미노출 + backfill 부재로 신구 식재료 불일치
- `ingredient_detail`/`ingredient_list` 는 `base_price` 하나만 내보내고 override 존재 여부를 알려주지 않는다. 입고 후 카드의 구매 가격 필드(수동값) 와 기준 단가(평균) 가 조용히 갈라지며, 그 사실은 입고 이력 1건에만 남는다(R2 C안 함정 1·3).
- backfill 없음은 확정 정책이나, 그 결과 "입고가 한 번도 없는 기존 식재료" 는 구매가가 있어도 계속 원가 미상이고, 0214 이후 만든 식재료는 즉시 원가가 잡힌다. 안전한 부분 backfill 후보: `base_unit_price is null and purchase_price is not null` 인 행만 override 를 채우는 것(원장 평균과 충돌할 수 없는 집합). 정책 판단 사항.
- 최소 계약 보완: detail/list 에 `menu_price_source: 'manual'|'inbound'|null`(또는 override 원값) 추가. 앱 반영은 범위 밖.

### R6-4 · P4 · 전파 게이트(정확 비교) 와 이력 라인(round 4) 비대칭
- `v_price0 is distinct from v_price1` vs `change_line(round(…,4))`. R4-3 와 같은 부류. 통일 권고.

### R6-5 · P4 · 마감 루프 recompute 에 source 없음 → 종료 반영 추이 점의 `source_label` 이 null
- 0206 L222 호출은 `p_source` 를 넘기지 않아 open 중 수동 수정 → 마감 반영 점은 식재료명이 없다. 즉시 반영 점(0214, source=식재료) 과 표기가 갈린다. 기존 동작이며 0214 범위 밖.

### R6-6 · P4 · `price_trends` 수동 점 구분자 부재
- `order_record_id is null` 이 유일한 표식. 앱 추이 차트·`ingredient_detail` 의 추이 목록이 이를 구분하는지 미확인(범위 밖). 컬럼 추가 없이도 detail 에서 `source` 를 파생해 내보내면 된다.

### R6-7 · P4 · `expected` 낙관적 검사와 새 컬럼
- `to_jsonb(v_before) @> p_payload->'expected'` 는 앱이 보낸 키만 검사하므로 새 컬럼이 자동으로 충돌을 만들지는 않는다. 앱이 `expected` 를 detail 출력이 아닌 원시 행으로 구성한다면 override 값 변동(입고 초기화) 이 40001 을 유발할 수 있음 — 앱 미확인.

## 4. 시험 권고 (작성 중인 시험에 반영 검토)
1. 영업 전/종료 후: 구매가 수정 → `recipe_detail.material_cost` 즉시 변경, `profit_trends` 1점(source_type ingredient, label 식재료명), 메뉴 이벤트 correlation 1개, 식재료 이벤트에도 같은 correlation.
2. open/break: 같은 수정 → effective 재료비 유지·has_pending true, `profit_trends` 없음; 마감 후 반영·대기 해제, cause material.
3. 같은 값 재저장·응답 유실 재시도: override/추이/이벤트/판본 불변.
4. 이름만 수정: override 불변(입고로 null 이 된 상태에서도 null 유지).
5. 첫 입고 성공 → override null, `base_price_before`(preview)= 수동가, e1 반환 unit_price = 평균, 메뉴 재료비 = 평균 기준, 메뉴 이벤트 before = 수동가 기준 재료비.
6. e1 duplicate·already_received·수량 0 예외·취소된 발주 예외 → override 유지.
7. 부분 입고(partial) → 초기화됨(의도 확인).
8. e11: 남은 입고 있음 → 취소 건 제외 평균; 남은 입고 없음 → null(R6-2 의 결정에 따라 기대값 확정).
9. purchase_price null/0, per_volume 변경만, 비활성 메뉴 연결, 다중 메뉴.
10. 원장 불변: `base_unit_price`·`inventory_events`·`monthly_pl`·폐기 손실 값이 수동 수정 전후 동일; `price_trends` 수동 점은 `order_record_id null`; tests/16 의 추이 개수 단언 갱신 필요 여부.

## 5. 미해결·전제
- F3, F8, R4-1(부자재 이름 backfill), R5-1(0원 연결 유실분) 그대로.
- 0214 는 시험·전체 회귀 미완이므로 본 문서는 정적 검수에 한정하며, 특히 `ingredient_detail`/`recipe_list` 의 값 의미 변경이 기존 시험(01 checksums 의 기준단가 4.0000 등) 과 충돌하는지는 실행 결과로 판단해야 한다(수동 수정 없는 시드에서는 override null 이라 동일할 것으로 추정).