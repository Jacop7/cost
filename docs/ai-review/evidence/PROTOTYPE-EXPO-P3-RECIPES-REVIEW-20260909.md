# P3 메뉴 첫 배치 — 내부 검수 및 전후 기록

날짜: 2026-09-09. 상태: 개발 후보 내부 검수 PASS, 공식 외부 검수 NOT_SENT.
P3 최종 종결·P4·병합·배포 승인이 아니다.

## 범위와 기준

레지스트리 recipes는13표면·49binding·49고유 prototype target(screen15+popup-host34)이다.
식재료44와 literal target 교집합0, 두 도메인 합집합93. RCP-07은 Expo-only이며 삭제 대상이 아니다.
이는 연결 범위이지 완료 수가 아니다. 이번 제품 배치는 RCP-01과 연결된 목록·정렬·판매상태·목표
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
