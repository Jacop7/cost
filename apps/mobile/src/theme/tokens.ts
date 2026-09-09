/**
 * 디자인 토큰 — ver.2 프로토타입 kit.jsx 의 T·STATUS 를 RN으로 이식(확정 원천).
 * Toss/Cashnote 스타일: primary=블루, 긍정=초록, 주의=앰버, 위험=레드, 비용=그레이.
 */

import { formatNumber, getLocale, type StockState } from '@margincook/core';

export const T = {
  // surfaces
  bg: '#F2F4F6',
  surface: '#FFFFFF',
  surface2: '#F9FAFB',
  // brand
  blue: '#3182F6',
  bluePressed: '#2272EB',
  blueTint: '#EBF3FE',
  blueLine: 'rgba(49,130,246,0.2)', // 파랑 강조 구분선(편집·구매옵션·발주완료)
  // 컬러 배경 위 글자·아이콘(반전) — 흰 surface와 의미 분리
  onColor: '#FFFFFF',
  // 모달·시트 딤 배경(스크림)
  scrim: 'rgba(0,0,0,0.42)',
  // text
  ink: '#191F28',
  ink2: '#333D4B',
  sub: '#4E5968',
  sub2: '#6B7684',
  ter: '#8B95A1',
  // lines
  line: '#E5E8EB',
  line2: '#F2F4F6',
  // status
  green: '#0B7F58',
  greenTint: '#E7F7F0',
  amberTint: '#FFF4E5',
  red: '#DA1222',
  redTint: '#FEECEC',
  // 부족 상태 텍스트는 가독성 위해 진한 주황 사용(프로토타입 동일)
  amberText: '#A16000',
  // 인라인 통합 — 반복 사용되던 색을 토큰화
  line3: '#D1D6DB', // 밑줄형 탭/헤더 하단 구분선 · chevron 아이콘 (grey300)
  gray400: '#B0B8C1', // Toss grey400 — 차트(세금) 등 옅은 회색 단계
} as const;

/** 폰트 — 프로토타입은 Pretendard. RN에서는 expo-font 로 번들 후 fontFamily 지정. */
export const FONT = {
  family: 'Pretendard',
  // RN tabular-nums: style={{ fontVariant: NUM }}
  num: ['tabular-nums'] as const,
};

/**
 * 타입 스케일 — 크기 6단계(22·20·18·16·14·13) · 굵기 3단계(800·700·600)로 일원화.
 * 신규 UI는 인라인 fontSize/fontWeight 대신 이 토큰 사용(기존 화면은 점진 치환).
 *
 * `lineHeight` 는 **절대 dp** 다(결정 6-2 — RN 의 lineHeight 는 배수가 아니라 dp).
 * 값 `28 / 26 / 24 / 22 / 22 / 20 / 18` 은 **소유자가 확정한 6-2 표 그대로**다.
 *
 * ⚠ 이 값을 `round(fontSize × 1.4)` 로 다시 계산하지 마라. `default 1.4`(§4.8)는 앞
 *   단계의 **수렴 방향**이었고, 후행 소유자 결정이 역할별 절대값을 직접 지정했다.
 *   display·title·header 가 배수보다 촘촘한 것은 역할별 판단일 수 있으므로 일괄 배수로
 *   덮으면 안 된다. `PRT-211` 초판이 31/28/25 로 계산해 넣었고 솔 검수 `F02` 가 잡았다. *
 * **`S2`/`S3` 재측정 대상** (페이블 조건 3): 앱 실측에서 짝이 확인된 것은 `14→20`(41자리)
 * `16→22` 뿐이다. `display 28` · `title 26` · `header 24` · `captionSm 18` 은 **앱에 없던
 * 값**이므로, 적용 단계에서 세로 방향 **시각 변화**로 분류해 렌더 감사에 포함한다.
 * `13→19`(2자리)·`13→16`(1자리)이 18 과 다르지만 표본이 작아 확정표를 따른다.
 */
/**
 * 자간은 TYPE 역할에 붙인다. `displayTight`는 2026-09-06 소유자 결정으로 승인된
 * 22px 화면 제목·큰 숫자 전용이고, `titleTight`는 20px 상세·시트 제목 전용이다.
 */
