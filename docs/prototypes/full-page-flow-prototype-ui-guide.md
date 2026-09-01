# 전체 페이지 흐름 프로토타입 · UI 디자인 시스템 상세 가이드안

## 0. 문서 정보

- 상태: 상세 가이드 초안
- 작성일: 2026-09-01
- 적용 대상: `docs/prototypes/full-page-flow-prototype.html`
- 검수 범위: 제품 화면 62개, 화면별 팝업·조건 상태 125개
- 적용 범위: 프로토타입과 프로토타입 기획 문서
- 제외 범위: 실제 Expo 화면, 앱 공용 컴포넌트, DB, RPC

이 문서는 프로토타입 전 화면의 시각·동작 규격을 하나로 묶는 기준안이다. 화면 문구와 노출 조건은
`full-page-flow-prototype-current-spec.md`, 변경 과정은 `full-page-flow-prototype-changelog.md`가
관리한다. 이 문서는 같은 의미의 요소가 화면마다 다른 크기·굵기·색상·배치·동작을 갖지 않도록
공통 토큰, 컴포넌트, 상태, 접근성, 반응형 규칙을 정의한다.

이 문서의 규격은 **적용 목표안**이다. 아직 프로토타입에 일괄 적용되지 않은 값은 현재 렌더 확정값으로
간주하지 않는다. 적용 전 실제 화면 판정은 `full-page-flow-prototype-current-spec.md`를 우선하고,
적용 후 전수 재검수와 변경 기록이 끝난 항목부터 이 문서의 규격을 현재값으로 승격한다.

### 0.1 조사 결과

현재 프로토타입은 화면별 스타일이 누적돼 다음 값이 혼재한다.

| 항목 | 현재 종류 | 목표 |
|---|---:|---:|
| 글자 크기 | 28종 | 역할형 9종 이내 |
| 글자 굵기 | 21종 | `400 / 600 / 700 / 800` 4종 |
| 모서리 | 23종 | 역할형 6종 |
| 최소 높이 | 41종 | 컨트롤형 5종 |
| 그림자 | 12종 | 높이형 4종 |
| 레이어 값 | 7종 | 의미형 7단계 |
| 반응형 분기 | 1개 | compact/mobile/tablet/desktop |
| 포커스 표시 | 없음 | 모든 조작 요소 필수 |
| Safe Area | 없음 | 상·하단 필수 |
| 로딩 상태 | 없음 | 페이지·섹션·행·버튼 단위 |

팝업·상태 URL 125개는 모두 렌더되며, 현재 구조는 대화상자 113개와 화면 내부 조건 상태 12개로
나뉜다. 대화상자 하나에 선택·입력·안내·확인·오류가 함께 구현돼 있으므로 명시적인 유형 분리가
필요하다.

### 0.2 규범 용어와 우선순위

- **필수(MUST)**: 제품 계약, 핵심 행동, 데이터 이해, 접근성에 직접 영향을 준다. 위반은 P0다.
- **권장(SHOULD)**: 핵심 행동은 가능하지만 일관성·인지성·효율을 낮춘다. 위반은 P1이다.
- **선택(MAY)**: 화면 목적과 데이터 밀도에 따라 적용할 수 있다.

| 등급 | 판정 기준 | 예시 |
|---|---|---|
| P0 | 핵심 행동 불가, 데이터 오해·손실, 접근성 차단, 국제화로 핵심 정보 소실 | 오류 미표시, 모달 포커스 이탈, 저장 버튼 잘림 |
| P1 | 동작과 값은 정확하지만 일관성·인지성·효율 저하 | 간격·그림자 변형, 비핵심 문구 불일치 |
| 검수 셸 | 제품 UI가 아닌 프로토타입 카탈로그 전용 | 화면 선택 메뉴 폭·PC 작업 배경 |

## 1. 설계 원칙

1. 같은 역할은 같은 토큰과 컴포넌트를 쓴다.
2. 색상·크기·위치만으로 의미를 전달하지 않는다.
3. 입력값, 계산 미리보기, 서버 확정값을 시각적으로 구분한다.
4. 정상 화면뿐 아니라 로딩·오류·오프라인·빈 상태·저장 중 상태를 함께 설계한다.
5. 모바일을 기준으로 설계하고 PC 프로토타입은 같은 컴포넌트를 넓은 프레임에 보여 준다.
6. 화면마다 CSS를 추가하기 전에 기존 토큰·컴포넌트의 변형으로 해결한다.
7. 글로벌 출시를 고려해 긴 번역, 통화, 날짜, 단위, RTL 가능성을 수용한다.
8. 원장·손익·세금처럼 중요한 데이터는 출처와 적용 시점을 함께 표시할 수 있어야 한다.
9. 파괴 행동은 결과의 복구 가능성에 따라 단계와 확인 강도를 달리한다.
10. 실제 Expo에 반영할 때는 `apps/mobile/src/components/kit`과 `src/theme/tokens.ts`로 옮기며
    별도의 두 번째 디자인 체계를 만들지 않는다.

## 2. 기초 토큰

### 2.1 색상

#### 기본 팔레트

| 역할 | 현재 기준값 | 사용처 |
|---|---|---|
| 화면 바깥 배경 | `#EEF1F4` | PC 프로토타입 작업 영역 |
| 앱 배경 | `#F2F4F6` | 제품 화면 기본 배경 |
| 기본 표면 | `#FFFFFF` | 카드·필드·팝업 |
| 보조 표면 | `#F9FAFB` | 계산 결과·선택되지 않은 영역 |
| 기본 텍스트 | `#191F28` | 제목·주요 값 |
| 보조 텍스트 | `#4E5968` | 본문·라벨 |
| 약한 텍스트 | `#8B95A1` | 날짜·단위·비핵심 메타 |
| 구분선 | `#E5E8EB` | 필드·카드 경계 |
| 약한 구분선 | `#F2F4F6` | 목록 행 내부 경계 |
| Primary | `#3182F6` | 브랜드·주요 선택·강조 |
| Primary tint | `#EAF3FF` | 선택 배경·정보 영역 |
| Danger | `#F04452` | 삭제·철회·오류 |
| Success | `#0E9F6E` | 정상·여유·목표 달성 |
| Warning | `#B76E00` | 주의·소진 임박·적용 예정 |
| Warning tint | `#FFF4DF` | 주의 배경 |

#### 의미 토큰

화면은 물리 색상 이름 대신 아래 역할을 사용한다.

| 의미 토큰 | 기본 역할 |
|---|---|
| `text.primary` | 제목·주요 값 |
| `text.secondary` | 본문·필드 라벨 |
| `text.tertiary` | 날짜·단위·설명. 본문용 제안값 `#6B7684` |
| `icon.decorative` | 비핵심 장식 아이콘. 현재값 `#8B95A1` |
| `text.disabled` | 조작 불가 값 |
| `border.default` | 일반 경계 |
| `border.subtle` | 카드 내부 구분선 |
| `action.primary` | 주요 행동 |
| `action.danger` | 삭제·철회 |
| `state.positive` | 이익·증가·정상 |
| `state.negative` | 손실·감소·오류 |
| `state.warning` | 주의·적용 예정 |
| `state.information` | 계산·선택·안내 |
| `state.neutral` | 중립·중지·미설정 |

#### 접근성 주의

- 현재 `#8B95A1`, `#3182F6`, `#F04452`, `#0E9F6E`를 흰색 위 작은 글자로 사용하면
  일반 본문 대비 기준을 충족하지 못할 수 있다.
- `#3182F6`은 프로젝트 기본 primary이므로 임의 변경하지 않는다. 다만 흰색 소형 텍스트를 얹는
  조합은 실제 Expo 반영 전에 대비를 별도 결정한다.
