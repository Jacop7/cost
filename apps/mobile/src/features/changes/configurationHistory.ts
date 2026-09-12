import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase, rpcError } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';
import { qk } from '@/lib/queryClient';

export type ConfigurationKind = 'tax' | 'fixed_cost';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): Obj[] => Array.isArray(v) ? v.map(obj) : [];
export type ConfigurationEvent = {
  id: string; applicationMode?: 'immediate' | 'next_business'; occurredAt: string; effectiveFrom: string | null; month: string | null;
  title: string; changes: { key: string; label: string; before: string; after: string }[];
};
const labels: Record<string, string> = {
  country_code: '국가', region_code: '지역', currency_code: '통화', business_locale_code: '표시 언어', price_basis: '메뉴 가격 기준',
  default_treatment: '과세 상태', tax_mode: '세금 기준', total_revenue: '총 월매출',
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료', packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};
const values: Record<string, string> = {
  'ko-KR': '한국어', 'en-US': '영어 (미국)', 'en-GB': '영어 (영국)', 'en-AU': '영어 (호주)', 'en-CA': '영어 (캐나다)', custom: '직접 설정',
  KR: '대한민국', US: '미국', GB: '영국', AU: '호주', CA: '캐나다',
  tax_inclusive: '부가세 포함', tax_exclusive: '부가세 미포함', included: '부가세 포함', separate: '부가세 미포함',
  taxable: '일반 과세', zero_rated: '0% 과세', exempt: '면세', merchant: '매장 직접 납부', marketplace: '플랫폼 대납', national: '국가', federal: '연방', state: '주', province: '주', local: '지역', primary: '기본 세금', additional: '추가 세금', total: '합계 입력', detail: '세부 항목 입력', hall: '매장', delivery: '배달', takeout: '포장', menu_price: '메뉴 가격',
};
const value = (v: unknown) => v == null ? '—' : values[String(v)] ?? String(v);
function fields(raw: unknown) {
  const r = obj(raw); const result = new Map<string, { label: string; value: string }>();
  const add = (key: string, label: string, v: unknown, suffix = '') => result.set(key, { label, value: (suffix === '원' && v != null && Number.isFinite(Number(v)) ? Number(v).toLocaleString('ko-KR') : value(v)) + (v == null ? '' : suffix) });
  for (const key of ['country_code','region_code','currency_code','business_locale_code','price_basis','default_treatment','tax_mode','total_revenue'])
    if (key in r) add(key, labels[key]!, r[key], key === 'total_revenue' ? '원' : '');
  list(r.components).forEach(c => {
    const key = `tax.${String(c.key)}`; const name = String(c.name ?? '세금');
    add(`${key}.name`, '세금 항목명', c.name); add(`${key}.kind`, `${name} 종류`, c.kind); add(`${key}.rate`, `${name} 세율`, c.rate_pct, '%');
    add(`${key}.treatments`, `${name} 적용 과세 상태`, Array.isArray(c.applies_to_treatments) ? c.applies_to_treatments.map(value).join(' · ') : null);
    const owners = obj(c.remittance);
    for (const [channel, label] of [['hall','매장'],['delivery','배달'],['takeout','포장']] as const)
      add(`${key}.${channel}`, `${name} · ${label} 납부 주체`, owners[channel]);
    add(`${key}.basis`, `${name} 계산 기준`, c.calculation_basis === 'primary_tax_exclusive' ? '세금 제외 금액' : c.calculation_basis);
    add(`${key}.order`, `${name} 표시 순서`, c.sort_order);
    add(`${key}.jurisdiction`, `${name} 관할`, c.jurisdiction_level);
  });
  list(r.categories).forEach(c => { add(`category.${String(c.code)}.name`, '과세 카테고리명', c.name); add(`category.${String(c.code)}`, `${String(c.name)} 과세`, `${value(c.treatment)} · ${c.active ? '사용' : '미사용'}`); });
  list(r.tax_items).forEach((c,i) => { add(`legacy.${i}.name`, '세금 항목명', c.name); add(`legacy.${i}.rate`, `${String(c.name)} 요율`, c.rate, '%'); });
  list(r.items).forEach(c => {
    const name = labels[String(c.key)] ?? String(c.key); const prefix = `fixed.${String(c.key)}`;
    add(`${prefix}.mode`, `${name} 입력 방식`, c.mode);
    add(`${prefix}.allocation`, `${name} 배분 방식`, c.weights == null ? '매출 비율' : '직접 설정');
    add(`${prefix}.total`, `${name} 합계`, c.total, '원');
    list(c.lines).forEach((line,i) => { add(`${prefix}.${i}.name`, `${name} 세부 항목명`, line.name); add(`${prefix}.${i}.amount`, `${name} · ${String(line.name)}`, line.amount, '원'); });
    for (const [key, weight] of Object.entries(obj(c.weights))) add(`${prefix}.weight.${key}`, `${name} · ${value(key)} 배분`, weight, '%');
  });
  return result;
}
export function parseConfigurationEvent(raw: unknown): ConfigurationEvent {
  const r = obj(raw);
  if (typeof r.id !== 'string' || typeof r.occurred_at !== 'string' || !r.after_value || !['fixed_cost','market','tax_profile','legacy_tax'].includes(String(r.source)))
    throw new Error('수정 내역 응답을 확인하지 못했어요.');
  const before = fields(r.before_value), after = fields(r.after_value);
  const changes = [...new Set([...before.keys(), ...after.keys()])].flatMap(key => {
    const a = before.get(key), b = after.get(key);
    return a?.value === b?.value ? [] : [{ key, label: b?.label ?? a!.label, before: a?.value ?? '—', after: b?.value ?? '—' }];
  });
  return { id: r.id, ...(r.application_mode === 'immediate' || r.application_mode === 'next_business' ? { applicationMode: r.application_mode } : {}), occurredAt: r.occurred_at, effectiveFrom: typeof r.effective_from === 'string' ? r.effective_from : null,
    month: typeof r.month === 'string' ? r.month : null,
    title: changes.length === 0 && r.application_mode === 'immediate' ? '세금 적용 시점 변경' : r.source === 'fixed_cost' ? '고정 지출 수정' : r.source === 'market' ? '가격·국가 기준 수정' : '세금 수정', changes };
}
export function useConfigurationHistory(kind: ConfigurationKind, month?: string) {
  const storeId = useStoreId();
  return useInfiniteQuery({
    queryKey: [...qk.configurationHistory, storeId, kind, month ?? 'all'], enabled: Boolean(storeId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('store_configuration_history', { p_store: storeId, p_kind: kind, p_month: month, p_cursor: pageParam ?? undefined });
      if (error) throw rpcError(error);
      const r = obj(data);
      if (!Array.isArray(r.items) || typeof r.count !== 'number') throw new Error('수정 내역을 확인하지 못했어요.');
      return { items: r.items.map(parseConfigurationEvent), count: r.count, nextCursor: typeof r.next_cursor === 'string' ? r.next_cursor : null };
    },
    getNextPageParam: page => page.nextCursor,
  });
}
