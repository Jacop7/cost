# CLAUDE.md — 식자재 관리 앱 작업 지침

## 프로젝트 한 줄 요약
식당 사장님이 수기 입력만으로 재고·발주·입고·원가·손익 한 사이클을 완결하는 모바일 데이터 플랫폼.
Expo(RN) + Supabase 모노레포. 모든 데이터가 기록·전파되어 추후 리포트의 원천이 된다.

## 절대 원칙 (위반 금지)
1. **단위 표준화**: DB 저장은 항상 최소단위(g/ml/개) · 1인분 기준. 화면 입력은 구매단위·N인분 → 저장 직전 환산.
2. **재고·단가 변경 출처 제한**: 재고/단가/이력은 E1(입고)·E2/E5(재고수정)에서만 변경. 발주 등록(E7)은 기록만.
3. **계산은 서버가 권위**: 손익·단가 확정값은 `packages/db`의 RPC(트랜잭션). `packages/core`는 동일 공식의 클라이언트 미리보기/검산 전용 — 두 곳 공식이 어긋나면 안 됨.
4. **추이 스냅샷은 1차부터 기록**: 그래프는 2차여도 `price_trends`·`profit_trends` 적재는 E1~E4에서 항상 수행.
5. **손실은 추정하지 않는다**(0041): 기준단가는 실입고량 가중평균 그대로다. 로스율은 **표시 전용**이다 —
   `ingredient_loss()`가 실측값을 주고 식재료 상세에 폐기 이력과 함께 보이지만, 어디에도 곱해지지 않는다.
   손실은 실제로 버릴 때만 기록한다 — ① 식재료 폐기(E2) ② 조리 폐기(매출의 `qty_waste`).
   둘 다 재고에서 빠지고 월 손익의 폐기 손실로 잡힌다.
   ⚠ **손질 손실은 1차 범위 밖**(사장님 결정). 대파 1kg 을 다듬어 850g 을 써도 150g 은
   기록되지 않는다. 그 결과 장부 재고가 물리 재고보다 많아지고, 월 5만원가량(실측)이
   원가에 잡히지 않는다. 2차에서 입고 실측량 입력으로 닫을 수 있다.

## 검산 기준값 (테스트·시드 고정)
- 대파 기준단가: 4,000원/1,000g → **4.00원/g** (0041: 로스로 나누지 않는다)
- 기준단가 = **쓴 돈 ÷ 들어온 양**(양 가중, 0072). 팩 개수로 가중하지 않는다 —
  `단가 × 총입고량 = 그 재료에 쓴 돈` 이 성립해야 한다. 개수는 기록이고 가중치가 아니다.
  재고도 같은 분모를 쓴다 — 입고는 **그 발주의 팩 용량**으로 환산한다(마스터 `per_volume` 은 기본값).
- 제육볶음(10인분, 판매가 12,000): 재료비 **2,806.40**, 순이익 **4,046.69원 · 33.72%**
- 고정지출률: **31.3%** (1,000원당 313원), 메뉴 배분 적용 시 3,760원·31.3%
- 세금 = **판매가 × Σ(사장님이 적은 항목 요율)**(0090). 포함/별도/면세 모드는 없앴다 —
  항목이 없으면 0원이고 그게 면세다. 부가세도 항목 하나다.
  ⚠ 부가세 포함 가격이면 요율은 10 이 아니라 **10/110 = 9.0909…%** 다.
  10 을 적으면 12,000원 메뉴에서 109원이 더 빠진다.
  계산은 `tax_of()` 한 곳뿐이고 `packages/core` 의 `taxAmount()` 가 미러다
  (`tax_of` 의 `p_mode` 인자는 남아 있지만 읽지 않는다 — 부르는 곳 15군데와
  영업일 스냅샷을 고치지 않으려고 자리만 뒀다).
  검산값 3종은 `부가세 9.0909…%` 항목 하나로 그대로 성립한다.
  배달 중개 수수료는 **여기가 아니라 고정 지출**(0043).
  ⚠ **세금은 매장 하나에 하나다**(0087). 레시피마다 고치지 않는다 — `MY > 세금` 이
  유일한 입구이고, 저장하면 전 레시피 손익이 다시 계산되어 각 메뉴의 손익 변동에
  `세금 반영` 한 줄이 남는다(고정지출 E4 와 같은 짜임).
  `recipes.tax_items` 는 그 전파 결과이며 트리거가 채운다 — `save_recipe` 로는 못 바꾼다.
