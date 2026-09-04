# 전체 페이지 UI 가이드 적용본 검수 장부

- 적용본: `full-page-flow-prototype-ui-applied.html`
- 보존 원본: `full-page-flow-prototype.html`
- 작업 시작 원본 SHA-256: `9B538CE9ACD1D93AA75845EB1851391B8EB4C5732DF7094214E8AC5662428414`
- 검수 범위: 활성 화면 61개 + 활성 popup/state host 121개 = **182개 host 단위**
  (PRT-184 정정: 이전 표기 `62 + 120`은 숨김 화면 `discard`를 활성에 넣고 host를 한 개
  덜 센 값이었다. 합계 182는 우연히 같았다. 레지스트리 실측이 권위다.)
- 고유 popup/state ID: **96개** (PageState 9 + popup 87). 이전 표기 `97`은
  `PRT-151`의 `recipe_target_help` 제거 이전 값이다.
- 이 장부의 target 행 수: **183행 = 활성 182 + `screen:my_country`(SPEC_ONLY) 1**.
  `SPEC_ONLY`는 레지스트리에 키가 없어 활성 집계에 들어가지 않으므로 따로 센다.
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
종합 상태 열에는 여기에 더해 진행 상태 `IN_PROGRESS / COMPLETE / CODEX_PASS`와
`SPEC_ONLY`와 `NO_RENDERER`를 쓴다. 셋은 원인이 달라 후속 작업도 다르므로 섞지 않는다.

| 코드 | 뜻 | 판정 근거 | 후속 |
|---|---|---|---|
| `TODO` | **검수를 아직 하지 않았다.** 구현 여부와 무관하다 | 없음 — 기본값 | 7항목 검수를 수행한다 |
| `SPEC_ONLY` | 문서(부록 A/B)에는 있으나 **레지스트리에 키 자체가 없다.** URL로 지정할 수도 없다 | `screens`·`popupTabs` 키 부재 | 구현할지 명세에서 내릴지 제품이 결정한다 |
| `NO_RENDERER` | **레지스트리에는 등록됐으나** `openPopupTab()`·`render()`에 처리 분기가 없어 URL은 해석되는데 아무것도 렌더되지 않는다 | 분기 부재 + 실렌더 무반응 | 렌더러를 구현한다 |

- `SPEC_ONLY`는 target 종류를 가리지 않는다. screen이든 popup이든 **레지스트리에 키가 없으면**
  이 코드다. 현재 해당: `screen:my_country` 1건.
- `NO_RENDERER`는 등록은 됐으나 렌더가 없는 **불완전 구현**이다. `SPEC_ONLY`와 다른 상태다.
  현재 해당: **0건.** `PRT-186`에서 활성 96개 ID를 전부 URL로 열어 측정한 결과
  모두 `openPopupTab()`에 처리 분기가 있고 실제로 렌더된다(UI 가이드 B.8a).
- 어느 코드든 7항목은 `TODO`로 두고 실측 근거 없이 `PASS`로 올리지 않는다.
  감사 이력 보존을 위해 행은 지우지 않는다.

**렌더 부재는 주장하려면 증명해야 한다.** 근거는 두 가지뿐이다 — `openPopupTab()`·`render()`의
처리 분기 부재와, URL 직접 진입 시 실렌더 무반응. 레지스트리·이 장부·가이드 어느 쪽의
**누락**도 근거가 아니다. 장부에 행이 없는 것은 장부 누락일 뿐이며, 그 사실만으로 미구현을
추론하지 않는다. (`PRT-184`가 이 추론을 해서 틀렸고 `PRT-185`·`PRT-186`이 정정했다.)

## 공통 적용 1차

| 항목 | 구현 | Codex | Opus | 상태 |
|---|---|---|---|---|
| 원본 보존 | 별도 적용본 생성, 시작 SHA 기록 | PASS | 승인 가능 | PASS |
| 토큰 | 색·텍스트·선·간격·라운드·그림자·높이·터치 크기 | PASS | PASS | PASS |
| 병합 요소 | Card, RowGroup, Field, Result, Badge, Control, Layer, StickyAction | PASS | PASS | PASS |
| 의미 분리 | Field↔Result, Card↔선택행, Page StickyAction↔LayerFooter 분리 | PASS | PASS | PASS |
| popup 계약 | 활성 고유 ID 96/96 명시 등록 (PRT-184 정정, 이전 `97/97`) | PASS | 등록 확인, 런타임 전수검수 필요 | COMMON |
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

도메인 수치의 합계는 popup/state의 host 중복을 포함한다. 고유 계약 완전성은 별도의 96/96으로 검산한다.
(PRT-184 정정: 이전 표기 `97/97`. 위 표의 도메인별 수치는 당시 기록이므로 그대로 둔다.)

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

아래 목록은 **183행**이다 — 숨긴 폐기 전용 페이지(`discard`)를 제외한 활성 screen **61개**와
popup/state host **121개**(합 182), 그리고 레지스트리에 키가 없는 `screen:my_country`
(`SPEC_ONLY`) 1행이다. 활성 182건은 레지스트리와 양방향 차집합 0이다.

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
| screen:my_country | my | Screen(미구현) | COMMON | TODO | TODO | TODO | TODO | SPEC_ONLY |
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
| popup:fixed_period@my_fixed_edit | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
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
| popup:tax_country@my_tax | my | PickerSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
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
| popup:language_preview@my_language | my | FormSheet | COMMON | TODO | TODO | TODO | TODO | TODO |
| popup:account_delete@my_account | my | FormSheet→ConfirmDialog | COMMON | PASS | REVIEW | PASS | TODO | IN_PROGRESS |

`PRT-184`에서 추가한 세 행(`tax_country@my_tax`, `language_preview@my_language`,
`fixed_period@my_fixed_edit`)이 `TODO`인 이유는 **개별 렌더·상호작용 검수를 아직 하지 않았기
때문**이며 구현이 없어서가 아니다. 세 팝업 모두 실제로 렌더되지만 **경로는 같지 않다.**

| target | 실행 경로 | 확인 |
|---|---|---|
| `tax_country@my_tax` | `openPopupTab()` → `openActualPopup()` map(HTML 995행) → `showPrototypeSheet()` | `PRT-185` 실렌더 |
| `language_preview@my_language` | `openPopupTab()` → `openActualPopup()` map(HTML 998행) → `showPrototypeSheet()` | `PRT-185` 실렌더 |
| `fixed_period@my_fixed_edit` | **map에 없다.** `openPopupTab()`의 전용 분기(HTML 1051행) → `openFixedPeriod()`(930행) | `PRT-186` 실렌더 |

(`PRT-185`가 세 건을 한 경로로 묶어 적은 것은 틀렸다. `PRT-186`에서 96개 ID의 경로를
전수 측정해 정정했다 — UI 가이드 B.8a.)
`screen:my_country`만이 `screens` 레지스트리에 키가 없는 `SPEC_ONLY`다.

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

## DS-20260904-001 · 숫자·단위 타이포 전수 통일

- 대상: 전 화면 공통 `<style>` 레이어. 검수 범위는 활성 화면 62개 전수
- 기대값: 숫자와 단위의 크기가 UI 가이드 `TYPE` 스케일(`22 / 20 / 18 / 16 / 14 / 13`)과
  공식 굵기(`400 / 600 / 700 / 800`) 안에만 있어야 하고, 값 역할에는 `tabular-nums`가 적용되어
  목록에서 자릿수가 흔들리지 않아야 한다. 입력 suffix는 단일 규격이어야 한다.
- 실제값: 활성 화면 62개에서 숫자를 포함한 `b·strong·small·em` 요소의 실제 렌더 크기가
  `22 / 18 / 16 / 14 / 13px`, 굵기가 `600 / 700 / 800`으로 수렴했다. 통일 전에는 크기에
  `25 / 23 / 15 / 13.3333 / 11.6667px`가, 굵기에 `400 / 900`이 섞여 있었다.
  입력 suffix는 `14px / 600 / var(--sub) / 간격 8px` 한 규격으로 수렴했다.
- PC 검수: 1280×900, 활성 화면 62개 순회 · 가로 넘침 0건 · 콘솔 오류 0건 · PASS
- 모바일 검수: 320×720, 활성 화면 62개 순회 · 가로 넘침 0건 · PASS
- 측정: `font-size` 규칙 20단계에서 숫자 역할 5단계로, `font-weight` 11단계에서 3단계로 축소.
  금지 굵기(650·750·850·900·500·300) 잔존 0건, `tabular-nums` 선언 138건,
  중괄호 균형 1165/1165, `<style>`·`<script>` 각 1개, 스크립트 블록 무수정
- 미검수: 없음
- 제약: 로컬 프로토타입 서버가 내려가 있어 headless Chromium으로 파일을 직접 렌더하고
  `getComputedStyle` 값을 화면별로 수집해 대조했다. 실기기 캡처는 수행하지 않았다.
- 결과: PASS
- 증거: PC·320px 62화면 순회 결과, 역할별 computed style 대조표(값·suffix·보조 수치),
  변경 전후 파일 해시, 변경 줄 범위 12~122행(`<style>` 블록 내부 한정)

## DS-20260904-002 · PRT-179 검수 지적 반영 및 증거 재취득

- 대상: 전 화면 공통 `<style>` 레이어. 검수 범위는 활성 화면 62개 + 활성 popup/state host 123개 = 185건
- 기대값: 렌더된 숫자 text node와 입력값 전체가 `TYPE` 스케일(`22/20/18/16/14/13`) 안에 있고,
  공식 굵기(`400/600/700/800`) 외 값이 0건이며, 단일 편집 입력에는 `tabular-nums`를 적용하지 않고,
  필수 표시·곱셈 기호가 부모 크기를 유지해야 한다. 증거는 실제 Pretendard 로드 상태에서 취득한다.