export const letterSpacing = { none: 0, displayTight: -0.6, titleTight: -0.3 } as const;

export const TYPE = {
  display: { fontSize: 22, fontWeight: '800', lineHeight: 28, letterSpacing: letterSpacing.displayTight }, // 큰 숫자·금액 강조
  title: { fontSize: 20, fontWeight: '800', lineHeight: 26, letterSpacing: letterSpacing.titleTight }, // 화면·시트 제목, 항목명
  header: { fontSize: 18, fontWeight: '700', lineHeight: 24 }, // 앱 헤더·섹션 헤더
  body: { fontSize: 16, fontWeight: '700', lineHeight: 22 }, // 본문 기본(행 제목·값)
  bodyWeak: { fontSize: 16, fontWeight: '600', lineHeight: 22 }, // 본문 보조
  caption: { fontSize: 14, fontWeight: '600', lineHeight: 20 }, // 라벨·캡션
  captionSm: { fontSize: 13, fontWeight: '600', lineHeight: 18 }, // 칩·탭 라벨
} as const;

/** 아이콘 크기 — 실측 3단계. `Icon size` 인자에 이 값만 넣는다. */
export const iconSize = { sm: 16, md: 20, lg: 24 } as const;

/**
 * 최소 터치 영역 — **시각 높이와 분리된 값이다**(결정 9-1).
 *
 * 상자를 44 로 키우는 것이 아니라, 상자가 44 보다 작으면 `hitSlop` 으로 채운다.
 * 계약은 **축마다** 성립해야 한다 —
 *   유효 폭  = `width  + hitSlop.left + hitSlop.right`
 *   유효 높이 = `height + hitSlop.top  + hitSlop.bottom`
 * `hitSlop` 이 숫자면 네 방향이 같지만 객체면 축이 갈린다. 앱은 이미 이 산수를 하고 있다 —
 * `34 + 2×5 = 44` · `40 + 2×2 = 44`.
 *
 * **현황 수치를 여기 적지 않는다.** 권위는 감사 스크립트와 그 목록이다 —
 * `scripts/touch-target-audit.mjs` 와 `scripts/touch-target-known.json`.
 * 주석에 숫자를 복제하면 코드가 바뀔 때 주석만 낡는다(솔 검수 `F03`).
 * **보정 방식은 자리마다 다르다** (솔 검수 `R3 F04` — 문서마다 달리 적혀 있었다):
 *   `hitSlop` — 아이콘 전용 버튼처럼 **의도적으로 작은 컨트롤**. 시각 변화 0 이라 `S4a` 의 몫이다.
 *   `minHeight` — 공용 `Button` 처럼 **높이가 padding + 글자로 정해지는 컴포넌트**. 상자가
 *     실제로 커지므로 **시각 변화이고 `S4` 의 몫이다.** `S4a` 에서 건드리지 않는다.
 * 부모 경계로 잘리는지와 이웃 터치 영역 중첩은 **정적 분석으로 못 본다** — `S4` 렌더 감사의 몫이다.
 */
export const minTouchTarget = 44;

/**
 * 목록 행 최소 높이 — 가이드 `ListRow` 계약(3줄 92 · 2줄 76 · 1줄 60).
 *
 * "행처럼 보이는 것" 전부가 아니라 **기록·관리·설정·선택 목록의 행**만 이 값을 쓴다.
 * 실측에서 24자리 중 8자리만 목록 행이었고 나머지는 헤더·입력·조건 줄·버튼·카드 내부 행이라
 * 각자 다른 규격이다.
 */
export const rowMinHeight = { oneLine: 60, twoLine: 76, threeLine: 92 } as const;