- **플랫폼 수수료는 고정 지출에서만 관리**(0043). 판매 채널에 요율을 두면 같은 돈이
  손익에서 두 번 빠진다(실측 19일 503,397원). 채널은 매장·배달·포장 **3개 고정**이다 —
  `daily_sales_items` 가 세 컬럼이라 네 번째를 만들어도 수량을 넣을 곳이 없다.

## 디렉토리 규칙
- 화면 ID 체계 유지: `ORD-`(발주) `ING-`(식재료) `RCP-`(레시피) `MY-`(마이페이지)
- 전파 이벤트는 `packages/db/sql/rpc/`에 1파일씩, `packages/core/src/propagation/`에 순수 로직 미러.
  **E6 은 없다** — ORD-04 레시피 계산기는 1차 범위 밖이라 제거했다(0060). 번호는 당기지 않는다.
  **반제품도 1차 범위 밖이다**(0109). `recipe_lines.sub_recipe_id` 는 2차 예약 컬럼이고
  `recipe_lines_no_sub_recipe` 제약이 값이 들어가는 걸 막는다 — `save_recipe` 도 거부한다.
  ⚠ 읽는 쪽(`recipe_ingredient_needs`·`recipe_material_cost`·`recipe_detail`·
  `recipe_snapshot_entry`)에 재귀 전개가 남아 있지만 **데이터가 없어 안 돈다.**
  그 재귀를 근거로 새 기능을 얹지 않는다. 2차에서 열 때는 제약을 지우는 것부터 시작한다.
- 새 파생값 공식은 반드시 `packages/core`에 추가하고 검산 테스트 동반.

## 프론트엔드(앱) 규칙
- **스택**: Expo **SDK 54** (React 19 · RN 0.81 · expo-router 6). pnpm + 루트 `.npmrc`의 `node-linker=hoisted` 필수(RN/Metro 호환).
- **디자인 원천**: ver.2 프로토타입 `kit.jsx`(Toss/Cashnote 스타일)를 RN으로 이식 → `apps/mobile/src/components/kit`. primary=블루 `#3182F6`, 상태=여유(초록)/소진임박(빨강), 비용=그레이. 토큰은 `src/theme/tokens.ts`(`T`·`STATUS`). 새 UI는 kit 재사용.
- **하단 탭 순서**: 식재료 · 레시피 · 발주 · MY. 각 탭은 폴더+`_layout.tsx`(Stack)로 둬야 라우트명이 매칭됨(없으면 탭바 깨짐).
- 화면은 자체 `AppHeader`를 그리므로 Tabs/Stack 헤더는 숨김.
- 데이터는 현재 `features/*/demoData.ts`(임시). 실데이터·전파는 `src/lib/supabase.ts`의 `rpc.*` + react-query 무효화로 연결 예정.
- **표기 규칙**: 화면 노출 단위는 kg·g·ml + 개수(개/모)만. 망·통·박스·판 등 구매단위 라벨은 표기에서 빼고 상품명/거래처로 분리. 구매 옵션은 `식재료명 · 용량 · 금액 / 구매처 · 단가`. 재고 상태는 **여유 / 소진 임박 / 소진 3단계**(0102) — 재고가 0 이하면 `소진`, 그 위에서 안전재고 **이하**(`<=`)거나 곧소진이면 `소진 임박`. ⚠ 음수 재고를 `0`으로 보정해 표시하지 않는다. `−750g` 을 그대로 빨간색으로 보여 준다 — 감추면 입고 누락을 알아챌 단서가 사라진다.
  ⚠ 판정은 `packages/core` 의 `stockStateOf` **한 곳**이다(0108). 화면에 두 번째 판정을 만들지 않는다 — 예전에 core 와 앱에 한 벌씩 있었고 `soonOut` 의 뜻이 서로 달랐다.
- **부족 판정은 목적별로 둘이다**(0107). 하나로 쓰면 반드시 한쪽이 거짓말이 된다.
  · 영업 시작 `recipe_shortages` — `현재 재고 < 1개 필요량`. 안전재고 미달은 안 넣는다(그건 `소진 임박`).
  · 판매     `sale_shortages` — `현재 재고 < **증가분** 필요량`. 전체 판매량이 아니다 —
    10개를 7개로 고치는데 경고가 뜨면 안 된다. 재고는 오히려 돌아온다.
  둘 다 읽기 전용이고, 판매 쪽은 `reconcile_sales_consumption` 과 같은 재료(그날 스냅샷 + 원장)를 쓴다.
