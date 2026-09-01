# 전체 페이지 UI 가이드 적용본 검수 장부

- 적용본: `full-page-flow-prototype-ui-applied.html`
- 보존 원본: `full-page-flow-prototype.html`
- 작업 시작 원본 SHA-256: `9B538CE9ACD1D93AA75845EB1851391B8EB4C5732DF7094214E8AC5662428414`
- 검수 범위: 활성 화면 61개 + 활성 popup/state host 123개 = 약 184개 host 단위
- 고유 popup/state ID: 97개
- 숨김 유지: `discard_type`, `discard_period` 2개. 삭제하지 않고 활성 계약에서 제외한다.
- 실제 Expo 앱 수정: 없음

## 판정 규칙

각 화면은 아래 7개 항목을 모두 확인한 뒤에만 `PASS`로 바꾼다.

1. 구조: Header / Content / Page StickyAction / BottomTab의 소유권과 겹침
2. 요소: 병합 요소 사용, Card·RowGroup·Field·Result의 의미 분리
3. 상태: 기본·빈 상태·선택·오류·확인·완료 상태
4. 상호작용: 버튼·필터·뒤로가기·바깥 닫기·Escape·포커스 복귀
5. PC: 기본 데스크톱 viewport에서 카탈로그와 phone frame 확인
6. 모바일: 390×844, 이후 320px·큰 글꼴·키보드·safe area 추가 확인
7. 맥락: 이전·다음 페이지와 같은 정보 구조와 용어를 유지

상태 코드는 `TODO / COMMON / CODEX PASS / OPUS PASS / PASS / BLOCKED`만 사용한다.

## 공통 적용 1차

| 항목 | 구현 | Codex | Opus | 상태 |
|---|---|---|---|---|
| 원본 보존 | 별도 적용본 생성, 시작 SHA 기록 | PASS | 승인 가능 | PASS |
| 토큰 | 색·텍스트·선·간격·라운드·그림자·높이·터치 크기 | PASS | 긍정 | PASS |
| 병합 요소 | Card, RowGroup, Field, Result, Badge, Control, Layer, StickyAction | PASS | 긍정 | PASS |
| 의미 분리 | Field↔Result, Card↔선택행, Page StickyAction↔LayerFooter 분리 | PASS | 긍정 | PASS |
| popup 계약 | 활성 고유 ID 97/97 명시 등록 | PASS | 등록 확인, 런타임 전수검수 필요 | COMMON |
| popup 유형 | PageState / Picker / Form / Info / Action / Confirm / Success / Error / Popover | PASS | 긍정 | COMMON |
| 닫기 정책 | Confirm·Error 바깥 닫기 차단 | 샘플 PASS | 나머지 미검증 | COMMON |
| 접근성 | Confirm `alertdialog`, 제목 연결, focus-visible | 샘플 PASS | trap·focus 복귀 미검증 | COMMON |
| 반응형 | PC + 390×844 샘플 렌더 | 샘플 PASS | 320px·큰 글꼴·키보드 필요 | COMMON |

### Codex 1차 판정

`CONDITIONAL` — 공통 시각 언어와 명시적 popup 계약은 적용됐다. 식재료 메인, 정렬 PickerSheet,
입고 ConfirmDialog를 PC·모바일에서 확인했다. 전체 화면별 검수 전이므로 최종 승인은 보류한다.

### Claude Opus 1차 교차검수

`CONDITIONAL` — 원본 보존, 토큰 단일화, 의미 단위 병합, popup ID별 계약, 중앙 확인창 접근성은
승인 가능하다. 다만 97개 계약 중 샘플 3개만 런타임 확인되어 최종 PASS는 보류한다.

Opus가 지정한 후속 위험은 다음과 같다.

- Layer와 StickyAction의 z-index·스크롤 잠금 회귀
- 공통 토큰이 의도된 예외 강조를 덮는지 여부
- 320px·큰 글꼴·노치·키보드 환경
- Confirm/Error의 Escape·포커스 trap·복귀
- Notice·Badge 색 대비
- 뒤로가기 뒤 PageState 잔존

## 도메인별 진행표

