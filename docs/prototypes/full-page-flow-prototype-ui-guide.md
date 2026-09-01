# 전체 페이지 흐름 프로토타입 · UI 디자인 시스템 상세 가이드

## 0. 문서 계약

### 0.1 역할과 범위

- 상태: 병합 개정안
- 개정일: 2026-09-01
- 적용 대상: `docs/prototypes/full-page-flow-prototype.html`과 향후 Expo 공용 UI
- 검수 범위: 제품 화면 62개, 팝업·조건 상태 호스트 125개, 고유 ID 99개
- 이번 개정 제외: 실제 Expo 화면, 프로토타입 HTML, DB, RPC
- 공동 검토: Codex 전수검수 + 사용자 요청 기반 `claude-opus-5` 독립 검토

이 문서는 같은 역할의 요소가 화면마다 다른 크기·굵기·색상·배치·동작을 갖지 않도록 공통 UI 계약을
정의한다. 화면 문구와 노출 조건은 `full-page-flow-prototype-current-spec.md`, 변경 과정은
`full-page-flow-prototype-changelog.md`가 관리한다.

| 대상 | 단일 원천 |
|---|---|
| 재고·단가·세금·손익·영업일 계산 | `AGENTS.md`, `ARCHITECTURE.md`, DB RPC |
| 화면 ID·라우트·구현 상태 | `apps/mobile/src/features/README.md` |
| Expo 원시 시각값과 공용 구현 | `apps/mobile/src/theme/tokens.ts`, `apps/mobile/src/components/kit/**` |
| UI 목표 행동과 출시 검수 기준 | 이 가이드 |
| 화면별 확정 문구·배치 | 현재 확정안 문서 |
| 프로토타입 HTML | 검수용 표현과 상호작용 예시 |

프로토타입 CSS 값을 Expo 토큰보다 우선하지 않는다. HTML에만 존재하는 색상·굵기·간격은 자동으로
제품 토큰이 되지 않는다. 이 문서도 `tokens.ts`와 다른 두 번째 원시 토큰 체계를 만들지 않는다.

### 0.2 현재·목표·보류

- **현재**: 저장소의 Expo 또는 프로토타입에서 확인된 상태다.
- **목표**: 제품 결정은 끝났지만 실제 구현에는 아직 모두 반영되지 않은 상태다.
- **보류**: 데이터·업무 계약이 확정되지 않아 공식 화면 패턴으로 사용하지 않는 상태다.

이 문서의 규격은 적용 목표다. 실제 화면 판정은 적용·전수 재검수·변경 기록이 끝날 때까지 현재
확정안이 우선한다. 목표 규칙을 현재 구현처럼 표현하지 않는다.

### 0.3 규범과 우선순위

- **MUST**: 제품 계약·핵심 행동·데이터 이해·접근성에 직접 영향을 준다. 위반은 P0다.
- **SHOULD**: 동작은 가능하지만 일관성·인지성·효율을 낮춘다. 위반은 P1이다.
- **MAY**: 화면 목적과 데이터 밀도에 따라 사용할 수 있는 확장이다.

| 등급 | 판정 기준 |
|---|---|
| P0 | 핵심 행동 불가, 데이터 오해·손실, 고정 제품 계약 위반, 접근성 차단, 국제화로 핵심 정보 소실 |
| P1 | 값과 동작은 정확하지만 공통 UI 일관성·탐색성·효율 저하 |
| P2 | 현재 흐름에 영향이 없는 확장·고급 반응형·보조 모션 |
| 검수 셸 | 제품 UI가 아닌 화면 카탈로그·PC 작업 프레임 전용 규칙 |

### 0.4 절대 UI 계약

1. Expo 화면은 `tokens.ts`와 공용 kit을 재사용한다.
2. 같은 역할은 같은 토큰과 컴포넌트를 사용한다.
3. 색상·크기·위치만으로 상태와 행동을 전달하지 않는다.
4. 사용자 입력, 계산 미리보기, 서버 확정값을 구분한다.
5. 로딩·저장·성공·빈 상태·오류·오프라인을 정상 화면과 함께 설계한다.
6. 통화·숫자·비율·단가·날짜는 공용 formatter를 사용하고 표시 문자열을 계산에 되돌려 쓰지 않는다.
7. 입력·선택 시트와 삭제·철회·상태 변경 확인창을 같은 유형으로 구현하지 않는다.
8. 키보드와 Safe Area가 현재 입력이나 주요 행동을 가리지 않아야 한다.
9. 모든 조작은 공용 최소 터치 영역과 접근 가능한 이름을 갖는다.
10. 반복 예외는 화면별 CSS가 아니라 공용 variant로 승격한다.

---

## 1. 기초 토큰

### 1.1 권위와 매핑 방식

가이드의 의미 역할은 Expo 원시 토큰의 별칭이며 새 팔레트가 아니다.

| 의미 역할 | Expo 코드 심볼 | 사용처 |
|---|---|---|
| 앱·기본·보조 표면 | `T.bg`, `T.surface`, `T.surface2` | 화면·카드·결과 영역 |
| 기본·강한 보조·보조 텍스트 | `T.ink`, `T.ink2`, `T.sub` | 제목·값·본문·라벨 |
| 읽어야 하는 약한 본문 | `T.sub2` | 날짜·단위·설명 |
| placeholder·장식 | `T.ter` | 입력 전 안내·비핵심 아이콘 |
| 기본·약한·강한 경계 | `T.line`, `T.line2`, `T.line3` | 필드·행·탭 |
| Primary·눌림·정보 표면 | `T.blue`, `T.bluePressed`, `T.blueTint` | 주요 행동·선택·안내 |
| 긍정·주의·위험 | `T.green`, `T.amberText`, `T.red` | 상태 의미 |
| 상태 표면 | `T.greenTint`, `T.amberTint`, `T.redTint` | 상태 배경 |
| 반전 글자·스크림 | `T.onColor`, `T.scrim` | 색 배경·오버레이 |

`text.tertiary`는 코드의 `T.sub2`, 장식용 약한 색은 `T.ter`에 대응한다. 이름이 비슷하다는 이유로
서로 바꾸지 않는다. 프로토타입 카탈로그의 바깥 회색 배경은 제품 토큰이 아니다.

### 1.2 대비

- 일반 텍스트는 4.5:1, 큰 텍스트와 비텍스트 UI는 3:1 이상이어야 한다.
- 원시 브랜드·상태색은 작은 글자 전경으로 자동 승인된 값이 아니다.
- 현재 `StatusBadge`, tint형 `Badge`, `Notice`, 작은 Primary 라벨의 일부 조합은 검산이 필요하다.
- 접근 가능한 진한 전경색은 실제 대비 검산 후 `tokens.ts`에 추가한다. 이 문서가 임의 색을 확정하지 않는다.
- 상태는 색과 함께 텍스트·아이콘·부호 중 하나를 사용한다.

대비 미결정 조합은 P0이며 부록 C에서 관리한다.

### 1.3 타이포그래피

현재 `TYPE`을 코드 단일 원천으로 사용하고 화면의 임의 `fontSize`·`fontWeight`를 줄인다.