- **재고가 부족해도 판매를 막지 않는다**(기획안 §2.1). 막는 건 사장님이 끈 `판매 중지` 하나뿐이다.
  ⚠ 막으면 한 번 음수가 된 메뉴를 **영영 못 고친다** — 수량을 되돌리는 것도 같은 문으로 들어온다.
- **공통 헤더**: 리스트는 타이틀(24·800, 좌) + 검색/알림 아이콘(우), 그 아래 밑줄형 탭(좌측 정렬, 구분선 `#D1D6DB`). 카드는 `border + cardShadow`.
- 구현 화면 인벤토리·플로우는 `apps/mobile/src/features/README.md` 단일 출처로 갱신.

## 검사 실행
- **`pnpm verify`** (루트) 한 방 — 타입 · 시험 3종 · 새 DB · 업그레이드 경로 · 웹 번들.
  각각 따로 돌리다 하나를 빼먹는 일이 있어서 한 명령으로 묶었다. CI 도 이걸 부른다.
- `pnpm test` (루트) → `packages/core` vitest · `packages/db` `tests/run.mjs` · `apps/mobile` vitest.
  ⚠ 개수는 여기 안 적는다 — 늘어나면 곧 거짓이 된다. 명령이 답한다.
- 앱 시험은 `apps/mobile/tests/*.test.{ts,tsx}` 에 두고 **vitest** 로 돈다.
  ⚠ `node --experimental-strip-types` 를 쓰지 않는다 — 그건 Node 24 전용이라 루트가
  선언한 `engines.node: >=20.19.4` 와 어긋난다(Node 20 에서 `pnpm test` 가 깨진다).
  하한 자체는 `react-native@0.81`·`metro@0.83` 이 요구하는 값이고, CI 매트릭스가 이 정확한
  버전으로 돈다 — `20` 이라고 적으면 최신 20.x 를 받아 실제 하한은 검증되지 않는다.
- **화면도 잰다.** `react-native` 를 `react-native-web` 으로 바꿔 jsdom 에 그리고
  `@testing-library/react` 로 누른다(`vitest.config.ts`).
  ⚠ `@testing-library/react-native` 는 못 쓴다 — `react-native` 소스가 Flow 인데
  그걸 벗기는 건 Jest 의 babel 프리셋이고 vitest 의 esbuild 는 Flow 를 못 읽는다.
  ⚠ `react-native-safe-area-context` · `react-native-svg` 는 `tests/setup.ts` 에서
  **모듈째 대신 세운다.** 둘 다 `react-native/Libraries/…`(Flow)를 깊은 경로로 가져온다.
  그래서 **아이콘·차트의 생김새와 노치 여백은 안 재진다** — 잡는 것은 글자와
  접근성 이름이다. 실제로 그려지는지는 `pnpm verify` ⑤ 의 웹 번들이 본다.
  ⚠ 화면 시험은 훅을 대신 세우고 **서버를 안 부른다.** 서버 계약은 DB 스위트가 잰다.