- 흰 배경 위 작은 텍스트 후보는 약한 텍스트 `#6B7684`, 파란 텍스트 `#1B64DA`, 빨간 텍스트
  `#D83143`, 초록 텍스트 `#087A55`, 주의 텍스트 `#9B5C00`처럼 4.5:1 이상인 색을 검토한다.
- 색상은 반드시 텍스트, 아이콘, 부호, 뱃지 이름 중 하나와 함께 사용한다.
- `#3182F6` 위 흰색 소형 버튼 라벨의 대비 해결안은 실제 Expo 반영 전에 확정해야 하는 P0
  미결정 항목이다. 가이드 초안이 임의의 두 번째 primary를 확정하지 않는다.

### 2.2 타이포그래피

글꼴은 `Pretendard → -apple-system → BlinkMacSystemFont → Segoe UI → sans-serif` 순서다.
실제 폰트 자산에 맞춰 굵기는 `400 / 600 / 700 / 800`만 사용한다. `750`, `850`, `900`은 금지한다.

| 역할 | 크기 / 행간 | 굵기 | 기본 색상 |
|---|---|---:|---|
| Display | `22 / 30px` | 800 | `text.primary` |
| Page title | `18 / 26px` | 800 | `text.primary` |
| Dialog title | `18 / 26px` | 800 | `text.primary` |
| Section title | `16 / 24px` | 800 | `text.primary` |
| List title | `15 / 22px` | 700 | `text.primary` |
| Input value | `16 / 24px` | 700 | `text.primary` |
| Field label | `14 / 20px` | 700 | `text.secondary` |
| Body | `14 / 21px` | 600 | `text.secondary` |
| Metadata | `12 / 18px` | 600 | `text.tertiary` |
| Button | `15 / 20px` | 800 | 상태별 |
| Badge | `11 / 16px` | 800 | 상태별 |
| KPI large | `24 / 32px` | 800 | 상태별 |

규칙:

- 일반 화면 헤더는 `Page title`을 쓴다.
- 메인 화면에 큰 제목이 별도로 필요한 경우에만 `Display`를 쓴다.
- 입력칸 안의 값과 placeholder는 모두 `16px`다. 모바일 웹 자동 확대를 피하고 입력 경험을 통일한다.
- 금액·수량·비율·날짜는 `tabular-nums`를 사용한다.
- 설명 문구를 작게 만들어 우선순위를 낮추기보다 불필요하면 삭제한다.
- 한 화면에서 3단계 이상의 회색 텍스트를 만들지 않는다.

### 2.3 간격

| 토큰 | 값 | 주요 사용처 |
|---|---:|---|
| `space.1` | 4px | 아이콘 내부·뱃지 |
| `space.2` | 8px | 아이콘과 텍스트·버튼 사이 |
| `space.3` | 12px | 카드 사이·행 내부 |
| `space.4` | 16px | 페이지 좌우·카드 기본 패딩 |
| `space.5` | 20px | 입력 항목 사이 |
| `space.6` | 24px | 섹션 사이 |
| `space.8` | 32px | 큰 구획 분리 |

- 임의의 `5`, `7`, `9`, `11`, `13`, `14`, `15`, `18`, `22px` 간격을 새로 만들지 않는다.
- 시각 보정이 꼭 필요한 경우 컴포넌트 내부에서만 예외를 허용하고 이유를 문서화한다.
- 모바일 페이지 좌우 여백은 기본 `16px`, 큰 폼과 메인 헤더는 최대 `20px`까지 허용한다.

### 2.4 모서리

| 토큰 | 값 | 사용처 |
|---|---:|---|
| `radius.xs` | 6px | 뱃지 |
| `radius.sm` | 10px | 작은 버튼·팝오버 항목 |
| `radius.md` | 12px | 입력·버튼·결과 카드 |
| `radius.lg` | 16px | 일반 카드 |
| `radius.xl` | 20px | 중앙 팝업 |
| `radius.sheet` | 24px | 바텀시트 상단 |
| `radius.full` | 999px | 필터 칩·상태 pill |

### 2.5 높이와 터치 영역

| 용도 | 높이 |
|---|---:|
| 작은 조작 | 36px, 터치 영역은 44px 이상 |
| 필터·분할 탭 | 40px |
| 일반 아이콘 버튼 | 44×44px |
| 일반 목록 행 | 최소 64px |
| 입력·셀렉트 | 52px |
| 주요 버튼 | 52px |
| 하단 탭 | 60px + Safe Area |

아이콘이 `20px`이어도 실제 버튼 영역은 최소 `44×44px`을 유지한다. 현재 20~34px인 삭제·더보기·
순서 이동 버튼은 터치 영역만 확장한다.

### 2.6 그림자

| 토큰 | 값 | 사용처 |
|---|---|---|
| `elevation.0` | 없음 | 일반 카드·필드 |
| `elevation.1` | `0 1px 3px rgba(25,31,40,.08)` | 선택된 작은 카드 |
| `elevation.2` | `0 8px 24px rgba(25,31,40,.14)` | 팝오버·FAB |
| `elevation.3` | `0 18px 50px rgba(25,31,40,.24)` | 중앙 대화상자 |

일반 카드에는 테두리와 그림자를 동시에 강하게 사용하지 않는다. 떠 있는 요소에만 그림자를 쓴다.

### 2.7 레이어

| 레이어 | 값 | 요소 |
|---|---:|---|
| Base | 0 | 본문·카드 |
| Sticky | 10 | 카드 내부 고정 헤더 |
| Navigation | 20 | 하단 탭 |
| Floating | 30 | FAB·페이지 하단 행동 |
| Overlay | 40 | 딤 배경 |
| Dialog | 50 | 시트·중앙창 |
| Popover | 60 | 컨텍스트 메뉴 |
| Toast | 70 | 전역 피드백 |

### 2.8 모션

| 동작 | 시간 | 방식 |
|---|---:|---|
| 눌림·선택 | 100ms | ease-out |
| 팝오버 | 140ms | ease-out |
| 중앙 팝업 | 180ms | ease-out |
| 바텀시트 | 220ms | standard easing |
| 토스트 | 200ms | ease-out |

- 값 계산은 숫자를 과도하게 움직이지 않고 색·짧은 fade로 갱신한다.
- `prefers-reduced-motion`에서는 위치 이동을 제거하고 짧은 fade만 사용한다.
- 저장 중 스피너는 한 개만 표시하고 버튼 폭을 바꾸지 않는다.

## 3. 반응형과 앱 셸

### 3.1 화면 단계

| 단계 | 너비 | 규칙 |
|---|---:|---|
| Compact | 320~359px | 2열 폼을 1열로, 긴 버튼은 2줄 허용 |
| Mobile | 360~599px | 기본 모바일 규격 |
| Tablet | 600~899px | 본문 최대 폭 유지, 필요한 경우 2열 카드 |
| Desktop prototype | 900px 이상 | 제품 프레임을 중앙에 두고 카탈로그를 별도 표시 |

- 높이는 `100dvh`를 우선하고 구형 환경에서 `100vh`를 보조로 사용한다.
- 가로모드에서 하단 버튼이 본문을 가리지 않아야 한다.
- PC에서도 제품 화면의 타이포·컨트롤 규격은 모바일과 동일하다. 레이아웃 폭만 달라진다.

### 3.2 Safe Area

- 헤더 상단: `env(safe-area-inset-top)`을 포함한다.
- 하단 탭과 고정 버튼: `env(safe-area-inset-bottom)`을 포함한다.
- FAB는 하단 탭과 Safe Area 위에 배치한다.
- 바텀시트 하단 행동도 Safe Area만큼 여백을 추가한다.

### 3.3 스크롤

