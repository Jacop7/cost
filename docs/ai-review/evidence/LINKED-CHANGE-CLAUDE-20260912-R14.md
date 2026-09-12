# LINKED-CHANGE 검수 R14 — 구매 가격 필수(v2)·영업 중 수정 확인창 델타 (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `f9b3345`(직전 구현 `da9763c`), 작업 트리 미커밋 델타. 전체 verify 는 이전 후보부터 실행 중 → **최종 후보 6/6 이라고 쓰지 않는다**. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론. 인증정보·덤프·`emulator-fixtures.json` 은 읽지 않았다.
- 제약: 제품 소스/DB/시험/Git 변경·실행 없음. 본 문서 1개만 신규.
- 입력(sha256 앞 16): `20260912000230_ingredient_required_purchase_price.sql` 1,253 B · 19:28:13 · `7261374ecbdb5a66` · `tests/87_required_ingredient_purchase_price.sql` 3,559 B · `25bfa996c7bc023b`(6단언×4=24) · `useBusinessEditConfirmation.tsx` 1,618 B · `bbe2848250e90d11` · `tests/businessEditConfirmation.test.tsx` 2,158 B · `32cda7b563e1f7eb` · diff: `ingredients/hooks.ts` +5/−1, `IngredientFormScreen.tsx` +6/−4, `IngredientDetailScreen.tsx`, `RecipeDetailScreen.tsx`, `MaterialManageScreen.tsx`, `FixedCostScreen.tsx`, `InternationalTaxScreen.tsx`, `changes/hooks.ts`, `ChangeHistoryScreen.tsx`, `tests/ingredientFormFailure.test.tsx`(+16).
- 로그(확인): `required-price-db-latest-all.log` 89/89 통과(19:33:39, 87 은 ok 20줄 + eq 4줄 = 24), `required-price-db-before.log`(수정 전 실패) 존재. UI/타입 로그는 ROOT 보고대로 기록만.

## 1. 결론 요약

- **0230 적절(확인)**. 앵커 `    v_new := v_id is null;` 는 `save_ingredient` 본문(0214 이후) 에 1회이며 memo patch 분기(L1341–1363, `return` 으로 종료) **뒤**·full 저장 본문 **앞**에 있다. 삽입된 검사는 `contract_version` 이 있고 '1'/'2' 가 아니면 22000, '2' 이면 `jsonb_typeof(purchase_price)='number'` 아님(누락·JSON null·문자열·"NaN")·음수를 22000 으로 거부한다. 어떤 UPDATE/INSERT 보다 앞이라 거부 시 필드·이력·추이가 남지 않는다(tests/87 L31–33). `contract_version` 없는 레거시 호출과 memo 경로는 그대로다(L9, L44–45). 과거 null 은 역산·소급하지 않는다.
- **앱 계약 일치(확인)**. `useSaveIngredient` 는 `contract_version: 2` 와 `purchase_price` 를 항상 보내고, 보내기 전 `null/비유한/음수` 를 클라이언트에서 막는다. 폼은 빈 값·비숫자·음수를 `priceError` 로 잡아 `canSave` 를 끄고, 기존 항목의 null 은 빈 입력 + 오류 문구로 표시해 저장을 막는다(시험 "이전 자료의 null 가격은 … 저장을 막는다"). 명시적 0 은 허용되어 서버의 "0 허용" 과 같다. memo 훅은 `patch:'memo'` 만 보내 무관하다.
- **사용자 재현 시나리오 해소(추정)**. 대파(purchase_price null, 입고 평균 4원/g) 의 개당 용량만 바꾸던 조작은 이제 가격 입력 없이는 저장되지 않고, 가격을 입력하면 0214 의 override 가 잡혀(`4000/2000=2`) 식재료·메뉴 이력에 affects_sales=true → open/break 에서 pending, 마감 후 반영(tests/87 L34–40, 4상태).
- **영업 중 수정 확인창 적절(확인)**. `useBusinessEditConfirmation` 은 `open/break` 에서만 `ConfirmDialog` 를 띄우고 확인 시에만 편집을 열며, `none/closed` 는 즉시, 상태 누락·오류는 `Alert` + `refetch` 로 막는다(시험 3종). 언마운트 시 보류 액션을 비운다. 적용 지점: 식재료 상세 '식재료 수정', 메뉴 상세 헤더 '수정'(신규 연결), 부자재 `openEdit`, 고정지출 **당월** 수정 버튼(다른 달은 직접 이동 — 0218/0226 의 "다른 월은 현재 기준 무관" 과 일치). 세금 저장 확인창은 제목·문구를 공통 상수로 통일(시점은 저장 시로 유지).
- **이력 화면**: 상세 팝업에서 식재료도 상태 배지를 보이고 직접/자동 배지를 붙였다. `stateLabel` 은 `not_reflected`·`partial` 을 모두 "영업 종료 후 반영 예정" 으로 통일.
- **신규 P1/P2 없음**. 반례 탐색 결과는 §3, P4 메모 5건.