| 역할 | Expo 토큰 | 현재 크기·굵기 | 목표 보완 |
|---|---|---|---|
| 큰 핵심값 | `TYPE.display` | 22 / 800 | 공용 행간 추가 |
| 화면·시트 제목 | `TYPE.title` | 20 / 800 | 공용 행간 추가 |
| 앱·섹션 헤더 | `TYPE.header` | 18 / 700 | 공용 행간 추가 |
| 강조 본문·행 값 | `TYPE.body` | 16 / 700 | 공용 행간 추가 |
| 보조 본문 | `TYPE.bodyWeak` | 16 / 600 | 공용 행간 추가 |
| 라벨·설명 | `TYPE.caption` | 14 / 600 | 공용 행간 추가 |
| 칩·메타 | `TYPE.captionSm` | 13 / 600 | 공용 행간 추가 |
| 긴 본문 | 현재 없음 | 신규 필요 | 400 굵기 역할 추가 |

- 공식 굵기는 `400 / 600 / 700 / 800`만 사용한다.
- `650 / 750 / 850 / 900`은 금지한다.
- 도움말과 오류는 같은 `FieldMessage` 역할을 사용하고 글자보다 충분히 큰 행간을 보장한다.
- 비교표·목록·KPI의 숫자는 `tnum`을 사용한다. 단일 편집 입력은 폰트 렌더 검증 전 제외한다.
- 200% 글자 확대에서도 제목·값·입력·행동이 사라지지 않아야 한다.

### 1.4 간격·크기·모서리

간격은 `space.xs / sm / md / lg / xl / xxl`, 모서리는
`radius.sm / md / lg / xl / full`을 사용한다. 같은 이름에 다른 값을 문서에서 다시 선언하지 않는다.

현재 kit에는 공용 크기 객체가 없으므로 다음 의미 토큰은 **목표 신규 토큰**이다.

| 목표 토큰 | 목표값 | 의미 |
|---|---:|---|
| `size.touchMin` | 44 | 모든 조작의 최소 유효 영역 |
| `size.controlCompact` | 36 | 인라인 작은 조작의 시각 높이 |
| `size.controlFilter` | 40 | 필터·분할 선택 |
| `size.controlDefault` | 52 | 입력·셀렉트·검색·주요 버튼 |
| `size.rowMin` | 64 | 일반 목록 행 최소 높이 |
| `size.navigationBottom` | 60 | Safe Area를 제외한 하단 탭 |
| `size.fab` | 54 | 확장형 FAB |

작은 시각 컨트롤도 실제 조작 영역은 `size.touchMin` 이상이어야 한다. 인접 hitSlop이 겹치면 시각
컨테이너 자체를 키운다. 현재 literal 모서리는 기존 `radius`로 수렴시키고, 정말 필요한 예외만 의미
토큰으로 승격한다.

### 1.5 그림자·레이어·모션

- 그림자는 `cardShadow`, `sheetShadow`, `fabShadow`, `sliderThumbShadow`만 공용 원천으로 사용한다.
- 일반 카드에 강한 테두리와 그림자를 동시에 적용하지 않는다.
- 레이어 순서는 `base → sticky → navigation → floating → overlay → dialog → popover → toast`다.
- 현재 z 토큰은 없으므로 공용 z 객체 추가 전까지 화면별 새 값을 늘리지 않는다.
- 모션은 `press / popover / dialog / toast / sheet` 역할로 통일하고 reduced motion을 지원한다.
- 저장 중 진행 표시가 버튼 폭과 라벨 위치를 바꾸지 않아야 한다.

### 1.6 아이콘

- 제품 행동은 공용 `Icon`과 `IconName`을 사용한다.
- 문자 기호를 뒤로가기·검색·수정·닫기·더보기 아이콘으로 사용하지 않는다.
- 크기는 작은 보조 / 일반 / 내비게이션 3역할로 제한한다.
- 아이콘 버튼의 접근 가능한 이름은 `대상 + 행동` 형식으로 작성한다.
- 방향 아이콘은 RTL에서 반전하고 장식 아이콘은 스크린리더에서 제외한다.
- 가이드 이름과 kit `IconName`의 대응 및 누락 아이콘은 부록 C에서 관리한다.

---

## 2. 앱 셸과 내비게이션

### 2.1 제품 셸과 반응형

제품 앱과 프로토타입 카탈로그를 분리한다. PC의 휴대폰 프레임·화면 선택 메뉴·작업 배경은 제품
구현 대상이 아니다.

| 단계 | 폭 | 목표 동작 |
|---|---:|---|
| Compact | 320~359 | 2열 입력을 1열로 전환하고 긴 버튼은 줄바꿈 허용 |
| Mobile | 360~599 | 기본 한 열 제품 구조 |
| Tablet | 600~899 | 읽기 폭 제한, 필요한 데이터 카드만 2열 허용 |
| Prototype desktop | 900 이상 | 제품 셸과 검수 카탈로그 분리 |

높이는 `100dvh`를 우선하고 `100vh`는 보조로 사용한다. 고정 폭 때문에 저장·삭제·철회 행동이
잘리면 안 된다. 현재 프로토타입의 단일 breakpoint와 viewport 차이는 부록 C의 적용 항목이다.

### 2.2 Safe Area와 키보드

| 영역 | inset 소유자 |
|---|---|
| 상단 | 공용 Header |
| 하단 탭 | expo-router 탭 셸 |
| 화면 하단 고정 행동 | 목표 `StickyAction` |
| 바텀시트 하단 행동 | 공용 `Sheet` |
| FAB | 공용 FAB 배치 컨테이너 |

- inset은 화면과 공용 컴포넌트가 중복 적용하지 않는다.
- 키보드가 열려도 현재 입력과 저장 행동에 접근할 수 있어야 한다.
- 하단 탭 자체를 키보드 위로 올리지 않는다.
- 가로모드와 작은 높이에서도 고정 행동이 본문을 가리지 않아야 한다.
- 현재 `Sheet`의 하단 Safe Area·키보드 회피 부재는 P0 격차다.

### 2.3 스크롤과 위치 복원

- 화면은 기본적으로 하나의 주 세로 스크롤 영역을 사용한다.
- 헤더와 하단 탭은 고정하고 본문만 스크롤한다.
- 고정 행동이 있으면 콘텐츠 하단에 행동 높이와 Safe Area만큼 여백을 둔다.
- 새 화면은 상단에서 시작하고 상세에서 목록으로 돌아오면 필터·검색어·스크롤 위치를 복원한다.
- 팝업이 열리면 배경 스크롤과 조작을 막는다.
- 긴 시트는 제목과 footer를 유지하고 본문만 스크롤한다.

### 2.4 하단 탭과 화면 계층

하단 탭은 `식재료 · 레시피 · 발주 · 매출관리 · MY` 순서를 유지한다.

- 같은 탭을 다시 누르면 탭 메인으로 이동하고, 이미 메인이면 목록 상단으로 이동한다.
- 탭 전환 중 dirty 폼이 있으면 이탈 확인을 먼저 수행한다.
- 기본 계층은 `메인 → 상세 → 상세의 상세`다.
- 뒤로가기는 `현재 팝업 → 명시적 부모 → 현재 탭 메인` 순서다.
- 딥링크로 상세에 직접 들어온 경우 부모가 없으면 해당 탭 메인으로 이동한다.
- 웹 Escape·브라우저 뒤로가기·Android Back은 같은 의미를 유지한다.