- 헤더와 하단 탭은 고정하고 본문만 세로 스크롤한다.
- 화면 이동 시 새 화면은 상단에서 시작한다.
- 상세에서 목록으로 돌아오면 필터와 스크롤 위치를 복원한다.
- 바텀시트가 열리면 배경 스크롤을 막는다.
- 긴 선택 목록은 제목과 하단 행동을 고정하고 목록만 스크롤한다.
- 가로 스크롤 탭에는 끝 항목이 일부 보이는 방식으로 추가 항목 존재를 암시한다.

## 4. 내비게이션과 헤더

### 4.1 하단 탭

- 순서: `식재료 · 레시피 · 발주 · 매출관리 · MY`.
- 아이콘 `24px`, 라벨 `12px / 700`, 전체 터치 영역은 탭 폭×60px 이상이다.
- 활성 상태는 색상뿐 아니라 `aria-current="page"`와 아이콘 형태 변화로 표시한다.
- 같은 탭을 다시 누르면 해당 탭 메인으로 이동하고 이미 메인이면 목록 상단으로 이동한다.
- 키보드가 열리면 하단 탭을 숨기거나 키보드 위로 올리지 않는다. 입력 화면의 고정 행동만 조정한다.

### 4.2 화면 계층

- 메인 → 상세 → 상세의 상세 순서를 유지한다.
- 뒤로가기는 팝업 닫기 → 현재 화면의 부모 → 현재 탭 메인 순서다.
- 딥링크로 상세에 들어온 경우 뒤로가기는 해당 탭 메인으로 이동한다.
- 수정 중 이탈하면 미저장 변경 확인창을 먼저 연다.

### 4.3 헤더 변형

| 변형 | 구성 | 사용처 |
|---|---|---|
| Main | 제목 + 검색 + 알림 | 식재료·레시피·발주 메인 |
| Main subtitle | 제목 + 부제목 + 선택 행동 | 매출관리·MY 메인 |
| Child | 뒤로 + 제목 | 일반 하위 화면 |
| Child action | 뒤로 + 제목 + 수정/추가/더보기 | 상세·관리 화면 |
| Context | 뒤로 + 제목 + 국가·날짜 등 맥락 | 세금·영업일 |

- 헤더 높이는 기본 `60px`, 제목+부제목은 `72px`다.
- 뒤로가기와 우측 아이콘 버튼은 `44×44px` 터치 영역을 갖는다.
- 우측 행동은 최대 2개다. 가장 중요한 행동을 오른쪽 끝에 둔다.
- 헤더에 재고량·입고 건수처럼 본문에 이미 있는 값을 반복하지 않는다.
- 제목은 기본 한 줄이며 번역이 길면 우측 행동 폭을 보존한 채 말줄임한다.

## 5. 버튼과 행동

### 5.1 버튼 유형

| 유형 | 규격 | 사용처 |
|---|---|---|
| Primary | 52px, 채움, 흰 글씨 | 저장·추가·적용 |
| Secondary | 52px, 보조 표면, 기본 글씨 | 취소·닫기 |
| Danger | 52px, 옅은 빨강, 빨간 글씨 | 삭제·철회 |
| Outline | 44~52px, 1px 경계 | 보조 선택·관리 |
| Text | 최소 44px 터치 영역, 배경 없음 | 전체보기·다시 시도 |
| Compact | 36px, 좌우 12px | `+ 추가`, 인라인 관리 |
| Icon | 44×44px | 뒤로·닫기·검색·더보기 |
| FAB | 54px, 확장형 | 메인 추가 행동 |

### 5.2 버튼 상태

모든 버튼은 `default / hover / pressed / focus-visible / disabled / loading`을 가진다.

- 한 화면 또는 한 팝업의 Primary는 원칙적으로 하나다.
- 비활성만으로 이유를 전달하지 않는다. 필요한 필드의 오류 또는 안내를 함께 표시한다.
- 로딩 중에는 라벨을 유지하고 좌측에 작은 스피너를 표시하며 중복 입력을 막는다.
- 위험 버튼은 일반 Primary와 같은 파란색을 사용하지 않는다.
- `취소 / 저장`은 1:2, 동등한 선택은 1:1 비율을 쓴다.
- 아이콘은 텍스트 왼쪽, 간격은 8px다.

## 6. 아이콘

- 하나의 선형 아이콘 세트를 사용한다.
- 기본 크기 `20px`, 헤더·하단 탭 `24px`, 작은 보조 아이콘 `16px`.
- 선 굵기 `2px`, 둥근 선 끝을 사용한다.
- 문자 기호 `‹`, `⌄`, `›`, `✎`, `▣`, `◴`, `×`, `⌕`, `•••`를 제품 아이콘으로 사용하지 않는다.
- 장식 아이콘은 `aria-hidden`, 단독 행동 아이콘은 구체적인 접근성 이름을 가진다.

| 목적 | 아이콘 | 비고 |
|---|---|---|
| 뒤로 | chevron-left | RTL에서 반전 |
| 닫기 | x | 저장과 혼동 금지 |
| 펼치기 | chevron-down/up | 현재 상태와 방향 일치 |
| 상세 이동 | chevron-right | 행 전체가 명확히 클릭되면 생략 가능 |
| 선택 | check | 선택된 행 우측 |
| 추가 | plus | 실제 추가 행동에만 사용 |
| 검색 | search | 검색창 좌측 |
| 필터 | sliders-horizontal | 필터 그룹 진입 |
| 외부 링크 | external-link | 새 창 열림 안내 포함 |
| 수정 | pencil | 상세 헤더·관리 목록 |
| 삭제 | trash-2 | Danger 색상 |
| 날짜 | calendar | 기간·영업일 |
| 더보기 | ellipsis | 행동 2개 이상일 때만 |
| 정보 | info | 정보 안내 |
| 경고 | triangle-alert | 경고·오류 |

## 7. 뱃지와 상태 표시

### 7.1 규격

- 높이 `22px`, 좌우 패딩 `6px`, 모서리 `6px`.
- 글자 `11 / 16px`, 굵기 800.
- 한 항목에 최대 2개.
- 단순 카테고리·구매처는 뱃지로 만들지 않는다.

### 7.2 의미

| 상태 | 의미 | 예시 |
|---|---|---|
| Positive | 정상·달성 | 여유, 판매중, 목표 달성 |
| Warning | 주의 | 소진 임박, 안전재고, 적용 예정 |
| Negative | 문제·미달 | 소진, 목표 미달, 손실 |
| Information | 정보 | 최신, 현재 매출 반영 |
| Neutral | 중립 | 판매중지, 미설정 |

- 가격의 `최저 / 최고`는 정보·비교 뱃지이며 재고 위험 상태와 색 의미를 섞지 않는다.
- 음수 재고는 뱃지로 숨기지 않고 `−750g`처럼 실제 값을 빨간색과 부호로 표시한다.

## 8. 입력과 선택

### 8.1 FormField 구조

`라벨 → 입력/선택 영역 → 도움말 또는 오류` 순서다.

- 라벨은 입력칸 위에 둔다.
- 필수는 라벨 옆 파란 `*`, 선택은 필요한 경우에만 `(선택)`을 쓴다.
- 입력칸 안에는 실제 값 또는 placeholder만 둔다.
- 단위는 우측 suffix로 고정한다.
- 도움말과 오류가 동시에 있으면 오류만 노출한다.
- 계산 결과는 FormField가 아니라 `ResultField`를 쓴다.

### 8.2 상태

| 상태 | 표현 |
|---|---|
| Empty | placeholder, 기본 경계 |
| Filled | 기본 텍스트 |
| Focused | Primary 경계 + 명확한 focus ring |
| Disabled | 보조 배경 + 비활성 텍스트 |
| Readonly | 보조 배경 + 값 유지, chevron 제거 |
| Error | 빨간 경계 + 오류 문장 |
| Warning | 주의 경계 + 경고 문장 |
| Validating | 우측 작은 진행 표시 |
| Success | 필요한 경우에만 체크와 짧은 문구 |

