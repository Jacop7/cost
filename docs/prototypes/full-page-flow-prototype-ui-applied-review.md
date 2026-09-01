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
| 식재료 | 12 | 26 | 적용 | PASS | PASS | PASS | PASS | PASS |
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

## 고정 지출 교차 화면 참고 계약

- 참고 원본: `all-detail-history-screens.html`의 `고정 지출 · 초기 평균`과
  `고정 지출 · 1개월 실제`를 보존된 설계 기준으로 사용한다.
- 레시피 역할: 메뉴 손익에서 초기 3개월 평균 고정지출률과 선택 월 실제 고정지출률을 상세로 확인한다.
- MY 역할: 고정 지출 항목의 등록·수정·관리와 월별 실제값 입력을 담당한다.
- 병합 요소: 두 도메인은 월 선택 Picker, 매출·고정 지출 요약 Card, 항목 RowGroup을 공유하되
  레시피는 읽기 중심, MY는 편집 중심 행동만 노출한다.
- 연결 기준: `fixed_average → fixed_actual` 흐름과 MY 고정 지출 편집이 같은 항목명·금액·비율·월을
  사용해야 한다. 레시피와 MY의 페이지별 검수에서 각각 Codex·Opus가 교차 확인한다.

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

### ING-03a · `screen:ingredient_edit_menu`

- 문제점: 메뉴 항목은 확정안과 맞았지만 닫기 버튼이 내용 폭을 갖지 못해 글자가 세로로 줄바꿈됐다.
- 수정안: `prototype-sheet-group`에 5개 행동을 유지하고 `prototype-sheet-close`를 별도 병합 요소로
  분리해 전체 폭·52px·독립 카드 형태로 고정했다.
- Codex 검수: 식재료 수정→`ingredient_edit`, 재고 수정→`stock_change`, 메모 수정→`memo_edit`,
  구매 링크 수정→`options`, 삭제→`ingredient_delete`, 닫기→`ingredient_detail` 6개 연결을 모두 눌러
  확인했다. 과거 재고 추가·실사 메뉴와 구매 링크·옵션 명칭은 노출되지 않는다.
- 시각 검수: 모바일 폭에서 underlay, 5개 action group, danger 색상, 분리된 닫기 버튼과 BottomTab이
  겹치지 않는다.
- Opus 1차: `CONDITIONAL`. `prototype-sheet-close` 이름 충돌로 다른 sheet의 34×34 X 버튼을 깨는
  회귀, 배경 탭 닫기 부재, options 뒤로가기 맥락 고정을 지적했다. 메뉴 전용 `edit-menu-close`로
  이름을 분리하고 배경 탭 닫기를 연결했으며, options 진입 출처를 상세/수정 메뉴별로 기록하도록
  수정했다. 두 출처에서 뒤로가기와 배경 탭 닫기를 실제로 눌러 확인했다.
- Opus 2차: `PASS`. selector 충돌 해소, 배경 닫기, options 출처별 뒤로가기를 확인했다. 레시피
  사용량 sheet의 오래된 중복 CSS는 해당 레시피 화면 검수 항목으로 이관한다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-04 · `screen:ingredient_edit`, `popup=edit_category`, `popup=edit_unit`

- 문제점: 추가/수정 화면의 겉모양은 병합돼 있었지만 수정 폼에는 별도 draft·검증 연결이 없어 picker
  왕복 시 입력값이 초기화되고 구매 단가·저장 가능 상태가 실시간으로 동기화되지 않았다.
- 수정안: `renderIngredientForm`과 `bindIngredientForm`을 추가/수정 공용 병합 요소로 완성하고, 각
  화면의 draft만 분리했다. 입력값→단가 계산→필수값 검증→저장 연결이 한 규칙을 사용한다.
- 제품 문구/구조: 기본 거래처·메모·구매 링크 관리·입력칸 아래 중복 설명은 수정 폼에 노출하지
  않는다. 구매 단가는 라벨이 입력칸 위에 있고 결과만 강조 영역에 우측 정렬한다.
- 상태 검수: 이름에 따옴표·꺾쇠를 포함해도 picker 왕복 후 보존된다. kg/L은 g/ml 기준으로 환산하고
  g/ml/개/모는 입력 단위를 유지한다. 필수값이 비면 저장이 비활성화되고 유효하면 상세로 이동한다.
