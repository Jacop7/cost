import { QueryClient } from '@tanstack/react-query';

/** 전역 쿼리 클라이언트. 전파 RPC 후 관련 key 무효화로 화면 정합 유지. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

/** 쿼리 키 — 전파 이벤트 후 무효화 대상 매핑의 단일 출처. */
export const qk = {
  ingredients: ['ingredients'] as const,
  ingredient: (id: string) => ['ingredients', id] as const,
  candidates: ['orders', 'candidates'] as const,
  waiting: ['orders', 'waiting'] as const,
  recipes: ['recipes'] as const,
  recipe: (id: string) => ['recipes', id] as const,
  monthlyPL: (month: string) => ['monthly-pl', month] as const,
} as const;
