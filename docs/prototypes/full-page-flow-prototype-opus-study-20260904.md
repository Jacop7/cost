# 전체 페이지 흐름 프로토타입 · Claude Opus 독립 전수 스터디 보고서

> 작성: 2026-09-04 · 검수자 컨텍스트: Claude Opus (독립 1회, Study Gate 입력)
> 대상 저장소: `C:\Users\jacop\프로젝트\식자재관리앱`
> 대상 작업본: `C:\Users\jacop\AppData\Local\Temp\codex-prototype-persistence-b10765a\docs\prototypes\`
> 근거 스레드: `codex://threads/01a061d6-1040-7f90-8f24-13af7f900d11` (2026-09-02, 34턴)
> 성격: **분석 전용.** 이 스터디 과정에서 저장소·작업본·브랜치의 어떤 파일도 수정하지 않았다.

---

## 0. 요약 — 재개 전에 반드시 알아야 할 7가지

| # | 판정 | 심각도 |
|---|---|---|
| **F-1** | **공통 UI 컴포넌트 레이어(CSS·JS)가 현재 작업본에 연결돼 있지 않다.** Temp의 `-ui-applied.html`에는 `<link>`·`<script src>`·`data-ui`가 **각각 0건**이다. 반면 브랜치 판본에는 170행·191행에 두 파일이 연결돼 있다. 즉 **공통 레이어는 만들어졌다가 되돌려졌고, PRT-151~178 28건은 레이어 없는 파일 위에 화면별로 작업된 것**이다. | **P0** |
| **F-2** | **문서가 주장하는 커버리지 수치가 실제 코드와 어긋난다.** 실측 활성 고유 popup ID는 **98**인데 문서는 97, 활성 host는 **123**인데 가이드 본문은 120, 적용본 화면 문구는 아직 125다. 검수 커버리지를 이 수치로 판정하면 최소 1개 계약이 검수망을 빠져나간다. | **P0** |
| **F-3** | **최종 PASS는 180개 대상 중 1건뿐이다** (`popup:stock_event_more@stock`). 나머지 179건(99.4%)이 열려 있고, 병목은 전 도메인 공통으로 **Opus 독립 교차검수(REVIEW 139건)**, 그다음이 **모바일 실기기(TODO 97건)**다. 지금 이 스터디가 그 병목의 첫 해소 시도다. | **P0** |
| **F-4** | **자동 동기화 게이트가 지금 FAIL 상태다.** `sync-state.json`이 봉인한 `ui-applied.html` 해시(`6e079a0a…`)와 실제 해시(`6abc8d67…`)가 다르다. 파일 mtime은 **2026-09-04 02:16**으로 DS-027 완료(09-02 15:47)보다 34시간 뒤다. 새 DS ID 없이 적용본이 변경됐다. | **P0** |
| **F-5** | **PRT-151~178 전부와 DS ID 체계 전체, 그리고 5개 운영 문서가 git 밖 Temp에만 있다.** `%LOCALAPPDATA%\Temp\`는 디스크 정리·저장소 센스·백신에 예고 없이 삭제될 수 있고, 사본이 0개다. | **P0** |
| **F-6** | **이전 세부흐름 프로토타입에만 존재하는 핵심 회계 규칙 3건이 통합본에서 증발했다.** ①영업 중 장부 스냅샷 고정(“영업 시작 시점 기준”) ②영업시간 편집·4종 검증 ③기준 단가 추적(주문량 vs 실입고, 전후값, 연결 레시피 재계산). | **P0** |
| **F-7** | **스터디 계획이 15번째 파일을 빠뜨렸다.** `docs/prototypes/international-tax-settings.html`(2026-09-03)은 5개국 세금 계산 엔진의 유일한 원본인데 Codex 스터디 목록(14개)에 없다. | **P1** |

**결론**: 지금 화면 작업(`screen=sales_fixed` / `DS-20260902-028`)을 바로 재개하면 안 된다. **기준선 봉인(F-4·F-5) → 공통 레이어 방향 결정(F-1) → 수치 재기준(F-2)** 세 가지를 먼저 처리해야 이후 작업이 무효화되지 않는다. §11에 결정 항목과 순서를 정리했다.

---

## 1. 스터디 범위와 방법

### 1.1 실제로 읽은 것

| 묶음 | 대상 | 분량 |
|---|---|---|
| A. 운영·설계 문서 | design-context.md, design-work-plan.md, design-work-plan.html, design-sync-state.json, design-sync-check.ps1 | 5종 / 71KB |
| B. 확정·규범 문서 | current-spec.md, ui-guide.md, changelog.md, ui-applied-review.md | 4종 / 536KB |
| C. 구현물 | full-page-flow-prototype.html(보존 원본), -ui-applied.html, -ui-components.css, -ui-components.js | 4종 / 757KB |
| D. 이전 세부흐름 | 14종 + 누락 발견분 `international-tax-settings.html` | 15종 / 435KB |
| E. 제품 권위 자료 | AGENTS.md, ARCHITECTURE.md, CLAUDE.md, features/README.md, theme/tokens.ts, components/kit/**(13파일), docs/작업큐.md, docs/ai-review/README.md | 8묶음 |
| F. 판본 대조 | `codex/prototype-persistence` 브랜치 22파일, 현재 워킹트리 16파일, Temp 27파일 | 3-way |
| G. 대화 이력 | Codex 스레드 rollout jsonl 1,669행 (사용자 43턴 / 응답 88턴 / 도구 152회) | 21MB |

문서는 목차만 훑지 않고 전문을 chunk 단위로 정독했고, 수치는 눈으로 세지 않고 `awk`/`python` 파서로 계수했다.

### 1.2 검산 방법 (재현 가능)

```bash
BASE="$HOME/mnt/codex-prototype-persistence-b10765a/docs/prototypes"

