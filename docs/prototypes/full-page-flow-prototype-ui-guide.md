# 전체 페이지 흐름 프로토타입 · UI 디자인 시스템 상세 가이드

## 0. 문서 계약

### 0.1 역할과 범위

- 상태: 서비스 기준 재검토 개정안
- 개정일: 2026-09-02
- 현재 디자인 동기화 ID: `DS-20260904-025`
- 적용 대상: `docs/prototypes/full-page-flow-prototype.html`, UI 적용 복사본과 향후 Expo 공용 UI
- 등록 인벤토리: 프로토타입 `screen` 키 62개, 팝업·조건 상태 호스트 123개, 고유 ID 98개
  (PRT-182 정정: 이전 표기 `125 / 99`는 `PRT-151`이 `recipe_target_help`를 두 호스트에서
  제거하기 전 수치였다. HTML 레지스트리 실측이 권위이며 `123 / 98`이 맞다.)
- 활성 도달성 검수: `screen` 키 61개, 팝업·조건 상태 호스트 121개, 고유 ID 96개
- 숨김 보존: `discard` 화면 키 1개와 `discard_type`·`discard_period` 상태 2개
- 이번 개정 제외: 실제 Expo 화면, 프로토타입 HTML, DB, RPC
- 공동 검토: Codex 전수검수 + `claude-opus-5` 도메인 대조·UI 가이드·서비스 관점·최종 회귀
  독립 검토. 회차별 범위와 판정은 현재 확정안과 변경 기록에서 관리한다.

이 문서는 같은 역할의 요소가 화면마다 다른 크기·굵기·색상·배치·동작을 갖지 않도록 공통 UI 계약을
정의한다. 화면 문구와 노출 조건은 `full-page-flow-prototype-current-spec.md`, 변경 과정은
`full-page-flow-prototype-changelog.md`가 관리한다.

| 대상 | 단일 원천 |
|---|---|
| 재고·단가·세금·손익·영업일 계산 | `AGENTS.md`, `ARCHITECTURE.md`, DB RPC |
| 화면 ID·라우트·구현 상태 | `apps/mobile/src/features/README.md` |
| Expo 원시 시각값과 공용 구현 | `apps/mobile/src/theme/tokens.ts`, `apps/mobile/src/components/kit/**` |
| UI 목표 행동과 출시 검수 기준 | 이 가이드 |
| 디자인 적용 순서와 화면별 완료 판정 | `full-page-flow-prototype-design-work-plan.md` |
| 최신 디자인 작업 맥락과 다음 시작점 | `full-page-flow-prototype-design-context.md` |
| 화면별 확정 문구·배치 | 현재 확정안 문서 |
| 화면별 적용·PC/모바일 검수 증거 | `full-page-flow-prototype-ui-applied-review.md` |
| 프로토타입 HTML | 검수용 표현과 상호작용 예시 |

벤치마크는 제품 권위를 대체하지 않으며 역할을 다음처럼 분리한다.

| 기준 | 가져올 범위 | 가져오지 않을 범위 |
|---|---|---|
| 캐시노트·오늘얼마 | 정보 구조·디자인 로직·업무 프로세스: 사장님의 첫 질문, 운영 홈의 우선순위, 요약 → 이상징후 → 근거 상세 → 행동 → 리포트 흐름 | POS·카드사 자동 연동, 정산·미지급 추정, 마켓·커뮤니티, 브랜드 자산 |
| 토스 | 타이포 위계, 중립 표면, 절제된 Primary, 컴포넌트 일관성, 가벼운 모션과 접근성 | 금융앱 정보 구조, 금융 업무 퍼널, 거대 마케팅 hero, 추천 피드, TDS 전용 자산 |
| 이 제품 | 5개 탭, 수기 기록, 원장·계산·마감·철회 계약 | 근거 없는 자동화 표현과 외부 서비스 기능 복제 |

여기서 `디자인 로직`은 시각 스타일이 아니라 무엇을 먼저 보여주고, 어디서 상세로 들어가며,
어떤 상태를 확인한 뒤 기록·수정·철회하는지에 관한 화면 구조와 행동 순서를 뜻한다.

