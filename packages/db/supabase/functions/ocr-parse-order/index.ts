// ⚠ 2차 기능 — 반수동 OCR 주문내역 등록 (F-07·08, ⑧ 9 이연).
// 캡처 이미지 1장 → 품목 다건 추출 → 식재료 매칭(별칭) → 확인 후 일괄 발주 등록(E7).
// 1차에서는 비활성. order_records.source='ocr' 경로만 스키마에 예약됨.

import { serve } from 'https://deno.land/std/http/server.ts';

serve(async (_req) => {
  // TODO(2차):
  //   1) Storage 업로드 이미지 수신
  //   2) OCR(외부 비전 API) → 라인 추출
  //   3) 식재료/구매처 별칭 매칭, 미매칭은 신규 등록 후보로
  //   4) 동일 캡처 중복 차단(해시)
  //   5) 확인된 라인 → e7_place_order 일괄 호출
  return new Response(JSON.stringify({ ok: true, note: '2차 미구현' }), {
    headers: { 'content-type': 'application/json' },
  });
});