### 8.3 입력 종류

- 텍스트·숫자·금액·URL·날짜 입력 높이는 `52px`.
- textarea는 최소 `112px`, 글자 수는 우측 하단에 표시한다.
- 숫자 입력은 모바일 키패드와 단위 suffix를 함께 사용한다.
- URL은 도메인 자동 채움 후에도 전체 URL을 수정할 수 있다.
- 날짜는 locale에 맞는 표시와 서버 날짜 저장값을 분리한다.
- 실제 입력 요소를 사용하며 모양만 입력칸인 정적 `span`은 금지한다.

### 8.4 셀렉트

- 높이 `52px`, 값 `16 / 24px`, 우측 chevron `18px`.
- 미선택은 `미선택` 또는 구체적인 `카테고리 선택`을 사용한다.
- 선택 후 수정 불가 값은 chevron을 제거하고 Readonly로 표시한다.
- 제목을 반복하는 작은 설명문을 팝업 안에 넣지 않는다.
- 단일 선택은 선택 즉시 적용하고 팝업을 닫는다. 여러 필드를 함께 정하는 경우에만 적용 버튼을 둔다.

### 8.5 검색

- 높이 `48px`, 좌측 검색 아이콘, 우측 지우기 버튼.
- 상태: 기본·입력 중·검색 중·결과 있음·결과 없음·오류.
- 검색 결과 없음은 최초 빈 상태와 다른 문구를 사용한다.
- 한글 IME 조합 중에는 검색을 확정하지 않는다.
- 긴 목록은 debounce와 결과 수를 제공할 수 있다.

### 8.6 스테퍼

- 구조: 감소 버튼 / 현재 값과 단위 / 증가 버튼.
- 최소값에서는 감소 버튼을 비활성화한다.
- 값 변화는 `aria-live`로 알린다.
- 빠른 연속 입력과 저장 중 중복 입력을 막는다.
- 직접 입력이 필요한 경우 값을 누르면 숫자 키패드를 연다.

### 8.7 라디오·체크박스·토글

- 하나만 고르면 라디오 또는 선택 목록, 여러 개면 체크박스, 즉시 켜고 끄는 설정은 토글을 쓴다.
- 토글은 실제 `switch` 의미와 `checked` 상태를 제공한다.
- 상태는 `on / off / disabled / loading`을 가진다.
- 상위 선택 때문에 하위 항목이 비활성화되면 이유를 함께 표시한다.
- 즉시 저장 설정과 하단 저장 설정을 한 화면에서 섞지 않는다.

### 8.8 폼 검증과 키보드

- 제출 시 첫 번째 오류 필드로 이동한다.
- 오류는 `aria-invalid`, `aria-describedby`로 연결한다.
- Enter/Done 동작과 다음 필드 이동 순서를 정의한다.
- 키보드가 열리면 현재 필드와 하단 행동이 가려지지 않게 자동 스크롤한다.
- 저장 실패 후 입력값을 유지한다.
- URL·금액·수량은 형식과 범위 오류를 구체적으로 설명한다.

## 9. 탭·필터·분할 선택

### 9.1 페이지 탭

- 카테고리나 페이지 내부 상위 영역 이동에 사용한다.
- 높이 `44~48px`, 글자 `14~16px`, 활성 밑줄 `2px`.
- `tablist / tab / tabpanel`, `aria-selected`를 제공한다.
- 항목이 넘치면 가로 스크롤하며 선택 항목을 자동으로 보이게 한다.

### 9.2 Segmented Control

- `10인분 / 1인분`, `입고 / 차감 / 폐기`처럼 같은 화면의 계산·입력 모드를 전환한다.
- 높이 `40px`, 같은 폭, 전체 보조 배경, 활성 항목은 흰색 또는 Primary 배경.
- 모드 변경 시 값과 라벨이 실제로 함께 갱신돼야 한다.

### 9.3 필터 칩

- 높이 `36px`, 글자 `13 / 18px`, pill 모서리.
- 기간·유형·정렬을 별도 칩으로 표시한다.
- 긴 설정 전체를 한 칩에 문장으로 합치지 않는다.
- 상태: 기본·선택·적용 중·비활성·오류.
- 전체값일 때는 `유형`, `판매 상태`, `목표 상태`처럼 필터 목적을 표시한다.

## 10. 카드·목록·표

### 10.1 카드

- 기본 모서리 `16px`, 내부 여백 `16px`, 카드 사이 `12px`.
- 변형: 기본·클릭 가능·선택·정보·경고·위험·로딩.
- 카드 제목은 `Section title`, 본문은 `Body`, 보조값은 `Metadata`를 쓴다.
- 카드 헤더 우측에 본문과 같은 값을 반복하지 않는다.
- 상세 미리보기는 최대 3개, 하단 행동은 `전체보기`로 통일한다.

### 10.2 목록 행

| 유형 | 구조 |
|---|---|
| Primary row | 제목 / 보조정보 / 우측 값 |
| Label-value | 항목 / 값 |
| Value-percent | 항목 / 금액 / 비율 |
| Count-amount | 항목 / 수량 / 금액 |
| Hierarchy | 상위 행 / 들여쓴 하위 행 |
| Before-after | 항목 / 이전 / 화살표 / 이후 |
| Event row | 날짜 / 유형·사유 / 변화량·잔량 |
| Management row | 이름·사용정보 / 편집·삭제 |

- 일반 행 최소 높이 `64px`, 데이터가 3줄이면 `80px` 이상.
- 행 전체가 클릭되면 별도의 편집·화살표 아이콘을 중복 배치하지 않는다.
- 두 개 이상의 행동이 있으면 행 선택 후 ActionSheet 또는 명시적인 컨텍스트 메뉴를 연다.
- 긴 텍스트는 주요 제목 1줄, 설명 최대 2줄을 기본으로 한다.

### 10.3 표 의미

- 웹에서는 실제 `table` 또는 동등한 ARIA 표 구조를 사용한다.
- 열 제목과 단위를 제공한다.
- 정렬 가능한 열은 현재 방향을 전달한다.
- 모바일에서는 행 카드로 바뀌어도 정보 순서와 열 의미를 보존한다.
- 소계와 총합은 굵기뿐 아니라 구분선·라벨로 구분한다.

## 11. 합계·KPI·계산 결과

### 11.1 ResultField

- 라벨은 결과 영역 위에 둔다.
- 영역 안에는 값만 표시한다.
- 기본 배경은 보조 표면, 강조 결과는 Primary tint를 쓴다.
- 변형: 미리보기·변경 후 값·경고·음수·서버 확정·값 없음.
- 계산 중, 계산 실패, 마지막 확정 시각을 표현할 수 있어야 한다.

### 11.2 KPI

| 유형 | 구성 |
|---|---|
| Hero KPI | 라벨 / 대형 값 / 기준 또는 변화량 |
| 2-column | 두 개의 동등한 주요 수치 |
| 3-column | 매출 / 지출 / 순이익 |
| Target KPI | 현재 / 목표 / 달성 상태 |
| Delta KPI | 현재 / 전일·전월 변화량 |

- 값이 길면 단위를 줄이기보다 줄바꿈 또는 적절한 숫자 축약을 사용한다.
- 로딩·값 없음·집계 불가 상태를 정의한다.
- 집계 기간이나 기준일을 KPI와 가까이 표시한다.

## 12. 데이터 시각화

### 12.1 현재 사용 범위