/**
 * 조작 상자의 **시각 높이** — 두 단계다(결정 `11-3`).
 *
 * `minTouchTarget` 과 **분리된 값**이다. 상자를 44 로 키우는 것이 아니라,
 * 유효 폭·높이가 **각각** 44 이상이 되도록 자리마다 `hitSlop` 으로 채운다(산식은 `minTouchTarget` 참조).
 *
 * 헤더의 맨 아이콘 버튼 40 은 여기 세 번째 숫자로 넣지 않는다 —
 * "헤더 액션" 이라는 **컴포넌트 역할**이므로 `COMPONENT.appHeader.iconButton.visualSize` 가
 * 소유한다. 값(32·38)→의미→컴포넌트 3계층 원칙이고, `action.*`(2-4)·`myHubTile.*`(8-2)이
 * 이미 같은 방식이다.
 */
export const controlVisualHeight = { sm: 32, md: 38 } as const;

/** kit 공개 상태 키는 core 재고 상태 계약을 그대로 쓴다. */
export type StatusKey = StockState;

/** 숫자 정렬용 tabular-nums 스타일 (kit tnum). */
export const tnum = { fontVariant: ['tabular-nums'] } as { fontVariant: ('tabular-nums')[] };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 } as const;

/**
 * 색 역할 — **이름이 계약이고 값은 우연히 같을 수 있다.**
 *
 * `T` 는 표면·팔레트고 이쪽은 **역할**이다. 같은 헥스가 두 역할에 들어가도 이름은 나눈다 —
 * `action.primaryPressed` 와 `text.link` 가 지금 같은 값인 것이 그 경우다.
 * 값은 `DS-20260905-001`(문항 1·2)과 그 부록 §8.2a 에서 왔고, 전부 WCAG AA 를 만족한다.
 * `S2`에서 화면 사용처를 이 역할로 이관했다. 신규 화면은 팔레트 `T.blue*`를 직접 쓰지 않는다.
 *
 * **권위 관계** (솔 검수 `F05`)
 *   - `tokens.ts` — **앱 정본**이다. 앱의 색 역할은 여기서 나온다.
 *   - `docs/prototypes/…-contrast-contract.json` — 프로토타입과 공유하는 **결속된 계약 투영**.
 *     원천이 아니라 대조본이고, 갈리면 앱 게이트가 FAIL 한다.
 *   - `scripts/design-token-contrast.mjs` — **앱 게이트**. `verify` ③ 에서 매 커밋 돈다.
 *   - `…-contrast-gate.mjs` — 프로토타입 게이트. 별개 스크립트이고 로컬 전용이다.
 *
 * 기준은 절대값 4.5:1(글자) / 3:1(비텍스트)이고 **반올림 전 원시값으로 판정**한다.
 * 경계값 둘 — 흰 글자 on `action.primary` 4.50 · `text.tertiary` on `bg` 4.50.
 * 표면 색을 한 톤이라도 바꾸면 그 커밋에서 FAIL 한다.
 */
export const COLOR = {
  text: {
    /** 본문 제목·값. */
    primary: '#191F28',
    /** 본문 보조. */
    secondary: '#4E5968',
    /** 보조 글자 — 읽히는 글자다. `disabled` 와 **이름을 나눴다**(결정 1-3). */
    tertiary: '#66717E',
    /** 비활성 글자. WCAG 1.4.3 이 비활성 컴포넌트를 면제하므로 대비 재고 대상이 아니다. */
    disabled: '#8B95A1',
    /** 링크 — **전경 의무**라 네 표면 전부 4.5 이상이어야 한다(§8.2a). */
    link: '#1465DB',
    linkPressed: '#0E5FD6',
    /** 강조 값·양의 방향. 링크와 값이 같아도 독립적으로 바꿀 수 있게 역할을 분리한다. */
    accent: '#1465DB',
    /** 필수 표시(`*`). */
    required: '#1465DB',
  },
  state: {
    /** 선택된 옵션·탭·칩의 글자. 링크나 KPI 강조와 독립된 상태 역할이다. */
    selectedText: '#1465DB',
  },
  status: {
    positive: T.green,
    caution: T.amberText,
    negative: T.red,
    positiveTint: T.greenTint,
    cautionTint: T.amberTint,
    negativeTint: T.redTint,
  },
  action: {
    /** 주 버튼 **배경**. 그 위 흰 글자가 4.50(경계값)이다. */
    primary: '#1470F5',
    primaryPressed: '#1465DB',
    /** 옅은 파랑 배경(안내 배너·선택 상태·MY 허브 타일). 기존 `T.blueTint` 그대로다. */
    primaryTint: '#EBF3FE',
    /** `tint` 위에 오는 글자·아이콘. */
    onTint: '#1465DB',
  },
  brand: {
    /** 브랜드 식별색 — 로고. 소유자의 말 그대로: "로고는 브랜드 식별, 버튼은 접근 가능한
     *  상호작용이라는 역할 차이가 있습니다." 버튼 색과 미세하게 다른 것은 **의도된 구분**이다. */
    primary: '#3182F6',
  },
} as const;

