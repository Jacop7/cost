# 장기 자율 작업 로그

> 운영 지침: `CLAUDE_7H_AUTONOMOUS_GUIDE.md`(OneDrive 사본). 작업 대상 저장소는 `C:\Users\jacop\프로젝트\식자재관리앱`(origin: Jacop7/cost).

## 기준선

- **검사 시각**: 2026-08-18 22:00 KST 착수
- **기존 사용자 변경**:
  - `feat/locale-currency-settings` 브랜치에 직전 작업 커밋됨(`36eefb9`). main은 `840ae15`.
  - 미추적/수정 파일: `.claude/settings.json`(M), `.claude/settings.local.json`(??) — **작업 대상 아님, 건드리지 않는다.**
- **typecheck**: `corepack pnpm -r typecheck` → types/core/mobile **전부 통과**
- **test**: `corepack pnpm -r test` → core **55개 통과** (verification 14 + locale 41). 다른 패키지 테스트 없음.
- **lint**: **미구성**. `expo lint`가 ESLint 설정을 자동 생성하려다 `spawn pnpm ENOENT`로 실패(PATH에 pnpm 없음, corepack 경유만 가능). 반복 실행하지 않음.

### 환경 제약 (P0 진행에 직접 영향)

| 항목 | 상태 | 영향 |
|---|---|---|
| Docker | **없음** (`docker: command not found`) | `supabase start` 불가 → 로컬 DB 없음 |
| Supabase 로컬 인스턴스 | **불가** | RPC 통합 테스트·E2E 전 구간 실행 불가 |
| `apps/mobile/.env` | **없음** (`.env.example`만 존재) | 앱에서 실제 Supabase 접속 불가 |
| supabase CLI | 1.226.4 설치됨 | 정적 검토만 가능 |

→ 가이드 §3·§7 규칙 적용: **SQL 변경은 `[환경 미검증]`으로 표기**하고 완료로 단정하지 않는다.
→ 가이드 §11.7 적용: DB 의존 미션에 정체되지 않고 **독립 수행 가능한 미션**(core 순수 로직, 계약 대조, 앱 정적 검증, UI/UX 게이트)을 우선한다.

### 현황: 데이터 연결

- 화면 파일 **39개**, 그중 `demoData` import **29개 파일**.
- `@/lib/supabase` 를 import 하는 화면 **0건**. → **앱 전체가 데이터 미연결 프로토타입.**
- `QueryClientProvider`는 `app/_layout.tsx`에 연결됨, `lib/queryClient.ts`에 `qk` 존재. 그러나 `useQuery`/`useMutation` **사용처 0건**.

### P0 결함 (증거 확보)

| ID | 영역 | 증상 | 증거 |
|---|---|---|---|
| CV-1 | core 단가 | 로스율 100%에서 `baseUnitPrice` = **Infinity** | 재현 로그: `baseUnitPrice(4,1) = Infinity` |
| CV-2 | core 단가 | 로스율 120%에서 **음수 단가 -20** | `baseUnitPrice(4,1.2) = -20.000000000000004` |
| CV-3 | core 단가 | volume 0에서 **Infinity**, amount·volume 0에서 **NaN** | `rawUnitPrice(4000,0)=Infinity`, `rawUnitPrice(0,0)=NaN` |
| CV-4 | core 손익 | `servings=0`에서 materialCost **Infinity**, profit **-Infinity** | `computeProfit(servings:0)` 재현 |
| CV-5 | core 손익 | 음수 판매가를 그대로 계산(방어 없음) | `price=-12000 → profit=-10909` |
| CV-6 | RPC 계약 | `supabase.ts`의 `rpc` 래퍼에 **`e7_place_order`·`e6_recipe_calc` 누락** | SQL에는 7개, 래퍼에는 5개 |
| CV-7 | SQL 시간대 | `recompute_recipe`가 `to_char(now(),'YYYY-MM')`·`current_date` 사용 → **UTC 기준**. KST 1일 00~09시에 전월 고정지출률로 손익 확정·추이 적재 | `20260608000006_calc_helpers.sql:70,95` |
| CV-8 | SQL 단가 | `base_unit_price`도 로스율>100%에서 음수 반환(`nullif`는 정확히 0만 차단) | 동 파일 `1 - v_loss` |

불변식 #6("음수·NaN·Infinity 불가, 로스율 100% 이상 명시 처리") 위반이 CV-1~CV-5, CV-8.

### P1 결함

- `OrderCompleteScreen.tsx:54` — `rawUnitPrice(sel.amt, sel.vol)` **가드 없이 호출**(다른 3개 화면은 `perBase > 0` 가드 있음). 방어가 호출부에 복제되어 있고 한 곳이 누락된 상태.
- `core.realLossRate`는 **0~1 비율** 반환, SQL `real_loss_rate`는 **%** 반환. 각자 내부 일관되나 이름이 같아 오연결 위험.

### UI/UX 공통 결함 (초기 후보)

- 숫자 서식이 `theme/tokens.ts:won()`·`toLocaleString('ko-KR')`로 화면에 흩어져 있고, 신규 `@sikjae/core` `locale.ts`와 이중 경로. (직전 작업에서 core 모듈은 도입, 화면 이관은 미완)
- kit `Button`에 `disabled`/`loading` prop 부재 → mutation 중복 탭 방어 불가(가이드 §9.7 필수 항목).
- 아이콘 전용 Pressable에 `accessibilityLabel`/`role` 부재.

### 외부 환경 때문에 실행 불가한 검사

- `supabase db reset`, seed, RPC 통합 테스트, E1~E7 전파 E2E → **Docker 부재로 전면 불가**
- `pnpm lint` → ESLint 미구성 + 자동 설치 실패

---

## 작업 큐

- [완료] M-001 — core 단가·손익 경계 계약(null/거부) 확립과 호출부 이관
- [후보] M-002 — 월 키·날짜의 KST 기준 통일 (core helper + SQL migration, SQL은 환경 미검증)
- [후보] M-003 — `rpc` 래퍼에 E6/E7 추가하고 SQL 인자와 전건 대조
- [후보] M-004 — 단위 환산 단일 출처화 (`apps/mobile/src/lib/num.ts` ↔ `packages/core/src/units.ts` 중복 제거)
- [후보] M-005 — kit `Button` disabled/loading/접근성 상태 계약
- [후보] M-006 — 숫자 서식 화면 이관 (`won()`/`toLocaleString` → core `locale.ts`)

## 미션 의존성 맵

- M-001 → M-004(환산·단가 계약이 확정돼야 환산 단일화 가능), M-006
- M-005 → 이후 모든 mutation 화면 미션의 선행
- M-002, M-003은 독립

---

## M-001 구현 전 검증서

- **대상**: core 단가·손익 함수의 경계 입력 계약 확립
- **근거 문서/절**:
  - 가이드 §2 불변식 6 — "금액과 수량은 음수·NaN·Infinity를 허용하지 않는다. 분모 0, 로스율 100% 이상, 판매가/매출 0을 명시적으로 처리한다."
  - AGENTS.md 절대원칙 3 — core는 SQL과 공식이 일치해야 한다.
  - SQL `base_unit_price`: `nullif(volume,0)`, `nullif(1 - v_loss, 0)` → **산출 불가는 null**
- **현재 동작 재현** (`packages/core` 임시 테스트로 실행, 결과 로그 확보 후 파일 삭제):
  - `baseUnitPrice(4, 1)` → `Infinity`
  - `baseUnitPrice(4, 1.2)` → `-20.000000000000004`
  - `rawUnitPrice(4000, 0)` → `Infinity`
  - `rawUnitPrice(0, 0)` → `NaN`
  - `previewBaseUnitPrice(4000, 0, 0.15)` → `Infinity`
  - `computeProfit({servings: 0, ...})` → `materialCost = Infinity`, `profit = -Infinity`
  - `computeProfit({price: -12000, ...})` → `profit = -10909…`, `profitRate = 0`
- **확인된 문제와 증거**: 위 CV-1~CV-5. 이 값들이 화면 미리보기로 나가면 `Infinity원/g`·음수 단가가 표시되고, 그대로 저장 경로에 들어가면 DB 오염.
- **정상 흐름 기대값** (불변):
  - `previewBaseUnitPrice(4000, 1000, 0.15)` → 4.7058… (검산 4.71)
  - 제육볶음 `computeProfit` → profit 4014, rate 0.334
  - 기존 55개 테스트 전건 통과
- **예외별 기대값** (변경):
  | 입력 | 기대 |
  |---|---|
  | `volume <= 0` | `rawUnitPrice` → **null** |
  | `amount < 0` 또는 비유한 | → **null** |
  | `lossRate >= 1` | `baseUnitPrice` → **null** (SQL `nullif` 의미와 일치) |
  | `lossRate < 0` | → **null** |
  | `avgUnitPrice` null/비유한 | → **null** |
  | `servings <= 0` | `materialCost`/`computeProfit` → 재료비 0 + `hasMissingPrice`가 아닌 별도 신호 없이 **Infinity 금지** |
  | `price <= 0` | 손익은 계산하되 `profitRate` 0 유지(기존), **Infinity/NaN 금지** |
- **변경되어야 하는 값**: `rawUnitPrice`·`baseUnitPrice`·`previewBaseUnitPrice` 반환 타입이 `number` → `number | null`. 호출 4개 화면이 null 분기.
- **변하면 안 되는 값**: 검산 4.71 / 4,014 / 33.4% / 31.3% / 16,000. `weightedAvgUnitPrice`·`recommendedPrice`의 기존 null 계약. locale 테스트 41건.
- **상류/하류 영향**:
  - 상류: 화면 입력(`num(price)`, `perBase`) — 이미 `perBase > 0` 가드가 3곳에 복제됨, `OrderCompleteScreen`은 누락
  - 하류: 단가 미리보기 표시, `IngredientAddScreen.onAdd`가 저장하는 `price`/`avg`/`low`/`high`/`recent`
  - 불변: SQL, 다른 도메인(레시피 손익 검산), locale 서식
- **UI 상태·문구 계약**: 산출 불가(null)는 화면에서 `-` 또는 `산출 불가`로 표기하고 0원으로 위장하지 않는다. (이번 미션 범위는 core 계약 + 호출부 null 분기까지, 문구 디자인은 M-006에서)
- **선행 실패 테스트**: `packages/core/tests/boundary.test.ts` 신규 — 위 예외 표를 그대로 assert. 구현 전 실패 확인.
- **남은 불확실성**: `recommendedPrice` 분모가 0에 근접할 때(예: 0.009) 344,850원 같은 비현실적 값이 나오는 문제는 **제품 정책**(상한/경고)이 필요 → 이번 범위 제외, M-007 제안 미션으로 등록.
- **구현 준비 판정**: **READY**

## 새로 생성한 미션

- M-007 (제안) — `recommendedPrice` 분모 근사 0 구간의 비현실적 권장가 처리 정책. 근거 문서에 상한 규정이 없어 정책 결정 필요 → 구현하지 않고 제안만.

---

## 테스트 결과

| 명령/검사 | 결과 | 기존/새 실패 | 비고 |
|---|---|---|---|
| `corepack pnpm -r typecheck` | 통과 | — | 기준선 |
| `corepack pnpm -r test` | 55 통과 | — | 기준선 |
| `corepack pnpm --filter @sikjae/mobile lint` | 실패 | 기존 | ESLint 미구성, 자동 설치가 pnpm PATH 문제로 실패 |
| `supabase start` | 미실행 | 환경 | Docker 없음 |

---