### 2.5 헤더

| 변형 | 구성 | 사용처 |
|---|---|---|
| Main | 제목 + 검색 + 알림 | 식재료·레시피·발주 메인 |
| Sales main | 제목·영업일 맥락 + 날짜 행동 | 매출관리 메인 |
| MY main | 제목·매장 맥락 | MY 메인 |
| Child | 뒤로가기 + 제목 | 일반 하위 화면 |
| Child action | 뒤로가기 + 제목 + 주요 행동 | 상세·관리 화면 |
| Context | 뒤로가기 + 제목 + 국가·날짜·판본 맥락 | 세금·영업일·국제 설정 |

- 우측 행동은 최대 두 개이며 가장 중요한 행동을 끝에 둔다.
- 헤더에 본문과 같은 재고량·건수·합계를 반복하지 않는다.
- 제목이 길어도 저장·삭제 등 주요 행동을 보존한다.
- 같은 계층의 화면은 같은 헤더 변형을 사용한다.
- 현재 `AppHeader`는 Child 계열 기반이며 Main 계열은 공용화가 필요하다.

---

## 3. 조작 컴포넌트

### 3.1 공통 계약과 kit 대응

| 가이드 역할 | 현재 kit | 상태 | 목표 |
|---|---|---|---|
| Button | `Button` | 기존 | variant 명칭·포커스·최소 영역 통합 |
| IconButton | 없음 | 신규 필요 | 헤더·행·검색의 아이콘 조작 공통화 |
| Field | `Field` | 기존 | 도움말·오류 역할 정리 |
| Input | `Input` | 기존 | readonly·warning·validating·success 추가 |
| Select | `Select` | 기존 | expanded·disabled·readonly·error 의미 추가 |
| Search | `SearchBar` | 기존 | header/page 변형 분리 |
| Stepper | `Stepper` | 기존 | min·max·직접 입력·변화 알림 보강 |
| Toggle | 없음 | 신규 필요 | switch 의미·checked·loading 제공 |
| PageTabs | `ScrollTabs` | 기존 | tablist·panel·자동 노출 보강 |
| SegmentedControl | `SegTabs` | 기존 | 페이지 탭과 다른 입력 모드 의미 확정 |
| Filter | `Chip`, `FilterButton`, `SortChip`, `PeriodChip` | 분산 | 공통 기반과 variant로 통합 |
| StickyAction | 없음 | 신규 필요 | Safe Area·키보드·저장 상태 소유 |

모든 조작은 필요한 `default / pressed / focused / disabled / loading / error / selected` 상태를 제공한다.
비활성만으로 이유를 전달하지 않으며 서버 상태를 바꾸는 행동은 loading 중 중복 실행을 막는다.

### 3.2 Button과 행동

- 공식 의미 variant는 `primary / secondary / outline / ghost / danger / tint`다.
- 현재 `gray`는 `secondary` alias로 정리한다.
- 한 화면·팝업의 대표 Primary는 원칙적으로 하나다.
- 삭제·철회·계정 해지는 danger를 사용하며 Primary 색을 재사용하지 않는다.
- loading 중 라벨을 유지하고 진행 표시 때문에 폭이 바뀌지 않게 한다.
- 단독 아이콘 행동은 `IconButton`으로 통합하고 문자 아이콘을 넣지 않는다.

### 3.3 Form·Field·Input

Form은 입력 순서·검증·dirty·제출·실패 복구를 소유하는 조합 계약이다.

`라벨 → 입력 또는 선택 → 도움말/오류`

- 도움말과 오류가 동시에 있으면 오류만 노출한다.
- 제출 시 첫 오류로 이동하고 저장 실패 후 입력값과 선택값을 유지한다.
- Input은 `empty / filled / focused / disabled / readonly / error / warning / validating / success`를 지원한다.
- readonly는 값을 유지하되 편집 단서와 열림 행동을 제거한다.
- 단위는 suffix, 통화 위치는 locale formatter 결과를 사용한다.
- 계산 결과를 Input처럼 만들지 않고 `ResultField`를 사용한다.

### 3.4 Select·Search·Stepper·Toggle

**Select**

- 단일 선택은 PickerSheet에서 선택 즉시 반영한다.
- 여러 값을 함께 확정할 때만 별도 적용 행동을 둔다.
- `empty / selected / expanded / disabled / readonly / error` 상태를 제공한다.

**Search**

- `header`와 `page` 변형을 구분한다.
- 한글 IME 조합 중 검색을 확정하지 않는다.
- 최초 데이터 없음과 검색 결과 없음을 같은 문구로 사용하지 않는다.
- 지우기와 검색 닫기 행동을 구분한다.

**Stepper**

- 감소 / 현재 값·단위 / 증가 구조를 사용한다.
- min·max에서 해당 방향을 비활성화하고 값을 접근성 상태로 전달한다.
- 직접 입력이 필요하면 값 영역에서 숫자 입력 변형을 연다.

**Toggle**

- 즉시 저장되는 이진 설정에만 사용한다.
- `on / off / disabled / loading`과 비활성 이유를 제공한다.
- 즉시 저장 Toggle과 하단 일괄 저장 방식을 같은 화면에서 섞지 않는다.

### 3.5 Tabs와 Filter

- `PageTabs`는 상위 콘텐츠 이동, `SegmentedControl`은 같은 데이터의 보기·입력 모드 전환이다.
- PageTabs는 tablist/tab/tabpanel 관계와 선택 상태를 제공한다.
- SegmentedControl 변경 시 라벨·입력값·계산 결과가 같은 모드로 함께 갱신돼야 한다.
- Filter는 `trigger / sort / period / quick chip` 변형을 사용한다.
- 전체값일 때도 필터 목적을 숨기지 않는다.
- 여러 조건을 한 문장으로 합친 거대한 칩을 만들지 않는다.
- 필터 결과 없음에는 초기화 행동을 제공한다.

---

## 4. 콘텐츠와 데이터 표시

### 4.1 공통 계약과 kit 대응

콘텐츠 컴포넌트는 전달받은 값과 상태만 표시하고 확정 계산을 다시 하지 않는다.

| 가이드 역할 | 현재 kit | 상태 | 목표 |
|---|---|---|---|
| Badge | `Badge`, `StatusBadge` | 기존 | 상태·비교·메타 변형 및 대비 정리 |
| Card | `Card` | 기존 | interactive·selected·warning·loading 보강 |
| Row | `PLRow`만 존재 | 신규 필요 | 일반 행 변형 공통화 |
| Table | 없음 | 신규 계약 | 동일 데이터 모델의 웹 표·모바일 행 |
| KPI | 없음 | 신규 필요 | hero·summary·target·delta |
| ResultField | 없음 | 신규 필요 | 입력과 분리한 preview·confirmed 결과 |
| Chart | `Donut`, `TrendChart` | 일부 | Donut만 현재 공식, TrendChart 보류 |
| ManagementList | 없음 | 신규 필요 | 관리·재정렬·행동 구조 공통화 |
| Data state | `QueryState` | 기존 | refreshing·offline·stale·partial 확장 |
| Notice | `Notice` | 기존 | 읽어야 하는 정보 안내에 사용 |

