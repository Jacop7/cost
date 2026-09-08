# P3 발주 — 옵션 선택 안전 보정

- 대상: `7caebadcf7a2a13c1f32971f42375f8914b7280c`
- 기준: `62495ede24d166877df214172267c5a772c4af6a`
- 상태: **자체검수 PASS / Sol 내부검수 USAGE_LIMIT_BLOCKED / 배치 미종결**
- 화면: ORD-01 주문하기 시트. 발주 전체 레이아웃 적용 완료를 뜻하지 않는다.

## 변경과 증거

선택한 구매 옵션이 refetch에서 사라지면 기존 코드는 첫 옵션의 구매처·용량·금액으로
자동 대체할 수 있었다. 실제 화면·kit RNW/jsdom 시험으로 4개 중 1개 실패를 먼저 확인했다.
명시적으로 선택한 ID가 없어진 경우에는 발주 버튼을 비활성화하고 재선택을 안내한다.
처음 여는 경우의 첫 옵션 기본 선택은 유지하며 선택 표시·금액·payload가 같은 객체를 사용한다.
웹 버튼의 선택 상태는 `aria-pressed`로도 제공한다.

`ordersHomeParity.test.tsx` 5/5와 mobile typecheck PASS. 시험 범위는 서버 날짜 fixture,
3탭 건수·검색, E7 payload/성공 전후, 옵션 소실/재선택/동일 ID 갱신,
부분 입고 실패 재시도의 멱등키 유지다. 도메인 훅·RPC mutation·날짜·router·Alert와
native Modal을 격리했으며 실제 DB 저장·네이티브 조작·시각 회귀를 인증하지 않는다.
기존 앱 전체 568시험 결과를 이 커밋의 전체 재실행으로 승계하지 않는다.

## 검수 상태와 다음 행동

사용자 승인2026-09-09에 따라 일반 배치는 자체검수 뒤 별도 Sol high 검수·피드백 반영·재검수
PASS가 필수다. Astra는 공용 계약 변경 또는 Sol 미해결 반복 실패 등 고위험에만 추가하며,
단순 한도 우회를 위해 대체하지 않는다. Fable/Opus 공식검수·전체 게이트·네이티브 조건은 불변이다.

Sol에 위 exact SHA와 두 파일 diff, 관련 5시험의 읽기 전용 검수를 요청했으나 실행 서비스가
`You've hit your usage limit`을 반환했다. 검수 결과나 Findings가 생성된 것이 아니므로
PASS로 기록하지 않는다. 새 결제·usage reset·다른 모델 대체는 실행하지 않았다.
Sol 이용 가능 후 같은 제품 SHA를 재검수하고, 통과 뒤 발주 시각 작업을 이어간다.
새 발주 캡처 스크립트는 미추적 준비본이며 실행·검증 완료가 아니다.

## 재부팅 후 재개 — Sol 한도 복구

HEAD `1650a393ee8d22e95e06b44727c2aa5620dba61d`에서 Sol high가 제품 `7caebad`의
지정 두 파일 diff와 이후 동일성을 확인했다. 관련 5/5와 typecheck를 직접 실행해
**한정 PASS / Finding 없음**을 반환했다. 앞 usage-limit 차단은 해소됐으며 시각·네이티브·
실제 RPC/DB 또는 발주 전체 승인이 아니다. 주 작업자도 공용 탭 2개 포함 7/7을 재실행했다.
Docker 기존 8컨테이너와 8091 Expo를 복구했다. 볼륨 초기화·DB 쓰기는 수행하지 않았다.

첫 before 수집은 15패스 중 12개/15PNG, 주문 시트 3개 timeout으로 **FAIL**이다.
`before-20260909/orders-evidence.json`에 실패를 남겼다. 원인은 합성 ingredient_detail의
`last_change:null`이 실제 parseLastChange의 display_state 존재 계약을 깨뜨린 것.
브라우저 시트의 개발 오류 문구로 확인했고 `{display_state:null,has_history:false}`로
수집기 fixture만 고쳤다. 제품 결함 또는 정상 주문 시트 캡처로 인용하지 않는다.

## ORD-01 목록 공용화 후보 — ff626f0