- picker 병합: `immediatePickerMarkup`과 `bindImmediatePicker`를 만들어 카테고리·단위가 동일한
  radiogroup, 현재값 체크, 즉시 적용, 초기 포커스, 방향키/Home/End 이동 규칙을 사용한다. 단위
  항목의 작은 무게·부피·수량 설명은 제거했다.
- Opus 1차: `CONDITIONAL`. attribute escape, 현재 선택값 접근성 이름, label/button 구조, 단가
  live status, 초기 CTA guard, radio semantics와 포커스, 단위 보조문구를 지적했다.
- Opus 2차: 세 target 모두 `PASS`. 1차 지적 해소와 추가/수정 draft 분리, picker 왕복 재바인딩에
  신규 회귀가 없음을 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-05 · `screen:stock_change`와 입고·차감·폐기 상태

- 문제점: 입고/차감/폐기가 별도 문자열 치환과 MutationObserver 후처리에 의존해 입력값·계산 결과·
  접근성 상태가 서로 달랐다. 시연용 입고 확인은 성공 없이 항상 실패 팝업으로 이동했다.
- 병합안: `renderStockChangeBase`, `stockResultField`, `bindRadioButtons`, `stockDecreaseReady`를 공용
  요소로 사용한다. 탭·입력·결과·하단 행동은 같은 위치/크기/검증 순서를 공유한다.
- 입고: 구매처 미선택에서는 구매처 필드만 보인다. 저장 링크 선택 시 `구매처 · 상품명`과 등록된
  용량·금액을 표시하고 두 값은 읽기 전용이다. 직접 입력은 구매처명·용량·수량·금액·입고일이 모두
  유효해야 하단 버튼이 활성화된다.
- 구매처 선택: `미선택`, 저장 링크의 검정 첫 줄/회색 둘째 줄, 현재값 체크를 radiogroup으로 구성했다.
  `＋ 직접 입력`, `＋ 구매 링크 추가`는 하단 고정 2열이다. 링크 추가 후 옵션 목록을 거쳐 두 번
  뒤로가면 재고 수정 입력값이 보존된 채 복귀한다.
- 계산 결과: 총 입고량·입고 후 기준단가·차감 후 재고·폐기 후 재고·예상 손실은 라벨을 카드 밖 위에
  두고 값만 파란 결과 카드에 우측 정렬한다. 모든 값은 입력 즉시 live 갱신된다.
- 차감/폐기: 수량과 사유가 필수다. 0 이하 또는 현재 재고 초과, 빈 사유는 최초 렌더부터 CTA를
  비활성화하고 숨은 live 오류 사유와 `aria-invalid`를 제공한다.
- 확인/실패: 입고 확인은 중앙 ConfirmDialog에서 `08/30  식자재쇼핑몰`과
  `입고 1kg (1kg × 1개)`를 회색 요약 카드에 표시한다. 정상 입고는 상세로 이동한다. 입고 실패는
  별도 ErrorDialog 사례이며 확인으로만 닫힌다.
- Codex 검수: 미선택/저장 링크/직접 입력, 수량 stepper, 차감 812g 초과, 폐기 50g 손실 1,400원,
  확인·성공·실패, 구매 링크 추가와 복귀를 모바일에서 실제 조작했다.
- Opus 1차: 탭 semantics, 차감·폐기 초기 CTA guard와 오류 이유, 정상 입고 성공 경로를 지적했다.
- Opus 2차: 화면과 6개 상태/팝업 모두 `PASS`; 1차 지적 해소와 신규 회귀 없음.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-05a · `screen:memo_edit`, `popup=recipe_memo` 병합 메모 편집

- 병합안: 식재료와 레시피가 `memoEditorMarkup`·`bindMemoEditor` 한 요소를 공유한다. 화면별로는
  저장값과 완료 후 복귀 경로만 분리하며 입력칸·글자수·하단 행동·검증 규칙은 같다.
- 입력 상태: 입력 중 draft는 확정값을 바꾸지 않는다. 취소하면 입력을 버리고, 완료했을 때만 해당
  상세의 메모에 반영한다. 줄바꿈을 보존하고 빈 값은 상세 화면별 빈 상태 문구로 표시한다.
