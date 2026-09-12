# LINKED-CHANGE 검수 R12 — 메뉴 세금 화면 현재/예약 혼합 델타 (0228/0229) (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 개발 DB 는 0227 까지(백업 후 적용, 18 tables 불변 보고), 0228/0229 는 fresh 에만. 전체 verify 는 후보 ⑤ 진행 중 → **완료로 쓰지 않는다**. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론.
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. R1~R11 원문 보존, 본 문서 1개만 신규.
- 입력 지문(sha256 앞 16): 0228 `current_tax_treatment_context` 510 B · 18:01:44 · `308bfea93c7a5a06` · 0229 `closed_menu_tax_override_date` 545 B · 18:02:57 · `643b0d7a592bc359` · `tests/86_current_tax_treatment_context.sql` 4,652 B · 18:02:13(요청문의 "SQL86") · `RecipeTaxScreen.tsx` 5,937 B · 18:01:44 · `contracts.ts` +1/−1 · `packages/types/src/international.ts` +2 · `tests/internationalTaxScreens.test.tsx` +64/−… .
- 로그(확인): `tax-context-after.log` 86 **FAIL**("open: 종료 후 견적과 과세 기준 함께 전환", ok 10 → 0229 이전 반례 재현) · `tax-context-after-0229.log` 86 ok 22 / FAIL 0(5단언×4 + open/break 종료 후 2).
- 대조: 0214 이전 백업 dump 의 `recipe_tax_app_state`(L8548–8622: `v_settings_date`, `quote_context` 는 `v_quote` 가 있을 때만 생성·시장/프로필 미확인 시 raise) 와 `current_tax_settings_date`(closed 분기 `greatest(d,m.effective_from,t.effective_from)`), 0215/0222 `tax_menu_change_basis`.

## 1. 결론 요약

- **smoke 원인 제거(확인)**. `RecipeTaxScreen` 은 `useAppCapabilities`·`useRecipeTaxState`·`useRecipeDetail(readOnly)`·`useRecipeRecommendation`(활성 여부 판정용) 만 import 하고 MY 상태(`useInternationalTaxState`) 와 100원 미리보기를 쓰지 않는다. 금액·구성·납부주체는 `quote.components`(현재 견적), 시장·가격기준은 `quoteContext.market`, 과세 상태는 `quoteContext.treatment` 에서만 읽으므로 1091/12000 과 예약 요율이 한 화면에 섞일 경로가 없다. 적용 요율은 `primary.unroundedAmount / listedTotal` 로 현재 견적에서 계산한다.
- **0228 적절(확인)**. 읽기 전용 `recipe_tax_app_state` 의 `quote_context` 에 `'treatment'` 만 추가. 앵커 `'sales_channel_code','hall');` 1회 가드. 값은 `tax_menu_change_basis(p_store,v_settings_date,p_recipe)` 의 해석(카탈로그→override→기본값) 이며, `quote_context` 는 `v_quote` 가 있고 현재 시장·프로필이 확인될 때만 만들어지므로 그 안에서 treatment 가 JSON null 이 될 수 없다(기본값은 not null). 앱 계약은 `treatment?` optional 로 구/신 서버 모두 파싱된다(`c.treatment === undefined` 분기).
- **0229 적절(확인)**. `current_tax_settings_date` 의 closed 분기 `greatest(...)` 에 같은 매장·현재 프로필의 `max(menu_tax_overrides.effective_from)` 을 추가. open/break 분기와 활성 경계 guard 는 앞에 그대로 있다. 프로필 변경 없이 open 중 메뉴 override 만 저장(effective_from=다음 영업일) 한 뒤 종료하면 종전엔 `t.effective_from`(과거) 이 상한이라 오늘 날짜로 quote 를 만들어 override 가 적용되지 않던 실제 반례를 고친다. `greatest` 는 NULL 을 무시하므로 프로필/override 가 없어도 안전하다.
- 0229 의 긍정적 부수 효과(추정): 마감 루프·`recompute_recipe` 도 `current_recipe_tax_quote → current_tax_settings_date` 를 쓰므로 override-only 변경이 종료 시 `tax` 추이로 잡히게 된다(tests/86 L45–47 의 tax_total 1000 이 이를 함축).
- 신규 P1/P2 없음. P4 메모 3건.