- 실제값: 185건 전수 스캔에서 스케일 밖 요소는 프로토타입 셸 2종만 남았다(폰 목업 상태바 시각
  `11px/800`, 카탈로그 화면 ID 배지 `10px/700`). 둘 다 `shell-excluded`로 제품 UI가 아니다.
  굵기는 `400 / 600 / 700 / 800` 네 값이며 금지 굵기 잔존 0건이다.
  `tabular-nums` 선언은 132건이고 단일 편집 입력 6개 선택자에서 제거했다.
- PC 검수: `http://127.0.0.1:8099/docs/prototypes/0_full-page-flow-prototype-ui-applied.html`
  1280×900, 185건 순회 · 가로 넘침 0건 · 콘솔 오류 0건 · 폰트 요청 실패 0건 · PASS
- 모바일 검수: 같은 URL 320×720, 185건 순회 · 가로 넘침 0건 · PASS.
  추가로 320px 200% 확대에서도 185건 순회 · 가로 넘침 0건 · PASS
- 측정: `document.fonts.check`로 Pretendard `400/600/700/800` 네 굵기 로드 확인,
  `document.fonts.ready` 이후 측정. Pretendard는 정적 OTF 4종이며 가변축이 없다.
  `font-weight` 분포 `400:4 / 600:51 / 700:165 / 800:103`, 중괄호 균형 일치
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 데스크톱 Chromium에서 실제 Pretendard를 로드해 측정했다.
- 결과: PASS
- 증거: 185건 text node 스캔 결과, 3개 뷰포트 조건 회귀 결과, 폰트 로드 assert 로그,
  변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT180.html`
- 지적 반영: F01 APPLIED · F02 APPLIED · F03 APPLIED · F04 APPLIED · F05 APPLIED (반박 0건)

## DS-20260904-003 · PRT-180 검수 지적 반영 (굵기 face 보존 · 인벤토리 표기)

- 대상: 전 화면 공통 `<style>` 레이어. 검수 범위 **총 185건 = 활성 182건 + 숨김 보존 3건**
  (숨김: `screen=discard`, `popup:discard_type@discard`, `popup:discard_period@discard`)
- 기대값: 굵기 정규화가 실제 렌더 face를 바꾸지 않아야 하고, 공식 굵기 외 값이 0건이어야 한다.
  전역 기본 규칙이 요소의 브라우저 기본 동작이나 장식 아이콘을 덮지 않아야 한다.
- 실제값: 폰트 매칭 실측(100px 텍스트 폭) — `300·400·500 → 963.53` / `600 → 1003.28` /
  `650·700 → 1023.11` / `750·800·850·900 → 1043.08`. 네 face로만 묶인다.
  이에 맞춰 `650→700`, `750→800`, `500→400`으로 재산출했다.
  `b,strong`의 기본 굵기 선언을 철회하고, suffix 규칙을 `:not(.chev)`로 좁혔다.
  최종 굵기 분포 `400:6 / 600:33 / 700:140 / 800:143`, 금지 굵기 잔존 0건, `tabular-nums` 132건.
- PC 검수: `http://127.0.0.1:8099/...` 1280×900, 185건 순회 · 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS
- 모바일 검수: 같은 URL 320×720 및 320px 200% 확대, 각 185건 순회 · 넘침 0 · PASS
- 측정: **이전/이후 판본 실제 Pretendard 렌더 대조** — face 동일 7,167건,
  의도한 변경 818건(`small,em` 600 정규화 파생 + 입력 suffix 통일),
  **의도하지 않은 변경 0건**
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 데스크톱 Chromium에서 실제 Pretendard를 로드해 측정했다.
- 결과: PASS
- 증거: 폰트 매칭 실측표, 185건 요소별 face 대조 결과, 3개 뷰포트 회귀 결과,
  변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT179.html`
- 지적 반영: Major(굵기 face) APPLIED · Minor(인벤토리 표기) APPLIED (반박 0건)
- 인벤토리 주석: 공식 가이드는 활성을 `화면 62 + popup host 120`으로 적지만, 레지스트리 실측은
  `화면 61 + popup host 121`이다(가이드가 숨김 화면 `discard`를 활성 화면 수에 포함). 합계 182는 같다.

## DS-20260904-004 · PRT-181 검수 지적 반영 (@font-face 복원 · 스크립트 굵기 · 인벤토리)

- 대상: 전 화면 공통 `<style>` 및 `<script>` 템플릿. 검수 범위 **총 185건 = 활성 182건 + 숨김 보존 3건**
  (활성 = screen 61 + popup·state host 121)
- 기대값: `@font-face` 디스크립터가 `600/700/800`으로 각 face를 선택할 수 있어야 하고,
  렌더된 모든 요소의 선언 굵기에 금지 값이 없어야 하며, 권위 문서의 인벤토리가 HTML과 일치해야 한다.
- 실제값: `@font-face`를 `SemiBold 600 / Bold 700 / ExtraBold 800`으로 복원했다.
  `channelProfitCard()`의 인라인 `font-weight:850` 2건을 `800`으로 교체했다(렌더 6개 요소).
  UI 가이드 인벤토리를 등록 `62/123/98`, 활성 `61/121/96`으로 정정했다.
- PC 검수: `http://127.0.0.1:8099/...` 1280×900, 185건 · 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS
- 모바일 검수: 320×720 및 320px 200% 확대, 각 185건 · 넘침 0 · PASS
- 측정:
  - 폰트 매칭 실측 `300·400·500 → 963.53` / `600 → 1003.28` / `650·700 → 1023.11` /
    `750·800·850·900 → 1043.08` (100px 텍스트 폭). 네 face 구분 확인
  - 이전 판본 대비 요소별 face 대조 — 동일 7,277 · 의도한 변경 818 · **의도하지 않은 변경 0**
  - 렌더 computed 굵기: `300·500·650·750·850` **0건**.
    `900` 183건은 `b·strong`의 브라우저 기본 `bolder` 파생이며 이전 판본과 집합 동일(차집합 0),
    렌더 폭 427.25로 `800`과 같아 face 동일. **선언된 금지 굵기 0건**
  - 숫자 요소 스케일 밖 2종(프로토타입 셸: 상태바 시각 `11px`, 카탈로그 화면 ID 배지 `10px`)
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 데스크톱 Chromium에서 실제 Pretendard를 로드해 측정했다.
- 결과: PASS
- 증거: 폰트 매칭 실측표, 185건 요소별 face 대조, computed 900 집합 차집합 검사,
  3개 뷰포트 회귀 결과, 변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT182.html`
- 지적 반영: Major1(@font-face) APPLIED · Major2(스크립트 850) APPLIED · Minor(인벤토리) APPLIED (반박 0건)
- 무효 처리: `DS-20260904-003`의 face 대조 증거는 손상된 `@font-face` 판본에 대한 것이므로 무효이며,
  이 항목에서 최종 파일 기준으로 전량 재측정했다.

## DS-20260904-005 · PRT-182 검수 지적 반영 (폰트 경로 · 인벤토리 전수 · 구 파일명)

- 대상: UI 적용본 `@font-face`, UI 가이드 부록 B, 현재 확정안, README, 구 파일명 스텁.
  검수 범위 **총 185건 = 활성 182건(screen 61 + host 121) + 숨김 보존 3건**
- 기대값: `file://`로 열어도 Pretendard 4개 face가 로드되어야 하고, 권위 문서의 인벤토리가
  요약·DoD·부록·본문에서 모두 일치해야 하며, 구 파일명 링크가 정본으로 연결되어야 한다.
- 실제값: `@font-face` 4개 URL을 `../../apps/mobile/assets/fonts/`로 상대화했다.
  UI 가이드 부록 B의 InfoSheet 행·합계 행·검산식·서문과 B.9 서문, 현재 확정안 1장·8.3을 정정했다.
  구 파일명에 쿼리스트링을 유지하는 리다이렉트 스텁을 두었다.
- PC 검수: `file:///…/0_full-page-flow-prototype-ui-applied.html` 1280×900,
  185건 · 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS
- 모바일 검수: 같은 `file://` URL 320×720 185건 및 320px 200% 확대 185건 ·
  각 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS
- 측정:
  - `file://`·HTTP 양쪽 — 폰트 실패 0, `document.fonts.check` 400/600/700/800 전부 true,
    face 폭 `963.53 / 1003.28 / 1023.11 / 1043.08` 4종 구분
  - 이전 판본 대비 face 대조 — 동일 7,277 · 의도한 변경 818 · **의도하지 않은 변경 0**
  - 렌더 computed 굵기 `300·500·650·750·850` 0건. `900`은 브라우저 기본 `bolder` 파생
  - 숫자 요소 스케일 밖 2종(프로토타입 셸)
  - 리다이렉트 스텁이 `?screen=recipe_detail&popup=recipe_memo`를 유지해 정본으로 이동
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 데스크톱 Chromium에서 `file://`과 HTTP 양쪽으로 측정했다.
- 결과: PASS
- 증거: `file://`·HTTP 폰트 로드 대조, face 폭 실측, 185건 face 대조, 3개 뷰포트 회귀,
  리다이렉트 스텁 동작 확인, 변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT183.html`
- 지적 반영: Major1(file:// 폰트) APPLIED · Major2(인벤토리 전수) APPLIED (반박 0건)
- 범위 주석: `DS-20260904-004`의 측정은 HTTP 서버 기준이었다. HTTP 배포에는 유효하나
  `file://` 사용에는 적용되지 않았으므로, 이 항목에서 `file://` 기준으로 다시 취득했다.

