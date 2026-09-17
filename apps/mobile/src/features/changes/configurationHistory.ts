import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, rpcError } from '@/lib/supabase';
import { useStoreId } from '@/lib/SessionProvider';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { rpcNumber } from '@/lib/rpcValue';
import { operationLabel, parseChangeClassification, type ChangeClassification } from './changeClassification';

export type ConfigurationKind = 'tax' | 'fixed_cost' | 'material';
export type FixedCostHistoryScope = 'all' | 'settings' | 'monthly';
export type FixedCostChangeType = 'initial_settings' | 'settings_basis' | 'settings_items' | 'monthly_input' | 'settings_reentry' | 'restore' | 'unknown';
export type FixedCostRevertBlocker = 'newer_change' | 'active_reentry' | 'not_latest' | 'state_mismatch' | 'unsupported' | string;
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): Obj[] => Array.isArray(v) ? v.map(obj) : [];
export type ConfigurationEvent = ChangeClassification & {
  id: string; applicationMode?: 'immediate' | 'next_business'; occurredAt: string; effectiveFrom: string | null; month: string | null;
  title: string; changes: { key: string; label: string; before: string; after: string }[];
  reentrySessionId: string | null; reversible: boolean;
  fixedCostType: FixedCostChangeType | null; affectedMonths: string[]; revertBlocker: FixedCostRevertBlocker | null;
  latestChangeId: string | null; revertedChangeId: string | null;
};
const labels: Record<string, string> = {
  country_code: '국가', region_code: '지역', currency_code: '통화', business_locale_code: '표시 언어', price_basis: '메뉴 가격 기준',
  default_treatment: '과세 상태', tax_mode: '세금 기준', total_revenue: '총 월매출', basis_months: '고정 지출 기준',
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료', packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};
const values: Record<string, string> = {
  'ko-KR': '한국어', 'en-US': '영어 (미국)', 'en-GB': '영어 (영국)', 'en-AU': '영어 (호주)', 'en-CA': '영어 (캐나다)', custom: '직접 설정',
  KR: '대한민국', US: '미국', GB: '영국', AU: '호주', CA: '캐나다',
  tax_inclusive: '부가세 포함', tax_exclusive: '부가세 미포함', included: '부가세 포함', separate: '부가세 미포함',
  taxable: '일반 과세', zero_rated: '0% 과세', exempt: '면세', merchant: '매장 직접 납부', marketplace: '플랫폼 대납', national: '국가', federal: '연방', state: '주', province: '주', local: '지역', primary: '기본 세금', additional: '추가 세금', total: '합계 입력', detail: '세부 항목 입력', hall: '매장', delivery: '배달', takeout: '포장', menu_price: '메뉴 가격',
};
const value = (v: unknown) => v == null ? '—' : values[String(v)] ?? String(v);
const canonical = (v: unknown): string => JSON.stringify(v && typeof v === 'object'
  ? Array.isArray(v) ? v.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, JSON.parse(canonical(item))]))
  : v ?? null);
const keyed = (entries: Obj[], key: string): boolean => entries.every(entry => typeof entry[key] === 'string' && entry[key] !== '')
  && new Set(entries.map(entry => entry[key])).size === entries.length;