## 2. 항목별 검토

### 2.1 0229 의미 범위 (추정)
- `max(o.effective_from)` 은 **매장 전체** override 를 본다. 한 메뉴의 예약이 있으면 매장의 현재 조회 날짜가 함께 다음 영업일로 옮겨가지만, 종료 상태에서 그 날짜의 시장·프로필은 동일(`effective_to null`) 하고 다른 메뉴의 override 도 `effective_from<=날짜` 로 함께 적용되므로 "종료 후 새 설정 사용" 계약과 일치한다. 판매 원장은 자체 영업일을 쓰므로 영향 없음(함수 주석 "Current menu UI only").
- 승격/합성 종료일 시나리오(0224) 로 override 가 D+2 인 경우 날짜도 D+2 가 되는데, 이는 프로필 예약이 D+2 일 때와 같은 동작이다.

### 2.2 앱 화면 (확인)
- 활성 전(legacy) 경로: `recommendation.status='unavailable' & reason='not_active'` 와 `quote===null` 이 모두 성립할 때만 `recipe_detail.taxBreakdown` 을 쓰고, 적용 요율은 서버 `rate` 만, 법정 세율·과세 상태·납부주체 카드는 숨긴다(시험 "9.0909 %" 표시·"법정 세율" 없음).
- 국제 경로: 합계/구성/소계 카드, 가격기준(현재 시장), 법정 세율(primary.ratePct), 적용 요율(4자리), 과세 상태(quoteContext.treatment), 납부주체(구성 owner 가 모두 같을 때만 단일 표기).
- 시험: MY 예약(기본 면세·20%·미포함) 을 mock 해도 화면은 현재 견적(10%·포함·과세) 만 보이고, 면세 현재 견적에 예약 과세 선택을 섞지 않는다.

## 3. 발견 사항 (신규 P1/P2 없음)

### R12-1 · P4 · 면세 메뉴 화면에 비적용 primary 의 "법정 세율" 행 노출
- 현재 quote components 는 비적용 항목도 0원으로 포함(R10 §1). 면세 메뉴에서 `primary` 가 존재하므로 "법정 세율 10 %" 와 "부가세 0원 0.0%" 행이 함께 보인다(시험 fixture 가 이 형태). 금액은 맞지만 "면세" 와 "법정 세율 10%" 가 한 카드에 있는 것은 이번에 없앤 혼합의 약한 형태다. `treatment!=='taxable'` 이면 법정 세율 행을 숨기거나 0225 와 같은 적용 필터를 화면에서도 쓰는 것을 권고.

### R12-2 · P4 · 구성이 비어 있을 때 납부주체 문구
- `owners.length===0` 이면 "항목·판매 채널별 설정" 으로 표시된다. 적용 항목이 없는 메뉴(필터 적용 시) 에는 "해당 없음" 이 맞다. R12-1 을 적용하면 함께 생기는 케이스.

### R12-3 · P4 · 읽기 capability 비활성 매장
- `beforeActivation` 이 `enabled` 를 전제하므로 `read_enabled=false` 매장은 legacy 세액도 보이지 않고 안내 문구만 남는다. 해당 매장에서 이 화면으로 오는 진입이 막혀 있다면 문제 없음 — 앱 라우팅은 범위 밖이라 기록만.

## 4. 상태 표

| 항목 | 상태 |
|---|---|
| smoke 현재/예약 혼합(1091/12000 + 8.658%) | 해소(화면 데이터 소스 분리 + 0228 treatment 컨텍스트, UI 시험) |
| tests/86 실제 반례(override-only 후 종료 시 0원 유지) | 해소(0229, 수정 전 실패 로그 → 22단언 통과) |
| R4-1·R5-1·R6-1~3·R7-4·R7-5·R9-2·R11-1~2 | 변동 없음 |