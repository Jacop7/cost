import { supabase } from '@/lib/supabase';

export interface OrderInboundDateEvent {
  id: string;
  seq: number;
  order_record_id: string | null;
  type: string;
  occurred_at: string;
  reverses_event_id: string | null;
}

/** 취소된 회차는 제외하고 남아 있는 입고 중 가장 최근 실제 발생일을 사용한다. */
export function latestOrderInboundDates(events: OrderInboundDateEvent[]): Map<string, string> {
  const reversed = new Set(events.flatMap(e => e.reverses_event_id ? [e.reverses_event_id] : []));
  // 기존 E11의 연결 없는 보정도 이전 입고 회차의 끝이다.
  const cycleEnds = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'adjust' && event.order_record_id)
      cycleEnds.set(event.order_record_id, Math.max(cycleEnds.get(event.order_record_id) ?? 0, event.seq));
  }
  const dates = new Map<string, string>();
  for (const event of events) {
    if (event.type !== 'inbound' || !event.order_record_id || reversed.has(event.id)) continue;
    if (event.seq <= (cycleEnds.get(event.order_record_id) ?? 0) || !Number.isFinite(Date.parse(event.occurred_at))) continue;
    const prior = dates.get(event.order_record_id);
    if (!prior || Date.parse(event.occurred_at) > Date.parse(prior)) dates.set(event.order_record_id, event.occurred_at);
  }
  return dates;
}

/** 읽기 전용 원장 조회. 발주일·예정일로 입고일을 추정하지 않는다. */
export async function readOrderInboundDates(storeId: string, orderIds: string[]): Promise<Map<string, string>> {
  const events: OrderInboundDateEvent[] = [];
  const ids = [...new Set(orderIds)];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from('inventory_events')
        .select('id,seq,order_record_id,type,occurred_at,reverses_event_id')
        .eq('store_id', storeId).in('order_record_id', batch)
        .order('seq', { ascending: true }).range(start, start + 499);
      if (error) throw new Error('입고 날짜를 확인하지 못했어요. 다시 시도해 주세요.');
      events.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
  }
  return latestOrderInboundDates(events);
}