const stableList = (v: unknown, key: string): Obj[] => { const entries = list(v); return keyed(entries, key) ? entries : []; };
type Difference = ConfigurationEvent['changes'][number];
function arrayDifference(key: string, label: string, before: Obj[], after: Obj[], display: (entry: Obj) => string): Difference[] {
  if (canonical(before) === canonical(after)) return [];
  const reordered = before.length === after.length && canonical(before.map(canonical).sort()) === canonical(after.map(canonical).sort());
  return [{ key: `${key}.${reordered ? 'order' : 'entries'}`, label: `${label}${reordered ? ' 순서' : ''}`,
    before: before.length ? before.map(display).join('\n') : '—', after: after.length ? after.map(display).join('\n') : '—' }];
}
function arrayDifferences(before: Obj, after: Obj): Difference[] {
  const changes: Difference[] = [];
  for (const [field, identity, label] of [['components', 'key', '세금 항목'], ['categories', 'code', '과세 카테고리'], ['items', 'key', '고정 지출 항목']] as const) {
    const a = list(before[field]), b = list(after[field]);
    if (!keyed(a, identity) || !keyed(b, identity)) {
      changes.push(...arrayDifference(field, label, a, b, canonical));
    } else if (a.length === b.length && canonical(a.map(entry => entry[identity]).sort()) === canonical(b.map(entry => entry[identity]).sort())
      && canonical(a.map(entry => entry[identity])) !== canonical(b.map(entry => entry[identity]))) {
      const name = (entry: Obj) => String(entry.name ?? labels[String(entry[identity])] ?? entry[identity]);
      const display = (entry: Obj) => [...a, ...b].some(other => other[identity] !== entry[identity] && name(other) === name(entry))
        ? `${name(entry)} [${String(entry[identity])}]` : name(entry);
      changes.push({ key: `${field}.order`, label: `${label} 순서`,
        before: a.map(display).join(' → '), after: b.map(display).join(' → ') });
    }
  }
  const money = (v: unknown) => v == null ? '—' : Number.isFinite(Number(v)) ? `${Number(v).toLocaleString('ko-KR')}원` : String(v);
  const originalText = (entry: Obj, fields: string[], display: string) => Object.keys(entry).some(key => !fields.includes(key)) ? canonical(entry) : display;
  changes.push(...arrayDifference('legacy', '세금 항목', list(before.tax_items), list(after.tax_items),
    entry => originalText(entry, ['name', 'rate'], `${String(entry.name ?? '—')} · ${entry.rate == null ? '—' : `${String(entry.rate)}%`}`)));
  const a = list(before.items), b = list(after.items);
  if (!keyed(a, 'key') || !keyed(b, 'key')) return changes;
  for (const key of new Set([...a, ...b].map(entry => String(entry.key)))) {
    changes.push(...arrayDifference(`fixed.${key}.lines`, `${labels[key] ?? key} 세부 항목`,
      list(a.find(entry => entry.key === key)?.lines), list(b.find(entry => entry.key === key)?.lines),
      entry => originalText(entry, ['name', 'amount'], `${String(entry.name ?? '—')} · ${money(entry.amount)}`)));
  }
  return changes;
}
function fields(raw: unknown) {
  const r = obj(raw); const result = new Map<string, { label: string; value: string }>();
  const add = (key: string, label: string, v: unknown, suffix = '') => result.set(key, { label, value: (suffix === '원' && v != null && Number.isFinite(Number(v)) ? Number(v).toLocaleString('ko-KR') : value(v)) + (v == null ? '' : suffix) });
  if ('material_id' in r) {
    // 사용자 입력 문자열은 국가·세금 enum 번역표를 거치지 않는다.
    const textField = (key: string, label: string, v: unknown) => result.set(key, { label, value: v == null ? '—' : String(v) });
    textField('material.name', '재료명', r.name);
    textField('material.category', '카테고리', r.category_name);
    add('material.cost', '단가', r.unit_cost, '원');
    textField('material.unit', '단위', r.unit_label);
    textField('material.memo', '메모', r.memo || null);
    if ('active' in r) add('material.active', '사용 상태', r.active === true ? '사용' : '삭제');
    return result;
  }
  if ('basis_months' in r) {
    const months = Number(r.basis_months);
    result.set('basis_months', { label: labels.basis_months!, value: Number.isInteger(months) ? `최근 ${months}개월 평균` : value(r.basis_months) });
  }
  for (const key of ['country_code','region_code','currency_code','business_locale_code','price_basis','default_treatment','tax_mode','total_revenue'])
    if (key in r) add(key, labels[key]!, r[key], key === 'total_revenue' ? '원' : '');
  stableList(r.components, 'key').forEach(c => {
    const key = `tax.${String(c.key)}`; const name = String(c.name ?? '세금');
    result.set(`${key}.name`, { label: '세금 항목명', value: c.name == null ? '—' : String(c.name) });
    add(`${key}.kind`, `${name} 종류`, c.kind); add(`${key}.rate`, `${name} 세율`, c.rate_pct, '%');
    add(`${key}.treatments`, `${name} 적용 과세 상태`, Array.isArray(c.applies_to_treatments) ? c.applies_to_treatments.map(value).join(' · ') : null);
    const owners = obj(c.remittance);
    for (const [channel, label] of [['hall','매장'],['delivery','배달'],['takeout','포장']] as const)
      add(`${key}.${channel}`, `${name} · ${label} 납부 주체`, owners[channel]);
    add(`${key}.basis`, `${name} 계산 기준`, c.calculation_basis === 'primary_tax_exclusive' ? '세금 제외 금액' : c.calculation_basis);
    add(`${key}.order`, `${name} 표시 순서`, c.sort_order);
    add(`${key}.jurisdiction`, `${name} 관할`, c.jurisdiction_level);
  });
  stableList(r.categories, 'code').forEach(c => { result.set(`category.${String(c.code)}.name`, { label: '과세 카테고리명', value: c.name == null ? '—' : String(c.name) }); add(`category.${String(c.code)}`, `${String(c.name)} 과세`, `${value(c.treatment)} · ${c.active ? '사용' : '미사용'}`); });
  stableList(r.items, 'key').forEach(c => {
    const name = String(c.label ?? labels[String(c.key)] ?? c.key); const prefix = `fixed.${String(c.key)}`;
    result.set(`${prefix}.label`, { label: '고정 지출 항목명', value: name });
    add(`${prefix}.mode`, `${name} 입력 방식`, c.mode);
    add(`${prefix}.allocation`, `${name} 배분 방식`, c.weights == null ? '매출 비율' : '직접 설정');
    add(`${prefix}.total`, `${name} 합계`, c.total, '원');
    for (const [key, weight] of Object.entries(obj(c.weights))) add(`${prefix}.weight.${key}`, `${name} · ${value(key)} 배분`, weight, '%');
  });
  stableList(r.months, 'month').forEach(monthRow => {
    const month = String(monthRow.month);
    const label = /^\d{4}-\d{2}$/.test(month) ? `${Number(month.slice(5))}월` : month;
    const exists = monthRow.exists !== false;
    add(`month.${month}.revenue`, `${label} 매출`, exists ? monthRow.total_revenue : null, '원');
    const monthItems = list(monthRow.items);
    const total = exists && monthItems.every(item => Number.isFinite(Number(item.total)))
      ? monthItems.reduce((sum, item) => sum + Number(item.total), 0) : null;
    add(`month.${month}.fixed`, `${label} 고정 지출`, total, '원');
  });
  return result;
}