- 접근성: 입력칸은 최대 글자수 고정 안내만 `aria-describedby`로 참조한다. 시각적 글자수는 실시간
  갱신하되 `aria-live=off`로 두어 타이핑마다 중복 낭독되지 않는다. 식재료·레시피의 안내 ID도
  scope별로 분리한다.
- Codex 검수: 모바일에서 입력·취소·저장·재진입·100자 카운터를, PC에서 줄바꿈 저장과 상세 반영을
  실제 조작했다. 레시피 팝업 취소 시 popup 상태와 URL이 함께 정리되는 것도 확인했다.
- Opus 1차: 저장 전 확정값 변경, recipe 취소 URL, recipe 상세 반영, counter와 전역 버튼 조회를
  지적했다. 수정 후 2차에서 counter 중복 낭독만 `CONDITIONAL`, 최종 보완 재검수에서 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-06 · `screen:options`와 구매 링크 9개 상태

- 병합안: 목록·추가·수정은 `renderOptions`에서, 폼 하단 단가·행동은 `renderOptionBottomAction`에서
  공유한다. `hydrateOptionDraft`가 신규/수정 초깃값을 한 경로로 만들고 `bindOptionFormControls`가
  필드 검증·단가 계산·저장을 함께 담당한다.
- 목록: 왼쪽은 최저/최고 배지·구매처·금액, 오른쪽은 용량·단가다. 화살표나 편집 아이콘은 두지
  않고 카드 전체를 누르면 작업 시트가 열린다. 접근성 이름도 화면에 보이는 정보 순서와 일치한다.
- 추가/수정: 링크 이름·구매처·용량·금액·구매 링크는 모두 필수다. 구매처가 없을 때 `＋ 추가`로
  새 구매처 입력을 열며 자동 포커스한다. 저장 구매처를 바꾸면 저장된 링크의 도메인만 입력하고
  사용자가 전체 상품 URL로 계속 수정할 수 있다. 같은 구매처 재선택은 작성 중인 URL을 보존한다.
- 계산/검증: kg·L은 g·ml로 환산해 구매 단가를 입력 즉시 갱신하며 live status로 알린다. 점이 있는
  유효한 웹 호스트만 링크로 인정하고 5개 필수값이 모두 유효할 때만 추가/저장이 활성화된다.
- 카드/더보기/삭제: 카드 시트는 구매처와 `상품명 · 금액 (단가)`를 보여주고 링크 열기·수정 2개
  버튼을 하단 고정한다. 무효 링크는 빈 href 대신 비활성 `구매 링크 없음`으로 표시한다. `•••`는
  헤더 우측 popover이며 초기 포커스·방향키·Escape·포커스 복귀를 지원한다. 삭제는 중앙
  ConfirmDialog에서 확인하며 실제 행 제거 후 최저/최고 배지를 다시 계산한다.
- Codex 검수: 모바일에서 신규 등록, 저장 구매처 선택, 도메인 자동 입력, 잘못된 URL 차단, 27.00원/g
  계산, 목록 반영, 카드→수정, popover Escape, 삭제 Escape 복귀, back URL 정리를 실제 조작했다.
  PC에서는 입력 폭·단위 2열·하단 단가/저장 고정·겹침을 확인했다.
- Opus 1차: URL 형식, 구매처 변경 URL 소실, 단가 live, popover 키보드/잔존, 삭제 미적용과 contract를
  지적했다. 보완 후 2차에서 card 무효 href와 delete Escape 범위만 `CONDITIONAL`, 최종 재검수에서
  두 항목 모두 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-07 · `screen:stock`와 필터·최근 기록 철회

- Expo 대조: 실제 Expo의 `조정`, 입고 `1개` 표기를 확정안에 맞춰 `차감`,
  `식자재쇼핑몰 · 1kg × 1개`로 바꿨다. 폐기 전용 페이지 대신 입고·판매 소진·차감·폐기를 한
  재고 내역에서 확인한다.
- 필터 병합: 기간·유형·정렬 모두 `immediatePickerMarkup`·`bindImmediatePicker`를 공유한다. 기간은
  최근 1/3/6개월·전체, 유형은 전체/입고/판매 소진/차감/폐기, 정렬은 최신순/오래된순이다. 폐기
  구분 필터는 노출하지 않는다. 필터 결과는 월별로 그룹하고 월별 건수를 표시한다.
