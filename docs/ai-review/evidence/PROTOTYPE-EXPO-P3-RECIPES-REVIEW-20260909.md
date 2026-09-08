# P3 메뉴 첫 배치 — 내부 검수 및 전후 기록

날짜: 2026-09-09. 상태: 개발 후보 내부 검수 PASS, 공식 외부 검수 NOT_SENT.
P3 최종 종결·P4·병합·배포 승인이 아니다.

## 범위와 기준

레지스트리 recipes는13표면·49binding·49고유 prototype target(screen15+popup-host34)이다.
식재료44와 literal target 교집합0, 두 도메인 합집합93. RCP-07은 기존 연결표의 Expo-only였지만
PRT-131 제거 결정을 누락한 분류였다. 2026-09-09 사용자 지적으로 입력 UI를 폐기하고 옛 주소
호환 redirect만 남긴다(아래 정정). registry ID 보존은 기능 존속/완료의 근거가 아니다.
이는 연결 범위이지 완료 수가 아니다. 첫 제품 배치는 RCP-01과 연결된 목록·정렬·판매상태·목표
4target에 한정한다. 카탈로그는 같은 Expo sourceComponent를 소비하지만 별도 카탈로그 캡처는 미실행.

기준: 기존 Expo tokens/kit가 시각 권위, prototype은 배치 참조다. 사용자 최신 지시
“필터 공통 적용해야지”에 따라 Chip을 공용 FilterButton으로 바꾸었다. 최신순 추가·판매 상태
계산·서버 손익 재계산·저장/RPC·전역 토큰 변경은 하지 않았다.

## 전후 변경

| 부분 | 이전 | 이후 / 소유권 |
|---|---|---|
| 필터 입구3개 | 선택 Chip, 검정 배경, 화살표 없음 | kit FilterButton의 흰 표면·테두리·chevronDown. 화면의 조건행만 wrap |
| 필터 글자 | Chip 16/600 | 공용 FilterButton 13/700. 공용 규격 채택에 따른 의도 차이 |
| 정렬 시트 | 화면 전용 행, 모두700 | 공용 SortSheet. 선택800/비선택600·check. 기존5정렬 유지 |
| 검색 위치 | 제목 바로 아래 | 카테고리 다음, 필터 이전. 기존 SearchBar 재사용 |
| 헤더 검색 닫기 | query가 남아 숨은 검색 지속 | query 초기화. Sol 시험 RED 후 수정 확인 |
| 카드 제목 | 배지 사이 flex1·한 줄. 320text2에서 소실 | 이름과 배지 wrap, 이름 최대100%. 크기/굵기 유지 |
| 손익·원가 행 | 좁은 폭에서 라벨 세로 압축·금액 이탈 | 라벨/숫자 그룹 wrap. 숫자 fontVariant·서버 값 보존 |
| 판매중지/재료부족 | opacity0.55 | 그대로 유지 |

공용 FilterButton의 제한 없는 버튼 폭·한 줄 라벨을 maxWidth100%·Text flexShrink1·줄바꿈으로
보완했다. 폰트·색·화살표·onPress 계약은 그대로다. 다른 소비처 전수 실렌더 무회귀 주장은 하지 않는다.

## 커밋과 실제 캡처

- `64f9d3a50d92e45c79313954cff8ecb957d4f9bf`: 제품 변경 전, 수집기 추가.
- `b330fe7f08f2ad7c6420fd3b07c2900a81540cbd`: 카드 wrap/검색 위치 후보.
- `90a128487acca80d264b2adf5d50c792bdcbe469`: 공용 필터/정렬 시트·query 초기화.

`docs/prototypes/three-surface-p3-recipes-visual/` 아래 원본을 덮어쓰지 않는다.

| 디렉터리 | source SHA | 조건 / PNG |
|---|---|---|
| list-before-20260909 | 64f9d3a | ready/search/sort/status/target ×390/320/320text2 =15/15 |
| list-after-20260909 | b330fe7 | 동일15/15 |
| list-common-filters-20260909 | 90a1284 | 동일15조건 +ready/search 스크롤 금액6장 =21PNG |

각 JSON의 sourceCommit·scriptSha256·browserVersion·fixture와 PNG 해시를 보존한다. 제품 변경 뒤
Metro를 종료/재시작하고 exact clean tracked HEAD에서 수집했다. recipe_list만 합성 읽기 응답,
주변 설정 읽기는 실제 로컬 환경이다. 쓰기 차단0·page/console 오류0. Native·SQL 검증이 아니다.