- 확정 사용: 레시피 상세의 판매가 구성 도넛.
- 보류: 소스에만 남은 일반 도넛·선 그래프·막대그래프. 실제 화면과 데이터 계약이 정해질 때까지
  공식 컴포넌트로 간주하지 않는다.

### 12.2 공통 규칙

- 차트 제목, 집계 기간, 단위, 범례를 제공한다.
- 색상 순서를 고정하고 같은 항목은 화면이 바뀌어도 같은 의미 색상을 쓴다.
- 0, 음수, 100% 초과, 항목 수 증가, 데이터 없음 상태를 정의한다.
- 차트와 같은 데이터를 텍스트 목록 또는 표로 함께 제공한다.
- 색만으로 계열을 구분하지 않는다.
- 그래프의 스크린리더용 요약 문장을 제공한다.

### 12.3 도넛

- 중심에는 가장 중요한 지표 하나만 표시한다.
- 조각이 너무 작으면 범례에서만 값을 보여 준다.
- 합계가 100%가 아닐 경우 원인과 계산 기준을 표시한다.
- 음수 이익은 원형 조각으로 왜곡하지 않고 별도 손실 상태로 표시한다.

## 13. 팝업 시스템

### 13.1 유형

| 유형 | 목적 | 기본 배치 |
|---|---|---|
| PickerSheet | 단일·복수 선택 | 모바일 하단 |
| FormSheet | 값 입력·수정 | 모바일 하단, PC 중앙 |
| InfoSheet | 상세 정보·전후 비교 | 모바일 하단 |
| ActionSheet | 대상에 대한 여러 행동 | 모바일 하단 |
| ConfirmDialog | 상태 변경·삭제·철회 확인 | 중앙 |
| SuccessDialog | 작업 완료 확인이 꼭 필요한 경우 | 중앙 |
| ErrorDialog | 작업 실패와 재시도 | 중앙 |
| PopoverMenu | 헤더나 항목에 종속된 2~5개 행동 | 기준 버튼 주변 |

### 13.2 바텀시트

- 상단 모서리 `24px`, 최대 높이 기본 76%, 긴 폼은 전체 높이 변형을 사용한다.
- 구조: 핸들 / 제목·닫기 / 본문 / 고정 하단 행동.
- 입력 시트는 키보드 높이를 감지해 현재 필드와 하단 행동을 보존한다.
- 선택 목록은 제목 고정, 목록 스크롤, 선택 즉시 닫기를 기본으로 한다.
- 위험 확인을 바깥 영역 클릭으로 닫지 않는다.
- 드래그 닫기는 미저장 입력이 없을 때만 허용한다.

### 13.3 중앙 확인창

- 최대 너비 `340px`, 모서리 `20px`, 좌우 여백 `24px`.
- 제목 `18px / 800`, 본문 `14px / 600`, 버튼 2열.
- 문장은 하나의 질문으로 시작한다.
- 일반 상태 변경: `아니요 / 예`.
- 삭제·철회: `취소 / 삭제`, `취소 / 철회`.
- 되돌릴 수 없는 경우 영향 범위를 본문에 명확히 표시한다.
- 배경 클릭으로 닫지 않으며 초기 포커스는 안전한 취소 행동에 둔다.

### 13.4 안내·오류창

- 제목은 `[작업명] 완료`, `[작업명] 실패`처럼 짧게 쓴다.
- 본문은 한두 문장, 하단 단일 `확인` 또는 `다시 시도 / 닫기`를 쓴다.
- 기술 오류 코드와 중복 문장을 사용자에게 그대로 표시하지 않는다.
- 오류 후 입력값과 이전 화면 상태를 유지한다.

### 13.5 팝오버

- 기준 버튼의 우측 끝에 정렬하되 화면 경계를 넘으면 자동 반전한다.
- 너비 `160~220px`, 행 높이 최소 `44px`.
- 구분선과 위험 행동을 구분한다.
- 바깥 클릭과 Escape로 닫고 닫힌 뒤 기준 버튼으로 포커스를 돌린다.
- 목록 행 전체 행동을 위한 팝오버와 헤더 더보기 팝오버의 의미를 섞지 않는다.

### 13.6 접근성

- 제목을 `aria-labelledby`, 설명을 `aria-describedby`로 연결한다.
- 열릴 때 초점을 팝업 안으로 옮기고 포커스를 가둔다.
- 닫힌 뒤 실행 버튼으로 초점을 돌린다.
- 배경은 `inert` 또는 동등한 방식으로 조작을 막는다.
- Android 뒤로가기와 Escape는 먼저 현재 팝업을 닫는다.

## 14. 상태와 피드백

### 14.1 상태 집합

모든 데이터 화면과 저장 행동은 필요한 범위에서 다음 상태를 가진다.

| 상태 | 화면 표현 |
|---|---|
| Initial loading | 페이지 또는 카드 스켈레톤 |
| Refreshing | 기존 데이터 유지 + 작은 진행 표시 |
| Loading more | 목록 하단 진행 표시 |
| Saving | 버튼 스피너 + 중복 제출 차단 |
| Success | 짧은 토스트 또는 필요한 완료창 |
| Empty | 최초 데이터 없음 + 가능한 행동 |
| Filtered empty | 필터 결과 없음 + 필터 초기화 |
| Search empty | 검색 결과 없음 + 검색어 지우기 |
| Error | 원인 요약 + 다시 시도 |
| Offline | 기존 데이터·마지막 동기화 시각 + 재연결 |
| Stale | 오래된 데이터 표시 + 새로고침 |
| Permission denied | 조회·편집 권한 안내 |
| Partial | 일부 카드만 실패 + 해당 영역 재시도 |

### 14.2 빈 상태

- 시스템 상태 문장은 `등록된 식재료가 없습니다.`처럼 한 문장으로 쓴다.
- 다음 행동이 있으면 바로 아래에 `+ 추가` 버튼을 둔다.
- 검색·필터 결과 없음은 원래 데이터 없음과 다른 문구를 쓴다.
- 이해에 필요하지 않은 일러스트와 장문 설명은 사용하지 않는다.

### 14.3 토스트

- 저장·추가·간단한 상태 변경 성공은 2~3초 토스트로 알린다.
- 오류는 사용자가 읽고 행동해야 하면 자동으로 사라지는 토스트만 사용하지 않는다.
- 한 번에 하나만 표시하고 하단 탭·고정 버튼을 가리지 않는다.
- 스크린리더에 `aria-live="polite"`로 전달한다.

### 14.4 미저장 변경

- 폼이 dirty 상태일 때 뒤로가기, 탭 이동, 팝업 바깥 클릭을 하면 변경 폐기 확인창을 연다.
- 저장 중에는 이탈을 막거나 저장 결과를 기다린다.
- 저장 실패 시 입력값을 유지하고 첫 오류 또는 전역 오류로 이동한다.

### 14.5 철회·되돌리기

- 삭제와 철회를 구분한다. 원장 철회는 반대 사건을 추가한다.
- 완료 후 목록·요약·기준단가가 갱신됐음을 보여 준다.
- 빠른 철회 메뉴는 현재 정책상 허용되는 최신 사건에만 노출한다.
- 철회할 수 없는 경우 메뉴를 숨기거나 이유를 명확히 안내한다.

## 15. 업무 상태와 감사 정보

### 15.1 상태 전환

상태 컴포넌트는 현재 상태, 가능한 다음 행동, 확인 필요 여부, 복구 가능 여부를 함께 정의한다.

- 발주: 후보 → 입고 예정 → 입고 완료.
- 매출: 영업 중 → 브레이크 → 영업 종료.
- 레시피: 판매중 ↔ 판매중지.
- 재고: 입고·차감·폐기 → 조건부 철회.
- 목표: 목표 미달 ↔ 목표 달성.