/** 상태 판정은 core가 하고 kit은 의미 상태 역할만 표시한다. */
export const STATUS: Record<
  StatusKey,
  { label: string; fg: string; bg: string; bar: string }
> = {
  ok: { label: '여유', fg: COLOR.status.positive, bg: COLOR.status.positiveTint, bar: COLOR.status.positive },
  low: { label: '소진 임박', fg: COLOR.status.caution, bg: COLOR.status.cautionTint, bar: COLOR.status.caution },
  out: { label: '소진', fg: COLOR.status.negative, bg: COLOR.status.negativeTint, bar: COLOR.status.negative },
};

/**
 * 그림자 — 다섯 역할. 값은 **코드 실측**이고 지어낸 것이 아니다.
 *
 * 그림자는 색 하나로 판정할 수 없다 — `shadowColor`·`Offset`·`Opacity`·`Radius`·`elevation`
 * 다섯이 한 묶음이어야 역할이 정해진다. `sheet` 가 위로 지는(`height: -8`) 유일한 그림자이고,
 * `fab` 만 검정이 아니라 **파랑 그림자**를 쓴다.
 * `bottomBar` 는 이름을 쓰지 않는다 — 하단 탭바에 그림자가 없기 때문이다(결정 `D-11`).
 */
export const shadow = {
  /** 카드 — 프로토타입 boxShadow '0 1px 3px rgba(0,0,0,0.04)' 의 RN 등가. */
  card: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  /** 시트 — 위로 지는 그림자. `Sheet.tsx:30` 실측. */
  sheet: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16 },
  /**
   * FAB — 검정이 아니라 **파랑 그림자**다. `kit/index.tsx:151` 실측.
   *
   * 배경과 그림자 모두 `COLOR.action.primary`를 참조한다. 브랜드색과 다시 결합하지 않는다.
   */
  fab: { shadowColor: COLOR.action.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 6 },
  /** 슬라이더 손잡이 — `Slider.tsx:50` 실측. `D-9` 잔여가 이 발견으로 닫혔다. */
  sliderThumb: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  /** 스위치 노브 — `MyNotificationsScreen.tsx:34` 실측. */
  switchThumb: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
} as const;

/**
 * 금액 표기 (kit won) — 통화기호 없이 숫자만. 호출부가 뒤에 '원'을 붙인다.
 *
 * 서식 규칙은 `@margincook/core` locale.ts 단일 출처를 쓴다. `toLocaleString('ko-KR')` 은
 * Hermes 의 Intl 구현에 의존해 기기마다 결과가 달라질 수 있는데, 금액은 기기와 무관해야 한다.
 *
 * ⚠ 지금은 **'ko' 고정**이다. 언어·통화 설정(MY-08)의 선택값을 여기 연결하면 앱 전체 금액 표기가
 *   바뀌지만, 실제 언어 전환은 아직 활성화하지 않기로 했으므로 연결하지 않는다.
 *   연결 시점에는 화면 재렌더 경로(스토어 구독)도 함께 설계해야 한다 — 모듈 값만 바꾸면 이미 그려진
 *   화면이 갱신되지 않는다.
 */
export const won = (n: number): string => {
  const L = getLocale('ko');
  return formatNumber(n, { digits: L.moneyDigits, group: L.group, decimal: L.decimal });
};