# 공통 레이어 연결 여부
grep -c '<link' $BASE/full-page-flow-prototype-ui-applied.html          # → 0
grep -c 'ui-components' $BASE/full-page-flow-prototype-ui-applied.html  # → 0
grep -c 'data-ui' $BASE/full-page-flow-prototype-ui-applied.html        # → 0
# 브랜치 판본과 비교
cd ~/mnt/식자재관리앱 && git show codex/prototype-persistence:docs/prototypes/full-page-flow-prototype-ui-applied.html \
  | grep -n 'ui-components'   # → 170: <link ...css?v=20260901e> / 191: <script src=...js?v=20260901e>

# screen / popup 계수 (중괄호 균형 파서)
python3 - <<'EOF'
import re
t=open('full-page-flow-prototype-ui-applied.html',encoding='utf-8').read()
def block(name):
    i=t.index('const %s='%name); j=t.index('{',i); d=0; k=j
    while True:
        if t[k]=='{': d+=1
        elif t[k]=='}':
            d-=1
            if d==0: return t[j+1:k]
        k+=1
print('screens:', len(re.findall(r'^\s{6}([a-z_][a-z0-9_]*):\{', block('screens'), re.M)))
pairs=[]
for line in block('popupTabs').splitlines():
    m=re.match(r"^,?\s*([A-Za-z_]\w*)\s*:\s*\[(.*)\]\s*,?$", line.strip())
    if m: pairs += [(m.group(1),x) for x in re.findall(r"\['([^']+)'", m.group(2))]