| 도메인 | 화면 | popup/state host | 공통 | 화면별 Codex | 화면별 Opus | PC | 모바일 | 최종 |
|---|---:|---:|---|---|---|---|---|---|
| 식재료 | 12 | 26 | 적용 | TODO | TODO | 샘플만 | 샘플만 | TODO |
| 레시피 | 14 | 26 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |
| 발주 | 4 | 13 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |
| 매출관리 | 15 | 28 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |
| MY | 16 | 30 | 적용 | TODO | TODO | 미검수 | 미검수 | TODO |

도메인 수치의 합계는 popup/state의 host 중복을 포함한다. 고유 계약 완전성은 별도의 97/97로 검산한다.

## 페이지별 기록 형식

각 화면과 popup/state는 아래 한 줄 형식을 추가한다. 수정 전 문제, 수정 내용, 재검수 증거를 생략하지 않는다.

| target | 문제점 | 수정안·병합 요소 | Codex 검수 | Opus 검수 | PC | 모바일 | 맥락 | 상태 |
|---|---|---|---|---|---|---|---|---|

검수 중 다시 수정하면 이전 결론을 지우지 않고 같은 target 아래 `재검수 N`을 추가한다. 확정안 문서에는
마지막 PASS만 반영하고 이 장부에는 변경 과정을 남긴다.

## 식재료 페이지별 검수

### ING-01 · `screen:ingredient_main`

- 문제점: 실제 Expo에 있는 카테고리 중 6개가 프로토타입에서 빠졌고, 공통 Tabs에 접근 가능한 이름과
  선택 상태가 없었다. 정렬 버튼을 화면에서 눌렀을 때 URL·popup 계약이 설정되지 않아 제목 없는 generic
  dialog로 열렸다. 안전재고 기준값의 시각 위계도 너무 약했다.
- 수정안: 카테고리 13개를 `Tabs` 병합 요소 한 개로 구성하고 가로 스크롤을 유지했다. 확정 정렬 4개만
  유지하고 `SortButton → PickerSheet` 흐름을 명시적 `popup:sort` 계약에 연결했다. 식재료 목록은
  `ingredientInventoryCard` 병합 요소를 재사용하며 안전재고 값만 amber 보조 강조로 정리했다. 이전
  4카테고리·요약 카드형 `ingredient_main` 중복 renderer도 제거했다.
- Codex 검수: DOM에서 Header, 카테고리 nav, 정렬 aria-label, 각 카드의 필수 6개 정보와 조건부
  안전재고 정보, FAB, BottomTab을
  확인했다. FAB는 `ingredient_add`로 이동하고 정렬 버튼은 이름 있는 PickerSheet와 popup URL을 연다.
- 시각 검수: 실제 Expo와 적용본을 나란히 확인했다. 모바일 390×844에서 가로 카테고리, 카드, FAB,
  BottomTab 겹침이 없다. 공통 적용 전 PC 기본 폭에서도 phone frame·catalog 배치를 확인했다.
- Opus 1차: `CONDITIONAL`. 안전재고 강조·표본 카드 개수 표현·중복 renderer·인라인 카드 반복을
  지적했다. 실제 후행 CSS의 amber override를 확인하고, 문서 표현을 `5개 표본 카드의 각 7개 정보`로
  정정했으며, 중복 renderer 삭제와 `ingredientInventoryCard` 추출을 완료했다. 재검수 대기 중이다.
- Opus 2차: `CONDITIONAL`. 병합 요소와 중복 renderer 문제 해소를 확인했고, 남은 문제로 amber의
  하드코딩 색상과 조건부 안전재고를 7개 고정 정보처럼 기록한 문구를 지적했다. amber를 기존
  `--amber` 토큰으로 연결하고 문서를 `필수 6개 + 조건부 안전재고`로 정정했다.
- Opus 3차: `CONDITIONAL`. 위 두 문제 해소를 확인하고, 정렬 버튼이 공통 popup 연결 속성을 직접
  갖지 않은 점을 마지막 결함으로 지적했다. `data-popup-link="sort"`를 추가해 공통 popup 연결로 묶었다.
