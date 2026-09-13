import type { ReactNode } from 'react';
import { View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Card, Notice, ScrollTabs } from '@/components/kit';
import { formatNumber, formatPercent, formatQuantity, formatUnitPrice } from '@costkeep/core';
import { COMPONENT, T, space } from '@/theme/tokens';
import { useFixedCosts } from '@/features/my/hooks';
import type { PreviewRow } from '../draftPreviewContract';
import type { RecipeDraft } from '../draftStore';
import { sameCost, type PreviewCostDetails } from '../previewCostDetails';
import { recipeCostSections, useRecipeCostDisclosure, type RecipeCostSection } from '../useRecipeCostDisclosure';
import { RecipeDetailCostBody, type RecipeCostItem } from './RecipeDetailCostBody';
import { RecipeDetailHeading, RecipeDetailFooter } from './RecipeDetailParts';
import { useRecipeCostSettings } from '../useRecipeCostSettings';
import { combinedMaterialCost } from '../materialCost';

export type RecipeCostSource = Pick<RecipeDraft, 'lines' | 'extras' | 'baseServings'>;
const titles = { material: '재료', extra: '부자재', fixed: '고정 지출', tax: '세금' };
const empty = { material: '등록된 재료가 없습니다.', extra: '등록된 부자재가 없습니다.', fixed: '등록된 고정 지출이 없습니다.', tax: '빠지는 세금이 없어요.' };
const fixedNames: Record<string, string> = { labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료', packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타' };
type Props = {
  scope: string; row: PreviewRow | null; source?: RecipeCostSource; details?: PreviewCostDetails;
  money: (value: number | null) => string; sections?: readonly RecipeCostSection[]; exclusive?: boolean;
  currencyCode?: string;
  unavailable?: boolean;
  comparison?: 'one' | 'batch'; onComparisonChange?: (value: 'one' | 'batch') => void;
  fixedItems?: { key: string; total: number }[];
  onIngredientPress?: (index: number) => void; onExtraPress?: (index: number) => void;
  footers?: Partial<Record<RecipeCostSection, ReactNode>>;
};