기준 `2a7c68025a7af34462858fc3ffbecd0d340a2e89`, 제품
`ff626f03608f63091d6561f9f00d186be098171f`. 상태 탭을 기존 `ScrollTabs`로 교체하고
optional counts만 추가했다. 기존 글꼴·굵기·밑줄·선택색 토큰을 유지하며 탭 간격은 공용
space.lg로 수렴했다. 0건도 표시하며 접근성 이름은 전체 목록 건수와 결속된다.
counts 미지정 소비처는 불변이고 activeColors는 기존처럼 라벨/밑줄에만 적용한다.
건수 색은 공통 selectedText다. 세 카드의 배지 줄과 이름/기존 chevron 줄을 분리해
장문 이름을 생략하지 않는다. 짧은 이름도 배지 아래로 이동하는 의도된 세로 변화다.
헤더 검색 버튼으로 닫을 때 query도 지워 숨은 필터가 남지 않게 했다.
RPC·수량·금액·날짜·취소·저장 handler는 이 배치에서 변경하지 않았다.

- 자체검수: 관련 9/9, 전체 mobile **58파일 575/575**, typecheck PASS.
- Astra 공용 한정: ScrollTabs diff와 관련 3시험을 직접 실행해 **PASS / Finding 없음**.
  페이지 전체·실제 가로 스크롤·네이티브 승인은 아니다.
- Sol 페이지: 지정 제품 diff와 이후 동일성을 확인하고 관련 6/6을 직접 실행해 **한정 PASS**.
  유효75PNG 해시, candidate390/waiting·received320text2, 주문·입고 시트 전후,
  추가 하단 행동·마지막 탭 PNG를 확인했다. 신규 Finding 없음. 기존 시트 잔여는 다음 배치다.
- full verify·Fable/Opus·네이티브: 이 배치에서 미수행. 전체 ORD/P3 미종결.

증거 폴더: `docs/prototypes/three-surface-p3-orders-visual/`

| 폴더 | 원본 SHA | 조건/PNG | 결과 |
|---|---|---|---|
| before-20260909 | 1650a39 | 15패스 중12/15PNG | 주문3개 fixture 오류, 비교 제외 |
| before-valid-20260909 | 2a7c680 | 15/24PNG | errors0·blocked0 |
| after-headings-20260909 | ff626f0 | 15/24PNG | errors0·blocked0 |
| list-scroll-20260909 | d836949 (제품 ff626f0 동일) | 9/27PNG | errors0·blocked0 |

15패스는 후보·예정·완료·주문 시트·입고 시트 ×390/320/320글자2배이며 페이지 완료 수가 아니다.
합성 order_board/ingredient_detail과 나머지 로컬 읽기 응답을 출처/해시와 보존했다.
유효 세 묶음 75PNG 해시 일치, documentOverflow0. 추가9패스는 목록 마지막 action을
스크롤로 표시하고 마지막 상태 탭을 가로 스크롤한 뒤 rect가 viewport 안인지 확인한다
(lastTabReachability9/9true). 이는 실제 터치·전체 ancestor clipping 부재를 증명하지 않는다.
글자2배 근사는 초기 computed fontSize와 숫자 lineHeight를 두 배로 적용하며 mismatch0.

현재 확인한 다음 시트 배치 항목: 긴 부제가 고정 Sheet 헤더 공간을 차지함, 주문 옵션명
한 줄 생략, 320에서 수량/도착까지 2열, 입고 행동 1:2가 확정안 1:1과 다름.
이를 현행 화면의 불변 잔여로 남기며 목록 후보 PASS를 시트 전체 완료로 확장하지 않는다.

## 주문·입고 시트 후보 — 4f6b220

기준 제품 ff626f0, 후보 `c194fed`→`4f6b2200bb5516f5895ccd2e35c62a1272cd947d`.
공용 Sheet 자체는 변경하지 않았다. 긴 부제를 같은16/600 역할의 스크롤 본문 첫 줄로
옮기고 주문 옵션명의 한 줄 생략을 풀었다. 주문 수량/도착일까지 입력은 정상390 두 열을
보존하고 width<=320 또는 fontScale>1에서 세로로 놓는다. 네이티브 fontScale 분기는
mock dimensions로 시험한 것이며 실기기 실측이 아니다. 금액 영역은 글자가 커질 때 래핑한다.
입고 취소/확정은 확정안 ORD-01의1:1 규격을 따른다. 첫 후보는 두 버튼 높이가 달랐으므로
최종 후보에서 같은 row의 직접 자식 Button으로 배치해 폭과 높이를 맞췄다.
기존 버튼 kind·opacity·아이콘과 모든 저장/취소 handler·payload는 유지했다.

- 관련 실제 host 시험: **10/10**. 정상/좁은/큰폰트 입력 방향, 값 보존,1:1 flex,
  취소 시 mutation 없음 포함. 타입 PASS.