print('hosts:',len({h for h,_ in pairs}),'pairs:',len(pairs),'uniq:',len({x for _,x in pairs}))
EOF
# → screens: 62 / hosts: 49  pairs: 123  uniq: 98
```

---

## 2. 기준선 결정표 — 어느 판본이 정본인가

같은 파일이 **세 곳에 서로 다른 내용**으로 존재한다. 12자리 SHA-256 앞자리 기준:

| 파일 | `codex/prototype-persistence` 브랜치 | Temp 작업본 | 현재 워킹트리 |
|---|---|---|---|
| `full-page-flow-prototype.html` | `f85c61ccae22` (299,978B) | `ce8856898106` (300,480B) | `c43725976c27` (350,752B, **untracked**) |
| `-ui-applied.html` | `d8caaf99c406` (346,728B) | `6abc8d67a5d5` (432,653B) | 없음 |
| `-ui-components.css` | `84e0d47c0ae3` (9,315B) | `3d043469d759` (16,256B) | 없음 |
| `-ui-components.js` | `fae7b0d1b3da` (8,370B) | `732cca7b7afa` (8,425B) | 없음 |
| `-ui-guide.md` | `8cc2a78d4d19` (121,582B) | `84f47cf82621` (131,434B) | 없음 |
| `-current-spec.md` | `c848c7dc0580` (58,254B) | `da76e00c8cd1` (83,005B) | 없음 |
| `-changelog.md` | `764217c9f8b6` (160,877B) | `2335d3ab1ddd` (195,187B) | 없음 |
| `-ui-applied-review.md` | `870007acf2eb` (58,755B) | `df2cb490328b` (126,578B) | 없음 |
| `-design-context.md` / `-design-work-plan.md` / `.html` / `-design-sync-*` | **전 브랜치에 없음** | 있음 | 없음 |
| `international-tax-settings.html` | 없음 | **없음** | 있음 (2026-09-03) |

### 판정

- **현재 정본은 Temp 작업본이다.** PRT-178 / DS-20260902-027까지 반영돼 있고, 브랜치는 PRT-150에서 멈춘 낡은 사본이다. 브랜치를 기준으로 재개하면 **28회분 작업이 역행**한다.
- **다만 Temp는 git 밖이고 봉인이 깨져 있다**(F-4). “정본이지만 신뢰할 수 없는 정본” 상태다.
- 현재 체크아웃 브랜치는 `codex/ai-team-knowledge-orchestration-plans`(HEAD `6497666`)이며 프로토타입 작업과 무관하다. 워킹트리의 `full-page-flow-prototype.html`은 **untracked**로, 세 판본 중 어디에도 속하지 않는 네 번째 변종이다.
- 프로토타입 전용 브랜치는 **이미 존재한다**(`codex/prototype-persistence`, HEAD `1e6be161`). 새 브랜치를 만들 필요는 없고, **Temp 최신본을 이 브랜치에 정합화해 커밋**하는 것이 맞다.

---

## 3. F-1 · 공통 UI 컴포넌트 레이어가 연결돼 있지 않다

### 3.1 사실관계

| 검사 | Temp `-ui-applied.html` | 브랜치 `-ui-applied.html` |
|---|---|---|
| `<link>` 태그 | **0건** | 1건 (170행, `...css?v=20260901e`) |
| `ui-components` 참조 | **0건** | 2건 (170·191행) |
| `data-ui` 속성 | **0건** | 0건 (JS가 런타임 부여) |
| `data-footer-policy` | 0건 | 0건 |
| `data-layer-type` | 0건 | 0건 |

`-ui-components.css`(16KB)와 `-ui-components.js`(8.4KB)는 **어떤 HTML에서도 참조되지 않는 고아 파일**이다. 디렉터리의 HTML 17종 전부에서 `data-ui`가 0건이다.

### 3.2 왜 이렇게 됐나 (검수 장부에서 확인)

검수 장부 머리말 10~13행:

> **2026-09-01 순차 재구축 시작**: 자동 공통 스타일로 판정했던 기존 `PASS`는 시각 완료 근거에서 제외한다. **적용본을 보존 원본과 동일한 상태로 되돌렸고**, `ING-01`부터 화면·연결 팝업을 순서대로 실제 Expo와 대조해 다시 만든다.

즉 **의도된 되돌림**이다. 공통 CSS/JS 자동 부여 방식이 “화면별 예외를 뭉갠다”는 판단으로 폐기됐고, 그 뒤 PRT-151~178은 화면별 렌더러·CSS를 직접 손보는 방식으로 진행됐다.

### 3.3 문제

1. **문서가 사실과 다르다.** 검수 장부 49~56행 「공통 재구축 근거」와 UI 가이드 §1.7은 여전히 “시각 단일 출처 = `-ui-components.css`, 역할 매핑 단일 출처 = `.js`”, “적용본에 연결했다”고 서술한다. 장부가 근거로 든 “활성 screen 62개에서 공통 역할 0개 화면 0건, 5종 충돌 0건”은 `data-ui`가 애초에 0개이므로 **자동으로 참이 되는 공허 참(vacuous truth)**이다.
2. **적용본은 공통화의 반대 방향으로 갔다.** 원본 대비 인라인 `<style>` +29%(78,887→101,802B), `<script>` +44%(194,078→279,241B), 함수 149→**187개**(삭제 0), 화면별 `!important` 13→16개, `@media` 1→4개. **원본 코드는 하나도 제거되지 않았다.**
3. **연결하는 순간 회귀가 터진다.** CSS 파일에는 이미 화면별 예외를 되받아치는 `!important`가 5개(`.category-arrows` 88px/44px) 박혀 있고, 이는 가이드 PRT-172가 **명시적으로 금지한 규격**이다. `.chip.active{background:var(--ink)}`(적용본 인라인) vs `[data-ui~="filter-chip"].active{background:var(--mc-surface)}`(공통)은 특이도가 동일해 로드 순서로만 결정된다.

### 3.4 결정이 필요한 갈림길

| 선택지 | 내용 | 비용 | 리스크 |
|---|---|---|---|
| **A. 레이어 폐기 확정** | `-ui-components.css/js` 2파일을 archived로 명시하고, 가이드 §1.7·장부 49~56행·§9.2.1을 “화면별 구현 + 문서 규범” 방식으로 개정 | 문서 개정만 | 규격 강제력이 사람의 준수에만 의존 → 재발했던 “같은 역할 다른 규격” 문제가 다시 옴 |
| **B. 레이어 재연결** | `<link>`/`<script>` 복원 후, `roleSelectors` 236개 셀렉터를 현재 적용본 마크업에 재매핑하고 충돌 해소 | 큼. 최소 R4·R5·R6 위험 전부 선처리 필요 | 이미 PASS 받은 매출·발주 화면이 대량 회귀 |
| **C. 하이브리드 (권장)** | 레이어는 연결하지 않되, CSS 변수 블록(`--mc-*` 28개)만 적용본 인라인 `:root`에 병합해 **토큰만 단일화**하고 역할 자동부여는 포기 | 중간 | 낮음. 토큰 이름 매핑(F-01/F-09)이 해소되고 화면별 예외는 그대로 유지됨 |

**이 결정 없이는 §9.2.1 “최근 확정 공통 적용표”도, C-01~C-21 규칙 잠금도 강제 수단이 없다.**

---

## 4. F-2 · 수치 검산 결과

### 4.1 실측 vs 문서 주장

| 지표 | 실측(적용본) | 실측(보존 원본) | 문서 주장 | 판정 |
|---|---:|---:|---|---|
| `screens` 최상위 키 | **62** | 62 | 등록 62 / 활성 62 | 레지스트리 62는 `hidden:true`인 `discard` **포함**. 내비 도달 가능은 **61** → 정의상 off-by-one |
| `popupTabs` host 키 | 49 | 49 | (미언급) | — |
| popup@host 조합 | **123** | 125 | 등록 125 / 활성 120(가이드 본문) 또는 123(표 합계) | 123은 맞지만 **가이드 안에서 120과 123이 충돌** |
| 고유 popup ID | **98** | 99 | 등록 99 / 활성 **97** | **불일치 (+1)** |

### 4.2 `-2`의 정체가 문서 설명과 다르다

문서는 활성 `125−2=123`을 **“숨김 PickerSheet 2개(`discard_type`, `discard_period`) 제외”**로 설명한다. 그러나 실제 코드에서 그 둘은 **여전히 `popupTabs.discard`에 남아 있고**, 실제로 빠진 것은 `recipe_target_help` × 2 호스트(`recipe_add`, `recipe_edit`)다. 산술은 우연히 맞지만 **빠진 항목이 다르다.** 고유 ID는 `recipe_target_help` 1개만 빠졌으므로 `99−1=98`이고, 문서의 97은 성립하지 않는다.

### 4.3 파생 문제

- 적용본 `#term-audit` 히어로 문구가 하드코딩으로 `"화면 62개와 팝업·조건 상태 호스트 125개"`를 표시한다 — 자기 레지스트리(123)와 어긋난다.
- 검수 장부 헤더는 `62 + 120 = 182`라 적었으나 원장 실제 데이터 행은 **180**(screen 62 + popup 118)이다. 부족 2건은 「도메인별 진행표」의 식재료 popup 31 vs 원장 실제 29.
- 확정안 1장 집계표(식재료 41 + 레시피 11 = 52)와 가이드 인용(62/125/99), 8.3(97/97/123)이 **같은 문서 안에서 3중으로 충돌**한다.

### 4.4 데드 엔트리 / 계약 누락

| 유형 | 항목 | 내용 |
|---|---|---|
| 레지스트리에 있으나 **도달 불가** | `discard_type`, `discard_period` | 호스트 `discard`가 `hidden:true`이고 `setScreen('discard')`가 `k='stock'`으로 리라이트 → `active==='discard'`가 될 수 없음. **영구 데드** |
| 핸들러만 있고 **레지스트리에 없음** | `stock_settings`, `recipe_price_sim` | `openPopupTab`/`openActualPopup` 분기에는 존재 |
| **네임스페이스 충돌** | `recipe_price_sim` | 화면 키이면서 동시에 팝업 map 키. `?screen=`은 전체 화면, `openPopupTab`은 시트 |
| **끊긴 링크** | `recipe_target_help` | 적용본이 `data-popup-link="recipe_target_help"` 마크업을 여전히 4회 방출. 클릭하면 URL에 `?popup=recipe_target_help`를 쓰고 **아무것도 열지 않는다** |

---

## 5. F-3 · 검수 상태 실측