## DS-20260904-006 · PRT-184 (PRT-183 검수 지적 2건 + 후속 지시 3건)

- 대상: UI 적용본 용어 사전 문구·동기화 표식, UI 가이드 부록 A·B.2·B.3·B.4·B.8,
  현재 확정안 2.16(신설), 이 장부의 target 목록·판정 규칙, 구 파일명 스텁.
  검수 범위 **총 185건 = 활성 182건(screen 61 + host 121) + 숨김 보존 3건**
- 기대값: 인벤토리 수치가 문서와 화면 문구 전부에서 일치하고, 스텁의 폴백 안내가
  실제 동작과 어긋나지 않아야 한다. 나아가 **B.8 그룹 소계·이 장부의 target 목록·URL 계약**이
  각각 레지스트리 실측과 앱의 실제 동작을 근거로 서 있어야 한다.
- 실제값: 적용본 용어 사전 문구 `호스트 125개` → `123개`.
  B.8 검산식 `PageState 9 + popup 88 = 97` / host `123` → `9 + 87 = 96` / host `121`.
  B.4 헤더 `15개` → `14개`. 스텁에서 `<meta refresh>`를 제거했다.
  후속 1 — B.8 그룹 소계를 행 수 추정이 아니라 레지스트리 고유 ID·host 재산출로 맞췄다
  (레시피·마스터 공용 `18→17`, MY `13→15`, B.2 `26→27`, B.3 `27→28`).
  후속 2 — `tax_country@my_tax`·`language_preview@my_language`, 그리고 대조 중 찾은
  `fixed_period@my_fixed_edit`을 이 장부 target 목록에 추가했다.
  후속 3 — 지원 URL을 쿼리 `screen`·`popup`·`terms`로 한정하고 해시를 라우팅 계약에서 제외했다.
  현재 확정안 `2.16 프로토타입 URL 계약` 신설, 스텁은 `location.search`만 전달한다.
  부수 — `screen:my_country`는 부록 A와 이 장부에만 있고 HTML `screens`에 키가 없다.
  실측 근거 없는 `PASS`였으므로 7항목을 `TODO`로 내리고 종합을 `SPEC_ONLY`로 바꿨다.
  부록 A 헤더는 `등록 62개 + 미구현 명세 1개`로 정정했다. 동기화 표식을 `DS-20260904-006`으로 올렸다.
- PC 검수: `file:///…/0_full-page-flow-prototype-ui-applied.html` 1280×900, 185건 ·
  넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · 금지 굵기 렌더 0건 · PASS
- 모바일 검수: 같은 `file://` URL 320×720 185건, 320px 200% 확대 185건 ·
  각 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS
- 측정:
  - 레지스트리 실측 — screen 키 62(숨김 `discard` 1) · popup 쌍 123 · host 49 ·
    활성 screen 61 · 활성 popup 쌍 121 · 활성 고유 popup ID 96
    (B.1 PageState 11개 중 숨김 2개 제외 9개 + popup 87)
  - 레지스트리 ↔ 이 장부 — popup 121행 = 활성 121건, **양방향 차집합 0**.
    screen 62행 = 활성 61 + `my_country` 1. 장부에만 있는 것은 이 1건뿐이고 레지스트리에만
    있는 것은 0건이다. 등록 62와 장부 62는 수가 같을 뿐 구성이 다르다
    (장부는 숨김 `discard`를 세지 않고 `my_country`를 센다).
  - 레지스트리 ↔ UI 가이드 B.8 — 고유 ID 96 = 96, ID 차집합 0,
    **96개 ID 각각의 host 집합 불일치 0건**. 그룹 헤더 = 그룹 고유 ID 수
    (PageState 9 / 식재료 20 / 레시피·마스터 공용 17 / 고정 지출·발주 13 / 매출관리 22 / MY 15 = 96)
  - B.2~B.6 절 헤더 = 각 절 이름 목록 수 (27 / 28 / 14 / 2 / 15)
  - 숫자 스케일 밖은 프로토타입 셸 2종(`SPAN 11px` 상태바 시각, `route 10px` 화면 ID 배지)
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. `my_country`(MY-12)를 구현할지 명세에서 내릴지는
  제품 판단이 필요해 남겼다 — 현재 국가·통화 선택은 `popup:tax_country@my_tax`로만 도달한다.
  해시 기반 진입이 필요해지면 앱의 `history.replaceState` 정책을 먼저 바꿔야 하며,
  이번에는 계약에서 제외만 하고 앱 동작은 바꾸지 않았다.
- 결과: PASS
- 증거: 레지스트리 ↔ 장부 ↔ B.8 3자 차집합 대조 로그, PC·320px·320px 200% 확대 각 185건 결과,
  스텁 JS 켜짐/꺼짐 동작 대조, 변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT184.html`
- 지적 반영: Major(잔존 수치) APPLIED · Minor(스텁 폴백) APPLIED ·
  후속1(B.8 소계 재산출) APPLIED · 후속2(target 누락) APPLIED · 후속3(해시 계약 제외) APPLIED.
  반박 0건
- 지적 반영: Major(잔존 수치 2곳) APPLIED · Minor(스텁 폴백) APPLIED (반박 0건)

## DS-20260904-007 · PRT-185 문서 정정 (renderer 표기 사실 오류)

- 대상: UI 가이드 B.8 MY 절 2행(`tax_country`, `language_preview`), 이 장부의 판정 규칙과
  target 주석, 적용본 상단 동기화 표식 1줄.
  **적용본의 CSS·JS·마크업은 무변경이며 바뀐 것은 2행 주석뿐이다.**
  검수 범위 **총 185건 = 활성 182건(screen 61 + host 121) + 숨김 보존 3건**
- 기대값: B.8의 renderer 열이 적용본의 실제 렌더 경로와 일치해야 한다.
- 실제값: `PRT-184`가 두 행을 `미구현 — renderer 없음`으로 적었으나 사실이 아니었다.
  두 ID는 `openActualPopup()`의 popup map(HTML 995·998행)에 있고 1011행이
  `showPrototypeSheet()`로 렌더한다. `PickerSheet` / `FormSheet`로 정정했다.
  이 장부에는 세 신규 행의 `TODO` 사유가 **검수 미실시**임을 명시하고,
  판정 규칙에 `TODO`와 `SPEC_ONLY`를 섞지 않는다는 조항을 추가했다.
- PC 검수: `file:///…/0_full-page-flow-prototype-ui-applied.html` 1280×900, 185건 ·
  넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · 금지 굵기 렌더 0건 · PASS
- 모바일 검수: 같은 `file://` URL 320×720 185건, 320px 200% 확대 185건 ·
  각 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS.
  추가로 390×844에서 두 팝업을 직접 열어 확인 — `tax_country` `overlay.open=true` ·
  제목 `국가 선택` · 시트 본문 요소 23개 · 국가 5종 선택 렌더,
  `language_preview` `overlay.open=true` · 제목 `이렇게 보여요` · 시트 본문 요소 25개 ·
  3행 미리보기와 저장 확인 렌더. 대조군 `tax_item_add`(기존 `FormSheet` 표기)도 같은 경로로 렌더
- 측정: 적용본 diff는 2행 동기화 표식 1줄뿐이다
  (`DS-20260904-006` → `DS-20260904-007`). SHA-256은 `PRT-184`의
  `52daf602…e4081112`에서 `d0ff4d13…992e74c1`로 바뀌었고, 그 원인은 이 주석 1줄이다.
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 이번 단위는 renderer 표기 정정에 한정한다 —
  세 target(`tax_country`, `language_preview`, `fixed_period@my_fixed_edit`)의 개별 7항목
  검수는 이 장부 표의 `TODO`로 계속 추적하며 별도 회차에서 수행한다.
- 결과: PASS
- 증거: popup map 등록 위치(HTML 995·998행)와 렌더 호출부(1011행), 390×844 실렌더 결과 3건,
  PC·320px·320px 200% 확대 각 185건 결과, 적용본 1줄 diff
- 지적 반영: 사실 오류(renderer 표기) APPLIED. 반박 0건
- 재발 방지: 레지스트리·장부·가이드 어느 쪽의 **누락**도 구현 부재의 근거가 아니다.
  구현 여부는 popup map과 실렌더로만 판정한다.

## DS-20260904-008 · PRT-186 잔존 오류 정정 · 96개 ID 렌더 경로 전수 실측

- 대상: UI 가이드 B.8 검산 주석과 B.8a(신설), 이 장부의 판정 규칙과 신규 3행 주석,
  적용본 상단 동기화 표식 1줄. **적용본의 CSS·JS·마크업은 무변경.**
  검수 범위 **총 185건 = 활성 182건(screen 61 + host 121) + 숨김 보존 3건**
- 기대값: 정정한 사실이 문서 전체에서 일치해야 하고, target별 실행 경로가 각각 확인된
  근거 위에 서야 하며, 상태 코드가 원인별로 구분돼야 한다.
