# 전체 페이지 UI 가이드 적용본 검수 장부

- 적용본: `full-page-flow-prototype-ui-applied.html`
- 보존 원본: `full-page-flow-prototype.html`
- 작업 시작 원본 SHA-256: `9B538CE9ACD1D93AA75845EB1851391B8EB4C5732DF7094214E8AC5662428414`
- 검수 범위: 활성 화면 62개 + 활성 popup/state host 120개 = 182개 host 단위
- 고유 popup/state ID: 97개
- 숨김 유지: `discard_type`, `discard_period` 2개. 삭제하지 않고 활성 계약에서 제외한다.
- 실제 Expo 앱 수정: 없음
- 2026-09-01 순차 재구축 시작: 자동 공통 스타일로 판정했던 기존 `PASS`는 시각 완료 근거에서
  제외한다. 적용본을 보존 원본과 동일한 상태로 되돌렸고, `ING-01`부터 화면·연결 팝업을 순서대로
  실제 Expo와 대조해 다시 만든다. 아래의 과거 PASS 표는 변경 이력으로만 보존하며 최신 판정으로
  사용하지 않는다.
- 2026-09-01 재개방: 식재료 화면에서 공통 정보 위계·여백 오류가 확인되어, 기존 식재료 12개 화면과
  관련 popup/state 29개의 PASS를 모두 취소하고 전수 재검수한다. 아래 식재료 TODO가 최신 판정이다.
- 2026-09-01 공통 재개방: 기존 적용은 화면별 CSS 덮어쓰기에 머물러 동일 역할의 Card·Row·Field·
  Badge·Layer가 서로 다른 규격을 유지했다. 원본 보존을 제외한 공통 PASS와 모든 화면·popup PASS를
  취소한다. 단일 공통 컴포넌트 파일 연결과 전체 선택자 매핑, PC·모바일 재검증 뒤에만 다시 PASS한다.

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
| 토큰 | 색·텍스트·선·간격·라운드·그림자·높이·터치 크기 | PASS | PASS | PASS |
| 병합 요소 | Card, RowGroup, Field, Result, Badge, Control, Layer, StickyAction | PASS | PASS | PASS |
| 의미 분리 | Field↔Result, Card↔선택행, Page StickyAction↔LayerFooter 분리 | PASS | PASS | PASS |
| popup 계약 | 활성 고유 ID 97/97 명시 등록 | PASS | 등록 확인, 런타임 전수검수 필요 | COMMON |
| popup 유형 | PageState / Picker / Form / Info / Action / Confirm / Success / Error / Popover | PASS | 긍정 | COMMON |
| 닫기 정책 | Confirm·Error 바깥 닫기 차단 | 샘플 PASS | 나머지 미검증 | COMMON |
| 접근성 | Confirm `alertdialog`, 제목 연결, focus-visible | 샘플 PASS | trap·focus 복귀 미검증 | COMMON |
| 반응형 | PC + 390×844 샘플 렌더 | 샘플 PASS | 320px·큰 글꼴·키보드 필요 | COMMON |
| 선 위계 | 외곽선·내부선·강조선 소유권 분리 | 재고 내역 샘플 PASS | 샘플 PASS | COMMON |

### 공통 재구축 근거 · 2026-09-01

- 실제 단일 출처: `full-page-flow-prototype-ui-components.css`와
  `full-page-flow-prototype-ui-components.js`를 적용본에 연결했다. 화면별 클래스는 구조를 유지하고,
  동적 렌더마다 `data-ui` 공통 역할을 동기 적용한다.
- Codex 자동 검사: 활성 screen 62개 본문에서 공통 역할 0개 화면 0건. `Field+Choice`,
  `Card+Summary`, `Field+Multiline`, `Nested RowGroup+Card`, `Row+SummaryRow` 충돌은 모두 0건이다.
- Layer: 실제 클릭으로 중앙 판매 상태 확인창은 `layer dialog`, 구매 링크 더보기는 `popover`로
  분리했다. 중앙 확인창 계산 스타일은 전체 24px radius와 dialog shadow를 확인했다.
- Opus 1차는 주입 시점·Layer 변형·이중 Card·과잉 `!important`·다중행 Field를 지적했고 모두
  보완했다. 2차가 찾은 Row 구분선·SummaryRow·Nested Summary·prototype-sheet 문제까지 보완한 뒤
  최종 확인에서 해당 5개 항목 PASS를 받았다.
- 이 판정은 공통 기반만의 PASS다. 개별 screen·popup 표의 TODO는 페이지별 PC·모바일 검수가 끝날
  때까지 유지한다.

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
| 식재료 | 12 | 31 | 적용 | TODO | TODO | 재검수 | 재검수 | TODO |
| 레시피 | 14 | 26 | 적용 | 1차 PASS | 검수 대기 | 1차 PASS | 미검수 | 진행 중 |
| 발주 | 4 | 12 | 적용 | 1차 PASS | 검수 대기 | 1차 PASS | 미검수 | 진행 중 |
| 매출관리 | 15 | 22 | 적용 | 1차 PASS | 검수 대기 | 1차 PASS | 미검수 | 진행 중 |
| MY | 17 | 29 | 적용 | 1차 PASS | 검수 대기 | 1차 PASS | 미검수 | 진행 중 |

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

- 순차 재구축 1차(2026-09-01): 아래의 과거 PASS는 자동 공통 스타일 적용본에 대한 기록이므로
  현재 판정에서 제외했다. 보존 원본으로 초기화한 뒤 실제 Expo `/ingredients`와 다시 대조했다.
- 현재 구현: 실제 Expo의 13개 카테고리를 모두 노출하고 가로 스크롤 탭으로 통일했다. 확정안대로
  추천순은 제외하고 `재고 적은순 · 단가 높은순 · 이름순 · 최신순`만 제공한다. 선택한 정렬값에 따라
  표본 카드 순서가 실제로 변경되며 카테고리 선택 시 목록 필터와 빈 상태가 동작한다.
- 현재 카드 계약: 상태·이름·카테고리 / 재고·조건부 안전재고 / 기준단가·최근 입고의 3단 위계로
  구성했다. 기본 정렬에서 고춧가루가 먼저 나오도록 목록과 정렬 의미를 맞췄다.
- 현재 검수: PC 렌더에서 카드 폭 570px, 좌우 여백 15px, 16px radius, 이름 16/800,
  재고 17/800, 보조정보 13/600을 확인했다. 상세 카드와 식재료 추가 이동, 4개 정렬 선택,
  베이커리 빈 상태를 실제 클릭으로 확인했다. 520px 이하 전용 shell 규칙을 CSS 마지막 순서로
  재정의해 후행 규칙에 덮이던 모바일 폭 문제를 함께 수정했다.
- 현재 판정: `Codex PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

- 순차 재구축 1차(2026-09-01): 화면 버튼 클릭 시 URL을
  `screen=ingredient_main&popup=sort`로 동기화하고, 현재값 체크·선택 즉시 적용·닫기·화면 URL 복귀를
  실제 클릭으로 확인했다. 과거 정렬 문구의 띄어쓰기를 확정안과 동일하게 정리했다.
- 현재 판정: `Codex PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

- 문제점: 화면 직접 진입에서는 명시적 popup ID가 없어 dialog 제목 연결과 닫기 정책이 빠졌다.
- 수정안: `activePopup=sort`, URL, PickerSheet 계약, 제목 연결, 선택 즉시 적용·닫기를 한 흐름으로 묶었다.
- Codex 검수: 이름 있는 `dialog \"정렬 기준\"`, 최신순·재고 적은 순·단가 높은 순·이름순, 현재 선택
  check, 선택 즉시 닫기를 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-02 · `screen:ingredient_add`

- 순차 재구축 1차(2026-09-02): 아래 과거 PASS는 적용본 초기화로 무효다. 실제 Expo `/ingredients/add`
  화면과 다시 대조한 뒤, 입력칸 모양의 `span`을 실제 text/number input으로 전부 교체했다.
- 현재 구조: 기본 거래처·메모·입력칸 하단 중복 설명을 제거했다. 식재료명, 필수 카테고리, 개당 용량과
  단위, 구매 단가 결과, 선택 구매 가격, 필수 안전재고·최소 발주만 유지한다. 구매 링크 안내는 입력
  폭과 같은 50px notice로 두고 20px 정보 아이콘을 추가했다.
- 현재 동작: 이름·카테고리·용량·안전재고·최소 발주 필수값을 만족하기 전에는 하단 추가 버튼이
  비활성화된다. 대파/1kg/4,000원은 `4.00원/g`, g 선택 시 `4,000.00원/g`으로 환산하며 숫자는
  우측, 접미 단위는 우측 끝에 고정한다. 카테고리·단위 picker 왕복 뒤 draft가 유지된다.
- 현재 검수: 실제 입력, 12개 등록 카테고리 선택, kg/g/L/ml/개/모 단위 선택, 선택창 URL,
  단가 실시간 갱신, 20×20 정보 아이콘과 570×50 notice를 확인했다.
- 현재 판정: `Codex PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

- 순차 재구축 1차(2026-09-02): 중복 작은 설명을 모두 제거했다. 화면 버튼으로 열 때 각각
  `popup=add_category`, `popup=add_unit` URL을 기록하고, 현재 선택 체크·즉시 적용·닫기·draft 보존을
  같은 흐름으로 연결했다.
- 현재 판정: `Codex PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

- 문제점: 화면 내 선택 버튼으로 열 때 popup ID·URL·제목 연결이 빠졌다.
- 수정안: 두 PickerSheet가 직접 진입과 카탈로그 진입에서 같은 `activePopup`, URL, 제목, 즉시 선택
  계약을 사용하도록 묶었다.
- Codex 검수: 이름 있는 카테고리·단위 dialog, 등록 가능한 카테고리 12개, kg/g/L/ml/개/모, check,
  선택 즉시 닫기와 draft 보존을 확인했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-03 · `screen:ingredient_detail`

- 순차 재구축 1차(2026-09-02): 실제 Expo 상세는 비교 기준으로만 사용하고, 그동안 확정된 프로토타입
  결정을 다시 적용했다. 상단은 카테고리·이름·메모·조건부 최근 수정, 재고 요약, 구매 링크, 기준 단가와
  최근 입고, 재고 내역 순서로 재구성했다. 기본 거래처 badge와 별도 폐기 내역 섹션은 숨겼다.
- 현재 규칙: 구매 링크와 재고 내역은 3건까지만 노출하고 4건 이상일 때만 `전체보기`를 표시한다.
  최근 입고는 3건이므로 버튼을 표시하지 않는다. 모든 전체보기 문구에서 화살표를 제거했다.
- 현재 데이터 위계: 재고 `812g` 아래 기준 단가 `28.00원/g`, 우측 상태, 하단 안전재고·최소 발주·
  최근 입고 chip으로 정리했다. 동일 단가의 최저·최고는 최신 08/27 기록에만 함께 표시하고 나머지
  기록에는 반복 badge를 두지 않았다.
- 현재 검수: 구매 링크 전체보기→options, 재고 전체보기→stock, 빈 상태의 구매 링크 추가→
  `options&popup=option_add`를 실제 클릭으로 확인했다. 별도 폐기 내역이 DOM에 없고 구매 링크 빈 상태
  문구가 `등록된 구매링크가 없습니다.`로 노출되는 것을 확인했다.