### 15.2 변경·감사 표시

- 변경 원천: 직접 수정 / 자동 갱신 / 원장 사건 / 계산 파생.
- 적용 시점: 현재 매출 반영 / 다음 영업일부터 / 과거 스냅샷 유지.
- 기본 정보: 날짜·시간·대상·수정자·판본.
- 비교: 이전 값 → 이후 값, 추가·삭제·변경 없음 상태.
- 최근 수정은 표시할 기록이 있을 때만 노출한다.

### 15.3 데이터 출처와 신선도

- 사용자 입력, 실시간 미리보기, 서버 확정값을 구분한다.
- 기준 영업일·기준 월·마지막 갱신 시각을 필요한 화면에 표시한다.
- 오프라인이나 동기화 지연 시 확정값처럼 보이지 않게 한다.
- 기존 판매 스냅샷과 현재 기준값이 다를 수 있음을 화면 역할에 맞게 전달한다.

## 16. 관리 목록·재정렬·점진적 공개

### 16.1 관리 목록

- 이름·사용 정보·편집·삭제 구조를 공통화한다.
- 사용 중이라 삭제할 수 없는 항목은 비활성 행동과 이유를 제공한다.
- 목록 전체가 편집 가능하면 헤더 `+`와 하단 추가 버튼을 중복 사용하지 않는다.
- 편집과 이동 아이콘이 겹치지 않게 각각 최소 44px 터치 영역을 확보한다.

### 16.2 순서 변경

- 첫 항목의 위로 이동, 마지막 항목의 아래로 이동은 비활성화한다.
- 화살표 방식 또는 드래그 방식 중 하나를 화면 단위로 선택한다.
- 키보드와 스크린리더 사용자를 위한 이동 행동 이름을 제공한다.
- 이동 완료 후 새 위치를 알린다.

### 16.3 전체보기·펼치기

- `전체보기`: 별도 전체 페이지로 이동.
- `더보기 N개`: 현재 카드 안에서 펼침.
- `chevron-right`: 상세 이동.
- `chevron-down/up`: 현재 영역 펼침·접힘.
- `ellipsis`: 2개 이상의 컨텍스트 행동.
- 기준 개수 이하이면 전체보기·더보기를 숨긴다.

## 17. 문구와 명칭

### 17.1 문장 형식

| 상황 | 형식 | 예시 |
|---|---|---|
| 화면·팝업 제목 | 명사형 | `재고 수정`, `입고 실패` |
| 버튼 | 짧은 동작 | `저장`, `철회`, `전체보기` |
| 빈 상태 | 상태 한 문장 | `등록된 구매 링크가 없습니다.` |
| 도움말 | 해요체 | `상세 화면에서 추가할 수 있어요.` |
| 확인 | 질문형 | `판매를 중지하시겠습니까?` |
| 오류 본문 | 문제 + 다음 행동 | `입고하지 못했어요. 잠시 후 다시 시도해 주세요.` |

- 라벨·버튼·뱃지에는 마침표를 붙이지 않는다.
- 화면 제목과 같은 작은 소제목을 반복하지 않는다.
- `옵션`, `관리`, `미리보기`, `기준`처럼 없어도 의미가 같은 단어는 제거한다.
- 동일 개념은 `구매 링크`, `재고 수정`, `차감`, `기준 단가`, `안전재고`, `판매 손익`, `인분`으로 통일한다.

### 17.2 숫자·기호 표기

- 음수는 하이픈이 아닌 수학 기호 `−`를 쓴다.
- 변화량은 `+1kg`, `−700g`처럼 부호와 값을 붙인다.
- 곱셈은 `1kg × 2개`, 구매처와 상품 정보는 `식자재쇼핑몰 · 고춧가루 1kg`처럼 표기한다.
- 단가는 `28.00원/g`, 금액은 `28,000원`, 비율은 역할별 정해진 소수 자리로 표시한다.
- 사용자가 입력하는 원시 단위와 DB 최소 단위를 혼동하지 않는다.

## 18. 국제화

- 한국어보다 30~50% 긴 번역을 기준으로 버튼·필드·헤더를 검수한다.
- 통화 기호의 전치·후치와 소수 자릿수를 locale formatter가 담당한다.
- 날짜 순서, 월 이름, 요일, 주 시작일을 locale에 맞춘다.
- 단위와 숫자의 순서, 단위 복수형을 locale 규칙으로 처리한다.
- RTL에서는 뒤로가기, 상세 이동, 행 정렬을 반전하되 숫자와 단위의 읽기 순서를 보존한다.
- 고정 2열 레이아웃에서 텍스트가 잘리면 1열 또는 다중 행으로 전환한다.
- 고유명사와 URL은 무리하게 번역하지 않는다.

## 19. 접근성

### 19.1 필수 기준

- 일반 텍스트 대비 4.5:1, 큰 텍스트·비텍스트 UI 3:1 이상.
- 모든 조작 요소 터치 영역 최소 44×44px.
- 키보드 포커스가 항상 보이도록 `focus-visible`을 제공한다.
- `outline: 0`을 사용할 때 반드시 동등한 포커스 스타일을 제공한다.
- 탭은 선택 상태, 셀렉트는 열림 상태, 토글은 켜짐 상태를 의미 속성으로 제공한다.
- 동적 계산값, 글자 수, 저장 결과를 `aria-live`로 알린다.
- 차트는 텍스트 요약 또는 데이터 표를 함께 제공한다.
- 색상만으로 정상·위험·손익을 표현하지 않는다.
- 글자 200% 확대에서도 정보와 행동이 사라지지 않아야 한다.

### 19.2 대화상자 포커스

1. 실행 버튼에서 팝업을 연다.
2. 제목 또는 첫 입력으로 초점을 이동한다.
3. 팝업 내부에서만 Tab 이동한다.
4. Escape 또는 닫기 행동으로 닫는다.
5. 실행 버튼으로 초점을 복귀한다.

### 19.3 접근 가능한 이름

- 아이콘 단독 버튼: `구매 링크 더보기`, `수량 늘리기`처럼 대상과 행동을 함께 쓴다.
- 같은 화면에 반복되는 `전체보기`는 접근성 이름에 대상 섹션을 포함한다.
- 새 창 링크는 `새 창에서 구매 링크 열기`로 알린다.
- 순서 이동은 `볶음·구이 위로 이동`처럼 항목 이름을 포함한다.

## 20. 화면 패턴 매핑

### 20.1 식재료

| 화면 | 주요 패턴 |
|---|---|
| `ingredient_main` | MainHeader, CategoryTabs, SortFilter, IngredientCardList, FAB |
| `ingredient_add` | ChildHeader, FormField, PickerSheet, ResultField, StickyPrimary |
| `ingredient_detail` | ChildActionHeader, DetailHero, KPI, PreviewCard, ConditionalEmpty |
| `ingredient_edit_menu` | ChildHeader, ActionList, DangerAction |
| `ingredient_edit` | ChildHeader, FormField, PickerSheet, ResultField, StickyPrimary |
| `stock_change` | ChildHeader, SegmentedControl, DependentForm, Stepper, ResultField, ConfirmDialog |
| `memo_edit` | ChildHeader, TextareaField, Counter, StickyActions |
| `options` | ChildActionHeader, ManagementList, FormField, PopoverMenu, ActionSheet |
| `ingredient_delete` | ChildHeader, DangerPreview, ConfirmDialog |
| `stock` | ChildHeader, FilterChips, KPI, EventList, ActionSheet, ConfirmDialog |
| `purchase` | ChildHeader, FilterChip, KPI, ComparisonBadgeList |
| `ingredient_changes` | ChildHeader, AuditKPI, ChangeList, BeforeAfterSheet |
| `discard` | 숨김 보존, `stock` 폐기 필터 상태로 대체 |

