# @sikjae/mobile — Expo 앱

사장님용 모바일 앱. 하단 4탭(발주현황·식재료·레시피·마이페이지), expo-router 파일 기반 라우팅.

## 구조

```
app/                      # expo-router (라우팅 = 파일 트리)
├── _layout.tsx           # 루트: QueryClient + SafeArea
└── (tabs)/
    ├── _layout.tsx       # 하단 4탭
    ├── orders/           # ORD-
    ├── ingredients/      # ING-
    ├── recipes/          # RCP-
    └── my/               # MY-
src/
├── features/             # 탭별 기능 모듈 (screens·components·hooks) — README 참조
├── components/           # 공통 UI 킷 (Badge·EmptyState·…) — B0-3
├── lib/                  # supabase 클라이언트·RPC 래퍼·queryClient
└── theme/                # 디자인 토큰 (색·스페이싱·뱃지/추이 색)
```

## 원칙
- 계산은 `@sikjae/core`(미리보기) + 서버 RPC(확정). 앱은 입력 환산·표시·캐시 무효화 담당.
- 저장 직전 구매단위·N인분 → 기준단위·1인분 환산(`@sikjae/core/units`).

## 실행
```bash
cp .env.example .env      # Supabase URL/anon key 채우기
pnpm mobile start
```