- 빠른 철회 규칙: 전체 원본에서 입고·차감·폐기 유형별 최신 1건이고 최근 7일 미만이며 아직 철회되지
  않았을 때만 `⋮`를 노출한다. 화면 필터·정렬 순서가 달라도 event key로 같은 원장 행을 찾는다.
  최신을 철회한 뒤 과거 기록을 연쇄 철회 대상으로 승격하지 않는다는 사용자 확정 규칙을 적용했다.
- 더보기: 날짜와 구매처를 한 줄 검정 텍스트로, `입고 1kg (1kg × 1개)`를 연한 회색 중앙 요약
  카드로 표시한다. 제목은 `입고 내역`처럼 띄어 쓰고 닫기·철회를 하단 고정한다. 닫기·Escape·배경
  탭은 모두 열림 상태를 해제하고 원래 `⋮`로 포커스를 돌려준다.
- 철회: 중앙 ConfirmDialog에서 취소/Escape 시 더보기로 복귀한다. 확인은 기존 행을 삭제하지 않고
  반대 부호 철회 행을 추가한다. 현재 재고·유형 합계·폐기 조리 전/후·전체 합계·새 행 잔량을 함께
  갱신하며 음수 재고도 그대로 표시한다.
- 시드 정합: 현재 재고 812g을 기준으로 이벤트를 역산해 행별 잔량을 일관되게 맞췄다. 최신 1kg
  입고를 철회하면 −188g이 되며, 이는 음수 재고 허용 제품 규칙과 일치한다.
- Codex 검수: 실제 Expo와 텍스트를 대조하고 모바일에서 3개 필터 radiogroup, 유형별 `⋮` 3개,
  더보기 배치, 철회 중앙 알럿, 취소/Escape 복귀, 초기/복귀 포커스를 조작했다. PC에서도 회색 요약
  카드와 하단 행동, 중앙 알럿 위치를 확인했다.
- Opus 1차: 기간 미적용, 철회행 필터 비대칭, 딥링크 대상, 포커스, 월 헤더, 요약 재계산을 지적했다.
  보완 후 사용자 철회 규칙과 runtime 시드 잔량까지 포함한 최종 재검수에서 모두 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-09 · `screen:purchase`, `popup=purchase_period`

- 문구/정보: 기준단가의 `지출` 보조문구와 단가 차이 설명문을 삭제했다. 각 행은 입고일·구매처·
  총 입고량·포장 구성·총 금액·당시 단가만 표시한다.
- 최저/최고: 기간 최저와 최고가 같으면 최신 08/27 행에 `최저`·`최고`를 함께 표시한다. 같은 단가의
  과거 행에는 배지를 반복하지 않는다.
- 병합: 재고 내역과 `historyRows`·`historyControls`·`historyMonthSections`·`openHistoryFilter`를
  공유한다. 기간은 동일한 즉시 선택 PickerSheet/radiogroup을 사용하고 선택 후 URL과 목록을 함께
  갱신한다.
- 시맨틱: 이동 기능이 없는 구매 행은 더 이상 빈 button으로 렌더하지 않고 `div.row`를 사용한다.
  실제 상세 이동이 있는 행만 button/data-detail을 사용한다. 필터 버튼 접근성 이름에는 현재
  `최근 3개월` 값까지 포함한다.
- Codex 검수: 모바일에서 텍스트·배지·포장 구성·기간 radiogroup·URL 복귀와 비활성 행 시맨틱을
  확인했고 공용 토큰 기반 PC 배치도 확인했다.