- Opus 4차: `PASS`. `renderIngredientMain → data-popup-link=sort → openPopupTab → openSortPicker`와
  선택 동작을 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-01 · `popup:sort@ingredient_main`

- 문제점: 화면 직접 진입에서는 명시적 popup ID가 없어 dialog 제목 연결과 닫기 정책이 빠졌다.
- 수정안: `activePopup=sort`, URL, PickerSheet 계약, 제목 연결, 선택 즉시 적용·닫기를 한 흐름으로 묶었다.
- Codex 검수: 이름 있는 `dialog \"정렬 기준\"`, 최신순·재고 적은 순·단가 높은 순·이름순, 현재 선택
  check, 선택 즉시 닫기를 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-02 · `screen:ingredient_add`

- 문제점: 필드처럼 보이는 `span`이어서 입력할 수 없었고, 별도 메모 수정 흐름이 있는데 메모 필드가
  중복 노출됐다. 필수값이 비어도 추가 버튼이 활성 상태였으며 카테고리·단위를 고르면 입력값이
  사라질 수 있었다.
- 수정안: `Field` 병합 요소를 실제 text/number input, 선택 Button, suffix로 구성했다. 메모와 기본
  거래처를 제거하고 `구매 단가`는 `Result` 병합 요소로 분리했다. 구매 링크 안내는 입력 폭과 같은
  notice로 유지했다. draft 상태, 필수 검증, 기준단위 환산 구매단가 미리보기를 연결했다.
- Codex 검수: 초기 추가 버튼 disabled, 식재료명·용량·안전재고·최소 발주·카테고리 필수, 구매 가격
  선택 입력을 확인했다. 대파/1kg/4,000원 입력 시 `4.00원/g`, g로 변경 시 `4,000.00원/g`이 계산된다.
  카테고리·단위 선택 뒤에도 입력 draft가 유지되고 필수값 충족 뒤 버튼이 활성화된다.
- 시각 검수: 모바일 폭에서 label 위/값 아래, 숫자 우측 정렬, suffix 우측, 구매단가 Result,
  notice, StickyAction, BottomTab이 겹치지 않는다. 웹 숫자 spinner를 공통 제거했다.
- Opus 1차: `CONDITIONAL`. Picker의 12개 등록 카테고리를 전체 탭 포함 13개로 잘못 기록한 점,
  notice가 행동 링크 스타일을 상속한 점, 제거된 필드를 다시 문자열 치환하던 죽은 코드 3건, 음수
  안전재고 검증 허점을 지적했다. 문서를 12개로 정정하고 전용 `role=note` 스타일을 만들었으며,
  죽은 치환을 제거하고 안전재고를 0 이상으로 검증하도록 수정했다.
- Opus 2차: 두 PickerSheet의 `PASS`를 확인하고, 선택 입력인 구매 가격이 음수일 때 음수 구매단가를
  만들 수 있는 결함과 불필요한 전달용 wrapper를 지적했다. 구매 가격을 0 이상으로 clamp하고 wrapper를
  제거했다.
- Opus 3차: `PASS`. 음수 구매 가격 clamp와 직접 renderer 위임을 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-02 · `popup:add_category@ingredient_add`, `popup:add_unit@ingredient_add`

- 문제점: 화면 내 선택 버튼으로 열 때 popup ID·URL·제목 연결이 빠졌다.
- 수정안: 두 PickerSheet가 직접 진입과 카탈로그 진입에서 같은 `activePopup`, URL, 제목, 즉시 선택
  계약을 사용하도록 묶었다.
- Codex 검수: 이름 있는 카테고리·단위 dialog, 등록 가능한 카테고리 12개, kg/g/L/ml/개/모, check,
  선택 즉시 닫기와 draft 보존을 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-03 · `screen:ingredient_detail`

- 문제점: 미리보기 카드마다 `expoRows + 전체보기`가 반복됐고, 3개 이하에서도 전체보기 버튼이
  노출됐다. 버튼 문구에 화살표가 남았으며 동일 단가의 최저·최고 badge가 여러 입고에 반복됐다.
