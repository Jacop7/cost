# AGENTS.md — 식자재 관리 앱 작업 지침

## 프로젝트와 권위

식당 사장님이 수기 입력만으로 재고·발주·입고·원가·판매·손익을 기록하는 Expo + Supabase
모노레포다. 확정 계산과 원장은 DB RPC가 권위이고, `packages/core`는 같은 공식의 미리보기·검산만
담당한다.

문서 책임은 다음처럼 나눈다.

- 현재 원장·계산·전파: `ARCHITECTURE.md`
- 화면 ID·라우트·구현 상태: `apps/mobile/src/features/README.md`
- 작업 순서·완료 기록: `docs/작업큐.md`
- 솔라·페이블 공동 작성·검수: `docs/ai-review/README.md`
- 브랜치·DB 배포·복구: `docs/브랜치-DB-운영-기획안.md`
- 서버 구성·확장 판단: `docs/서버-확장-아키텍처-기획안.md`

역할별 AI 컨텍스트를 분리해도 공식 산출물은 분리하지 않는다. 주제별 요구사항·설계·UX·소스·
테스트의 공식 경로는 하나이며, 솔라와 페이블은 `docs/ai-review/README.md`의 매개형 공동 작성
절차로 같은 파일을 개선한다. 역할명이나 수정 단계를 붙인 경쟁 공식 문서를 만들지 않는다.
공동 장부의 비-Fable 턴은 `pnpm fable:append`로만 추가하고 `collaboration.md`를 직접 편집하지 않는다.

검수 기록과 `proposed_edits`는 공식 정책의 대체본이 아니다. 제안이 같은 공식 파일에 반영되고
판본·실행 증거·재검수가 연결돼야 현재 기준 후보가 된다. 권위 작업 루트는
`C:\Users\jacop\프로젝트\식자재관리앱` 하나다. OneDrive에는 저장소를 복사·동기화·미러링하지
않으며 OneDrive 파일·링크·작업공간과 그 밖의 사본을 작업·검수·판정·복구 입력으로 사용하지 않는다.
단, 보호 원격 CI가 origin의 정확한 decision commit SHA를 임시 읽기 전용 checkout해 hash-chain과
게이트 조건만 검증하고 폐기하는 환경은 예외다. 이 환경은 공동 작성·Fable 입력·공식 작업본이 아니다.

## 절대 원칙

1. **단위 표준화**: DB 저장은 g/ml/개 최소 단위와 1인분 기준이다. 구매단위·N인분 입력은 저장
   직전에 환산한다.
2. **변경 출처 제한**: 발주(E7)는 기록만 한다. 재고·단가는 입고/취소, 폐기, 실사, 판매/취소처럼
   정의된 전파 이벤트를 통해서만 바뀌며 원장 없는 직접 보정은 금지한다.
3. **서버 계산 권위**: 손익·단가·세금·영업일 확정값은 DB RPC가 만든다. 앱은 서버 값을 다시
   계산해 덮어쓰지 않는다.
4. **시점 보존**: `price_trends`·`profit_trends`·영업일 스냅샷·감사 원장을 1차부터 기록한다.
5. **손실을 추정하지 않는다**: 로스율은 표시 전용이다. 실제 식재료 폐기(E2)와 조리 폐기
   (`qty_waste`)만 재고·손익에 반영한다. 손질 손실은 현재 범위 밖이다.
6. **판매 부족을 숨기지 않는다**: 판매 필요량 전량을 원장에 기록하고 음수 재고를 허용한다.
   0으로 자르거나 표시를 0으로 바꾸지 않는다.
7. **영업일을 기기 시계로 만들지 않는다**: 매장 날짜·영업일·시간대는 서버 응답을 사용한다.

## 고정 검산값

- 대파: 4,000원 ÷ 1,000g = **4.00원/g**
- 기준단가: **쓴 돈 ÷ 실제 들어온 양**. 팩 개수나 로스율로 가중하지 않는다.
- 제육볶음(10인분, 판매가 12,000원): 재료비 **2,806.40원**, 순이익
  **4,046.69원 · 33.72%**