## M-001 사후 재검증 — 완료

- **선행 실패 테스트**: `packages/core/tests/boundary.test.ts` 32건. 구현 전 **20 실패 / 12 통과** → 구현 후 **32 통과**.
- **계약 전건 비교**

| 입력 | 구현 전 | 구현 후 | 계약 |
|---|---|---|---|
| `baseUnitPrice(4, 1)` | `Infinity` | `null` | ✅ |
| `baseUnitPrice(4, 1.2)` | `-20.0000…` | `null` | ✅ |
| `rawUnitPrice(4000, 0)` | `Infinity` | `null` | ✅ |
| `rawUnitPrice(0, 0)` | `NaN` | `null` | ✅ |
| `previewBaseUnitPrice(4000, 0, .15)` | `Infinity` | `null` | ✅ |
| `computeProfit(servings: 0)` | material `Infinity` | `0` + `hasMissingPrice` | ✅ |
| `computeProfit(price: -12000)` | profit `-10909` | price `0`, tax `0`, rate `0` | ✅ |
| `weightedAvgUnitPrice([{volume:0}, 정상])` | `NaN` 오염 | 오염 행만 제외 후 `4` | ✅ |

- **불변값 확인**: 대파 4.71원/g, 제육 4,014원·33.4%, 고정지출률 31.3%, 권장가 16,000 — 전건 유지. 기존 55개 테스트 무손실.
- **회귀**: `corepack pnpm -r typecheck` 통과 · `corepack pnpm -r test` **87 통과**(55 → 87) · Metro 웹 번들 200 OK(신규 가드 코드 포함 확인).
- **변경 파일**: `packages/core/src/guards.ts`(신규) · `pricing.ts` · `recipe.ts` · `round.ts` · `index.ts` · `tests/boundary.test.ts`(신규) · 기존 테스트 2건 호출부 · 앱 화면 4건 · `apps/mobile/src/lib/num.ts`(`dash`)

### M-001이 드러낸 숨은 결함

타입 계약을 `number | null`로 바꾸자 **컴파일러가 방어 누락 지점을 직접 지목**했다.
`OrderCompleteScreen.tsx:54`는 다른 3개 화면과 달리 `perBase > 0` 가드가 없어, 용량 0인 구매 옵션에서
`Infinity원/g`가 화면에 그대로 찍히는 상태였다. 방어가 함수가 아니라 호출부에 복제돼 있어 생긴 누락이며,
가드를 core로 올리면서 구조적으로 해소됐다.

## 변경 영향 재탐색 (M-001 이후)

가이드 §4.3에 따라 변경 함수의 호출자·소비자를 재추적했다.

1. **손익 공식 복제 여부** → `features/recipes/demoData.ts:recipeProfit`은 core `computeProfit`에 위임하고 있어 **복제 없음**. 정상.
2. **`pct()` 중복 가설 — 기각**
   `demoData.pct`(`Math.floor(rate*1000)/10`)와 core `formatPercent`(epsilon 보정)가 부동소수 경계에서
   어긋난다고 의심해 **0~1 구간 10만 분할 + 실제 손익 비율 6건**을 전수 비교했다. → **불일치 0건.**
   결함이 아니므로 수정하지 않는다. 다만 같은 규칙의 구현이 두 벌 존재하고, `demoData.pct`는 로케일
   소수점 문자를 따르지 않아(독일에서 `33.4%`로 표기) **이관 대상**으로만 남긴다 → M-006에 포함.
3. **`dash()` 위치** — 표시 계층 헬퍼를 `apps/mobile/src/lib/num.ts`에 뒀다. 서식 단일 출처는 core `locale.ts`이므로 중복 소지 → M-006에서 정리 대상.

## 새로 생성한 미션

- **M-008** (후보) — `apps/mobile/src/lib/num.ts`의 표시 헬퍼(`dash`)와 `demoData.pct`를 core `locale.ts` 단일 출처로 이관. (M-006과 병합)

## 작업 큐 (갱신)

- [완료] M-001 — core 단가·손익 경계 계약(null) 확립과 호출부 이관
- [다음] M-002a — 월 키·날짜의 KST 기준 core helper (테스트 가능)
- [보류/환경] M-002b — 동 규칙의 SQL migration (`recompute_recipe`의 `now()`/`current_date` UTC 문제) — Docker 부재로 `[환경 미검증]`
- [후보] M-005 — kit `Button` disabled/loading/접근성 상태 계약 (모든 mutation 미션의 선행)
- [후보] M-003 — `rpc` 래퍼 E6/E7 추가 + SQL 인자 전건 대조
- [후보] M-004 — 단위 환산 단일 출처화
- [후보] M-006 — 숫자 서식 화면 이관 (+M-008 흡수)
- [제안] M-007 — `recommendedPrice` 분모 근사 0 구간 정책 (정책 결정 필요, 구현 보류)

### 미션 점수 (가이드 §4.5)

| 미션 | 오염×5 | 차단×4 | 선행×3 | 발생×2 | MVP×2 | −작업×2 | −불확실×2 | 합 |
|---|---|---|---|---|---|---|---|---|
| M-002a+b | 25 | 8 | 9 | 4 | 6 | −4 | −4 | **44** |
| M-005 | 15 | 4 | 15 | 6 | 6 | −4 | 0 | **42** |
| M-003 | 5 | 12 | 12 | 6 | 6 | −2 | −2 | **37** |
| M-004 | 20 | 4 | 9 | 4 | 6 | −6 | −2 | **35** |

---

## M-002 영업일 기준 시간대 통일

### 구현 전 검증서
- **근거**: 가이드 §12 "날짜가 KST/UTC 변환으로 하루 밀리지 않는다" · §4.1-4 예외 선검증 "날짜·KST/UTC·월 경계"
- **현재 동작 재현 (정적 증거)**
  | 위치 | 표현식 | 기준 |
  |---|---|---|
  | `calc_helpers.sql:68` | `to_char(now(),'YYYY-MM')` | UTC |
  | `calc_helpers.sql:98` | `current_date` (profit_trends) | UTC |
  | `rpc_propagation.sql:19` | `to_char(now(),'YYYY-MM')` (E1 월 재료비) | UTC |
  | `rpc_propagation.sql:36,39` | `current_date` (last_inbound_at) | UTC |
  | `rpc_propagation.sql:48` | `current_date` (price_trends) | UTC |
  | `inventory_purchasing.sql:47` | `ordered_at default current_date` | UTC |
  | `OrderCompleteScreen.tsx:44` | `new Date()` + `getMonth/getDate` | **기기 로컬(KST)** |
  | `OrdersHomeScreen.tsx:151` | 동일 | **기기 로컬(KST)** |
  - `packages/db/supabase/config.toml` 에 timezone 설정 **없음** → Postgres 기본값 UTC.
- **확인된 문제**: KST 00:00~09:00 구간에서 앱과 DB가 9시간 어긋난다.
  1. `recompute_recipe` 가 **전월** 고정지출률로 이번 달 손익 확정
  2. `profit_trends`·`price_trends` 날짜 하루 밀림 — **append-only 라 사후 정정 불가**
  3. `monthly_pl` 재료비가 잘못된 월에 누적
  4. `ordered_at` 하루 밀림 → 도착 예정·입고 지연 판정 오류
- **정책 판단** (가이드 §11.2, 문서에 규정 없음 → 보수적 선택):
  영업일 = **매장 시간대의 자정~자정**. 1차 범위는 한국 매장이므로 KST 고정.
  세션 GUC(`set timezone`)에 의존하지 않고 **함수로 명시** — GUC 는 커넥션마다 달라져 같은 코드가
  조용히 다른 날짜를 만들 수 있다. 매장별 시간대는 `business_tz()` / `offsetMin` 인자로 확장 지점만 열어 둠.
- **구현 준비 판정**: **READY**

### M-002a 결과 — [완료]
- `packages/core/src/businessDate.ts` 신규: `businessMonth` · `businessDay` · `businessDayRangeUtc` · `currentBusinessMonth` · `currentBusinessDay` · `BUSINESS_TZ_OFFSET_MIN`
- `packages/core/tests/businessDate.test.ts` **23건** — 구현 전 20 실패 → 구현 후 23 통과
- 모든 테스트가 **명시적 UTC 시각**을 입력해 실행 시점·기기 시간대에 의존하지 않는다
- 회귀 방지 테스트로 **현행 SQL(UTC) 과 영업 기준(KST) 이 어긋나는 구간 자체를 고정**했다
  (`businessMonth(at, 0) === '2026-06'` vs `businessMonth(at) === '2026-07'`)
- 윤년(2028-02-29), 연말 경계, 배타 구간 인접성 왕복 검증 포함

### M-002b 결과 — [환경 미검증]
- `packages/db/supabase/migrations/20260818000008_business_timezone.sql` 신규
  - `business_tz()` / `business_day(timestamptz)` / `business_month(timestamptz)` 헬퍼 추가
  - `recompute_recipe`·`e1_confirm_inbound` 를 동일 본문 + 날짜 표현식만 교체하여 재정의
  - `order_records.ordered_at` 기본값을 `business_day()` 로 변경
- ⚠ **Docker 부재로 실행 검증 불가.** 적용 전 `supabase db reset` 필수.
- core 는 고정 오프셋(+09:00), SQL 은 IANA `'Asia/Seoul'` 사용. KST 는 서머타임이 없어 항상 일치.
  서머타임 지역 지원 시 양쪽 모두 매장 시간대 컬럼 기반으로 교체 필요(각 파일에 명시).

---

## M-003 RPC 래퍼 전건 계약 대조 — [완료]

### 대조 결과 (SQL 시그니처 ↔ 앱 래퍼)

| 이벤트 | SQL 시그니처 | 래퍼(변경 전) | 조치 |
|---|---|---|---|
| E1 | `e1_confirm_inbound(p_order uuid, p_actual_qty numeric=null) → jsonb` | 있음 | 시그니처 주석 추가 |
| E2 | `e2_discard(p_ingredient uuid, p_remain_volume numeric) → void` | 있음 | 동일 |
| E3 | `e3_recipe_saved(p_recipe uuid) → void` | 있음 | 동일 |
| E4 | `e4_fixed_cost_saved(p_store uuid, p_month text) → jsonb` | 있음 | **월 기본값을 영업월로 연결** |
| E5 | `e5_stock_adjusted(p_ingredient uuid, p_sealed numeric, p_opened smallint, p_soon boolean) → void` | 있음 | 동일 |
| E6 | `e6_recipe_calc(p_store, p_from date, p_to date, p_items jsonb, p_result jsonb) → uuid` | **누락** | 추가 |
| E7 | `e7_place_order(p_store, p_ingredient, p_vendor, p_brand, p_volume, p_amount, p_qty, p_expected date, p_source=manual) → uuid` | **누락** | 추가 |

- `packages/db/src/database.types.ts` 는 **자리표시자**(`export type Database = unknown`)라 생성 타입으로
  검증할 수 없다. 따라서 `supabase.rpc()` 호출은 현재 **타입 검사되지 않는다** — 인자 오타가 컴파일에
  잡히지 않는다. 각 래퍼에 원본 SQL 시그니처를 주석으로 박아 대조 근거를 남겼다. (DB 기동 후 `pnpm db:types` 필요)