### 5.1 정본은 「전체 target 장부」다

검수 기록 문서는 4개 층(공통 층 / 서술 층 / **원장 층** / 작업 층)으로 되어 있고, 문서 스스로 10~13행에서 “과거 PASS 표는 변경 이력으로만 보존하며 최신 판정으로 사용하지 않는다”고 규정한다. 서술 층의 `최종 판정: PASS` 18건, DS 블록의 `결과: PASS` 27건은 **집계 대상이 아니다.**

### 5.2 원장 180행 최종 상태

| final | screen (62) | popup (118) | 계 |
|---|---:|---:|---:|
| `CODEX_PASS` | 16 | 42 | **58** |
| `IN_PROGRESS` | 23 | 34 | **57** |
| `TODO` | 12 | 28 | **40** |
| `COMPLETE` | 11 | 13 | **24** |
| `PASS` | 0 | 1 | **1** |

축별: `Codex` PASS 140 / TODO 40 · `PC` PASS 140 / TODO 40 · `mobile` PASS 83 / **TODO 97** · `Opus` **REVIEW 139** / TODO 40 / PASS 1.

### 5.3 도메인별 성격

| 도메인 | 계 | 상태 |
|---|---:|---|
| ingredient | 41 | **전부 TODO(40) + PASS 1** — 2026-09-01 재개방으로 원점 복귀 |
| recipe | 40 | CODEX_PASS 30 / IN_PROGRESS 10 |
| order | 16 | **전부 CODEX_PASS** — 가장 균질 |
| sales | 37 | COMPLETE 12 / IN_PROGRESS 13 / CODEX_PASS 12 |
| my | 46 | **IN_PROGRESS 34** / COMPLETE 12 |

### 5.4 유일한 최종 PASS

```
popup:stock_event_more@stock | ingredient | InfoSheet | COMMON | PASS | PASS | PASS | PASS | PASS
```

브랜치 판본에서도 유일한 PASS다. **공통 재구축 리셋 이후 새로 확보된 최종 PASS는 0건.**

### 5.5 검수 7항목 (정확한 명칭)

`구조 / 요소 / 상태 / 상호작용 / PC / 모바일 / 맥락` — 2번은 “역할”이 아니라 **“요소”**다. AND 조건이며, 원장 6개 컬럼은 이 7항목과 1:1 대응하지 않는다. **7번 「맥락」만 원장에서 추적할 컬럼이 없다.**

### 5.6 상태 어휘 불일치

선언(32행): `TODO / COMMON / CODEX PASS / OPUS PASS / PASS / BLOCKED`
실사용: `TODO / COMMON / REVIEW / CODEX_PASS / IN_PROGRESS / COMPLETE / PASS`
→ 미선언 3종(`REVIEW`·`IN_PROGRESS`·`COMPLETE`)이 실사용되고, 선언된 `OPUS PASS`·`BLOCKED`는 한 번도 쓰이지 않았다. 어휘 선언 절이 실무를 못 따라갔다.

---

## 6. F-4 · 자동 동기화 게이트 FAIL

### 6.1 해시 검산

| 파일 | 봉인 해시 | 실제 | 판정 |
|---|---|---|---|
| `-current-spec.md` | `da76e00c…` | 동일 | ✅ |
| `-changelog.md` | `2335d3ab…` | 동일 | ✅ |
| `-ui-applied-review.md` | `df2cb490…` | 동일 | ✅ |
| `-design-context.md` | `75585099…` | 동일(BOM 제외 기준) | ✅ |
| **`-ui-applied.html`** | **`6e079a0a4792ab9c…`** | **`6abc8d67a5d5745a…`** | ❌ **불일치** |

파일 mtime **2026-09-04 02:16** vs `completedAt` **2026-09-02 15:47:52**. BOM 아티팩트가 아닌 실제 내용 변경이다. 지금 `design-sync-check.ps1`을 실행하면:

```
DESIGN DOC SYNC: FAIL (DS-20260902-027)
- full-page-flow-prototype-ui-applied.html : 완료된 DS-20260902-027 이후 변경됨. 새 동기화 ID 필요
```

### 6.2 게이트가 검사하지 않는 것 (사각지대)

- 장부 §6 체크박스 상태 — **`[ ] 실제 Expo를 수정하지 않았다`가 미체크여도 PASS**
- `uiChange` 값 (읽기만 하고 판정에 미사용 = dead field)
- `공통 변경: 아니오`일 때 `ui-guide.md`/`design-work-plan.md`의 ID 최신성 → **그래서 두 문서가 `DS-20260902-021`에 멈춘 채 027까지 통과했다**
- 화면 검수 12단계·9체크의 실제 수행 여부
- screen/popup 커버리지 총량

### 6.3 문서 간 ID 드리프트 (현재)

| 문서 | 동기화 ID | 상태 |
|---|---|---|
| design-context.md | `DS-20260902-027` | 최신 |
| current-spec.md | `DS-20260902-027` | 최신 |
| changelog.md | PRT-178 / `DS-20260902-027` | 최신 |
| ui-applied-review.md | `DS-20260902-027` | 최신 |
| ui-applied.html | `<!-- DESIGN_SYNC: DS-20260902-027 -->` | 마커는 최신, **내용은 그 이후 변경됨** |
| **ui-guide.md** | `DS-20260902-021` | **6단계 뒤처짐** |
| **design-work-plan.md** | `DS-20260902-021` | **6단계 뒤처짐** |

실행서 §9 상태표도 낡았다. 발주·매출관리를 여전히 `TODO`로 적지만, 장부 DS-013~027은 두 도메인을 실제로 전수 검수했다. 규칙 잠금도 §9는 `C-01~C-20`이라 쓰지만 실제 표에는 **C-21까지 21개**가 있다.

---

## 7. 컴포넌트 계약 — 가이드 vs 실제 CSS 충돌

