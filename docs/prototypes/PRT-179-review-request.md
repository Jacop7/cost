# PRT-179 독립 검수 요청 패킷 (솔라 → 검수자)

> 작성자(솔라): Claude Opus · Cowork 세션
> 검수자: Codex (GPT) 또는 페이블
> 요청 성격: **읽기 전용 독립 검수.** 검수자는 파일을 수정하지 말고 Finding과 제안만 낸다.
> 작성일: 2026-09-04

---

## 1. 대상

| 항목 | 값 |
|---|---|
| 산출물 | `docs/prototypes/0_full-page-flow-prototype-ui-applied.html` |
| 변경 후 SHA-256 | `fbb358024fa5746ec60d47e909a7fbdcf977c4973b00bac2f4519c609e4e0335` |
| 변경 전 SHA-256 | `6abc8d67a5d5745ad0d6b4065e33eb9deae79b6eefffdfd48ac0df9110176ba9` |
| 변경 전 사본 | `docs/prototypes/백업/0_full-page-flow-prototype-ui-applied_pre-PRT179.html` |
| 커밋 | `a4af0ae` (branch `codex/prototype-persistence`) |
| 변경 줄 범위 | 2~135행 (2행은 DESIGN_SYNC 표식, 나머지는 `<style>` 블록 내부) |
| 디자인 동기화 ID | `DS-20260904-001` / `PRT-179` |

**참고(읽기 전용) 문서**
`full-page-flow-prototype-ui-guide.md` · `full-page-flow-prototype-current-spec.md`(§2.15 신설) ·
`full-page-flow-prototype-changelog.md`(PRT-179) · `0_full-page-flow-prototype-ui-applied-review.md`(DS-20260904-001) ·
`full-page-flow-prototype-design-work-plan.md`(C-01) · `apps/mobile/src/theme/tokens.ts` · `AGENTS.md`

---

## 2. 무엇을 왜 바꿨는가

**문제**: 숫자 전용 타이포 토큰이 없어 값은 익명 `<b>`, 단위는 익명 `<small>`에 담기고 크기를 부모 카드가 각자 정했다. 값 표시 선택자가 15px 37건 / 16px 38건으로 반씩 갈렸고, 단위는 12px·14px 이중 표준, 굵기는 650·750·850을 포함해 11단계였다. 크기 미지정 `<small>`은 브라우저 기본 `0.83em`이 적용돼 13.33px·11.67px로 렌더됐다.

**변경** (`<style>` 블록 한정, 스크립트·마크업·색 무수정)

| # | 내용 | 건수 |
|---|---|---|
| 1 | 값 선택자 `15px`·`17px` → `16px` | 48 |
| 2 | 단위 선택자 `12px`·`11px` → `13px`, `16px`·`17px` → `14px` | 39 |
| 3 | 큰 핵심값 `25px`·`23px` → `22px` | 4 |
| 4 | 굵기 `750→700` `850→800` `650→600` `900→800` `500→600` `300→400` | 109 |
| 5 | 값 역할 선택자에 `font-variant-numeric: tabular-nums` 부여 | 107 |
| 6 | 입력 suffix 4종 → `14px/600/var(--sub)/간격 8px` 하나로 수렴 | 4 |
| 7 | `b,strong{font-weight:700;font-variant-numeric:tabular-nums}` 및 `small,em{font-size:13px;font-weight:600}` 기본 규칙 신설 | 2 |

**분류 방법**: 셀렉터의 **마지막 단순 선택자**로 판정. `b`/`strong` → VALUE, `small`/`em` → UNIT, 명시적 숫자 클래스는 별도 목록. `.expo-fab`·`.chev`·`.icon`·`.badge`·`.detail-chip`·`.app-tab`·`.nav-button`·`.profit-badge`·`.term-*`는 제외.

---

## 3. 검수 요구사항

- **REQ-1 스케일 준수**: 숫자·단위의 렌더 크기가 UI 가이드 `TYPE` 스케일(`22/20/18/16/14/13`) 밖으로 벗어나지 않는다.
- **REQ-2 굵기 준수**: 공식 굵기 `400/600/700/800` 외 값이 0건이다. (가이드가 `650·750·850` 금지)
- **REQ-3 회귀 없음**: 활성 화면 62개에서 PC·320px 가로 넘침 0건, 콘솔 오류 0건.
- **REQ-4 범위 준수**: 색·마크업·렌더 함수·`<script>` 블록을 변경하지 않았다.

**불변식**
- `AGENTS.md` 절대원칙 3: 앱은 서버 확정값을 재계산하지 않는다 → 이번 변경은 표시 계층 한정이어야 한다.
- 화면 ID·라우트·`RCP-`/`ING-`/`SALES-` 접두 불변.
- 용어 사전 216개 항목 불변.

---

## 4. 반드시 반박·검증해 주기를 요청하는 지점

솔라가 스스로 의심하는 판단이다. 근거가 약하면 Finding으로 지적해 달라.

**F-요청-1 · 단위 12px → 13px 승격의 근거**
가이드 `TYPE` 스케일에 12px이 없어 `captionSm 13px`으로 올렸다(34건). 그러나 원래 12px이 의도된 밀도였을 수 있고, 가이드가 그저 12px 역할을 정의하지 않은 누락일 수도 있다. **가이드에 12px 역할을 신설하는 것이 옳은지, 13px 승격이 옳은지** 판정해 달라. 좁은 폭에서 줄바꿈이 생기는 곳이 있는지도 확인 대상이다.