- E6 결과 항목 타입(`RecipeCalcResult`)의 키를 SQL `jsonb_to_recordset(...) as x(ingredient_id, required, shortage)` 와 일치시켰다.
- `isSupabaseConfigured` 추가 — 화면이 "로딩"과 "환경 미설정"을 구분할 수 있어야 한다(가이드 §9.8).
- **E7 불변성 정적 확인**: `e7_place_order` 본문은 `order_records` insert + `order_candidates.status` update 뿐이며
  재고·단가·재고 이력을 건드리지 않는다 → 절대원칙 2 만족. (런타임 검증은 DB 필요)

### 작업 중 발견 — 신규 P0 미션

**M-009 · E1 입고 확정 멱등성 부재 (P0, 데이터 오염)**
`e1_confirm_inbound` 에 중복 확정 방어가 없다. 같은 주문으로 다시 호출하면(연타·재시도·네트워크 재전송)
`p_actual_qty` 를 명시한 경우 재고가 이중 증가하고, `price_trends` 행이 하나 더 쌓이며,
`monthly_pl.material_cost` 가 이중 가산되고, `inventory_events` 에 입고 이벤트가 중복 적재된다.
`p_actual_qty` 를 생략하면 `o.qty - o.received_qty = 0` 이라 우연히 수량만 0 이 되지만,
**추이 행과 이벤트 행은 그대로 중복 생성**된다(append-only 이므로 정정 불가).
- 가이드 P0-2 명시 요구: "이미 입고 확정된 주문을 다시 확정해도 이중 반영되지 않도록 DB 수준에서 방어한다"
- 가이드 불변식 8: "빠른 연속 탭으로 같은 발주/입고/폐기가 중복 반영되지 않게 한다"
- 상태: **후보** — 수정은 SQL 이라 `[환경 미검증]` 이 되지만, 위험도가 가장 높아 다음 라운드 최우선.

---

## M-009 E1 입고 확정 멱등성 — [환경 미검증]

### 구현 전 검증서
- **근거**: 가이드 P0-2 "이미 입고 확정된 주문을 다시 확정해도 이중 반영되지 않도록 **DB 수준에서** 방어한다" · 불변식 8
- **현재 동작 (정적 재현)** — `rpc_propagation.sql:9~78` 정독 결과
  | 재호출 시나리오 | 현행 결과 |
  |---|---|
  | `p_actual_qty` 명시 + 재호출 | `sealed_count` 이중 증가, `monthly_pl.material_cost` 이중 가산 |
  | `p_actual_qty` 생략 + 재호출 | `v_qty = qty - received_qty = 0` → 수량은 우연히 0, 그러나 `price_trends`·`inventory_events` 행은 **중복 생성** |
  | 동시 2회 호출 | 행 잠금이 없어 둘 다 이전 `received_qty` 를 읽고 각각 가산 |
  | `p_actual_qty > 남은 수량` | 클램프 없음 → `received_qty > qty` 과입고 가능 |
- **변경되어야 하는 값**: 중복 호출 시 재고·추이·이벤트·월 재료비가 **한 번만** 반영
- **변하면 안 되는 값**: 정상 1회 호출의 결과(재고 +v_qty, price_trends 1행, 후보 해소), 부분 입고 지원
- **정책 판단** (가이드 §11.2): 재호출을 **오류로 만들지 않고 no-op** 으로 응답한다. 실제로 성공한 행동에
  실패 화면을 띄우면 사장님이 다시 누르게 되어 더 위험하다. 응답에 `duplicate`/`already_received` 플래그를 실어
  화면이 "이미 처리됨"으로 안내하게 한다.
- **구현 준비 판정**: READY (단, 실행 검증은 DB 필요)

### 결과
- `packages/db/supabase/migrations/20260818000009_e1_idempotency.sql` 신규
  1. `inventory_events.idempotency_key` + `(store_id, idempotency_key)` **부분 유니크 인덱스**
  2. `order_records` 에 `received_qty >= 0 and received_qty <= qty` CHECK (`not valid` — 기존 행 보호)
  3. `e1_confirm_inbound` 재정의: `for update` 행 잠금 · 멱등 키 조회 · 취소 주문 거부 · 전량 입고 시 no-op ·
     `least(요청, 남은수량)` 클램프 · 0 이하 거부
- 앱 래퍼 `rpc.e1ConfirmInbound(orderId, actualQty?, idempotencyKey?)` 로 확장, `makeInboundKey()` 헬퍼 추가
- ⚠ **Docker 부재로 실행 검증 불가.** `supabase db reset` 후 다음을 확인해야 완료로 전환 가능:
  - 같은 키 2회 호출 → `duplicate: true`, `inventory_events`/`price_trends` 각 1행
  - 전량 입고 후 재호출 → `already_received: true`, 부작용 0
  - `p_actual_qty > 남은수량` → `received_qty = qty` 로 클램프
  - 동시 2회 호출 → 합계가 주문 수량을 넘지 않음

---

## M-005 kit 상태 계약 (Button) — [완료]

### 구현 전 검증
- **근거**: 가이드 §9.7 상태 계약 표, §9.13 "loading/disabled 없이 mutation 실행"은 즉시 미션 대상
- **현재 동작**: `Button` 에 `disabled`/`loading`/접근성 prop **전무**. 화면은 `kind={canSave ? 'primary' : 'gray'}`
  로 **색만 바꿔** 비활성을 흉내 내고 있었고, 실제로는 **터치가 그대로 통과**했다
  (`IngredientAddScreen:150`). `onAdd` 내부의 `if (!canSave) return` 가 유일한 방어였다.
- **변하면 안 되는 값**: 기존 호출부 전부(옵션 prop 만 추가하므로 하위 호환)

### 결과
- `Button` 에 `disabled` · `loading` · `accessibilityLabel` · `accessibilityHint` 추가
- `accessibilityRole="button"` + `accessibilityState={{ disabled, busy }}` — 색 외 경로로 상태 전달(§9.4-3)
- `loading` 중 **버튼 너비 불변**: 라벨을 자리에 두고 `opacity: 0` 처리한 뒤 spinner 를 겹침.
  너비가 출렁이면 옆 버튼이 밀려 오터치가 난다.
- `disabled || loading` 이면 `onPress` 자체를 넘기지 않아 터치가 차단된다
- `IngredientAddScreen` 저장 버튼을 색 변경 → 실제 `disabled` 로 이관
- **검증 한계**: 앱에 RN 컴포넌트 테스트 인프라(jest/RTL)가 없어 typecheck + 웹 번들 + 코드 리뷰로만 확인했다.
  테스트 인프라 도입은 의존성 추가라 별도 판단 필요 → **M-010(제안)** 으로 등록.

## 새로 생성한 미션

- **M-010** (제안) — 앱 컴포넌트 테스트 인프라(jest + @testing-library/react-native) 도입 여부. 의존성 추가라 정책 판단 필요.
- **M-011** (후보) — `Input` 상태 계약(focus/error/disabled + accessibilityLabel + 오류 메시지 연결). §9.7 우선 보완 대상 중 남은 항목.
- **M-012** (후보) — 아이콘 전용 Pressable 전수에 `accessibilityLabel`/`role` 부여 (§9.6-4). 헤더 검색·알림·닫기·수정 아이콘 등.
- **M-013** (후보) — 화면의 `kind='gray'` 색 흉내를 `disabled` 로 전수 이관 (현재 1건 이관 완료, 나머지 점검 필요).

---

## M-004 단위 환산·표기 단일 출처화 — [완료]

### 구현 전 검증
- **근거**: 절대원칙 1(저장은 최소단위 g/ml/개, 저장 직전 환산) · AGENTS.md 표기 규칙 · 가이드 §4.2 "동일 공식이 여러 화면에 복제"
- **현재 동작 재현 — 실제 불일치 확인**

  입력 환산 `num(vol) * (unit === 'kg' || unit === 'L' ? 1000 : 1)` 이 **3개 화면에 동일한 식으로 복제**:
  `IngredientAddScreen:42` · `IngredientEditScreen:54` · `PurchaseOptionScreen:63`

  표기 규칙은 4곳 이상에 복제됐고 **반올림이 서로 달랐다**. 같은 저장값이 화면마다 다르게 보였다:

  | 저장값(g) | `fmtStock` (재고 카드) | `perLabel` (구매 옵션) | |
  |---|---|---|---|
  | 1000 | 1kg | 1kg | 일치 |
  | 1234 | **1.2kg** | **1.234kg** | 불일치 |
  | 1250 | **1.3kg** | **1.25kg** | 불일치 |
  | 12345 | **12.3kg** | **12.345kg** | 불일치 |

- **정책 판단**: 정밀도를 하나로 강제하지 **않는다**. 두 값은 성격이 다르다.
  - 재고 잔량 = 대략값 → 소수 1자리
  - 구매 옵션 용량 = **상품 스펙** → 반올림하면 다른 상품이 된다(1.234kg 들이 ≠ 1.2kg 들이) → 소수 3자리
  결함은 "정밀도가 다르다"가 아니라 **규칙이 암묵적이고 중복**이라는 것. 규칙을 core 한 곳에 두고
  정밀도는 호출부가 `maxDigits` 로 **의도를 밝혀** 고르게 했다.
- **구현 준비 판정**: READY

### 결과
- `packages/core/src/units.ts` 확장: `DisplayUnit` · `isDisplayUnit` · `displayToBase` · `formatQuantity`
- `packages/core/tests/units.test.ts` **17건** — 구현 전 17 실패 → 구현 후 17 통과
  (경계 999/1000 전환, 뒤 0 제거, 개수 미환산, 음수·비유한 방어, 환산 왕복 포함)
- 앱 이관: 입력 환산 3곳 → `displayToBase`, 표기 2곳(`fmtStock`·`perLabel`) → `formatQuantity`
- **타입 가드로 구조 개선**: 기존 `isMeasure`(불린)를 `isDisplayUnit()`(타입 가드)로 바꿔,
  '박스' 같은 구매단위 라벨이 환산 함수로 들어가는 것을 **컴파일 단계에서** 막았다.
- 회귀: core **127 통과**(110 → 127) · 전체 typecheck 통과 · 웹 번들 200 OK

### 변경 영향 재탐색
- `IngredientEditScreen:34` 의 `initFactor = initUnit === 'kg' || initUnit === 'L' ? 1000 : 1` 은
  **역방향 환산**(저장값 → 편집 표기값)이라 아직 인라인으로 남아 있다 → **M-014** 등록.
- `RecipeIngredientSearchScreen:30` 의 `amt >= 1000 ? amt/1000 : amt` 도 같은 표기 규칙 복제 → **M-014** 에 포함.
- `IngredientAddScreen:63` 의 `perLabel: \`${num(vol) || num(boxQty)}${unit}\`` 는 core 표기 함수를 쓰지 않고
  입력값을 그대로 문자열로 만든다 → **M-014** 에 포함.

## 작업 큐 (갱신)

- [완료] M-001 core 경계 계약 · [완료] M-002a 영업일 core · [환경 미검증] M-002b 영업일 SQL
- [완료] M-003 RPC 계약 대조 · [환경 미검증] M-009 E1 멱등성 · [완료] M-005 Button 상태 계약 · [완료] M-004 단위 단일화
- [후보] M-014 — 남은 환산·표기 인라인 3곳 이관 (역방향 환산 포함)
- [후보] M-011 — `Input` 상태 계약(focus/error/disabled/접근성)
- [후보] M-012 — 아이콘 전용 Pressable 접근성 라벨 전수
- [후보] M-006 — 숫자 서식 화면 이관(`won()`/`toLocaleString` → core `locale.ts`)
- [후보] M-013 — `kind='gray'` 색 흉내 → `disabled` 전수 점검
- [제안] M-007 권장가 분모 근사 0 정책 · [제안] M-010 앱 컴포넌트 테스트 인프라