UI 가이드는 0~9장 + 부록 A/B/C 구성이고, 계약 자체는 정밀하다(토큰 → 셸 → 행동 → 입력 → 결과 → 콘텐츠 → 레이어 → 고정행동 → 접근성). 다만 **가이드와 실제 `-ui-components.css`가 어긋나는 지점이 있다.** 레이어를 재연결한다면(§3.4 선택지 B) 아래가 즉시 P0/P1 후보다.

| 항목 | 가이드 규칙 | 실제 CSS | 충돌 |
|---|---|---|---|
| Badge radius | `radius.full` | `border-radius:6px` | 값 충돌 |
| ResultField 표면 | “중립색 기본, **대표 그룹 한 곳만** tint” (DoD 18: 화면당 파란 표면 1개) | `[data-ui~="result"]`가 **기본값으로** `--mc-primary-soft` 배경 + `#9fc4ff` 경계 + 파란 글자 | **DoD 18 상시 위반** |
| 카테고리 reorder | Row 왼쪽 `28px` 열 + `28×20px` SVG. **`44×44px`·`88px` 가로 묶음 금지**(PRT-172) | `.category-arrows{flex:0 0 88px!important}` / `button{width:44px!important;height:44px!important}` | **정면 충돌**, 게다가 `!important` |
| Notice | “중립 또는 의미 tint” | `#f4f8ff` + `#b8d4ff` 파란색 고정 | 값 충돌 |
| 토큰 이름 | `T.bg/T.ink/T.blue…` (Expo 심볼) | `--mc-bg/--mc-text/--mc-primary…` | **가이드가 `--mc-*` 이름을 한 번도 언급하지 않음** → F-01/F-09 매핑 미연결 |
| 뷰포트 단위 | — | 공통 CSS `100dvh`/`88dvh` vs 적용본 `100vh` | 이중 기준 |
| `--mc-blue` | — | `:root`에 **선언 없음**인데 `.sales-manage-link{color:var(--mc-blue)}`가 사용 | 실질 버그(폴백도 없음) |
| `[data-footer-policy]` | `footerPolicy`가 열 분할 소유 | CSS 분기 4값 정의됐으나 **속성을 쓰는 마크업·JS가 0건** | 영구 미발동 |

### JS 역할 시스템 위험 (연결 시 발동)

- **레이어 타입 판정 불능**: `normalizeRoles`가 `closest('.overlay')?.dataset.layerType`에 의존하는데 적용본에 `data-layer-type`이 **0건**. `ConfirmDialog`/`SuccessDialog`/`ErrorDialog`/`PopoverMenu`가 **전부 `sheet`로 떨어져** 확인 다이얼로그가 바텀시트 스타일로 렌더된다.
- **역할 회수 경로 없음**: `applyPrototypeUiRoles`는 가산 전용. 화면별 클래스가 런타임에 제거돼도 `data-ui` 역할은 남는다.
- **접근성 상태 영구 괴리**: MutationObserver가 `addedNodes`만 본다 → `.active` 클래스 토글(속성 변경)에 재실행되지 않아 `aria-selected`가 최초 스냅샷으로 고정된다.
- **성능**: 매 프레임 문서 전체를 37역할 × 236셀렉터로 재스캔. 적용본은 렌더마다 `#content.innerHTML`을 통째 교체한다.

### 현재 적용본의 접근성 결손 (레이어와 무관, 지금 존재)

`#overlay`가 `role="dialog" aria-modal="true"`를 **정적으로** 갖고 `.open` 클래스만 토글 → **닫힌 상태에서도 모달로 노출**. `aria-live` 0건, `role="tablist"/"tab"` 0건, `aria-expanded`/`aria-checked` 0건, `inert` 0건, 포커스 트랩 없음, `prefers-reduced-motion` 0건, `env(safe-area-inset-*)` **0건**.

---

## 8. 제품 권위 자료와의 충돌 (핵심 22건 중 우선순위 상위)

전체 대조표는 부록 A에 있고, 여기서는 **작업을 멈춰야 하는 것**만 추린다.

| # | 프로토타입 전제 | 제품 권위 | 조치 |
|---|---|---|---|
| C1 | `ING-03a·ING-03c·ING-03d·RCP-02c·SALES-08` 등 프로토타입 전용 ID 사용 | `features/README.md` 인벤토리에 **전부 없음**. `P2-4`(merge `3fe8fab`)가 “화면 ID 중복 0건”을 계약 시험으로 고정 | 신규 ID 승격 금지. 기존 ID 매핑 또는 인벤토리·라우트·머리말 3곳 동시 등록 |
| C2 | `SALES-05` | 정식은 **`SALES-05b`** | `SALES-05`는 폐번 |
| C5 | CSS 변수 `--blue2`, `--amber`, `--app` … | `T.bluePressed`, **`T.amber`는 존재하지 않음**, `T.bg`. AGENTS.md “새 화면이 임의의 두 번째 토큰 체계를 만들지 않는다” | 이름 매핑표 확정 필요 |
| C6 | 리스트 타이틀 **24 / 800** | `TYPE` 스케일 최대치는 `display: 22` | 24는 토큰에 없음 — TYPE 확장 여부 선결 |
| C8 | `ConfirmDialog`/`SuccessDialog`/`ErrorDialog` 신설 | kit는 **`ConfirmSheet`**로 통일. `Alert.alert`는 react-native-web에서 빈 함수라 **금지**(실제로 ‘영업 시작’ 버튼이 죽었던 사고 이력) | Dialog 계열 신설 = 같은 일을 하는 두 번째 경로 |
| C9 | `EmptyState` 신규 | `apps/mobile/src/components/EmptyState.tsx`에 **이미 존재**(kit 배럴 미재수출) | 신규 작성이 아니라 **kit 이전 + 배럴 재수출** |
| C13 | 세금 기본값 `10/110` | `P2-5`(`108fc88`)가 **10/110 기본값 제거**, 모든 호출자가 세율 명시 | 폐기된 계약. 전제하면 회귀 |
| C14 | 순이익 검산 **4,046.69원** | 현재 서버 계약 **4,046.60원 · 33.72%**. 4,046.69는 구 단순 계산기 legacy | 값 갱신 필요 |
| C16 | 비율 반올림 | **소수 1자리 절사 고정** (33.72% → 33.7%) | 반올림하면 검산 기준과 어긋남 |
| C19 | 단일 “재고 부족” 판정 | **영업 시작 부족**(메뉴 1개 필요량) ≠ **판매 부족**(판매 증가분 필요량) ≠ **안전재고 미달**. 막는 것은 명시적 `판매 중지`뿐 | 판정 3분리 필수 |
| C22 | kit/tokens/prototypes 변경 커밋 | 진행 중 Task(`AI-ORCH-PLANS-*`)의 `excluded_paths`에 `components/kit/**`·`features/**`·`theme/tokens.ts`·`docs/prototypes/**` 명시, `user_owned_changes`로 스테이징 금지 | **프로토타입 작업은 작업큐의 정식 Task가 아니다.** 제품 반영하려면 새 Task ID + 새 브랜치 + `pnpm verify` 6/6 + 독립검수 |