기준일·기간·갱신 시각·적용 시점이 필요한 값에는 출처를 함께 표시한다. 음수와 0을 숨기지 않는다.

### 4.2 Badge와 상태 표시

| 변형 | 목적 |
|---|---|
| StatusBadge | 재고의 `여유 / 소진 임박 / 소진`처럼 도메인 판정 표시 |
| ComparisonBadge | 가격의 `최저 / 최고`, 현재·최신 비교 |
| MetadataBadge | 짧은 중립 메타데이터 |

- 일반 카테고리·구매처를 불필요하게 Badge로 만들지 않는다.
- 한 항목의 Badge 수를 제한하고 의미가 겹치면 본문 값으로 내린다.
- 음수 재고는 Badge로 숨기지 않고 `−750g`처럼 실제 값을 표시한다.
- solid 배경은 흰색 전경 대비가 검증된 조합에서만 허용한다.

### 4.3 Card·Row·Table

- Card는 `default / interactive / selected / information / warning / danger / loading` 변형을 갖는다.
- 제목·값·상태를 카드 헤더와 본문에 반복하지 않는다.
- Row는 `primary / labelValue / valuePercent / countAmount / hierarchy / beforeAfter / event / management`
  변형으로 공통화한다.
- 행 전체 이동과 별도 chevron·편집 행동을 중복하지 않는다.
- Table은 웹의 열 의미와 모바일 행 카드의 열 순서·단위·소계·총계를 동일하게 유지한다.
- 정렬 가능한 열은 현재 방향을 의미 속성으로 전달한다.

### 4.4 KPI와 ResultField

- KPI는 라벨·값·단위·기준 기간 또는 비교 기준을 함께 가진다.
- loading·값 없음·집계 불가를 0으로 표시하지 않는다.
- 서버 확정 집계인지 미리보기인지 표시한다.
- ResultField는 `preview / afterChange / warning / negative / confirmed / empty / loading / error`를 갖는다.
- ResultField의 라벨은 영역 밖에 두고 영역 안에는 핵심 값을 우선한다.
- 계산 실패를 0으로 대체하지 않는다.

### 4.5 차트·관리 목록·점진적 공개

- 현재 공식 차트는 레시피 상세의 `Donut`이다. 텍스트 목록이나 데이터 표를 함께 제공한다.
- `TrendChart`는 데이터·화면 계약 확정 전 보류다.
- 관리 행은 이름·사용 정보·편집·삭제 구조를 통일한다.
- 사용 중이라 삭제할 수 없으면 이유를 함께 표시한다.
- 재정렬은 버튼과 드래그 중 화면 단위로 하나만 사용하고 결과를 접근성 알림으로 전달한다.
- `전체보기`는 별도 화면 이동, `더보기 N개`는 현재 영역 확장, ellipsis는 복수의 문맥 행동에만 사용한다.

---

## 5. 팝업 계약

### 5.1 유형과 현재 kit 대응

| 유형 | 목적 | 기본 배치 | 현재 kit | 판정 |
|---|---|---|---|---|
| PickerSheet | 단일·복수 선택 | 하단 | `Sheet`, `SortSheet` | 변형 필요 |
| FormSheet | 값 입력·수정 | 하단 | `Sheet`, `MemoEditSheet` | 변형 필요 |
| InfoSheet | 상세·전후 비교·저장 가능한 경고 | 하단 | `Sheet` 조합 | 명시 variant 필요 |
| ActionSheet | 대상의 여러 행동 | 하단 | `Sheet` 조합 | 명시 variant 필요 |
| ConfirmDialog | 상태 변경·삭제·철회 확인 | 중앙 | 없음 | **신규 필수** |
| SuccessDialog | 반드시 확인해야 하는 완료 | 중앙 | 없음 | 신규 필요 |
| ErrorDialog | 판단·재시도가 필요한 실패 | 중앙 | 없음 | 신규 필요 |
| PopoverMenu | 기준 버튼 주변의 2~5개 행동 | 기준 버튼 주변 | 없음 | 신규 필요 |

`PageState`는 팝업이 아니라 같은 페이지의 조건부 표시다. 현재 `ConfirmSheet`는 하단 Sheet이므로
중앙 `ConfirmDialog`로 간주하지 않는다. 웹에서는 `Alert.alert`를 확인창으로 사용하지 않는다.

### 5.2 공통 구조와 닫기 정책

팝업은 `제목·닫기 / 본문 / 행동`을 구분하고 한 시점에 조작 가능한 팝업 하나만 둔다.

| 유형 | 바깥 영역 | 뒤로가기·Escape | 미저장·처리 중 |
|---|---|---|---|
| PickerSheet | 임시값 없으면 허용 | 허용 | 임시값이 있으면 확인 |
| FormSheet | pristine일 때 허용 | pristine일 때 허용 | dirty면 변경 폐기 ConfirmDialog |
| InfoSheet | 허용 | 허용 | 중요한 읽기 확인은 명시적 닫기 |
| ActionSheet | 허용 | 허용 | 실행 전 상태 변경 없음 |
| ConfirmDialog | 금지 | 취소와 같은 결과 | loading 중 닫기 금지 |
| SuccessDialog | 정책별 | 확인과 같은 결과 | 다음 단계가 필수면 바깥 닫기 금지 |
| ErrorDialog | 정책별 | 닫기와 같은 결과 | 결정이 필수면 바깥 닫기 금지 |
| PopoverMenu | 허용 | 허용 | 닫힌 뒤 기준 버튼 복귀 |

위험 행동은 ActionSheet에서 즉시 실행하지 않고 ConfirmDialog로 전환한다. 판매 부족처럼 진행이
허용되는 경고는 ErrorDialog가 아니라 계속할지를 묻는 ConfirmDialog다.

### 5.3 유형별 핵심 규칙

- PickerSheet 단일 선택은 선택 즉시 닫고, 복수·복합 선택만 적용 행동을 둔다.
- FormSheet는 3장의 폼 계약을 사용하고 실패 후 입력을 보존한다.
- InfoSheet가 독립 검색·필터가 필요할 만큼 커지면 전체 페이지로 승격한다.
- ActionSheet는 일반 행동과 위험 행동을 분리한다.
- ConfirmDialog는 중앙 배치, 한 가지 질문, 영향 범위, 안전한 취소, 명시적 확정 행동을 제공한다.
- SuccessDialog는 단순 저장 성공마다 사용하지 않고 다음 단계 확인이 필요할 때만 쓴다.
- ErrorDialog는 기술 오류 코드 대신 문제와 다음 행동을 제공한다.
- PopoverMenu는 화면 경계에서 방향을 바꾸고 작은 화면에서는 ActionSheet로 전환한다.

### 5.4 Safe Area·키보드·포커스

- 하단 팝업은 Safe Area를 footer와 스크롤 여백에 반영한다.
- 키보드가 열려도 현재 입력·오류·대표 행동에 접근할 수 있어야 한다.
- 팝업을 연 기준 버튼을 기억한다.
- 열릴 때 제목 또는 첫 입력으로 포커스를 옮기고 배경 조작을 막는다.
- 팝업 내부에서만 탐색하고 닫은 뒤 기준 버튼으로 복귀한다.
- Android Back과 웹 Escape는 유형별 닫기 정책과 같아야 한다.