벤치마크 근거는 2026-09-01 공개 자료 스냅샷이다. 캐시노트의
[공식 서비스 소개](https://info.cashnote.kr/main)와
[App Store](https://apps.apple.com/kr/app/id1459090715), 오늘얼마의
[공식 사이트](https://www.todaysales.co.kr/)와
[App Store](https://apps.apple.com/kr/app/id1605931675), 토스의
[디자인 시스템 소개](https://toss.tech/article/toss-design-system)와
[인터랙션 시스템 글](https://toss.tech/article/interaction)을 참고한다. 공개 원칙만 참고하며 화면·문구·아이콘·그래픽 자산을 복제하지 않는다.

이 제품은 현재 POS 자동 연동 앱이 아니다. 식재료·재고·발주·입고·매출·손익은 사장님이 직접
기록하고 서버가 그 기록을 확정·계산한다. 기준 서비스의 `실시간·자동` 문법을 그대로 가져오지
않고 `마지막 기록 시각 · 미입력 구간 · 작성/확정 상태`로 같은 수준의 신뢰를 만든다.

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
| 검수 셸 | 제품 UI가 아닌 화면 카탈로그·PC 작업 프레임·시연 substrate 전용 규칙 |

검수 셸 제외는 제품을 보여 주기 위한 바깥 구조에만 적용한다. `.workspace`, `.catalog*`, `.nav-*`,
`.phone` 프레임, `.status`, `.route`, `.edit-menu-stage`, `.sheet-preview-stage`, 두 stage의 backdrop,
`.edit-underlay*`는 `shell-excluded`로 분류한다. 반면 그 안에서 실제 제품 팝업을 표현하는
정확한 wrapper `.prototype-sheet`, `.sheet-preview-card`, `.delete-preview`는 Layer로, Header·Body는
`layer:part`, 내부 행·버튼은 RowGroup·Control, 고정 행동은 LayerFooter로 검수한다. 시연 배경이라는
이유로 실제 제품 표면까지 제외하지 않으며 `.prototype-sheet*` wildcard로 자손까지 Layer 처리하지 않는다.
`shell-excluded`는 해당 selector의 프레임·배경·배치 선언에만 붙으며 자손에게 상속되는 면제가 아니다.
예를 들어 `.phone` 자체의 기기 프레임은 제외하되 `.phone` 안의 제품 Header·본문·하단 탭은 다시
정규 역할로 순회한다.

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
11. 정보 구조와 업무 흐름은 캐시노트·오늘얼마 관점으로 검토하고, 토스는 시각 표현 톤에만 적용한다.
12. 자동 수집 근거가 없는 값에 `실시간`, `LIVE`, `자동 연동`, `자동 집계`를 사용하지 않는다.
13. 집계·요약·손익은 값과 함께 마지막 기록 시각, 미입력 구간, 작성/확정 상태 중 해당 정보를 제공한다.
14. 전체폭 텍스트 행동은 Button이며 IconButton 토큰을 적용하지 않는다. 시각 아이콘 크기와 실제
    터치 영역을 분리하되 터치 영역은 최소 `size.touchMin`을 보장한다.

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
- `TYPE.display`는 화면에서 가장 중요한 매출·재고·순이익 수치에만 사용한다. 마케팅 문장과 일반
  화면 제목을 키우는 용도로 사용하지 않는다.
- `800` 굵기는 제목·핵심값·최종 합계처럼 제한된 요소에만 사용하고 반복 Row 전체에 적용하지 않는다.
- `FieldLabel`은 `TYPE.caption`의 `14 / 600`을 기본으로 하며 강조가 필요한 경우에도 `700`까지만
  허용한다. 필수 여부는 굵기 대신 라벨 뒤 `*`와 의미 속성으로 전달한다.
- Badge·Chip·Filter·짧은 메타는 `TYPE.captionSm`을 공유한다. Badge만을 위한 별도 글자 토큰을
  만들지 않는다. 현재 프로토타입의 `10~12px` Badge·차트 메타는 목표 적용 때 `captionSm`으로
  매핑하며, `13px` 미만을 유지해야 할 근거가 실제 기기 검증에서 생기기 전에는 예외를 추가하지 않는다.
- 내역 Row의 일시는 공용 `HistoryDateTime` 역할 하나를 사용한다. 글로벌 중립 프로토타입과
  formatter 실패 시 표기는 `YYYY-MM-DD · HH:mm`, `TYPE.captionSm`(`13 / 600`), `T.ter`, 한 줄,
  tabular numeral이다. 연도가 없는 `MM/DD · HH:mm` 표기는 월·일 순서와 날짜·시각 맥락이
  모호하므로 사용하지 않는다. 날짜와 시각의 순서·구분점·색·굵기·Row 안의 위치를 화면별로
  다시 선언하지 않는다. 월 그룹 제목은
  `YYYY년 M월`, `TYPE.caption`(`14 / 700`), `T.ter`를 사용한다.

### 1.4 간격·크기·모서리

간격은 `space.xs / sm / md / lg / xl / xxl`, 모서리는
`radius.sm / md / lg / xl / full`을 사용한다. 같은 이름에 다른 값을 문서에서 다시 선언하지 않는다.

Expo 코드의 현재 값을 그대로 사용한다.

| 토큰 | 값 | 기본 사용처 |
|---|---:|---|
| `space.xs` | 4 | 제목과 보조문구, 값과 단위처럼 한 덩어리인 요소 |
| `space.sm` | 8 | 라벨과 입력, 아이콘과 텍스트, 버튼 사이 |
| `space.md` | 12 | 카드 사이, 행의 상하, 관련 컨트롤 묶음 |
| `space.lg` | 16 | 모바일 본문 좌우, 카드 내부, 필드 사이 |
| `space.xl` | 20 | 서로 다른 필드 그룹·섹션 사이, 빈 상태 상하 |
| `space.xxl` | 24 | 큰 업무 구획, 팝업 제목과 독립 본문 구획 사이 |

형제 간격은 관계를 소유한 부모의 `gap`이 담당하고 자식 margin으로 보정하지 않는다. 같은 경계에
padding과 margin을 중복 적용하지 않는다. 목록의 마지막 행, 폼의 마지막 필드, 팝업 본문의 마지막
요소에는 다음 형제용 여백을 남기지 않는다. 레이아웃 여백은 `4 / 8 / 12 / 16 / 20 / 24`만 사용한다.
`1px` 구분선, Safe Area, 컨트롤 고정 크기는 간격 예외이며 새 임의 여백의 근거가 되지 않는다.

| 관계 | 기본값 | 예외·전환 |
|---|---:|---|
| 제품 본문 좌우 gutter | `space.lg` | Compact 320~359는 `space.md`; 넓은 화면은 간격 확대 대신 콘텐츠 최대폭·중앙 정렬 |
| 같은 데이터 그룹 내부 | `space.sm~md` | 제목과 보조문구는 `space.xs` |
| 카드·목록 그룹 사이 | `space.md` | 독립 섹션 경계이면 `space.xl` |
| 필드 사이 / 필드 그룹 사이 | `space.lg / space.xl` | 오류 노출로 다음 필드 간격이 중복되지 않음 |
| 일반 섹션 / 큰 업무 구획 | `space.xl / space.xxl` | 장식 여백으로 첫 화면 핵심 정보를 밀어내지 않음 |

- Header·하단 탭·StickyAction은 각각 자신의 Safe Area를 소유하고 본문 gutter에 inset을 중복해서
  더하지 않는다.
- 페이지 첫 요소는 Header 아래 `space.md`, 마지막 요소는 일반 화면에서 `space.xxl`을 기본으로 한다.
  StickyAction이 있으면 마지막 요소 뒤에 `행동 높이 + space.md + 하단 inset`만큼을 확보한다.
- 2열 입력·요약은 열 사이 `space.md`를 사용하고, Compact·200% 글자 확대·긴 번역에서 잘리면
  순서를 유지한 채 1열로 전환한다. 글자 크기를 줄여 2열을 강제로 유지하지 않는다.
- 입력·버튼·작은 표면은 `radius.md`, 일반 Card는 `radius.lg`, Sheet 상단과 큰 강조 표면은
  `radius.xl`, Badge·Chip·원형 조작은 `radius.full`을 기본으로 한다. `radius.sm`은 내부의 작은
  표면에만 사용하며 중첩 표면이 바깥과 같은 모서리를 갖지 않게 한다.

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

운영 화면의 여백은 정보 구분을 만들되 업무 밀도를 희생하지 않는다. 세부 관계값은 위 표를 따르며,
핵심 값이나 행동을 첫 화면 밖으로 밀어내는 큰 공백은 빈 상태·초기 안내 외에는 사용하지 않는다.

### 1.5 그림자·레이어·모션

- 그림자는 `cardShadow`, `sheetShadow`, `fabShadow`, `sliderThumbShadow`만 공용 원천으로 사용한다.
- 일반 카드에 강한 테두리와 그림자를 동시에 적용하지 않는다.
- 레이어 순서는 `base → sticky → navigation → floating → overlay → dialog → popover → toast`다.
- 현재 z 토큰은 없으므로 공용 z 객체 추가 전까지 화면별 새 값을 늘리지 않는다.
- 모션은 `press / popover / dialog / toast / sheet` 역할로 통일하고 reduced motion을 지원한다.
- 모션은 화면별 연출이 아니라 상황별 공용 컴포넌트와 플랫폼 공통 스펙으로만 정의한다.
- 정적 UI만으로 상태와 결과를 이해할 수 있으면 인터랙션을 추가하지 않는다.
- 반복 Row 순차 등장, KPI count-up, 장식용 bounce·pulse, 차트 자동 재생을 사용하지 않는다.
- 저장 중 진행 표시가 버튼 폭과 라벨 위치를 바꾸지 않아야 한다.

### 1.6 아이콘

- 제품 행동은 공용 `Icon`과 `IconName`을 사용한다.
- 문자 기호를 뒤로가기·검색·수정·닫기·더보기 아이콘으로 사용하지 않는다.
- 크기는 작은 보조 / 일반 / 내비게이션 3역할로 제한한다.
- 아이콘 버튼의 접근 가능한 이름은 `대상 + 행동` 형식으로 작성한다.
- 방향 아이콘은 RTL에서 반전하고 장식 아이콘은 스크린리더에서 제외한다.
- 가이드 이름과 kit `IconName`의 대응 및 누락 아이콘은 부록 C에서 관리한다.

### 1.7 적용본의 단일 공통 레이어

- 적용본의 시각 단일 출처는 `full-page-flow-prototype-ui-components.css`, 역할 매핑 단일 출처는
  `full-page-flow-prototype-ui-components.js`다. 화면별 클래스에 같은 Card·Row·Field 규격을 다시
  선언하지 않는다.
- 공통 역할은 `card / summary / summary-row / section-header / row-group / row / choice-row / field /
  field-multiline / field-label / result / badge / filter / scroll-tabs / segmented / tab / button /
  primary / icon-button / notice / empty / layer / sheet / dialog / popover / layer-title / layer-footer /
  sticky-action / meta / date-time / section-title / row-title / row-sub / value / value-label`로 제한한다.
- 기존 마크업은 이행 기간 동안 역할 매핑 파일이 `data-ui` 토큰을 부여한다. 새 마크업은 처음부터
  같은 `data-ui` 역할을 사용하며 화면 전용 클래스는 구조·도메인 상태만 소유한다.
- 동적으로 생성되는 Sheet·Dialog·Popover에도 같은 역할을 자동 부여해야 한다. 정적 화면만 공통
  규격이고 팝업은 별도 규격인 상태를 허용하지 않는다.
- 공통 CSS 연결, 역할 0개 화면 0건, 활성 popup/state의 레이어 유형 연결, PC·모바일 대표 렌더와
  화면별 재검수가 끝나기 전에는 `공통 적용 PASS` 또는 개별 화면 PASS로 판정하지 않는다.

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
| Sheet·Dialog 내부 고정 행동 | 해당 Layer의 `LayerFooter` |
| FAB | 공용 FAB 배치 컨테이너 |

- inset은 화면과 공용 컴포넌트가 중복 적용하지 않는다.
- 키보드가 열려도 현재 입력과 저장 행동에 접근할 수 있어야 한다.
- 하단 탭 자체를 키보드 위로 올리지 않는다.
- 가로모드와 작은 높이에서도 고정 행동이 본문을 가리지 않아야 한다.
- 현재 `Sheet`의 하단 Safe Area·키보드 회피 부재는 P0 격차다.
- Page `StickyAction`은 제품 페이지 셸이 소유하며 하단 탭 위에 배치하고 페이지 Safe Area만 계산한다.
  `LayerFooter`는 overlay 내부의 Sheet·Dialog가 소유하며 자신의 Safe Area를 계산하고 하단 탭 offset을
  다시 더하지 않는다. 두 고정 행동을 같은 화면 상태에서 동시에 노출하지 않는다.
- Card Footer는 기본적으로 스크롤 콘텐츠이며 고정하지 않는다. Sheet 안에서 Footer가 sticky가 되면
  Card Footer가 아니라 `LayerFooter` 역할로 승격하고 5장의 팝업 계약을 따른다.

### 2.3 스크롤과 위치 복원

- 화면은 기본적으로 하나의 주 세로 스크롤 영역을 사용한다.
- 헤더와 하단 탭은 고정하고 본문만 스크롤한다.
- 고정 행동이 있으면 콘텐츠 하단에 행동 높이와 Safe Area만큼 여백을 둔다.
- 새 화면은 상단에서 시작하고 상세에서 목록으로 돌아오면 필터·검색어·스크롤 위치를 복원한다.
- 팝업이 열리면 배경 스크롤과 조작을 막는다.
- 긴 시트는 제목과 footer를 유지하고 본문만 스크롤한다.

### 2.4 하단 탭과 화면 계층

하단 탭은 `식재료 · 레시피 · 발주 · 매출관리 · MY` 순서를 유지한다.

별도의 여섯 번째 홈을 추가하지 않는다. 각 탭 메인이 해당 업무의 운영 시작점이 되며 기능 링크
목록보다 사장님의 첫 질문에 먼저 답한다.

| 탭 메인 | 첫 질문 | 우선 행동 |
|---|---|---|
| 식재료 | 지금 부족하거나 소진된 재료가 무엇인가 | 재고 수정·발주 이동 |
| 레시피 | 목표에 못 미치거나 판매를 멈춘 메뉴가 무엇인가 | 판매가 시뮬레이션·레시피 수정 |
| 발주 | 지금 처리할 발주·입고가 무엇인가 | 입고 처리·취소 |
| 매출관리 | 오늘 어디까지 기록했고 얼마가 남았는가 | 판매 기록·영업 종료·과거 정정 |
| MY | 계산과 운영에 필요한 설정이 준비됐는가 | 누락 설정 보완·기간 보고서 진입 |

`PrimaryKPI → 우선 이상징후 → 대표 행동` 구성은 `ingredient_main`, `recipe_main`, `order_main`,
`sales_main`에 적용한다. `my_main`은 설정 준비 상태와 누락 항목을 SettingsList·Notice로 보여주며
PrimaryKPI 의무 대상에서는 제외한다.

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
- 채움 Primary와 파란색 강조는 대표 행동·현재 선택·명시적 링크에만 사용한다. 일반 숫자·합계·
  섹션 제목·장식 아이콘·일반 카드 테두리를 파란색으로 만들지 않는다. 계산 결과의 제한적 예외는
  4.4의 ResultField 규칙을 따른다.
- 삭제·철회·계정 해지는 danger를 사용하며 Primary 색을 재사용하지 않는다.
- loading 중 라벨을 유지하고 진행 표시 때문에 폭이 바뀌지 않게 한다.
- 단독 아이콘 행동은 `IconButton`으로 통합하고 문자 아이콘을 넣지 않는다.
- 카테고리 순서 이동은 같은 Row 안에서 한 쌍으로 작동하는 전용 reorder control이다. Row 왼쪽
  `28px` 열에 위·아래 SVG 버튼을 세로로 쌓고 각 버튼은 `28×20px`로 한다. 첫 행의 위·마지막 행의
  아래 버튼은 비활성 처리하며, 두 행동을 `44×44px` 독립 버튼이나 `88px` 가로 묶음으로 확대하지 않는다.
- 전체가 한 경로로 이동하는 interactive Card·Row는 접근성을 위해 semantic `<button>` 또는 link로
  구현한다. 이는 Button **시각 역할**을 Card·Row에 합친 것이 아니다. 금지 대상은 Card·Row 표면 위에
  채움 Primary·danger 같은 Button variant의 표면을 다시 덧입히거나 동일 행동을 별도 Button으로
  중복하는 경우다.

### 3.3 Form·Field·Input

Form은 입력 순서·검증·dirty·제출·실패 복구를 소유하는 조합 계약이다.

`라벨 → 입력 또는 선택 → 도움말/오류`

- 도움말과 오류가 동시에 있으면 오류만 노출한다.
- 제출 시 첫 오류로 이동하고 저장 실패 후 입력값과 선택값을 유지한다.
- Input은 `empty / filled / focused / disabled / readonly / error / warning / validating / success`를 지원한다.
- readonly는 값을 유지하되 편집 단서와 열림 행동을 제거한다.
- 입력 하나마다 개별 Card를 만들지 않는다. 여러 입력이 하나의 업무 단위를 이루면 한 FormGroup 또는
  Card로 묶을 수 있다. 포커스는 경계 변화로 표현하고 glow·강한 그림자를 쓰지 않는다.
- 단위는 suffix, 통화 위치는 locale formatter 결과를 사용한다.
- 계산 결과를 Input처럼 만들지 않고 `ResultField`를 사용한다.

**필드 치수와 세로 리듬**

| 부분 | 규칙 |
|---|---|
| Field 사이 | `space.lg` |
| FieldLabel → Control | `space.sm` |
| Control → FieldMessage | `space.sm`; 메시지가 없으면 빈 높이를 예약하지 않음 |
| Input·Select·Search | 최소 높이 `size.controlDefault`, inline padding `space.lg`, `radius.md`; 큰 글자·긴 번역에서는 높이 확장 |
| 여러 줄 입력 | inline `space.lg`, block `space.md`, 첫 줄 상단 정렬 |
| 2열 Field | 열 사이 `space.md`; Compact·긴 번역·큰 글자에서는 1열 |

입력 내부는 `leading / value / trailing` 세 영역으로 나눈다. `leading`은 아이콘·prefix, `value`는
입력값·placeholder, `trailing`은 단위·suffix·상태·보조 행동을 소유한다. `value`만 남은 폭을 사용하고
`trailing`은 축소되거나 줄바꿈되지 않는다. 글로벌 대응을 위해 구현은 `left/right` 대신 논리 방향
`start/end`와 `padding-inline`을 사용한다. 한국어 LTR 화면에서 start는 좌측, end는 우측이다.

| 입력 내용 | 값 정렬 | leading·trailing 구성 |
|---|---|---|
| 이름·메모·검색어·URL·도메인 | start | 지우기·검색 같은 단일 IconButton만 end |
| 날짜·시각·카테고리·구매처·단위 Select | start | 상태 아이콘 또는 chevron을 end에 한 개 |
| 수량·용량·금액·비율·판매가 | end | `g`, `ml`, `개`, `%` 등 suffix를 값 바로 뒤에 고정 |
| locale이 통화 기호를 앞에 두는 금액 | 숫자 묶음 전체를 end | 통화 기호는 숫자의 prefix로 함께 정렬 |
| 읽기 전용 계산 결과 | Input 사용 금지 | 외부 라벨 + `ResultField` 값 end 정렬 |

- 일반 입력값은 `TYPE.body`, placeholder는 `TYPE.bodyWeak`, suffix·prefix는 `TYPE.caption`을 사용한다.
  placeholder도 실제 값과 같은 방향으로 정렬해 입력 시작 시 값이 움직이지 않게 한다.
- 숫자 입력 variant는 `tnum`과 목적에 맞는 `inputMode`를 사용한다. 같은 종류의 수량·금액·비율은
  한 화면에서 같은 끝선에 맞추며 화면별 임의 정렬을 허용하지 않는다.
- 프로토타입 공용 `prototypeField()`도 suffix가 수량·금액·비율 단위이면 숫자 variant로 판정해 값과
  placeholder를 end 정렬한다. `prototypeForm()`은 별도 입력 마크업을 만들지 않고 이 helper를 호출해
  페이지·FormSheet의 값·단위·접근성 이름을 동일하게 유지한다. 편집 가능한 숫자 Field를 읽기 전용
  값으로 위장하지 않는다.
- 값과 suffix 사이에는 `space.sm` 이하의 한 덩어리 간격만 두고 suffix를 입력 반대편 끝으로 떼어
  놓지 않는다. 값·suffix·아이콘은 서로 겹치거나 두 줄로 갈라지지 않는다.
- 앞·뒤 아이콘은 각각 `size.touchMin` 이상의 유효 영역을 확보하고 값 영역에 그 폭을 예약한다.
  suffix와 행동 아이콘이 함께 있으면 별도 trailing 하위 영역으로 분리한다.
- `value`에는 `min-width: 0`을 보장한다. 긴 숫자·URL은 글자 크기를 줄이지 않고 편집 중 가로 이동
  또는 전체 선택이 가능해야 하며, 200% 글자 확대에서도 필수 단위·오류·행동을 말줄임하지 않는다.
- 필수 표시는 FieldLabel 뒤에 둔다. 도움말·오류·글자 수는 입력 바깥 start에 두고 오류가 도움말을
  대체하며, 오류 아이콘만으로 오류를 전달하지 않는다.

### 3.4 Select·Search·Stepper·Toggle

**Select**

- 단일 선택은 PickerSheet에서 선택 즉시 반영한다.
- 여러 값을 함께 확정할 때만 별도 적용 행동을 둔다.
- `empty / selected / expanded / disabled / readonly / error` 상태를 제공한다.

**Search**

- `header`와 `page` 변형을 구분한다.
- SearchBar 하나가 검색 아이콘·입력·placeholder를 소유한다. 선택창 안에 의미가 같은 작은 `검색`
  라벨이나 설명을 입력 위에 반복하지 않는다.
- 최초 미선택 PickerSheet에는 임의의 첫 항목 체크를 표시하지 않는다. 실제 기본값이 있는 경우에만
  해당 항목을 선택 상태로 표시한다.
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
- 상단 `trigger / sort / period` 필터는 모두 높이 `38px`, 흰 배경, 중립 경계선, 검정 글씨,
  `radius.full`, 우측 아래 화살표를 사용한다. 값이 선택돼도 검정 채움으로 바꾸지 않고 버튼 라벨을
  선택값으로 교체한다.
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
| Card | `Card` | 기존 | group·interactive·selected·loading 보강 |
| Row | `PLRow`만 존재 | 신규 필요 | 일반 행 변형 공통화 |
| Table | 없음 | 신규 계약 | 동일 데이터 모델의 웹 표·모바일 행 |
| KPI | 없음 | 신규 필요 | primary·summary·target·delta·notEntered |
| ResultField | 없음 | 신규 필요 | 입력과 분리한 preview·confirmed 결과 |
| Chart | `Donut`, `TrendChart` | 일부 | Donut만 현재 공식, TrendChart 보류 |
| ManagementList | 없음 | 신규 필요 | 관리·재정렬·행동 구조 공통화 |
| Data state | `QueryState` | 기존 | refreshing·offline·stale·partial·notEntered·draft 확장 |
| Notice | `Notice` | 기존 | 읽어야 하는 정보 안내에 사용 |

**박스·표면 요소 분류**

`박스`는 컴포넌트 이름이 아니다. 화면에 배경·경계·모서리가 있는 사각형을 추가할 때는 아래 역할 중
하나를 먼저 선택한다. 한 요소에 Card+Button, Badge+Chip, FieldControl+ResultField처럼 두 **시각
역할**을 합치지 않는다. interactive Card·Row가 semantic button/link를 사용하는 것은 역할 혼합이
아니다. 새 `.box`·`.panel`·`.tile`을 화면별로 만들지 않고 공용 역할의 variant로 매핑한다.

| 역할 | 목적 | 기본 표면·경계 | 상호작용 | 사용하지 않는 경우 |
|---|---|---|---|---|
| LayoutContainer | 폭·정렬·스크롤·간격 소유 | 배경·경계·모서리 없음 | 없음 | 정보를 묶어 강조해야 할 때 |
| Section | 제목과 한 업무 구획 연결 | 기본적으로 별도 표면 없음 | 제목 행동은 별도 Button | 단순 여백을 만들기 위한 빈 박스 |
| Card | 함께 읽고 판단할 요약·상태·정보 묶음 | `T.surface`, 약한 경계·표면 차이·승인된 `cardShadow` 중 최소 신호, `radius.lg` | `interactive`일 때만 전체 클릭 | 반복 Row 각각, 입력 하나마다, 장식용 강조 |
| CardPart | Card의 Header·Body·RowGroup·Footer 내부 구획 | 부모 Card 표면 재사용, 필요한 한쪽 구분선만 사용 | 행동은 별도 Control | 독립 Card처럼 경계·radius·shadow를 다시 줄 때 |
| RowGroup·Row | 반복 기록·설정·선택지 | Card 안 투명 표면, `T.line2` 구분선 | 행 전체 이동 또는 한 개의 후행 행동 | 같은 행에 이동·편집·메뉴를 중복 제공할 때 |
| FieldControl | 사용자가 입력·선택하는 값 | `T.surface`, `T.line`, `radius.md` | focus·error·disabled·readonly 상태 | 계산 결과나 단순 설명 표시 |
| ResultField·ResultGroup | 미리보기·변경 후·확정 계산값 | `T.surface2`, 약한 경계, `radius.md`; 대표 그룹 한 곳만 tint | 기본 비조작, 상세 이동은 별도 행동 | Input처럼 보이게 하거나 각 결과를 파란 카드로 분리할 때 |
| Notice | 읽어야 할 정보·주의·오류와 다음 행동 | 중립 또는 의미 tint, `radius.md` | 본문은 비조작, 행동은 별도 Button | 짧은 상태를 Badge 대신 긴 박스로 반복할 때 |

- 정보성 Notice는 좌측 상단에 원형 `i` 아이콘을 두고 본문 시작선을 아이콘 뒤에 맞춘다. 아이콘은
  장식 요소로 처리하며, 의미는 아이콘만이 아니라 문장으로 전달한다. 정보 Notice의 최소 높이는
  `48px`, 아이콘은 `20px`, 아이콘과 본문의 시각 간격은 `10px`를 사용한다.
| PrimaryKPI·SummaryKPI | 기간·기준이 있는 핵심 수치 | 중립 표면 우선, 채움 Primary 표면은 화면당 최대 한 곳 | 상세 이동은 명시적 링크·행동 | 모든 숫자를 동일한 KPI 카드로 만들 때 |
| Chart | 시간·비율·구성의 관계를 시각화 | 상위 Section·Card 표면 재사용, mark 자체에 별도 Card 표면 없음 | 데이터 point focus·설명만 제공 | 텍스트 목록·표 없이 핵심값을 차트만으로 전달할 때 |
| EmptyState | 최초 데이터 없음·검색 결과 없음·필터 결과 없음 | Page·Section·Card Body의 현재 상위 표면 재사용 | 대표 복구·추가 행동 최대 한 개 | 실제 값 `0`, loading, 오류를 빈 상태로 대체할 때 |
| Badge | 짧은 상태·비교·메타 | 작은 tint 또는 중립 표면, `radius.full` | 비조작 | 선택·필터·버튼 행동 |
| Chip·Filter | 보기·선택 조건 | 경계 또는 선택 표면, `radius.full` | selected·focused·disabled | 비조작 상태 표시 |
| Button·IconButton | 즉시 행동·이동 | variant별 표면, `radius.md` 또는 원형 | 모든 조작 상태와 접근 가능한 이름 | 설명·값·상태를 버튼처럼 꾸밀 때 |
| Sheet·Dialog·Popover | 현재 화면 위의 선택·입력·확인·문맥 행동 | `T.surface`, 유형별 radius와 승인된 공용 elevation | 모달·포커스·닫기 정책 소유 | 페이지 콘텐츠를 단순히 카드처럼 띄우기 위해 사용할 때 |
| StickyAction·LayerFooter | 페이지 또는 Layer의 대표 행동 묶음 | 소유 셸의 표면·상단 구분선·Safe Area | 내부 Button만 조작 | 일반 Card Footer를 임의로 sticky 처리할 때 |

- `Surface`는 `T.surface*`를 적용하는 저수준 시각 재료이며 독립 제품 요소가 아니다. 화면은 반드시
  Card·FieldControl·ResultField·Notice·Layer처럼 목적이 드러나는 이름으로 사용한다.
- 이 표는 새 시각 variant 목록이 아니라 역할 선택 기준이다. 색·간격·상태·내부 anatomy는 기존
  해당 절을 따르며 이 표에서 화면별 예외나 추가 박스 유형을 만들지 않는다.
- 경계·배경·그림자 중 필요한 최소 신호만 사용한다. 일반 Card는 강한 경계와 그림자를 함께 쓰지 않고,
  실제로 떠 있는 Sheet·Dialog·Popover·FAB에만 명확한 elevation을 사용한다.
- 동일한 사각형의 selected·focused·error 상태가 경계 두께나 padding을 바꿔 크기를 흔들지 않게 한다.
- 조작 가능한 표면만 hover·pressed·focus를 가진다. Badge·ResultField·Notice처럼 비조작 요소에는
  chevron·pressed·손가락 커서를 주지 않는다.
- 프로토타입 검수의 정규 역할 어휘는 `shell-excluded / layout / section / card / card-part /
  row-group / field / result / notice / kpi / empty / badge / control / chart / layer / sticky-action`이다.
  `control`은 `button·icon-button·chip·filter·page-tabs·segmented·select·toggle`, `layer`는
  `sheet·dialog·popover`, `sticky-action`은 `page·layer-footer` subtype을 기록한다. C.3의
  `layer:part`, `row-group:choice-row`, `chart:wrapper·primitive` 표기는 상위 역할을 늘리는 것이 아니라
  wrapper와 내부 anatomy를 구분하는 감사 qualifier다. subtype·qualifier는 새 시각 체계가 아니라 같은
  상위 역할의 동작·구성 계약이다. 두 상위 역할로 동시에 판정되면 중첩 또는 책임 혼합으로 실패 처리한다.
- `shell-excluded`는 0.3에 지정한 시연 substrate만 사용한다. 제품을 실제로 표현하는 Sheet·Dialog·
  Card·Control을 검수에서 빼기 위한 면제 역할로 사용하지 않는다.

기준일·기간·갱신 시각·적용 시점이 필요한 값에는 출처를 함께 표시한다. 음수와 0을 숨기지 않는다.

운영 메인은 `범위·기록 상태 → PrimaryKPI → 확인이 필요한 항목 → 기록·상세 행동 → 보조 정보`
순서를 기본으로 한다. 첫 화면에는 PrimaryKPI 한 개, 우선 이상징후 3개 이하, 대표 행동 한 개를
먼저 두고 나머지는 Row 또는 상세 화면으로 내린다. 모든 기능과 숫자를 같은 무게의 카드로 나열하지 않는다.

### 4.2 Badge와 상태 표시

| 변형 | 목적 |
|---|---|
| StatusBadge | 재고의 `여유 / 소진 임박 / 소진`처럼 도메인 판정 표시 |
| ComparisonBadge | 가격의 `최저 / 최고`, 현재·최신 비교 |
| MetadataBadge | 짧은 중립 메타데이터 |

- 일반 카테고리·구매처를 불필요하게 Badge로 만들지 않는다.
- 한 항목의 Badge 수를 제한하고 의미가 겹치면 본문 값으로 내린다.
- Badge와 Button·Chip은 형태와 상태에서 구분돼야 한다. 조작할 수 없는 Badge에는 pressed·hover
  표현이나 chevron을 주지 않는다.
- Badge의 글자는 `TYPE.captionSm`을 사용한다. 상태별 색·tint는 variant가 소유하지만 글자 크기·굵기를
  StatusBadge·ComparisonBadge·MetadataBadge마다 다시 선언하지 않는다.
- 음수 재고는 Badge로 숨기지 않고 `−750g`처럼 실제 값을 표시한다.
- solid 배경은 흰색 전경 대비가 검증된 조합에서만 허용한다.

### 4.3 Card·Row·Table

- Card의 구조 변형은 `group / interactive / selected / loading`으로 제한한다.
- 반복 데이터는 Row 하나마다 Card를 만드는 대신 하나의 Card 안의 Row 또는 배경 없는 섹션을 우선한다.
- 정보·주의·위험은 기본적으로 Badge·값·Notice로 전달한다. Card 전체 tint는 영역 전체가 같은
  상태일 때만 사용하고 Card 안에 Card를 중첩하지 않는다.
- 일반 Card는 표면 차이 또는 구분선을 우선하며 Popover·Sheet·FAB처럼 실제로 떠 있는 요소에만
  강한 elevation을 사용한다.
- 제목·값·상태를 카드 헤더와 본문에 반복하지 않는다.
- Row는 `primary / labelValue / valuePercent / countAmount / hierarchy / beforeAfter / event / management`
  변형으로 공통화한다.
- 반복 목록의 세로 밀도는 세 종류로만 병합한다. 날짜·제목·보조값의 3줄 기록형은 최소 `92px`와
  상·하 `16px`, 제목·보조값의 2줄 관리형은 최소 `76px`와 상·하 `14px`, 1줄 단순형은 최소
  `60px`와 상·하 `12px`를 사용한다. 연속 Row 사이는 `1px / T.line2` 한 줄만 사용한다.
- 행 전체 이동과 별도 chevron·편집 행동을 중복하지 않는다.
- Table은 웹의 열 의미와 모바일 행 카드의 열 순서·단위·소계·총계를 동일하게 유지한다.
- 레시피의 `재료`와 `부자재`처럼 동급인 원가 그룹은 모두 같은 Footer 소계 행을 사용한다. 소계는
  좌측에 그룹명, 우측에 금액과 판매가 대비 비율을 표시하며 빈 상태도 `0원 · 0.0%`를 유지한다.
- 정렬 가능한 열은 현재 방향을 의미 속성으로 전달한다.

Card는 임의 padding 조합 대신 `Header / Body 또는 RowGroup / Footer` 구조를 사용한다.

| 부분 | 내부 구성 | 간격·정렬 |
|---|---|---|
| Card 외곽 | 표면·약한 경계·`radius.lg` | 폭 100%, Card 목록 부모의 gap `space.md` |
| Header | 제목 묶음, 선택적 상태·행동 한 개 | inline `space.lg`, block `space.md`; 제목 start·행동 end |
| Body | 설명·요약처럼 자유 배치되는 콘텐츠 | 사방 `space.lg`, 관련 항목 `space.sm~md` |
| RowGroup | 반복 Row 묶음 | Body padding 없이 Row가 자체 여백 소유 |
| Row | leading / primary / secondary / trailing | inline `space.lg`, block `space.md`, 기본 최소 `size.rowMin` |
| Footer | 전체보기·추가·보조 행동 | 위 구분선, inline `space.lg`, 최소 `size.controlDefault` |

- Header의 우측에는 현재 상태 또는 한 가지 행동만 둔다. 본문에 이미 있는 재고량·건수·합계를
  반복하지 않고 행동이 없다면 빈 placeholder를 두지 않는다. 제목과 보조문구는 `space.xs`로 묶는다.
- Header와 Body가 연속되면 경계 간격은 Header 하단 또는 Body 상단 한쪽만 소유한다. Header 단독은
  block `space.md`, Body 단독은 사방 `space.lg`를 사용한다.
- RowGroup Card는 바깥 Body padding을 두지 않는다. 각 Row가 block `space.md`, inline `space.lg`를
  소유하고 인접 Row 사이에는 `T.line2` 한 개만 둔다. 내부 Row에 개별 radius를 주지 않는다.
- Row의 `primary`는 `flex: 1; min-width: 0`으로 남은 폭을 차지하고 제목·보조문구를 최대 두 줄로
  쌓는다. `trailing`의 수량·금액·비율·상태·행동은 축소하지 않고 end 정렬하며 숫자는 `tnum`을 쓴다.
- 한쪽이 두 줄이면 첫 줄끼리 맞도록 상단 정렬하고, 단일 값 행은 세로 중앙 정렬한다. 값과 단위는
  같은 baseline에 두며 단위만 다음 줄로 떨어지지 않는다.
- `beforeAfter` 행에서 값이 존재하지 않으면 대시가 아니라 `없음`으로 표시한다. 라벨·이전 값·화살표·
  이후 값은 최소 높이 `56px`, `1px` 중립 경계, `radius.md`의 한 비교 블록 안에 두고, 연속 비교
  블록 사이는 `space.sm`으로 구분한다.
- Badge는 이름 또는 상태 줄 옆에 붙인다. 카드 모서리나 값 열 위에 독립적으로 띄워 소유 대상을
  모호하게 만들지 않는다.
- 행 전체가 이동할 때만 chevron을 end에 둔다. 외부 링크·편집·복수 메뉴 행동은 목적에 맞는 한
  진입 방식만 사용하고 chevron·편집·메뉴를 같은 행에 함께 나열하지 않는다.
- selected·focused·error 전환에서 경계 두께 때문에 Card·Row 크기가 변하지 않게 기본 경계를
  예약하거나 inset 표현을 사용한다. loading skeleton도 실제 콘텐츠와 같은 padding·높이를 유지한다.
- Footer의 단일 행동은 전체 폭으로 배치하고, 두 행동은 성격과 관계없이 320px까지 항상 `1:1`로
  균등 분할한다. 번역문이 길면 글자를 줄이거나 한 열로 바꾸지 않고 버튼 내부 줄바꿈과 높이 확장으로
  처리한다.
- Card Footer는 기본적으로 Card와 함께 스크롤한다. Layer 안에서 화면 아래에 고정되는 순간
  `LayerFooter`로 분류하고 Card padding·하단 탭 offset이 아니라 2.2와 5.2의 Layer 소유 규칙을 적용한다.
- 빈 상태는 Card Body에서 start 정렬을 기본으로 하며 block `space.xl`, inline `space.lg`를 사용한다.
  추가 행동이 있으면 문장 안 링크가 아니라 Footer의 한 가지 행동으로 분리한다.
- Card 안에 다시 Card를 넣지 않는다. 계산 결과 묶음은 같은 Body의 `ResultGroup`, 반복 항목은
  `RowGroup`, 안내는 `Notice`로 표현한다.

### 4.4 KPI와 ResultField

- `PrimaryKPI`는 화면당 최대 하나이며 라벨·값·단위·기준 기간 또는 비교 기준을 함께 가진다.
- `PrimaryKPI`에는 대형 홍보 문장·그라데이션·장식 그래픽을 함께 두지 않는다. 나머지 수치는
  SummaryKPI 또는 Row로 낮춘다.
- KPI는 `마지막 기록 시각 · 미입력 기간 · 작성/확정 상태` 중 해당하는 기록 신뢰 정보를 제공한다.
- 기록이 없는 기간은 0이 아니라 `미입력`으로 표시하고 해당 기록 화면으로 가는 행동을 제공한다.
- loading·값 없음·기록 없음·집계 불가를 모두 0으로 표시하지 않는다.
- 서버 확정 집계인지 화면 미리보기인지 표시한다.
- 자동 수집 근거가 없는 KPI에 `실시간`, `LIVE`, `자동 집계` 라벨을 붙이지 않는다.
- 채움 Primary 색을 쓰는 비행동 요약 표면은 화면당 하나 이하이며 장식 목적으로 사용하지 않는다.
- ResultField는 `preview / afterChange / warning / negative / confirmed / empty / loading / error`를 갖는다.
- ResultField의 라벨은 영역 밖에 두고 영역 안에는 핵심 값을 우선한다.
- 폼 안의 ResultField는 인접한 FieldControl과 같은 열 너비와 control 높이를 사용한다. 값 길이만큼
  줄어드는 배지·pill 형태를 금지하고 `width:100%`, `box-sizing:border-box`, 값 end 정렬을 유지한다.
  ResultGroup의 여러 결과도 각 라벨 아래에서 같은 좌우 시작선과 끝선을 공유한다.
- 자동 계산 ResultField는 `50px` 높이, 좌우 `14px` padding, 값 `16px / 800 / 22px`를 공통으로
  사용한다. 금액·수량·단가는 모두 end 정렬하며, 같은 폼의 입력값보다 임의로 크게 키우지 않는다.
  식재료 구매 단가·재고 변경 결과와 레시피 사용량 비용은 동일한 variant를 사용한다.
- 계산표 행 안에 사용자가 직접 바꾸는 유일한 핵심 입력이 있으면 해당 행은 최소 `76px`, 상·하
  `14px`를 사용한다. 입력칸은 모바일 최소 `180px`, 넓은 시연 화면 최대 `240px`, 높이 `50px`로
  확보하고 값과 단위를 end 정렬한다. 단순 조회 행의 값 영역까지 같은 너비로 늘리지 않는다.
- ResultField의 기본 표면과 값은 중립색이다. 사용자가 방금 바꾼 값의 대표 계산 결과만 파란 tint를
  사용할 수 있으며, 같은 페이지·시트에서는 하나의 ResultGroup 안에 묶는다. 대표 Primary 행동은
  별도 한 개까지 둘 수 있지만, 비행동 파란 표면은 채움 요약 표면과 tint ResultGroup을 합쳐 한 개만
  허용한다.
- 계산 실패를 0으로 대체하지 않는다.

### 4.5 차트·관리 목록·점진적 공개

- 현재 공식 차트는 레시피 상세의 `Donut`이다. 텍스트 목록이나 데이터 표를 함께 제공한다.
- Chart wrapper는 정규 역할 `chart`로 매핑한다. legend·축·라벨·dot·bar·arc는 Chart의 내부 primitive이며
  별도 Card·Badge 역할로 세지 않는다. 데이터 point는 키보드·스크린리더로 같은 값을 확인할 수 있어야 한다.
- `TrendChart`는 데이터·화면 계약 확정 전 보류다. 보류 차트와 현재 프로토타입의 임시 chart selector도
  감사에서는 `chart`로 표기하되, 데이터 계약·텍스트 대체·접근성 검증 전에는 제품 적용 PASS로 판정하지 않는다.
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

팝업 유형은 제목 문구, 본문의 버튼 수, CSS `:has()` 또는 DOM 모양으로 추론하지 않는다. 각 popup ID는
레지스트리에 `host / layerType / dismissPolicy / footerPolicy / renderer`를 명시하고 renderer는
`layerType`에서 결정한다. 공용 `.sheet` 마크업을 사용했다는 사실만으로 Picker·Form·Info·Action·
Confirm·Success·Error를 같은 유형으로 처리하지 않는다. `PageState`는 `layerType`을 갖지 않고 페이지
renderer의 조건 상태로만 등록한다.

### 5.2 공통 구조와 닫기 정책

팝업은 `제목·닫기 / 본문 / 행동`을 구분하고 한 시점에 조작 가능한 팝업 하나만 둔다.

| 유형 | 바깥 영역 | 뒤로가기·Escape | 미저장·처리 중 |
|---|---|---|---|
| PickerSheet | 임시값 없으면 허용 | 허용 | 임시값이 있으면 확인 |
| FormSheet | pristine일 때 허용 | pristine일 때 허용 | dirty면 변경 폐기 ConfirmDialog |
| InfoSheet | 허용 | 허용 | 중요한 읽기 확인은 명시적 닫기 |
| ActionSheet | 허용 | 허용 | 실행 전 상태 변경 없음 |
| ConfirmDialog | 금지 | 취소와 같은 결과 | loading 중 닫기 금지 |
| SuccessDialog | 기본 금지 | 확인과 같은 결과 | 결과가 이미 확정되고 다음 행동이 없는 단순 완료만 허용 |
| ErrorDialog | 금지 | 기본 금지 | 명시적 닫기·재시도 전까지 닫기 금지 |
| PopoverMenu | 허용 | 허용 | 닫힌 뒤 기준 버튼 복귀 |

위험 행동은 ActionSheet에서 즉시 실행하지 않고 ConfirmDialog로 전환한다. 판매 부족처럼 진행이
허용되는 경고는 ErrorDialog가 아니라 계속할지를 묻는 ConfirmDialog다.

팝업별 예외는 부록 B에 `dismissPolicy`로 기록한다. 현재 `tax_saved`는 저장이 이미 완료된 단순
안내이므로 바깥 닫기를 허용하고, `stock_error`는 명시적 닫기 또는 재시도 전까지 바깥 닫기를
허용하지 않는다. `stock_error`에서는 Android Back과 Escape도 비활성화한다.

팝업의 Header·Body·Footer가 각자 여백을 소유하며 첫·마지막 자식 margin으로 보정하지 않는다.

| 부분 | Sheet | 중앙 Dialog | PopoverMenu |
|---|---|---|---|
| 외곽 | 상단 `radius.xl`, 화면 좌우 0 | 화면 좌우 최소 `space.xxl`, `radius.lg` | 기준 버튼과 `space.sm`, `radius.md` |
| Header | inline `space.lg`, 상단 `space.xl`, 하단 `space.md` | 사방 `space.xl` | 별도 Header 없이 접근 가능한 메뉴 이름 |
| Body | inline `space.lg`, 요소 `space.lg`, 폼 그룹 `space.xl` | inline `space.xl`, 행동 전 `space.xl` | 항목 inline `space.md` |
| Footer | 위 구분선, block `space.md`, inline `space.lg`, 하단 inset 추가 | block-start `space.md`, inline `space.xl`, block-end `space.xl`, 버튼 gap `space.sm` | 항목 자체가 행동이며 별도 Footer 없음 |

- Sheet Header는 제목 start, 닫기 IconButton end로 두고 닫기 유효 영역을 `size.touchMin` 이상으로
  만든다. 설명이 필요하면 제목 아래 Body 첫 문단으로 분리하며 제목을 반복하는 작은 소제목은 넣지 않는다.
- 긴 Sheet는 Header와 Footer를 유지하고 Body만 스크롤한다. Footer 높이와 하단 inset만큼 Body
  마지막 여백을 확보해 입력·오류·결과가 버튼 아래에 가려지지 않게 한다.
- `LayerFooter`는 overlay 내부에서 해당 Layer만 소유한다. 페이지 `StickyAction`의 하단 탭 offset을
  더하지 않으며 `.option-card-actions`·`.stock-option-actions`·`.prototype-actions`·`.sheet-actions`
  같은 기존 sticky action은 적용 때 하나의 `LayerFooter` variant로 수렴시킨다.
- FormSheet·ConfirmDialog·선택 Sheet의 두 행동은 모두 `1:1`, 단일 확인은 `1열`을 기본으로 한다.
  이 비율은 `footerPolicy`가 소유하고 화면별 grid 선언으로 덮지 않는다.
- `취소·닫기`는 연한 회색 채움, `완료·저장·확인·적용`은 Primary 파란 채움, 화면 이동·추가·수정처럼
  취소와 다른 보조 행동은 흰 배경에 Primary 파란 선·파란 글씨를 사용한다. 삭제·철회는 위험 의미를
  보존해 연한 빨강 배경과 빨간 글씨를 사용하되 폭은 다른 버튼과 동일하다.
- FormSheet는 3.3의 Field 규격을 그대로 사용하며 팝업 전용 입력 padding을 새로 만들지 않는다.
- 중앙 Dialog의 질문·영향 문장은 start 정렬을 기본으로 하되 짧은 단일 문장만 중앙 정렬할 수 있다.
  버튼은 `아니오/취소 → 예/확정` 순서로 두고 위험 확정만 danger를 사용한다.
- 확인 대상에 이름·수량처럼 서로 다른 값이 둘 이상 있으면 `이름 · 수량` 문장으로 이어 붙이지 않는다.
  중립 DetailBlock 안에서 각 값을 `라벨 + 값`으로 분리하고, 짧은 두 값은 2열로 정렬한다. 라벨은
  `T.ter`, 값은 `T.ink`를 사용하며 단위가 포함된 숫자는 end 정렬한다.
- 확인 대상의 이름·수량·금액 같은 핵심값에는 말줄임표를 사용하지 않는다. 긴 이름과 번역은 줄바꿈을
  허용하며, 2열이 핵심값을 보존하지 못하는 좁은 화면에서는 1열로 전환하고 숫자도 start 정렬한다.
  두 행동 역시 번역문을 수용하지 못하면 1열로 쌓고 대표 행동을 마지막에 둔다.
- PopoverMenu 항목의 텍스트는 start, 보조 단축키·상태는 end에 둔다. 위험 항목은 색과 문구로
  구분하고 즉시 삭제하지 않고 ConfirmDialog로 전환한다. 각 항목은 inline `space.md`, block
  `space.sm`, 최소 높이 `size.touchMin`을 사용한다.

### 5.3 유형별 핵심 규칙

- PickerSheet 단일 선택은 선택 즉시 닫고, 복수·복합 선택만 적용 행동을 둔다.
- 화면 위 FilterChip과 PickerSheet 내부 선택 행을 같은 `filter` 이름으로 묶어도 시각 variant는
  분리한다. FilterChip은 선택 후에도 중립 외곽형을 유지하고 라벨만 선택값으로 교체한다.
  PickerOption의 선택은 정보 표면·Primary 글자·체크 표시를 사용한다.
- FormSheet는 3장의 폼 계약을 사용하고 실패 후 입력을 보존한다.
- InfoSheet가 독립 검색·필터가 필요할 만큼 커지면 전체 페이지로 승격한다.
- ActionSheet는 일반 행동과 위험 행동을 분리한다.
- ConfirmDialog는 중앙 배치, 한 가지 질문, 영향 범위, 안전한 취소, 명시적 확정 행동을 제공한다.
- SuccessDialog는 단순 저장 성공마다 사용하지 않고 다음 단계 확인이 필요할 때만 쓴다.
- ErrorDialog는 기술 오류 코드 대신 문제와 다음 행동을 제공한다.
- PopoverMenu는 화면 경계에서 방향을 바꾸고 작은 화면에서는 ActionSheet로 전환한다.

### 5.4 Safe Area·키보드·포커스

- 하단 팝업은 Safe Area를 footer와 스크롤 여백에 반영한다.
- 앱 하단 탭이 `safe-area-inset-bottom`을 소유하며, 페이지 StickyAction은 탭 높이와 같은 inset만큼
  위에 배치한다. 두 요소가 각자 같은 Safe Area를 중복 더하지 않는다.
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
| Not entered | 대상은 있으나 해당 기간 기록이 없음을 0과 구분하고 기록 행동 제공 |
| Draft | 아직 마감하지 않은 영업일임을 표시하고 마감 또는 계속 기록 행동 제공 |
| Filtered empty | 적용 필터와 초기화 행동 |
| Search empty | 검색어와 지우기 행동 |
| Error | 문제 요약·다시 시도·기존 값 유지 |
| Offline | 마지막 데이터·갱신 시각·재연결 상태 |
| Stale | 오래된 값 표시와 갱신 행동 |
| Permission denied | 필요한 권한과 설정 이동 |
| Partial | 실패 영역만 재시도, 성공 영역 유지 |

최초 빈 상태, 필터 결과 없음, 검색 결과 없음, 기록 없음을 같은 문구로 합치지 않는다. 등록할 대상이
없는 상태와 대상은 있지만 아직 기록하지 않은 상태는 다르다. 중요한 오류를 자동으로 사라지는
토스트만으로 전달하지 않는다.

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
| 매출 | 영업 중 → 브레이크 → 영업 종료 | 상태는 사장님이 직접 전환하고, 확정 전 `작성 중`과 확정 후 `마감 완료`를 구분하며 종료 영업일은 다시 열지 않음 |
| 레시피 | 판매중 ↔ 판매중지 | 재고 부족과 판매 중지 구분 |
| 재고 | 입고·차감·폐기 → 조건부 철회 | 음수 재고를 숨기지 않음 |
| 목표 | 목표 미달 ↔ 목표 달성 | 색 외 텍스트·부호 병행 |

안전재고 미달과 판매 부족을 같은 판정으로 쓰지 않는다. 판매 부족은 음수 재고 기록을 계속할지
확인하되 자동으로 판매를 막지 않는다.

앱은 기기 시각으로 영업 상태를 자동 감지·전환하지 않는다. 상태 전환과 확정은 사장님의 명시적
행동 또는 예정 종료와 고정 유예 뒤 실행되는 서버 자동 마감 응답만 따른다. 마감 후 값은 일반 입력
폼이 아니라 판본 정정 흐름으로 수정한다.

### 6.4 감사·출처·적용 시점

- 변경 원천은 `직접 기록 / 계산 파생 / 원장 사건 / 시스템 보정`으로 구분한다. `계산 파생`은
  저장된 기록에서 서버가 계산한 결과이며 외부 데이터 자동 수집을 뜻하지 않는다.
- 적용 시점은 `현재 반영 / 다음 영업일부터 / 과거 스냅샷 유지`처럼 표시한다.
- 감사 상세는 날짜·시간·대상·수정자·판본과 이전 값 → 이후 값을 제공한다.
- 오프라인·지연 데이터는 서버 확정값처럼 보이지 않게 한다.
- 마지막 기록 시각과 기준 영업일은 집계·요약·손익 화면에서 생략하지 않는다. 기준 월과 그 밖의
  맥락은 필요한 화면에만 표시한다.
- 집계값은 구성별 상세와 원천 기록으로 내려갈 수 있고, 원천 기록에서도 영향받은 집계로 돌아갈 수
  있어야 한다. 이동 전후의 영업일·기간·합계 기준은 바뀌지 않는다.
- `마지막 기록`은 현재 집계에 포함된 원천 수기 기록·원장 사건 중 가장 최근의 서버 확정 시각이다.
  기기 시각·화면 렌더 시각·단순 조회 시각을 사용하지 않으며 해당 기록이 없으면 시각 대신 `미입력`을
  표시한다.
- `최근 수정`은 기존 값의 직접 수정 또는 서버 재계산이 발생한 감사·변경 사건의 최신 시각이다.
  최근 7일 수정 링크에 사용하며 `마지막 기록`이나 데이터 신선도를 대신하지 않는다.

### 6.5 운영 홈, 이상 신호, 리포트

각 탭 메인은 `오늘 상태 → 핵심 수치 → 확인이 필요한 항목 → 기록·상세 행동` 순서를 유지한다.
홈은 통계 전시장이나 기능 링크 모음이 아니라 업무를 시작하는 화면이다.

| 단계 | 사장님의 질문 | 화면 책임 |
|---|---|---|
| 확인 | 지금 무슨 상태인가 | 기준 영업일·기록 상태·PrimaryKPI를 먼저 표시 |
| 진단 | 왜 이런 상태인가 | 판정 기준·영향 수량/금액·발생 시점·출처를 표시 |
| 행동 | 지금 무엇을 해야 하나 | 문맥에 맞는 다음 행동 한 개를 우선 제공 |
| 확인 완료 | 무엇이 바뀌었나 | 저장 결과와 영향받은 재고·단가·손익을 표시 |
| 증명·정정 | 나중에 확인하거나 되돌릴 수 있나 | 원장·수정 이력·판본 정정·조건부 철회로 연결 |

- 이상 항목은 `신호 이름 + 근거 값 + 영향 + 다음 행동 한 개`를 같은 영역에 제공한다. 앱 화면이
  임의 임계값을 계산하지 않고 다음 권위가 내린 판정이나 서버 응답을 표시한다.

| 이상 유형 | 판정 권위 | 기본 행동 |
|---|---|---|
| 미입력 영업일·매출 | 서버 영업일 상태 + 해당 영업일 기록 존재 여부 | 매출 기록 |
| 소진·소진 임박·음수 재고 | `packages/core.stockStateOf`와 서버 재고 원장 | 재고 확인·수정 |
| 입고 예정 미처리 | E7 잔여 입고 수량이 있고 도착 예정 영업일이 서버 현재 영업일 이하이며 E1 입고·E12 취소로 끝나지 않은 상태 | 입고 처리·발주 취소 |
| 목표 미달 | 서버 확정 손익·목표 순이익률 | 판매가 시뮬레이션·레시피 수정 |
| 구매 단가 급등 | 서버/RPC가 제공하는 판정과 비교 기준 | 구매 이력·발주 확인 |
| 저장·원장 실패 | mutation·RPC 실패 상태 | 재시도·오류 확인 |

구매 단가 급등처럼 임계값이 공식 도메인 계약에 없는 항목은 앱이 추정하지 않는다. 서버가 판정과
비교 기준을 제공하기 전에는 운영 이상 목록에서 숨긴다. 새 이상 항목도 데이터 출처·판정 기준·영향·
해결 행동이 함께 확정될 때만 추가한다.
- 조치가 필요 없는 상태는 `확인만`, 처리 대기 상태는 `반영 대기`처럼 구분하고 불필요한 위험색을 쓰지 않는다.
- 요약과 상세는 같은 지표명·영업일·기간·합계 기준을 유지한다.
- 알림은 방금 행동의 실패, 당일 조치가 필요한 이상, 마감 확인, 기간 리포트로 목적을 분리한다.
  같은 사건을 푸시·홈·카드에서 각각 새 경고처럼 중복 생성하지 않는다.
- 운영 알림과 홍보·구매 유도는 같은 우선순위와 시각 형태로 섞지 않는다.
- 일 손익은 영업 중 `작성 중` 값과 영업 종료 후 `마감 완료` 스냅샷을 분리한다. 주·월 비교는
  리포트별 계약이 정한 최소 마감 영업일 수를 충족하고 DB/RPC가 `comparison_available=true`를
  반환할 때만 제공한다. 도메인 훅은 이를 `comparisonAvailable`로 변환한다. 최소 일수 계약이 아직
  없으면 서버 값은 `false`로 두고 비교를 숨기며 `비교할 기록이 부족해요` 상태를 표시한다. 새
  리포트 화면은 별도 화면 계약을 승인받아 추가한다.
- 홈을 금융 자산 스택, 상품 추천 피드, POS 실시간 현황판 구조로 만들지 않는다.

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
| 기록 신뢰 | 기준 + 시각 | `마지막 기록 09/01 21:30` |
| 미입력 | 기간 + 상태, 행동 동반 | `8/31 매출이 미입력이에요.` + `매출 기록` |
| 마감 상태 | 짧은 명사형 | `작성 중`, `마감 완료` |

- 라벨·버튼·Badge에는 마침표를 붙이지 않는다.
- 제목과 같은 보조 설명을 바로 아래에서 반복하지 않는다.
- 의미를 늘리지 않는 `옵션`, `관리`, `미리보기`, `기준`은 제거한다.
- 동일 개념은 현재 확정안의 최종 명칭을 사용한다.
- 비활성 버튼만으로 필수값 누락이나 실행 불가 이유를 설명하지 않는다.
- 작업 화면은 값과 행동을 먼저 말한다. `사장님,`, `쉽고 빠르게`, `한눈에` 같은 홍보 문장을
  화면마다 반복하지 않고 대화형 문장은 빈 상태·도움말·오류·확인에만 제한한다.
- `실시간`, `LIVE`, `자동 연동`, `자동 집계`는 실제 자동 수집 기능과 출처가 있을 때만 사용한다.
  현재는 `오늘 기록 기준`, `마지막 기록`, `기록한 값 합계`를 사용한다.
- 토스식 문구 톤은 짧고 구체적인 평이한 문장이라는 뜻이며, 금융 용어·가벼운 농담·이모지·
  소비자용 마케팅 카피를 복제한다는 뜻이 아니다.

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
- 서버의 시각 원본과 매장 시간대를 권위로 사용하고 기기 locale은 표시 형식에만 사용한다.
- 실제 제품은 locale formatter로 한국어 `2026. 8. 29. 08:52`, 영어(미국)
  `Aug 29, 2026 · 8:52 AM`처럼 현지화한다. formatter를 사용할 수 없는 프로토타입·감사 화면만
  `2026-08-29 · 08:52` 형식을 사용한다.
- 연도를 생략하는 상대 표시는 `오늘 08:52`, `어제 08:52`처럼 날짜 맥락이 문구에 포함될 때만 허용한다.
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
- 기록하지 않은 기간을 `0` 또는 마감 완료로 표시함
- 자동 수집 근거가 없는 값에 `실시간`, `LIVE`, `자동 연동`, `자동 집계`를 표시함
- 집계·요약·손익에서 기준 영업일과 기록 상태를 확인할 수 없음
- 이상 항목에 판정 근거 또는 다음 행동이 없음

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
4. 등록 인벤토리 `screen 62 / popup·state host 123 / unique ID 98`이 HTML 레지스트리와 일치한다.
5. 활성 도달성 대상 `screen 61 / popup·state host 121 / unique ID 96`이 PC·모바일에서 모두 열린다.
   활성 합계는 `61 + 121 = 182`이고, 숨김 보존 3건을 더한 `185`가 전수 스캔 대상이다.
6. 숨김 보존 `discard / discard_type / discard_period`는 활성 목록에 노출되지 않고 직접 진입 시
   `stock`의 폐기 상태로 치환되며 활성 도달성 게이트에서 제외된다.
7. 활성 popup ID는 레지스트리의 `host / layerType / dismissPolicy / footerPolicy / renderer`를,
   PageState ID는 `host / stateRenderer`를 따르며 제목·DOM·CSS로 유형을 추론하지 않는다. 두 집합의
   합계가 활성 popup/state 고유 ID 96개와 일치한다.
8. Compact·Mobile·Tablet·Prototype desktop 폭에서 잘림·겹침이 없다.
9. Web·Android·iOS 접근성 출시 게이트를 통과한다.
10. 미정의 CSS 변수, 금지 굵기, `TYPE` 역할에 매핑되지 않은 제품 글자 크기가 0건이다.
11. 로딩·저장·빈 상태·오류·오프라인의 필수 상태가 검증된다.
12. current-spec·changelog에 판정·예외·증거가 연결된다.
13. 실제 Expo 구현 변경은 저장소 필수 검사를 별도로 통과한다.
14. `ingredient_main / recipe_main / order_main / sales_main` 첫 화면에서 PrimaryKPI 한 개와 우선
    이상징후 3개 이하, 대표 행동 한 개가 구분된다. `my_main`은 명시적 면제다.
15. 이상 항목에서 근거 상세와 처리 화면까지 두 단계 이내로 이동하고 원천 기록까지 추적할 수 있다.
16. 기록 없음과 0, 작성 중과 마감 완료, 미리보기와 서버 확정값이 각각 구분된다.
17. 자동 수집 근거가 없는 `실시간·LIVE·자동 연동·자동 집계` 사용자 노출 문구가 0건이다.
18. 반복 Row를 개별 Card로 감싸지 않는다. 대표 Primary 행동은 화면·시트당 하나 이하이고,
    비행동 파란 표면은 채움 요약 표면과 tint ResultGroup을 합쳐 하나 이하이다.
19. `1px` 구분선·Safe Area·의미 크기 토큰을 제외한 레이아웃 gap·padding·margin은
    `space.xs~xxl` 값만 사용하고 gutter·섹션·Card의 이중 여백이 0건이다.
20. Card는 Header·Body/RowGroup·Footer 중 필요한 부분만 사용하고 제목·값·행동을 중복하지 않는다.
21. 입력값 정렬은 내용 variant 계약과 일치하며 숫자·suffix·아이콘이 겹치거나 줄바꿈되지 않는다.
22. 배경·경계·모서리가 있는 모든 제품 요소가 4.1의 정규 상위 역할 하나로 분류되고, 목적 없는
    generic box와 Card 중첩이 0건이다.
23. C.3의 각 적용 대상이 실제 `Guide role / Code symbol / Prototype target / Authority / Gap /
    Action / Priority / Coverage / Evidence` 행으로 연결된다. 매핑할 대상 이름만 나열한 체크리스트는
    완료 증거가 아니다.
24. `shell-excluded`는 0.3의 stage·backdrop·underlay·카탈로그 substrate에만 쓰고, 실제 제품 Sheet·
    Dialog·Card·Control을 제외한 사례가 0건이다.
25. Chart wrapper는 `chart`로, 내부 mark는 Chart primitive로 분류되며 핵심값의 텍스트 대체가 존재한다.
26. Page `StickyAction`과 `LayerFooter`가 동시에 노출되지 않고 각자 하나의 Safe Area·offset 소유자만 가진다.
27. 최신 디자인 동기화 ID가 UI 적용본·현재 확정안·최신 PRT·적용 검수 기록·맥락 장부에 일치한다.
    공통 변경은 이 가이드와 실행서까지 일치하고 자동 동기화 검사와 PC·모바일 검수가 PASS다.

### 9.2 적용 순서

**P0**

- 토큰 권위·미정의 변수·색상 대비
- 중앙 ConfirmDialog와 Sheet 유형 분리
- popup 레지스트리의 명시적 `layerType`·닫기·Footer·renderer 연결
- Safe Area·키보드·최소 터치 영역
- 접근 가능한 이름·상태·모달 포커스
- 오류·저장 중·오프라인 상태
- locale formatter 연결
- 수기 기록 신뢰 표기, `미입력`, 작성/마감 경계
- 이상 신호의 근거·영향·다음 행동 연결

**P1**

- 타이포·Badge·FieldMessage 규격
- Card·Row·KPI·ResultField
- 정규 역할 어휘와 selector·renderer 실제 매핑
- Page StickyAction·LayerFooter·Card Footer 소유권 분리
- Picker·Filter·Stepper·Toggle
- 관리 목록·재정렬·전체보기
- 반응형과 긴 번역

**P2**

- 실제 데이터 그래프
- 태블릿·가로모드 고급 레이아웃
- RTL·고대비·reduced motion
- hover·pressed 세부 표현

### 9.2.1 최근 확정 공통 적용표

이 표는 새 variant를 추가하는 목록이 아니라, 위 본문 규칙을 실제 화면에 적용할 때 빠르게 확인하는
병합 색인이다. 상세 수치는 연결된 본문 절을 권위로 사용한다.

| 병합 요소 | 확정 공통 규칙 | 적용 범위 | 본문 |
|---|---|---|---|
| ListRow | 3줄 `92/16`, 2줄 `76/14`, 1줄 `60/12`; 내부선 `1px T.line2` | 기록·관리·설정·선택 목록 | 4.3 |
| FieldControl | 문자 start, 숫자 end; 숫자와 suffix는 한 묶음으로 인접 배치 | 페이지·FormSheet의 모든 입력 | 3.3 |
| ResultField | 전체 너비·높이 `50px`; 라벨 외부, 값 end; 계산값 `16/800/22` | 단가·총량·비용·변경 후 값 | 4.4 |
| Notice | 좌측 `20px` 정보 아이콘, 최소 `48px`; 본문 시작선 통일 | 읽어야 하는 안내·주의 | 4.1 |
| Filter | 높이 `38px`, 흰 배경·중립선·검정 글씨·아래 화살표 | 메인·내역의 정렬/기간/상태 | 3.5 |
| LayerFooter | 두 행동 `1:1`, 높이 `48px`, 반경 `12px`, 간격 `8px` | Sheet·Dialog·하단 고정 행동 | 5.2 |
| DetailBlock | 대상명과 수량을 라벨+값으로 분리하고 숫자는 end 정렬 | 확인 Dialog의 대상 요약 | 5.2 |
| BeforeAfter | 값 없음은 `없음`; 각 비교 행을 경계 있는 한 블록으로 표시 | 수정·감사 상세 | 4.3, 6.4 |
| DateTime | locale formatter 우선, 프로토타입 fallback `YYYY-MM-DD · HH:mm` | 목록·상세·팝업 | 7.3 |
| CostGroupFooter | 동급 원가 그룹은 모두 금액·비율 소계를 제공 | 재료·부자재 등 원가 카드 | 4.3 |
| PrimaryEditableRow | 조회 행보다 넓은 입력과 상·하 여백을 부여하되 해당 계산표의 핵심 입력 한 곳만 사용 | 판매가 시뮬레이션 등 | 4.4 |

`목표 순이익률 도움말 제거`, 특정 문구 삭제, 화면별 필터 항목처럼 업무 정책으로 결정된 내용은 이
공통 요소 표에 넣지 않는다. 해당 화면의 screen 계약과 변경 기록에서 관리한다.

### 9.3 검수 기록

| 필드 | 내용 |
|---|---|
| Rule/Finding | 가이드 항목 또는 F-01~F-40 |
| Target | `screen:{key}` 또는 `popup:{id}@{host}`. bare ID는 사용하지 않음 |
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
- 모든 디자인 작업은 `full-page-flow-prototype-design-context.md`에서 `DS-YYYYMMDD-NNN` ID를 먼저
  발급하고 시작 상태를 `IN_PROGRESS`로 기록한다.
- UI 적용본·현재 확정안·changelog 최신 항목·적용 검수 기록·맥락 장부는 매 작업 같은 ID를 가진다.
  공통 규칙 변경이면 이 가이드와 디자인 실행서에도 같은 ID를 기록한다.
- PC·모바일·직접 연결 상태 검수와 필수 문서 갱신이 끝난 뒤 자동 동기화 검사가 `PASS`일 때만 맥락
  장부를 `SYNCED`로 바꾸고 완료로 판정한다.
- 맥락 장부는 최근 작업과 다음 시작점을 연결하는 인계 문서이며 현재 화면 정책·공통 디자인 계약을
  복제하지 않는다. 화면 최종값은 현재 확정안, 공통 규칙은 이 가이드가 계속 권위다.
- 목표안은 적용·재검수·current-spec/changelog 연결 전까지 현재값으로 표현하지 않는다.
- 가이드 패턴명과 RN kit export가 매핑되지 않으면 구현 완료로 보지 않는다.

---

## 부록 A. 프로토타입 screen 키 레지스트리 · 등록 62개 + 미구현 명세 1개

아래 표의 고유 키는 63개다. 이 중 `my_country`(MY-12)는 HTML `screens`에 존재하지 않는
**명세 전용 항목**이고, 나머지 62개가 등록 레지스트리다. 등록 62개 중 `discard`는 숨김 보존이므로
활성 도달 가능 화면은 61개다. 검수 장부의 screen target 62행은 `활성 61 + my_country(SPEC_ONLY) 1`이며,
등록 62개와 숫자가 같지만 구성이 다르다 — 장부는 숨김 `discard`를 세지 않고 `my_country`를 센다.
같은 키가 두 도메인 절에 나오는 경우(4행)는 진입 별칭이며 고유 키 수에는 한 번만 반영한다.

화면 존재·라우트의 권위는 `apps/mobile/src/features/README.md`다. 이 부록은 UI 패턴 연결만 소유한다.
`screen` 키는 PC·모바일에서 각 상태를 독립 검수하기 위한 주소 단위이며 제품의 독립 페이지 수를
뜻하지 않는다. 실제 표시 형태는 기능 README와 현재 확정안이 소유한다. 아래 `기획·프로토타입 ID`는
검수 문서 안의 추적 라벨이며 제품 화면 ID·라우트로 인용하지 않는다.

| popup 성격의 screen 키 | 제품 표시 형태 | 프로토타입 역할 |
|---|---|---|
| `ingredient_edit_menu` | ActionSheet | 상세 위 수정 행동 검수 host |
| `memo_edit` | FormSheet | 메모 수정 검수 host |
| `ingredient_delete` | ConfirmDialog | 삭제 확인 검수 host |
| `order_receive` | OrdersHome 내 FormSheet | 독립 screen host와 popup host를 모두 제공 |

### A.1 식재료

| 화면 키 | 기획·프로토타입 ID | 주요 패턴 |
|---|---|---|
| `ingredient_main` | ING-01 | MainHeader, OperationalSummary, CategoryTabs, SortFilter, ExceptionFirstList, FAB |
| `ingredient_add` | ING-02 | ChildHeader, Field, PickerSheet, ResultField, StickyAction |
| `ingredient_detail` | ING-03 | ChildActionHeader, DetailSummary, KPI, PreviewCard, ConditionalEmpty |
| `ingredient_edit_menu` | ING-03a | ActionSheet, ActionList, DangerAction |
| `ingredient_edit` | ING-04 | ChildHeader, Field, PickerSheet, ResultField, StickyAction |
| `stock_change` | ING-05 | ChildHeader, SegmentedControl, DependentForm, Stepper, ResultField, ConfirmDialog |
| `memo_edit` | ING-03c | FormSheet, TextareaField, Counter, SheetAction |
| `options` | ING-06 | ChildActionHeader, ManagementList, Field, PopoverMenu, ActionSheet |
| `ingredient_delete` | ING-03d | ConfirmDialog, DangerPreview |
| `stock` | ING-07 | ChildHeader, Filter, KPI, EventList, ActionSheet, ConfirmDialog |
| `purchase` | ING-09 | ChildHeader, Filter, KPI, ComparisonBadgeList |
| `ingredient_changes` | ING-03b | ChildHeader, AuditKPI, ChangeList, BeforeAfterSheet |
| `discard` | ING-10 | 숨김 보존, `stock` 폐기 필터 상태로 대체 |

### A.2 레시피

| 화면 키 | 기획·프로토타입 ID | 주요 패턴 |
|---|---|---|
| `recipe_main` | RCP-01 | MainHeader, OperationalSummary, CategoryTabs, Filter, ExceptionFirstList, FAB |
| `recipe_detail` | RCP-02 | ChildActionHeader, StatusSelect, KPI, Donut, CostTable, PreviewCard |
| `recipe_price_sim` | RCP-02c | ChildHeader, NumericField, SegmentedControl, ProfitTable, CalculatedPreview |
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

| 화면 키 | 기획·프로토타입 ID | 주요 패턴 |
|---|---|---|
| `order_main` | ORD-01 | MainHeader, OperationalSummary, StateTabs, ExceptionFirstList, ActionSheet, ConfirmDialog |
| `order_detail` | ORD-02 | ChildHeader, OrderSummary, DependentForm, StickyAction |
| `order_receive` | ORD-03 | FormSheet, OrderSummary, ResultField, ConfirmDialog, InfoSheet warning variant |
| `order_direct` | ORD-02 | ChildHeader, PickerField, NumericField, StickyAction |

### A.4 매출관리

| 화면 키 | 기획·프로토타입 ID | 주요 패턴 |
|---|---|---|
| `sales_main` | SALES-01 | SalesMainHeader, BusinessDayState, PrimaryKPI, EntryActions, RecordedEntryList, NotEnteredNotice |
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

| 화면 키 | 기획·프로토타입 ID | 주요 패턴 |
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
| `my_country` | MY-12 | **미구현 · 명세만 존재** — HTML `screens`에 키가 없다. 목표 패턴은 ChildHeader, CountryChoiceGrid, PriceBasisRadioList, StickyAction |
| `my_language` | MY-08 | ChildHeader, RadioList, StickyAction |
| `my_units` | MY-04 | ChildHeader, SettingsList |
| `my_vendors` | MY-11 | ChildActionHeader, ManagementList, FormSheet, ConfirmDialog |
| `my_channels` | MY-07 | ChildHeader, SettingsList, FormSheet, ConfirmDialog |
| `my_hours` | MY-09 | ChildHeader, Toggle, SegmentedControl, TimePickerSheet, StickyAction |
| `my_notifications` | MY-06 | ChildHeader, ToggleList |
| `my_account` | MY-10 | ChildHeader, AccountSummary, DangerZone, ConfirmDialog |

### A.6 식별자 감사 메모

- 등록 screen 키는 63개이며 카탈로그에는 활성 62개를 노출한다. 숨김 `discard`가 나머지 1개다.
- `discard` 직접 진입은 `stock`의 폐기 필터 상태로 치환하며 독립 화면 열림 게이트에는 포함하지 않는다.
- `ingredient_edit_menu`, `memo_edit`, `ingredient_delete`, `order_receive`는 독립 페이지 수가 아니라
  popup 성격의 검수 host다. Expo 화면 수를 계산할 때 중복 합산하지 않는다.
- `ORD-02`는 `order_detail`과 `order_direct`가 함께 사용한다.
- `RCP-03`은 `recipe_add`와 `recipe_edit`가 함께 사용한다.
- `SALES-18`은 `channel`과 `tax`가 함께 사용한다.
- `MY-02`는 `fixed_average`와 `my_tax`가 함께 사용한다.
- 레시피·부자재 관리 재사용 화면은 `RCP-12`, `RCP-12b`, `RCP-13`을 유지한다.
- UI 매핑은 화면 키를 기준으로 하며 중복 ID는 기능 README에서 별도로 정리한다.

---

## 부록 B. 팝업·조건 상태 레지스트리

현재 `popupTabs` 활성 레지스트리는 호스트 상태 121개, 고유 ID 96개다. 독립 폐기 내역 화면의
옛 필터 상태는 숨김 보존하며 활성 도달성 검수에서는 제외한다.

| 유형 | 등록 고유 ID | 등록 호스트 | 활성 고유 ID | 활성 호스트 |
|---|---:|---:|---:|---:|
| PickerSheet | 27 | 32 | 25 | 30 |
| FormSheet | 28 | 43 | 28 | 43 |
| InfoSheet | 14 | 14 | 14 | 14 |
| ActionSheet | 2 | 2 | 2 | 2 |
| ConfirmDialog | 15 | 20 | 15 | 20 |
| SuccessDialog | 1 | 1 | 1 | 1 |
| ErrorDialog | 1 | 1 | 1 | 1 |
| PopoverMenu | 1 | 1 | 1 | 1 |
| PageState | 9 | 9 | 9 | 9 |
| 합계 | 98 | 123 | 96 | 121 |

등록 검산식은 고유 ID `27+28+14+2+15+1+1+1+9=98`, 호스트 상태
`32+43+14+2+20+1+1+1+9=123`이다. 활성 검산식은 PickerSheet에서 숨김 2개를 뺀
고유 ID `96`, 호스트 상태 `121`이다.
(PRT-182·183 정정: 이전 표기 `99 / 125 / 97 / 123`은 `PRT-151`이 InfoSheet
`recipe_target_help`를 `recipe_add`·`recipe_edit` 두 호스트에서 제거하기 전 수치였다.)

### B.1 PageState · 9개

- `ingredient_option_filled`, `ingredient_option_empty`
- `stock_inbound`, `stock_deduct`, `stock_discard`
- `option_list`, `option_add`, `option_edit`, `option_vendor_new`

`discard_type`, `discard_period`는 숨김 폐기 화면의 옛 상태다. 새 PageState로 사용하지 않으며
직접 URL에서 열 수 없는 휴면 보존 항목이다.

### B.2 PickerSheet · 27개

- 식재료: `sort`, `add_category`, `add_unit`, `edit_category`, `edit_unit`, `stock_option`,
  `option_vendor`, `option_unit`, `stock_period`, `stock_type`, `stock_order`, `purchase_period`.
- 레시피: `recipe_sort`, `recipe_status`, `recipe_target`, `recipe_category_pick`,
  `material_category_pick`.
- 발주: `order_ingredient`, `order_vendor`.
- 매출관리: `sales_sort`, `sales_period`.
- MY: `fixed_period`, `hours_break_start`, `hours_break_end`, `tax_country`.
- 숨김 옛 상태: `discard_type`, `discard_period`. 등록 계수에는 남기고 활성 도달성·닫기 정책
  게이트에서는 제외한다.

`order_ingredient`는 검색형, `sales_period`는 적용형 변형이다.

### B.3 FormSheet · 28개

- 레시피: `recipe_memo`, `recipe_ingredient_usage`, `recipe_material_usage`, `material_add`,
  `material_edit`, `category_add`, `category_edit`.
- 고정 지출: `fixed_channel`, `fixed_item_add`.
- 발주: `order_order`, `order_receive`.
- 매출관리: `sales_qty`, `sales_etc`, `sales_expense`, `sales_direct_period`, `expense_add`,
  `past_sale_qty`, `past_etc`, `past_expense`.
- MY: `tax_item_add`, `vendor_add`, `vendor_edit`, `channel_edit`, `hours_start`, `hours_end`,
  `hours_timezone`, `account_delete`, `language_preview`.

복합형 `fixed_channel`, `order_receive`, 시간 선택은 선택과 입력을 점진 노출한다. `account_delete`는
확인 문구 입력 FormSheet 다음에 최종 ConfirmDialog를 둔다. `order_receive`는 screen 키와 popup ID가
같으므로 검수 증거에는 반드시 `screen:order_receive`, `popup:order_receive@order_main`,
`popup:order_receive@order_receive`처럼 namespace와 host를 함께 기록한다.

### B.4 InfoSheet · 14개

- 변경·이력: `stock_event_more`, `ingredient_change_detail`, `recipe_change_detail`, `profit_detail`.
- 안내: `order_price_spike`.
- 발주 목록: `order_candidates`, `order_waiting`, `order_received`.
- 매출 상세: `sales_menu_profit`, `sales_revenue_all`, `sales_material_detail`,
  `sales_extra_detail`, `sales_fixed_expand`, `stock_check_all`.

`order_price_spike`는 저장 가능한 경고다. `stock_event_more`는 정보와 철회 행동을 분리한다.

### 선과 구획 규칙

- 카드 외곽선은 컨테이너가 `1px #E5E8EB`로 한 번만 소유한다.
- 카드 내부 행·셀 구분선은 부모 구조가 `1px #F2F4F6`로 한 번만 소유한다. 자식 카드나 셀이 같은 모서리에 선을 다시 그리지 않는다.
- 강조선 `#D1D6DB`는 입력·선택 컨트롤의 경계에만 사용한다. 목록 행, 요약 표, 팝업 정보 블록에는 사용하지 않는다.
- 목록은 행의 아래쪽 선만 사용하고 마지막 행은 선을 제거한다. 카드 사이 구분은 선이 아니라 배경과 여백으로 만든다.
- 2열 요약 표는 카드 외곽선, 헤더 아래 가로선, 열 사이 세로선, 두 번째 행 위 가로선만 허용한다.
- 팝업 하단 액션 위 구분선도 내부 구분선과 같은 `#F2F4F6`를 사용한다.

### 최근 기록 정보 팝업

- `stock_event_more`는 공통 InfoSheet 규격을 사용한다: 20px 제목, 16px 상단 간격, 연한 회색 정보 블록, 2열 하단 고정 액션.
- 정보 블록은 외곽선을 쓰지 않고 `#F7F8FA` 배경과 12px 모서리만 사용한다.
- 날짜와 구매처는 같은 줄의 맥락 정보로 묶어 `T.sub` 진한 회색을 사용한다. 처리 유형·수량·포장
  구성은 다음 줄의 핵심 정보로 두고 괄호 안까지 `T.ink` 검정을 유지한다. 같은 문장 안에서
  포장 구성만 약한 회색으로 낮추지 않는다.
- `닫기`와 `철회`는 내용과 분리된 하단 고정 영역에 두며, 두 버튼의 높이·반경·간격은 공통 버튼 규격을 따른다.

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

- SuccessDialog: `tax_saved` — `dismissPolicy=successAfterCommit`.
- ErrorDialog: `stock_error` — `dismissPolicy=errorExplicit`.
- PopoverMenu: `option_more`.

### B.8 활성 ID별 목표 구현 레지스트리

아래 표가 popup 유형과 PageState renderer의 실제 목표 레지스트리다. B.1~B.7의 유형별 이름 목록은
검산용 인벤토리이며 이 표를 대신하지 않는다. 현재 HTML은 대부분의 popup을 generic `.sheet`와
바깥 클릭 닫기로 처리하고 중앙형도 DOM 구조로 추론하므로 아직 이 목표 계약을 구현한 상태가 아니다.

정책 코드는 다음 의미로만 사용한다.

| 구분 | 코드 | 계약 |
|---|---|---|
| dismiss | `pickerImmediate` | 단일 선택 즉시 반영·닫기. 바깥·Back·Escape 허용, 임시값이 생기면 폐기 확인 |
| dismiss | `pickerApplyGuarded` | 적용 전 임시 선택 보존. 바깥·Back·Escape에서 폐기 확인 |
| dismiss | `formDirtyGuard` | pristine이면 닫기 허용, dirty면 변경 폐기 ConfirmDialog |
| dismiss | `infoDismissible` | 바깥·Back·Escape 허용 |
| dismiss | `actionDismissible` | 바깥·Back·Escape 허용, 실행 전 상태 변경 없음 |
| dismiss | `confirmGuarded` | 바깥 닫기 금지, Back·Escape는 취소 결과, loading 중 모든 닫기 금지 |
| dismiss | `successAfterCommit` | 확정 완료 뒤 바깥 닫기 허용, 명시적 확인도 제공 |
| dismiss | `errorExplicit` | 바깥·Back·Escape 금지, 명시적 닫기·재시도만 허용 |
| dismiss | `popoverDismissible` | 바깥·Back·Escape 허용, 닫힌 뒤 기준 Button으로 focus 복귀 |
| footer | `none` | LayerFooter 없음 |
| footer | `formCancelPrimary` | 취소 + 대표 저장·추가·적용, 항상 `1:1` |
| footer | `pickerCancelApply` | 취소 + 적용, 항상 `1:1` |
| footer | `confirmPair` | 취소 + 확정, 기본 `1:1`; 위험 확정만 danger |
| footer | `infoSingleClose` | 명시적 닫기 한 개 |
| footer | `infoCloseAction` | 닫기 + 후속 행동 |
| footer | `actionItems` | Body의 각 항목이 행동이며 별도 LayerFooter 없음 |
| footer | `actionPairFooter` | 요약 아래 동등한 행동 두 개를 LayerFooter에 고정 |
| footer | `acknowledge` | 확인·닫기 한 개 |
| footer | `errorAction` | 닫기 또는 재시도 한 개 이상 |
| footer | `popoverItems` | 메뉴 항목 자체가 행동이며 별도 LayerFooter 없음 |
| footer | `formNextThenConfirm` | 1단계 취소·다음 뒤 2단계 `confirmPair`로 전환 |

**PageState · 활성 9개**

PageState에는 `layerType / dismissPolicy / footerPolicy`를 두지 않는다. 페이지의 하단 행동은
`LayerFooter`가 아니라 2.2의 Page `StickyAction` 계약을 따른다.

| ID | host | stateRenderer |
|---|---|---|
| `ingredient_option_filled` | `ingredient_detail` | `IngredientDetailOptionsState(filled)` |
| `ingredient_option_empty` | `ingredient_detail` | `IngredientDetailOptionsState(empty)` |
| `stock_inbound` | `stock_change` | `StockChangeModeState(inbound)` |
| `stock_deduct` | `stock_change` | `StockChangeModeState(deduct)` |
| `stock_discard` | `stock_change` | `StockChangeModeState(discard)` |
| `option_list` | `options` | `PurchaseOptionPageState(list)` |
| `option_add` | `options` | `PurchaseOptionPageState(add)` |
| `option_edit` | `options` | `PurchaseOptionPageState(edit)` |
| `option_vendor_new` | `options` | `PurchaseOptionPageState(vendorNew)` |

**식재료·구매 링크·재고 · popup 20개**

| ID | host 전체 | layerType | dismissPolicy | footerPolicy | renderer |
|---|---|---|---|---|---|
| `sort` | `ingredient_main` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `add_category` | `ingredient_add` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `add_unit` | `ingredient_add` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `edit_category` | `ingredient_edit` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `edit_unit` | `ingredient_edit` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `stock_option` | `stock_change` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `stock_confirm` | `stock_change` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `stock_error` | `stock_change` | ErrorDialog | `errorExplicit` | `errorAction` | `ErrorDialog` |
| `option_vendor` | `options` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `option_unit` | `options` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `option_card_menu` | `options` | ActionSheet | `actionDismissible` | `actionPairFooter` | `ActionSheet` |
| `option_more` | `options` | PopoverMenu | `popoverDismissible` | `popoverItems` | `PopoverMenu` |
| `option_delete` | `options` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `stock_period` | `stock` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `stock_type` | `stock` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `stock_order` | `stock` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `stock_event_more` | `stock` | InfoSheet | `infoDismissible` | `infoCloseAction` | `InfoSheet` |
| `stock_event_revert` | `stock` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `purchase_period` | `purchase` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `ingredient_change_detail` | `ingredient_changes` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |

**레시피·마스터 공용 · popup 17개**

| ID | host 전체 | layerType | dismissPolicy | footerPolicy | renderer |
|---|---|---|---|---|---|
| `recipe_sort` | `recipe_main` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `recipe_status` | `recipe_main` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `recipe_target` | `recipe_main` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `recipe_memo` | `recipe_detail` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `recipe_stop` | `recipe_detail` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `recipe_category_pick` | `recipe_add`, `recipe_edit` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `recipe_ingredient_usage` | `recipe_edit`, `recipe_ingredient_search` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `recipe_material_usage` | `recipe_material_search` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `material_add` | `recipe_materials`, `my_materials` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `material_edit` | `recipe_materials`, `my_materials` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `material_category_pick` | `recipe_materials`, `my_materials` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `material_delete` | `recipe_materials`, `my_materials` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `category_add` | `recipe_category`, `recipe_material_category`, `my_ingredient_categories`, `my_recipe_categories`, `my_material_categories` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `category_edit` | `recipe_category`, `recipe_material_category`, `my_ingredient_categories`, `my_recipe_categories`, `my_material_categories` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `category_delete` | `recipe_category`, `recipe_material_category`, `my_ingredient_categories`, `my_recipe_categories`, `my_material_categories` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `recipe_change_detail` | `recipe_changes` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `profit_detail` | `profit` | InfoSheet | `infoDismissible` | `infoSingleClose` | `InfoSheet` |

**고정 지출·발주 · popup 13개**

| ID | host 전체 | layerType | dismissPolicy | footerPolicy | renderer |
|---|---|---|---|---|---|
| `fixed_period` | `fixed_average`, `fixed_actual`, `my_fixed`, `my_fixed_edit` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `fixed_channel` | `fixed_actual`, `my_fixed_edit` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `fixed_item_add` | `fixed_actual`, `my_fixed_edit` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `order_candidates` | `order_main` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `order_waiting` | `order_main` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `order_received` | `order_main` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `order_order` | `order_main`, `order_detail` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `order_receive` | `order_main`, `order_receive` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `order_cancel` | `order_main` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `order_revert` | `order_main` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `order_price_spike` | `order_main` | InfoSheet | `infoDismissible` | `infoSingleClose` | `InfoSheet.warning` |
| `order_ingredient` | `order_direct` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet.search` |
| `order_vendor` | `order_direct` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |

**매출관리 · popup 22개**

| ID | host 전체 | layerType | dismissPolicy | footerPolicy | renderer |
|---|---|---|---|---|---|
| `sales_state` | `sales_main` | ActionSheet | `actionDismissible` | `actionItems` | `ActionSheet` |
| `sales_break` | `sales_main` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `sales_close` | `sales_main` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `sales_sort` | `sales_main` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `sales_qty` | `sales_main` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `sales_shortage` | `sales_main` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `sales_etc` | `sales_main` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `sales_expense` | `sales_main` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `sales_period` | `analytics` | PickerSheet | `pickerApplyGuarded` | `pickerCancelApply` | `PickerSheet.apply` |
| `sales_direct_period` | `analytics` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `sales_menu_profit` | `day` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `sales_revenue_all` | `revenue` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `sales_material_detail` | `material` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `sales_extra_detail` | `extra` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `sales_fixed_expand` | `sales_fixed` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |
| `expense_add` | `expense` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `expense_delete` | `expense` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `past_sale_qty` | `sales_past` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `past_etc` | `sales_past` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `past_expense` | `sales_past` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `past_save` | `sales_past` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `stock_check_all` | `stock_check` | InfoSheet | `infoDismissible` | `none` | `InfoSheet` |

**MY · popup 15개**

| ID | host 전체 | layerType | dismissPolicy | footerPolicy | renderer |
|---|---|---|---|---|---|
| `tax_country` | `my_tax` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `language_preview` | `my_language` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `tax_item_add` | `my_tax` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `tax_saved` | `my_tax` | SuccessDialog | `successAfterCommit` | `acknowledge` | `SuccessDialog` |
| `vendor_add` | `my_vendors` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `vendor_edit` | `my_vendors` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `vendor_delete` | `my_vendors` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `channel_edit` | `my_channels` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `channel_disable` | `my_channels` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |
| `hours_start` | `my_hours` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `hours_end` | `my_hours` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `hours_break_start` | `my_hours` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `hours_break_end` | `my_hours` | PickerSheet | `pickerImmediate` | `none` | `PickerSheet` |
| `hours_timezone` | `my_hours` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `account_delete` | `my_account` | FormSheet → ConfirmDialog | `formDirtyGuard` → `confirmGuarded` | `formNextThenConfirm` | `AccountDeleteFlow` |

`account_delete`는 하나의 URL ID 안에서 `form / confirm` 내부 단계를 명시적으로 갖는 흐름이며,
renderer가 현재 단계를 소유한다. `order_receive`처럼 screen 키와 popup ID가 같은 경우 증거 키에는
항상 `screen:order_receive`와 `popup:order_receive@{host}` namespace를 구분한다.

| `account_delete` 내부 단계 | layerType | dismissPolicy | footerPolicy | renderer |
|---|---|---|---|---|
| `account_delete/form` | FormSheet | `formDirtyGuard` | 취소 + 다음 | `AccountDeleteFlow.form` |
| `account_delete/confirm` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `AccountDeleteFlow.confirm` |

활성 레지스트리 검산은 PageState `9` + popup `87`, 합계 고유 ID `96`이다.
각 ID의 host를 펼치면 활성 host 상태 `121`과 일치해야 한다.
그룹별 소계는 표의 행 수가 아니라 **고유 ID 수**다: `20 + 17 + 13 + 22 + 15 = 87`.
`account_delete`처럼 한 ID가 2단계로 나뉘어 표에 여러 행으로 나타나는 경우가 있어 행 수와
ID 수는 일치하지 않는다.
(PRT-184 정정: 이전 표기 `9 + 88 = 97` / host `123`은 `PRT-151`의 `recipe_target_help`
제거 이전 값이었다. 또한 `tax_country`·`language_preview`가 활성 `popupTabs`에 있는데
B.2·B.3·B.8 이름 목록에서만 빠져 있었다 — 유형별 등록 계수에는 이미 포함돼 있었다.
두 ID는 검수 장부에 `TODO`로 등록한다.)
(PRT-186 정정: 위 괄호에 있던 "두 ID는 현재 renderer가 없어 열리지 않는다"는 서술은
**사실이 아니어서 삭제했다.** `PRT-185`가 B.8 표는 고쳤으나 이 문장을 놓쳤다.
실제 경로는 아래 B.8a 실측표에 있다.) 숨김 `discard_type`·`discard_period`는
B.1~B.2에만 보존하고 이 활성 레지스트리에는 넣지 않는다.

### B.8a 활성 96개 ID의 실제 렌더 경로 · 실측

`renderer` 열은 **목표** 계약이다. 아래는 현재 적용본이 실제로 타는 **구현** 경로이며,
96개 ID를 전부 URL로 직접 열어 측정했다. 목표와 구현의 차이는 B.8 서문이 이미 밝힌
대로이며, 이 표는 "renderer가 없다"는 주장을 낼 때 근거로 삼는 유일한 실측 자료다.

**이 절의 모든 수치는 아래 산출물에서만 인용한다.** 손으로 세거나 눈으로 확인한 값을
적지 않는다.

| 항목 | 값 |
|---|---|
| 측정 스크립트 | `full-page-flow-prototype-render-audit.mjs` |
| 결과(target별 원시 로그) | `full-page-flow-prototype-render-audit.json` |
| 알려진 미해결 목록 | `full-page-flow-prototype-render-audit-known.json` |
| 재현 | 저장소 루트에서 `pnpm prototype:audit` (최초 1회 `pnpm prototype:audit:setup`) |

`playwright`는 루트 `package.json`의 devDependency로 **정확한 판본을 고정**하고
`pnpm-lock.yaml`에 잠갔다. 재현 명령이 현재 checkout에서 그대로 돈다.

결과 JSON의 `manifest`가 측정 스크립트 SHA-256, 대상 적용본 SHA-256, 동기화 ID,
node·playwright·chromium 판본, 패스 정의를 담는다.
`full-page-flow-prototype-design-sync-check.ps1`이 이 셋(적용본 SHA·동기화 ID·스크립트 SHA)을
현재 파일에서 다시 계산해 대조하므로 **적용본이 바뀌면 증거가 자동으로 무효가 되고 게이트가
막힌다.** 게이트는 나아가 산식(활성+숨김=측정, screen+popup쌍=활성), target 중복 0,
4개 패스 존재, 그리고 **0이어야 하는 지표의 위반을 알려진 미해결 목록과 양방향으로 대조**한다 —
목록에 없는 위반이 나오면 새 회귀이므로 실패하고, 목록에 있는데 재현되지 않으면 낡은 예외이므로
실패한다. 그래서 그 목록은 무시 목록이 아니라 **고쳐야 할 것의 정확한 잔여 목록**이다.

**검수 패스 4종** — 이름이 계약을 정확히 말한다.

| 패스 | 뷰포트 | 모드 | 무엇을 보는가 |
|---|---|---|---|
| `pc` | 1280×900 | 원본 | 데스크톱 기본 |
| `mobile320` | 320×720 | 원본 | 최소 폭 |
| `mobile320z2` | 320×720 | `cssZoom2` | **CSS 전체 확대.** 레이아웃까지 함께 커진다 |
| `mobile320t2` | 320×720 | `textOnly2` | **글자만 200%.** 큰 글꼴 계약은 이쪽이다 |

`zoom`은 글자 확대가 아니다. 두 가지는 다른 계약이므로 패스를 나눠 각각 측정한다.
각 패스에서 `.phone` 내부 넘침과 **viewport 경계 이탈**을 함께 본다 — 확대된 `.phone`이
화면 밖으로 나가는 경우는 내부 `scrollWidth` 비교로 잡히지 않는다. 가로 스크롤 컨테이너
안이거나 보이지 않는 요소는 이탈로 세지 않는다.

**함께 단언하는 것**

- 콘솔 — 미처리 예외(`pageErrors`)와 `console.error`(`consoleErrors`)를 **분리해** 센다.
  `pageerror`만 구독하면 `console.error()`는 잡히지 않는다.
- 숫자 — 직접 text node뿐 아니라 `<input>`·`<textarea>`의 값과 placeholder,
  `contenteditable` 텍스트까지 검사한다(현재 확정안 2.15의 "text node와 입력값 전체").
- 굵기 — **선언값과 computed를 분리한다.** 선언값은 `300·500·650·750·850·900`을 전부 금지하고
  CSS 규칙과 인라인 `style` 양쪽에서 찾는다(`@font-face` at-rule은 계약 대상이 아니라 제외).
  computed는 `900`을 뺀 나머지를 금지한다 — computed `900`은 `b·strong`의 브라우저 `bolder`
  파생이며 렌더 face는 `800`과 같다.
- 폰트 — `document.fonts.ready`는 **폰트가 실패해 대체 글꼴로 정착해도 resolve된다.**
  네 face를 `document.fonts.load()`로 명시 적재한 뒤 `document.fonts.check()`로 단언하고,
  100px 프로브의 실측 폭이 넷 다 구분되는지 확인한다. `PRT-182`에서 실제로 있었던
  "`@font-face` descriptor 손상"은 이 검사로만 잡힌다.

| 경로 | 개수 | 진입 방식 | 해당 ID |
|---|---:|---|---|
| A | 61 | `openPopupTab()` → `openActualPopup()` map → `showPrototypeSheet()` | `tax_country`, `language_preview`, `tax_item_add` 등 |
| B | 20 | `openPopupTab()`의 단일 ID 분기 → 전용 `open*()` | `sort`, `fixed_period`(→`openFixedPeriod()`), `sales_period`, `stock_period`·`stock_type`·`stock_order`·`purchase_period`(→`openHistoryFilter()`) 등 |
| C | 15 | `openPopupTab()`의 복합 조건 분기 → 상태 변경 + `render()`, 일부는 이어서 `open*()` | `stock_inbound`·`stock_deduct`·`stock_discard`, `option_list`·`option_add`·`option_edit`·`option_vendor_new`·`option_more`·`option_delete`, `ingredient_option_filled`·`ingredient_option_empty`, `stock_confirm`·`stock_error`, `stock_event_more`·`stock_event_revert` |

- **renderer가 없는 활성 ID는 0개다.** 96개 모두 `openPopupTab()`에 처리 분기가 있고
  실제로 렌더된다. 어떤 ID에 대해서도 "미구현·renderer 없음"이라고 적을 근거가 없다.

**렌더 산출물 분포 · 실측 96개**

| 산출물 | 개수 | 판정 근거 |
|---|---:|---|
| PageState — `#content`만 변경, Layer 없음 | 9 | B.1의 9개와 정확히 일치 |
| 주 `#overlay` 기반 Layer | 86 | `#overlay.open` |
| 독립 Layer — `.option-popover-layer` | 1 | `option_more`. `openOptionMore()`(HTML 926행)가 `.option-popover-layer`와 `role="menu"`인 `.option-popover`를 만들어 `.phone`에 붙인다 |

- **Layer 합계 87개**(주 overlay 86 + 독립 1), PageState 9개. 합 96.
- `option_more`의 B.8 목표 분류 `PopoverMenu`는 **현재 구현과 일치한다.** 주 `#overlay`를
  쓰지 않을 뿐 PageState가 아니다. 다만 독립 DOM을 만들므로 공용 focus·닫기 계약과
  분리돼 있고, 이 점은 부록 C `layer:popover-wrapper` 항목에서 별도로 다룬다.
- 시트 본문이 3요소 미만인 경우는 0건이다.
- (PRT-187 정정: `PRT-186`은 `#overlay`만 보고 측정해 `option_more`를 "현재 구현은
  페이지 상태"라고 적었다. **틀렸다.** 독립 레이어를 탐지하지 못한 측정의 한계였고,
  같은 가이드의 부록 C가 이미 독립 DOM 생성을 기록하고 있어 문서가 자기모순 상태였다.
  `.phone` 자식 노드까지 훑어 재측정했다.)
- (PRT-188: 그 재측정이 임시 환경의 일회성 스크립트였고 저장소에 남지 않아 제3자가
  재현할 수 없었다. 스크립트와 target별 원시 로그를 저장소에 보존하고 게이트에 결속했다.
  이때 초판 스크립트가 `ingredient_option_filled`·`stock_inbound`·`option_list` 3건을
  `none`으로 잘못 분류하는 것이 드러났다 — **PageState를 "`#content`가 host 기본 상태와
  다른가"로 판정한 탓**이며, 이 셋은 host의 기본 상태 그 자체여서 차이가 0이다.
  판정 근거를 `openPopupTab` 처리 분기 유무로 바꿔 고쳤다. 보존이 곧 검증이 된 사례다.)

### B.9 popupTabs 밖의 제품 Layer 시연 host

아래 화면 키는 URL popup ID가 아니라 Layer를 전체 화면 안에서 시연하는 host다. 활성 popup ID 96개
검산에는 더하지 않지만 `shell-excluded`의 자손 제품 검수에서는 제외하지 않는다.

| screen key | 제품 역할 | dismissPolicy | footerPolicy | 목표 renderer |
|---|---|---|---|---|
| `ingredient_edit_menu` | ActionSheet | `actionDismissible` | `actionItems` | `ActionSheet` |
| `memo_edit` | FormSheet | `formDirtyGuard` | `formCancelPrimary` | `FormSheet` |
| `ingredient_delete` | ConfirmDialog | `confirmGuarded` | `confirmPair` | `ConfirmDialog` |

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
| 자동·실시간 암시 | HTML 클래스·옛 렌더러명에 복수 존재 | 기록 기반 명칭과 상태로 교체 |
| 필드 라벨 굵기 | 현재 확정안 `14 / 800` | `14 / 600`, 강조 시 최대 `700` |
| 계산 결과 강조 | 파란 ResultField 반복 | 중립 기본 + 대표 ResultGroup 한 곳만 tint |

프로토타입에는 `safe-area-inset`, `focus-visible`, `prefers-reduced-motion`, `100dvh`가 없고 `100vh`와
단일 media query에 의존한다. 실제 적용 때 다시 측정하고 판본·명령·결과를 기록한다.

`sales-hero`, `sales-live-*`, `business-state`처럼 자동 연동 서비스의 문법에서 유래한 HTML 클래스와
옛 렌더러 이름이 남아 있다. 부록 A의 목표 매핑은 `DetailSummary`, `CalculatedPreview`, `PrimaryKPI`,
`RecordedEntryList`처럼 기록 기반 이름을 사용한다. HTML 클래스와 렌더러는 후속 적용 단계에서 함께
정리한다.

### C.2 공동 검토 Finding 반영표

`문서 정리`는 목표 계약을 이 가이드에 명시했다는 뜻이며 프로토타입·Expo 적용 완료를 뜻하지 않는다.
`미적용`은 목표는 정해졌지만 구현이 아직 따르지 않는 상태, `일부 문서 정리`는 계약 일부가 남은
상태, `후속 매핑 필요`는 실제 셀렉터·kit export 연결이 남은 상태다.

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
| F-21 | 캐시노트·오늘얼마의 업무 로직과 토스 시각 톤 역할이 불명확 | 0.1, 0.4 | 문서 정리 |
| F-22 | `sales-live-*`·`LiveList`가 자동 실시간 문법을 암시 | 0.4, 4.4, A.4 | 미적용 |
| F-23 | 기록 없음과 실제 0을 구분하는 상태 부재 | 4.4, 6.1 | 미적용 |
| F-24 | 마지막 기록 시각·작성/마감 상태가 선택 사항 | 4.4, 6.3~6.4 | 미적용 |
| F-25 | 이상 신호와 근거·영향·다음 행동 연결 계약 부재 | 6.5 | 문서 정리 |
| F-26 | 요약 → 구성 상세 → 원천 기록의 기준 유지·양방향 추적 부재 | 6.4~6.5 | 문서 정리 |
| F-27 | 토스 톤을 거대 hero·전면 카드화·파란색 남용으로 오해할 위험 | 1.3~1.5, 3.2, 4.3~4.4 | 문서 정리 |
| F-28 | 운영 알림·마감·기간 리포트의 목적과 중복 방지 계약 부재 | 6.5 | 문서 정리 |
| F-29 | 등록 인벤토리와 활성 도달성 계수가 섞이고 popup 성격의 screen 키를 제품 페이지로 오인할 위험 | 0.1, 9.1, A.6, B | 문서 정리 |
| F-30 | screen 키와 popup ID `order_receive` 중복으로 검수 증거 식별이 모호함 | 9.3, B.3 | 문서 정리 |
| F-31 | `Hero`·`Live` 명칭과 파란 ResultField·FieldLabel 굵기가 목표 시각 톤과 충돌 | 1.3, 3.2, 4.4, A, C.1 | 문서 정리 · 구현 미적용 |
| F-32 | 마지막 기록·최근 수정, 팝업 닫기, 비교 가능 조건과 이상 판정 출처가 결정 가능한 값으로 부족 | 5.2, 6.4~6.5, B.7 | 문서 정리 · 구현 미적용 |
| F-33 | 페이지·카드·필드의 관계별 여백과 입력 내용별 start/end 정렬이 결정되지 않음 | 1.4, 3.3, 4.3, 5.2 | 문서 정리 · 구현 미적용 |
| F-34 | `box`·`panel`·`tile` 형태를 목적 없이 재사용해 Card·Field·Result·Notice의 의미가 혼재할 수 있음 | 4.1 | 문서 정리 · 구현 미적용 |
| F-35 | 시연 stage·backdrop·underlay와 실제 제품 Layer의 검수 제외 경계가 없음 | 0.3, 4.1, 9.1 | 문서 정리 · 구현 미적용 |
| F-36 | Card+Button 금지가 interactive Card의 semantic button까지 금지하는 것으로 읽힘 | 3.2, 4.1 | 문서 정리 |
| F-37 | Chart는 kit 표에 있으나 정규 단일 역할 어휘에서 빠져 selector 판정 불가 | 4.1, 4.5, 9.1 | 문서 정리 · 구현 미적용 |
| F-38 | Page StickyAction·LayerFooter·Card Footer의 Safe Area·offset 소유권이 연결되지 않음 | 2.2, 4.3, 5.2 | 문서 정리 · 구현 미적용 |
| F-39 | C.3가 매핑 대상만 나열하고 실제 selector·renderer별 역할·격차·조치 행을 갖지 않음 | 9.1, C.3 | 1차 매핑 · 전수 확장 필요 |
| F-40 | popup 유형을 generic Sheet·제목·DOM 구조로 추론해 닫기·배치 정책이 달라질 수 있음 | 5.1~5.2, B | 문서 정리 · 구현 미적용 |

### C.3 토큰·컴포넌트 적용 매핑 형식

실제 적용 전 각 행을 다음 구조로 채운다. 이 문서에 대상 이름을 적는 것만으로는 매핑 완료가 아니다.

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

현재 프로토타입에서 충돌 위험이 큰 공용 selector·renderer의 **1차 확정 매핑**은 다음과 같다.
이 표는 적용 출발점이며 전체 182개 시각 class token과 145개 표면 규칙은 같은 형식으로 확장해야 한다.

| Guide role | Code symbol | Prototype target | Authority | 현재 Gap | Action | Priority | Coverage | Evidence |
|---|---|---|---|---|---|---|---|---|
| `shell-excluded` | 제품 kit 없음 | `.workspace`, `.catalog*`, `.nav-*`, `.phone`의 프레임 선언, `.status`, `.route`, `.edit-menu-stage`, `.sheet-preview-stage`, 두 stage backdrop, `.edit-underlay*` | 검수 셸 | 제품 외 substrate와 실제 Layer가 같은 phone DOM에 있음 | substrate 선언만 감사 제외하고 자손 제품 표면은 다시 순회 | P0 | 전체 카탈로그 | HTML 10~14, 48~49행 |
| `layer:sheet-wrapper` | 현재 `Sheet`; 목표 Picker·Form·Info·Action Sheet renderer | `.overlay > .sheet`, `showPrototypeSheet()`, `openPopupTab()` | 가이드 목표 | 하나의 generic Sheet renderer가 여러 `layerType`을 혼합 | popup registry의 `layerType`으로 Sheet renderer를 분기하고 wrapper만 `layer`로 매핑 | P0 | Picker·Form·Info·Action Sheet 전체 | HTML 27, 511, 585행 |
| `layer:dialog-wrapper` | 목표 `ConfirmDialog`, `SuccessDialog`, `ErrorDialog` | `.overlay.confirm-alert > .sheet`, `.delete-preview` | 가이드 목표 | 중앙 Dialog가 Sheet selector·DOM 판정 또는 별도 preview CSS를 사용 | 공용 중앙 Dialog wrapper로 수렴하고 registry 값으로 유형 분기 | P0 | Confirm 15·Success 1·Error 1 ID와 삭제 preview | HTML 28, 48, 734행 |
| `layer:popover-wrapper` | 목표 `PopoverMenu` | `.option-popover-layer > .option-popover`, `openOptionMore()` | 가이드 목표 | 독립 DOM 생성으로 공용 focus·닫기 계약과 분리 | anchor·focus 복귀·작은 화면 ActionSheet 전환을 Popover renderer가 소유 | P0 | `popup:option_more@options` | HTML 53, 499행 |
| `layer:preview-wrapper` | 제품 kit 없음; 목표 Action·Form Sheet preview renderer | 정확한 wrapper `.prototype-sheet`, `.sheet-preview-card` | 가이드 목표 | stage substrate와 같은 구획에 있어 실제 Layer까지 제외될 위험 | wrapper만 `layer`로 매핑하고 `.prototype-sheet*` wildcard 사용 금지 | P1 | `ingredient_edit_menu`, `memo_edit`, 재고 변경 preview | HTML 48행 |
| `layer:part` | 목표 Layer Header·Body anatomy | `.prototype-sheet-title`, `.sheet-preview-title`, `.sheet-preview-body` | 가이드 목표 | Layer 내부 anatomy가 CardPart 또는 독립 Layer로 중복 집계될 수 있음 | 부모 Layer 표면을 재사용하고 Header·Body subtype으로만 기록 | P1 | 시연 Layer 내부 | HTML 48, 73행 |
| `row-group` | 목표 `Row` | Layer 내부 `.prototype-sheet-group` | 가이드 목표 | ActionSheet 메뉴 그룹이 Layer wildcard에 흡수될 수 있음 | Layer Body 안의 투명 RowGroup으로 분류 | P1 | `ingredient_edit_menu` ActionSheet | HTML 48행 |
| `control:layer-action` | `Button`; 목표 `IconButton`, Layer item variant | `.prototype-sheet-row`, `.prototype-sheet-close`, `.sheet-preview-tab`, `.sheet-choice`, `.sheet-actions button`, `.delete-preview-actions button`, `.option-popover button` | 코드 권위+가이드 목표 | Layer wildcard가 Action·Tab·Close까지 Layer로 흡수할 수 있음 | button·icon-button·page-tabs·choice·menu-item subtype으로 각각 기록 | P1 | 시연 Sheet·Dialog·Popover 내부 행동 | HTML 48, 53, 65, 73행 |
| `sticky-action:page` | 목표 `StickyAction` | `.bottom-action` | 가이드 목표 | 페이지 행동과 Layer 행동의 offset 소유권 혼재 | 하단 탭 위에 배치하고 페이지 Safe Area만 계산 | P0 | CTA가 고정된 PageState | HTML 20, 43행 |
| `sticky-action:layer-footer` | 목표 `LayerFooter` | `.option-card-actions`, `.stock-option-actions`, `.prototype-actions`, `.sheet-actions` | 가이드 목표 | 서로 다른 sticky CSS와 Sheet padding 보정 | 공용 LayerFooter로 수렴하고 하단 탭 offset 금지 | P0 | Form·Action Layer | HTML 20, 48, 59, 73행 |
| `card` | `Card` | `.card`, interactive `.expo-list-card`, `.business-card`, `.change-overview`, `.profit-detail-card` | 코드 권위+가이드 목표 | 독립 정보 묶음과 interactive 요약이 공용 Card 규격으로 수렴하지 않음 | wrapper만 Card로 매핑하고 전체 이동 시 semantic button/link는 허용 | P1 | 메인·상세·이력·손익 | HTML 17, 43~46, 73행 |
| `card-part` | 목표 Card Header·Body·RowGroup·Footer anatomy | `.card-head`, `.summary-head`, `.summary-grid`, `.expo-card-top`, `.expo-card-foot`, `.price-card-head` | 가이드 목표 | 내부 구획이 독립 Card처럼 border·radius·shadow를 가질 수 있음 | 각 selector에 anatomy subtype을 주고 부모 Card 표면과 필요한 한쪽 구분선만 사용 | P1 | 요약·상세·목록 Card 내부 | HTML 17, 43~45행 |
| `row-group:choice-row` | 목표 `Row` choice variant | `.expo-pick-list > .expo-pick-card`, `expoPickCard()` | 가이드 목표 | 반복 검색 선택지를 개별 Card로 오인할 수 있음 | 목록 부모가 간격을 소유하고 각 항목은 전체 button semantics의 choice Row로 수렴 | P1 | 재료·부자재 검색 | HTML 54, 401행 |
| `row-group` | 목표 `Row` | `.row`, `.expo-manage-row`, `.setting-row`, `.change-list > button` | 가이드 목표 | 반복 Row가 개별 Card 또는 복수 행동을 가짐 | 상위 RowGroup 한 표면과 단일 진입 방식으로 수렴 | P1 | 전 도메인 목록 | selector 전수 인벤토리 |
| `field` | `Field`, `Input`, `Select` | `.edit-form-box`, `.prototype-input-shell`, `.date-field input`, `.sheet-input-preview`, `prototypeField()`, `prototypeForm()` | 코드 권위+가이드 목표 | 같은 selector가 input·select·readonly span을 겸하고 `prototypeForm()`이 expense/stock 이름을 재사용 | `FieldControl` subtype으로 분리하고 중립 공용 helper로 교체 | P0 | 모든 폼 | HTML 48, 53, 73, 402, 513행 |
| `result` | 목표 `ResultField` | `.stock-total-card`, `.stock-total-result`, `.prototype-result-card`, `.avg-convert`, `.sheet-result`, `prototypeResult()` | 가이드 목표 | 도메인 이름과 Input 유사 표면을 여러 계산 결과에 재사용 | 중립 `ResultField/ResultGroup`으로 분리하고 대표 그룹 한 곳만 tint | P1 | 계산 폼 전체 | HTML 20, 48, 54, 73, 514행 |
| `notice` | `Notice` | `.callout`, `.danger-box`, 안내형 `.ingredient-option-note` | 코드 권위+가이드 목표 | 중립 요약과 위험 안내가 같은 표면 또는 이름을 공유 | 정보·주의·오류 variant를 의미로 분리하고 단순 결과는 Result로 이동 | P1 | 안내·오류 상태 | selector 전수 인벤토리 |
| `empty` | 목표 `EmptyState` | `.empty-inline`, 빈 `Card Body` | 가이드 목표 | 단순 텍스트·강조문·행동 유무가 화면별로 다름 | Page·Section·Card Body subtype과 대표 행동 최대 한 개로 수렴 | P1 | 최초·검색·필터 빈 상태 | selector 전수 인벤토리 |
| `badge` | `Badge`, `StatusBadge` | `.badge`, `.expo-status`, `.expo-target`, `.profit-badge` | 코드 권위+가이드 목표 | 10~12px·여러 굵기와 상태·목표·비교 의미 혼재 | 세 의미 variant와 `TYPE.captionSm`을 공유하고 별도 `TYPE.badge`는 만들지 않음 | P1 | 상태·목표·비교 표시 | HTML 18, 43~44행 |
| `control` | `Button`, `ScrollTabs`, `SegTabs`, Filter 계열 | `.tab`, `.condition-filter`, `.chip`, `.filter-option`, `.choice-card`, `.toggle`, `.business-state` | 코드 권위+가이드 목표 | tab·filter·select·상태 표시가 모양으로 구분되지 않거나 비조작 span임 | subtype을 명시하고 `.business-state`는 행동이면 Select, 표시뿐이면 StatusBadge로 selector 분리 | P0 | 전 조작 요소 | selector 전수 인벤토리 |
| `chart:wrapper` | `Donut`; `TrendChart` 보류 | `.donut`, `.donut-static`, `.menu-donut`, `.chart` | 코드 권위+가이드 목표 | 임시 Chart wrapper와 공식 Donut이 혼재 | wrapper만 정규 `chart`로 매핑하고 텍스트 표·데이터 계약 없이는 PASS 금지 | P1 | 손익·매출 시각화 | HTML 24~25, 36, 45행 |
| `chart:primitive` | Chart 내부 mark; 독립 kit export 없음 | `.donut::after`, `.donut-center`, `.dot`, `.legend*`, `.menu-legend*`, `.bar`, `.bar i`, `.chart svg`, `.chart-labels` | 코드 권위+가이드 목표 | mark가 Card·Badge·독립 Chart로 중복 집계될 수 있음 | 상위 Chart의 내부 primitive로만 기록하고 독립 상위 역할은 부여하지 않음 | P1 | 위 Chart wrapper 내부 전체 | HTML 24~26, 36, 45행 |
| `kpi` | 목표 `PrimaryKPI`, `SummaryKPI` | `.sales-hero`, `.hero`, `.kpi`, `.analysis-summary` | 가이드 목표 | Hero·Live 이름과 여러 숫자의 동일 강조 | 화면당 PrimaryKPI 하나, 나머지는 SummaryKPI·Row로 낮추고 기록 기준 표시 | P1 | 탭 메인·상세 요약 | selector 전수 인벤토리 |

필수 매핑 대상:

- `T`, `TYPE`, `space`, `radius`, 공용 shadow, `tnum`, `STATUS`, formatter 진입점.
- kit 배럴의 모든 export와 이 문서의 역할명.
- 프로토타입의 공용 CSS 변수·핵심 selector·화면 renderer.
- 기존 `.edit-form-box`·`.stock-total-card`·`.callout`·`.empty-inline`처럼 모양 또는 도메인으로
  이름 붙은 selector와 위 단일 역할의 대응.
- 신규 필요 `IconButton`, `Toggle`, `StickyAction`, `Row`, `Table`, `KPI`, `ResultField`,
  `ManagementList`, `ConfirmDialog`, `PopoverMenu`와 저수준 `Surface`, `Section`, `EmptyState`.
- 구성 패턴 `OperationalSummary`, `ExceptionFirstList`, `BusinessDayState`, `RecordedEntryList`,
  `NotEnteredNotice`와 실제 화면 renderer.

전수 매핑은 selector 하나가 여러 역할을 갖는 경우를 그대로 승인하지 않는다. 상태·host에 따라 역할이
달라지면 selector 또는 공용 컴포넌트 variant를 분리하고, renderer가 역할을 결정한다. 위 1차 표에 없는
selector도 적용 대상 화면에서 처음 발견되는 즉시 같은 행 구조로 추가한 뒤에만 PASS로 전환한다.

### C.4 이번 개정에서 수정하지 않은 항목

- 실제 Expo `tokens.ts`와 kit 컴포넌트.
- `full-page-flow-prototype.html`의 CSS·DOM·동작.
- 미정의 CSS 변수, 비표준 굵기, 대비 미달 조합.
- 화면 ID 중복과 라우트.
- DB·RPC·계산·원장 규칙.

이 항목은 후속 구현 승인 뒤 P0→P1 순서로 적용하고 PC·모바일을 분리해 다시 검수한다.