- Opus 1차: 이동하지 않는 button 행과 필터 현재값 누락을 지적했다. 보완 후 화면·기간 팝업 모두
  `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-03b · `screen:ingredient_changes`, `popup=ingredient_change_detail`

- 문구/정보: 식재료 수정 내역에서는 `최근 7일 기준`과 별도 설명문, 재고·구매 이력 바로가기를
  노출하지 않는다. 요약은 총 2건·직접 수정 1건·자동 갱신 1건만 보여준다.
- 행별 상세: `입고 단가 반영`은 실입고량·결제금액 직접 수정과 기준 단가 자동 갱신을 함께
  표시한다. `식재료 등록`은 카테고리·기준 단위·안전재고 직접 수정만 표시하며 자동 갱신 영역은
  만들지 않는다. 알 수 없는 미래 유형은 등록 상세로 오인하지 않도록 별도 안전 분기를 둔다.
- 병합/상태: 목록은 공용 변경 이력 행을, 상세는 공용 비교 행과 InfoSheet 계약을 사용한다. 어느
  행을 눌러도 해당 행의 제목·날짜·변경값을 사용하며 URL의 `popup=ingredient_change_detail`과
  팝업 선택 상태를 함께 갱신한다.
- Codex 검수: 모바일에서 두 행을 각각 눌러 서로 다른 상세값과 자동 갱신 영역 유무를 확인했다.
  상단 7일 문구 제거 후 캐시를 우회해 다시 로드하고 DOM에서 잔존하지 않음을 확인했다.
- Opus 1차: 실제 사용 렌더러에 남은 `최근 7일 기준`과 미래 행의 등록 상세 오인을 지적했다.
  두 항목 보완 후 재검수에서 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-03d · `screen:ingredient_delete`

- Expo 대조: 실제 화면은 `Alert.alert`로 `고춧가루 삭제`와 “과거 입고·판매 기록은 남고 목록에서만
  사라져요.”를 표시하고, 취소/삭제를 분리한다. 실제 Expo는 읽기만 했으며 삭제는 실행하지 않았다.
- 중앙 확인창: 복사 프로토타입은 흐린 상세 배경 중앙에 alertdialog를 표시한다. 취소는 수정 메뉴,
  삭제 확정은 식재료 목록으로 이동한다. 실제 데이터 삭제나 Expo 변경은 발생하지 않는다.
- 병합 요소: `centralConfirmPreview`가 별도 버튼 마크업을 만들지 않고 기존 공용
  `prototypeConfirm`을 사용한다. 공용 확인 요소는 위험 여부·버튼 클래스·라벨·속성·목적지를 옵션으로
  받아 일반 확인과 위험 확인을 함께 수용한다.
- 접근성: 제목·설명 연결, 취소 초기 포커스, Escape→취소를 제공한다. 라우트형 확인 화면이므로 실제
  포커스 트랩 없이 `aria-modal`을 선언하지 않는다.
- Codex 검수: 수정 메뉴에서 진입해 취소 초기 포커스와 취소 클릭·Escape의 수정 메뉴 복귀를 실제
  조작했다. 삭제 확정 버튼은 연결 목적지만 코드로 확인하고 누르지 않았다.
- Opus 1차: SPA 진입 포커스, Escape, 거짓 modal 선언, 헬퍼 재사용성을 지적했다. 공용 확인 요소로
  병합하고 명시적 포커스·Escape를 보완한 뒤 재검수에서 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

## 전체 target 장부

아래 목록은 숨긴 폐기 전용 페이지를 제외한 활성 screen 61개와 popup/state host 123개다.

| target | domain | type | common | Codex | Opus | PC | mobile | final |
|---|---|---|---|---|---|---|---|---|
| screen:ingredient_main | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_add | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_detail | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_edit_menu | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_edit | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:stock | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:stock_change | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:memo_edit | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:purchase | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_changes | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:options | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
| screen:ingredient_delete | ingredient | Screen | COMMON | PASS | PASS | PASS | PASS | PASS |
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
| popup:edit_category@ingredient_edit | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:edit_unit@ingredient_edit | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_inbound@stock_change | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_deduct@stock_change | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_discard@stock_change | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_option@stock_change | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_confirm@stock_change | ingredient | ConfirmDialog | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_error@stock_change | ingredient | ErrorDialog | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_list@options | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_add@options | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_edit@options | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_vendor@options | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_vendor_new@options | ingredient | PageState | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_unit@options | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_card_menu@options | ingredient | ActionSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_more@options | ingredient | PopoverMenu | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:option_delete@options | ingredient | ConfirmDialog | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_period@stock | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_type@stock | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_order@stock | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_event_more@stock | ingredient | InfoSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_event_revert@stock | ingredient | ConfirmDialog | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:purchase_period@purchase | ingredient | PickerSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:ingredient_change_detail@ingredient_changes | ingredient | InfoSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:recipe_sort@recipe_main | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_status@recipe_main | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_target@recipe_main | recipe | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_memo@recipe_detail | recipe | FormSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
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