---

## 6. 상태와 업무 흐름

### 6.1 UI 상태

| 상태 | 필수 표현 |
|---|---|
| Initial loading | 페이지 또는 주요 카드 스켈레톤 |
| Refreshing | 기존 데이터 유지 + 작은 진행 표시 |
| Loading more | 목록 하단 진행 + 중복 요청 차단 |
| Saving | 라벨 유지 + 진행 표시 + 중복 제출 차단 |
| Success | 짧은 토스트 또는 필요한 완료창 |
| Empty | 이유와 가능한 첫 행동 |
| Filtered empty | 적용 필터와 초기화 행동 |
| Search empty | 검색어와 지우기 행동 |
| Error | 문제 요약·다시 시도·기존 값 유지 |
| Offline | 마지막 데이터·갱신 시각·재연결 상태 |
| Stale | 오래된 값 표시와 갱신 행동 |
| Permission denied | 필요한 권한과 설정 이동 |
| Partial | 실패 영역만 재시도, 성공 영역 유지 |

최초 빈 상태, 필터 결과 없음, 검색 결과 없음을 같은 문구로 합치지 않는다. 중요한 오류를 자동으로
사라지는 토스트만으로 전달하지 않는다.

### 6.2 미저장·철회·복구

- dirty 폼에서 뒤로가기·탭 이동·닫기를 시도하면 변경 폐기 확인을 제공한다.
- 저장 중 값 변경과 중복 제출을 차단한다.
- 삭제와 원장 철회를 구분한다. 철회는 기존 기록을 지우지 않고 반대 사건을 남긴다.
- 철회 불가 상태는 행동을 숨기거나 비활성 이유를 함께 표시한다.
- 성공 후 영향받는 목록·요약·단가·손익의 갱신 여부를 알 수 있어야 한다.

### 6.3 업무 상태

| 업무 | 상태 흐름 | UI 계약 |
|---|---|---|
| 발주 | 후보 → 입고 예정 → 입고 완료 | 발주는 기록만, 재고 반영 시점 분리 |
| 매출 | 영업 중 → 브레이크 → 영업 종료 | 종료 영업일은 다시 열지 않음 |
| 레시피 | 판매중 ↔ 판매중지 | 재고 부족과 판매 중지 구분 |
| 재고 | 입고·차감·폐기 → 조건부 철회 | 음수 재고를 숨기지 않음 |
| 목표 | 목표 미달 ↔ 목표 달성 | 색 외 텍스트·부호 병행 |

안전재고 미달과 판매 부족을 같은 판정으로 쓰지 않는다. 판매 부족은 음수 재고 기록을 계속할지
확인하되 자동으로 판매를 막지 않는다.

### 6.4 감사·출처·적용 시점

- 변경 원천은 `직접 수정 / 자동 갱신 / 원장 사건 / 계산 파생`으로 구분한다.
- 적용 시점은 `현재 반영 / 다음 영업일부터 / 과거 스냅샷 유지`처럼 표시한다.
- 감사 상세는 날짜·시간·대상·수정자·판본과 이전 값 → 이후 값을 제공한다.
- 오프라인·지연 데이터는 서버 확정값처럼 보이지 않게 한다.
- 기준 영업일·기준 월·마지막 갱신 시각은 필요한 화면에만 표시한다.

---

## 7. 문구와 국제화

### 7.1 문장과 명칭

| 상황 | 형식 | 예시 |
|---|---|---|
| 화면·팝업 제목 | 짧은 명사형 | `재고 수정`, `입고 실패` |
| 버튼 | 짧은 동작 | `저장`, `철회`, `전체보기` |
| 빈 상태 | 상태 한 문장 | `등록된 식재료가 없어요.` |
| 도움말 | 짧은 해요체 | `식재료 상세에서 추가할 수 있어요.` |
| 확인 | 결과가 드러나는 질문 | `판매를 중지하시겠습니까?` |
| 오류 | 문제 + 다음 행동 | `입고하지 못했어요. 잠시 후 다시 시도해 주세요.` |

- 라벨·버튼·Badge에는 마침표를 붙이지 않는다.
- 제목과 같은 보조 설명을 바로 아래에서 반복하지 않는다.
- 의미를 늘리지 않는 `옵션`, `관리`, `미리보기`, `기준`은 제거한다.
- 동일 개념은 현재 확정안의 최종 명칭을 사용한다.
- 비활성 버튼만으로 필수값 누락이나 실행 불가 이유를 설명하지 않는다.

### 7.2 숫자·단위

- 음수는 하이픈 대신 `−`, 변화량은 `+1kg`, `−700g`처럼 표시한다.
- 곱셈은 `1kg × 2개`, 단가는 `28.00원/g`처럼 표현한다.
- 구매 링크 표기는 화면별 확정안의 `상품·용량·금액 / 구매처·단가` 정보 순서를 보존한다.
- 표·비교·KPI의 숫자는 `tnum`을 사용하고 단일 편집 입력은 검증 전 제외한다.
- 입력 단위와 DB 최소 단위를 화면에서 혼동하지 않는다.

### 7.3 Formatter와 글로벌 대응

- 서식 단일 출처는 `@margincook/core`의 locale formatter다.
- `tokens.won`은 현재 한국어 고정 진입점이며 활성 시장·통화 연결이 필요한 격차다.
- 통화 위치·소수 자릿수·날짜 순서·요일·복수형을 화면 문자열 이어붙이기로 만들지 않는다.
- 기기 locale과 서버 저장값을 분리한다.
- 한국어보다 30~50% 긴 문구로 헤더·필드·버튼을 검수한다.
- 텍스트가 잘리면 고정 폭을 늘리기보다 2열을 1열 또는 다중 행으로 전환한다.
- RTL에서는 방향·행 배치를 반전하되 숫자와 단위의 읽기 순서를 보존한다.
- RTL 전환이 앱 재시작 경계를 요구하면 설정 저장 후 명확히 안내한다.

---

## 8. 접근성 출시 게이트

접근성 규칙은 속성 이름보다 사용자가 얻어야 하는 결과를 권위로 한다.

### 8.1 Web ↔ React Native 대응

| 결과 계약 | Web | React Native/Expo |
|---|---|---|
| 요소 이름 | `aria-label`, 연결된 label | `accessibilityLabel` |
| 도움말 | `aria-describedby` | `accessibilityHint` 또는 결합된 label |
| 선택·비활성·로딩 | `aria-selected/disabled/busy` | `accessibilityState` |
| 오류 | `aria-invalid`, 연결된 오류 | 오류 label + alert/live 알림 |
| 동적 값 | `aria-live` | `accessibilityLiveRegion` 또는 announce API |
| 대화상자 | `role=dialog`, `aria-modal` | `Modal`, `accessibilityViewIsModal` |
| 배경 차단 | `inert` | 플랫폼별 배경 접근성 제외 |
| 초기·복귀 포커스 | DOM focus | ref + 접근성 focus API |
| 닫기 | Escape | `onRequestClose`, Android Back |
| 포커스 표시 | `:focus-visible` | 플랫폼 focus 상태와 시각 표현 |

### 8.2 P0 출시 차단 조건