### 20.2 레시피

| 화면 | 주요 패턴 |
|---|---|
| `recipe_main` | MainHeader, CategoryTabs, FilterChips, RecipeCardList, FAB |
| `recipe_detail` | ChildActionHeader, StatusSelect, KPI, DonutComposition, CostTable, PreviewCard |
| `recipe_price_sim` | ChildHeader, NumericField, SegmentedControl, ProfitTable, LiveResult |
| `recipe_add` | ChildHeader, FormField, EmptyState, AddAction, CostPreview, StickyPrimary |
| `recipe_edit` | ChildHeader, FilledForm, EditableIngredientList, UsageFormSheet, StickyPrimary |
| `recipe_ingredient_search` | ChildHeader, SearchField, IngredientPickList, UsageFormSheet |
| `recipe_material_search` | ChildHeader, SearchField, MaterialPickList, UsageFormSheet |
| `recipe_materials` | ChildActionHeader, ManagementList, FormSheet, ConfirmDialog |
| `recipe_category` | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `recipe_material_category` | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `recipe_changes` | ChildHeader, AuditKPI, ChangeList, BeforeAfterSheet |
| `profit` | ChildHeader, EmptyState 또는 ChangeList, InfoSheet |
| `fixed_average` | ChildHeader, PeriodFilter, KPI, CostTable |
| `fixed_actual` | ChildHeader, PeriodFilter, EditableCostGroups, WarningCallout, StickyPrimary |

### 20.3 발주

| 화면 | 주요 패턴 |
|---|---|
| `order_main` | MainHeader, StateTabs, OrderCardList, ActionSheet, ConfirmDialog |
| `order_detail` | ChildHeader, OrderSummary, DependentForm, StickyPrimary |
| `order_receive` | ChildHeader, OrderSummary, ResultField, ConfirmDialog, WarningDialog |
| `order_direct` | ChildHeader, PickerField, NumericField, StickyPrimary |

### 20.4 매출관리

| 화면 | 주요 패턴 |
|---|---|
| `sales_main` | MainSubtitleHeader, BusinessStateCard, HeroKPI, QuickActions, LiveList |
| `analytics` | ChildHeader, PeriodFilter, SummaryKPI, DataTable |
| `day` | ChildHeader, ProfitKPI, CostTable, DetailSheet |
| `day_full` | ChildHeader, HierarchicalProfitTable |
| `revenue` | ChildHeader, SummaryTable, ExpandableList |
| `menu` | ChildHeader, MenuProfitList |
| `channel` | ChildHeader, ChannelProfitTable |
| `material` | ChildHeader, MaterialCostList, DetailSheet |
| `extra` | ChildHeader, MaterialCostList, DetailSheet |
| `waste` | ChildHeader, LossSummary, WasteList |
| `sales_fixed` | ChildHeader, FixedCostSummary, ExpandableDetail |
| `expense` | ChildHeader, ExpenseList, FormSheet, ConfirmDialog |
| `tax` | ChildHeader, TaxSummaryTable |
| `stock_check` | ChildHeader, WarningCard, ExpandableList |
| `sales_past` | ChildHeader, EditableDayList, StickyPrimary, ConfirmDialog |

### 20.5 MY

| 화면 | 주요 패턴 |
|---|---|
| `my_main` | MainSubtitleHeader, StoreCard, SettingsList |
| `my_fixed` | ChildHeader, PeriodFilter, KPI, CostTable |
| `my_fixed_edit` | ChildHeader, PeriodFilter, EditableCostGroups, StickyPrimary |
| `my_settings` | ChildHeader, SettingsList |
| `my_ingredient_categories` | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `my_recipe_categories` | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `my_material_categories` | ChildActionHeader, ReorderList, FormSheet, ConfirmDialog |
| `my_materials` | ChildActionHeader, ManagementList, FormSheet, ConfirmDialog |
| `my_tax` | ContextHeader, TaxForm, RadioGroup, ResultPreview, StickyPrimary |
| `my_language` | ChildHeader, RadioList, PreviewSheet, StickyPrimary |
| `my_units` | ChildHeader, SettingsList |
| `my_vendors` | ChildActionHeader, ManagementList, FormSheet, ConfirmDialog |
| `my_channels` | ChildHeader, SettingsList, FormSheet, ConfirmDialog |
| `my_hours` | ChildHeader, Toggle, SegmentedControl, TimePickerSheet, StickyPrimary |
| `my_notifications` | ChildHeader, SwitchList |
| `my_account` | ChildHeader, AccountSummary, DangerZone, ConfirmDialog |

### 20.6 화면 식별자 감사 메모

- 화면 키는 62개이며 제품 카탈로그에는 61개를 노출한다. 숨김 `discard`가 나머지 1개다.
- `ORD-02`는 `order_detail`과 `order_direct`가 함께 사용한다.
- `SALES-18`은 `channel`과 `tax`가 함께 사용한다.
- `MY-05`는 `my_fixed`와 `my_units`가 함께 사용한다.
- MY에서 재사용하는 레시피·부자재 관리 화면은 `RCP-12`, `RCP-12b`, `RCP-13`을 유지한다.

같은 화면 ID가 다른 화면 의미에 중복되는 항목은 화면 설계와 별개로 라우트·기능 문서에서 정리해야
한다. UI 가이드의 컴포넌트 매핑은 화면 키를 기준으로 한다.

## 21. 팝업·상태 유형 매핑

전체 125개 호스트 상태는 중복 제거 시 99개 ID다. 같은 ID를 여러 화면이 재사용하더라도 화면별
진입 경로와 데이터는 각각 검수한다.

| 유형 | 고유 ID | 호스트 상태 수 |
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

### 21.1 PageState · 9개

팝업이 아니라 같은 페이지의 조건부 표시다.

- `ingredient_option_filled`, `ingredient_option_empty`
- `stock_inbound`, `stock_deduct`, `stock_discard`
- `option_list`, `option_add`, `option_edit`, `option_vendor_new`

`discard_type`, `discard_period`는 숨김 폐기 화면의 옛 상태다. 현재 제품 계약은 `stock`의 폐기 유형
필터이며 새 PageState로 사용하지 않는다.

### 21.2 PickerSheet · 27개

- 식재료: `sort`, `add_category`, `add_unit`, `edit_category`, `edit_unit`, `stock_option`,
  `option_vendor`, `option_unit`, `stock_period`, `stock_type`, `stock_order`, `purchase_period`.
- 레시피: `recipe_sort`, `recipe_status`, `recipe_target`, `recipe_category_pick`,
  `material_category_pick`.
- 발주: `order_ingredient`, `order_vendor`.
- 매출관리: `sales_sort`, `sales_period`.
- MY: `fixed_period`, `tax_country`, `hours_break_start`, `hours_break_end`.
- 숨김 옛 상태: `discard_type`, `discard_period`는 신규 경로에서 사용하지 않는다.

검색이 포함된 `order_ingredient`와 적용 버튼이 있는 `sales_period`는 PickerSheet의 검색형·복합형
변형이다. 일반 단일 선택과 같은 구조로 억지로 축약하지 않는다.

### 21.3 FormSheet · 27개

- 레시피: `recipe_memo`, `recipe_ingredient_usage`, `recipe_material_usage`, `material_add`,
  `material_edit`, `category_add`, `category_edit`.
- 고정 지출: `fixed_channel`, `fixed_item_add`.
- 발주: `order_order`, `order_receive`.
- 매출관리: `sales_qty`, `sales_etc`, `sales_expense`, `sales_direct_period`, `expense_add`,
  `past_sale_qty`, `past_etc`, `past_expense`.