최종15조건에서 글꼴 실패/배율 불일치/문서 가로 넘침0. 스크롤 금액6장의 텍스트 잉크는
카드 좌우 밖 이탈0. **이 값은 viewport 전체 가림0이 아니다.** root와 Astra가 320text2의
음수 순이익 −12,500원·비율·재료비 전문을 직접 읽었다. start 그림만으로 하단 완료를 주장하지 않는다.

## 시험·내부 독립 검수

- Sol 작성 `recipesListParity.test.tsx`:18/18. 실제 화면/kit/RNW, hooks·router mock,
  Modal visibility adapter와 직접 Text props 관측. 정렬5종, 상태/목표/검색, query닫기, 서버표시,
  opacity, route 및 공용필터3개·SortSheet·긴라벨 구조를 검증. jsdom 기하 실측 주장은 없다.
- root 전체 모바일50파일474/474, 타입검사 PASS. 이전 15시험 판본의471/471과 구별한다.
- Astra high 내부 독립 검수: 90a1284 제한 범위 PASS.21PNG 해시 일치, 공용 화살표/필터,
  숫자 스크롤 그림 확인. 아래 잔여를 유지하는 조건이다. 공식 Fable/Opus 대체 판정이 아니다.

## 잔여와 다음 배치

1. SalesAnalytics의 긴 기간 FilterButton+우측 일수는 non-wrap 부모다. 매출 배치에서
   320text2로 우선 확인한다. 이번 변경으로 새 결함이 생겼다고 단정하거나 무회귀 완료로 적지 않는다.
2. 확대 금액 캡처에서 안내문 일부는 FAB와 겹친다. 추가 스크롤을 포함한 전체 안내 접근·가림 판정은
   남긴다. 메뉴명/금액 개선과 다른 증거이며, 전체카드 접근 완료 수에 합산하지 않는다.
3. 웹 시트 현재 선택 의미(시각 check 외 보조기술 노출), 네이티브, 공식 외부 검수는 미완료.
4. 개발 진입/최종 종결 분리 결정에 따라 다음은 RCP-02 상세와 RCP-03 입력 배치다.
   실제 오작동·공용 계약 위반이 확인되면 해당 범위는 먼저 고친다.

## 상세·등록·수정 후속 배치 (2026-09-09)

제품 `0a3912f`: 기준 인분/월평균 입력을 각각 전폭으로, 재료비 소계를 검색 앞에 배치.
검색 액션은 kit Button, 2개 기준 탭은 ScrollTabs로 채택했다. 비활성 월평균을 포함한
기존 3개 손익 탭은 유지했다. 상세 제목/배지를 줄바꿈하며 값·저장 payload는 변경하지 않았다.
공용 Button/ScrollTabs 채택의 패딩·글자·아이콘 차이는 의도한 변경이며 시각 변화 0이 아니다.

Astra가 카테고리 accessibilityLabel이 현재값을 숨기는 F01을 발견했다. `ffd4541`에서
이름에 현재값을 포함했다. 제품 동일한 `74691ed`에서 Sol 작성 실제 폼·draftStore·kit 연결
9/9, root 전체 모바일51파일483/483 PASS. Astra 재실행9/9·새 Finding 없음: 내부 한정 PASS.
저장 hook은 mock이며 DB/네이티브 실측을 대신하지 않는다.

보존 캡처: forms-before-20260909(`12e9ebc`), forms-after-20260909(`0a3912f`),
forms-after-category-fix-20260909(`74691ed`), 각각9조건27PNG. 실제 Expo390/320/320글자2배,
기존 로컬 읽기 데이터와 응답 해시를 보존했다. 문서 가로 넘침0·폰트/배율 오류0.
세 판본 모두 상세의 app_capabilities 404와 오류보고 쓰기 차단으로 errors6/blocked3,
수집기 exit1이다. 환경 결함을 제외한 전체 PASS로 기록하지 않는다.

확대 상세 판매가 구성은 Donut 옆 범례의 금액·비율이 잘린다(전후 공통). 다음 수정 대상이다.
전체 스크롤 가림·네이티브·카탈로그·공식 외부 검수 NOT_SENT 및 최종 종결 미완료는 유지한다.

## 재료·부자재 검색 / 판매가 구성 (2026-09-09)