다음 중 하나라도 실패하면 적용 완료로 표시하지 않는다.

- 일반 텍스트 4.5:1, 큰 텍스트·비텍스트 UI 3:1 기준 미달
- Primary·상태 Badge·tint 위 텍스트 대비 미검증
- 조작 영역 `size.touchMin` 미달
- 키보드·Safe Area가 현재 입력이나 주요 행동을 가림
- 아이콘 단독 버튼에 대상과 행동을 포함한 이름이 없음
- 색만으로 상태·손익·위험을 전달함
- 팝업 초기 포커스·배경 차단·닫은 뒤 복귀가 없음
- 동적 계산값·수량 변화·저장 결과를 알 수 없음
- 200% 글자 확대에서 정보나 행동이 사라짐
- 차트에 텍스트 요약이나 데이터 표가 없음

### 8.3 최소 검수 조합

| 대상 | 최소 검수 |
|---|---|
| Web | 키보드만 사용, 200% 확대, 좁은 폭, 스크린리더 1종 |
| Android | TalkBack, 시스템 큰 글자, 하드웨어 Back, 키보드 회피 |
| iOS | VoiceOver, Dynamic Type, Safe Area, 모달 포커스 |
| 공통 | 명암 대비, 상태 이름, 저장 중 중복 입력, 오류 후 값 유지 |

---

## 9. 검수와 적용

### 9.1 Definition of Done

1. 본문은 10장, 추적성은 부록 A~C로 관리한다.
2. 코드 심볼이 있는 값은 가이드가 다른 현재값을 선언하지 않는다.
3. 변경 대상 CSS 변수·셀렉터·생성 함수·kit export가 부록 C에 연결된다.
4. 62개 화면과 호스트 상태 125개가 PC·모바일에서 모두 열린다.
5. 고유 popup/state ID 99개가 의도한 유형과 닫기 정책을 따른다.
6. Compact·Mobile·Tablet·Prototype desktop 폭에서 잘림·겹침이 없다.
7. Web·Android·iOS 접근성 출시 게이트를 통과한다.
8. 미정의 CSS 변수와 금지 굵기가 0건이다.
9. 로딩·저장·빈 상태·오류·오프라인의 필수 상태가 검증된다.
10. current-spec·changelog에 판정·예외·증거가 연결된다.
11. 실제 Expo 구현 변경은 저장소 필수 검사를 별도로 통과한다.

### 9.2 적용 순서

**P0**

- 토큰 권위·미정의 변수·색상 대비
- 중앙 ConfirmDialog와 Sheet 유형 분리
- Safe Area·키보드·최소 터치 영역
- 접근 가능한 이름·상태·모달 포커스
- 오류·저장 중·오프라인 상태
- locale formatter 연결

**P1**

- 타이포·Badge·FieldMessage 규격
- Card·Row·KPI·ResultField
- Picker·Filter·Stepper·Toggle
- 관리 목록·재정렬·전체보기
- 반응형과 긴 번역

**P2**

- 실제 데이터 그래프
- 태블릿·가로모드 고급 레이아웃
- RTL·고대비·reduced motion
- hover·pressed 세부 표현

### 9.3 검수 기록

| 필드 | 내용 |
|---|---|
| Rule/Finding | 가이드 항목 또는 F-01~F-20 |
| Screen/Popup | 화면 키·화면 ID·popup ID·host |
| Platform | Web / Android / iOS |
| Viewport/설정 | 폭·글자 크기·키보드·locale |
| Expected | 목표 토큰·variant·행동 |
| Actual | 실제 결과 |
| Result | PASS / FAIL / EXCEPTION |
| Evidence | 화면 캡처·테스트·커밋 |
| Revision | 검수한 판본 |

### 9.4 문서 운영

- 본문에는 현재 사용할 규칙과 출시 게이트만 둔다.
- 현재 구현 차이는 부록 C에서 관리한다.
- 화면별 예외는 이유·영향·종료 조건을 기록한다.
- 같은 예외가 두 화면 이상 반복되면 공용 variant 후보로 올린다.
- 목표안은 적용·재검수·current-spec/changelog 연결 전까지 현재값으로 표현하지 않는다.
- 가이드 패턴명과 RN kit export가 매핑되지 않으면 구현 완료로 보지 않는다.

---

## 부록 A. 화면 패턴 레지스트리 · 62개

화면 존재·라우트의 권위는 `apps/mobile/src/features/README.md`다. 이 부록은 UI 패턴 연결만 소유한다.

### A.1 식재료

| 화면 키 | 화면 ID | 주요 패턴 |
|---|---|---|
| `ingredient_main` | ING-01 | MainHeader, CategoryTabs, SortFilter, IngredientCardList, FAB |
| `ingredient_add` | ING-02 | ChildHeader, Field, PickerSheet, ResultField, StickyAction |
| `ingredient_detail` | ING-03 | ChildActionHeader, DetailHero, KPI, PreviewCard, ConditionalEmpty |
| `ingredient_edit_menu` | ING-03a | ChildHeader, ActionList, DangerAction |
| `ingredient_edit` | ING-04 | ChildHeader, Field, PickerSheet, ResultField, StickyAction |
| `stock_change` | ING-05 | ChildHeader, SegmentedControl, DependentForm, Stepper, ResultField, ConfirmDialog |
| `memo_edit` | ING-03c | ChildHeader, TextareaField, Counter, StickyAction |
| `options` | ING-06 | ChildActionHeader, ManagementList, Field, PopoverMenu, ActionSheet |
| `ingredient_delete` | ING-03d | ChildHeader, DangerPreview, ConfirmDialog |
| `stock` | ING-07 | ChildHeader, Filter, KPI, EventList, ActionSheet, ConfirmDialog |
| `purchase` | ING-09 | ChildHeader, Filter, KPI, ComparisonBadgeList |
| `ingredient_changes` | ING-03b | ChildHeader, AuditKPI, ChangeList, BeforeAfterSheet |
| `discard` | ING-10 | 숨김 보존, `stock` 폐기 필터 상태로 대체 |

### A.2 레시피

| 화면 키 | 화면 ID | 주요 패턴 |
|---|---|---|
| `recipe_main` | RCP-01 | MainHeader, CategoryTabs, Filter, RecipeCardList, FAB |
| `recipe_detail` | RCP-02 | ChildActionHeader, StatusSelect, KPI, Donut, CostTable, PreviewCard |
| `recipe_price_sim` | RCP-02c | ChildHeader, NumericField, SegmentedControl, ProfitTable, LiveResult |
| `recipe_add` | RCP-03 | ChildHeader, Field, EmptyState, AddAction, CostPreview, StickyAction |
| `recipe_edit` | RCP-03 | ChildHeader, FilledForm, EditableIngredientList, UsageFormSheet, StickyAction |
| `recipe_ingredient_search` | RCP-10 | ChildHeader, Search, IngredientPickList, UsageFormSheet |
| `recipe_material_search` | RCP-11 | ChildHeader, Search, MaterialPickList, UsageFormSheet |
| `recipe_materials` | RCP-13 | ChildActionHeader, ManagementList, FormSheet, ConfirmDialog |
| `recipe_category` | RCP-12 | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `recipe_material_category` | RCP-12b | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `recipe_changes` | RCP-02b | ChildHeader, AuditKPI, ChangeList, BeforeAfterSheet |
| `profit` | RCP-16 | ChildHeader, EmptyState 또는 ChangeList, InfoSheet |
| `fixed_average` | MY-02 | ChildHeader, PeriodFilter, KPI, CostTable |
| `fixed_actual` | MY-02b | ChildHeader, PeriodFilter, EditableCostGroups, WarningNotice, StickyAction |