- 수정안: `detailPreviewRows`와 `detailPreviewSection` 병합 요소를 만들었다. 3개까지만 본문에 표시하고
  4개 이상일 때만 `전체보기`를 노출한다. 구매 링크·기준 단가·최근 입고·폐기 내역·현재 재고의
  순서를 유지하고 전체보기 문구에서 화살표를 제거했다. 같은 단가의 최저·최고는 최신 입고 한 건에만
  함께 표시한다.
- Codex 검수: 구매 링크 4개 중 3개+전체보기, 최근 입고 3개·폐기 2개에는 버튼 없음, 현재 재고
  4개 중 3개+전체보기를 확인했다. 수정→수정 메뉴, 구매 링크 전체보기→options, 재고 전체보기→stock
  연결을 확인했다. 최근 수정은 7일 내 기록이 있을 때만 `recentChangeButton`이 반환한다.
- 시각 검수: 모바일 폭에서 상단 정보·재고 summary·구매 링크·기준 단가 카드의 위계와 하단 탭
  가림을 확인했다. 구매 링크 행은 왼쪽 구매처/금액, 오른쪽 용량/단가로 유지되고 화살표가 없다.
- Opus 1차: `CONDITIONAL`. 폐기 전체보기의 숨김 route 의존, 재고 summary의 전체 문자열 replace,
  빈 상태 action과 전체보기의 스타일 혼용, 고정된 최근 수정 기준일을 지적했다. 폐기 링크를 명시적으로
  `stock`과 `폐기` filter에 연결하고, stock summary를 직접 renderer로 통합했으며, 빈 상태 전용
  `empty-action`과 현재 날짜 기준 7일 판정을 적용했다. PageState URL 복원이 없다는 지적은 실제
  `openPopupTab`의 선행 URL 기록과 직접 URL 재진입 테스트로 반증했다.
- Opus 2차: 두 PageState의 `PASS`를 확인했다. 폐기 표본이 2개라 4개 이상 연결을 실제 검증할 수 없는
  점과 stock filter 누수, 연말·연초 날짜 판정을 지적했다. 폐기 표본을 4개로 구성해 3개+전체보기
  상태를 노출하고, 폐기는 `폐기`, 현재 재고는 `전체` filter를 명시했다. 월이 현재 월보다 크면
  전년도 기록으로 판정하도록 연도 경계도 보완했다.
- Opus 3차: screen과 구매 링크 PageState 2개 모두 `PASS`. 폐기·전체 filter와 연도 경계를 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-03 · 구매 링크 PageState 2개

- `ingredient_option_filled`: 최대 3개를 보여주고 4개 이상이면 전체보기를 노출한다.
- `ingredient_option_empty`: `등록된 구매 링크가 없어요`와 `＋ 구매 링크 추가`를 노출한다.
- Codex 검수: 빈 상태의 추가 버튼이 `options&popup=option_add`로 연결되는 것을 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

## 전체 target 장부

아래 목록은 숨긴 폐기 전용 페이지를 제외한 활성 screen 61개와 popup/state host 123개다.