### kit 실재 여부 판정 (가이드가 “신규 필요”라 적은 17개)

**완전 부재 15개**: IconButton, Toggle, StickyAction, Row(일반), Table, KPI, ResultField, ManagementList, SuccessDialog, ErrorDialog, PopoverMenu, Surface, Section, 공용 `size` 객체, `z` 토큰.
**다른 이름으로 존재 1개**: ConfirmDialog → **`ConfirmSheet`**.
**kit 밖에 존재 1개**: EmptyState → `components/EmptyState.tsx`.

### 부수 발견 (저비용 정정 대상)

- `kit/Sheet.tsx:2` 주석 “ING-04 재고수정” → 실제 ING-04는 **식재료 수정**, 재고 수정은 **ING-05**.
- `kit/MemoEditSheet.tsx:2` 주석 “식재료(ING-02)” → ING-02는 **식재료 추가**, 메모 시트는 인벤토리에서 **ID 미부여(`—`)**.

---

## 9. F-6 · 이전 세부흐름에서 유실된 업무 규칙

15개 파일을 전수 정독한 결과, **통합본이 화면 커버리지는 앞서지만 계산 규칙 레이어 4개가 UI에서 증발**했다.

### P0 — 복원하지 않으면 제품이 성립하지 않는 것

| 항목 | 원본 | 통합본 |
|---|---|---|
| **영업 중 장부 스냅샷 고정** — “장부에 고정된 재료비 / 새 원가 적용일 / 영업 시작 시점 기준”. 영업 전 변경은 오늘 적용, 영업 중 변경은 화면 원가만 갱신하고 **오늘 장부는 영업 시작 시점 값 고정**(재료비 2,806.40원 유지, 화면은 2,838.40원) | `ingredient-recipe-update-status.html` | **관련 문구 0회.** 용어집의 “다음 영업일부터 반영” 한 줄만 잔존 |
| **영업시간 편집 + 4종 검증** — 종료<시작 자동 익일 / 시작==종료 금지 / 20시간 이상 확인 / 브레이크는 영업시간 내부(자정 보정 +1440) / 15분 step / **다음 영업일부터 적용, 오늘은 기존 유지** / 수동 종료는 실제 시각, 자동 종료는 설정값 | `business-hours-negative-stock-flow.html` | MY-08은 **읽기 전용 요약 카드**뿐 |
| **영업 종료 후 소급 수정 가능 여부** — 원본 “직접 종료해도 빠뜨린 판매는 지난달 1일부터 추가·수정 가능” ↔ 통합본 `sales_close` “종료한 뒤에는 오늘 장부에 더 넣을 수 없어요” ↔ `past_save` “정정 판본과 전후값을 남겨요” | — | **통합본 내부에서 자기모순.** ARCHITECTURE §7·`amend_ended_business_day`가 정본이므로 `sales_close` 문구가 틀렸다 |

### P1

| 항목 | 원본 |
|---|---|
| **재고 확인(SALES-19) 실제 목록** — 레시피별 부족 카드, 안전재고↔필요수량 비교값 스위칭, 인라인 입고 진입, N개 더보기 | `business-hours-negative-stock-flow`, `negative-stock-sales-flow` |
| **영업 시작 시 재고 부족 시트**(`그대로 영업 시작`) — 판매 시점 케이스만 남고 영업 시작 케이스 소멸 | 동상 |
| **구매 이력 건별 상세 시트** — 주문 수량 vs **실제 입고**, 기준 단가 before→after, **연결 레시피 N개 자동 재계산** | `ingredient-purchase-history-detail` |
| **5개국 세금 엔진** — 지역·세율 입력, 통화 포맷, 추가세 기준 2택(`주세 포함`/`미포함`), 과세 상태 3종, 납부 주체 2종 안내 문구 | `international-tax-settings.html` (**스터디 계획 누락분**) |

### 반드시 보존해야 할 계산 규칙 (요약)

- **기준 단가 = Σ실제 입고 금액 ÷ Σ실제 입고량.** 팩 개수·로스율 가중 금지. 발주 대기·취소 제외, 부분 입고는 도착분만, 입고 취소는 역이벤트로 재계산. (AGENTS.md 절대원칙 2·5와 일치)
- **현재 재고 축과 누적 입고 축은 분리.** 소진은 재고만 줄이고 기준 단가에 영향 없음.
- **부족은 경고이지 차단이 아니다.** 부족 수량 = 필요 수량 + |음수 재고|. `소진`(≤0, 음수 그대로) vs `소진 임박`(0 초과 ~ 안전재고 이하).
- **폐기는 `조리 전`(식재료) / `조리 후`(완성 메뉴) 2축 분리**를 끝까지 유지. 손익의 폐기 손실도 2섹션.
- **순이익률 = 순이익 ÷ 판매가**, 판매가 인상분의 약 60%만 순이익에 전이(세금·고정지출률 비례).
- **수정 내역은 `직접 수정`/`자동 갱신` 2그룹**, 한 이벤트가 양쪽을 동시에 가질 수 있음. 최근 7일, **메모 변경·재고 수량 변동 제외**.