---

## M-014 남은 환산·표기 인라인 이관 — [완료]

- `RecipeIngredientSearchScreen:30` 총 보유량 표기 → `formatQuantity`
- `IngredientAddScreen` `perLabel` 저장값 → **입력 문자열이 아니라 저장값(기준단위)에서** 표기를 만든다.
  기존에는 `` `${num(vol)}${unit}` `` 라 kg 로 입력하면 환산 전 값이 라벨로 굳었다.
- `IngredientEditScreen:34` 역방향 환산 `initFactor` → `displayToBase(1, initUnit)` 로 배수 재사용.
  정방향/역방향이 같은 표를 보게 되어 왕복이 어긋날 수 없다.

## M-011 Input·Field 상태 계약 — [완료]

- **현재 동작**: `Input` 에 focus/error/disabled 상태와 접근성 라벨이 전무. `Field` 에 오류 표시 경로 없음.
  → 서버·클라이언트 검증 실패를 **필드 근처에 보여줄 방법 자체가 없었다**(가이드 §9.10-7 위반).
- **결과**
  - `Input`: `error`(붉은 테두리) · `disabled`(편집 차단 + 배경 구분 + 접근성 state) · 포커스 테두리 ·
    `accessibilityLabel` · `onFocus`/`onBlur` · `maxLength` · `returnKeyType`/`onSubmitEditing` 추가
  - 상태 우선순위를 **오류 > 포커스 > 기본** 으로 고정 — 포커스가 오류 테두리를 덮으면 원인을 못 찾는다
  - `Field`: `error` 추가. 있으면 hint 대신 붉은 오류 문구를 보여주고 `accessibilityRole="alert"` 로 읽힌다.
    둘을 동시에 띄우지 않는다(무엇을 고칠지 흐려진다).
- 전부 옵션 prop 이라 기존 호출부는 그대로 동작한다(하위 호환).

## M-012a kit 아이콘 버튼 접근성·터치 영역 — [완료]

- **감사 결과**: 앱 전체 `Pressable` **293개** 중 `accessibilityLabel` 보유 **6개**.
  화면별로 고치면 293곳을 손봐야 하므로 가이드 §9.1-3 대로 **공통 kit 에서 먼저** 해결했다.
- **결과**
  | 컴포넌트 | 조치 | 커버 범위 |
  |---|---|---|
  | `AppHeader` 뒤로가기 | `role="button"` + 라벨 "뒤로 가기" + `hitSlop 2`(40→44) | 헤더를 쓰는 **35개 화면 전부** |
  | `Stepper` +/− | 라벨 "늘리기/줄이기"(+`label` 접두), `hitSlop 5`(34→44), 컨테이너 `adjustable` + 현재값 | 수량 조정 전 화면 |
  | `FAB` | `role="button"` + 라벨 | 리스트 화면 |
  | `Chip` | `accessibilityState.selected` + `hitSlop 6` — 선택을 색 외 경로로 전달(§9.4-3) | 기간·필터 칩 전체 |
  | `Sheet` | 배경 탭에 "닫기" 라벨, 본문 `accessibilityViewIsModal` (뒤 화면이 탐색에 섞이지 않게) | 모든 바텀시트 |
- **남은 것**: 화면별 개별 아이콘 Pressable(검색·알림·수정·삭제 등) → **M-012b** 로 분리(범위가 커 별도 미션).

### 검증 한계 (정직하게)
- 앱에 RN 컴포넌트 테스트 인프라가 없어 **typecheck + 웹 번들 + 코드 리뷰**로만 확인했다.
- VoiceOver/TalkBack 실제 읽기 순서, 터치 영역 실측, 큰 글씨 확대는 **기기 검증 필요** → 미검증 항목으로 남긴다.

---

## M-006 숫자 서식 단일 출처화 — [완료]

- **현재 동작**: `theme/tokens.ts:won()` 이 `toLocaleString('ko-KR')` 하드코딩. 화면 2곳에서도 직접 호출.
  core `locale.ts` 를 도입해 놓고 앱은 여전히 다른 경로를 쓰는 이중 상태였다.
- **결과**
  - `won()` → core `formatNumber` + `getLocale('ko')` 로 위임. 앱 전체 26개 파일의 금액 표기가 한 규칙을 탄다.
  - `PurchaseOptionScreen` · `RecipeIngredientSearchScreen` 의 직접 `toLocaleString` 호출 제거
  - **앱 소스에 `toLocaleString` 실사용 0건** (남은 것은 주석 1줄)
- **범위 제한 (사용자 지시 준수)**: 로케일을 **'ko' 고정**으로 두고 MY-08 선택값과 연결하지 **않았다**.
  "아직 언어 변환되게 하지 말아줘"는 사용자 결정이므로, 규칙 단일화만 하고 활성화는 미뤘다.
  연결 시점에 필요한 것(화면 재렌더 경로)을 `tokens.ts` 주석에 남겼다.

## M-015 UI 용어·문장 톤 표준화 — [완료]

### 용어 위반 (가이드 §9.2 + `docs/구현-변경점.md` §4 사용자 결정)

| 위치 | 기존 | 수정 | 근거 |
|---|---|---|---|
| `OrdersHomeScreen:140` 탭 | **발주 대기** | **발주 후보** | 구현-변경점 §4 "탭 명칭 → 발주 후보" + §9.2 "'발주 대기'와 혼용하지 않음" |
| `OrderCompleteScreen:68` 헤더 | **발주완료** | **발주 완료** | §9.2 "띄어쓰기 포함 고정" |
| `OrdersHomeScreen:262` 시트 | **입고완료** 처리 후 | **입고 완료** 처리 후 | §9.2 "`입고완료` 혼용 금지" |

- 탭은 **인덱스 기반**(`tab === 0`)이라 라벨 변경이 로직에 영향 없음을 확인했다.
- 내부 이벤트명(E1 = 입고 확정)은 §9.2 예외 규정대로 `supabase.ts` 주석에 유지했다.

### 문장 톤 (§9.2 — 안내·Empty 는 `~해요`, 명시적 결정 다이얼로그만 `~하시겠습니까?`)

`~습니다` 체로 남아 있던 5건을 `~해요` 체로 통일:
`RecipeDetailScreen` 3건(메뉴 없음·부자재 없음·고정비 설명) · `RecipeAddScreen` 1건(고정비 설명) ·
`RecipesListScreen` 1건(메뉴 없음). 다이얼로그 2건(입고 취소·고정 지출 저장)은 규정대로 `~하시겠습니까?` 유지.

### 새로 생성한 미션
- **M-016** (후보) — `FixedCostEditScreen:127` 저장 확인 모달이 **영향 범위를 설명하지 않는다**.
  고정지출 저장은 E4 로 **같은 매장 전 레시피 손익**을 재계산한다. §9.9 "광범위하게 전파되는 작업은
  영향 범위를 구체적으로 설명한다" 위반. 문구에 전파 범위를 넣어야 한다.
- **M-012b** (후보) — 화면별 아이콘 Pressable 접근성 라벨(약 287곳). kit 처리로 공통분은 해소됨.

---

## 중간 보고 (1주기)

### 결과 요약
- **완전히 끝낸 세로 기능**: M-001 core 경계 계약 · M-002a 영업일 core · M-003 RPC 계약 대조 ·
  M-004 단위 환산/표기 단일화 · M-005 Button 상태 계약 · M-011 Input/Field 상태 계약 ·
  M-012a kit 접근성 · M-014 잔여 인라인 이관 · M-006 서식 단일화 · M-015 용어·톤 표준화  → **10건**
- **환경 미검증(코드 작성 완료, 실행 검증 불가)**: M-002b 영업일 SQL · M-009 E1 멱등성 SQL → **2건**
- **변경하지 않은 2차 범위**: OCR·푸시·고급 그래프·E6 UI — 손대지 않음
- **자율 생성 미션**: 16건 생성 / 10건 완료 / 2건 환경 미검증 / 4건 후보·제안
- **최초 목록에 없었지만 발견·해결한 핵심 문제**
  1. `baseUnitPrice` 로스율 100%에서 **Infinity**, 100% 초과에서 **음수 단가** — 화면·저장 경로 오염
  2. `OrderCompleteScreen` 단가 계산에 **가드 누락** (다른 3개 화면엔 있었음) — 타입 계약으로 컴파일 단계 검출
  3. 앱(KST)과 DB(UTC)의 **9시간 시차** — 전월 고정지출률로 손익 확정, append-only 추이 날짜 밀림
  4. `e1_confirm_inbound` **멱등성 전무** — 재호출 시 재고 이중 증가·추이 중복 적재
  5. 같은 저장값이 화면마다 **다른 수량으로 표시**(1234g → 1.2kg / 1.234kg)
  6. `Button` 의 `disabled` 가 **색만 바뀌고 터치가 통과**되던 상태
  7. 탭 이름이 **사용자 결정 문서와 불일치**(발주 대기 vs 발주 후보)

### 검증
- **통과**: core 테스트 **127건**(기준선 55 → 127, +72) · `pnpm -r typecheck` 3개 패키지 전부 · Metro 웹 번들 200 OK
- **실패**: 없음
- **환경상 실행 못 함**: `supabase start`/`db reset`/RPC 통합 테스트/E1~E7 E2E (**Docker 부재**) ·
  `pnpm lint` (ESLint 미구성 + 자동 설치가 pnpm PATH 문제로 실패) · RN 컴포넌트 테스트(인프라 없음) ·
  실기기 접근성(VoiceOver/TalkBack)·터치 영역 실측·큰 글씨

### 핵심 정합성 확인
- **단위 표준화**: 입력 환산 3곳 → `displayToBase` 단일화, 표기 4곳 → `formatQuantity` 단일화. 타입 가드로 '박스' 유입 차단.
- **E1/E2/E5 재고 변경 제한**: 정적 확인만 가능(런타임 미검증)
- **E7 불변성**: `e7_place_order` 본문 정독 — `order_records` insert + 후보 status update 뿐, 재고·단가 불변 ✅(정적)
- **core ↔ SQL 공식 일치**: 단가·손익·고정지출률 대조 완료. 경계 처리(null 의미)를 SQL `nullif` 에 맞춤.
  **남은 차이**: SQL `base_unit_price` 도 로스율>100%에서 음수 반환(CV-8) — SQL 수정은 환경 미검증이라 보류.
- **price/profit trend 적재**: SQL 로직 존재 확인, 날짜 기준을 영업일로 교정(환경 미검증)
- **RLS/store 격리**: 미검증(DB 필요)

### 남은 위험
- **P0**: Docker 없이는 P0-1~P0-6(데이터 연결·E1~E7 실동작)을 **단 한 건도 완결할 수 없다.**
  현재 앱은 39개 화면 전부 demoData 이며 Supabase 호출 0건. 이 상태가 가장 큰 미해결 위험이다.
- **P0**: CV-8 SQL 로스율>100% 음수 단가 (core 는 수정됨, SQL 미수정)
- **P1**: 화면별 접근성 라벨 287곳 · Loading/Empty/Error 상태 분기 부재(데이터 연결 전이라 착수 불가)

### 다음 3개 행동
1. **M-016** 고정지출 저장 확인 모달에 E4 전파 범위 명시 (즉시 가능)
2. **M-012b** 화면별 아이콘 접근성 라벨 — 도메인별로 분할 착수 (즉시 가능)
3. **M-017**(신규) core 검산 테스트를 SQL 공식과 1:1 대조하는 **명세 테스트** 추가 —
   DB 없이도 두 구현의 계약 차이를 고정할 수 있는 유일한 경로