/**
 * 컴포넌트 계층 — **한 컴포넌트가 소유하는 값**이다.
 *
 * 범용 스케일에 넣으면 "왜 이 숫자가 여기 있나" 가 이름에 안 남는다. 역할이 컴포넌트에
 * 있으면 컴포넌트가 갖는다. 결정 `2-4`(`action.*`) · `8-2`(`myHubTile.*`) · `11-3`(헤더)이
 * 모두 같은 처리다.
 */
export const COMPONENT = {
  /** 식재료 상세 카드·미리보기. 사용자가 지정한 전체 흐름 프로토타입의 배치 규격. */
  recentChange: {
    timestamp: { ...TYPE.captionSm, fontSize: 12, fontWeight: '700' },
  },
  ingredientDetail: {
    cardGap: 11,
    cardPaddingVertical: 15,
    rowGap: 10,
    moreMinHeight: 45,
    metadataGap: 7,
    metadataPaddingHorizontal: 8,
    metadataPaddingVertical: 5,
  },
  /** 식재료 추가처럼 세로로 쌓는 폼의 공용 opt-in 규격. */
  stackedForm: {
    controlMinHeight: 50,
    controlPaddingHorizontal: 14,
    fieldGap: 15,
    columnGap: 9,
    labelGap: 7,
    labelInset: 2,
    label: { ...TYPE.caption, lineHeight: 16, fontWeight: '800' as const },
    value: TYPE.body,
  },
  /** 모든 필터/정렬 트리거: 작은 캡슐형. 큰 글꼴에서는 높이가 자연스럽게 늘어난다. */
  filterChip: {
    minHeight: controlVisualHeight.sm,
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    gap: space.xs,
    borderRadius: radius.full,
    label: { ...TYPE.captionSm, fontWeight: '700' as const },
    iconSize: 14,
    hitSlop: (minTouchTarget - controlVisualHeight.sm) / 2,
  },
  /** 사용자 첨부 기준: 옅은 배경의 작은 사각 뱃지. 6px 반경은 뱃지 소유 형상이다. */
  badge: {
    // 배지 높이(18/20px)는 유지하고 글자만 13→12px로 줄인다(사용자 결정).
    text: { ...TYPE.captionSm, fontSize: 12 },
    borderRadius: 6,
    small: { paddingHorizontal: space.xs, paddingVertical: 0 },
    regular: { paddingHorizontal: 6, paddingVertical: 1 },
  },
  input: {
    /** 기존 공용 Input의 시각 계약. 화면별 입력은 이 값을 다시 만들지 않는다. */
    gap: space.sm,
    radius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    activeBorderWidth: 1.5,
    textSize: TYPE.bodyWeak.fontSize,
    textWeight: TYPE.bodyWeak.fontWeight,
    border: {
      default: T.line,
      accent: COLOR.text.accent,
      danger: COLOR.status.negative,
    },
  },
  actionSheet: {
    /** 기존 Expo 행동 메뉴의 시각값. 프로토타입 픽셀값으로 재산출하지 않는다. */
    sheetRadius: radius.xl,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    handleWidth: 40,
    handleHeight: 5,
    handleGap: space.md,
    groupRadius: radius.lg,
    groupGap: space.sm,
    rowPaddingVertical: space.xl,
    textSize: TYPE.body.fontSize,
    textWeight: '600' as const,
    floating: { inset: 10, bottom: space.md, rowHeight: 50, textSize: TYPE.caption.fontSize },
  },
  hubHeader: {
    /** 프로토타입 `.header.is-main`과 같은 메인 화면 좌우 여백·행 높이. */
    paddingLeft: space.xl,
    paddingRight: space.md,
    paddingRightWithoutActions: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    actionVisualSize: 40,
    /** 실제 누름 상자는 접근성 최소 터치 크기이며, 안쪽 시각 상자만 40dp로 유지한다. */
    actionTouchSize: minTouchTarget,
    actionIconSize: iconSize.lg,
    notificationDot: {
      top: 9,
      right: 10,
      size: 7,
      borderWidth: 1.5,
    },
    /** 부제가 있는 메인 헤더는 프로토타입 `.header.has-subtitle`의 72dp를 따른다. */
    subtitleMinHeight: 72,
    subtitleGap: space.xs,
  },
  appHeader: {
    iconButton: {
      /**
       * 헤더 맨 아이콘 버튼의 시각 크기(결정 `11-3`). 배경도 모서리도 없는 아이콘 버튼이라
       * 타일(`controlVisualHeight.md` 38)과 모양이 다르다. **시각 변화 0** — 지금 값 그대로다.
       *
       * 실측 12자리 중 11자리가 `AppHeader` 의 `right` 슬롯이거나 뒤로 가기 버튼이고,
       * `SalesHomeScreen:363` 한 자리만 `AppHeader` 를 쓰지 않은 손수 만든 헤더 줄이다
       * (역할은 같다 · 별도 정리 대상). `27×40`·`32×40` 두 자리는 정사각이 아니라 이 묶음이 아니다.
       * 터치 영역은 자리마다 `hitSlop` 으로 44 이상을 확보한다. 사용처 수와 미달 여부는
       * `touch-target-audit`가 양방향 래칫하며, 부모 clipping·형제 우선순위는 `S4a`
       * 네이티브 실측이 최종 확정한다.
       */
      visualSize: 40,
    },
  },
  myHubTile: {
    /** 배경 — `action.primaryTint` 를 **참조**한다. 같음을 검사하는 것보다 강제하는 쪽이 낫다. */
    background: COLOR.action.primaryTint,
    /** 아이콘 — 비텍스트라 기준 3:1. tint 위 4.03. */
    icon: COLOR.action.primary,
    /** 라벨 — 글자라 기준 4.5:1. tint 위 4.80. */
    label: COLOR.action.onTint,
  },
  tabBar: {
    /** 한국어 한 줄 기준 높이. 라벨이 실제로 두 줄이 되면 그 초과 높이만 더한다. */
    baseHeight: 60,
    labelBaseLineHeight: TYPE.captionSm.lineHeight,
  },
  fab: {
    /** 일반 flow 탭바 좌표계 안에서의 FAB 기하. */
    bottom: space.xxl,
    visualHeight: 48,
  },
  adjacentActions: {
    /** 32px 시각 상자 둘의 44px 터치 영역이 겹치지 않는 최소 중심 간격. */
    gap: space.md,
    hitSlop: 6,
  },
  chip: {
    /** 필터·선택 칩의 시각 높이. 승인된 중간 컨트롤 높이를 재사용한다. */
    visualHeight: controlVisualHeight.md,
    /** 가로 필터 행은 칩 위아래 12dp 여유까지 실제 viewport 안에 보존한다. */
    rowMinHeight: controlVisualHeight.md + space.xxl,
  },
  button: {
    label: { letterSpacing: -0.2 },
  },
  donut: {
    centerValue: { letterSpacing: -0.5 },
    /** 인접 구간의 명도 대비가 낮아도 경계를 잃지 않도록 트랙을 드러내는 1dp 간격. */
    segmentGap: 1,
  },
  switch: {
    offTrack: '#D5DAE0',
  },
  warningCard: {
    background: COLOR.status.cautionTint,
    border: COLOR.status.caution,
  },
  channelChart: {
    hall: COLOR.brand.primary,
    delivery: '#7A8694',
    takeout: '#C5CCD3',
  },
  profitChart: {
    material: COLOR.text.tertiary,
    fixed: '#5B6573',
    extra: '#CDD3DA',
    tax: T.gray400,
  },
} as const;

/**
 * 화면 레이아웃 의미값. 현재 하단 탭바는 absolute/overlay가 아니라 일반 flow다.
 * 따라서 `scroll.end`에는 탭바 높이와 safe-area를 다시 더하지 않는다. FAB가 있는 화면만
 * 같은 콘텐츠 좌표계의 `bottom + visualHeight + gap`을 사용한다(결정 7-2).
 */
export const LAYOUT = {
  scroll: {
    start: 2,
    end: space.xxl,
    endWithFab: COMPONENT.fab.bottom + COMPONENT.fab.visualHeight + space.xxl,
  },
} as const;