- `bash packages/db/scripts/fresh-db.sh fresh_x` 로 새 DB, `--until <14자리>` 로 중간 상태.
  ⚠ 스크립트가 `scripts/admin-acl.sh` 를 **supabase_admin 접속으로** 불러 그 롤의 기본 권한
  (TRUNCATE·TRIGGER·REFERENCES)을 걷어내고 **그 롤로 표를 실제로 만들어** 닫혔는지 잰다 —
  postgres 는 그 롤의 멤버가 아니라 마이그레이션(0166·0167)으로는 못 하고 NOTICE 만 남긴다.
  대상도 동작도 **명시적**이다 — 로컬은 `--local <db> <fix|check>`(식별자만), 운영·개발은 배포
  절차에서 `ADMIN_DB_HOST=… ADMIN_DB_USER=… [ADMIN_DB_PORT/NAME/SSLMODE] [ADMIN_DB_PASSWORD=…]
  bash packages/db/scripts/admin-acl.sh --remote fix` 한 번, 이후 `--remote check` 로 게이트
  (CI 는 `--no-db` 라 이 단계를 안 돈다). fix/check 는 생략 불가.
  ⚠ 접속 문자열(URL/keyword)은 **받지 않는다** — 항목별 환경변수만(값마다 문자 집합 검사). 정규식으로
  비밀번호를 떼는 방식은 `?pass%77ord=`·`password =`·`sslpassword=` 에서 새어 나갔다.
  접속 정보는 전부 libpq 환경변수(PGHOST…)로 psql 에 가고 argv 에는 옵션만 남는다 — 격리된 서브셸에서
  export 변수를 전부 unset 하고 필요한 것만 export 한 뒤 `exec` 한다(`env -i A=… cmd` 는 env 의 argv 에
  값이 실려 쓰지 않는다). 비밀번호는 `ADMIN_DB_PASSWORD` 가 있으면 그것만, 없으면 셸의 `PGPASSWORD` 도
  지운 채 `PGPASSFILE`/libpq 기본 pgpass(Windows 는 `%APPDATA%\postgresql\pgpass.conf`). 셸의
  `PGSSL*`·`PGSERVICE`·`PGOPTIONS` 등은 상속되지 않고 로그는 host/db 까지만. 접속 계정이
  supabase_admin 이거나 그 롤로 전환 가능한 슈퍼유저인지 먼저 확인하고 아니면 아무것도 안 바꾼다.
  시험 31 이 `pg_default_acl` 로 두 롤을 다 잰다.
- 설정 값은 서버가 잰다(0167·0168): 언어 키는 core `LOCALES` 의 키('ko', 'en-US', …)이고
  **통화·금액 자릿수는 언어에서 파생**한다(`locale_defaults`, core 시험 `localeSqlParity` 가 대조).
  빈 `{}`·JSON 타입 불일치·목록 밖 값은 22000(EMPTY_PAYLOAD / INVALID_VALUE).
  ⚠ 언어 목록을 바꾸는 마이그레이션은 **한 파일 안에** ① 기존 행 이관 ② `settings_locale_combo_ck`
  재생성(drop+add) ③ 전 행 `locale_combo_ok` 대조(어긋나면 멈춤)를 함께 담는다 — 표를 바꿔도 기존
  행은 저절로 재검증되지 않는다. `localeSqlParity` 가 0169 이후 파일의 이 구조를 잰다(정규식 — 보조),
  `localeDbParity` 가 verify ③ 의 새 DB 에서 **실제 함수 결과**를 core 와 대조한다(권위).
- `get_settings` 응답 키(20개)는 앱 `parseStoreSettings` 의 계약이다. DB 시험 32 가 **실제 RPC 응답**의
  키·타입을 재고 앱 시험(settingsResponse)이 그 리터럴을 읽어 파서와 대조한다 — 한쪽만 고치면 빨개진다.
  앱 파서는 타입뿐 아니라 값(언어↔통화·자릿수, metric, 컵 범위, HH:MM, 세금 항목)도 거른다.
- 경합은 `node packages/db/tests/concurrency.mjs fresh_x` — 실제 연결 2개로
  판매 저장 ↔ 크론(마감·브레이크)을 동시에 돌린다. **커밋이 남으므로 일회용 DB 전용**
  (스크립트가 fresh_* 이름을 강제한다). verify ③ 이 스위트 다음에 자동으로 돌린다.
  `bash packages/db/scripts/upgrade-check.sh` 는 마이그레이션 **순서**를 태운다 —
  최종 상태만 보는 시험은 "앞이 만든 값을 뒤가 검사해서 통과" 하는 구멍을 못 잡는다.

## dev 실행
- `cd apps/mobile && npx expo start --tunnel` (IP 변동·외부 접속 대응, Expo Go SDK 54). `--web`은 브라우저 미리보기.
- Node 24 + Expo CLI undici 버그로 시작 시 죽으면 `EXPO_OFFLINE=1` 우회(오프라인은 localhost 바인딩이라 폰은 터널/LAN).

## 작업 시
- 한국어로 응답. 코드 주석/식별자는 영문 snake_case(DB)·camelCase(TS), 도메인 용어는 한글 주석 허용.
- 스키마 변경 시: migration 추가 → `pnpm db:types`로 타입 재생성 → core/앱 동기.
- 설계 근거는 `docs/` 원본 문서 절 번호를 인용.