---

## 2주기

### M-016 확인 다이얼로그 문구·버튼 — [완료]
- **검증에서 전제가 반쯤 틀렸음을 확인**: 고정지출 저장 모달은 이미 "전 레시피의 고정지출률에 반영됩니다"로
  전파를 설명하고 있었다. 실제 결함은 다른 데 있었다.
- **실제 결함**: 버튼이 **`예` / `아니오`** — 가이드 §9.2 "버튼은 짧은 행동형", "무엇을 확인하는지
  불명확하면 구체 행동으로 교체" 위반. 무엇이 일어나는지 버튼만 봐서는 알 수 없다.
- **조치** (2개 다이얼로그)
  | 화면 | 버튼 | 부연 문구 |
  |---|---|---|
  | 고정지출 저장 | 아니오/예 → **취소/저장** | E4 전파 범위를 구체화 + `~해요` 체 |
  | 입고 취소 | 아니오/입고 취소 → **닫기/입고 취소** | 되돌아가는 대상(재고·구매이력·기준단가) 명시 |
- 두 모달의 Pressable 에 `accessibilityRole="button"` 추가. 앱 전체에 `예`/`아니오` 버튼 **0건** 확인.

### M-017 core ↔ SQL 공식 대조 명세 테스트 — [완료]
- **목적**: Docker 없이 절대원칙 3("core 와 SQL 공식이 항상 일치")을 지킬 수 있는 유일한 수단.
- `packages/core/tests/sqlParity.test.ts` 신규 **19건**. SQL 함수 본문을 TypeScript 참조 구현으로 옮겨
  core 와 값을 비교한다. 대조 대상: `base_unit_price` · `real_loss_rate` · `fixed_cost_rate` · `recompute_recipe`.
- **정직한 한계 명시**: 이 테스트는 "SQL 이 실제로 그렇게 동작한다"를 증명하지 않는다.
  **SQL 본문을 읽고 옮긴 것**이 core 와 일치하는지만 증명한다. 실 DB 검증은 별도로 필요하다.
- 대조로 확인한 것
  - 검산 4.71원/g · 4,014원 · 31.3% 가 두 구현에서 동일
  - `real_loss_rate` 의 **단위 차이(core 0~1 / SQL %)** 가 최종 단가에서는 상쇄됨을 테스트로 고정
  - 단가 null 재료: core 는 건너뛰고 SQL 은 `coalesce(...,0)` — **원가 결과는 같고**, core 만 `hasMissingPrice`
    잠정 신호를 준다(관측성 격차를 기록)

### M-018 스키마 값 제약 + CV-8 해소 — [환경 미검증]
- 대조 중 **스키마 감사에서 두 가지를 확인**했다.
  - `recipes.base_servings int not null default 1 check (base_servings > 0)` — **CHECK 실재**.
    → 인분 0 은 SQL 경로에 도달하지 않는다. 앞서 "확인 필요"로 적었던 것을 사실로 확정하고 테스트 주석을 정정했다.
  - `recipes.price numeric not null default 0` — **CHECK 없음**. 음수 판매가가 저장될 수 있다.
- `packages/db/supabase/migrations/20260819000010_value_constraints.sql` 신규
  1. `recipes.price >= 0` · `ingredients.loss_rate >= 0 and < 100` · `fixed_costs_monthly.total_revenue >= 0`
     (모두 `not valid` — 기존 행을 막지 않고 신규 쓰기부터 적용)
  2. **`base_unit_price` 재정의로 CV-8 해소** — `nullif(1 - v_loss, 0)` 은 정확히 0 만 걸러내 로스율 120%에서
     음수 단가(-20)를 반환했다. `v_loss < 0 or v_loss >= 1` 가드로 core 와 계약을 일치시켰다.
- **CHECK 만으로 부족한 이유를 기록**: `real_loss_rate()` 는 누적폐기÷누적구매로 **계산**되므로
  컬럼 CHECK 을 걸어도 100% 를 넘길 수 있다. 그래서 함수 안에도 같은 가드를 둔다.
- 대조 테스트의 참조 구현을 0010 판으로 갱신하고, `[알려진 차이]` 항목을 **해소 확인** 테스트로 전환했다.

### 회귀
- core 테스트 **147건** 통과 (기준선 55 → 147, **+92**) · 전체 typecheck 통과 · 웹 번들 200 OK

### 작업 큐 (갱신)
- [완료] M-001·M-002a·M-003·M-004·M-005·M-006·M-011·M-012a·M-014·M-015·M-016·M-017 → **12건**
- [환경 미검증] M-002b(영업일 SQL) · M-009(E1 멱등성) · M-018(값 제약·CV-8) → **3건**
- [후보] M-012b 화면별 아이콘 접근성(약 287곳) · M-013 `kind='gray'` 점검
- [제안] M-007 권장가 분모 근사 0 정책 · M-010 앱 컴포넌트 테스트 인프라

---

## M-012b 화면별 아이콘 버튼 접근성 — [완료]

### 구현 전 검증에서 추정치를 정정함
- 1주기에 "약 287곳"으로 적었던 것은 **과대 추정**이었다. `Pressable` 총 293개 중 대부분은 **텍스트를 품고
  있어** 스크린리더가 그 텍스트를 이름으로 읽는다. 라벨이 실제로 필요한 것은 **아이콘만 있는** 버튼이다.
- 정확한 대상: **27곳 / 15개 파일**. 전수 처리 가능한 규모였다.

### 결과
- 아이콘 → 표준 라벨 매핑(검색·알림·닫기·수정·추가·설명 보기·내보내기…)에 화면별 문맥 예외를 더해 일괄 적용
- `accessibilityRole="button"` 동반. 최종 스캔 결과 **아이콘 전용·라벨 없는 Pressable 0건**
- `SalesHomeScreen` 의 `SaleStepper` 는 `onPress` 도 없는 데모 버튼이었지만 라벨 + `hitSlop 5`(34→44) 부여

### 작업 중 낸 사고와 복구 (기록)
일괄 삽입 스크립트의 정규식 `<Pressable\b((?:[^>]|\n)*?)>` 가 **화살표 함수의 `>`를 여는 태그의 끝으로
오인**해 15곳을 깨뜨렸다. 예: `onPress={() = accessibilityRole="button" ...> router.push(...)}`.
- **복구**: 중괄호 깊이·따옴표를 추적해 여는 태그의 진짜 끝을 찾는 스크립트로 15곳 전부 복원 후
  typecheck·번들로 확인. 깨진 패턴 잔여 0건.
- **교훈 1** — JSX 속성 삽입에 `[^>]` 기반 정규식을 쓰면 안 된다. 화살표 함수·제네릭·비교 연산자가 모두 `>`다.
- **교훈 2** — 같은 버그가 **탐지 스크립트에도** 있었다. 복구 후 스캐너가 "16곳 남음"이라고 보고했지만
  실제로는 라벨이 화살표 뒤에 정상 삽입돼 있었고, 스캐너가 태그를 잘못 잘라 **오탐**한 것이었다.
  깊이 인식 스캐너로 다시 세어 1건(진짜 누락)만 남음을 확인했다. **측정 도구를 먼저 믿지 말고 검증할 것.**
- **교훈 3** — 아이콘 이름만 보고 붙인 라벨 3개가 실제 동작과 어긋났다(눈으로 확인해 정정).
  | 화면 | 아이콘 | 잘못된 라벨 | 실제 동작 | 정정 |
  |---|---|---|---|---|
  | `RecipesListScreen` | edit | 레시피 수정 | `/recipes/category` 이동 | **카테고리 설정** |
  | `SalesHomeScreen` | calendar | 날짜 선택 | `/sales/analytics` 이동 | **매출 분석** |
  | `MyCategoryScreen` | plus | 추가 | 카테고리 추가 | **카테고리 추가** |
  아이콘은 행동을 결정하지 않는다. 라벨은 **`onPress` 가 실제로 하는 일**에서 나와야 한다.

### 회귀
- core 147건 통과 · 전체 typecheck 통과 · 웹 번들 200 OK

---

# 3주기 — 로컬 DB 확보 후 실증

