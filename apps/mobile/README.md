# @sikjae/mobile — Expo 앱 (SDK 54)

사장님용 모바일 앱. 하단 4탭(**식재료·레시피·발주·MY**), expo-router 파일 기반 라우팅.
React 19 · RN 0.81 · expo-router 6. 디자인은 kit 디자인 시스템(Toss/Cashnote 스타일, primary 블루).

## 구조

```
app/                      # expo-router (라우팅 = 파일 트리)
├── _layout.tsx           # 루트: QueryClient + SafeArea
├── index.tsx             # → /ingredients 리다이렉트
└── (tabs)/
    ├── _layout.tsx       # 하단 4탭 (식재료·레시피·발주·MY)
    ├── ingredients/      # ING-  (_layout=Stack)
    │   ├── index.tsx     #   ING-01 리스트
    │   ├── [id].tsx      #   ING-02 상세
    │   ├── add.tsx       #   ING-03 추가
    │   └── option.tsx    #   ING-05 구매 링크·옵션 추가
    ├── recipes/          # RCP-  (_layout=Stack, index 스캐폴드)
    ├── orders/           # ORD-  (_layout=Stack, index 스캐폴드)
    └── my/               # MY-   (_layout=Stack, index 스캐폴드)
src/
├── features/             # 탭별 기능 모듈 (screens·demoData) — features/README 참조
├── components/
│   ├── kit/              # 공통 UI 킷(RN 이식): Icon·Card·Button·Badge·StatusBadge·
│   │                     #   Chip·Stepper·Field·Input·Select·Row·PLRow·SegTabs·ScrollTabs·
│   │                     #   FAB·Stat·PeriodChip·AppHeader·Sheet·Donut·TrendChart
│   └── EmptyState.tsx
├── lib/                  # supabase 클라이언트·RPC 래퍼(e1~e5)·queryClient
└── theme/                # 디자인 토큰 (T 팔레트·STATUS·spacing·radius·cardShadow)
```

각 탭은 폴더 + `_layout.tsx`(Stack) 구조라야 탭 라우트명이 매칭된다(없으면 `ingredients/index`로 펼쳐져 탭바가 깨짐).

## 원칙
- 계산은 `@sikjae/core`(미리보기) + 서버 RPC(확정). 앱은 입력 환산·표시·캐시 무효화 담당.
- 저장 직전 구매단위·N인분 → 기준단위·1인분 환산(`@sikjae/core/units`).
- 화면은 자체 헤더(`AppHeader`)를 그리므로 Stack/Tabs 헤더는 숨김.

## 실행
```bash
cp .env.example .env                 # Supabase URL/anon key
npx expo start                       # Metro (QR → Expo Go SDK 54)
npx expo start --tunnel              # IP 무관 외부 접속(권장 — Wi-Fi IP 변동 대응)
npx expo start --web                 # 웹 브라우저 미리보기
```
> Node 24 + Expo CLI undici 버그로 시작 시 죽으면 `EXPO_OFFLINE=1` 우회(오프라인은 localhost 바인딩 → 폰은 터널/LAN 사용).
> Expo×pnpm 호환 위해 루트 `.npmrc`에 `node-linker=hoisted`.

## 현재 상태
식재료 탭(ING-01·02·03·05) 구현. 데이터는 데모(`src/features/ingredients/demoData.ts`).
레시피·발주·MY는 빈 상태 스캐폴드. Supabase 연동(쿼리·전파 RPC)은 다음 단계.