- 실제값: `PRT-185`가 B.8 표만 고치고 검산 주석의 "두 ID는 현재 renderer가 없어 열리지
  않는다"를 놓쳐 표와 본문이 모순됐다 — 문장을 삭제하고 정정 사실을 남겼다.
  신규 3행의 실행 경로를 한 문장으로 묶은 것도 틀렸다 — `fixed_period`는
  `openActualPopup` map에 없고 `openPopupTab()` 전용 분기(1051행)에서
  `openFixedPeriod()`(930행)로 간다. target별 표로 나눴다.
  `SPEC_ONLY`를 "렌더 없음"으로 일반화한 조항이 기존 정의와 충돌해 코드를 분리했다 —
  `TODO`(검수 미실시) / `SPEC_ONLY`(레지스트리에 키 없음, target 종류 무관, 현재 1건) /
  `NO_RENDERER`(등록됐으나 처리 분기 없음, 신설, 현재 0건).
  근거를 부분 표본에 두지 않도록 활성 96개 ID의 실행 경로를 전수 측정해 가이드 B.8a에 남겼다.
- PC 검수: `file:///…/0_full-page-flow-prototype-ui-applied.html` 1280×900, 185건 ·
  넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · 금지 굵기 렌더 0건 · PASS
- 모바일 검수: 같은 `file://` URL 320×720 185건, 320px 200% 확대 185건 ·
  각 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS.
  추가로 390×844에서 **활성 121쌍 / 고유 96 ID를 전부 URL로 직접 열어** 측정 · PASS
- 측정:
  - 렌더 경로 A(`openActualPopup` map → `showPrototypeSheet`) 61개 ·
    B(단일 ID 전용 분기 → `open*()`) 20개 · C(복합 조건 분기 → 상태 변경 + `render()`) 15개.
    **처리 분기가 없는 활성 ID는 0개다.**
  - 렌더 산출물 분포는 `DS-20260904-009`에서 재측정해 정정했다(아래 참조).
    시트 본문이 3요소 미만인 경우 0건
  - 적용본 diff는 2행 동기화 표식 1줄(`DS-20260904-007` → `-008`)
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 이번 단위는 문서 정정과 경로 실측에 한정한다.
  세 신규 target의 개별 7항목 검수는 표의 `TODO`로 계속 추적한다.
  (`DS-20260904-009` 정정: 이 회차가 `option_more`를 "현재 구현은 페이지 상태"라고
  적은 것은 틀렸다. `#overlay`만 보고 측정한 한계였다.)
- 결과: PASS
- 증거: 96개 ID 경로 분류 + 실렌더 로그, `openPopupTab` 원문 발췌(복합 조건 분기 15개 확인),
  PC·320px·320px 200% 확대 각 185건 결과, 적용본 1줄 diff,
  변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT186.html`
- 지적 반영: Major(가이드 잔존 모순) APPLIED · Minor1(`fixed_period` 경로) APPLIED ·
  Minor2(`SPEC_ONLY` 범위 충돌) APPLIED. 반박 0건
- 재발 방지: 정정은 낱말이 아니라 **주장 단위**로 훑어 같은 사실이 적힌 곳을 전부 고친다.
  표를 고치고 본문을 놓치면 문서가 스스로 모순된다. 경로·구현 여부는 target마다 확인한다.

## DS-20260904-009 · PRT-187 `option_more` 산출물 재측정 · 현행 인벤토리 정정

- 대상: UI 가이드 B.8a, 이 장부의 상단 요약·공통 계약 행·전체 target 서문·`DS-20260904-008`
  기록, 적용본 상단 동기화 표식 1줄. **적용본의 CSS·JS·마크업은 무변경.**
  검수 범위 **총 185건 = 활성 182건(screen 61 + host 121) + 숨김 보존 3건**
- 기대값: 렌더 산출물 분류가 실제 DOM과 일치하고, 이 장부의 현행 인벤토리 요약이
  레지스트리 실측과 일치해야 한다.
- 실제값: `DS-20260904-008`이 `option_more`를 "현재 구현은 페이지 상태"로 적었으나 틀렸다.
  `openOptionMore()`(HTML 926행)가 `.option-popover-layer`와 `role="menu"`인 `.option-popover`를
  만들어 `.phone`에 붙이는 **독립 Popover Layer**다. 주 `#overlay`만 탐지하는 측정의 한계였고,
  같은 가이드 부록 C(`layer:popover-wrapper`)가 이미 독립 DOM 생성을 기록하고 있었다.
  `.phone` 자식 노드까지 훑어 96개를 재측정하고 가이드 B.8a에 분포표를 넣었다.
  이 장부의 현행 요약 `screen 62 / host 120 / 고유 97`, 공통 계약 `97/97`,
  전체 target 서문 `screen 62 / host 120`을 현재 기준으로 정정했다.
- PC 검수: `file:///…/0_full-page-flow-prototype-ui-applied.html` 1280×900, 185건 ·
  넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · 금지 굵기 렌더 0건 · PASS
- 모바일 검수: 같은 `file://` URL 320×720 185건, 320px 200% 확대 185건 ·
  각 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS.
  추가로 390×844에서 활성 121쌍 / 고유 96 ID를 전부 열어 `.phone` 자식 노드까지 측정 · PASS
- 측정:
  - 렌더 산출물 — PageState(`#content`만 변경) **9개**(B.1과 정확히 일치) ·
    주 `#overlay` 기반 Layer **86개** · 독립 `.option-popover-layer` **1개**(`option_more`).
    **Layer 87 + PageState 9 = 96.** 시트 본문 3요소 미만 0건
  - `option_more`의 B.8 목표 분류 `PopoverMenu`는 현재 구현과 **일치**한다.
    "목표와 구현의 차이"라는 `DS-20260904-008`의 서술은 성립하지 않아 삭제했다
  - 이 장부 target 행 **183행 = 활성 182 + `screen:my_country`(SPEC_ONLY) 1**.
    레지스트리와 활성 182건 양방향 차집합 0
  - 적용본 diff는 2행 동기화 표식 1줄(`DS-20260904-008` → `-009`)
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 날짜가 붙은 과거 체크포인트 절의 수치는 그때의
  측정 기록이므로 고치지 않고 남겼다 — 현행 요약만 정정 대상이다.
  `option_more`의 독립 DOM이 공용 focus·닫기 계약과 분리된 문제는 부록 C
  `layer:popover-wrapper`로 계속 추적하며 이번 범위가 아니다.
- 결과: PASS
- 증거: 96개 ID 산출물 재측정 로그(`.phone` 자식 노드 포함), `openOptionMore()` 원문(926행),
  PC·320px·320px 200% 확대 각 185건 결과, 레지스트리 ↔ 장부 차집합 대조,
  변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT187.html`
- 지적 반영: Major(`option_more` 분류) APPLIED · Minor(현행 인벤토리) APPLIED. 반박 0건
- 재발 방지: **측정 도구의 탐지 범위가 곧 주장의 한계다.** 분류를 주장하기 전에 도구가
  무엇을 못 보는지 먼저 적는다. 새 절을 쓸 때 같은 대상을 다루는 기존 절을 먼저 읽는다 —
  부록 C가 답을 갖고 있었는데 B.8a가 모순된 결론을 적었다.

## DS-20260904-010 · PRT-188 렌더 감사 스크립트·원시 로그 보존 및 게이트 결속

- 대상: `full-page-flow-prototype-render-audit.mjs`(신설),
  `full-page-flow-prototype-render-audit.json`(신설),
  `full-page-flow-prototype-design-sync-check.ps1`(결속 검사 추가), UI 가이드 B.8a,
  적용본 상단 동기화 표식 1줄. **적용본의 CSS·JS·마크업은 무변경.**
  검수 범위 **총 185건 = 활성 182건(screen 61 + host 121) + 숨김 보존 3건**
- 기대값: 문서가 인용하는 렌더·회귀 수치를 제3자가 같은 명령으로 재현할 수 있어야 하고,
  증거가 어떤 판본의 적용본에 대한 것인지 기계적으로 확인돼야 한다.
- 실제값: `DS-20260904-008`·`-009`의 측정은 임시 환경의 일회성 스크립트였고 저장소에
  남지 않아 재현·검토가 불가능했다. 측정 스크립트와 target별 원시 로그를 저장소에
  보존하고, 결과 JSON의 `manifest`에 스크립트 SHA-256·적용본 SHA-256·동기화 ID·
  node/chromium 판본·뷰포트 정의를 담았다. `design-sync-check.ps1`이 이 셋을 현재
  파일에서 다시 계산해 대조하고 `noRendererIds`가 비면 통과시킨다. 두 파일도 봉인 해시
  대상에 넣었다. **보존 직후 초판 스크립트가 3건을 `none`으로 오분류하는 결함이 드러나
  판정 근거를 고쳤다** — 아래 측정 항목 참조.
- PC 검수: `file:///…/0_full-page-flow-prototype-ui-applied.html` 1280×900, 185건 ·
  넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · 금지 굵기 렌더 0건 · PASS
- 모바일 검수: 같은 `file://` URL 320×720 185건, 320px 200% 확대 185건 ·
  각 넘침 0 · 콘솔 오류 0 · 폰트 실패 0 · PASS.
  분류 측정은 390×844에서 185건 전수 · PASS