### A.3 발주

| 화면 키 | 화면 ID | 주요 패턴 |
|---|---|---|
| `order_main` | ORD-01 | MainHeader, StateTabs, OrderCardList, ActionSheet, ConfirmDialog |
| `order_detail` | ORD-02 | ChildHeader, OrderSummary, DependentForm, StickyAction |
| `order_receive` | ORD-03 | ChildHeader, OrderSummary, ResultField, ConfirmDialog, InfoSheet warning variant |
| `order_direct` | ORD-02 | ChildHeader, PickerField, NumericField, StickyAction |

### A.4 매출관리

| 화면 키 | 화면 ID | 주요 패턴 |
|---|---|---|
| `sales_main` | SALES-01 | SalesMainHeader, BusinessStateCard, HeroKPI, QuickActions, LiveList |
| `analytics` | SALES-02 | ChildHeader, PeriodFilter, SummaryKPI, DataTable |
| `day` | SALES-03 | ChildHeader, ProfitKPI, CostTable, InfoSheet |
| `day_full` | SALES-10 | ChildHeader, HierarchicalProfitTable |
| `revenue` | SALES-05 | ChildHeader, SummaryTable, ExpandableList |
| `menu` | SALES-08 | ChildHeader, MenuProfitList |
| `channel` | SALES-18 | ChildHeader, ChannelProfitTable |
| `material` | SALES-11 | ChildHeader, MaterialCostList, InfoSheet |
| `extra` | SALES-12 | ChildHeader, MaterialCostList, InfoSheet |
| `waste` | SALES-17 | ChildHeader, LossSummary, WasteList |
| `sales_fixed` | SALES-13 | ChildHeader, FixedCostSummary, ExpandableDetail |
| `expense` | SALES-14 | ChildHeader, ExpenseList, FormSheet, ConfirmDialog |
| `tax` | SALES-18 | ChildHeader, TaxSummaryTable |
| `stock_check` | SALES-19 | ChildHeader, WarningCard, ExpandableList |
| `sales_past` | SALES-21 | ChildHeader, EditableDayList, StickyAction, ConfirmDialog |

### A.5 MY

| 화면 키 | 화면 ID | 주요 패턴 |
|---|---|---|
| `my_main` | MY-01 | MYMainHeader, StoreCard, SettingsList |
| `my_fixed` | MY-05 | ChildHeader, PeriodFilter, KPI, CostTable |
| `my_fixed_edit` | MY-05b | ChildHeader, PeriodFilter, EditableCostGroups, StickyAction |
| `my_settings` | MY-03 | ChildHeader, SettingsList |
| `my_ingredient_categories` | MY-03a | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `my_recipe_categories` | RCP-12 | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `my_material_categories` | RCP-12b | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `my_materials` | RCP-13 | ChildActionHeader, ManagementList, FormSheet, ConfirmDialog |
| `my_tax` | MY-02 | ContextHeader, TaxForm, RadioGroup, ResultField, StickyAction |
| `my_language` | MY-04 | ChildHeader, RadioList, InfoSheet, StickyAction |
| `my_units` | MY-05 | ChildHeader, SettingsList |
| `my_vendors` | MY-06 | ChildActionHeader, ManagementList, FormSheet, ConfirmDialog |
| `my_channels` | MY-07 | ChildHeader, SettingsList, FormSheet, ConfirmDialog |
| `my_hours` | MY-08 | ChildHeader, Toggle, SegmentedControl, TimePickerSheet, StickyAction |
| `my_notifications` | MY-09 | ChildHeader, ToggleList |
| `my_account` | MY-10 | ChildHeader, AccountSummary, DangerZone, ConfirmDialog |

### A.6 식별자 감사 메모

- 화면 키는 62개이며 카탈로그에는 61개를 노출한다. 숨김 `discard`가 나머지 1개다.
- `ORD-02`는 `order_detail`과 `order_direct`가 함께 사용한다.
- `SALES-18`은 `channel`과 `tax`가 함께 사용한다.
- `MY-05`는 `my_fixed`와 `my_units`가 함께 사용한다.
- 레시피·부자재 관리 재사용 화면은 `RCP-12`, `RCP-12b`, `RCP-13`을 유지한다.
- UI 매핑은 화면 키를 기준으로 하며 중복 ID는 기능 README에서 별도로 정리한다.

---

## 부록 B. 팝업·조건 상태 레지스트리

호스트 상태 125개는 중복 제거 시 고유 ID 99개다.

| 유형 | 고유 ID | 호스트 상태 |
|---|---:|---:|
| PickerSheet | 27 | 32 |
| FormSheet | 27 | 42 |
| InfoSheet | 16 | 17 |
| ActionSheet | 2 | 2 |
| ConfirmDialog | 15 | 20 |
| SuccessDialog | 1 | 1 |
| ErrorDialog | 1 | 1 |
| PopoverMenu | 1 | 1 |
| PageState | 9 | 9 |
| 합계 | 99 | 125 |

검산식: 고유 ID `27+27+16+2+15+1+1+1+9=99`, 호스트 상태
`32+42+17+2+20+1+1+1+9=125`.

### B.1 PageState · 9개

- `ingredient_option_filled`, `ingredient_option_empty`
- `stock_inbound`, `stock_deduct`, `stock_discard`
- `option_list`, `option_add`, `option_edit`, `option_vendor_new`

`discard_type`, `discard_period`는 숨김 폐기 화면의 옛 상태다. 새 PageState로 사용하지 않는다.

### B.2 PickerSheet · 27개

- 식재료: `sort`, `add_category`, `add_unit`, `edit_category`, `edit_unit`, `stock_option`,
  `option_vendor`, `option_unit`, `stock_period`, `stock_type`, `stock_order`, `purchase_period`.
- 레시피: `recipe_sort`, `recipe_status`, `recipe_target`, `recipe_category_pick`,
  `material_category_pick`.
- 발주: `order_ingredient`, `order_vendor`.
- 매출관리: `sales_sort`, `sales_period`.
- MY: `fixed_period`, `tax_country`, `hours_break_start`, `hours_break_end`.
- 숨김 옛 상태: `discard_type`, `discard_period`.

`order_ingredient`는 검색형, `sales_period`는 적용형 변형이다.

### B.3 FormSheet · 27개

- 레시피: `recipe_memo`, `recipe_ingredient_usage`, `recipe_material_usage`, `material_add`,
  `material_edit`, `category_add`, `category_edit`.
- 고정 지출: `fixed_channel`, `fixed_item_add`.
- 발주: `order_order`, `order_receive`.
- 매출관리: `sales_qty`, `sales_etc`, `sales_expense`, `sales_direct_period`, `expense_add`,
  `past_sale_qty`, `past_etc`, `past_expense`.
- MY: `tax_item_add`, `vendor_add`, `vendor_edit`, `channel_edit`, `hours_start`, `hours_end`,
  `hours_timezone`, `account_delete`.

