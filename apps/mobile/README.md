# @margincook/mobile — Expo 앱

사장님용 Expo SDK 54 앱. React 19 · RN 0.81 · expo-router 6을 사용하며 하단 탭은
**식재료 · 레시피 · 발주 · 매출관리 · MY** 5개다.

## 구조

```text
app/
  (tabs)/                  expo-router 5탭과 화면 라우트
src/
  components/kit           공통 UI 킷
  components/history       재고·구매·폐기 이력 공통 레이아웃
  features/business-day    영업일·매장 날짜·상태 전이 공용 경계
  features/settings        매장 설정 공용 경계
  features/master-data     카테고리·구매처·채널·부자재 공용 경계
  features/{domain}        화면·시트·조회·저장 훅
  lib/date.ts              서버가 준 날짜의 순수 산술·표기
  lib/rpcValue.ts          RPC 응답의 공통 숫자·문자열 변환
  theme                    디자인 토큰
tests/                     vitest + jsdom 컴포넌트·계약·경계 시험
```

모든 주요 화면은 Supabase 실데이터와 연결돼 있다. 화면은 Supabase를 직접 부르지 않고 도메인 훅을
사용하며, 공유 쿼리 루트와 전파 이벤트별 무효화 범위는 `src/lib/queryClient.ts`가 소유한다. 화면 ID·라우트·구현 상태의
단일 출처는 [src/features/README.md](./src/features/README.md)다.

## 원칙

- 확정 계산은 DB RPC, 앱 미리보기는 `@margincook/core`를 사용한다.
- 저장은 구매단위·N인분 입력을 g/ml/개·1인분 기준으로 환산한 뒤 수행한다.
- 서버 날짜를 받기 전 기기 시계로 영업일을 추정하지 않는다.
- 재고 상태는 `@margincook/core`의 `stockStateOf` 한 곳에서 판정한다.
- 공용 논리 경계에서 화면 도메인을 역참조하지 않는다.
- 각 탭 폴더는 `_layout.tsx`를 가지며 자체 `AppHeader`를 사용한다.

## 환경

`.env.example`을 복사해 공개 가능한 로컬 Supabase URL과 anon/publishable key를 설정한다. DB 비밀번호나
service role은 앱 환경에 넣지 않는다.

```bash
cd apps/mobile
npx expo start
npx expo start --lan
npx expo start --tunnel
npx expo start --web
```

Node 하한은 루트 `package.json`의 `>=20.19.4`, pnpm은 `9.12.0`이다. 루트 `.npmrc`의
`node-linker=hoisted`를 유지한다.

## 검사

```bash
# 앱만 빠르게
corepack pnpm --filter @margincook/mobile typecheck
corepack pnpm --filter @margincook/mobile test

# 저장소 전체 6단계
corepack pnpm verify
```

UI 시험은 `react-native-web`과 jsdom으로 글자·접근성 이름·상호작용을 확인한다. 아이콘·차트 모양과
네이티브 노치 여백은 모듈 대역 때문에 직접 재지 않으며, 실제 번들 가능 여부는 전체 검증의 웹 번들이
확인한다.