- 측정 (전부 보존된 `full-page-flow-prototype-render-audit.json`에서 인용):
  - `targetsMeasured` 185 = `activeTargets` 182(screen 61 + popup 쌍 121) + `hiddenTargets` 3
  - `activeUniquePopupIds` 96 — `renderKindByUniquePopupId`
    `overlay` 86 · `pageState` 9 · `independent` 1 · **`noRendererIds` 0건**.
    `pageState` 9건은 B.1의 9개와 정확히 일치
  - `sheetBodyUnder3` 0건
  - 뷰포트 3종(`pc` 1280×900 / `mobile320` 320×720 / `mobile320z2` 320×720 200%) —
    각 `overflow` 0 · `consoleErrors` 0 · `fontFailures` 0 · `bannedWeights` 없음 ·
    `offScale`는 프로토타입 셸 2종(`SPAN 11px`, `route 10px`)
  - 결속 — 스크립트 SHA `d51f3cea…b1d7450a` · 적용본 SHA `36a0074b…3b9b18a38c` ·
    동기화 ID `DS-20260904-010`. 게이트가 셋을 재계산해 대조하고 PASS
  - 실행 환경 — node v22.22.2 · chromium 141.0.7390.37 · linux
  - **초판 결함**: `ingredient_option_filled`·`stock_inbound`·`option_list` 3건을
    `none`으로 분류했다. PageState를 "`#content`가 host 기본 상태와 다른가"로 판정했는데
    이 셋은 host의 기본 상태 그 자체라 차이가 0이었다. 판정 근거를 `openPopupTab`의
    처리 분기 유무로 바꿔 고쳤고 같은 함정을 스크립트 주석에 남겼다.
    **보존하지 않았으면 드러나지 않았을 결함이다.**
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. 게이트는 DOM을 다시 재지 않는다 —
  그것은 node·playwright가 필요하며, 게이트가 검사하는 것은 **증거의 결속**이다.
  재측정 실행 자체의 자동화는 별도 판단으로 남긴다.
- 결과: PASS
- 증거: `full-page-flow-prototype-render-audit.mjs`(SHA `d51f3cea…`),
  `full-page-flow-prototype-render-audit.json`(target 185건 원시 로그 + manifest),
  게이트 실행 결과, 변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT188.html`
- 지적 반영: Minor(재측정 증거 보존) APPLIED. 반박 0건
- 재발 방지: **문서에 적는 측정값은 저장소에 보존된 산출물에서만 인용한다.**
  증거는 대상 파일 해시에 결속하고, 대상이 바뀌면 무효가 되게 한다.
  **측정 도구도 검증 대상이다** — 보존하면 검토받을 수 있고, 검토받으면 결함이 드러난다.

## DS-20260904-019 · PRT-198 대비 측정 신설 — 텍스트의 35.2%가 AA 미달

- 대상: 디자인 감사 스크립트(대비 축), 대비 수정안 스크립트·결과(신설), 동기화 검사
  스크립트, 기획서 §4.1a·§4.4·§8·§9, 네 감사 결과 JSON, 7문서 header/장부.
  **적용본 CSS·JS·마크업 무변경**
  검수 범위 **렌더 계약 185건 · 디자인 축 182건 · 글로벌 4패스 × 182건 · 대비 전 텍스트**
- 기대값: 색 결정을 막고 있던 대비를 재고, 실패 쌍마다 고칠 방향까지 낸다.
- 실제값: 재 보니 문제가 열린 결정보다 훨씬 컸다 — **텍스트 관측의 35.2%가 AA 미달**이고
  그중 3분의 2가 보조 글자 토큰 하나(`--ter` `#8B95A1`)에서 나온다.
  `D-1′` 의 두 색은 **문서 값이 코드 값보다 대비가 낫지만 둘 다 미달**이라,
  질문 자체가 "어느 쪽이냐" 가 아니라 "얼마나 진하게 하느냐" 로 바뀌었다.
  비활성 Primary 위 흰 글자는 **1.46:1** 로 사실상 읽을 수 없다 — 결함이다.
- PC 검수: 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 · `console.error` 0 ·
  폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS
- 모바일 검수: 320×720 · CSS 200% · 글자 200% 각 185건 PASS. 글로벌 4패스 각 182건
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 적용본 SHA `7b4064b1…6fc15728` · `DS-20260904-019`
  - 대비 — 34조합 / 20 실패 · 6,974관측 / **2,453(35.2%) 실패**
  - `--ter` 계열 1,621관측(실패의 66%) · 흰 글자 on Primary 173 · 비활성 Primary 3
  - `D-1′` — green 문서 3.39 vs 코드 2.72 · amberText 문서 4.00 vs 코드 3.02
  - 렌더 `violationCount` **5** · 매핑 미매핑 0 · atRisk 기준선 309건
- 미검수: 없음
- 제약: **AAA(7:1) 목표 여부와 비텍스트 대비(WCAG 1.4.11)는 아직 안 잰다.**
  `D-1′` 은 값이 나왔으므로 승인만 남았고, `D-2`·`D-11` 은 그대로 사람 결정이다.
- 증거: `full-page-flow-prototype-contrast-fix.json` · `-design-audit.json` ·
  `-i18n-stress.json` · `-render-audit.json` · `-token-map-check.json`
- 결과: PASS

## DS-20260904-018 · PRT-197 3차 검수 반영 — 결정 소유자 확정 · atRisk 8클래스 배정

- 대상: 기획서 §1.3·§6.9·§6.10·§8, 토큰 매핑표, 네 감사 결과 JSON, atRisk 잔여 목록,
  7문서 header/장부, 적용본 표식 1줄. **적용본 CSS·JS·마크업 무변경**
  검수 범위 **렌더 계약 185건 · 디자인 축 182건 · 글로벌 4패스 × 182건 · 매핑 전축**
- 기대값: `atRisk` 106건의 정체를 문서에 내고, 결정마다 소유자를 가른다.
- 실제값: 페이블 `M-1` 이 정확했다 — `atRisk` 를 만들어 놓고 그 결과를 "불확실성" 으로만
  다뤘고, 106건이 무엇인지 문서 어디에도 없었다. 클래스로 묶으니 8클래스로 정리됐고
  그중 `sales-menu-sub`(30건 최대 36.9px)가 가장 위험했다 — 한국어 채널명이 2글자라
  성립하던 열거형 요약이다. 문단 3~6px 넘침은 줄바꿈이 아니라 좌우 여백 문제였다.
  솔 3차가 결정별 소유자를 판정해 주어 넷을 닫고 셋을 남겼다.
- PC 검수: 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 · `console.error` 0 ·
  폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS
- 모바일 검수: 320×720 · CSS 200% · 글자 200% 각 185건 PASS. 글로벌 4패스 각 182건
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 적용본 SHA `8585427c…1be664d7` · `DS-20260904-018`
  - 렌더 `violationCount` **5** = `KD-001` 4 + `KD-002` 1
  - `atRisk` — `w130` 106건 / 8클래스 · `w150` 302건 / 14클래스. 기준선 309건 재등록
  - 매핑 — 미매핑 0 · 표 오류 0 · 낡은 항목 0 · 확정 축 `space`·`radius`·`typeSize`
  - 열린 결정 — 7건 → **3건**(`D-1′` · `D-2` · `D-11`). 넷은 닫았다
- 미검수: 없음
- 제약: **남은 3건은 사람의 결정이라 솔라가 진행할 수 없다.**
  `D-1′` 은 대비 측정이, `D-11` 은 정본 소유자 승인이, `D-2` 는 제품 판단이 선행이다.
  `P1a` 는 확정 축 셋에 대해서만 충족이고 `P2` 는 `P1b`(앱 감사기 개정) 완료 후다.
- 증거: `docs/디자인-토큰-3계층-값-매핑-기획서.md`,
  `full-page-flow-prototype-i18n-stress.json` · `-i18n-known.json` ·
  `-design-audit.json` · `-render-audit.json` · `-token-map.json` · `-token-map-check.json`
- 결과: PASS

## DS-20260904-017 · PRT-196 2판 재검수 반영 — 측정 파이프라인 정정 · 정본 확장 분리

- 대상: 글로벌 스트레스·디자인 감사 스크립트, 토큰 매핑표·검사기, atRisk 알려진 잔여
  목록(신설), 기획서 3판, 동기화 검사 스크립트, 네 감사 결과 JSON, 7문서 header/장부.
  **적용본 CSS·JS·마크업 무변경**
  검수 범위 **렌더 계약 185건 · 디자인 축 182건 · 글로벌 4패스 × 182건 · 매핑 전축**
- 기대값: 솔 재검수 Major 7 · Minor 1 을 전건 반영하고, 고친 파이프라인에서도 렌더 계약
  위반은 이전과 같아야 한다.
- 실제값: 전건 반영, 반박 0건. 가장 아팠던 것은 **`w130t2` 의 오차·`atRisk` 를 글자 확대
  전에 재고 있었다**는 것이다. 두 변형이 겹친 결과를 재겠다고 만든 패스에서 하나만
  적용된 상태를 쟀다. 고치고 나서 재 보니 그 패스에서는 **폭 오차 모델 자체가 성립하지
  않았다** — 글자가 커지면 폭이 아니라 줄이 늘기 때문이다(6,986개 중 6개만 ±1%).
  그래서 그 패스는 오차를 아예 재지 않고 직접 관측한 잘림·넘침으로만 판정하게 했다.
  매핑표가 `tokens.ts` 에 없는 값을 `primitive` 에 적고 있었던 것도 확인했다 —
  `space` 는 코드가 4~24 이고 `radius.sm` 은 8 이다.
- PC 검수: 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 · `console.error` 0 ·
  폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS
- 모바일 검수: 320×720 · CSS 200% · 글자 200% 각 185건 PASS. 글로벌 4패스 각 182건
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 적용본 SHA `7d262c3e…3784efdc1` · `DS-20260904-017`
  - 렌더 `violationCount` **5** = `KD-001` 4 + `KD-002` 1
  - 글자 확대 `text2x` 8,531 적용 · `text2xMismatched` **0**
  - `atRisk` — `w130` 106 · `w150` 302(host 합계 판정으로 332 → 302) · `w130t2` 재지 않음
  - atRisk 알려진 잔여 목록 **309건** 등록, 적용본 SHA 에 결속
  - 색 출처 — `author` 8,069 · `inherited` 2,718 · `inline` 61 · **`ua` 0**
  - 매핑 — 미매핑 0 · 표 오류 0 · 낡은 항목 0 ·
    확정 축 `space`·`radius`·`typeSize` · 정본 확장 필요 5축
- 미검수: 없음
- 제약: **열린 결정 7건 중 셋은 사람의 결정이다** — `D-1`(색 정본 방향과 대비 목표값),
  `D-2`(글자 확대 보상 수단), `D-11`(`tokens.ts` 확장 승인). 솔라가 정할 수 없다.
  `P1a` 는 확정 축 셋에 대해서만 충족이고, `P2` 는 `P1b` 완료 후 시작한다.
- 증거: `full-page-flow-prototype-i18n-stress.json` · `-i18n-known.json` ·
  `-design-audit.json` · `-render-audit.json` · `-token-map-check.json`,
  다섯 스크립트와 동기화 검사 스크립트
- 결과: PASS

## DS-20260904-016 · PRT-195 값 매핑 기획서 2판 — 검수의 값 결정 지적 반영

- 대상: 값 매핑 기획서 2판, 글로벌 스트레스 스크립트(탭 라벨 여유율 측정 추가),
  세 감사 결과 JSON·매핑 검사 결과, 현재 확정안·UI 가이드·실행서 header ID,
  changelog, 맥락 장부, 적용본 표식 1줄. **적용본 CSS·JS·마크업 무변경**
  검수 범위 **렌더 계약 185건 · 디자인 축 182건 · 글로벌 4패스 × 182건 · 매핑 전축**
- 기대값: 검수 지적 중 값 결정에 관한 여섯 건을 전건 반영하고, 문서가 인용하는 모든 수치가
  보존된 산출물에서 나와야 한다.
- 실제값: 여섯 건 전부 반영했고 반박 0건. 초판에서 여섯 가지를 철회했다 —
  뱃지 `12px` 신설, 탭 라벨 확대 상한, `header.small` 숨김, `nudge` 스케일,
  "그림자는 새로 만들 것이 없다", `P1` 단일 범위. 그리고 초판이 즉석 스크립트로 낸
  탭 라벨 여유율을 **보존 측정으로 옮겼다.**