**F-요청-2 · 전역 기본 규칙 2건의 부작용**
`small,em{font-size:13px;font-weight:600}`은 낮은 특이도라 클래스 규칙이 항상 이긴다고 판단했다. 그러나 `<em>`은 이 프로토타입에서 **필수 표시 `*`** 와 **곱셈 기호 `×26`** 에도 쓰인다. 이 두 용도의 시각이 바뀌지 않았는지 확인해 달라. `b,strong{...tabular-nums}`가 한글 라벨에 걸리는 것은 무해하다고 판단했으나 이견이 있으면 지적해 달라.

**F-요청-3 · 히어로 25px → 22px 축소**
가이드 `TYPE.display 22`를 따랐으나, 히어로 금액의 시각적 위계가 약해질 수 있다. 사용자 확인 없이 솔라가 판단했다. **가이드 준수와 화면 위계 중 무엇이 우선인지** 판정해 달라. 대상은 `.hero-value`, `.hub-hero strong`, `.sales-hero strong`, `.stock-detail-total b` 4건.

**F-요청-4 · 마지막-토큰 분류의 오분류**
`.card-head strong`, `.detail-list-copy strong`, `.channel-profit-head strong` 등은 **라벨**인데 `strong`이라는 이유로 VALUE로 분류되어 `tabular-nums`가 붙었다. 렌더 결과는 무해하지만 분류 자체는 틀렸다. **의미 태그(`<strong>`=라벨 vs 값)의 오용을 이번 변경이 고착시키는지** 판정해 달라.

**F-요청-5 · 가변 굵기 제거의 실효성**
`650/750/850`을 `600/700/800`으로 흡수했다(102건). 이 프로토타입은 `Pretendard`를 쓰는데, **Pretendard가 가변축을 지원한다면 중간값이 실제로 다른 굵기로 렌더되고 있었을 수 있다**. 그렇다면 이번 정규화는 디자인 의도를 지운 것이 된다. 실제 폰트 로딩 환경에서 검증해 달라.

**F-요청-6 · 검수 방법의 한계**
로컬 프로토타입 서버가 내려가 있어 headless Chromium으로 파일을 직접 렌더하고 `getComputedStyle`을 수집해 대조했다. **실기기·실제 폰트·큰 글꼴 설정에서의 검증은 하지 않았다.** 이 증거로 PASS를 주장하는 것이 타당한지 판정해 달라.

**F-요청-7 · 범위에서 제외한 것**
색은 손대지 않았다. 그 결과 다음이 미해결로 남았다 — 이번 회차 범위 밖으로 두는 것이 옳은지 판정해 달라.
- `--blue`가 링크·버튼·활성탭과 결과 금액에 동시에 쓰이는 의미 이중화
- 프로토타입 `--green #0e9f6e` / `--amber #b76e00` / `--amber2 #fff4df` / `--blue2 #eaf3ff` 가 Expo `tokens.ts`의 `green #15B374` / `amberText #E07A00` / `amberTint #FFF4E5` / `blueTint #EBF3FE` 와 **값이 다름**
- 하드코딩 hex 8종, 인라인 `color:var(--ter)` 19건
- 간격(padding/margin/gap) 약 290건이 Expo `space` 6단계 밖, 반경 22종이 `radius` 5단계 밖

---

## 5. 재현 명령

```bash
# 변경 전후 diff (개행 정규화)
diff <(tr -d '\r' < docs/prototypes/백업/0_full-page-flow-prototype-ui-applied_pre-PRT179.html) \
     <(tr -d '\r' < docs/prototypes/0_full-page-flow-prototype-ui-applied.html)

# 실제 렌더 크기·굵기 수집 (Playwright)
#   활성 화면 62개를 순회하며 #content 안 b/strong/small/em 중 숫자를 포함한 요소의
#   computed fontSize / fontWeight 집합과 가로 넘침 여부를 수집
```

**솔라가 측정한 값** (검수자가 재현해 반증해 주기 바란다)

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 숫자 요소 렌더 크기 | `25 / 23 / 22 / 18 / 16 / 15 / 14 / 13.3333 / 13 / 11.6667px` | `22 / 18 / 16 / 14 / 13px` |
| 숫자 요소 렌더 굵기 | `400 / 600 / 700 / 800 / 900` | `600 / 700 / 800` |
| CSS `font-weight` 종류 | 11단계 | 4단계 (`400/600/700/800`) |
| 금지 굵기 잔존 | 102건 | 0건 |
| `tabular-nums` 선언 | 34건 | 138건 |
| PC 1280px 가로 넘침 / 콘솔 오류 | 미측정 | 0건 / 0건 (62화면) |
| 320px 가로 넘침 | 미측정 | 0건 (62화면) |
| 중괄호 균형 | — | 1165 / 1165 |

---

## 6. 판정 요청

`PASS` 또는 `CHANGES_REQUIRED`. `CHANGES_REQUIRED`인 경우 Finding별로 다음을 명시해 달라.

- `finding_id` · 심각도(Major/Minor) · 범주
- 결속되는 REQ 또는 불변식
- 근거 (파일·행 또는 재현 결과)
- 완료 조건
- 가능하면 `proposed_edits` (솔라가 반영한다. 검수자는 파일을 직접 수정하지 않는다)

솔라는 Finding별로 `APPLIED / PARTIAL / REJECTED / NEEDS_HUMAN_DECISION` 중 하나로 응답하고, 반박 시 근거를 붙인다.
