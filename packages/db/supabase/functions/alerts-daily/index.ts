// ⚠ 2차 기능 — 알림 4종 (⑧ 9 이연 목록).
// 스케줄(pg_cron 또는 외부 스케줄러)로 매일 호출되는 Edge Function 골격.
//   1) 아침 요약 → ORD-01 후보 탭 딥링크
//   2) 입고 지연 → ORD-01 대기 탭
//   3) 단가 급등 → ING-02
//   4) 목표 미달 → RCP-02
// 1차에서는 비활성. 데이터(추이·후보·발주레코드)는 1차부터 쌓이므로 스키마 변경 없이 얹힌다.

import { serve } from 'https://deno.land/std/http/server.ts';

serve(async (_req) => {
  // TODO(2차): settings.alert_* ON 인 매장별로
  //   - 곧소진/안전재고 미달 후보 집계 → 푸시
  //   - expected_at < today 인 'ordered' 건 → 지연 푸시
  //   - 최근 price_trends 급등 → 푸시
  //   - profit_trends 목표 미달 → 푸시
  return new Response(JSON.stringify({ ok: true, note: '2차 미구현' }), {
    headers: { 'content-type': 'application/json' },
  });
});