- 후보4f6b220 전체 mobile: **58파일579/579 PASS**. 전체 verify6/6 뜻 아님.
- `sheets-after-20260909`: c194fed,6pass15PNG errors0이나 버튼 높이 불일치로 최종 제외.
- `sheets-final-20260909`: 4f6b220,6pass15PNG,errors0·blocked0·documentOverflow0·해시15/15.
- Sol 한정 시트 검수: **PASS / 신규 Finding 없음**. 지정 두 파일 diff와 현재 HEAD46106aa까지
  제품 동일성, 실제 공용 Sheet 구조,10/10·타입 직접PASS를 확인했다. 전24/후15PNG 해시39/39,
  input hash,390/320text2 시작/끝을 직접 비교해 긴 부제·옵션·입력·버튼 도달을 확인했다.
  최종15PNG만 승인 근거이며 중간 c194fed는 사용하지 않았다.

직접 발주(orders/complete), 식재료/거래처 선택, 발주 취소·입고 취소·단가 급등 확인,
로딩/오류/빈값/다중 옵션·개별 키보드/실기기 경계는 이 시각 표본으로 완료 처리하지 않는다.
현재 README의 ORD-05/06 설명과 실제 OrdersHome 시트 경로는 전체 대상 대조 시 확인할
항목으로 남긴다. 직접 발주 페이지를 이 두 시트와 동일 화면이라고 가정하지 않는다.

## ORD-02 직접 발주·선택 팝업 — ddac890

제품 `ddac890394c6c72c3f98f64aa43adac1c2cc0971`, 이전 `6de607caa648a4ec542296be9406de1468e5e8bf`.
320px 글자2배 before에서 용량1000/금액28000 입력 문자열이 좁은3열 안에 잘리고 날짜5열은
오늘/내일이 음절별 줄바꿈됐다. 옵션명도 정상390에서 생략됐다. 기존 token/kit를 유지하며
width<=320 또는 fontScale>1에서는 입력3개를 세로, 날짜를40% basis의2/2/1열로 놓았다.
390/fontScale1의 입력1:1.2:0.8·날짜5열은 유지한다. 금액3행은 역할/값을 보존한 채 wrap하고
긴 옵션/식재료명 clamp를 제거했다. 식재료 선택은 중복 ScrollView를 없애 기존 Sheet의
본문 스크롤 하나를 사용한다. 구매옵션·거래처·서버 날짜·E7 payload/저장 handler는 불변이다.

- 실제 ORD-02 + kit + VendorPickerSheet host6/6·타입PASS, 전체mobile59파일585/585 PASS.
  hook/날짜/저장/Modal은 시험격리이며 실제 RPC·DB·native 검증이 아니다.
- before `direct-before-20260909`: 6de607c,12pass24PNG.
- after `direct-after-20260909`: ddac890,12pass24PNG. 같은 수집기/합성 옵션으로 전후 비교.
- 추가 `direct-inputs-20260909`: ff8306e(제품ddac890 동일),12pass33PNG. 수집기만 각 input
  accessible label로 스크롤하는 앵커를 추가했다. Metro는 제품ddac890에서 재시작한 상태다.
- 세 묶음81PNG 해시 일치, errors0·blocked0·documentOverflow0·fontFailures0·scaling mismatch0.
  직접 확인한320글자2배 개별 입력 샷에서1000g·28000원·3개가 완전히 보인다.
- Sol 최종 한정PASS / 신규 Finding 없음. 직접6/6·typePASS, 제품ddac890 이후 수집기만
  변경됐음을 확인했다.81/81PNG 해시와390/320text2 시작/끝·개별입력·두 picker를 직접
  확인했다. 저장/RPC handler·kit/token 불변이며 전체 ORD/native/실DB 승인은 아니다.

4phase(empty/picker/filled/vendor)×3조건은12페이지 완료가 아니다. 식재료/거래처 목록은
현재 local data이며 임의 장목록·전체 scroll/clipping·키보드·native는 미검증이다.
공용 거래처 추가/취소는 host만 확인했고 실렌더/실제 생성·실패는 이 묶음 밖이다.
식재료 변경 때 기존 vendor가 유지되는 것은 이전 handler와 동일하다. 자동옵션 거래처와
사용자 수동 거래처의 유지 정책을 구분하지 않고 이번 시각 배치에서 바꾸지 않았다.
발주·입고 취소 확인은 실제 Alert API/웹 브라우저 대화상자 경로이며 DOM 시트로 측정한
것이 아니다. 이를 후속 확인 없이 확인창 검수 완료로 기록하지 않는다.