/** The same disclosure body as menu detail; simulation quantity controls every card. */
export function RecipePreviewCostCards({ scope, row, source, details, money, sections = recipeCostSections,
  exclusive, currencyCode = 'KRW', unavailable = false, comparison, onComparisonChange, fixedItems, onIngredientPress, onExtraPress, footers }: Props) {
  const disclosure = useRecipeCostDisclosure(scope);
  const settings = useRecipeCostSettings();
  const router = useRouter();
  const presence = (section: RecipeCostSection) => section === 'fixed' ? settings.fixedPresence : section === 'tax' ? settings.taxPresence : 'configured';
  const servings = Number(source?.baseServings);
  const quantity = row?.servings ?? (comparison === 'batch' && servings > 0 ? servings : 1);
  const percent = (value: number | null) => value === null ? '산출 전' : row && row.listedTotal > 0 ? formatPercent(value / row.listedTotal) : '0%';
  const item = (key: string, label: string, amount: number | null, sub?: string): RecipeCostItem =>
    ({ key, label, sub, value: money(amount), secondary: percent(amount) });
  const lineAmounts = source?.lines.map(l => l.unitPrice !== null && servings > 0 ? l.inputQty / servings * l.unitPrice * quantity : null) ?? [];
  const extraAmounts = source?.extras.map(e => e.amountPerServing * quantity) ?? [];
  const matches = (values: (number | null)[], total: number | null) => values.every(v => v !== null) && sameCost(values.reduce<number>((sum, v) => sum + (v ?? 0), 0), total);
  const materialReady = !!row && matches(lineAmounts, row.material);
  const extraReady = !!row && matches(extraAmounts, row.extra);
  const items: Record<RecipeCostSection, RecipeCostItem[]> = {
    material: (source?.lines ?? []).map((l, i) => ({ ...item(String(i), l.name, !row ? 0 : source?.lines.length === 1 ? row.material : materialReady ? lineAmounts[i]! : null,
      servings > 0 ? `${formatQuantity(l.inputQty / servings * quantity, l.unit ?? '개')} · ${materialReady && l.unitPrice !== null && l.unit ? currencyCode === 'KRW' ? formatUnitPrice(l.unitPrice, l.unit) : `${money(l.unitPrice)}/${l.unit}` : l.unitPrice === null ? '단가 산출 전' : '단가 확인 전'}` : undefined),
      ...(onIngredientPress ? { onPress: () => onIngredientPress(i), accessibilityLabel: `${l.name} 재료 사용량 수정` } : {}) })),
    extra: (source?.extras ?? []).map((e, i) => ({ ...item(String(i), `${e.name}${e.qty * quantity !== 1 ? ` ×${formatNumber(e.qty * quantity, { digits: 4, group: '', decimal: '.' }).replace(/\.?0+$/, '')}` : ''}`, !row ? 0 : source?.extras.length === 1 ? row.extra : extraReady ? extraAmounts[i]! : null),
      ...(onExtraPress ? { onPress: () => onExtraPress(i), accessibilityLabel: `${e.name} 부자재 사용량 수정` } : {}) })),
    fixed: [],
    tax: unavailable ? [item('tax', '세금', null)] : !row ? [item('tax', '세금', 0)] : details?.taxItems ? details.taxItems.map((t, i) => item(String(i), t.name, t.amount * quantity)) :
      row?.tax ? [item('tax', '세금', row.tax)] : [],
  };
  // Missing source details must not disguise a nonzero authoritative total as an empty card.
  for (const section of ['material', 'extra'] as const) if (!items[section].length && row?.[section] !== 0 && row?.[section] !== undefined)
    items[section] = [item(section, titles[section], row[section])];
  items.material = [...items.material, ...items.extra.map(i => ({ ...i, key: `legacy-${i.key}` }))];
  const totalFor = (section: RecipeCostSection) => !row ? 0 : section === 'material' ? combinedMaterialCost(row.material, row.extra) : row[section];
  return <View style={{ gap: COMPONENT.stackedForm.fieldGap }}>
    {sections.filter(section => section !== 'extra').map(section => <Card key={section} pad={0} style={{ overflow: 'hidden' }}>
      <RecipeDetailHeading title={titles[section]} sub={section === 'tax' ? (exclusive ? '(판매가 별도)' : '(판매가 포함)') : undefined} />
      {presence(section) === 'configured' && comparison && onComparisonChange ? <View style={{ paddingTop: space.md, borderBottomWidth: 1, borderBottomColor: T.line }}>
        <ScrollTabs tabs={[`${servings > 0 ? servings : 1}인분`, '1인분']} active={comparison === 'batch' ? 0 : 1} onChange={i => onComparisonChange(i === 0 ? 'batch' : 'one')} />
      </View> : null}
      {presence(section) !== 'configured' ? null : section === 'fixed' ? <FixedBody row={row} details={details} fallback={fixedItems ?? settings.fixedData?.items} money={money} percent={percent}
        expanded={disclosure.expanded.fixed} onToggle={() => disclosure.toggle('fixed')} /> :
        <RecipeDetailCostBody title={titles[section]} items={items[section]} empty={empty[section]}
          total={{ value: money(totalFor(section)), secondary: percent(totalFor(section)) }}
          expanded={disclosure.expanded[section]} onToggle={() => disclosure.toggle(section)} />}
      {footers?.[section]}
      {(section === 'fixed' || section === 'tax') && !footers?.[section] ? <RecipeDetailFooter
        tone={presence(section) === 'empty' ? 'accent' : 'neutral'} icon={presence(section) === 'empty' ? 'plus' : 'chevron'}
        accessibilityLabel={`${titles[section]} ${presence(section) === 'unknown' ? '설정 다시 확인' : presence(section) === 'empty' ? '설정 추가' : '자세히 보기'}`}
        onPress={() => presence(section) === 'unknown' ? settings.retry() : router.push((section === 'tax' ? '/recipes/tax?settings=1' : presence(section) === 'empty'
          ? `/recipes/fixed-cost-edit?month=${settings.month}` : '/recipes/fixed-cost') as Href)}>
        {presence(section) === 'unknown' ? '설정 다시 확인' : presence(section) === 'empty' ? section === 'fixed' ? '고정 지출 추가' : '세율 적용' : '자세히 보기'}
      </RecipeDetailFooter> : null}
    </Card>)}
  </View>;
}

type FixedProps = Pick<Props, 'row' | 'details' | 'money'> & {
  fallback?: Props['fixedItems']; percent: (n: number | null) => string; expanded: boolean; onToggle: () => void;
};
function FixedBody(props: FixedProps) {
  return props.row && props.details?.fixedMonth ? <CurrentFixedBody {...props} /> : <FixedRows {...props} items={props.fallback} />;
}
function CurrentFixedBody(props: FixedProps) {
  const query = useFixedCosts(props.details!.fixedMonth);
  const data = query.data, basis = props.details!;
  const coherent = !query.isFetching && !query.error && data?.month === basis.fixedMonth && sameCost(data.totalRevenue, basis.fixedRevenue)
    && sameCost(data.items.reduce((sum, v) => sum + v.total, 0), basis.fixedTotal);
  return <FixedRows {...props} items={coherent ? data!.items : undefined} />;
}
function FixedRows({ row, items, money, percent, expanded, onToggle }: FixedProps & { items?: Props['fixedItems'] }) {
  const sum = items?.reduce((total, i) => total + i.total, 0) ?? 0;
  const total = row ? row.fixed : 0;
  const rows = items?.map(i => {
    const amount = !row ? 0 : total === null ? null : sum > 0 ? total * i.total / sum : total === 0 ? 0 : null;
    return { key: i.key, label: fixedNames[i.key] ?? i.key, value: money(amount), secondary: percent(amount) };
  }) ?? (!row || total !== 0 ? [{ key: 'fixed', label: '고정 지출', value: money(total), secondary: percent(total) }] : []);
  return <RecipeDetailCostBody title="고정 지출" items={rows} empty={empty.fixed} expanded={expanded} onToggle={onToggle}
    total={{ value: money(total), secondary: percent(total) }}
    notice={<Notice style={{ margin: space.md }}>가게의 월 고정 지출을 매출 비율로 나누어, 이 메뉴 {row?.servings ?? 1}인분에 들어가는 비용으로 환산한 금액입니다.</Notice>} />;
}