`156018c`: RCP-10/11 기존 Card/Badge/검색/plus 아이콘을 유지하며 이름의 한 줄 제한을
제거하고 배지 행을 wrap했다. 상세의 범례는 좁은 화면에서 도넛 아래로, 금액/비율은
별도 wrap 그룹으로 배치했다. font/weight/color/opacity 및 계산·저장·선택 코드는 변경0.
간격은 기존 space를 사용하며 이전3/7을4/8로 맞췄으므로 카드 높이/위치 불변은 아니다.

search-before-20260909 6PNG와 search-breakdown-after-20260909 15PNG(9조건)를 보존.
후자는 상세9PNG+검색6PNG이며 source156018c, PNG 해시 전부 일치. 글꼴/배율/문서 넘침0.
390 정상 가로 배치 유지,320 글자2배의 범례 금액·비율·소계 및 검색 이름 전문을 root/Astra가
읽었다. 상세의 기존404/쓰기차단(errors6/blocked3) 때문에 수집기 exit1은 유지한다.

실제 검색 화면·draftStore·kit 연결25/25, root 전체 모바일52파일508/508 및 타입 PASS.
검색 정규화·g/ml/개 사용량·취소·null단가·부자재 수량·음수재고·route를 mock 경계에서 검증.
Astra 내부 한정 PASS(새 회귀 없음). 실제 RPC 저장·임의 최대장문·전체 목록 스크롤은 증명하지 않는다.
도넛 중앙 글자의 확대 잘림/링 밖 비율은 전후 동일한 공용 Donut 잔여다. 이후 공용 차트
계약 검수에서 다루며 이번 범례 개선을 전체 상세 완료로 올리지 않는다.

## 손익 변동 공용화 (2026-09-09)

`85a1ccd`/`34f3cdf`: 도메인 ProfitChangeRow를 RCP02/16에서 재사용하고 제목/요약을
줄바꿈한다. 공용 HistoryValueRow는 기존 ChangeHistory 전후값 행의 스타일을 그대로 추출,
RCP16에도 적용했다. 값·단위·누락값 처리는 caller 소유다. 손익 시트의 중복20px 여백을 제거하고
공용 고정 제목/닫기 Button을 채택했다. 긴 사건명은 스크롤 본문에 남긴다.
RCP16 라벨600→700·테두리·gray Button 색·여백 차이는 의도된 공용 규격 채택이며 불변이 아니다.

RCP02 signed-first와 RCP16 absolute-first의 기존 음수 반올림 순서 차이는 명시 prop으로
보존했다. -0.495 경계는 각각0원/1원이며 이번 배치에서 계산 정책을 통일하지 않았다.
Sol 실제 host5/5, root 관련15/15·전체모바일53파일513/513·타입 PASS.
Astra 내부 한정 PASS: 직접 관련11/11, 새 Finding 없음. 공식 검수 NOT_SENT는 유지한다.

실제 로컬 이력은 빈 목록: profit-history-before-20260909는3PNG 뒤 시트 대기 실패(exit1).
명시적 합성 읽기 응답으로 전환했으며 실제 DB 행은 생성하지 않았다. 첫 fixture-before는
Modal 진입 중 찍혀 시트 시각 근거에서 제외한다. settled-before는 종료 때 다른 제품 편집을
감지해 clean 실패했으므로 채택하지 않는다. 원본은 모두 보존한다.
정식 before=profit-history-clean-before-20260909(`85a1ccd`, RCP16 이전),6PNG/오류0.
after=profit-history-after-20260909(`34f3cdf`),6조건15PNG/오류·차단·폰트·배율·문서 넘침0.
수집기는 유한 browser animation 완료를 기다리고 이후 캡처한다. 확대 시트 원인/결과/닫기는
추가 스크롤 그림으로 확인했다. 합성 자료의 금액은 실거래 검증 증거가 아니다.
RCP02 공용행과 ChangeHistory 이번 실렌더, 전체 목록 끝, 네이티브 검수는 잔여다.

## 부자재 관리·카테고리 공용 소비 (2026-09-09)

제품 `d9a7133`에서 이름 줄바꿈, 카테고리 Select 현재값/expanded, 미리보기 금액 wrap을
적용했다. 공용 CategoryEditScreen의 식재료 안내는 실제 이름만 수정하는 폼에 맞춰
“이름·로스율 수정”에서 “이름 수정”으로 정정했다. 저장 payload와 계산은 바꾸지 않았다.