복합형 `fixed_channel`, `order_receive`, 시간 선택은 선택과 입력을 점진 노출한다. `account_delete`는
확인 문구 입력 FormSheet 다음에 최종 ConfirmDialog를 둔다.

### B.4 InfoSheet · 16개

- 변경·이력: `stock_event_more`, `ingredient_change_detail`, `recipe_change_detail`, `profit_detail`.
- 안내: `recipe_target_help`, `order_price_spike`, `language_preview`.
- 발주 목록: `order_candidates`, `order_waiting`, `order_received`.
- 매출 상세: `sales_menu_profit`, `sales_revenue_all`, `sales_material_detail`,
  `sales_extra_detail`, `sales_fixed_expand`, `stock_check_all`.

`order_price_spike`는 저장 가능한 경고다. `stock_event_more`는 정보와 철회 행동을 분리한다.

### B.5 ActionSheet · 2개

- `option_card_menu`: 구매 링크 열기·수정.
- `sales_state`: 브레이크 시작·영업 종료 같은 상태 명령.

### B.6 ConfirmDialog · 15개

- 재고·구매 링크: `stock_confirm`, `option_delete`, `stock_event_revert`.
- 레시피·마스터: `recipe_stop`, `material_delete`, `category_delete`.
- 발주: `order_cancel`, `order_revert`.
- 매출관리: `sales_break`, `sales_close`, `sales_shortage`, `expense_delete`, `past_save`.
- MY: `vendor_delete`, `channel_disable`.

`sales_shortage`는 오류가 아니라 음수 재고 기록을 계속할지 묻는 확인이다.

### B.7 단일 유형

- SuccessDialog: `tax_saved`.
- ErrorDialog: `stock_error`.
- PopoverMenu: `option_more`.

---

## 부록 C. 현재 격차와 적용 백로그

### C.1 현재 조사 스냅샷

| 항목 | 현재 확인 | 목표 |
|---|---:|---:|
| 글자 크기 | 28종 | `TYPE` 역할로 수렴 |
| 글자 굵기 | 21종 | 승인 굵기만 사용 |
| 모서리 | 23종 | `radius`로 수렴 |
| 최소 높이 | 41종 | `size` 역할로 수렴 |
| 그림자 | 12종 | 공용 shadow 4종 |
| 레이어 값 | 7종 | 의미형 z 토큰 |
| 반응형 분기 | 1개 | Compact/Mobile/Tablet/검수 셸 |
| 포커스 표시 | 없음 | 모든 조작 필수 |
| Safe Area | 없음 | 상·하단 소유권 적용 |
| 로딩 상태 | 없음 | 페이지·섹션·행·버튼 단위 |

프로토타입에는 `safe-area-inset`, `focus-visible`, `prefers-reduced-motion`, `100dvh`가 없고 `100vh`와
단일 media query에 의존한다. 실제 적용 때 다시 측정하고 판본·명령·결과를 기록한다.

### C.2 Opus 공동 검토 Finding 반영표

| ID | 확인된 격차 | 본문 처리 | 구현 상태 |
|---|---|---|---|
| F-01 | 팔레트가 `tokens.ts`와 충돌 | 1.1 코드 심볼 권위 | 미적용 |
| F-02 | 상태 Badge solid 대비 미달 | 1.2, 8.2 출시 차단 | 미적용 |
| F-03 | 중앙 ConfirmDialog와 `ConfirmSheet` 불일치 | 5.1 신규 필수 | 미적용 |
| F-04 | Sheet Safe Area·키보드 회피 부족 | 2.2, 5.4 P0 | 미적용 |
| F-05 | 일부 조작 44px 미달 | 1.4, 8.2 P0 | 미적용 |
| F-06 | Input·Select·Search 높이 불일치 | 1.4 신규 size 토큰 | 미적용 |
| F-07 | 가이드·TYPE·kit 타이포 충돌 | 1.3 `TYPE` 권위 | 미적용 |
| F-08 | locale formatter 화면 연결 부족 | 7.3 | 미적용 |
| F-09 | 미정의 CSS 변수 존재 | 9.1 완료 기준 | 미적용 |
| F-10 | 반응형·viewport 계약 미적용 | 2.1 | 미적용 |
| F-11 | `text.tertiary` 이름 혼동 | 1.1 매핑 명시 | 문서 정리 |
| F-12 | tint 위 작은 글자 대비 미달 | 1.2, 8.2 | 미적용 |
| F-13 | 가이드 패턴명과 kit export 매핑 부재 | 3.1, 4.1, 5.1 | 문서 정리 |
| F-14 | 아이콘명·크기 분산 | 1.6 | 미적용 |
| F-15 | Badge 규격·역할 혼재 | 4.2 세 변형 분리 | 문서 정리 |
| F-16 | Field hint 행간 결함 | 1.3, 3.3 | 미적용 |
| F-17 | `tabular-nums` 적용 예외 불명확 | 1.3, 7.2 | 문서 정리 |
| F-18 | spacing·radius·shadow·z 체계 충돌 | 1.4~1.5 | 일부 문서 정리 |
| F-19 | Web 규칙과 RN 등가 연결 부족 | 8.1 대응표 | 문서 정리 |
| F-20 | 셀렉터별 완료 기준 부족 | 9.1, 9.3 | 후속 매핑 필요 |

### C.3 토큰·컴포넌트 적용 매핑 형식

실제 적용 전 각 행을 다음 구조로 채운다.

| 필드 | 의미 |
|---|---|
| Guide role | 가이드 토큰·컴포넌트·패턴명 |
| Code symbol | `tokens.ts` 또는 kit export |
| Code current | 현재 코드값·상태 |
| Prototype target | CSS 변수·셀렉터·생성 함수 |
| Authority | 코드 권위 / 가이드 목표 / 검수 셸 |
| Gap | 일치 / 값 충돌 / 이름 충돌 / 코드 부재 |
| Action | 그대로 사용 / 가이드 수정 / 신규 구현 / 프로토타입 전용 폐기 |
| Priority | P0 / P1 / P2 |
| Coverage | 화면 키·popup ID |
| Evidence | 파일·줄·검증 결과 |

필수 매핑 대상:

- `T`, `TYPE`, `space`, `radius`, 공용 shadow, `tnum`, `STATUS`, formatter 진입점.
- kit 배럴의 모든 export와 이 문서의 역할명.
- 프로토타입의 공용 CSS 변수·핵심 selector·화면 renderer.
- 신규 필요 `IconButton`, `Toggle`, `StickyAction`, `Row`, `Table`, `KPI`, `ResultField`,
  `ManagementList`, `ConfirmDialog`, `PopoverMenu`.

### C.4 이번 개정에서 수정하지 않은 항목

- 실제 Expo `tokens.ts`와 kit 컴포넌트.
- `full-page-flow-prototype.html`의 CSS·DOM·동작.
- 미정의 CSS 변수, 비표준 굵기, 대비 미달 조합.
- 화면 ID 중복과 라우트.
- DB·RPC·계산·원장 규칙.

이 항목은 후속 구현 승인 뒤 P0→P1 순서로 적용하고 PC·모바일을 분리해 다시 검수한다.