## 2. 반례 탐색 (모두 해당 없음 또는 설계 결정)

| 시도한 반례 | 결과 |
|---|---|
| v2 create 에 가격 누락 | 검사가 `v_new` 판정보다 앞이라 create/update 모두 거부(확인) |
| 문자열 "4000" | `jsonb_typeof` 가 string → 거부. 앱은 `num()` 으로 number 전송(확인) |
| 소수·큰 값 | number 면 통과, 컬럼 CHECK(`< Infinity`) 유지. 폼은 `clampDecimals(t,0)` 로 정수만 입력(확인) |
| memo patch 가 v2 검사에 걸림 | memo 분기가 앵커 앞에서 return(확인) |
| 다른 화면의 `useSaveIngredient` 호출 | grep 결과 `IngredientFormScreen` 1곳뿐(확인) |
| 응답 유실 재시도 | 같은 payload 재전송 → 서버 no-op 규칙(0214) 그대로, 검사 통과(추정) |
| 확인창 취소 후 다시 열기 | `cancel()` 이 액션을 비우고, 재요청 시 새 액션(시험 L14–15) |
| 상태 로딩 중 탭 | 편집 차단 + refetch. 영업 전으로 추정하지 않음(시험 L21–25) |
| 메뉴 편집 다른 진입 경로 | `/recipes/add?id=` 로 가는 곳은 상세 헤더뿐(grep, `RecipeAddScreen` 은 저장 후 replace) |

## 3. 발견 사항 (신규 P1/P2 없음)

### R14-1 · P4 · 레거시 경로가 PostgREST 에 그대로 열려 있음
- `contract_version` 을 빼고 부르면 종전대로 null 가격 저장이 가능하다. 설계상 "legacy 호출 보존" 이지만 앱은 항상 v2 를 보내므로, 이후 `assert_write_app_version` 최소 판본을 올릴 때 v2 를 강제하는 것을 검토.

### R14-2 · P4 · 명시적 0원의 원가 영향
- 필수 입력을 0 으로 채우면 override 0 → 연결 메뉴 재료비가 0 이 된다(다음 입고까지). affects_sales=true 로 pending·이력이 남아 보이긴 하나, 폼에서 0 입력 시 한 줄 안내(예: "0원이면 메뉴 원가에 0으로 반영돼요") 를 권고.

### R14-3 · P4 · 식재료 '재고 수정'(입고·차감·폐기) 진입은 확인창 없음
- 입고는 0214 로 override 를 초기화해 영업 중 메뉴 원가 pending 을 만들지만 요구 범위(식재료·메뉴·부자재·당월 고정지출 **수정**) 밖이라 확인창이 없다. 일관성 차원의 기록.

### R14-4 · P4 · `partial` 상태 문구 통합
- "일부 메뉴 미반영" 정보가 "영업 종료 후 반영 예정" 으로 흡수된다. 사용자 요구(대기 문구 통일) 에 따른 결정이며 톤(amber) 은 유지.

### R14-5 · P4 · 월 경계
- 고정지출 확인창은 `month === localMonth` 로만 판단한다. 월말 심야에 열린 영업일이 전날 월에 속하는 경우 pending 기준 월과 어긋날 수 있으나, 서버(0218) 도 `store_local_month` 기준이라 일관된다.

## 4. 상태 표

| 항목 | 상태 |
|---|---|
| 사용자 반례(대파 용량만 수정 → 대기 없음) | 해소(0230 + 앱 v2 필수 + tests/87·UI 시험) |
| R6-3 backfill 부재 | 정책 확정으로 종결(추정 입력 없음, 편집 시 사용자가 명시) |
| 영업 중 수정 확인창 | 신규, 4개 진입점 적용·시험 |
| R4-1·R5-1·R6-1~2·R7-4·R7-5·R9-2·R11-1~2·R12-1~3·R13-1~2 | 변동 없음 |