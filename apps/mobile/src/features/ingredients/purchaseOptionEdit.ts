import { displayToBase, isDisplayUnit } from '@margincook/core';
import { normalizePurchaseUrl } from './purchaseUrl';
import { convertUnitInput } from './unitInput';

/** Read model shared by the parser and editor without importing query hooks. */
export interface PurchaseOptionData {
  id: string; editRevision: string | null; url: string | null; name: string;
  volume: number; amount: number; vendorId: string | null; vendorName: string | null;
  /** 편집 UI가 없어도 서버에 있는 제조사·브랜드는 표시·보존한다. */
  brandId: string | null; brandName: string | null;
}
type BaseUnit = 'g' | 'ml' | 'ea';
type PurchaseOption = PurchaseOptionData;

/** RPC text is the authority; never round a bigint through a JS number. */
export function purchaseOptionRevision(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw)) return null;
  const max = '9223372036854775807';
  return raw.length < max.length || (raw.length === max.length && raw <= max) ? raw : null;
}
export type OptionDraft = {
  name: string; vendorId: string | null; vendorName: string | null;
  vol: string; unit: string; amount: string; url: string;
};
export type OptionBaseline = { option: PurchaseOption; baseUnit: BaseUnit };
export type OptionField = 'name' | 'vendor' | 'volume' | 'amount' | 'url';
export type OptionChoices = Partial<Record<OptionField, 'local' | 'latest'>>;
export const optionFields: { key: OptionField; label: string }[] = [
  { key: 'name', label: '옵션 이름' }, { key: 'vendor', label: '구매처' },
  { key: 'volume', label: '용량' }, { key: 'amount', label: '금액' }, { key: 'url', label: '구매 링크' },
];
const parse = (text: string) => Number(text.replace(/,/g, ''));
const baseValue = (option: PurchaseOption, key: OptionField): unknown => {
  if (key === 'vendor') return option.vendorId;
  if (key === 'url') return option.url === null ? null : normalizePurchaseUrl(option.url) ?? `invalid:${option.url}`;
  return key === 'name' ? option.name.trim() : option[key];
};
const localValue = (draft: OptionDraft, key: OptionField): unknown => {
  if (key === 'name') return draft.name.trim();
  if (key === 'vendor') return draft.vendorId;
  if (key === 'url') return normalizePurchaseUrl(draft.url) ?? `invalid:${draft.url}`;
  const text = key === 'volume' ? draft.vol : draft.amount;
  const n = parse(text);
  if (!text.trim() || !Number.isFinite(n) || n <= 0) return `invalid:${text}`;
  return key === 'volume' && isDisplayUnit(draft.unit) ? displayToBase(n, draft.unit) : n;
};
export function optionMergeFields(base: OptionBaseline, draft: OptionDraft, latest: PurchaseOption) {
  return optionFields.map(field => {
    const before = baseValue(base.option, field.key);
    const local = localValue(draft, field.key);
    const remote = baseValue(latest, field.key);
    const conflict = local !== before && remote !== before && local !== remote;
    return { ...field, conflict, useLatest: local === before || local === remote };
  });
}
export function optionDraftOf(option: PurchaseOption, baseUnit: BaseUnit): OptionDraft {
  return { name: option.name, vendorId: option.vendorId, vendorName: option.vendorName,
    vol: String(option.volume), unit: baseUnit === 'ea' ? '개' : baseUnit,
    amount: String(option.amount), url: option.url ?? '' };
}
export function mergeOptionDraft(base: OptionBaseline, draft: OptionDraft, latest: PurchaseOption, choices: OptionChoices): OptionDraft | null {
  const result = { ...draft };
  for (const field of optionMergeFields(base, draft, latest)) {
    if (field.conflict && !choices[field.key]) return null;
    const useLatest = field.conflict ? choices[field.key] === 'latest' : field.useLatest;
    if (!useLatest) continue;
    switch (field.key) {
      case 'name': result.name = latest.name; break;
      case 'vendor': result.vendorId = latest.vendorId; result.vendorName = latest.vendorName; break;
      case 'volume': result.vol = convertUnitInput(String(latest.volume), base.baseUnit === 'ea' ? '개' : base.baseUnit, draft.unit); break;
      case 'amount': result.amount = String(latest.amount); break;
      case 'url': result.url = latest.url ?? ''; break;
    }
  }
  return result;
}
export function optionFieldText(draft: OptionDraft, field: OptionField): string {
  switch (field) {
    case 'name': return draft.name;
    case 'vendor': return draft.vendorName ?? '구매처 미지정';
    case 'volume': return `${draft.vol}${draft.unit}`;
    case 'amount': return `${draft.amount}원`;
    case 'url': return draft.url || '링크 없음';
  }
}