---

## 10. 문서 자체의 내부 모순 (작업 전 정리 대상)

| # | 모순 | 위치 |
|---|---|---|
| M1 | 계약 단위 집계 3중 충돌 (52 / 62·125·99 / 97·97·123) | current-spec 1장 vs 가이드 인용 vs 8.3 |
| M2 | “현재 반영 범위 = 식재료 12 + 레시피 4”라 못 박았는데 본문에 발주·매출·MY 17개 화면 확정안이 있음 | current-spec 1장 |
| M3 | 8.2 레시피 항목 번호에 8·10·11·15 결번 (`목표 순이익률 안내` 삭제 후 재번호 안 함) | current-spec 8.2 |
| M4 | 기준 인분 이중화 — 상단 `10인분`, 원가 카드 기본 `1인분`, 재료 사용량은 상세 200g/1인분 ↔ 시트 10인분 200g(**10배 차이**) | current-spec 8.1-5 / 8.2-14 |
| M5 | 반올림 계약 미정 3건 (세금 9.0% vs 9.1%, 권장가 39.96%<40%, 합계 2,807 vs 소계 2,806) — “명시해야 한다”로 열려 있는데 본문은 확정값처럼 기재 | current-spec 8.1-2·3·8 |
| M6 | 반응형 자기모순 — “520px 뒤 공통 규칙 재선언으로 모바일 값이 덮어써진다”를 현상 기술만 하고, 동시에 “PC와 동일”을 확정 규칙으로 둠 | current-spec 2.14 |
| M7 | 폐기 유형 비대칭 — ING-05 폐기 탭에 `조리 전/후` 입력이 없는데 내역·손익은 구분 | current-spec 8.2-10 |
| M8 | 가이드 등록 계수(27/28/15…=99)가 B.2/B.3 제목(26/27)과 불일치, 활성 host도 120/120/123 세 값 | ui-guide 부록 B |
| M9 | 맥락 장부 `공통 변경: 아니오` ↔ 체크박스 `[x] 공통 변경이므로 …를 확인했다` | design-context §6 |
| M10 | 기획안 반영 대기 목록 108개가 PRT-001~136만 커버, **PRT-137~178(42건) 대응 항목 없음** + 체크 완료 0개 | changelog |

---

## 11. 재개 계획 — 결정 항목과 순서

### 11.1 사용자 결정이 필요한 항목 (이것 없이는 진행 불가)

| ID | 결정 | 선택지 |
|---|---|---|
| **D-1** | **공통 UI 레이어를 어떻게 할 것인가** (§3.4) | A 폐기 확정 / B 재연결 / **C 토큰만 병합(권장)** |
| **D-2** | **2026-09-04 02:16 적용본 변경을 어떻게 처리할 것인가** | ㉠ `DS-20260902-028`로 발급해 정규 흡수 / ㉡ 의도치 않은 변경이면 되돌리고 재검사 |
| **D-3** | **커밋 시점** — Temp 최신본 27개를 `codex/prototype-persistence`에 지금 커밋할 것인가 | 권장: **지금**. F-5 소실 위험이 가장 크다 |
| **D-4** | **화면 ID 체계** — 프로토타입 전용 ID(ING-03a/03c/03d, RCP-02c, SALES-08 등)를 정식 승격할지, 기존 인벤토리에 매핑할지 | 매핑 권장(P2-4 계약 위반 회피) |
| **D-5** | **수치 기준 재확정** — 활성 고유 ID를 97로 유지하고 코드를 맞출지, **98**로 문서를 고칠지 | 실측 우선 권장 |
| **D-6** | **`sales_close` vs `past_save` 문구** — 종료 후 소급 수정 허용 여부 | ARCHITECTURE §7 기준으로 `past_save`가 정본 |

### 11.2 권장 작업 순서

```
0단계 · 봉인 (반나절)
  ├ Temp 27파일 → codex/prototype-persistence 커밋 (F-5 해소)
  ├ D-2 결정에 따라 ui-applied.html 처리 → sync-check.ps1 PASS 복구 (F-4 해소)
  └ ui-guide.md / design-work-plan.md 의 DS-021 → 최신 ID 승격, §9 상태표·C-21 표기 현행화

1단계 · 기준 정정 (문서만, 화면 무수정)
  ├ D-1 결정 → 가이드 §1.7·§9.2.1, 검수 장부 49~56행 개정 (F-1 해소)
  ├ D-5 결정 → 62/61, 123, 98 로 전 문서 수치 통일 + 적용본 히어로 문구 수정 (F-2 해소)
  ├ 데드 엔트리 처리: discard_type/discard_period, recipe_target_help 잔존 마크업, stock_settings/recipe_price_sim 등록
  └ M1~M10 내부 모순 정리, 특히 M4(10배)·M5(반올림)는 기획 판단 필요

2단계 · 유실 규칙 복원 계획 수립 (F-6)
  ├ P0 3건을 화면 단위 작업 항목으로 분해 → DS ID 발급
  └ international-tax-settings.html 을 스터디·문서 대상에 정식 편입 (F-7)

3단계 · 화면 작업 재개
  └ 원래 다음 시작점: screen=sales_fixed / DS-20260902-028
     ※ 단, 1단계에서 D-1이 B(재연결)로 결정되면 이미 CODEX_PASS/COMPLETE인
       레시피 30 · 발주 16 · 매출 24 건이 회귀 대상이 되므로 순서가 바뀐다.

4단계 · 검수 병목 해소
  ├ mobile TODO 97건 → 실기기 검수
  └ Opus REVIEW 139건 → 교차검수 (이 보고서가 그 1회차)
```

### 11.3 이번 스터디로 충족된 것 / 남은 것

- ✅ **Claude Opus 독립 1회** — 이 문서.
- ⬜ **교차검수 2회 이상** — 미충족. Codex 재검수 + 사람 확인 또는 별도 세션 2회가 필요하다.
- ⬜ **저장소·미션 복원 검증** — 0단계 커밋 이후에 가능.