| target | domain | type | common | Codex | Opus | PC | mobile | final |
|---|---|---|---|---|---|---|---|---|
| screen:ingredient_main | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_add | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_detail | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_edit_menu | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_edit | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:stock | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:stock_change | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:memo_edit | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:purchase | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_changes | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:options | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_delete | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_main | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_detail | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_price_sim | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_add | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_edit | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_ingredient_search | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_material_search | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_materials | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_category | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_material_category | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_changes | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:profit | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:fixed_average | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:fixed_actual | recipe | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:order_main | order | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:order_detail | order | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:order_receive | order | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:order_direct | order | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:sales_main | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:analytics | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:day | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:day_full | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:revenue | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:menu | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:channel | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:material | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:extra | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:waste | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:sales_fixed | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:expense | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:tax | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:stock_check | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:sales_past | sales | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_main | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_fixed | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_fixed_edit | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_settings | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_ingredient_categories | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_recipe_categories | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_material_categories | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_materials | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_tax | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_language | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_units | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_vendors | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_channels | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_hours | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_notifications | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:my_account | my | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sort@ingredient_main | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:ingredient_option_filled@ingredient_detail | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:ingredient_option_empty@ingredient_detail | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:add_category@ingredient_add | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:add_unit@ingredient_add | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:edit_category@ingredient_edit | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:edit_unit@ingredient_edit | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_inbound@stock_change | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_deduct@stock_change | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_discard@stock_change | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_option@stock_change | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_confirm@stock_change | ingredient | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_error@stock_change | ingredient | ErrorDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_list@options | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_add@options | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_edit@options | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_vendor@options | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_vendor_new@options | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_unit@options | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_card_menu@options | ingredient | ActionSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_more@options | ingredient | PopoverMenu | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:option_delete@options | ingredient | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_period@stock | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_type@stock | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_order@stock | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_event_more@stock | ingredient | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_event_revert@stock | ingredient | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:purchase_period@purchase | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:ingredient_change_detail@ingredient_changes | ingredient | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_sort@recipe_main | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_status@recipe_main | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_target@recipe_main | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_memo@recipe_detail | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_stop@recipe_detail | recipe | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_category_pick@recipe_add | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_target_help@recipe_add | recipe | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_category_pick@recipe_edit | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_target_help@recipe_edit | recipe | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_ingredient_usage@recipe_edit | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_ingredient_usage@recipe_ingredient_search | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_material_usage@recipe_material_search | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_add@recipe_materials | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_edit@recipe_materials | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_category_pick@recipe_materials | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_delete@recipe_materials | recipe | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_add@recipe_category | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_edit@recipe_category | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_delete@recipe_category | recipe | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_add@recipe_material_category | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_edit@recipe_material_category | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_delete@recipe_material_category | recipe | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_change_detail@recipe_changes | recipe | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:profit_detail@profit | recipe | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_period@fixed_average | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_period@fixed_actual | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_channel@fixed_actual | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_item_add@fixed_actual | recipe | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_candidates@order_main | order | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_waiting@order_main | order | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_received@order_main | order | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_order@order_main | order | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_receive@order_main | order | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_cancel@order_main | order | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_revert@order_main | order | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_price_spike@order_main | order | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_order@order_detail | order | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_receive@order_receive | order | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_ingredient@order_direct | order | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:order_vendor@order_direct | order | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_state@sales_main | sales | ActionSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_break@sales_main | sales | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_close@sales_main | sales | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_sort@sales_main | sales | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_qty@sales_main | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_shortage@sales_main | sales | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_etc@sales_main | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_expense@sales_main | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_period@analytics | sales | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_direct_period@analytics | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_menu_profit@day | sales | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_revenue_all@revenue | sales | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_material_detail@material | sales | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_extra_detail@extra | sales | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:sales_fixed_expand@sales_fixed | sales | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:expense_add@expense | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:expense_delete@expense | sales | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:past_sale_qty@sales_past | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:past_etc@sales_past | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:past_expense@sales_past | sales | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:past_save@sales_past | sales | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:stock_check_all@stock_check | sales | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_period@my_fixed | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_period@my_fixed_edit | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_channel@my_fixed_edit | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:fixed_item_add@my_fixed_edit | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_add@my_ingredient_categories | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_edit@my_ingredient_categories | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_delete@my_ingredient_categories | my | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_add@my_recipe_categories | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_edit@my_recipe_categories | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_delete@my_recipe_categories | my | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_add@my_material_categories | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_edit@my_material_categories | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:category_delete@my_material_categories | my | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_add@my_materials | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_edit@my_materials | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_category_pick@my_materials | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:material_delete@my_materials | my | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:tax_country@my_tax | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:tax_item_add@my_tax | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:tax_saved@my_tax | my | SuccessDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:language_preview@my_language | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:vendor_add@my_vendors | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:vendor_edit@my_vendors | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:vendor_delete@my_vendors | my | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:channel_edit@my_channels | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:channel_disable@my_channels | my | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:hours_start@my_hours | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:hours_end@my_hours | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:hours_break_start@my_hours | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:hours_break_end@my_hours | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:hours_timezone@my_hours | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:account_delete@my_account | my | FormSheet→ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