후보의 auto basis가 정상390에서도 구매 수량/가격을 세로로 만드는 회귀를 Astra가 발견했다.
`3b3de7e`는 정상390 기존 flex1/1.3을 복원하고 폭320 이하 또는 fontScale>1일 때만 세로로
전환한다. 전역 breakpoint나 두 번째 디자인 토큰을 추가하지 않았다. fontScale 분기는
mock 구조시험이며 실제 네이티브 확대 실측 주장은 하지 않는다.

Sol 시험에서 저장A→취소→폼B의 지연 성공이 B를 닫고 지연 오류가 B에 Alert를 띄우는
결함2개를 RED 재현했다. `ba3223e`의 편집 세대 guard로 콜백을 원래 세션에 한정했다.
현재 폼의 저장 오류는 기존 입력을 보존하고 알린다. 취소가 이미 시작한 서버 요청을
취소한다는 의미는 아니다. 실제 RPC 저장/삭제는 실행하지 않았다.

before=material-manage-before-20260909(`ae0c4b2`), rejected candidate=material-manage-after-20260909
(`d9a7133`), final=material-manage-final-20260909(`e2f8eb7`), 각각15조건27PNG.
revised(`3b3de7e`)는 수집 중 추적 시험파일 편집으로 종료 clean FAIL이므로 시각 증거로 채택하지
않으며 원본은 보존한다. final만 exact clean HEAD/PNG27해시 일치, 오류·차단·폰트·배율·문서
가로 넘침0. 전후 settings_lists 응답 해시도 일치한다. 리스트/추가/수정/레시피·부자재
카테고리390/320/320text2 및 폼 미리보기/저장 스크롤 그림을 보존했다.

카테고리3-kind 실제 host+kit42/42, 부자재9/9, root 전체모바일55파일564/564·타입 PASS.
Astra e2f8eb7 내부 한정 PASS, 390 두 칸 복원/320 확대 금액/저장 버튼을 직접 확인하고
부자재9/9를 재실행했다. 카테고리 삭제/정렬은 hook mock 경계, 네이티브/실제 DB 삭제제약은
별도다. 취소 버튼의 확대 두 줄은 기존 동일 잔여이며 공용 규격 변경으로 추정하지 않는다.

RCP12b는 이번 공용 카테고리 시험과 겹치므로 새 미검수 표면으로 중복 집계하지 않는다.
다음 별도 확인은 RCP02b 변경이력·RCP05 판매가 시뮬레이션·Expo-only RCP07 평균판매량·
MY 공동 소유 RCP15 고정지출이었다. 아래 사용자 정정으로 RCP07은 기능 개선 대상에서 철회했다.
공식 검수 NOT_SENT/전체 verify 미실행/최종 종결 미완료 유지.

## 사용자 정정: 월평균 기능 제거 누락 (2026-09-09, 검증 진행 중)

사용자 “월평균 판매량 없앴을것? 입력필드없을걸?”을 계기로 실제 결정 원문을 확인했다.
`full-page-flow-prototype-changelog.md` PRT-131은 추가/수정 입력·상세 행·월평균 탭·전용 화면을
제거하고 옛 주소는 추가 화면으로 이동하도록 규정한다. current-spec §기본 입력도 월평균 없음.
기존 Expo에 있다는 사실과 registry의 expoOnly를 기능 보존 근거로 삼은 root 판단이 틀렸다.
0a3912f의 입력 전폭 배치와 그 보존 시험은 해당 제거 결정을 반영하지 못한 이전 후보 기록이다.

정정 범위: Add 입력/월평균 설명/탭, Detail 정보 행/탭을 제거하고 공용 2개 인분 탭을 사용한다.
RCP07는 카탈로그에서 제외하고 기존 route는 `/recipes/add` redirect로 유지한다.
최근30일 실제 판매는 유지한다. 읽기 API/과거 이력/DB 컬럼을 삭제하거나 데이터를 지우지 않는다.
저장 hook의 월평균 키는 선택형이며 새 UI는 그 키를 생략한다. 기존 save_recipe의 coalesce 계약
(`20260820000079_change_titles_kinds.sql:217`)은 누락 시 기존 값을 유지하고 신규는 null이다.
실제 DB 수정 실행 없이 host 및 RPC payload 시험으로 경계를 확인한다.

교훈: 디자인 재료의 권위(Expo tokens/kit)와 기능 제거 결정의 권위를 혼동하지 않는다.
프로토타입 target이 없다는 관측만으로 유지/삭제를 단정하지 말고, 해당 기능의 결정 이력을 확인한다.
현재 이 정정은 자체/교차검수와 새 실렌더 전까지 완료로 집계하지 않는다.