**Study Gate 통과 전이므로, 이 보고서는 실질 변경 착수 권한을 주지 않는다.** 0단계(봉인)만이 “변경 방지 조치”로서 게이트와 무관하게 선행 가능하다.

---

## 부록 A · 제품 권위 자료 대조 전문 (C1~C22)

| # | 프로토타입 전제 | 제품 권위 | 판정 |
|---|---|---|---|
| C1 | 프로토타입 전용 화면 ID 6종 | features/README 인벤토리에 전무, P2-4가 중복 0건 고정 | 충돌 |
| C2 | `SALES-05` | 정식 `SALES-05b` | 충돌 |
| C3 | ING-08·RCP-05·RCP-07·RCP-14·RCP-15·ORD-05~07·MY-11·MY-12·SALES-01b·06·07·16 부재 | 전부 ✅ 구현 완료 | 누락(프로토타입이 부분집합) |
| C4 | 새 접두어·6번째 탭 | 접두어 5종·탭 5개 고정 | 금지 |
| C5 | `--blue2/--amber/--app` | `bluePressed`/`T.amber` 없음/`T.bg` | 이름 충돌 |
| C6 | 타이틀 24·800 | TYPE 최대 22 | 값 충돌 |
| C7 | `size`·`z` 토큰 | tokens.ts에 둘 다 없음 (`FAB`의 `zIndex:30`이 유일) | 부재 |
| C8 | Dialog 3종 신설 | ConfirmSheet 통일, `Alert.alert` 금지 | 패턴 충돌 |
| C9 | EmptyState 신규 | 이미 존재(kit 밖) | 부분 충돌 |
| C10 | 재고 상태 3단계 확장·라벨 변경 | `stockStateOf` 단일 판정처, P2-3이 회귀시험 고정 | 금지 |
| C11 | 음수 재고 0 표시·클램프 | 절대원칙 6, `−750g` 그대로 빨강 | 금지 |
| C12 | 단가에 팩 수·로스율 가중 | 쓴 돈 ÷ 실제 들어온 양, 대파 4.00원/g | 금지 |
| C13 | 세금 `10/110` 기본값 | P2-5가 제거, 세율 명시 필수 | 폐기된 계약 |
| C14 | 순이익 4,046.69원 | 4,046.60원 · 33.72% | 값 충돌 |
| C15 | 미포함가에서 세전 순매출 축소 / 수수료를 세금 표시 | 미포함가는 고객 결제액에 가산, 수수료는 고정 지출 | 금지 |
| C16 | 비율 반올림 | 소수 1자리 절사 고정 | 절사 |
| C17 | 기기 시계로 영업일 계산 | 서버 응답만, 없으면 오류로 멈춤 | 금지 |
| C18 | 종료 영업일 재개방 UI | `amend_ended_business_day` + `business_day_revisions` | 금지 |
| C19 | 단일 부족 판정 | 영업 시작 부족 ≠ 판매 부족 ≠ 안전재고 미달 | 3분리 필수 |
| C20 | 앱에서 손익·단가·세금 재계산 | 절대원칙 3, core는 미리보기 전용 | 금지 |
| C21 | 구매 단위(망·통·박스·판) 노출 | kg·g·ml + 개/모, 표기 순서 고정 | 금지 |
| C22 | 현재 브랜치에서 kit/tokens 커밋 | `excluded_paths`·`user_owned_changes` | 범위 밖 |

---

## 부록 B · 참조 사실 요약

**PRT / DS**
- 브랜치 최신 `PRT-150`, Temp 최신 **`PRT-178`** (차 28건). PRT-150 이하 본문은 두 판본 완전 동일.
- DS ID는 `DS-YYYYMMDD-NNN` 형식(PRT-152에서 제정). 발급 범위 `DS-20260902-001~027`, PRT-152~178에 1:1 대응.
- 전체 178건 중 **실제 Expo를 건드린 것은 PRT-021·031·032 세 건뿐.** PRT-144~150은 문서 전용, PRT-151~178은 적용본 + 문서 전용.
- 다음 시작점(원문): `` - 다음 시작점: `screen=sales_fixed` / `DS-20260902-028` ``

**규칙 잠금 C-01~C-21** (실행서 §3 표): Typography · Spacing · Border·Radius · Card anatomy · ListRow(92/76/60px) · FieldControl · Number+suffix · ResultField(50px·16/800/22) · Notice(20px·48px·10px) · Button · Filter(38px) · Badge · Layer · **LayerFooter(1:1 / 48px / 12px / 8px)** · DetailBlock · BeforeAfter(`없음`·56px) · DateTime(`YYYY-MM-DD · HH:mm`) · CostGroupFooter · EmptyState · Responsive · SearchBar.

**버튼 분할비 변천**: PRT-148·151이 “360px 이하 1열 전환”을 두었으나 **PRT-166이 이를 제거** → 320px에서도 `1:1` 2열 유지, 긴 문구는 버튼 내부 줄바꿈. `1:2`는 changelog에 규칙으로 등재된 적이 없고, 검수 기록에만 있다가 삭제됐다.

**DS-021~027 7건 공통 미해결**: “Expo 개발 서버가 내려가 있어 실시간 앱 캡처 대신 현재 Expo 소스를 직접 대조했다.” → **실기기/실앱 검증 미수행.**

**작업큐 위치**: 프로토타입 작업은 `docs/작업큐.md`의 정식 Task가 **아니다.** 진행 중 `AI-ORCH-PLANS-*` 패킷이 `docs/prototypes/**`·`components/kit/**`·`features/**`·`theme/tokens.ts`를 `excluded_paths` + `user_owned_changes`로 봉인해 두었다.

---

*이 보고서는 분석 결과이며 승인이 아니다. §11.1의 D-1~D-6이 결정되기 전에는 화면 작업을 시작하지 않기를 권한다.*