- MY: `tax_item_add`, `vendor_add`, `vendor_edit`, `channel_edit`, `hours_start`, `hours_end`,
  `hours_timezone`, `account_delete`.

복합형 규칙:

- `fixed_channel`: 선택과 직접 배분 입력이 함께 있으므로 선택 후 입력 영역을 점진적으로 노출한다.
- `order_receive`: 입력·계산 결과·확정 행동을 한 흐름으로 묶는다.
- `hours_start/end/timezone`: 추천 선택과 직접 입력을 구분한다.
- `account_delete`: 확인 문구 입력 FormSheet 다음에 최종 ConfirmDialog를 두는 2단계 흐름을 권장한다.

### 21.4 InfoSheet · 16개

- 변경·이력: `stock_event_more`, `ingredient_change_detail`, `recipe_change_detail`, `profit_detail`.
- 안내: `recipe_target_help`, `order_price_spike`, `language_preview`.
- 발주 목록: `order_candidates`, `order_waiting`, `order_received`.
- 매출 상세: `sales_menu_profit`, `sales_revenue_all`, `sales_material_detail`,
  `sales_extra_detail`, `sales_fixed_expand`, `stock_check_all`.

목록이 길어지거나 독립 검색·필터가 필요하면 InfoSheet를 전체 페이지로 승격한다. `stock_event_more`는
정보와 철회 행동이 함께 있으므로 하단 행동을 명확히 분리한다.

### 21.5 ActionSheet · 2개

- `option_card_menu`: 구매 링크 열기·수정.
- `sales_state`: 브레이크 시작·영업 종료 같은 상태 명령.

ActionSheet는 정보 선택이 아니라 현재 대상에 실행할 행동을 고르는 요소다. 파괴 행동은 일반 행동과
시각적으로 분리하고 실행 전 ConfirmDialog를 연다.

### 21.6 ConfirmDialog · 15개

- 재고·구매 링크: `stock_confirm`, `option_delete`, `stock_event_revert`.
- 레시피·마스터: `recipe_stop`, `material_delete`, `category_delete`.
- 발주: `order_cancel`, `order_revert`.
- 매출관리: `sales_break`, `sales_close`, `sales_shortage`, `expense_delete`, `past_save`.
- MY: `vendor_delete`, `channel_disable`.

`sales_shortage`는 오류창이 아니라 음수 재고 기록을 계속할지 묻는 확인창이다. 부족을 숨기거나 판매를
자동 차단하지 않는다.

### 21.7 SuccessDialog·ErrorDialog·PopoverMenu

- SuccessDialog: `tax_saved`.
- ErrorDialog: `stock_error`.
- PopoverMenu: `option_more`.

단가 급등 `order_price_spike`는 저장 가능한 경고이므로 ErrorDialog가 아니라 InfoSheet 또는
WarningDialog 변형을 쓴다.

### 21.8 현재 구현과 가이드의 차이

- 현재 중앙창 판정은 팝업 의미가 아니라 내부 클래스 조합에 의존한다. 새 구조는 각 ID가 팝업 유형을
  명시적으로 선언해야 한다.
- `recipe_price_sim`은 독립 페이지가 최종 계약이다. 소스에 남은 옛 동명 팝업 렌더러는 제거 대상이다.
- `order_candidates`, `order_waiting`, `order_received`는 현재 InfoSheet지만 목록 규모가 커지면 전체
  페이지로 승격한다.
- `option_more`는 URL상 화면 상태처럼 보이더라도 의미상 PopoverMenu다.

## 22. 검수 체크리스트

### 22.1 화면 공통

- [ ] 화면 제목·헤더 변형이 맞는가
- [ ] 하단 탭 현재 상태가 의미적으로 전달되는가
- [ ] 페이지 좌우·하단 Safe Area가 확보됐는가
- [ ] 카드·섹션·행의 공통 간격을 쓰는가
- [ ] 같은 역할의 글자 크기·굵기·색상이 같은가
- [ ] 긴 번역과 200% 글자 확대에서 잘리지 않는가
- [ ] 음수·0·큰 숫자·단위가 올바르게 표시되는가

### 22.2 입력

- [ ] 실제 입력 요소인가
- [ ] 라벨·필수·선택 상태가 명확한가
- [ ] placeholder와 입력값이 16px인가
- [ ] focus-visible이 보이는가
- [ ] 오류 이유와 수정 방법이 표시되는가
- [ ] 키보드가 필드·하단 버튼을 가리지 않는가
- [ ] 저장 중 중복 제출이 막히는가
- [ ] 실패 후 입력값이 유지되는가

### 22.3 팝업

- [ ] 목적에 맞는 팝업 유형인가
- [ ] 제목 아래 중복 설명이 없는가
- [ ] 닫기·배경 클릭·뒤로가기 규칙이 맞는가
- [ ] 하단 행동이 스크롤과 키보드에 가려지지 않는가
- [ ] 초기 포커스·포커스 트랩·복귀가 동작하는가
- [ ] 위험 행동은 중앙 확인창을 한 번 더 거치는가

### 22.4 상태

- [ ] 로딩·새로고침·빈 상태·오류·오프라인이 있는가
- [ ] 필터 결과 없음과 최초 데이터 없음이 구분되는가
- [ ] 계산 미리보기와 서버 확정값이 구분되는가
- [ ] 최근 갱신 시각과 적용 시점이 필요한 곳에 있는가
- [ ] 저장·삭제·철회 성공과 실패 피드백이 있는가

### 22.5 접근성

- [ ] 터치 영역이 44×44px 이상인가
- [ ] 텍스트·UI 대비가 기준을 만족하는가
- [ ] 색 외의 상태 단서가 있는가
- [ ] 아이콘 버튼 이름이 구체적인가
- [ ] 탭·선택·토글 상태가 의미 속성으로 전달되는가
- [ ] 동적 값이 `aria-live`로 전달되는가
- [ ] 차트에 텍스트 대체 정보가 있는가

## 23. 적용 순서

### P0 · 먼저 확정

1. 타이포·색상·간격·모서리·높이·레이어 토큰
2. 미정의 CSS 변수와 모바일 캐스케이드 충돌 제거
3. FormField와 입력 검증·오류·키보드 계약
4. Button·IconButton·탭·셀렉트의 상태 통합
5. PickerSheet·FormSheet·ConfirmDialog·PopoverMenu 분리
6. 포커스·대화상자·터치 영역·색상 대비
7. 로딩·저장 중·오류·오프라인 상태
8. 금액·수량·단가·비율·날짜 formatter

### P1 · 주요 컴포넌트 통합

1. CardHeader·Row·Table·KPI
2. ResultField와 계산값 출처·적용 시점
3. SegmentedControl·FilterChip·Stepper·Switch
4. 관리 목록·재정렬·전체보기
5. 업무 상태 전환·감사 내역·파괴 행동
6. 반응형·Safe Area·키보드 회피

### P2 · 확장

1. 실제 사용 그래프와 접근 가능한 대체 표
2. 태블릿·가로모드·200% 큰 글자
3. 긴 번역·RTL·국가별 통화·날짜
4. 모션·reduced motion
5. hover·pressed·고대비 모드

## 24. 문서 운영 규칙

- 이 문서에는 현재 사용할 규칙만 남긴다.
- 규칙이 바뀌면 기존 항목을 교체하고 변경 이력에 새 PRT 항목을 추가한다.
- 화면별 예외는 해당 화면의 현재 확정안에 이유와 함께 기록한다.
- 예외가 2개 화면 이상 반복되면 공통 컴포넌트 변형으로 승격한다.
- 실제 Expo 반영 전에는 토큰·컴포넌트 이름을 Expo kit에 매핑하고 별도 검수한다.
- 프로토타입 전수 검수는 PC와 모바일 링크를 각각 확인한다.