/** Archived edits belong to the same migrated ingredient, with no inferred current status. */
export function useIngredientLegacyHistory(id?: string) {
  const storeId = useStoreId();
  return useInfiniteQuery({
    queryKey: [...qk.configurationHistory, storeId, 'ingredient-legacy', id], enabled: Boolean(storeId && id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('ingredient_legacy_material_history', {
        p_store: storeId!, p_ingredient: id!, p_cursor: pageParam ?? undefined,
      });
      if (error) throw rpcError(error);
      const r = obj(data);
      if (!Array.isArray(r.items) || typeof r.count !== 'number') throw new Error('통합 전 수정 내역을 확인하지 못했어요.');
      return { items: r.items.map(parseConfigurationEvent), count: r.count, nextCursor: typeof r.next_cursor === 'string' ? r.next_cursor : null };
    },
    getNextPageParam: page => page.nextCursor,
  });
}
export function parseConfigurationEvent(raw: unknown): ConfigurationEvent {
  const r = obj(raw);
  if (typeof r.id !== 'string' || typeof r.occurred_at !== 'string' || !r.after_value || !['fixed_cost','market','tax_profile','legacy_tax','material'].includes(String(r.source)))
    throw new Error('수정 내역 응답을 확인하지 못했어요.');
  const beforeValue = obj(r.before_value), afterValue = obj(r.after_value);
  // When either side lacks unique identities, compare the full collection on both
  // sides instead of inventing one-sided field deletions from the valid side.
  const beforeFields = { ...beforeValue }, afterFields = { ...afterValue };
  for (const [field, identity] of [['components', 'key'], ['categories', 'code'], ['items', 'key']] as const) {
    if (!keyed(list(beforeValue[field]), identity) || !keyed(list(afterValue[field]), identity)) {
      delete beforeFields[field]; delete afterFields[field];
    }
  }
  const before = fields(beforeFields), after = fields(afterFields);
  const changes = [...new Set([...before.keys(), ...after.keys()])].flatMap(key => {
    const a = before.get(key), b = after.get(key);
    return (a?.value ?? '—') === (b?.value ?? '—') ? [] : [{ key, label: b?.label ?? a!.label, before: a?.value ?? '—', after: b?.value ?? '—' }];
  });
  changes.push(...arrayDifferences(beforeValue, afterValue));
  const classification = parseChangeClassification(r);
  const fixedTypes: FixedCostChangeType[] = ['initial_settings','settings_basis','settings_items','monthly_input','settings_reentry','restore','unknown'];
  const fixedCostType = fixedTypes.includes(String(r.change_type) as FixedCostChangeType) ? String(r.change_type) as FixedCostChangeType : null;
  const affectedMonths = Array.isArray(r.affected_months) ? r.affected_months.filter((month): month is string => typeof month === 'string') : [];
  const subject = r.source === 'material' ? String(afterValue.name ?? beforeValue.name ?? '부자재')
    : r.source === 'fixed_cost' ? '고정 지출' : r.source === 'market' ? '가격·국가 기준' : '세금';
  const monthTitle = typeof r.month === 'string' && /^\d{4}-\d{2}$/.test(r.month) ? `${Number(r.month.slice(5))}월` : '월별';
  const fixedTitle = fixedCostType === 'initial_settings' ? '고정 지출 최초 설정'
    : fixedCostType === 'settings_basis' ? '계산 기간 변경'
      : fixedCostType === 'settings_items' ? '항목 구성 변경'
        : fixedCostType === 'settings_reentry' ? '항목 구성 변경'
          : fixedCostType === 'monthly_input' ? `${monthTitle} 입력 변경`
            : fixedCostType === 'restore' ? '이전 상태로 복구' : null;
  return { ...classification, id: r.id, ...(r.application_mode === 'immediate' || r.application_mode === 'next_business' ? { applicationMode: r.application_mode } : {}), occurredAt: r.occurred_at, effectiveFrom: typeof r.effective_from === 'string' ? r.effective_from : null,
    month: typeof r.month === 'string' ? r.month : null,
    title: typeof r.title === 'string' ? r.title : fixedTitle ?? `${subject} ${operationLabel(classification.operation)}`, changes,
    reentrySessionId: typeof afterValue.reentry_session_id === 'string' ? afterValue.reentry_session_id : null,
    reversible: r.reversible === true || afterValue.reentry_reversible === true,
    fixedCostType, affectedMonths,
    revertBlocker: typeof r.revert_blocker === 'string' ? r.revert_blocker : null,
    latestChangeId: typeof r.latest_change_id === 'string' ? r.latest_change_id : null,
    revertedChangeId: typeof r.reverted_change_id === 'string' ? r.reverted_change_id : null };
}
export function useConfigurationHistory(kind: ConfigurationKind, month?: string, scope: FixedCostHistoryScope = 'all') {
  const storeId = useStoreId();
  return useInfiniteQuery({
    queryKey: [...qk.configurationHistory, storeId, kind, scope, month ?? 'all'], enabled: Boolean(storeId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const request = kind === 'fixed_cost'
        ? supabase.rpc('fixed_cost_change_history', { p_store: storeId!, p_scope: scope, p_month: month, p_cursor: pageParam ?? undefined })
        : supabase.rpc('store_configuration_history', { p_store: storeId!, p_kind: kind, p_month: month, p_cursor: pageParam ?? undefined });
      const { data, error } = await request;
      if (error) throw rpcError(error);
      const r = obj(data);
      if (!Array.isArray(r.items) || typeof r.count !== 'number') throw new Error('수정 내역을 확인하지 못했어요.');
      const counts = obj(r.counts);
      return { items: r.items.map(parseConfigurationEvent), count: r.count,
        counts: { all: rpcNumber(counts.all ?? r.count), settings: rpcNumber(counts.settings), monthly: rpcNumber(counts.monthly) },
        hasPendingChange: r.has_pending_change === true, pendingOccurredAt: typeof r.pending_occurred_at === 'string' ? r.pending_occurred_at : null, nextCursor: typeof r.next_cursor === 'string' ? r.next_cursor : null };
    },
    getNextPageParam: page => page.nextCursor,
  });
}

/** 서버가 최신 사건과 실제 원자 범위를 다시 검사한 뒤 고정 지출 변경을 되돌린다. */
export function useRevertFixedCostReentry() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async ({ changeId, latestChangeId }: { changeId: string; latestChangeId: string }) => {
      const { data, error } = await supabase.rpc('revert_fixed_cost_change', {
        p_store: storeId!,
        p_change: Number(changeId),
        p_expected_latest_change: Number(latestChangeId),
      });
      if (error) throw rpcError(error);
      return data;
    },
    onSuccess: () =>
      invalidate(qc, [...invalidateOn.e4(), qk.storeSettings, qk.configurationHistory]),
  });
}