- 현재 판정: `Codex PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

- 순차 재구축 1차(2026-09-02): 있음 상태는 4개 중 3개+전체보기, 없음 상태는 확정 빈 문구와
  `＋ 구매 링크 추가`를 노출한다. 두 상태의 URL 직접 진입과 이동 경로를 확인했다.
- 현재 판정: `Codex PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

#### 2026-09-02 순차 재제작 판정

- 이전 PASS를 무효화하고 목록 → 카드 메뉴 → 추가 → 구매처 선택 → 수정 → 더보기 → 삭제 확인 순서로
  다시 열었다.
- 발견한 실제 결함: 링크 이름·용량·금액이 입력칸 모양의 `span`이라 입력할 수 없었고 저장 행동도
  연결되지 않았다. 이 상태를 완료로 기록했던 이전 판정은 현재 판정에서 제외한다.
- 수정: 세 필드를 실제 입력 요소로 교체하고 구매처·URL을 포함한 필수 검증, kg/L 환산 단가 계산,
  입력값 유지, 신규 목록 반영, 수정값 재진입을 연결했다. 저장 구매처 선택 시 상품 경로를 버리고
  도메인만 URL 입력칸에 넣으며 사용자가 계속 수정할 수 있다.
- 시각: 목록은 좌측 배지·구매처·금액, 우측 용량·단가 순서를 유지한다. 카드 전체를 누르면 구매 링크
  열기/수정 2열 시트가 나오고, 수정 헤더의 더보기는 우측 메뉴, 삭제 확인은 중앙 ConfirmDialog다.
  기본 검정 포커스 테두리는 공통 파란 focus-visible 규칙으로 교체했다.
- 실제 동작 확인: `고춧가루 750g / 식자재쇼핑몰 / 750g / 22,500원 / https://example.com`을
  입력해 `30.00원/g` 계산, 추가 버튼 활성화, 목록 추가, 카드 메뉴, 수정 폼 재진입까지 확인했다.
- 현재 판정: `Codex PASS / PC 시각 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

#### 2026-09-02 순차 재제작 판정

- 식재료 파트는 사용자 지시에 따라 실제 Expo가 아닌 백업 프로토타입의 최종 확정안만 기준으로
  재검수했다.
- 요약 카드에서 `입고·판매 소진·차감·폐기` 라벨은 검정 계층으로 올리고 값만 파랑/빨강을 유지했다.
  카드 외곽선과 행 내부선은 각각 `line`/`line2` 한 면만 사용한다.
- 기간·유형·정렬은 각각 독립 버튼이지만 모두 같은 단일 선택 PickerSheet 규격을 사용한다. 유형은
  전체/입고/판매 소진/차감/폐기이며 폐기 구분 필터는 두지 않았다.
- 입고 행은 `식자재쇼핑몰 · 1kg × 1개`로 표시한다. 더보기는 `입고내역`, 날짜·구매처 한 줄,
  `입고 1kg (1kg × 1개)` 회색 정보 블록, 하단 고정 닫기/입고 철회로 확인했다.
- 발견한 실제 결함: 철회 최종 버튼이 팝업만 닫고 원장 예시·현재 재고·유형 합계를 바꾸지 않았다.
  반대 부호 철회 행을 추가하고 현재 재고/입고 합계를 갱신했으며, 같은 유형의 과거 기록을 새 철회
  대상으로 승격하지 않도록 했다. 1kg 입고 철회 후 `−188g`, 입고 `+3kg`, `입고 철회` 행과
  입고 더보기 0개를 실제 클릭으로 확인했다.
- 현재 판정: `Codex PASS / PC 시각 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

#### 2026-09-01 재검수 2 · 공통 선과 InfoSheet 재개방

- 문제점: 재고 요약 카드의 외곽선, 2×2 지표 셀 선, 목록 행 선이 모두 같은 강도로 보여 핵심 값보다
  구획이 먼저 보였다. `stock_event_more`도 개별 CSS가 하단 구분선과 여백을 소유해 공통 팝업 규격과
  다른 값이 계산됐다.
- 수정안: 공통 컴포넌트에 `line / line-subtle / line-strong` 3계층과 선 소유권을 추가했다. 카드만
  외곽선을 소유하고, 요약 셀과 목록 행은 `#F2F4F6` 내부선만 소유한다. 최근 기록 팝업은 공통
  `detail-block`과 `layer-footer` 역할로 편입해 외곽선 없는 회색 정보 블록과 2열 하단 고정 액션을 쓴다.
- Codex 중간 확인: 기존 `.row + .row` 위쪽 선과 공통 행 아래쪽 선이 겹치던 원인을 찾아, 행 구분선은
  앞 행의 아래쪽 한 면만 소유하도록 보완했다. PC 계산값에서 카드 외곽선 `#E5E8EB`, 헤더·셀·행
  내부선 `#F2F4F6`를 확인했다. 팝업 정보 블록은 border 0, radius 12px, 하단 버튼 44px·2열이다.
- 재검수: PC와 390×844에서 가로 넘침 0, 행 경계 중복 0, 콘솔 오류 0을 확인했다. 교차검수는
  날짜·구매처의 실제 계산값까지 재확인한 뒤 선 규칙과 `stock_event_more` 구현을 `PASS`로 판정했다.
  `stock_event_more`는 PASS이며, `screen:stock` 전체는 나머지 필터 상태 재검수 전까지 TODO를 유지한다.

### ING-09 · `screen:purchase`, `popup=purchase_period`

#### 2026-09-02 순차 재제작 판정

- 백업 확정안 기준으로 `· 112,000원 지출`과 단가 설명 문구가 노출되지 않는 것을 확인했다.
- 동일한 최저·최고 단가의 두 배지는 가장 최신 08/27 행에만 함께 표시하고 과거 동일 단가 행에는
  반복하지 않는다.
- 이동 목적지가 없는 목록 행이 버튼으로 남아 있던 의미 오류를 제거해 읽기 전용 행으로 병합했다.
  기간은 재고 내역과 같은 단일 선택 PickerSheet를 사용한다.
- 검수값: 목록 버튼 0개, 최저 배지 1개, 최고 배지 1개, 삭제 대상 보조문구 0개.
- 현재 판정: `Codex PASS / PC 시각 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

#### 2026-09-02 백업본 기준 순차 재검수

- 실제 적용본에 남아 있던 카드 밖 `식재료 / 고춧가루` 블록과 카드 안 `최근 7일 기준`을 제거했다.
  요약 카드 첫 줄은 `고춧가루 / 총 2건`, 둘째 줄은 `직접 수정 1건 / 자동 갱신 1건`으로 확정했다.
- 첫 기록이 `08/29`인데 월 제목이 `2026년 9월`이던 오류를 제거하고 첫 기록에서 월을 파생해
  `2026년 8월`로 표시한다. 두 행의 일시는 모두 `08/29 · 08:52` 형식과 동일한 스타일을 사용한다.
- 상세 팝업이 모든 행에 안전재고와 기준 단가를 똑같이 보여주던 오류를 수정했다. `입고 단가 반영`은
  실입고량·결제금액과 자동 갱신된 기준 단가를, `식재료 등록`은 카테고리·기준 단위·안전재고만
  표시한다. 상세 대상은 `식재료`가 아니라 `고춧가루`로 표시하고 하단 `닫기`를 추가했다.
- 현재 판정: `Codex PASS / PC 시각·상호작용 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

- 문구/정보: 별도 `식재료 / 고춧가루` 제목 블록과 `최근 7일 기준` 설명은 노출하지 않는다.
  요약 카드 첫 줄은 좌측 `고춧가루`, 우측 `총 2건`이며 다음 줄에서 같은 좌측선으로 직접 수정
  1건·자동 갱신 1건을 보여준다.
- 일시/타이포: 내역 Row 일시는 공용 `HistoryDateTime`의 `MM/DD · HH:mm`, 13/600, 회색,
  tabular numeral을 사용한다. 월 그룹은 실제 첫 행의 월에서 파생한 `2026년 8월`이며 14/700이다.
  카드·목록은 16px radius와 1px 경계만 사용하고 임의 그림자는 제거했다.
- 행별 상세: `입고 단가 반영`은 실입고량·결제금액 직접 수정과 기준 단가 자동 갱신을 함께
  표시한다. `식재료 등록`은 카테고리·기준 단위·안전재고 직접 수정만 표시하며 자동 갱신 영역은
  만들지 않는다. 알 수 없는 미래 유형은 등록 상세로 오인하지 않도록 별도 안전 분기를 둔다.
- 병합/상태: 목록은 공용 변경 이력 행을, 상세는 공용 비교 행과 InfoSheet 계약을 사용한다. 어느
  행을 눌러도 해당 행의 제목·날짜·변경값을 사용하며 URL의 `popup=ingredient_change_detail`과
  팝업 선택 상태를 함께 갱신한다. 상세 메타는 일시와 대상 `고춧가루`를 세로 구분선으로 나눈다.
- Codex 재검수: 기존 PASS를 폐기한 뒤 PC에서 본문·첫 행·상세 팝업을 다시 열어 카드 좌우 정렬,
  `총 2건`, 실제 월, 일시 두 행의 동일 위치·스타일, 비교값 계층을 확인했다.
- Opus 1차: 잘못된 9월 하드코딩, 상세 메타 구분, 설명 계층, 비토큰 간격을 지적했다. 보완 후
  Opus 2차에서 구조는 PASS했고 남은 숫자 고정폭과 비교 Row 타입을 추가 보완했다.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### ING-03d · `screen:ingredient_delete`

#### 2026-09-02 순차 재제작 판정

- 기존 확인창은 화면 폭을 거의 모두 사용해 공통 중앙 ConfirmDialog 규격과 달랐고, `삭제` 버튼에는
  아무 동작도 연결되어 있지 않았다.
- 폭을 최대 340px로 제한하고 제목·설명을 중앙 정렬했다. 제목은 `고춧가루를 삭제할까요?`, 설명은
  `과거 입고·판매 기록은 남고 식재료 목록에서만 사라져요.`로 정리했다.
- 취소는 수정 메뉴, 삭제는 식재료 메인으로 이동하는 것을 실제 클릭으로 확인했다.
- 현재 판정: `Codex PASS / PC 시각 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

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

## 레시피 페이지별 검수

### RCP-01 · `screen:recipe_main`, 정렬·판매 상태·목표 PickerSheet

#### 2026-09-02 백업본 기준 순차 재검수

- 백업본의 카드 정보 순서·색·간격과 7개 메뉴는 변경하지 않았다. 이전 검수 기록과 달리 실제 적용본의
  카테고리·검색·정렬·판매 상태·목표 필터가 목록에 연결되지 않은 문제를 확인하고 연결했다.
- 정렬은 `최신순 / 순이익률 낮은순 / 순이익률 높은순 / 판매량 많은순 / 판매가 높은순 /
  판매가 낮은순`이며 선택 즉시 목록과 버튼이 갱신된다. 판매 상태가 전체면 `판매 상태`, 목표가
  전체면 `목표 상태`로 복귀하고 목표 팝업 제목은 `목표`다.
- 검색은 메뉴명과 카테고리를 함께 찾고 카테고리와 조합된다. 조건이 겹쳐 결과가 없으면
  `조건에 맞는 레시피가 없습니다.`를 표시한다. 정렬·상태·목표 선택 후 팝업과 popup 주소가 함께
  정리되는 것을 실제 클릭으로 확인했다.
- 현재 판정: `Codex PASS / PC 시각·상호작용 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