- 고정지출률: **31.3%**, 12,000원 메뉴 배분액 **3,756원**
- 세금: 판매가 × (Σ 매장 세금 항목 요율 ÷ 100). 요율은 퍼센트 포인트이며, 부가세도 항목 하나이고 빈 목록은 세금 0원이다.
  부가세 포함 가격의 요율은 `10/110 = 9.0909…%`다.
- 플랫폼·배달 수수료는 세금이 아니라 고정 지출에서만 관리한다.
- 판매 채널은 매장·배달·포장 3개 고정이다.

## 전파·원장 규칙

- 이벤트는 E1~E12이며 **E6은 없다**. 전체 뜻은 `ARCHITECTURE.md` §4가 단일 설명이다.
- `inventory_events`는 append-only이고 식재료별 합계가 `inventory_states.stock_total`과 같아야 한다.
- 입고 취소(E11)·판매 취소(E9)는 원장을 지우지 않고 반대 부호 이벤트를 쌓는다.
- 판매 저장(E10)은 판매 증가분만 E8로 소진하고 수량 감소분은 E9로 되돌린다. 같은 목표 수량 재호출은
  원장 이벤트를 추가하지 않는다.
- 판매가 부족해도 막지 않는다. 막는 것은 레시피의 명시적 `판매 중지`뿐이다.
- 영업 시작 부족은 `현재 재고 < 메뉴 1개 필요량`, 판매 부족은
  `현재 재고 < 판매 증가분 필요량`이다. 안전재고 미달과 판매 부족을 같은 판정으로 쓰지 않는다.
- 종료 영업일은 다시 열지 않는다. 정정 RPC가 판본을 검사하고 `business_day_revisions`에 전후를 남긴다.
- 설정 저장은 `settings.revision`을 되보내며, 무변경 저장은 판본·수정 시각을 올리지 않는다.

## 앱·디렉토리 규칙

- 앱 스택은 Expo SDK 54 · React 19 · React Native 0.81 · expo-router 6이다. pnpm과 루트
  `.npmrc`의 `node-linker=hoisted`를 유지해 RN/Metro 모듈 해석을 바꾸지 않는다.
- 하단 탭: **식재료 · 레시피 · 발주 · 매출관리 · MY** 5개. 화면 ID는 `ING-`, `RCP-`,
  `ORD-`, `SALES-`, `MY-`를 유지한다.
- 각 탭은 폴더와 `_layout.tsx`를 가지며 화면 자체 `AppHeader`를 사용한다.
- 화면은 Supabase를 직접 호출하지 않고 도메인 훅을 사용한다. 공유 쿼리 루트와 전파 이벤트별
  무효화 범위는 `apps/mobile/src/lib/queryClient.ts`가 소유하고 화면 전용 보조 키는 도메인 훅이 소유한다.
- 공용 논리 경계:
  - `features/business-day`: 서버 날짜·영업 상태
  - `features/settings`: 매장 설정
  - `features/master-data`: 카테고리·구매처·채널·부자재
  - `src/lib/date.ts`: 서버 날짜의 순수 산술
  - `src/lib/rpcValue.ts`: 느슨한 RPC 응답 숫자·문자열 변환
  - `components/history`: 이력 공통 UI
- 공용 경계가 화면 도메인을 역참조하거나 옛 경로 재수출 파일을 두지 않는다.
- 새 파생 공식은 `packages/core`에 추가하고 SQL과의 검산 시험을 동반한다.
- 전파/스키마 변경은 `packages/db/supabase/migrations`의 새 파일로 추가한다. 존재하지 않는
  `packages/db/sql/rpc` 경로를 만들지 않는다.

## 제품 표시 규칙

- 재고 상태는 **여유 / 소진 임박 / 소진** 3단계이고 `packages/core.stockStateOf`가 단일 판정처다.
  `stock_total <= 0`은 소진, 양수이면서 안전재고 이하 또는 `soon_out`이면 소진 임박이다.
- 음수 재고는 `−750g`처럼 그대로 빨간색으로 표시한다.
- 반제품은 1차 범위 밖이다. `recipe_lines_no_sub_recipe` 제약과 `save_recipe`가 입력을 막는다.
  읽기 쪽 재귀 코드를 근거로 기능을 추가하지 않는다.