- PC 검수: `file:///…` 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 ·
  `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS
- 모바일 검수: 320×720 · CSS 200% · 글자 200% 각 185건 PASS.
  글로벌 4패스 각 182건, 디자인 축 182건 390×844
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 적용본 SHA `4379cf6e…9749929` · `DS-20260904-016`
  - 렌더 `violationCount` **5** = `KD-001` 4 + `KD-002` 1
  - 매핑 검사 — 미매핑 **0** · 매핑표 오류 **0** · 낡은 항목 **0** (`PROVISIONAL`)
  - 탭 라벨 여유율 — `식재료`·`레시피` 89.8% · `발주` 184.6% · `매출관리` **42.4%** ·
    `MY` 212%. 탭당 64px · 모두 `nowrap` 13px · 탭바 60px
  - 글로벌 — `base` 잘림 0 · `atRisk` `w130` 106 · `w150` 332 · `w130t2` 182 target
- 미검수: 없음
- 제약: **열린 결정 6건은 여전히 열려 있다** — `D-1`(색 정본·목표값, 대비 검산 선행),
  `D-2`(확대 보상 수단, `header.title` 2줄이 161px 을 흡수하는지 미측정),
  `D-7`(상속 `bolder` 188건의 굵기), `D-8`(행간 단계), `D-9`(그림자 `bottomBar`·
  `sliderThumb`), `D-10`(범위 분할 승인). `P1b`·`P1c` 는 측정기 확장이 선행이다.
  **`P1a` 만 현재 충족 상태다.**
- 증거: `docs/디자인-토큰-3계층-값-매핑-기획서.md`,
  `full-page-flow-prototype-token-map.json` · `-token-map-check.json`,
  `-design-audit.json` · `-i18n-stress.json` · `-render-audit.json`
- 결과: PASS

## DS-20260904-015 · PRT-194 독립 검수 반영 — UA 리셋 정정(P0) · 측정기 3종 개정

- 대상: 적용본 CSS 2줄, 디자인 감사·글로벌 스트레스 스크립트 개정, 토큰 매핑표·검사기 신설,
  세 감사 결과 JSON, 동기화 검사 스크립트, 현재 확정안·UI 가이드·실행서 header ID,
  changelog, 맥락 장부, 적용본 표식. **적용본 마크업·JS 무변경, CSS 2줄 변경(UI 변경 있음)**
  검수 범위 **렌더 계약 185건 · 디자인 축 182건 · 글로벌 4패스 × 182건 · 매핑 전축**
- 기대값: 두 독립 검수의 지적 중 **측정 단위에 관한 것**을 전건 반영하고, 고친 뒤 다시 재도
  렌더 계약 위반은 이전과 같아야 한다(`KD-001` 4 + `KD-002` 1).
- 실제값: 지적이 정확했다. 반박 0건.
  - 간격 관측 18,401 중 **1,804(9.8%)가 작성자가 고른 값이 아니라 브라우저 기본값**이었다.
    `.expo-more` 는 `<button>` 인데 padding 선언이 없어 Chrome 기본 `1px 6px` 가 올라왔고,
    그 두 값이 내가 만들려던 "광학 보정 스케일" 의 최대 항목이었다.
  - 간격 키에서 변을 버린 탓에 `.edit-form-label{margin:0 2px 7px}` 의 2px 을 세로 보정으로
    잘못 읽었다. 실제로는 좌우다.
  - 행간을 집계에서 버려, **타이포 관측의 84.7%가 브라우저 기본 `normal`** 이라는 사실이
    보이지 않았다. 같은 역할이 두 값을 갖는다.
  - 덜 늘어난 요소의 "잘림 0" 을 보수적이라고 적었는데 **반대다.** `atRisk` 판정을 넣자
    `w130` 106건 · `w150` 332건이 드러났고, 그중 하단 탭 라벨 `매출관리` 는 15.6px 모자란
    채 여유가 0이었다 — 페이블이 손으로 짚은 모순이 도구 안에서 재현됐다.
- PC 검수: `file:///…` 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 ·
  `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS
- 모바일 검수: 320×720 · CSS 200% · 글자 200% 각 185건 PASS.
  글로벌 4패스 각 182건, 디자인 축 182건 390×844
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 적용본 SHA `9e1d4a5d…737c1b36` · `DS-20260904-015`
  - **UA 리셋 정정 확인** — `rgb(239,239,239)` 배경 47회와 검정 2px 테두리 47회 소멸.
    남은 `rgb(0,0,0)` 30회는 `<input type=checkbox>` 상속 색(렌더 영향 없음)
  - 렌더 `violationCount` **5** = `KD-001` 4 + `KD-002` 1 — CSS 변경에도 회귀 0
  - 간격 출처 author 16,471 · ua 1,804 · inline 126.
    author 기준 1px **953→31** · 6px **1,098→368**
  - 행간 18종, `normal` 5,908회(84.7%) · 자간 2종
  - 컨트롤 shell 승격 — `h21` 83→3 · `h20` 207→192(허용 예외 `28×20` 만 잔존)
  - 글로벌 오차 분포(`w130`) ±1% 안 **6,830/6,986(97.8%)** ·
    `underStretched` 106 · `atRisk` **106**
  - 매핑 검사 — 미매핑 **0** · 매핑표 오류 **0** · 낡은 항목 **0** (`PROVISIONAL`)
  - 결속 — 디자인 감사 스크립트 · 글로벌 스트레스 스크립트 · 매핑 검사기 3종 모두
    적용본 SHA 와 동기화 ID 에 결속. 실행 환경 node v22.22.2 · playwright 1.62.1 ·
    chromium 141.0.7390.37 · linux
- 미검수: 없음
- 제약: **값 결정에 관한 검수 지적은 이 회차에서 처리하지 않는다.** 뱃지 `12px` 신설과
  가이드 `captionSm 13/600` 계약의 충돌, 하단 탭 라벨 확대 상한과 WCAG 1.4.4,
  `P1` 범위 분할, 그림자 `bottomBar`, 열린 결정이 본문에서 확정으로 쓰인 문제 —
  전부 기획서 개정 회차에서 다룬다. 이 회차는 **측정 단위를 바로잡는 것까지**다.
- 증거: `full-page-flow-prototype-design-audit.json` · `-i18n-stress.json` ·
  `-render-audit.json` · `-token-map-check.json`, 네 스크립트와 동기화 검사 스크립트
- 결과: PASS

## DS-20260904-014 · PRT-193 글로벌 스트레스 측정기 정정 — `PRT-192` 결론 철회

- 대상: 글로벌 스트레스 스크립트(정정), 세 감사 결과 JSON(새 ID 재측정),
  현재 확정안·UI 가이드·실행서 header ID, changelog, 맥락 장부,
  적용본 상단 동기화 표식 1줄. **적용본의 CSS·JS·마크업은 무변경.**
  검수 범위 **렌더 계약 185건 · 디자인 축 182건 · 글로벌 스트레스 182건 × 4패스**
- 기대값: `PRT-192` 가 보고한 "+30% 번역에서 탭바 라벨 182/182 잘림" 이 재현돼야 한다.
- 실제값: **재현되지 않았고, 재현되면 안 되는 것이었다.** 손으로 다시 재 보니 탭 라벨의
  실제 여유는 `매출관리` 42% · `식재료`·`레시피` 90% · `발주` 185% · `MY` 212% 로,
  +30% 번역은 다섯 라벨 모두 들어간다. `PRT-192` 의 확대기가 글자를 통째로 붙여
  목표를 넘는 순간 멈추는 방식이라 **마지막 한 글자만큼 넘쳤다** — 4글자 라벨에
  +30%(58.5px)를 요구했는데 실제로는 67.4px(+49.8%)가 됐다. 짧은 문자열일수록 오차가
  커지는데 UI 에서 가장 빡빡한 자리가 바로 짧은 라벨이라, **측정기 오차가 가장 큰 곳과
  제품 위험이 가장 큰 곳이 정확히 겹쳤다.**
  정정 과정에서 두 가지를 더 발견했다 — 채움 span 을 따로 붙이는 방식은 부모가 flex 인
  자리에서 그 span 이 새 flex 아이템이 되어 `gap` 까지 얻어 오차가 300% 로 튀었고,
  `getBoundingClientRect()` 로 잰 텍스트 폭은 두 줄에 걸치면 컨테이너 폭을 돌려줘
  54px→118px 로 뛴 것처럼 보였다. `[L7]`·`[L8]` 로 주석에 남겼다.
- PC 검수: `file:///…` 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 ·
  `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS
- 모바일 검수: 320×720 4패스 각 182건 · 기준선 잘림 0 · 이탈 0 · 가로 넘침 0 · PASS.
  render-audit 의 320×720 · CSS 200% · 글자 200% 185건도 이전과 동일하게 PASS
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 확대 정확도 — 6,986개 중 **6,190개(88.6%) 정확**, 최대 오차 **23.08%**
    (오차는 대부분 "덜 늘림" 쪽이므로 결과는 보수적이다)
  - `base` 잘림 0 · 이탈 0 · 넘침 0
  - **`w130`(번역 +30%) 잘림 0** — 번역이 30% 길어지는 것만으로는 아무 데도 안 깨진다
  - `w150`(+50%) 잘림 **1종** — `expo-row-copy.strong` 1곳 4px
  - `w130t2`(+30% & 글자 200%) 잘림 **9종** — `app-tab-label` 182곳(48px) ·
    `header.title` 47곳(232px) · 나머지 7종 각 1~3곳
  - 붙는 쌍 `w130` 0 · `w150` 0 · `w130t2` 3종
  - 렌더 `violationCount` **5** = `KD-001` 4 + `KD-002` 1
  - 결속 — i18n 스크립트 SHA `bcabd4d5…` · 디자인 감사 `0d363d3a…c95c3dcdc` ·
    렌더 감사 `954d0ab0…f3ac3314` · 적용본 SHA `2ea86cfa…8473b0ba` · `DS-20260904-014`
  - 실행 환경 — node v22.22.2 · playwright 1.62.1 · chromium 141.0.7390.37 · linux
- 미검수: 없음
- 제약: 이 회차는 정정만 한다. 정정된 결론이 바꾸는 것은 **컴포넌트 계약의 축**이다 —
  필요한 것은 "번역 길이 제한" 이 아니라 **"글자 확대 시 무엇을 키우고 무엇을 고정하는가"**
  이며, 이는 `KD-001` 과 같은 축이다. 그 계약은 토큰 기획서에서 독립 검수를 거쳐 확정한다.
- 증거: `docs/prototypes/full-page-flow-prototype-i18n-stress.json`,
  `full-page-flow-prototype-design-audit.json`, `full-page-flow-prototype-render-audit.json`,
  세 스크립트와 `full-page-flow-prototype-design-sync-check.ps1`
- 결과: PASS

## DS-20260904-013 · PRT-192 글로벌 스트레스 측정기 보존 · 게이트 결속

- 대상: 글로벌 스트레스 스크립트(신설)·결과 JSON(신설), 렌더·디자인 감사 결과 JSON(새 ID 재측정),
  동기화 검사 스크립트, 현재 확정안·UI 가이드·실행서 header ID, changelog, 맥락 장부,
  적용본 상단 동기화 표식 1줄. **적용본의 CSS·JS·마크업은 무변경.**
  검수 범위 **렌더 계약 185건(활성 182 + 숨김 3) · 디자인 축 182건 · 글로벌 스트레스 182건 × 4패스**
- 기대값: 한국어 320px 기준선이 깨끗하고, 번역이 30~50% 길어졌을 때 어디가 먼저 무너지는지가
  요소 단위로 나와야 한다. 표식 1줄만 바뀌었으므로 렌더 계약 위반은 이전 회차와 동일해야 한다.
- 실제값: 기준선은 잘림·이탈·넘침 모두 0으로 깨끗했고, 번역 스트레스에서 깨지는 요소는 11종이었다.
  렌더 계약 위반은 이전과 동일한 5건. 측정 과정에서 자기 결함 3건을 드러냈다 —
  (가) `붙음`을 "flex 형제 간격 4px 미만"으로 절대 판정해 한국어 기준선에서 182개 중 181개가
  걸렸다. `.header` 의 아이콘 상자처럼 **원래 붙어 있는 것이 설계**인 쌍과 `flex-wrap` 으로
  **줄이 바뀐** 쌍(간격 −176px)이 섞여 있었다. 같은 줄·둘 다 글자를 가진 쌍만 보고
  **기준선 대비 좁아졌는지**를 재도록 바꿨다. (나) 가로 스크롤 컨테이너 예외를 `잘림` 에만
  적용하고 `이탈` 에 빠뜨려 `.tabs`·`.recipe-filters` 의 자식이 기준선에서도 이탈로 잡혔다.
  (다) 잘림을 target 단위로만 세니 탭바 라벨 하나 때문에 182개 전부가 "잘림 있음" 이 됐다.
  셋 다 정정하고 스크립트 주석 `[L4]`~`[L6]` 에 남겼다.
- PC 검수: `file:///…` 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 ·
  `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS
- 모바일 검수: 320×720 4패스 각 182건(`base` · `w130` · `w150` · `w130t2`) ·
  기준선 잘림 0 · 이탈 0 · 가로 넘침 0 · PASS.
  render-audit 의 320×720 · CSS 200% · 글자 200% 185건도 이전과 동일하게 PASS
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 늘린 텍스트 6,986개 · 숫자 제외 958 · 아이콘 제외 889 · 글자 200% 적용 8,531개
  - ~~여유 등급 — `+30%에서 깨짐` 1종 · `+50%에서 깨짐` 3종 · `+30%와 글자200% 겹칠 때만` 7종~~
    **→ `DS-20260904-014` 정정: `+30%` 0종 · `+50%` 1종 · `+30%와 글자200%` 9종**
  - ~~**`app-tab.app-tab-label` +30% 에서 182/182 target 잘림, 최대 71px**~~
    **→ `DS-20260904-014` 철회. 측정기 결함. +30% 에서는 잘리지 않는다**
  - ~~`header.title` +50% 1건 → 글자 200% 겹치면 51건, 최대 234px~~
    **→ `DS-20260904-014` 정정: +50% 0건, 글자 200% 겹칠 때 47건, 232px**
  - 붙는 쌍 — `w130` 0종 · `w150` 0종 · `w130t2` 3종
    (`.month span>span` 8곳 179px→0 · `.change-overview-head strong>b` 4곳 159px→0 ·
    `.expo-card-foot b>span` 2곳 117px→0)
  - 렌더 — `violationCount` **5** = `KD-001` 4 + `KD-002` 1, 알려진 목록과 정확히 일치
  - 결속 — i18n 스크립트 SHA `7770fc19…1a269e27` · 디자인 감사 `0d363d3a…c95c3dcdc` ·
    렌더 감사 `954d0ab0…f3ac3314` · 적용본 SHA `9897bd0a…5a0ee572` · `DS-20260904-013`
  - 실행 환경 — node v22.22.2 · playwright 1.62.1 · chromium 141.0.7390.37 · linux
- 미검수: 없음
- 제약: **이 회차도 측정만 한다.** 탭바 라벨의 번역 길이 계약, `header.title` 의 말줄임 계약,
  번역되지 않는 고유명사 슬롯의 줄바꿈 허용 여부는 모두 디자인 결정이므로 솔라가 임의로 정하지
  않고 토큰 3계층 기획서에서 독립 검수를 거쳐 확정한다.
  `w130t2` 의 글자 200% 는 문자 기호 아이콘을 키우지 않으므로 render-audit 의 `mobile320t2` 와
  같은 계약이 아니다. `KD-001` 은 render-audit 쪽에서만 잡힌다.
- 증거: `docs/prototypes/full-page-flow-prototype-i18n-stress.json`(4패스 · target 182),
  `full-page-flow-prototype-design-audit.json`(축 8종), `full-page-flow-prototype-render-audit.json`,
  세 스크립트와 `full-page-flow-prototype-design-sync-check.ps1`
- 결과: PASS

## DS-20260904-012 · PRT-191 디자인 축 8종 전수 측정기 보존 · 게이트 결속

- 대상: 디자인 감사 스크립트(신설)·결과 JSON(신설), 렌더 감사 결과 JSON(새 ID 재측정),
  동기화 검사 스크립트, 현재 확정안·UI 가이드·실행서 header ID, changelog, 맥락 장부,
  적용본 상단 동기화 표식 1줄. **적용본의 CSS·JS·마크업은 무변경.**
  검수 범위 **렌더 계약 185건(활성 182 + 숨김 3) · 디자인 축 측정 182건(활성만)**
- 기대값: 토큰 기획서가 인용할 모든 수치가 보존된 스크립트의 출력에서 나오고, 그 출력이
  적용본 SHA·동기화 ID·스크립트 SHA 에 묶여 게이트가 재확인할 수 있어야 한다.
  표식 1줄만 바뀌었으므로 렌더 계약 위반은 이전 회차와 동일해야 한다.
- 실제값: 축 8종을 전수 측정했고 렌더 계약 위반은 이전과 동일한 5건이었다.
  측정 과정에서 자기 결함 1건을 드러냈다 — `margin:auto` 를 "40px 초과 또는 정수 아님"
  이라는 크기 휴리스틱으로 걸렀는데, 이는 값의 출처가 아니라 크기를 보는 것이라
  진짜 `padding:44px` 인 `.callout` 27건까지 함께 날렸다. 스타일시트 선언값 조회로
  바꿔 `auto` 인 변만 484건 제외했고, 스크립트 주석 `[L1]`·`[L2]` 에 남겼다.
- PC 검수: `file:///…` 1280×900 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 ·
  `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기(선언·computed) 0 · PASS
- 모바일 검수: 같은 URL 320×720 185건, CSS 200% 확대 185건, 글자만 200% 확대 185건 ·
  각 미처리 예외 0 · `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS.
  디자인 축 측정은 390×844 활성 182건 전수
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 렌더 — 185 = 활성 182 + 숨김 3, `duplicateTargets` 0, 활성 고유 ID 96
    (`overlay` 86 · `pageState` 9 · `independent` 1 · `noRendererIds` 0),
    `violationCount` **5** = `KD-001` 4 + `KD-002` 1 로 알려진 목록과 정확히 일치
  - 디자인 축 — target 182, `margin:auto` 제외 484
  - 타이포 333종 / 6,974회. **카드×슬롯 268조합 중 38조합이 한 카드 안에서 갈린다**
    (`.card span` 17 · `.card b` 10 · `.card strong` 5 · `.card small` 5).
    `.expo-pick-card strong` 은 44회 모두 16px/800 로 단일
  - 간격 685관계 / 18,449회. 고유값 25개, **`space` 스케일 안 6,146회(33.3%) ·
    밖 12,303회(66.7%)**. 상위 이탈 14px 1,987 · 15px 1,430 · 10px 1,288 · 2px 1,104
  - 색 40종 / 10,907회 (text 12 · bg 19 · border 9)
  - 반경 20값 / 2,466회 (12px 739 · 16px 406 · 6px 356 · 3px 185 · 10px 180 · 999px 61)
  - 그림자 6종 / 405회 (`0 1px 3px rgba(0,0,0,.04)` 366회가 카드 기본)
  - 컨트롤 높이 39값 / 2,158회 · 터치 44px 미만 65종 / 829회 · 아이콘 17종 / 697회
  - 결속 — 디자인 감사 스크립트 SHA `0d363d3a…c95c3dcdc` ·
    렌더 감사 스크립트 SHA `954d0ab0…f3ac3314` ·
    적용본 SHA `971f2c7a…9c1ca0` · `DS-20260904-012`
  - 실행 환경 — node v22.22.2 · playwright 1.62.1 · chromium 141.0.7390.37 · linux