- Expo 대조/확정안: 실제 Expo의 카드 정보 위계를 유지하고, 사용자 확정에 따라 정렬에 `최신순`을
  추가했다. 최신순은 최근 등록일 기준이다. 판매 상태가 전체면 버튼은 `판매 상태`, 목표가 전체면
  `목표 상태`로 표시하며 목표 팝업 제목은 `목표`다. 추가 버튼은 `＋레시피 추가`를 유지한다.
- 데이터/상태: 하드코딩 문자열 교체 방식 대신 구조화한 레시피 픽스처 한 벌을 사용한다. 카테고리,
  판매중/판매중지, 목표 미달/달성, 메뉴·카테고리 검색, 6개 정렬이 실제 카드 목록과 빈 상태를
  갱신한다. 판매중지와 목표 달성 카드의 배지·투명도·이익 색도 실제 Expo 규칙과 맞췄다.
- 병합 요소: 정렬·판매 상태·목표는 식재료 정렬과 같은 `immediatePickerMarkup`과
  `bindImmediatePicker`를 사용한다. 모두 제목 아래 작은 설명문 없이 radiogroup 한 벌로 렌더하고,
  선택 즉시 닫히며 popup URL을 제거한다.
- 헤더: 검색 버튼은 열림 상태를 알리고 입력창에 포커스를 둔다. 공백을 무시해 메뉴명·카테고리를
  검색하며 결과 없음 문구를 표시한다. 알림 버튼은 MY 알림 설정으로 이동한다.
- Codex 검수: 기본 7개 카드, 최신순 첫 카드, 전체 판매 상태 8개와 판매중지 배지, 목표 달성 1개,
  밥·면 카테고리, 공백 포함 검색, 검색 빈 상태, 세 PickerSheet와 URL 정리를 실제 조작했다.
- Opus 1차: 메인 검색의 이중 핸들러, 사용되지 않는 팝업 정의, 상세 판매 상태와 메인 필터 변수의
  불명확한 명칭을 지적했다. 전용 검색 소유권·중복 제거·`recipeDetailSelling` 분리 후 재검수 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### RCP-02 · `screen:recipe_detail`, 판매 상태 ConfirmDialog

#### 2026-09-02 백업본 기준 순차 재검수

- 백업본의 요약 → 판매가 구성 → 재료 → 부자재 → 고정 지출 → 세금 → 판매 손익 → 손익 변동
  순서는 그대로 유지했다. 요청과 달리 남아 있던 헤더 `✎ 수정`을 제거하고 최근 30일 판매 단위를
  `438개`에서 `438인분`으로 통일했다.
- 화살표만 있고 작동하지 않던 4개 재료 행을 실제 버튼으로 바꿨다. 재료 행 → 식재료 상세 → 뒤로
  이동 시 레시피 상세로 돌아오는 문맥 경로를 실제 클릭으로 확인했다.
- 메모 수정은 입력값·100자 카운트·완료 저장을 연결했다. `판매중`과 `판매중지`는 모두 중앙 확인창을
  거치며 각각 `판매를 중지하시겠습니까?`, `판매중으로 상태를 변경하시겠습니까?`를 표시한다.
- 고정 지출과 판매 손익의 `10인분 / 1인분` 탭이 설명 속 인분 수와 판매량 기준을 함께 갱신하는 것을
  확인했다. 중복 `기준` 문구는 탭에 표시하지 않는다.
- 현재 판정: `Codex PASS / PC 시각·상호작용 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

- Expo 대조/확정안: 목표 상태를 메뉴명 위에 두고 메뉴명 우측에는 판매 상태 버튼만 둔다. 헤더의
  중복 편집 버튼은 제거했으며, `10인분·1인분` 탭은 사용자 확정 문구대로 `기준`을 생략한다.
- 정보 위계: 요약 → 판매가 구성 → 재료 → 부자재 → 고정 지출 → 세금 → 판매 손익 → 손익 변동을
  유지한다. 부자재 보조문구는 `해당 메뉴 전용 비용`, 고정 지출은 `(인분당 환산)`, 손익 제목은
  `판매 손익`으로 통일했다. 7일 안의 수정 기록이 있을 때만 최근 수정 바로가기를 표시한다.
- 상호작용: 재료 행은 식재료 상세로 이동하며 뒤로 가면 레시피 상세로 복귀한다. 메모는 공용
  `FormSheet`, 판매중·판매중지는 중앙 `ConfirmDialog`로 처리하고 취소 초기 포커스·Escape·호출 버튼
  포커스 복귀를 공통 계약으로 적용한다.
- 병합 요소: 모든 인분 탭은 `recipeDetailTabs`, 값 행은 링크 유무를 판별하는 `expoRows`, 판매 상태
  전환은 공용 `prototypeConfirm`과 레이어 닫기 계약을 사용한다. 의미 없는 화살표는 렌더하지 않는다.
- Codex 검수: 판매 중지·판매 재개 확인 문구, 아니오·Escape 취소, 상태 전환 후 포커스 복귀, 재료
  상세 왕복, 인분 탭에 따른 고정비 설명·판매량 기준 갱신을 PC 화면에서 실제 조작했다.
- Opus 1차: 재료 행의 비활성 화살표, 잘못된 복귀 경로, 헤더 편집 중복을 지적했다. 링크 행·문맥 복귀·
  헤더 액션 제거 후 재검수 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### RCP-02c · `screen:recipe_price_sim`

#### 2026-09-02 백업본 기준 순차 재검수

- 판매가만 입력칸으로 두고 판매량·세금·재료 원가·고정 지출·부자재·순이익·권장 판매가를 같은
  손익 Row 규격으로 유지했다. 판매가 행의 `100%`는 표시하지 않는다.
- 초기 12,000원에서 관찰자 계산이 확정 표기 `세금 9.0% / 재료 원가 23.3% / 순이익 33.7%`를
  각각 9.1%·23.4%로 다시 덮어쓰던 오류를 수정했다. 15,000원 입력 시 세금 1,364원, 고정 지출
  4,695원, 순이익 5,835원·38.9%로 갱신되는 것을 확인했다.
- `10인분 / 1인분` 탭은 중복 `기준`을 사용하지 않고 판매량 단위를 `개`가 아닌 `인분`으로 바꾼다.
- 현재 판정: `Codex PASS / PC 시각·상호작용 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

### RCP-03 · `screen:recipe_add`, 카테고리·도움말·재료/부자재 사용량

#### 2026-09-02 백업본 기준 순차 재검수

- 입력칸처럼 보이기만 하던 메뉴명·판매가·기준 인분·목표 순이익률을 실제 입력 필드로 교체했다.
  카테고리는 필수 선택이며 `지정 안 함`이나 카테고리 관리 진입을 두지 않는다. 필수값이 모두
  유효할 때만 하단 `레시피 추가`가 활성화된다.
- `메모`, `월 평균 판매량`, `한 번에 만드는 양`과 입력칸 아래 설명문은 두지 않았다. 인분 탭은
  `10인분 / 1인분`, 부자재 보조문구는 `해당 메뉴 전용 비용`으로 통일했다.
- 재료와 부자재 추가는 각각 검색 → 사용량 입력 → 담기 흐름을 사용한다. 최초 팝업은
  `취소 / 담기`, 추가 후 수정 팝업은 우측 상단 닫기와 `삭제 / 저장`이며 입력 영역은
  `10인분 개수 / 10인분 비용 / 1인분 비용` 세 개다.
- 수량 입력 후 비용은 계산되지만 카드에는 고정 fixture가 다시 나타나던 오류를 수정했다. 돼지고기
  250g은 3,250원, 뚝배기 가스비 3회는 360원으로 추가 화면에 유지되는 것을 확인했다.