- 표기 단위는 kg·g·ml와 개/모다. 포장 단위는 구매 옵션의 상품·용량 정보로 분리한다.
- 구매 옵션 표기는 `식재료명 · 용량 · 금액 / 구매처 · 단가` 순서를 유지한다.
- 리스트 헤더는 좌측 제목과 우측 검색/알림, 그 아래 좌측 정렬 밑줄 탭 패턴을 재사용한다.
- 디자인은 `apps/mobile/src/components/kit`과 `src/theme/tokens.ts`를 재사용한다.
  기본 primary는 `#3182F6`이며 새 화면이 임의의 두 번째 토큰 체계를 만들지 않는다.

## 검사 실행

필수 로컬 게이트:

```bash
corepack pnpm verify
```

실행 순서는 ① 타입 ② core·DB·mobile 시험 ③ ACL 셸 보안 ④ 새 DB 전체 migration·DB 스위트·
2세션 경합·locale parity ⑤ 업그레이드 경로 ⑥ 웹 번들이다. 건너뛴 단계가 있으면 전체 통과라고
표현하지 않는다.

솔라↔페이블 상호검수는 `corepack pnpm fable:review -- --task <TASK-ID> --round <N>`으로
별도 실행한다. 검수 원본을 삭제·덮어쓰지 않으며 `pnpm verify` 통과를 대신하지 않는다.

```bash
corepack pnpm verify --no-db
```

위 명령은 Docker DB가 없는 CI용 4/6 선택 범위다. GitHub Actions는 Node `20.19.4`와 `24`에서
이 범위를 실행한다. DB 전체 게이트의 CI 이전은 아직 P0-2다.

- 앱 시험은 `apps/mobile/tests/*.test.{ts,tsx}`의 vitest다.
- UI 시험은 react-native-web+jsdom으로 글자·접근성·상호작용을 재며 실제 번들은 ⑥이 확인한다.
- 새 DB: `bash packages/db/scripts/fresh-db.sh fresh_x`
- 중간 버전: `bash packages/db/scripts/fresh-db.sh --until <14자리> fresh_x`
- 경합: `node packages/db/tests/concurrency.mjs fresh_x` (커밋이 남으므로 fresh DB 전용)
- 업그레이드: `bash packages/db/scripts/upgrade-check.sh`
- 스키마 변경 후 `corepack pnpm db:types`로 `packages/db/src/database.types.ts`를 재생성한다.

## ACL·환경·배포

- `admin-acl.test.sh`는 verify ③에서 Docker 없이 비밀번호·argv·환경 격리를 검사한다.
- 로컬 fresh DB의 `supabase_admin` 기본 ACL은 스크립트가 fix/check한다.
- 호스티드 원격은 `admin-acl.sh --remote audit`으로 앱 롤 공격면을 먼저 읽기 전용 감사한다.
  `supabase_admin` 전환 불가여도 앱 ACL은 판정하되, 플랫폼 기본 권한은 별도 예외로 기록하고
  `supabase_admin ACL 통과`로 쓰지 않는다. 실제 운영 실행 전에는 원격 ACL 적용 완료로 보지 않는다.
- Supabase CLI v2 전환도 P1-2 미결정이다.
- 운영·스테이징에 적용된 migration은 불변이며 새 migration으로 전진 복구한다.
- 운영에는 `main`에 포함된 승인 이력만 적용한다. 로컬·스테이징·운영을 같은 DB로 쓰지 않는다.

## 작업 시

- 한국어로 응답한다. DB 식별자는 snake_case, TS 식별자는 camelCase를 사용한다.
- 기존 사용자 변경인 `.claude/settings.json`과 요청받지 않은 미추적 파일을 스테이징하지 않는다.
- 모든 작업은 최신 `main`의 짧은 브랜치에서 수행하고, 동일 SHA CI 완료 전에 `main`으로 옮기지 않는다.
- 설계 근거는 위 단일 출처 문서와 migration/시험의 실제 줄을 함께 확인한다.