## 환경 해소
- Docker Desktop 설치(winget, v4.87.0) → 데몬 기동 확인(`29.7.2 / linux`)
- `supabase start` 성공. 막혔던 두 가지를 config 로 해소:
  | 문제 | 원인 | 조치 |
  |---|---|---|
  | inbucket 기동 실패 | 기본 포트 54324 가 이 머신에서 점유/예약 충돌 | `[inbucket] enabled = false` (이메일 확인이 꺼져 있어 불필요) |
  | vector unhealthy | Docker 소켓(tcp://localhost:2375) 미노출 → 컨테이너 로그 수집 실패 | `[analytics] enabled = false` (개발용 로그 대시보드) |
- **마이그레이션 11개 전건 적용 성공** — 앞서 `[환경 미검증]` 이던 0008·0009·0010 이 실제로 적용됨을 확인.

## 실증으로 확인된 것 (정적 추론 → 사실 확정)

**CV-7 시간대 결함이 실제로 재현됨** — 가장 중요한 확인:
```
now()        = 2026-08-18 18:48 UTC
current_date = 2026-08-18   ← 현행 SQL
business_day()= 2026-08-19  ← 0008 (KST 영업일)
```
정적으로만 추론했던 "하루 밀림"이 실제 값으로 드러났고, 0008 이 이를 교정함을 확인했다.
`profit_trends.trend_date` 도 `2026-08-19` 로 적재된다.

또한 0009 멱등성 유니크 인덱스, 0010 CHECK 제약 4건이 모두 생성됨을 조회로 확인했다.

## 실증으로 새로 발견한 P0 결함 3건

### 결함 A — `real_loss_rate` 가 추정 로스율을 삼킨다 [수정 완료]
```
대파: est_loss=15.00, real_loss=0.000(null 아님), coalesced=0.000
     base_unit_price = 3.8333  ← 로스 미반영
```
`real_loss_rate` 가 폐기 이력이 **하나도 없을 때도 0** 을 반환한다. `coalesce(real, est)` 는 null 일 때만
추정값으로 넘어가므로 **등록 시 입력한 추정 로스율이 통째로 무시**된다.
→ 기준단가 과소 → 재료 원가 과소 → **순이익 과대 계상**. 신규 등록 직후 모든 식재료가 영향권.
**조치**: `20260819000011_real_loss_rate_null.sql` — 폐기 **이벤트 0건**이면 null 반환.
폐기가 기록됐는데 합이 0인 경우는 실측 0% 로 인정(측정은 된 것).
**검증**: 대파 base_unit_price `3.8333 → 4.7059` (검산 4.71 일치)

### 결함 B — 시드 고정지출이 검산 기준값과 어긋남 [수정 완료]
```
items_total = 8,240,000 / 12,000,000 = 68.67%   ← 검산 기준 31.3% 와 정면 충돌
```
세 곳의 고정지출 데이터가 전부 달랐다:
| 출처 | 합계 | 매출 | 률 |
|---|---|---|---|
| 검산 기준(AGENTS.md·core 테스트) | 3,756,000 | 12,000,000 | **31.3%** |
| DB seed (수정 전) | 8,240,000 | 12,000,000 | 68.67% |
| 앱 `FixedCostScreen` | 8,583,000 | 28,500,000 | 30.1% |
**조치**: 시드 항목 합계를 3,756,000 으로 교정(가이드 §11.1 — AGENTS.md 절대원칙이 최우선).
**검증**: `rate_pct = 31.30`, `1,000원당 313원` — 검산값 정확히 일치.
**남은 것**: 앱 `FixedCostScreen` 의 30.1% 는 아직 불일치 → **M-019** 로 등록.

### 결함 C — 재료 원가가 135원 (검산 2,835원) [수정 완료]
시드에 **대파 구매 이력만** 있어 나머지 3개 식재료의 `base_unit_price` 가 null 이었고,
`coalesce(...,0)` 때문에 재료 원가가 대파분만 계산됐다. 레시피 사용량도 앱 데모와 달랐다
(양파 68g vs 50g, 대파 30g vs 25g, 다진마늘 누락).
**조치**: 네 식재료 모두 구매 이력 추가 + 사용량을 앱과 일치시킴.
대파는 **1건만** 넣었다 — 여러 건이면 가중평균(3.83÷0.85=4.51)이 되어 문서의 4.71 과 달라진다.
가중평균 3건 시나리오는 core 단위 테스트가 별도로 잠그고 있다.
**검증**:
```
대파 4.7059 · 돼지고기 13.0 · 양파 2.1 · 다진마늘 8.5
재료 원가 2,834.55 ≈ 2,835 (검산값)
```

### 결함 D — 과거 월만 시드해 고정지출이 0 으로 계산됨 [수정 완료]
`recompute_recipe` 는 `business_month()`(= 오늘, 2026-08)로 고정지출률을 찾는데 시드는 2026-06 만
넣어 조회가 null → `coalesce(...,0)` → 고정지출 0.
**실증**: 순이익률이 **64.79%** 로 부풀려졌다(정상 33.49%).
**조치**: 문서 예시 월(2026-06)과 **현재 영업월**에 동일 값을 시드.

## E2E 검산 체인 완결 (실제 DB)

```
기준단가 4종 ── 대파 4.7059 · 돼지고기 13.0 · 양파 2.1 · 다진마늘 8.5
      ↓
재료 원가    ── 2,834.55  (검산 2,835)
      ↓
고정지출률   ── 31.30% · 1,000원당 313원  (검산 31.3%)
      ↓
E3 실행      ── profit_trends 적재: profit_rate 33.49 · material_rate 23.62 · cause 'recipe' · trend_date 2026-08-19
      ↓
표시(절사 1자리) ── **33.4%**  ✅ 검산 기준값 일치
```

### 허용 오차 기록 (가이드 §8.4)
순이익 원 단위: DB **4,018.54** vs 문서 검산 **4,014**.
원인은 고정지출률 정밀도다 — DB 는 3,756,000/12,000,000 = **0.3130**, 앱 데모는 **0.3133** 하드코딩.
AGENTS.md 자체가 "31.3%(1,000원당 313원)"와 "메뉴 배분 3,760원"(=0.31333)을 함께 적어 두 값이 공존한다.
**표시 단계에서는 양쪽 모두 33.4%** 로 같으므로 허용 범위로 판단하고, 원 단위 4.5원 차이를 여기 명시한다.

## 새로 생성한 미션
- **M-019** — 앱 `FixedCostScreen` 의 고정지출 데이터(8,583,000 / 28,500,000 = 30.1%)를 검산 기준
  31.3% 및 DB 시드와 일치시키기. 현재 앱 내부에서도 레시피는 `FIXED_RATE = 0.3133` 을 쓰고 화면은
  30.1% 를 보여주는 자기모순 상태.
- **M-020** — `recompute_recipe` 의 `coalesce(fixed_cost_rate(...), 0)` 이 **잠정 상태를 0% 로 확정**한다.
  가이드 P0-5 는 "매출이 없거나 0이면 비율을 억지로 0%로 확정하지 않고 설계의 잠정 상태를 따른다"고
  명시한다. 이번 달 고정지출 미입력 시 순이익률이 부풀려져 보이는 문제(실증 64.79%).
  잠정 표현 방법(플래그 컬럼 등)이 필요해 설계 판단 동반.

---

# 4주기 — 실 DB 연결 준비 + E1 실동작 확보

## 결함 E — E1 오버로드 2개 (P0, 방어 우회 경로) [수정 완료]
생성 타입을 만들자 드러났다:
```
e1_confirm_inbound(p_order uuid, p_actual_qty numeric)                        ← 0007 판, 가드 없음
e1_confirm_inbound(p_order uuid, p_actual_qty numeric, p_idempotency_key text) ← 0009 판, 가드 있음
```
`create or replace function` 은 **인자 시그니처가 다르면 교체가 아니라 신규 생성**이다.
인자 2개로 호출하면 PostgREST 가 구버전을 골라 **행 잠금·멱등키·클램프·상태 가드를 통째로 우회**한다.
→ `20260819000012_drop_e1_old_overload.sql` 로 구버전 삭제 + 오버로드가 정확히 1개인지 검증하는 DO 블록 추가.

## 결함 F — E1 이 애초에 실행 자체가 불가능했다 (P0, 기능 전면 불능) [수정 완료]
실제로 호출해 보고 발견:
```
ERROR: column "status" is of type order_status but expression is of type text
CONTEXT: PL/pgSQL function e1_confirm_inbound line 48
```
`status = case when ... then 'received' else 'partial' end` — CASE 결과가 `text` 로 추론되는데
컬럼은 `order_status` enum 이다. PostgreSQL 은 UPDATE 대입에서 text→enum 암묵 변환을 허용하지 않는다.
**호출할 때마다 예외 → 트랜잭션 전체 롤백.** 4회 호출 후에도 재고·이벤트·추이가 전부 0이었다.

이 버그는 **0007 최초 정의부터** 있었고 0008·0009 가 본문을 옮기며 그대로 유지했다.
아무도 실행해 본 적이 없어 드러나지 않았다 — 가이드가 요구한 "현행 동작 재현"이 실제로 잡아낸 결함이다.
→ `20260819000013_e1_enum_cast.sql` 로 `::order_status` 명시 캐스팅.

## E1/E7 실동작 검증 (실제 DB, 전건 통과)

| 시나리오 | 기대 | 실제 |
|---|---|---|
| E7 발주 등록 후 | 재고·단가·이벤트 **불변** | sealed 2 · 4.7059 · events 0 ✅ |
| E1 1차 입고(키 K1, 수량 1) | 재고 +1, 이벤트 1, 추이 1 | `received_qty:1` · sealed 2→3 · events 1 · trends 1 ✅ |
| 같은 키로 재호출 | 아무 변화 없음 | `duplicate:true` · 부작용 0 ✅ |
| 남은 1개인데 99 요청 | 남은 수량으로 클램프 | `received_qty:1` · received_qty=2=qty · status `received` ✅ |
| 전량 입고 후 재호출 | no-op | `already_received:true` ✅ |

**절대원칙 2(E7 은 기록만) 실증 완료.** 가이드 P0-2 의 "DB 수준 중복 방어" 요구도 충족.

## 과거 날짜 등록 가능성 (사용자 질문에 대한 답)

| 대상 | 과거 날짜 지정 | 근거 |
|---|---|---|
| `order_records.ordered_at` | **가능** | `default business_day()` 지만 명시 지정 가능 |
| `order_records.expected_at` | **가능** | 기본값 없음 |
| `inventory_events.occurred_at` | 컬럼은 가능 / **RPC 경유는 불가** | E1 이 insert 시 미지정 → `default now()` |
| `price_trends.trend_date` | **불가** | E1 이 `v_today := business_day()` 하드코딩 |
| `profit_trends.trend_date` | **불가** | `recompute_recipe` 가 `business_day()` 하드코딩 |
| `inventory_states.last_inbound_at` | **불가** | E1 이 `v_today` |
| `monthly_pl.month` | **불가** | E1 이 `business_month()`(오늘 기준) |

→ **RPC 를 통해서는 과거 데이터를 만들 수 없다.** 매출 분석은 과거 기간이 필수이므로
   E1/E3/E4 에 "발생 시점" 인자를 추가해야 한다. 직접 INSERT 는 전파가 일어나지 않아 금지(불변식 2).
→ **M-021** 등록: RPC 시점 인자 추가(`p_occurred_at`), 기본값은 현재 영업일.

## 결함 G — 매출관리 도메인의 DB 테이블이 **아예 없다** (P0, 스키마 격차)
DB 테이블 19개를 전수 조회했으나 일별 판매·채널·메뉴별 판매량·폐기 손실을 담을 테이블이 없다.
매출관리 탭(SALES-01~18) 전체가 저장 대상 없이 화면만 존재한다.
→ **M-022** 등록: 매출 스키마 설계(판매 채널 / 일별 매출 / 메뉴별 판매). 감사 결과 취합 후 착수.

## 데이터 계층 기반 작업

- **RLS 전제 확인**: `my_store_ids()` = `stores where owner_id = auth.uid()`.
  **로그인하지 않으면 어떤 행도 보이지 않는다.** 화면의 "데이터 없음"이 빈 테이블인지 세션 없음인지
  구분해야 한다(가이드 §9.8).
- `apps/mobile/.env` 생성 (로컬 Supabase URL/anon key, gitignore 대상)
- `pnpm db:types` 로 **생성 타입 1,153줄** 확보. `@sikjae/db` 를 앱 의존성·tsconfig paths 에 연결.
- `createClient<Database>` 적용 → **RPC 인자가 컴파일 검증됨**. 즉시 실제 불일치 4건 검출:
  | 위치 | 문제 | 조치 |
  |---|---|---|
  | E1 선택 인자 | `null` 전달 → SQL default 미적용 | `undefined`(생략)로 변경 |
  | E6 items/result | 인덱스 시그니처 없어 `Json` 비호환 | 인덱스 시그니처 추가 |
  | E7 vendor/brand | 생성 타입은 string, SQL 은 null 허용 | null 허용을 **실 DB 로 검증** 후 캐스팅 |
  마지막 항목은 `information_schema` 조회로 `is_nullable=YES` 확인 + `e7_place_order(..., null, null, ...)` 실행 성공으로 검증했다.
- `apps/mobile/src/lib/session.ts` 신규 — 세션·매장 컨텍스트. 개발 환경에서 시드 계정 자동 로그인,
  `unconfigured / signed-out / ready / error` 를 구분해 화면이 원인을 정확히 표시할 수 있게 함.

## 진행 중
- 전 도메인 병렬 감사 워크플로 실행 중 (7개 도메인 + 적대적 검증)

## M-022 매출관리 스키마 — [완료, 실 DB 검증]

### 설계 판단
- **판매 사실만 저장하고 파생값은 저장하지 않는다.** 매출·원가·순이익은 판매 기록 + 기준단가 +
  고정지출률에서 매번 계산한다. 파생값을 저장하면 원본이 바뀔 때 조용히 어긋난다.
- **`sale_date` 에 기본값을 두지 않는다.** 기본값이 있으면 "오늘"로 조용히 채워져 과거 등록이 막힌다.
  매출 분석은 기간 비교가 본질이므로 과거 영업일 입력이 반드시 가능해야 한다(사용자 지적 사항).
- **판매가·메뉴명은 판매 시점 스냅샷**으로 복사한다. `recipes.price` 를 참조하면 나중에 판매가를
  바꿨을 때 **과거 매출이 소급 변경**된다.
- **폐기 손실은 새 테이블에 두지 않는다.** `inventory_events(type='discard')` 가 이미 원장이며
  `occurred_at` 으로 기간 집계한다. 같은 사실을 두 곳에 저장하지 않는다.

### 신규 테이블
| 테이블 | 역할 |
|---|---|
| `sales_channels` | 채널 + 수수료율(매장 0% / 배달 9.8% / 포장 0%). 매장마다 다르고 시간에 따라 바뀐다 |
| `daily_sales` | 일별 장부 한 장. `unique(store_id, sale_date)`, 기타매출·당일 추가지출 |
| `daily_sales_items` | 메뉴별·채널별 판매 수량 + 판매 시점 단가/메뉴명 스냅샷 |
RLS 는 기존 테이블과 동일한 `store_id` 격리 정책을 적용했다.

### `sales_summary(store, from, to)` 집계 함수
기간 손익을 매번 계산한다. 고정지출률이 없으면 `fixed_rate_provisional: true` 를 실어
**0% 로 확정하지 않는다**(가이드 P0-5).

### 실 DB 검증 — 과거 날짜 등록
```
오늘 = 2026-08-19
등록 = 2026-08-16, 08-17, 08-18   → "전부 과거인가" = t  ✅
```

### 교차 검증 (독립 수기 계산 대조, 가이드 §8.4)
같은 구현을 두 번 부른 것이 아니라 **JS 로 독립 계산**해 대조했다.

| 항목 | 수기 계산 | `sales_summary` | 일치 |
|---|---|---|---|
| 수량 | 114 | 114 | ✅ |
| 매출 | 1,536,000 | 1,536,000 | ✅ |
| 재료원가 | 323,138.36 | 323,138.36 | ✅ |
| 채널수수료 | 38,808 | 38,808 | ✅ |
| 세금 | 124,363.64 | 124,363.64 | ✅ |
| 고정지출 | 480,768 | 480,768 | ✅ |
| 순이익 | 532,922 | 532,922.00 | ✅ |

채널 수수료가 배달분에만 붙는 것(11개 × 9.8%), 세금이 부가세 포함 메뉴에만 붙는 것,
기타매출이 재료원가 없이 매출에만 더해지는 것까지 전부 의도대로 동작한다.

## 남은 것
- **M-021** RPC 시점 인자(`p_occurred_at`) — E1/E3/E4 가 과거 시점으로 전파를 기록할 수 있어야
  과거 입고·손익 추이를 만들 수 있다. 매출은 위 스키마로 해결됐지만 재고·단가 추이는 아직 오늘만 가능.

---

# 5주기 — 전면 감사 + 도메인 간 전파 완성

## 병렬 감사 결과 (에이전트 47개 · 발견 182건 · 적대적 검증 통과)

| 도메인 | 발견 | 요약 |
|---|---|---|
| 식재료 | 33 | store 덕에 일부 실동작. 구매옵션 3버튼은 전부 `safeBack()` 껍데기 |
| 레시피 | 32 | 13개 파일 Supabase 0건. 추가 화면 6개 입력칸 전부 타이핑 불가 |
| 발주 | 19 | E7·E1 RPC 가 있는데 **한 번도 호출되지 않음**. 후보가 module const 라 발주해도 안 사라짐 |
| 매출 | 33 | 판매 수량 스테퍼에 onPress 없음. 화면 간 같은 숫자가 6군데 불일치 |
| MY | 33 | 고정지출 입력 4종 타이핑 불가. `won()` 이 `getLocale('ko')` 하드코딩 |
| 데이터계층 | 13 | **anon 롤로 전 테이블 0행**. E7 은 RLS 위반으로 실패. `session.ts` 가 호출부 없는 사문 |
| 스키마 | 19 | `lossReal/avg/low/high/recent` 는 DB 컬럼이 아니라 **파생값**인데 ING-04 가 직접 덮어씀 |

**최우선 차단 요인**: 로그인이 없어 RLS 로 모든 조회가 0행. `session.ts` 를 앱에 연결해야 무엇이든 보인다.

## 즉시 수정한 확정 P0

### StockEditSheet 입력 불가 [완료]
`InputBox` 가 컴포넌트 **본문 안**에서 화살표 함수로 선언돼 있었다. 렌더마다 새 함수 참조가 생기고
React 는 elementType 을 참조 동일성으로 비교하므로 **언마운트→리마운트**가 일어나 TextInput 이
매 글자마다 파괴된다(포커스 유실·키보드 닫힘).
→ 모듈 스코프로 승격. `Band` 도 같은 이유로 함께 이동.

### 재고 변경 이력이 통째로 사라지던 문제 [완료]
`onApply(nextStock: number)` 가 **수량만** 넘겨서 조정/소진/폐기 구분과 사유가 버려졌다.
그런데 조정은 E5, 폐기는 E2 이고 폐기는 실측 로스율에 누적되어 **기준단가까지 바꾼다.**
유형을 잃으면 로스율이 영원히 0 이 된다(migration 0011 이 고친 것과 같은 병).
→ `StockChange { kind, nextStock, wasteAmount, reason }` 계약으로 교체.
→ store 에 `events: StockEvent[]` 원장 + `applyStockChange` 액션 추가. DB `inventory_events` 와
   같은 모양으로 둬서 연동 시 그대로 매핑되게 했다.

### 재고 내역(ING-07)이 id 와 무관한 데모였던 문제 [완료]
어느 식재료를 눌러도 대파 데모 상수를 그렸고, 기간·유형·정렬 필터가 로직에 연결돼 있지 않았다.
→ 실제 원장 조회 + 기간/유형/정렬 실동작. 기간 표기도 고정 문자열 → 필터 기준으로 교체.
→ 필터 선택지(`오늘·1개월·3개월·6개월·직접`)와 매핑을 **실제 시트 옵션과 대조해** 맞췄다.
→ 무반응 검색 아이콘은 조회 설정 열기로 연결.

## 사용자 지적: "판매하면 재고가 차감되어야 한다"

### 결함 H — `consume` 이벤트를 아무도 쓰지 않았다 (P0, 사이클 단절)
`inventory_event_type` enum 에 `'consume'` 이 처음부터 있었으나 **기록하는 코드가 어디에도 없었다.**
메뉴를 아무리 팔아도 재료가 줄지 않고, 재고가 줄지 않으니 발주 후보도 안 생긴다.
**"식재료 → 레시피 → 판매 → 재고 차감 → 발주" 사이클이 판매 지점에서 끊겨 있었다.**

→ `20260819000016` 로 **E8(판매 소진)** · **E9(판매 취소)** 신설.

설계 판단:
- **소모량은 판매 시점에 확정 기록.** 매번 현재 레시피로 역산하면 레시피를 수정했을 때
  **과거 판매의 소모량이 소급 변경**된다.
- **재고가 모자라도 판매를 막지 않는다.** 이미 팔린 사실을 거부하면 장부가 현실과 어긋난다.
  0 에서 멈추고 부족분을 응답에 실어 화면이 안내한다.
- **취소는 삭제가 아니라 반대 부호 보정 이벤트**로 되돌린다(절대원칙 4 append-only).

### 결함 I — 개수와 그램을 섞어 계산 (P0, 절대원칙 1 위반)
E8 을 처음 실행하자 드러났다:
```
대파 재고 sealed_count = 2 (2봉지), 필요량 125g
→ E8 이 "재고 2, 부족 123" 이라고 보고        ← 개수에서 그램을 뺐다
실제 잔량은 2봉 × 1,000g = 2,000g 로 충분했다
```
뿌리는 `inventory_states` 가 재고를 **미개봉 개수 + 개봉분 잔량(기준단위)** 두 단위로 나눠 들고 있는데
이를 총량으로 환산하는 **공통 함수가 없어** 소비하는 쪽마다 제각기 해석한 것이다.
(같은 뿌리에서 감사도 "safety_stock 은 DB 정의가 개수인데 화면은 g 로 입력받는다"를 지적했다.)

→ `20260819000017` 로 읽기·쓰기 단일 출처 신설:
- `stock_total_base(ingredient)` = 미개봉 × 개당용량 + 개봉잔량
- `consume_stock(ingredient, amount)` = **개봉분 먼저 → 모자라면 미개봉을 헐어 쓰는** 실제 주방 순서.
  있는 만큼만 빼고 음수로 내려가지 않는다.

### 실증 (제육볶음 5개 판매)
| 식재료 | 판매 전 | 필요 | 판매 후 | 검증 |
|---|---|---|---|---|
| 대파 | 2,000g (2봉) | 125g | 1봉 + 875g = **1,875g** | 2000−125 ✅ |
| 돼지고기 | 5,000g (1팩) | 1,000g | 0팩 + 4,000g = **4,000g** | 5000−1000 ✅ |
| 양파 | 0g | 250g | 0g · **부족 250g 보고** | 음수 방지 ✅ |
| 다진마늘 | 0g | 7g | 0g · **부족 7g 보고** | ✅ |

봉지를 헐어 개봉분으로 넘기는 동작까지 정확하다.

### E9 판매 취소 실증
```
복구 후: 대파 2,000g · 돼지고기 5,000g   ← 원상복귀
원장:    consume −1,125  /  adjust +1,125  ← 정확히 상쇄, 삭제 없음(append-only)
```

## 데이터 계층 기반 (계속)
- `qk` 쿼리 키 전면 개편 — 도메인 **루트 키**(접두 무효화 가능) + `invalidateOn` 전파 매핑.
  가이드 §8.2 전파 계약 매트릭스를 코드로 옮겨, 화면마다 무효화 목록을 손으로 적다 빠지는 일을 막았다.
- 화면 인벤토리(README) 정정 — 문서는 4탭인데 **실제는 5탭**이었고 매출관리 11개 화면이 통째로 누락돼 있었다.

## 진행 중
- 도메인 간 전파 매트릭스 감사 워크플로 (판매↔재고 / 재고↔발주 / 식재료↔레시피 / 고정지출↔월손익 /
  삭제·취소 전파 / 앱store↔DB 계약)

---

# 6주기 — 전파 매트릭스 감사 결과 반영

## 감사 규모
에이전트 36개 · 6개 축(판매↔재고 / 재고↔발주 / 식재료↔레시피 / 고정지출↔월손익 / 삭제·취소 / 앱store↔DB)
· 전부 **로컬 DB 실행으로 실증**. 결과가 심각했다.

## 수정 1 — 원장 보존 (0018) [완료, 실증]

**실증된 데이터 손실**
| 시나리오 | 결과 |
|---|---|
| 레시피 1건 삭제 | profit_trends 1→0, **과거 순이익 19,240 → 38,868 (+102% 과대)** |
| 식재료 1건 삭제 | price_trends 1→0 · inventory_events 9→6 · order_records 4→3 소멸, 그런데 monthly_pl 은 남아 **영구 불일치** |
| 판매행 DELETE | consume 의 sales_item_id 전부 NULL → e9 되돌리기 0건 → **재고 영구 손실** |

원인: 원장 4종이 마스터에 **CASCADE** 로 매달려 있었고, RLS 가 원장에 UPDATE/DELETE 를 열어 뒀다.

**조치**
- 원장 → 마스터 FK 를 **RESTRICT** 로. 마스터는 삭제 대신 `active=false` 로 은퇴시킨다.
- 원장 3종(inventory_events·price_trends·profit_trends)의 **UPDATE/DELETE 정책 제거**.
  정책이 없으면 RLS 가 켜진 테이블에서 그 동작은 전부 거부된다 → **append-only 를 DB 가 강제**한다.
  `order_records` 만 상태 전이가 필요해 UPDATE 를 남겼다.

**검증**: 레시피 삭제 → `violates foreign key constraint "daily_sales_items_recipe_id_fk"` 차단 ✅
정책 조회 결과 원장 3종은 **INSERT/SELECT 만** 존재 ✅

## 수정 2 — 과거 매출 소급 변경 차단 (0019) [완료, 실증]
`sales_summary` 가 `recipes` 를 join 해 **현재 레시피로 재계산**하고 있었다.
레시피 판매가·사용량을 바꾸면 지난 장부가 흔들리고, 레시피가 사라지면 원가가 0 이 됐다.

→ `daily_sales_items` 에 **판매 시점 스냅샷**(`unit_material_cost`·`unit_extra_cost`·`tax_mode`) 추가.
→ `sales_summary` 가 스냅샷만 쓰도록 재작성. **부자재도 손익에 포함**(앱은 '(−) 부자재' 행을 그리는데
   서버는 빼지 않아 같은 메뉴 순이익을 두 곳이 다르게 계산했다).
→ 고정지출률이 없으면 **가장 최근 입력 월로 잠정 적용**(④ 2). 0% 확정은 순이익률을 부풀린다(33.49%→64.79%).
→ **E10 판매 등록 RPC** 신설 — 스냅샷 채우기 + E8 소진을 한 트랜잭션으로. 앱이 직접 INSERT 하면
   스냅샷이 비고 재고도 안 줄어든다.

**독립 검산 일치**: 매출 60,000 · 재료 14,172.7 · 부자재 1,500 · 수수료 2,352 · 세금 5,454.5 ·
고정 18,780 → **순이익 17,740.72**

## 수정 3 — 전파 격차 4건 (0020) [완료]
| 결함 | 실증 | 조치 |
|---|---|---|
| 반제품 원가 0원 | 양념장(850원) 쓰는 불고기 material_rate **0.00%** | `recipe_material_cost()` 재귀 함수(깊이 5 제한으로 순환 차단) |
| E2 폐기가 단가를 21% 바꾸는데 price_trends 0점 | 4.706→5.714, 추이 없음 | 폐기 시 추이 점 적재 (절대원칙 4) |
| E4 가 p_month 를 안 넘김 | 과거 월 수정해도 **오늘 월 률로 덮어씀** | 그 달 마지막 날(오늘 넘지 않게)에 점을 찍도록 전달 |
| 후보가 생겨야 할 때 안 생기고 사라져야 할 때 안 사라짐 | 폐기·판매로 재고 0 이어도 후보 0건 / 실사로 채워도 pending 잔존 | **`refresh_order_candidate()` 단일 출처** 신설 |

`refresh_order_candidate` 설계:
- 재고를 **총량(기준단위)** 으로 보고 안전재고(개수 × 개당용량)와 비교
- 사유가 하나도 없으면 **후보를 삭제**한다(예전엔 reasons 가 누적되기만 해 해소돼도 남았다)
- `ordered` 상태는 저장하지 않고 **미도착 발주에서 파생**시킨다(저장하면 발주가 취소돼도 남는다)

## 수정 4 — 후보 재판정을 모든 재고 경로에 연결 (0021) [완료, 실증]
E1 의 무조건 `delete from order_candidates` 를 `refresh_order_candidate` 로 교체하고, E8 에도 연결.

**사이클 실증** (사용자가 지적한 그 고리):
```
[1] 판매(E10) → 재고 차감 → **후보 4건 자동 생성**   ← 끊겨 있던 마지막 고리
    다진마늘 {safety_stock,soon_out} 2 · 대파 {safety_stock} 1 · 양파 {safety_stock} 3
[2] 발주(E7)  → 후보 status `pending` → **`ordered`**
[3] 부분 입고 → 총량 2,875 > 안전 2,000 → 후보 해소
[4] 전량 입고 → 총량 4,875 → 후보 없음
```

## 수정 5 — RPC 오버로드 재발 방지 (0022) [완료]
**같은 사고가 세 번째였다.** 0012(e1) → 0015(e1 재발) → 0020(e2_discard).
`create or replace function` 은 인자 시그니처가 다르면 **교체가 아니라 신규 생성**이고,
PostgREST 는 인자 개수로 함수를 고르므로 **인자 하나를 빼면 새 방어를 통째로 우회**할 수 있다.

→ `assert_no_rpc_overloads()` 가드 함수 신설 + 마이그레이션에서 즉시 검사.
   앞으로 인자를 늘리면 `db reset` 이 그 자리에서 실패해 드러난다.

## 수정 6 — 시드를 실제 등록 경로로 (사용자 지적 반영) [완료, 실증]

E2 검증 중 드러났다: 폐기 후 **실측 로스율 150%**, 기준단가 **null**.
원인은 시드가 `inventory_states` 에 재고를 직접 넣고 구매 이력은 따로 넣어 **둘이 어긋난 것**이었다.
대파 재고 2,000g 인데 누적 구매는 1,000g — "산 적 없는 재고"가 있었다.

→ 시드가 **E7(발주) → E1(입고)** 경로를 그대로 태우도록 재작성.
   이러면 order_records · inventory_states · inventory_events · price_trends 가 **구조적으로 일치**한다.

**검증**
| 식재료 | 재고총량 | 누적구매 | 기준단가 | 일치 |
|---|---|---|---|---|
| 대파 | 2,000 | 2,000 | 4.7059 | ✅ |
| 돼지고기 | 5,000 | 5,000 | 13.0000 | ✅ |
| 양파 | 3,600 | 3,600 | 2.1000 | ✅ |
| 다진마늘 | 2,000 | 2,000 | 8.5000 | ✅ |

재료비 **2,834.55**(검산 2,835) · 고정지출률 **31.30%** · price_trends 4점 · inbound 이벤트 4건.
E2 폐기 후에도 로스율 75%(정상 범위)로 단가가 산출되고 추이 점이 1→2 로 늘었다.

## 남은 P0 (다음 라운드)
- **입고 취소 역전파 RPC 부재** — 앱에 버튼과 "재고·구매이력·기준단가가 되돌아가요" 문구가 있는데 서버에 함수가 없다
- **발주 취소 RPC 부재** — `order_status.canceled` 값은 있는데 세팅하는 함수가 없다.
  게다가 status 를 직접 'canceled' 로 UPDATE 하면 기준단가가 **NULL** 이 된다(문서는 "취소는 단가 영향 없음")
- **월매출 출처 이원화** — 월손익은 수기 `total_revenue`(12,000,000), 매출분석은 `daily_sales` 실적(60,000).
  같은 매장 같은 달을 두 화면이 다르게 보여준다
- **`stock_total_base`(gross) vs core `remainConverted`(net) 충돌** — 절대원칙 3 위반
- **앱 세션 미연결** — `session.ts` 가 호출부 없는 사문이라 화면에서 아무것도 못 본다

---

# 7주기 — 취소 역전파 + 앱 실데이터 연결 (첫 화면 완결)

## E11 입고 취소 · E12 발주 취소 (0023) [완료, 실증]

앱 `OrdersHomeScreen` 에 '입고 취소' 버튼과 "늘어난 재고와 구매 이력, 기준단가 반영이 함께 되돌아가요"
라는 **약속 문구**가 있는데 서버에 역전파 함수가 없었다. 연결하면 사장님이 취소를 눌러도 아무것도
되돌아가지 않는다.

설계 (절대원칙 4 와 양립):
- 원장은 **지우지 않는다.** 반대 부호 보정 이벤트를 쌓는다.
- `price_trends` 과거 점도 지우지 않고 **취소 시점의 재계산된 단가로 새 점**을 찍는다 —
  "왜 단가가 되돌아갔는지"가 추이에 남아야 한다.
- 발주 취소는 **미입고 건만** 허용한다. 이미 입고된 걸 그냥 취소하면 `base_unit_price` 가
  `status in ('received','partial')` 만 보므로 **재고는 남았는데 단가는 사라지는** 모순이 생긴다
  (실증됐던 결함). E11 을 먼저 거치게 강제한다.

### 실증
| 단계 | 재고 | 단가 | 결과 |
|---|---|---|---|
| 기준 | 2,000g | 4.7059 | — |
| 입고(6,000원/1,000g × 2) | 4,000g | **5.8824** | 가중평균 상승 ✅ |
| E12 즉시 취소 시도 | — | — | **거부** — "입고 취소를 먼저 실행하세요" ✅ |
| E11 입고 취소 | **2,000g** | **4.7059** | 완전 복구 ✅ |
| E12 발주 취소 | — | 4.7059 | `canceled`, 단가 불변 ✅ |

원장: price_trends 4→6, inventory_events 4→6 — **과거 점 보존 + 보정 추가**.

## 앱 실데이터 연결 (첫 화면)

### 세션 게이트
`session.ts` 가 호출부 없는 사문이었다 → `SessionProvider`/`SessionGate` 로 앱 루트에 연결.
- 상태를 **뭉뚱그리지 않는다**: `unconfigured` / `signed-out` / `error` 는 원인도 해결책도 다르다.
- '다시 시도' 버튼에 처음엔 **빈 핸들러**를 넣었다가 스스로 발견해 고쳤다 — 지금까지 계속 지적해 온
  안티패턴을 내가 재현한 것이다. `useSession` 에 `retry()` 를 추가해 실제로 재시도하게 했다.
  환경 미설정은 재시도해도 달라지지 않으므로 그때는 버튼을 숨긴다.

### 조회 계층
- `features/ingredients/hooks.ts` — 화면이 supabase 를 직접 부르지 않는 경계(가이드 P0-1).
- `ingredient_list(store)` RPC 신설(0024) — 재고 총량·기준단가는 **서버 함수**라 일반 select 로
  못 가져온다. 한 건씩 부르면 N+1 이고, 앱이 직접 계산하면 총량 정의가 두 벌이 되어 절대원칙 3 을 깬다.
- `QueryState` kit 컴포넌트 — Loading/Error/Empty 분기를 한 곳에. 통신 실패를 빈 목록으로 그리면
  "정말 없다"고 오해한다(§9.8).
- `IngCard` 를 실데이터 타입으로 재작성. **기준단가 null 은 '단가 산출 전'으로 표기** —
  0원으로 그리면 공짜 재료로 읽힌다.

### 결함 J — 시드 계정으로 로그인이 안 됐다 (P0) [수정 완료]
```
500 Database error querying schema
error finding user: Scan error on column index 3, name "confirmation_token":
  converting NULL to string is unsupported
```
GoTrue 는 `confirmation_token`·`recovery_token`·`email_change*` 등을 **NOT NULL string 으로 스캔**한다.
컬럼 기본값이 NULL 이라 시드가 명시하지 않아 로그인이 500 으로 죽었다.
`auth.identities` 행도 없어 provider 매칭이 불가능했다.
→ 토큰 컬럼을 **빈 문자열**로, `auth.identities` 행 추가.

### 엔드투엔드 실증
```
로그인 → JWT 발급 ✅
GET /rest/v1/stores          → [{"한끼 백반"}]            ← RLS 통과
POST /rpc/ingredient_list    → 4행
   다진마늘 2,000g / 8.5   · 대파 2,000g / 4.7059
   돼지고기 5,000g / 13    · 양파 3,600g / 2.1
anon(비로그인) 호출          → []                        ← RLS 격리 정상
```

## 회귀
core 147 통과 · typecheck 3개 패키지 · 웹 번들 200 OK

## 남은 P0
- **월매출 출처 이원화** — 월손익은 수기 `total_revenue`, 매출분석은 `daily_sales` 실적.
  같은 매장 같은 달을 두 화면이 다르게 보여준다
- **`stock_total_base`(gross) vs core `remainConverted`(net) 충돌** — 절대원칙 3
- 나머지 38개 화면의 실데이터 연결 (식재료 목록 1건만 완료)