- 현재 판정: `Codex PASS / PC 시각·상호작용 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

### RCP-03b · `screen:recipe_edit`, 카테고리·재료/부자재 사용량

#### 2026-09-02 백업본 기준 순차 재검수

- 수정 화면의 메뉴명·판매가·기준 인분·목표 순이익률도 추가 화면과 같은 실제 입력 규격으로
  교체했다. 카테고리 선택 후 기존 입력값을 유지하며 필수값이 무효하면 저장을 비활성화한다.
- `10인분 기준 / 1인분 기준`은 `10인분 / 1인분`으로, 부자재 설명은 `해당 메뉴 전용 비용`으로
  통일했다. 메모와 월 평균 판매량 입력은 수정 화면에도 두지 않는다.
- 기존 재료 사용량 수정은 닫기·삭제·저장을 모두 작동시킨다. 돼지고기 앞다리 200g을 250g으로
  바꾸면 3,250원으로 재계산되며 삭제하면 실제 목록 개수가 줄어든다.
- 수정 화면의 `＋ 재료 추가`, `＋ 부자재 추가`는 검색·사용량 입력 후 추가 화면으로 잘못 돌아가던
  경로를 수정했다. 계란 2개와 뚝배기 가스비 2회를 담은 뒤 다시 수정 화면으로 복귀하고 목록 수가
  늘어나는 것을 확인했다.
- 현재 판정: `Codex PASS / PC 시각·상호작용 PASS / 모바일 실기기 확인 대기 / 최종 TODO`.

### MY-05 · 고정 지출 초기 평균·1개월 실제·수정

- 기준: `all-detail-history-screens.html`의 `고정 지출 · 초기 평균`과 `고정 지출 · 1개월 실제`을
  보존된 상세·내역 기준 화면으로 삼았다. 현재 Expo는 읽기 전용으로 조회·수정 기능 범위만 대조했다.
- 정보 위계: 조회 화면은 `전체 매출·고정 지출/고정지출율` 요약 카드와 `고정 지출 항목` 카드 두
  장으로 병합했다. 초기 평균은 `최근 3개월 평균`, 1개월 실제와 MY 조회는 월 선택만 다르게 표시한다.
- 데이터/상태: 2026년 8·7·6월의 매출·합계·비율·항목을 한 `fixedActuals`에서 조회와 수정이 함께
  사용한다. 월 선택 즉시 카드가 갱신되고 `고정지출 입력`은 선택한 월을 유지한 채 MY 수정으로 간다.
- 역할 분리: 레시피에서는 초기 평균과 1개월 실제를 읽고, MY에서는 같은 실제 월을 조회한 뒤 별도
  편집 폼으로 진입한다. recipe/MY 카탈로그의 MY-05·MY-05b 중복 표시는 동일 실제 라우트의 의도적
  진입 별칭이며 prototype URL은 고유 screen key로 구분한다.
- 병합 요소: 네 화면은 `renderFixed`, `fixedItemsCard`, `fixedActuals`를 공유하고 월 선택은 공용
  `immediatePickerMarkup`·`bindImmediatePicker`를 사용한다. 평균 화면에는 의미 없는 월 Picker를
  노출하지 않는다.
- Codex 검수: 기준 화면의 모든 문구·값·순서를 비교했고, 8월→7월 변경, URL popup 정리, 월 버튼
  포커스 복귀, 선택 월 수정 폼의 제목·매출·항목·합계를 실제 조작했다. PC와 모바일 주소도 확인했다.
- Opus 1차: 수정 폼의 월별 값 불일치, 선택 후 포커스 유실, 기준 화면의 condition 래퍼 누락을
  지적했다. 월별 단일 데이터 사용·명시적 포커스 복귀·래퍼 복원 후 2차 재검수 `PASS`.
- Codex 판정: `PASS`; Opus 판정: `PASS`; 최종 판정: `PASS`.

### 2026-09-01 · 레시피→발주→매출관리 연속 작업 체크포인트

- 실제 Expo 소스와 보존 원본은 수정하지 않았다. 적용본·공용 CSS/JS·이 장부만 변경했다.
- 레시피 추가·수정은 같은 `normalizeRecipeFormMarkup`과 `recipeFormDrafts`를 사용한다. 메뉴명·판매가·
  기준 인분·목표 순이익률은 실제 입력 필드이며, 카테고리 선택 즉시 폼으로 복귀한다. 필수값이
  충족될 때만 하단 행동이 활성화되고 상세로 이동한다.
- 레시피 상세 헤더의 수정 진입을 복구했다. 목록 카드가 선택 메뉴명을 보존하고 상세의 메뉴명·판매가·
  목표율·재료비·순이익 fixture를 같은 메뉴 기준으로 교체한다.
- 판매가 시뮬레이션은 입력 판매가에 맞춰 세금·재료비율·고정지출·순이익·목표 달성 상태·권장 판매가를
  함께 갱신한다. `10인분/1인분` 선택은 class와 `aria-selected`를 같이 바꾼다.
- FormSheet footer는 취소:주요 행동 `1:2`, Confirm은 `1:1`, 단일 확인은 `1열`로 분리했다. 레이어는
  `aria-modal`과 첫 조작 요소 포커스를 적용한다.
- 전체폭 행동을 IconButton으로 오분류하던 `.channel-more`, `.stock-check-more`를 공통 아이콘 선택자에서
  제외했다. 부모가 gutter를 소유하는 매출 목록은 Row의 좌우 padding 중복을 제거했다.
- 발주 직접 발주는 식재료 미선택 시 저장 불가, 선택 후 구매처·수량·도착 예정 폼과 주문 FormSheet가
  연결된다. 주문 상세·입고 상세의 하단 행동도 대응 popup host로 연결했다.
- 매출관리 메인의 영업 상태·정렬·기타 매출·지출·메뉴별 판매 버튼을 실제 popup host에 연결했다.
  판매 수량 팝업은 클릭한 메뉴명을 유지한다.
- Codex PC 자동 검사: 레시피 14화면과 발주·매출관리 19화면에서 본문 가로 넘침 0, 이름 없는 버튼 0.
  레시피 추가 입력→카테고리→활성화→상세, 상세→수정, 판매가 목표 전환, 발주 직접 선택→등록 팝업,
  매출 메뉴별 판매 팝업을 실제 조작했다.
- 아직 최종 PASS가 아니다. 레시피 CRUD 상태 반영·dirty guard·고정 지출 복귀 문맥, 발주·매출의 각
  popup 저장 상태, 모바일 390×844 전수 검사와 Fable/Opus 재검수는 남아 있다.

## 전체 target 장부

아래 목록은 숨긴 폐기 전용 페이지를 제외한 활성 screen 62개와 popup/state host 120개다.

| target | domain | type | common | Codex | Opus | PC | mobile | final |
|---|---|---|---|---|---|---|---|---|
| screen:ingredient_main | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_add | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_detail | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_edit_menu | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_edit | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:stock | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:stock_change | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:memo_edit | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:purchase | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_changes | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:options | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:ingredient_delete | ingredient | Screen | COMMON | TODO | TODO | TODO | TODO | TODO |
| screen:recipe_main | recipe | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:recipe_detail | recipe | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:recipe_price_sim | recipe | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:recipe_add | recipe | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:recipe_edit | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:recipe_ingredient_search | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:recipe_material_search | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:recipe_materials | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:recipe_category | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:recipe_material_category | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:recipe_changes | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:profit | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:fixed_average | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:fixed_actual | recipe | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:order_main | order | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:order_detail | order | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:order_receive | order | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:order_direct | order | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:sales_main | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:analytics | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| screen:day | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:day_full | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:revenue | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:menu | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:channel | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:material | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:extra | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:waste | sales | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:sales_fixed | sales | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:expense | sales | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:tax | sales | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:stock_check | sales | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:sales_past | sales | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_main | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_fixed | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_fixed_edit | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_settings | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_ingredient_categories | my | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:my_recipe_categories | my | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:my_material_categories | my | Screen | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| screen:my_materials | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_tax | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_country | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_language | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_units | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_vendors | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_channels | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_hours | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_notifications | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| screen:my_account | my | Screen | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:sort@ingredient_main | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:ingredient_option_filled@ingredient_detail | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:ingredient_option_empty@ingredient_detail | ingredient | PageState | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:add_category@ingredient_add | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:add_unit@ingredient_add | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
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
| popup:stock_event_more@stock | ingredient | InfoSheet | COMMON | PASS | PASS | PASS | PASS | PASS |
| popup:stock_event_revert@stock | ingredient | ConfirmDialog | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:purchase_period@purchase | ingredient | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:ingredient_change_detail@ingredient_changes | ingredient | InfoSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:recipe_sort@recipe_main | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:recipe_status@recipe_main | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:recipe_target@recipe_main | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:recipe_memo@recipe_detail | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:recipe_stop@recipe_detail | recipe | ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:recipe_category_pick@recipe_add | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:recipe_category_pick@recipe_edit | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:recipe_ingredient_usage@recipe_edit | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:recipe_ingredient_usage@recipe_ingredient_search | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:recipe_material_usage@recipe_material_search | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:material_add@recipe_materials | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:material_edit@recipe_materials | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:material_category_pick@recipe_materials | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:material_delete@recipe_materials | recipe | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:category_add@recipe_category | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:category_edit@recipe_category | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:category_delete@recipe_category | recipe | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:category_add@recipe_material_category | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:category_edit@recipe_material_category | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:category_delete@recipe_material_category | recipe | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:recipe_change_detail@recipe_changes | recipe | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:profit_detail@profit | recipe | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:fixed_period@fixed_average | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:fixed_period@fixed_actual | recipe | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:fixed_channel@fixed_actual | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:fixed_item_add@fixed_actual | recipe | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_candidates@order_main | order | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_waiting@order_main | order | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_received@order_main | order | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_order@order_main | order | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_receive@order_main | order | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_cancel@order_main | order | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_revert@order_main | order | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_price_spike@order_main | order | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_order@order_detail | order | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_receive@order_receive | order | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_ingredient@order_direct | order | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:order_vendor@order_direct | order | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_state@sales_main | sales | ActionSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_break@sales_main | sales | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_close@sales_main | sales | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_sort@sales_main | sales | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_qty@sales_main | sales | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_shortage@sales_main | sales | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_etc@sales_main | sales | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_expense@sales_main | sales | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_period@analytics | sales | PickerSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_direct_period@analytics | sales | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | CODEX_PASS |
| popup:sales_menu_profit@day | sales | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:sales_revenue_all@revenue | sales | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:sales_material_detail@material | sales | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:sales_extra_detail@extra | sales | InfoSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:sales_fixed_expand@sales_fixed | sales | InfoSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:expense_add@expense | sales | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:expense_delete@expense | sales | ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:past_sale_qty@sales_past | sales | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:past_etc@sales_past | sales | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:past_expense@sales_past | sales | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:past_save@sales_past | sales | ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:stock_check_all@stock_check | sales | InfoSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:fixed_period@my_fixed | my | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:fixed_channel@my_fixed_edit | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:fixed_item_add@my_fixed_edit | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:category_add@my_ingredient_categories | my | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_edit@my_ingredient_categories | my | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_delete@my_ingredient_categories | my | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_add@my_recipe_categories | my | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_edit@my_recipe_categories | my | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_delete@my_recipe_categories | my | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_add@my_material_categories | my | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_edit@my_material_categories | my | FormSheet | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:category_delete@my_material_categories | my | ConfirmDialog | COMMON | PASS | REVIEW | PASS | PASS | COMPLETE |
| popup:material_add@my_materials | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:material_edit@my_materials | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:material_category_pick@my_materials | my | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:material_delete@my_materials | my | ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:tax_item_add@my_tax | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:tax_saved@my_tax | my | SuccessDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:vendor_add@my_vendors | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:vendor_edit@my_vendors | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:vendor_delete@my_vendors | my | ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:channel_edit@my_channels | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:channel_disable@my_channels | my | ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:hours_start@my_hours | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:hours_end@my_hours | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:hours_break_start@my_hours | my | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:hours_break_end@my_hours | my | PickerSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:hours_timezone@my_hours | my | FormSheet | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |
| popup:account_delete@my_account | my | FormSheet→ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |

## 2026-09-01 · MY 1차 전수 검수 체크포인트

- 실제 Expo의 `/my`, `/my/country`, `/my/language`를 기준으로 `국가 · 통화(MY-12)`와
  `앱 언어(MY-08)`를 독립 화면으로 분리했다. 세금 화면에서는 중복 국가 선택을 제거했다.
- MY 메인은 고정 지출, 세금, 국가·통화, 카테고리, 앱 언어, 단위, 구매처, 판매 채널,
  영업시간, 알림, 계정의 11개 진입점을 갖는다.
- 17개 화면 자동 검사에서 본문 가로 넘침과 이름 없는 주요 버튼은 0건이다. 29개 팝업 host는
  모두 URL 직접 진입 시 열림, 제목, 공통 Layer 계약, PC 폭을 확인했다.
- 터치 규격 재검수로 월 선택, 삭제 아이콘, 검색 입력, 세금 선택·추가 버튼을 최소 44px로 맞췄다.
- 알림 화면의 중복 `08:00`과 개발 상태 문구를 제거하고 4개 토글을 실제 선택 가능한 버튼으로 바꿨다.
- 모바일 실기기와 Opus 교차 검수 전이므로 최종 PASS가 아니라 `IN_PROGRESS`로 유지한다.

## 2026-09-01 · 비식재료 1차 공통 회귀 체크포인트

- 활성 화면 62개를 다시 열어 본문 가로 넘침, 터치 크기, 접근성 이름을 검사했다. 레시피의
  카테고리·기준 탭, 필터, 판매 상태, 헤더 행동과 매출관리의 정렬·더보기까지 44px 계약을 맞췄다.
- 레시피 26개, 발주 12개, 매출관리 22개, MY 29개 등 비식재료 popup host 89개는 URL 직접 진입에서
  모두 열림·제목·공통 Layer 계약을 확인했다.
- 부자재·구매처 관리의 연필·삭제 아이콘에는 행 이름을 포함한 접근성 이름을 추가했다. 새 브라우저
  탭에서 공통 컴포넌트 경고 0건을 재확인했다.
- PC 1차는 PASS지만 모바일 실제 폭과 Opus 독립 검수는 대기 상태라 최종 판정은 유지한다.

## 2026-09-01 · 나머지 도메인 2차 시각·공통 회귀 체크포인트

- 레시피 14, 발주 4, 매출관리 15, MY 17 등 비식재료 50개 화면을 다시 직접 열어 카드 외곽선,
  내부 구분선, 제목 계층, 입력 필드, 필터, 하단 행동, 이름 없는 컨트롤과 가로 넘침을 확인했다.
- 브라우저 기본 버튼 스타일이 새어 나오던 레시피·MY 부자재 관리, MY 구매처 관리의 본문 버튼과
  영업시간 선택 행을 공통 Row/Action 규격으로 되돌렸다. 버튼 본문에 보이던 두꺼운 검은 테두리와
  회색 기본 배경을 제거했다.
- 직접 발주의 식재료 미선택 화면은 선택 필드를 본문 전체 폭으로 맞추고, 빈 상태 문구와 비활성
  하단 행동의 간격을 공통 Field/EmptyState 규칙에 맞췄다.
- 카탈로그 화면 수는 숨긴 폐기 전용 화면을 제외한 활성 화면 합계와 동일하게 `62개`로 표시한다.
- 비식재료 popup host 89개를 URL로 다시 열어 레이어 열림, 제목, 기본 스타일 누수, 44px 미만
  컨트롤을 검사했으며 이번 패스의 발견 건수는 0이다.
- 비식재료 50개 화면의 가로 넘침, 브라우저 기본 버튼 스타일 누수, 44px 미만 주요 컨트롤도 0건이다.
  모바일 실기기 좁은 폭과 Opus 독립 검수 전이므로 최종 판정은 계속 `IN_PROGRESS`로 유지한다.

## 2026-09-02 · 공통 리스트 세로 리듬 재개방 및 보완

- 공통 Row 규격을 다시 열어 3줄 기록형, 2줄 관리형, 1줄 단순형의 세 단계로 병합했다.
  화면별 임의 숫자를 추가하지 않고 `--list-row-pad-y`, `--list-row-min-tall`,
  `--list-row-min-normal`, `--list-row-min-compact`를 단일 기준으로 사용한다.
- 3줄 기록형은 `92px` 이상과 상·하 `16px`, 2줄 관리형은 `76px` 이상과 상·하 `14px`,
  1줄 단순형은 `60px` 이상과 상·하 `12px`를 적용했다. 모든 연속 목록의 내부 구분선은
  `1px / var(--line2)`로 통일했다.
- 적용 대상은 재고·수정 내역, 구매 링크, 설정, 관리 목록, 카테고리, 매출 목록 등 본문 Row다.
  계산 요약표·입력 필드·선택 컨트롤은 목록과 역할이 달라 이번 공통 규격에서 제외했다.
- PC에서 `stock`, `ingredient_changes`, `options`를 직접 열어 날짜·제목·보조 정보의 상하 여백과
  구분선 위치를 확인했다. LAN 모바일 주소의 `stock`도 정상 응답을 확인했다.
- 이번 판정은 공통 Row 보완의 `CODEX PASS`다. 전체 화면의 개별 판정과 Opus 독립 검수는 기존처럼
  완료 전까지 `IN_PROGRESS`를 유지한다.

## 2026-09-02 · 수정 상세 값 비교 영역 보완

- 변경 전 값이 존재하지 않을 때 쓰던 `—`는 음수 또는 구분선으로 오해될 수 있어 `없음`으로
  명시했다. 식재료 등록과 기타 최초 변경 상태에도 같은 문구 규칙을 적용했다.
- `실입고량`, `결제금액`, `기준 단가`를 포함한 수정 상세 비교 행은 각각 `1px` 외곽선과
  `12px` 라운드를 가진 독립 박스로 분리했다. 항목 간 간격은 `8px`, 최소 높이는 `56px`다.
- 같은 비교 컴포넌트를 사용하는 레시피 수정 상세에도 동일한 영역 구분 규칙이 적용된다.
- `ingredient_changes?popup=ingredient_change_detail`을 PC에서 직접 열어 `없음 → 값` 표기,
  세 항목의 박스 경계, 제목 위계와 스크롤을 확인했다.

## 2026-09-02 · 날짜·시간 글로벌 표시 규칙 보완

- 기존 `MM/DD · HH:mm`은 월·일 순서와 날짜·시각의 의미가 국가별로 달라질 수 있어 폐기했다.
- 글로벌 중립 프로토타입은 `YYYY-MM-DD · HH:mm`을 공통 fallback 형식으로 사용한다. 이번 화면은
  `2026-08-29 · 08:52`로 표시한다.
- 공통 `displayDateTime`을 목록 Row와 수정 상세 팝업에 연결하고, 레시피 손익 변동 상세의 정적
  날짜·시간도 같은 순서로 맞췄다.
- 실제 제품 규칙은 서버 시각·매장 시간대를 권위로 두고, 언어·지역별 locale formatter로 표시한다.
  formatter 실패 시에만 프로토타입과 같은 중립 형식으로 되돌린다.
- 식재료 수정 내역 목록과 `ingredient_change_detail`을 직접 열어 두 위치 모두 동일한 표기임을 확인했다.
- 수정 상세는 대상 식재료가 이미 이전 화면에서 확정되므로 날짜·시간 뒤의 `· 고춧가루`를 제거했다.
  메타 정보는 `2026-08-29 · 08:52` 한 항목만 남겨 다른 정보와 섞여 읽히지 않게 했다.

## 2026-09-02 · 최근 재고 기록 팝업 정보 위계 보완

- `날짜 + 구매처`는 맥락 정보로 분류해 같은 줄의 `T.sub` 진한 회색으로 통일했다.
- `입고 1kg (1kg × 1개)`는 핵심 확인 정보로 분류해 괄호 안 포장 구성까지 `T.ink` 검정을
  유지했다. 한 문장 안에서 일부만 회색으로 빠지던 예외 규칙은 제거했다.
- `stock?popup=stock_event_more`를 직접 열어 첫 줄과 둘째 줄의 색 위계, 가운데 정렬,
  연한 회색 정보 블록과 하단 고정 행동을 확인했다.

## 2026-09-02 · 재고 수정 계산 결과 필드 너비 보완

- 값 길이에 맞춰 작은 pill처럼 줄어들던 `총 입고량`과 `입고 후 기준단가`를 전체 너비 ResultField로
  교정했다. 두 결과 모두 인접 입력칸과 같은 열 너비·50px 높이·11px 반경을 사용한다.
- 라벨은 필드 밖에 두고 결과값은 필드 내부 end 정렬로 통일했다. 동적 변환 뒤 생성되는
  `stock-result-field`와 `stock-result-value-card`에도 명시적으로 `width:100%`를 적용했다.
- 구매 링크 선택까지 실제로 진행한 뒤 `1kg`, `28.00원/g`, 결제금액, 입고일의 좌우 시작선과
  끝선이 일치하는지 화면에서 확인했다.

## 2026-09-02 · 입고 확인 대상 요약 보완

- `고춧가루 · 2kg`처럼 이름과 처리량을 한 문장으로 나열하던 확인창을 중립 요약 박스로 교체했다.
- 왼쪽은 `식재료 / 고춧가루`, 오른쪽은 `입고량 / 계산값`의 라벨+값 2열 구조다. 식재료명은 start,
  수량은 end 정렬하고 두 값 모두 핵심 검정 계층을 사용한다.
- 저장된 구매 링크 선택 후 입고 버튼을 직접 눌러 중앙 ConfirmDialog, 요약 박스, 1:1 행동 버튼과
  배경 화면의 관계를 확인했다.

## 2026-09-02 · 공통 하단 2버튼 규격 통합

- 팝업과 페이지 하단에 행동이 두 개 있으면 화면·도메인·행동 중요도와 관계없이 항상 `1:1`로
  균등 분할한다. 두 버튼 모두 높이 `48px`, 반경 `12px`, 사이 간격 `8px`를 사용한다.
- `취소·닫기`는 연한 회색 채움과 검정 글씨, `완료·저장·확인·적용`은 Primary 파란 채움과 흰 글씨로
  통일했다. 화면 이동·추가·수정 같은 별도 메뉴 행동은 흰 배경에 파란 선·파란 글씨를 사용한다.
- 삭제·철회는 위험 행동이므로 연한 빨강 배경과 빨간 글씨를 유지하되 버튼 폭과 높이는 같은 규격을
  사용한다. 비활성 대표 행동은 기존 비활성 회색 상태를 유지한다.
- 공통 `LayerFooter` 정책과 메모·구매처 선택·확인 Dialog·구매 링크 카드·사용량 편집·삭제 확인의
  기존 행동 그룹을 같은 규칙으로 병합했다. 화면별 `1:2`, `1:1.3` 예외 선언은 제거했다.
- PC에서 `memo_edit`, `stock_change?popup=stock_option`, `stock_change?popup=stock_confirm`,
  `options?popup=option_card_menu`를 직접 열어 폭·높이·배경·선·글자색을 확인했다. 측정 결과 대표
  두 버튼의 폭은 각 화면에서 동일했고 모든 높이는 `48px`였다.

## 2026-09-02 · 메인 필터 스타일 재통합

- 레시피 메인의 `정렬·판매 상태·목표 상태`에 남아 있던 검정 채움·회색 칩 예외를 제거했다.
- 식재료 메인의 정렬 필터와 같은 `38px` 높이, 흰 배경, `1px` 중립 경계선, 검정 글씨,
  `radius.full`, 우측 아래 화살표로 통일했다. 선택 여부는 채움색이 아니라 버튼 라벨의 현재 값으로
  표시한다.
- 공통 `filter / filter-chip` 정의에서도 선택 시 검정 채움 규칙을 제거해 화면별 예외가 다시 생기지
  않게 했다. PickerSheet 내부 선택 행은 파란 체크 표시 규칙을 그대로 유지한다.
- PC에서 `ingredient_main`과 `recipe_main`의 계산된 높이·배경·경계·글자·반경을 비교해 모두 같은
  값임을 확인했다. 레시피 `판매중` 필터를 눌러 `판매 상태` 선택창과 현재 선택 체크도 확인했다.

## 2026-09-02 · 정보 안내와 자동 계산 ResultField 재통합

- 고정 지출 환산 설명을 포함한 파란 안내 박스는 공통 Notice로 분류하고 좌측에 `20px` 원형 정보
  아이콘을 추가했다. 최소 높이 `48px`, 본문과 아이콘의 시작선·간격을 공통 규격으로 맞췄다.
- 자동 계산 결과는 식재료·재고·레시피에 관계없이 전체 너비, 높이 `50px`, 좌우 `14px` padding,
  `1px` 파란 경계, `12px` 반경, 연한 파란 배경을 사용한다.
- 금액·수량·단가 값은 모두 우측 정렬하며 `16px / 800 / 22px`로 통일했다. 입력값 `15px`와 위계를
  유지하되 기존 재고·레시피의 `18px` 예외처럼 과도하게 커지지 않게 했다.
- `ingredient_add` 구매 단가, 저장된 구매처 선택 뒤 `stock_change`의 총 입고량·입고 후 기준단가,
  `recipe_material_usage`의 10인분·1인분 비용을 직접 열어 계산된 너비·높이·색·테두리·정렬·글자값을
  비교했다. 세 영역 모두 같은 값으로 확인했다.

## 2026-09-02 · 판매가 시뮬레이션 핵심 입력 행 보완

- 판매가는 시뮬레이션에서 사용자가 직접 조정하는 유일한 핵심 입력이므로 일반 조회 행보다 높은
  위계를 부여했다. 판매가 행은 최소 `76px`, 상·하 `14px`로 확대했다.
- 입력칸은 높이 `50px`, 넓은 시연 화면 `240px`, 모바일 최소 `180px`로 확장했다. 숫자는
  `16px / 700` 우측 정렬, 통화 단위는 `15px`로 분리해 긴 값에서도 입력 영역을 확보했다.
- PC에서 행 `79px`, 입력칸 `240×50px`, 모바일 `390px` viewport에서 입력칸 `180×50px`와
  가로 overflow 없음, 행과 입력칸 우측선 일치를 확인했다.

## 2026-09-02 · 목표 순이익률 도움말 제거

- 레시피 추가와 레시피 수정의 `목표 순이익률` 옆 `도움말` 버튼을 제거했다.
- `recipe_target_help` 팝업을 탭 구성·팝업 본문·UI 가이드·검수 목록에서 제외했다.
- 기존 `popup=recipe_target_help` 주소로 진입해도 안내 팝업이 열리지 않고 레시피 폼만 표시되도록
  정리했다.

## 2026-09-02 · 부자재비 소계 공통 적용

- 레시피 추가와 수정의 부자재 카드 하단에 재료 카드와 동일한 `부자재비 소계` 행을 추가했다.
- 부자재가 없으면 `0원 · 0.0%`, 등록되어 있으면 합산 금액과 판매가 대비 비율을 표시한다.
- PC 레시피 추가에서 `0원 · 0.0%`, 레시피 수정에서 `300원 · 2.5%`를 확인했다.

## 2026-09-02 · 사용량 숫자·단위 우측 묶음 정렬

- 식재료·부자재 사용량 입력 팝업의 수량값을 우측 정렬하고 단위를 바로 뒤에 배치했다.
- 숫자와 단위 사이 간격은 `8px`로 고정해 `1`과 `개`가 입력칸 양끝으로 분리되지 않게 했다.
- 부자재 `1 개`와 식재료 `0 g` 모두 우측 정렬 및 같은 간격을 확인했다.

## 2026-09-02 · 최근 확정 규칙 공통 가이드 병합

- 최근 수정 기록을 공통 요소 규칙과 화면별 제품 정책으로 나누어 다시 검토했다.
- 공통 가이드에 누락됐던 3단계 목록 밀도와 변경 전후 비교 블록 규칙을 본문에 보강했다.
- 기존 절을 반복해서 늘리지 않고 `9.2.1 최근 확정 공통 적용표` 하나로 FieldControl, ResultField,
  Notice, Filter, LayerFooter, DetailBlock, DateTime, 원가 소계 등 적용 위치를 연결했다.
- 목표 순이익률 도움말 삭제처럼 화면 정책인 항목은 공통 컴포넌트 규칙에서 제외했다.

## 2026-09-02 · 디자인 작업 실행서 분리

- 공통 가이드의 규격을 실제 화면에 순서대로 적용하기 위한
  `full-page-flow-prototype-design-work-plan.md`를 추가했다.
- 공통 규칙 잠금 C-01~C-20, 공통 컴포넌트 적용 순서, 화면 한 장의 12단계 검수, 화면별 검수 카드,
  역할별 교차검수와 전체 완료 조건을 한 파일에 병합했다.
- 공통 CSS를 적용했다는 이유만으로 화면 전체를 완료 처리하지 않고 모든 `screen`, `popup@host`, 조건
  상태를 PC·모바일에서 각각 확인하도록 판정 기준을 고정했다.

## 2026-09-02 · 입고 확인창 글로벌 반응형 보완

- 확인 대상의 식재료명·수량에서 말줄임표를 제거하고 긴 값이 온전히 줄바꿈되도록 수정했다.
- 기본 화면은 동일한 2열 DetailBlock을 유지하되 `360px` 이하에서는 요약과 두 행동을 1열로 전환한다.
- 디자인 실행서의 글로벌 검수 기준을 30~50% 긴 번역, 320px 화면, RTL과 핵심값 잘림 0건으로
  구체화했다.

## 2026-09-02 · 디자인 실행서 자립형 규칙 보강과 UTF-8 보기 페이지

- 실행서에 기존 확정 색상·타이포·간격·선·Card·Row·Form·ResultField·Button·Filter·Badge·Notice·
  Layer·날짜·글로벌 규칙을 실제 적용값과 금지 사례까지 포함해 한 문서에서 작업할 수 있게 했다.
- 화면 정책과 공통 디자인 variant의 경계를 별도 절로 명시해 문구 결정이 새 컴포넌트 예외로 번지는
  문제를 막았다.
- Python 정적 서버에서 `.md`를 직접 열 때 한글 인코딩이 깨지는 문제를 피하도록 UTF-8 디코딩과
  Markdown 렌더링을 포함한 `full-page-flow-prototype-design-work-plan.html` 보기 페이지를 추가했다.

## 2026-09-02 · 현재 확정안 누락 시정과 문서 동기화 게이트

- UI 가이드·검수 기록만 갱신되고 현재 확정안·변경 기록이 뒤처진 상태를 규칙 위반으로 판정했다.
- 현재 확정안의 검정 채움 레시피 필터, `1:2` 사용량 버튼, 목표 순이익률 안내 팝업, 부자재 소계
  누락 등 대체된 규칙을 최종안으로 교체했다.
- 오늘 확정한 목록 밀도, 비교 블록, 날짜 fallback, 최근 기록 위계, ResultField, Confirm DetailBlock,
  `1:1` 버튼, Filter, Notice, 판매가 핵심 입력, 부자재 소계, 사용량 정렬, 글로벌 반응형을 다시 대조했다.
- 실행서와 현재 확정안에 같은 작업 안의 문서 동기화 게이트를 추가했다. 필수 문서 중 하나라도 빠지면
  작업 완료로 답하지 않는다.

## DS-20260902-001 · 디자인 맥락 장부와 자동 동기화 검사

- 모든 디자인 작업의 최근 결정·영향 범위·다음 시작점을 연결하는
  `full-page-flow-prototype-design-context.md`를 추가했다.
- 같은 동기화 ID가 UI 적용본·현재 확정안·변경 기록·검수 기록·맥락 장부에 있는지 검사하고, 공통
  변경이면 UI 가이드·실행서까지 검사하는 `full-page-flow-prototype-design-sync-check.ps1`을 추가했다.
- 필수 문서 중 한 곳이라도 현재 ID가 없으면 스크립트가 실패하므로 완료 응답 전에 누락을 발견할 수
  있다.
- 대상: 디자인 맥락 장부, 문서 HTML 보기, 최신 PRT 연결, 필수 7개 문서 동기화 게이트
- 기대값: 최신 ID가 지정된 최신 위치에 있고 PC·모바일 검수 증거와 완료 상태가 없으면 실패한다.
- 실제값: 미완료 상태·검수 필드 누락 시 12개 사유로 실패했고, 뷰어 6개 탭과 최신 PRT-152 연결을
  확인했다. 완료 후 파일 해시가 달라지면 새 ID를 요구하는 완료 장부를 추가했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-design-work-plan.html?doc=context ·
  1280px · 6개 문서 활성 탭·한글·메타 카드·긴 표 내부 스크롤·잘못된 doc의 실행서 복귀 PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-design-work-plan.html?doc=context ·
  390px 및 320px · 문서 가로 넘침 없음·6개 탭 가로 스크롤·한글 대체문자 0건 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·모바일 HTTP 200, 브라우저 DOM 6개 탭 회귀 검사, 320px/390px 너비 측정,
  미완료 상태에서 자동 검사 FAIL 확인

## DS-20260902-002 · 레시피 추가의 식재료·부자재 추가 행동 재배치

- 대상: `screen=recipe_add` 재료 카드·부자재 카드의 소계와 추가 버튼
- 기대값: 각 카드에서 소계 다음에 전체 너비의 연한 파란 Footer 버튼이 나오고, 문구는
  `＋ 식재료 추가`, `＋ 부자재 추가`이며 기존 검색 화면으로 이동한다.
- 실제값: 두 카드 모두 버튼이 소계의 바로 다음 형제 요소로 렌더됐고 margin·radius는 0,
  배경은 `rgb(234, 243, 255)`, 글자는 `rgb(49, 130, 246)`로 일치했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_add ·
  카드 570px와 버튼 570px 일치 · 소계 다음 배치 · 식재료/부자재 검색 이동 PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_add ·
  390px에서 카드·버튼 358px, 320px에서 288px 일치 · 문서 가로 넘침 없음 PASS
- 미검수: 없음
- 결과: PASS
- 증거: 브라우저 DOM 순서·계산 스타일·폭 측정, 두 버튼 클릭 후
  `recipe_ingredient_search`·`recipe_material_search` URL 확인

## DS-20260902-003 · 레시피 수정 화면 전수 재검수

- 대상: `screen=recipe_edit`, `popup=recipe_category_pick`, `popup=recipe_ingredient_usage`
- 기대값: 레시피 추가와 동일하게 식재료·부자재 소계 아래에 카드 전체 폭 Footer 추가 행동이
  나오고, 연결 팝업은 공통 PickerSheet·FormSheet 규격을 유지한다.
- 실제값: 두 버튼 모두 소계 바로 다음 형제 요소로 이동했고 `＋ 식재료 추가`,
  `＋ 부자재 추가`로 표시됐다. 배경 `rgb(234, 243, 255)`, 글자 `rgb(49, 130, 246)`,
  margin·radius 0으로 일치했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_edit ·
  카드·버튼 570px 일치 · 소계 다음 배치 · 식재료·부자재 검색 이동 PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_edit ·
  390px 카드·버튼 358px, 320px 288px · 가로 넘침 없음 · 카테고리 선택과 사용량 수정 팝업 시각 검수 PASS
- 미검수: 없음
- 결과: PASS
- 전체 작업 상태: 150여 target 작업은 IN_PROGRESS
- 증거: PC·모바일 DOM 순서·계산 스타일·폭 측정, 두 추가 버튼 클릭 후
  `recipe_ingredient_search`·`recipe_material_search` URL 확인, 320px 팝업 스크린 검수

## DS-20260902-004 · 재료 검색 화면 전수 재검수

- 대상: `screen=recipe_ingredient_search`, `popup=recipe_ingredient_usage`
- 기대값: 검색과 행 정보가 명확하고 사용량 입력의 수량·비용·하단 행동이 320px에서도 온전히 보인다.
- 실제값: 검색창, 19개 식재료 행, 상태 뱃지와 추가 아이콘을 확인했고 사용량 입력은
  `10인분 개수 / 10인분 비용 / 1인분 비용`, `취소 / 담기` 구조를 유지했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_ingredient_search · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_ingredient_search ·
  390px·320px 화면과 사용량 입력 팝업, 가로 넘침 없음 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 화면 스크린 검수, DOM 접근성 이름, 사용량 입력 팝업 3개 필드와 2개 행동 확인

## DS-20260902-005 · 부자재 검색 화면 전수 재검수

- 대상: `screen=recipe_material_search`, `popup=recipe_material_usage`
- 기대값: 검색·관리 진입·부자재 행·사용량 입력이 같은 정보 계층과 공통 FormSheet를 사용한다.
- 실제값: 3개 부자재 행과 관리 진입을 확인했고 사용량 입력은 `1개`, `300원`, `30원`을 우측
  정렬하며 하단 `취소 / 담기`를 유지했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_material_search · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_material_search ·
  320px 화면과 사용량 입력 팝업 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린 검수와 DOM 접근성 구조 확인

## DS-20260902-006 · 부자재 관리 화면 전수 재검수

- 대상: `screen=recipe_materials`, `popup=material_add`, `popup=material_edit`,
  `popup=material_category_pick`, `popup=material_delete`
- 기대값: 관리 행은 하나의 경계만 사용하고 아이콘은 44px·명시적 이름을 가지며 모든 시트가
  320px에서 가로 스크롤 없이 열린다.
- 실제값: 본문 버튼의 border 0·투명 배경, 수정·삭제 44×44px와 부자재별 접근성 이름을 확인했다.
  부자재 추가 시트의 320px 가로 스크롤도 제거됐다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_materials ·
  목록과 4개 팝업 PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_materials ·
  320px 목록·추가 시트·삭제 확인창 PASS
- 미검수: 없음
- 결과: PASS
- 증거: 계산 스타일·44px 치수·접근성 이름 측정, PC와 320px 스크린 검수

## DS-20260902-007 · 레시피 카테고리 화면 전수 재검수

- 대상: `screen=recipe_category`, `popup=category_add`, `popup=category_edit`, `popup=category_delete`
- 기대값: 목록 행은 하나의 경계를 사용하고 이동 행동은 44px·명시적 이름을 가지며 추가 행동은
  한 위치에만 존재한다.
- 실제값: 본문 버튼 border 0·투명 배경, 이동 버튼 44×44px와 카테고리별 접근성 이름,
  하단 단일 추가 행동을 확인했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_category · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_category ·
  320px 목록·추가·수정·삭제 팝업 PASS
- 미검수: 없음
- 결과: PASS
- 증거: 버튼 치수·접근성 이름·계산 스타일 측정, PC와 320px 스크린 검수

## DS-20260902-008 · 부자재 카테고리 화면 전수 재검수

- 대상: `screen=recipe_material_category`, `popup=category_add`, `popup=category_edit`,
  `popup=category_delete`
- 기대값: 레시피 카테고리와 같은 CategoryRow·행동·팝업 규격을 사용한다.
- 실제값: 2개 부자재 카테고리의 무테두리 본문, 44px 이동 행동, 카테고리별 접근성 이름과 단일
  하단 추가 행동을 확인했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_material_category · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_material_category ·
  320px 목록·수정·삭제 팝업 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린과 DOM 접근성 구조 확인

## DS-20260902-009 · 레시피 수정 내역 화면 전수 재검수

- 대상: `screen=recipe_changes`, `popup=recipe_change_detail`
- 기대값: 목록과 상세가 글로벌 날짜·시간 규격을 공유하고 직접 수정·자동 갱신의 정보 계층이 명확하다.
- 실제값: 목록과 상세에 `2026-09-01 · 04:47`을 동일하게 표시했으며, 직접 수정과 자동 갱신을
  별도 비교 블록으로 유지했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_changes · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=recipe_changes · 320px 목록·상세 팝업 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, 날짜·시간 DOM 텍스트, 비교 블록 구조 확인

## DS-20260902-010 · 레시피 손익 변동 화면 전수 재검수

- 대상: `screen=profit`, `popup=profit_detail`
- 기대값: 빈 상태는 한 문장만 노출하고 상세는 원인과 전후 손익 결과를 명확히 구분한다.
- 실제값: 중복 안내 없는 빈 상태와 메뉴명·시각·출처, 변동 원인, 손익 결과 세 행을 확인했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=profit · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=profit · 320px 화면·상세 팝업 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, DOM 텍스트 순서, 가로 넘침 없음 확인

## DS-20260902-011 · 레시피 고정 지출 화면 전수 재검수

- 대상: `screen=fixed_average`, `popup=fixed_period`
- 기대값: 월매출 비교와 고정 지출 그룹을 우선순위대로 보여주고 월 선택은 공통 단일 선택 시트를 사용한다.
- 실제값: 월매출 경고·비교 5행, 다섯 지출 그룹과 소계·합계, 6개 월 선택 시트를 확인했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=fixed_average · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=fixed_average · 320px 화면·월 선택 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, DOM 정보 순서, 고정 행동과 가로 넘침 없음 확인

## DS-20260902-012 · 레시피 고정 지출 수정 화면 전수 재검수

- 대상: `screen=fixed_actual`, `popup=fixed_period`, `popup=fixed_channel`, `popup=fixed_item_add`
- 기대값: 페이지와 팝업의 수량·금액·비율이 같은 숫자 Field 규격을 쓰고 고정 행동과 합계가 명확하다.
- 실제값: 총 월매출을 편집 Field로 전환하고 모든 suffix 숫자 입력을 end 정렬했으며, 월 선택과 두 FormSheet의
  필수 표시·결과·1:1 행동을 확인했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=fixed_actual · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=fixed_actual · 320px 화면·팝업 3종 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, computed text-align=end, inputMode, 가로 넘침 없음 확인

## DS-20260902-013 · 발주 메인과 연결 팝업 전수 재검수

- 대상: `screen=order_main`, `popup=order_candidates`, `popup=order_waiting`, `popup=order_received`,
  `popup=order_order`, `popup=order_receive`, `popup=order_cancel`, `popup=order_revert`,
  `popup=order_price_spike`
- 기대값: 상태 탭과 목록이 같은 정보 위계를 사용하고 주문·입고 숫자 입력, 취소 확인, 단가 급등
  안내가 각 공통 Layer·Field 규격을 사용한다.
- 실제값: 주문·입고 FormSheet의 수량·기간 값과 suffix를 end에 인접 정렬했고, 입고 완료 목록 날짜를
  `2026-08-17`로 명확히 표시했다. 두 취소는 중앙 ConfirmDialog와 1:1 행동을 유지했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_main · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_main ·
  320px 화면·팝업 8종 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, 숫자 suffix·접근성 이름, 중앙 확인창, 가로 넘침 없음 확인

## DS-20260902-014 · 발주 상세 화면 전수 재검수

- 대상: `screen=order_detail`, `popup=order_order@order_detail`
- 기대값: 페이지와 FormSheet가 같은 정보·입력 규격을 사용하고 구매 링크 빈 상태에서 저장을 차단한다.
- 실제값: 중복 제목을 제거하고 식재료·권장 수량을 공용 Row로 정돈했으며 아이콘 Callout,
  공용 숫자 Field, 비활성 저장 행동을 확인했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_detail · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_detail ·
  320px 페이지·주문 FormSheet PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, 아이콘·숫자 end 정렬·저장 disabled·가로 넘침 없음 확인

## DS-20260902-015 · 입고 상세과 공통 결과·두 행동 규칙 재검수

- 대상: `screen=order_receive`, `popup=order_receive@order_receive`, 공통 ResultField, 공통 2버튼
- 기대값: 입력과 결과가 같은 끝선을 사용하고 결과는 중립 위계, 두 행동은 320px에서도 1:1이다.
- 실제값: 중복 제목을 제거하고 식재료·발주 수량을 Row로 정돈했으며 입력을 공용 Field로 병합했다.
  입고 후 결과와 재고 수정 결과는 중립 표면·검정 값으로 통일했고 모바일 버튼은 140px씩 2열이다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_receive · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_receive ·
  320px 페이지·입고 FormSheet PASS
- 교차 검수: `screen=stock_change&popup=stock_inbound` 결과값 중립화,
  `screen=recipe_detail&popup=recipe_stop` 320px 2열 유지 PASS
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, 결과 computed color·border·background, 140px+140px grid, 가로 넘침 없음

## DS-20260902-016 · 직접 발주와 공통 검색 선택 규칙 재검수

- 대상: `screen=order_direct`, `popup=order_ingredient@order_direct`,
  `popup=order_vendor@order_direct`
- 기대값: 필수 식재료를 고르기 전 저장할 수 없고, 선택창은 중복 라벨 없이 실제 선택 상태만 표시한다.
- 실제값: 식재료 Select는 모바일 본문 280px 전체 폭을 사용하고 `발주 등록`은 disabled다. 식재료
  PickerSheet는 검색 아이콘·searchbox를 288px SearchBar 한 개로 표시하며 선택 체크가 0개다.
  거래처 PickerSheet는 실제 기본값 `지정 안 함`만 체크한다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_direct · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=order_direct ·
  320px 페이지·두 PickerSheet PASS
- 측정: viewport/body scrollWidth `320/320`, 페이지 content/Select `320/280`, PickerSheet/SearchBar
  `320/288`, 식재료 초기 선택 `0건`
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px DOM·접근성 이름·disabled 상태·가로 넘침 없음 확인

## DS-20260902-017 · 매출관리 메인과 연결 팝업 전수 재검수

- 대상: `screen=sales_main`, 영업 상태·브레이크·영업 종료·정렬·판매 수량·재고 부족·기타 매출·
  지출 추가 팝업 8종
- 기대값: 메인의 모든 조작이 실제 다음 흐름으로 연결되고 판매 수량·재고 부족·입력 Form이 Expo의
  업무 순서와 공통 컴포넌트를 사용한다.
- 실제값: 영업 상태·오늘 손익·정렬·메뉴 관리·판매 행·기타 매출·지출이 각각 목적 화면으로 연결됐다.
  판매 수량은 4개 Stepper와 합계, 부족 안내는 메뉴별 부족 건수와 `재고 확인 · 그대로 판매`, 기타
  매출은 채널 3분할 선택을 사용한다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=sales_main · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=sales_main ·
  320px 메인·팝업 8종 PASS
- 측정: 모든 상태 body scrollWidth/viewport `320/320`, 중앙 Dialog `288px`, 하단 Sheet `320px`,
  부족 안내 두 행동 `140px + 140px`, 판매 Stepper 매장 `15→16`, 합계 `26→27`
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px 스크린, DOM 접근성 이름, 목적 URL 연결, Stepper 상호작용, 가로 넘침 없음 확인

## DS-20260902-018 · 매출 분석과 기간 선택 전수 재검수

- 대상: `screen=analytics`, `popup=sales_period@analytics`, `popup=sales_direct_period@analytics`
- 기대값: 기간 선택 입구가 하나이고 프리셋은 실제 범위를 설명하며 직접 설정은 날짜 Field를 분리한다.
- 실제값: 본문은 공통 FilterButton과 네 개 분석 블록을 유지했다. 기간 Sheet는 다섯 프리셋의 실제
  범위와 체크를 제공하고, 직접 설정은 시작일·종료일과 적용 행동을 제공한다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=analytics · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=analytics ·
  320px 페이지·두 Sheet PASS
- 측정: 세 상태 body scrollWidth/viewport `320/320`, Sheet `320px`, 기간 프리셋 5개, 날짜 Field 2개
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px DOM·스크린, 기간 범위·선택 체크·날짜값·가로 넘침 없음 확인

## DS-20260902-019 · 일 손익과 메뉴 손익 전수 재검수

- 대상: `screen=day`, `popup=sales_menu_profit@day`
- 기대값: 하루 손익의 채널·비용·메뉴 정보가 같은 위계로 읽히고 메뉴 행과 하단 수정 행동이 실제 다음
  흐름으로 연결된다.
- 실제값: 세 정보 블록의 금액·비율 끝선을 유지했고 모든 메뉴 행이 메뉴 손익 Sheet를 연다. Sheet는
  실제 재료 원가와 `배분` 비용을 구분하며 정보 Callout을 포함한다. 하단 수정은 과거 판매 수정으로 이동한다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=day · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=day ·
  320px 페이지·메뉴 손익 Sheet PASS
- 측정: 두 상태 body scrollWidth/viewport `320/320`, 메뉴 행 7개, Sheet 비용 6개, 하단 행동 1개
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px DOM·스크린, 메뉴 행 접근성 이름·팝업 연결·수정 화면 URL·가로 넘침 없음 확인

## DS-20260902-020 · 손익 전체 자세히 전수 재검수

- 대상: `screen=day_full`
- 기대값: 전체 자세히가 매출 구성과 비용별 실제 하위 근거를 부모·자식 위계로 보여 준다.
- 실제값: 매출 상위 메뉴 5개와 잔여 합계, 재료 5개·부자재 3개·고정 지출 5개의 하위 금액을
  한 카드에 표시하고 근거 없는 비용에는 세부 행을 만들지 않았다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=day_full · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=day_full ·
  320px 페이지 PASS
- 측정: body scrollWidth/viewport `320/320`, 매출 구성 6행, 부모 비용 6행, 실제 세부 근거 13행
- 미검수: 없음
- 결과: PASS
- 증거: PC·320px DOM·스크린, 부모·세부 행 수·금액 끝선·가로 넘침 없음 확인

## DS-20260902-021 · 카테고리 순서 조작 공통 규격 재검수

- 대상: 식재료·레시피·부자재 카테고리 화면 5종, 공용 `category_add/edit/delete`
- 기대값: 실제 Expo 공용 화면처럼 순서 조작이 본문을 밀어내지 않는 세로 한 쌍으로 보이고,
  화면 종류별 제목·사용 개수 단위와 추가 진입이 일치한다.
- 실제값: Row 왼쪽 `28px` 열에 위·아래 SVG 버튼 각 `28×20px`를 세로 배치했고 첫·마지막 경계는
  비활성이다. 헤더 `＋`와 하단 점선 추가 버튼이 같은 추가 Sheet를 연다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=my_recipe_categories · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=my_recipe_categories ·
  320px 기본 화면·추가·수정·삭제 팝업 PASS
- 측정: body scrollWidth/viewport `320/320`, reorder 열 `28px`, 버튼 `28×20px`, 기본 Row 4개,
  헤더 추가 1개, FormSheet `320px`, ConfirmDialog `288px`
- 미검수: 없음
- 제약: Expo 개발 서버가 내려가 있어 실시간 앱 렌더 캡처 대신 현재 Expo 소스를 직접 대조했다.
- 결과: PASS
- 증거: PC·320px DOM·스크린, SVG·disabled·팝업 3종·가로 넘침·콘솔 오류 없음 확인

## DS-20260902-022 · 매출 상세 전수 재검수

- 대상: `screen=revenue`, `popup=sales_revenue_all@revenue`
- 기대값: 실제 Expo처럼 영업일·판매 수량·매출 합계가 먼저 읽히고 메뉴 매출 상위 5개가 금액순으로
  표시된 뒤 같은 페이지에서 전체 목록을 펼친다.
- 실제값: 화면 ID를 `SALES-12`로 바로잡고 5개 기본 목록과 7개 전체 목록을 금액 내림차순으로 구성했다.
  목록·소계의 핵심값은 `16px`, 더보기는 SVG 아이콘과 접근성 이름을 사용한다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=revenue · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=revenue ·
  320px 기본 화면·인라인 전체 펼침·전체보기 상태 PASS
- 측정: body scrollWidth/viewport `320/320`, 요약 3행, 기본 메뉴 5행, 펼침 메뉴 7행,
  기타 매출 2행, 전체보기 Sheet `320px`
- 미검수: 없음
- 제약: Expo 개발 서버가 내려가 있어 실시간 앱 렌더 캡처 대신 현재 Expo 소스를 직접 대조했다.
- 결과: PASS
- 증거: PC·320px DOM·스크린, 화면 ID·정렬 순서·SVG·접근성 이름·가로 넘침·콘솔 오류 없음 확인

## DS-20260902-023 · 메뉴 손익 상세 전수 재검수

- 대상: `screen=menu`
- 기대값: 실제 Expo의 과거 장부 구조를 유지하면서 메뉴·금액·근거의 정보 위계와 숫자 끝선이 한눈에
  읽혀야 한다.
- 실제값: 화면 ID를 `SALES-09`로 바로잡고 메뉴명 `20px`, 상세 카드 제목·항목명·금액 `16px`,
  단가·사용량·비율 `14px`로 맞췄다. 요약부터 고정 지출·세금까지 원본 순서를 유지하고 도넛은 두지 않았다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=menu · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=menu ·
  320px 전체 화면 PASS
- 측정: body scrollWidth/viewport `320/320`, 요약 4행, 상세 카드 3개, 제목 `20px`, 상세 핵심값
  `16px`, 보조값 `14px`
- 미검수: 없음
- 제약: Expo 개발 서버가 내려가 있어 실시간 앱 렌더 캡처 대신 현재 Expo 소스를 대조했다.
- 결과: PASS
- 증거: PC·320px DOM·스크린, 화면 ID·카드 순서·타이포·숫자 끝선·가로 넘침·콘솔 오류 없음 확인

## DS-20260902-024 · 채널별 손익 전수 재검수

- 대상: `screen=channel`
- 기대값: 채널 고정 순서와 실제값·배분값이 혼동 없이 읽히고 각 긴 카드의 채널 경계가 즉시 보여야 한다.
- 실제값: 화면 ID를 `SALES-04`로 바로잡고 매장·배달앱·포장 헤더에 실제 Expo 색상 표식을 복원했다.
  판매 수량·매출·순이익·비용 순서, 배분 문구, 채널 미지정 매출의 독립 카드를 유지했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=channel · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=channel ·
  320px 전체 화면 PASS
- 측정: body scrollWidth/viewport `320/320`, 채널 카드 3개, 색상 표식 3개, 채널별 손익 행 각 9개,
  미지정 매출 카드 1개
- 미검수: 없음
- 제약: Expo 개발 서버가 내려가 있어 실시간 앱 렌더 캡처 대신 현재 Expo 소스를 대조했다.
- 결과: PASS
- 증거: PC·320px DOM·스크린, 화면 ID·채널 순서·표식·배분 문구·상태색·가로 넘침 확인

## DS-20260902-025 · 재료 원가·메뉴별 차감 전수 재검수

- 대상: `screen=material`, `popup=sales_material_detail@material`
- 기대값: 사용 식재료 목록이 판매 소진 원장의 근거로 읽히고 모든 행·더보기·식재료 이동이 실제
  다음 흐름으로 연결돼야 한다.
- 실제값: 화면 ID를 `SALES-13`으로 바로잡고 목록을 16/14px, SVG 이동 아이콘으로 맞췄다. 기본
  5개에서 7개로 펼쳐지며 모든 행이 `SALES-14` Sheet를 연다. Sheet는 메뉴 2행·독립 합계·기준단가와
  식재료 상세 이동을 제공한다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=material · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=material ·
  320px 기본·전체 펼침·상세 Sheet PASS
- 측정: body scrollWidth/viewport `320/320`, 기본 5행, 펼침 7행, 이름 `16px`, 보조값 `14px`,
  Sheet `320px`, 메뉴 행 2개, 합계 1개
- 미검수: 없음
- 범위 메모: 정적 시연 데이터는 7개이며 실제 데이터의 빈 상태와 긴 목록은 공용 QueryState·스크롤
  계약을 그대로 사용한다.
- 제약: Expo 개발 서버가 내려가 있어 실시간 앱 렌더 캡처 대신 현재 Expo 소스를 대조했다.
- 결과: PASS
- 증거: PC·320px DOM·스크린, 화면 ID·SVG·더보기·행 상세·식재료 이동·가로 넘침 확인

## DS-20260902-026 · 부자재·메뉴별 내역 전수 재검수

- 대상: `screen=extra`, `popup=sales_extra_detail@extra`
- 기대값: 부자재 합계와 사용 근거가 실제 판매 시점 스냅샷으로 읽히고 모든 행이 메뉴별 상세로
  연결돼야 한다.
- 실제값: 화면 ID를 `SALES-15`로 바로잡고 목록 3행을 16/14px·SVG 규격으로 맞췄다. 모든 행이
  `SALES-16` Sheet를 열며 메뉴 행과 총수량·총금액 합계를 분리했다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=extra · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=extra ·
  320px 페이지·상세 Sheet PASS
- 측정: body scrollWidth/viewport `320/320`, 부자재 3행, 이름·금액 `16px`, 보조값 `14px`,
  Sheet `320px`, 메뉴 행 1개, 합계 Result 1개
- 미검수: 없음
- 제약: Expo 개발 서버가 내려가 있어 실시간 앱 렌더 캡처 대신 현재 Expo 소스를 대조했다.
- 결과: PASS
- 증거: PC·320px DOM·스크린, 화면 ID·접근성 이름·행 상세 연결·금액 끝선·가로 넘침 확인

## DS-20260902-027 · 폐기 손실 전수 재검수

- 대상: `screen=waste`
- 기대값: 조리 폐기와 식재료 폐기가 한 합계 아래에서도 서로 다른 원인으로 구분되고, 0원은 경고로
  과장되지 않아야 한다.
- 실제값: `SALES-17`의 요약 3행과 조리 폐기·식재료 폐기 두 구역을 한 카드에 유지했다. 기록 없음
  행은 중립 회색이며 두 구역 사이에는 `line2 1px` 선 하나만 사용한다.
- PC 검수: http://127.0.0.1:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=waste · PASS
- 모바일 검수: http://192.168.200.167:8093/docs/prototypes/full-page-flow-prototype-ui-applied.html?screen=waste ·
  320px 페이지 PASS
- 측정: body scrollWidth/viewport `320/320`, 요약 3행, 구역 2개, 빈 행 2개, 섹션선 `1px`
- 미검수: 없음
- 제약: Expo 개발 서버가 내려가 있어 실시간 앱 렌더 캡처 대신 현재 Expo 소스를 대조했다.
- 결과: PASS
- 증거: PC·320px DOM·스크린, 화면 ID·빈 상태·상태색·선 위계·가로 넘침 확인