## ORD-07 취소·급등 Alert 경계 — 39c61d5

`39c61d520fb0c819ba1db2a057fa44eeca380a17`는 제품 변경 없이 시험2파일만 보강했다.
OrdersHome 실제 host15건 중 신규5건은 발주 취소/입고 취소 확인 전·닫기 mutation0,
위험 행동 확인 후 exact ID, 서버 실패 안내, duplicate/priceSpike3조합을 확인한다.
별도 webAlertBridge4건은 실제 installWebAlert와 mock window.confirm/alert 연결에서
취소/확인 중 정확히 한 callback, 단일 알림, 중복 설치 방지를 확인한다.
Sol은 실제 제품 함수와 diff를 대조하고19/19·타입을 직접 재실행해 **한정PASS**했다.
주 작업자 전체 mobile 재실행은60파일594/594 PASS다. full verify6/6을 뜻하지 않는다.
브라우저 기본 대화상자 캡처·native·RPC/DB 시험 또는 공용 확인창 디자인 일치 승인이 아니다.

## 발주 target별 현재 검증 상한 / 다음 도메인 연결

39c61d5의 `surfaceRegistry.generated.json`은 발주6 surface/21 binding/고유16 target이다.
binding 중복을 페이지 완료 수로 세지 않는다. 아래는 현재 증거 범위이며 최종 종결표가 아니다.

| prototype target | 실제 Expo 경로·검증 상한 |
|---|---|
| screen:order_main | OrdersHome, 목록 before/after/스크롤 웹 + Sol PASS |
| popup:order_candidates@order_main | 후보 상태, 위 목록 증거 |
| popup:order_waiting@order_main | 입고 예정 상태, 부분입고/날짜/목록 증거 |
| popup:order_received@order_main | 입고 완료 상태, 목록 증거 |
| popup:order_order@order_main | OrdersHome 주문 Sheet,4f6b220 시각/host PASS |
| popup:order_receive@order_main | OrdersHome 입고 Sheet,4f6b220 시각/host PASS |
| popup:order_cancel@order_main | Alert API+web bridge 시험만, 실제 dialog 시각 미검증 |
| popup:order_revert@order_main | Alert API+web bridge 시험만, 실제 dialog 시각 미검증 |
| popup:order_price_spike@order_main | mock 서버 응답3조합+Alert API, 실제 dialog 미검증 |
| screen:order_direct | OrderCompleteScreen,ddac890 시각/host PASS |
| popup:order_ingredient@order_direct | 직접발주 내 식재료 Sheet,ddac890 표본/검색 host PASS |
| popup:order_vendor@order_direct | 직접발주 내 공용 VendorPickerSheet,표본/선택 host PASS |
| screen:order_detail | registry는 직접발주 route에 연결하지만 prototype 상세와 동등성 미확정 |
| popup:order_order@order_detail | OrdersHome Sheet 표본은 있으나 prototype의 별도 host 흐름 대조 필요 |
| screen:order_receive | OrdersHome 입고 Sheet 재사용 proxy,독립 screen 동등성 미확정 |
| popup:order_receive@order_receive | 위 proxy와 중복 binding,별도 host 검증을 가정하지 않음 |

ORD-06의 등록 source는 OrdersHome인데 실제 독립 VendorPickerSheet 소비처는
OrderCompleteScreen이다. 현재 레지스트리의 divergent 사유만으로 실제 렌더 경로가
입증되지 않는다. P4 카탈로그 연결 전에 README·declarations·생성물·fixture resolver를
함께 정정/검수해야 하며 여기서 새 구매처 선택 단계를 OrdersHome에 만들지 않는다.

다음 매출 도메인은 같은 registry 기준19 surface/43 binding/고유37 target이다.
우선 SALES-01/05b/06/07의 실제 홈·정렬·판매수량·기타매출·지출 Sheet를 읽고
쓰기 차단된 before 수집을 준비한다. 홈에는 이미 공용 SortChip/SortSheet와 토큰이 있으므로
새 필터/화살표를 만들지 않는다. SalesHome의 오래된 자동마감 주석과 달리 실제
useBusinessDay는 business_day_state 조회만 함을 소스로 확인했다. 실행 전 네트워크는
명시한 읽기 RPC만 허용하고 save_sale/영업전이/삭제는 차단해야 한다.
이 다음 작업 준비를 매출 화면 수정·검수 완료로 세지 않는다.