- 미검수: 없음
- 제약: 이 회차는 **측정만 한다.** 38개 갈린 타이포 조합·스케일 밖 간격 66.7%·반경 20값·
  컨트롤 높이 39값을 어느 역할로 묶을지는 디자인 결정이므로 솔라가 임의로 정하지 않고
  토큰 3계층 기획서에서 독립 검수를 거쳐 확정한다. `KD-001`·`KD-002`·`my_country` 는 계속 대기.
- 증거: `docs/prototypes/full-page-flow-prototype-design-audit.json`(축 8종 전수),
  `docs/prototypes/full-page-flow-prototype-render-audit.json`(패스 4종 · target 185),
  두 스크립트와 `full-page-flow-prototype-design-sync-check.ps1`
- 결과: PASS

## DS-20260904-011 · PRT-189 감사 검사기 6개 결함 정정 · 알려진 미해결 목록 신설

- 대상: 렌더 감사 스크립트(전면 개정), 결과 JSON, `full-page-flow-prototype-render-audit-known.json`(신설),
  동기화 검사 스크립트, 루트 `package.json`·`pnpm-lock.yaml`, UI 가이드 B.8a, 현재 확정안 2.14,
  적용본 상단 동기화 표식 1줄. **적용본의 CSS·JS·마크업은 무변경.**
  검수 범위 **총 185건 = 활성 182건(screen 61 + host 121) + 숨김 보존 3건**
- 기대값: 검사기의 지표 이름이 실제 계약과 일치하고, 게이트가 결속뿐 아니라 결과 내용까지
  단언하며, 재현 명령이 현재 checkout에서 그대로 실행돼야 한다.
- 실제값: 검사기가 계약보다 좁게 재고 있었다. `zoom`은 CSS 전체 확대라 글자 확대 계약을
  측정하지 못했고, `pageerror`만 구독하면서 `consoleErrors`로 보고했으며, `<input value>`와
  선언 굵기 `900`을 안 봤고, `fonts.ready`는 대체 글꼴 정착도 통과시켰다. 게이트는 결속만
  확인해 실패한 결과도 봉인할 수 있었고, `playwright`가 저장소에 없어 재현 명령이 안 돌았다.
  여섯 건을 모두 고쳤다 — 패스 분리(`cssZoom2`/`textOnly2`) + viewport 경계 이탈 측정,
  `pageErrors`/`consoleErrors` 분리, 입력값·contenteditable 포함과 선언/computed 굵기 분리,
  face 명시 적재 후 `fonts.check()`와 실측 폭 구분, 게이트의 산식·중복·패스·위반 양방향 대조,
  `playwright 1.62.1` lockfile 고정과 `pnpm prototype:audit`.
- PC 검수: `file:///…` 1280×900, 185건 · 넘침 0 · viewport 이탈 0 · 미처리 예외 0 ·
  `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기(선언·computed) 0 · PASS
- 모바일 검수: 같은 URL 320×720 185건, CSS 200% 확대 185건, **글자만 200% 확대 185건** ·
  각 미처리 예외 0 · `console.error` 0 · 폰트 실패 0 · face 단언 실패 0 · 금지 굵기 0 · PASS.
  분류 측정은 390×844 185건 전수
- 측정 (전부 보존된 결과 JSON에서 인용):
  - 185 = 활성 182 + 숨김 3, `duplicateTargets` 0
  - 활성 고유 ID 96 — `overlay` 86 · `pageState` 9 · `independent` 1 · `noRendererIds` 0
  - face 실측 폭 `400 1472.38 / 600 1492.48 / 700 1502.55 / 800 1512.89` — 넷 다 구분,
    `fonts.check` 400·600·700·800 전부 true
  - `violationCount` **5** = `KD-001` 4건 + `KD-002` 1건, 알려진 목록과 정확히 일치
  - 스케일 밖은 허용 목록(`SPAN 11px`, `route 10px`)뿐
  - 결속 — 스크립트 SHA `954d0ab0…f3ac3314` · 적용본 SHA `8e65d680…c64888e24` · `DS-20260904-011`
  - 실행 환경 — node v22.22.2 · playwright 1.62.1 · chromium 141.0.7390.37 · linux
  - **개정 검사기가 자기 결함 3건을 더 드러냈다** — face 지연 로드로 26개 화면 오탐,
    가로 스크롤 컨테이너 안 요소를 이탈로 오계수, 글자 2배 패스에서 성립하지 않는 스케일 검사.
    셋 다 정정하고 스크립트 주석([L8]~[L10])에 남겼다.
- 미검수: 없음
- 제약: 실기기 캡처는 수행하지 않았다. **새로 찾은 진짜 결함 2건은 이 회차에서 고치지 않는다.**
  `KD-001`은 큰 글꼴에서 아이콘 글리프를 어떻게 다룰지가 디자인 결정이라 솔라가 임의로 정하지
  않는다. `KD-002`는 공용 Layer 래퍼로 옮기는 구조 변경이라 별도 회차다. 둘 다 원인·근거·
  판단 주체·추적처와 함께 알려진 미해결 목록에 등록했고 게이트가 양방향으로 대조한다.
- 결과: PASS
- 증거: `full-page-flow-prototype-render-audit.mjs`(SHA `954d0ab0…`),
  결과 JSON(target 185건 원시 로그 + manifest + violations),
  `full-page-flow-prototype-render-audit-known.json`, 게이트 실행 결과,
  변경 전 사본 `백업/0_full-page-flow-prototype-ui-applied_pre-PRT189.html`
- 지적 반영: F01(글자 확대) APPLIED · F02(console.error) APPLIED · F03(입력값·굵기 900) APPLIED ·
  F04(face 검증) APPLIED · F05(게이트 단언) APPLIED · F06(재현 명령) APPLIED. 반박 0건
- 재발 방지: **지표 이름이 계약을 정확히 말해야 한다** — 이름이 어긋나면 0이라는 숫자가
  거짓말을 한다. **통과 조건은 "실패가 없다"가 아니라 "알려진 실패와 정확히 일치한다"다.**
  검사기를 넓힐 때마다 새 결함이 나오며, 그것이 목적이다 — 나온 것은 덮지 말고 원인과
  판단 주체를 적어 목록에 남긴다.
