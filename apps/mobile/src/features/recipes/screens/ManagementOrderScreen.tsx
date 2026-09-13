import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader, Button, QueryState } from '@/components/kit';
import { DragOrderList, type DragOrderItem } from '@/components/kit/DragOrderList';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { useDeactivateIngredient, useIngredientList } from '@/features/ingredients/hooks';
import { useDeactivateMaterial, useDeleteCategory, useReorderCategories, useSettingsLists } from '@/features/master-data/hooks';
import { orderItems, useItemOrder } from '@/features/master-data/useItemOrder';
import { useDeleteRecipe, useRecipeList } from '../hooks';
import { useBusinessDay } from '@/features/business-day/businessDay';
import { safeBack } from '@/lib/nav';
import { COLOR, T, space } from '@/theme/tokens';

type Kind = 'ingredient' | 'material' | 'recipe';
const itemLabel = (kind: Kind) => kind === 'recipe' ? '메뉴' : kind === 'ingredient' ? '재료' : '부자재';
type PageProps = {
  kind: Kind; category?: boolean; rows: DragOrderItem[]; isLoading: boolean; error: unknown;
  onRetry: () => void; onSave: (ids: string[]) => Promise<unknown>;
  onDelete?: (id: string) => Promise<unknown>;
};

export function ManagementOrderPage({ kind, category = false, rows, isLoading, error, onRetry, onSave, onDelete }: PageProps) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const busy = useRef(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState('');
  const available = rows.filter(row => !removed.includes(row.id));
  const ordered = orderItems(available, draft ?? available.map(row => row.id));
  const changed = ordered.some((row, index) => row.id !== available[index]?.id);
  const deleting = available.find(row => row.id === deleteId);
  const back = () => { if (!busy.current) safeBack(kind === 'recipe' ? '/recipes/manage' : kind === 'ingredient' ? '/recipes/ingredients' : '/recipes/materials'); };
  const save = async () => {
    if (busy.current || !changed || isLoading || error) return;
    busy.current = true; setSaving(true); setSaveError(false);
    try {
      await onSave(ordered.map(row => row.id));
      busy.current = false; back();
    } catch { setSaveError(true); }
    finally { busy.current = false; setSaving(false); setSaveConfirm(false); }
  };
  const deleteItem = async () => {
    if (busy.current || isLoading || error || !deleting || deleting.deleteBlocked || !onDelete) return;
    busy.current = true; setSaving(true); setDeleteResult('');
    try {
      await onDelete(deleting.id);
      setRemoved(previous => [...previous, deleting.id]);
      setDeleteId(null); setSaveError(false);
      setDeleteResult(`${deleting.name}을(를) 삭제했어요.`);
    } catch (reason) {
      setDeleteId(null);
      setDeleteResult(`${deleting.name}: ${reason instanceof Error ? reason.message : '삭제하지 못했어요. 다시 시도해 주세요.'}`);
    } finally { busy.current = false; setSaving(false); }
  };
  return <View style={{ flex: 1, backgroundColor: T.bg }}>
    <AppHeader title={`${itemLabel(kind)}${category ? ' 카테고리' : ' 목록'} 편집`} onBack={back} />
    <QueryState isLoading={isLoading} error={error} isEmpty={available.length === 0} onRetry={onRetry} emptyTitle="편집할 항목이 없어요">
      <DragOrderList rows={ordered} disabled={saving || !!error || isLoading}
        onChange={next => { setDraft(next.map(row => row.id)); setSaveError(false); }}
        onBlockedDelete={category ? id => { setDeleteResult(''); setDeleteId(id); } : undefined}
        onDelete={onDelete ? id => { setDeleteResult(''); setDeleteId(id); } : undefined} />
    </QueryState>
    <View style={{ marginTop: 'auto', padding: 16, gap: space.sm, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
      {saveError ? <Text accessibilityRole="alert" style={{ fontSize: 14, color: COLOR.status.negative }}>순서를 저장하지 못했어요. 다시 시도해 주세요.</Text> : null}
      {deleteResult ? <Text accessibilityRole="alert" style={{ fontSize: 14, color: COLOR.text.primary }}>{deleteResult}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button size="sm" kind="gray" style={{ flex: 1 }} disabled={saving} onPress={back}>취소</Button>
        <Button size="sm" style={{ flex: 1 }} disabled={!changed || isLoading || !!error} loading={saving} onPress={() => setSaveConfirm(true)}>저장</Button>
      </View>
    </View>
    {saveConfirm ? <ConfirmDialog visible title="저장하시겠습니까?" kind="primary"
      confirmText="저장" closeLabel="저장 확인 닫기" loading={saving}
      onCancel={() => { if (!busy.current) setSaveConfirm(false); }} onConfirm={() => void save()} /> : null}
    {deleting?.deleteBlocked ? <ConfirmDialog visible title="삭제할 수 없어요" kind="primary"
      message={`${deleting.name}\n${deleting.deleteBlocked}`}
      confirmText="확인" cancelText={null} closeLabel="삭제 안내 닫기"
      onCancel={() => setDeleteId(null)} onConfirm={() => setDeleteId(null)} />
      : deleting ? <ConfirmDialog visible title="삭제하시겠습니까?"
      message={`${deleting.name}\n${category ? '삭제 후 복구할 수 없어요.' : kind === 'recipe' ? '목록에서 사라져요. 과거 매출·재고·손익 기록은 유지돼요.' : kind === 'material' ? '목록에서 사라져요. 기존 메뉴에 연결된 부자재 금액은 유지돼요.' : '삭제 후 복구할 수 없어요. 과거 입고·판매 기록은 유지돼요.'}`}
      loading={saving} onCancel={() => { if (!busy.current) setDeleteId(null); }} onConfirm={() => void deleteItem()} /> : null}
  </View>;
}

function CategoryOrder({ kind }: { kind: Kind }) {
  const query = useSettingsLists();
  const reorder = useReorderCategories();
  const remove = useDeleteCategory();
  const categories = (kind === 'recipe' ? query.data?.recipeCategories : kind === 'ingredient' ? query.data?.categories : query.data?.materialCategories) ?? [];
  return <ManagementOrderPage kind={kind} category rows={categories.map(row => ({ ...row, deleteBlocked: row.usedCount > 0 ? `이 카테고리를 사용하는 ${itemLabel(kind)} ${row.usedCount}개가 있어요. 다른 카테고리로 옮긴 후 삭제해 주세요.` : undefined, detail: `${itemLabel(kind)} ${row.usedCount}개` }))}
    isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} onSave={ids => reorder.mutateAsync(ids)} onDelete={id => remove.mutateAsync(id)} />;
}
function IngredientOrder() {
  const query = useIngredientList();
  const order = useItemOrder('ingredient');
  const remove = useDeactivateIngredient();
  return <ManagementOrderPage kind="ingredient" rows={orderItems(query.data ?? [], order.ids).map(row => ({ ...row, detail: row.categoryName ?? undefined }))}
    isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} onSave={order.save} onDelete={id => remove.mutateAsync(id)} />;
}
function MaterialOrder() {
  const query = useSettingsLists();
  const order = useItemOrder('material');
  const remove = useDeactivateMaterial();
  return <ManagementOrderPage kind="material" rows={orderItems(query.data?.materials ?? [], order.ids).map(row => ({ ...row, detail: row.categoryName ?? undefined }))}
    isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} onSave={order.save} onDelete={id => remove.mutateAsync(id)} />;
}
function RecipeOrder() {
  const query = useRecipeList();
  const order = useItemOrder('recipe');
  const remove = useDeleteRecipe();
  const business = useBusinessDay();
  const blocked = business.isError || !business.data ? '영업 상태 확인 후 삭제할 수 있어요.'
    : business.data.status === 'open' || business.data.status === 'break' ? '영업 종료 후 삭제할 수 있어요.' : undefined;
  return <ManagementOrderPage kind="recipe" rows={orderItems(query.data ?? [], order.ids).map(row => ({ ...row,
    detail: row.categoryName ?? undefined, deleteBlocked: blocked ?? (!row.editRevision ? '메뉴 판본을 다시 확인해 주세요.' : undefined) }))}
    isLoading={query.isLoading} error={query.error} onRetry={() => { void query.refetch(); void business.refetch(); }} onSave={order.save}
    onDelete={id => {
      const revision = query.data?.find(row => row.id === id)?.editRevision;
      if (!revision) return Promise.reject(new Error('메뉴 판본을 다시 확인해 주세요.'));
      return remove.mutateAsync({ id, revision });
    }} />;
}
export default function ManagementOrderScreen() {
  const params = useLocalSearchParams<{ kind?: string; target?: string }>();
  const kind = params.kind === 'recipe' ? 'recipe' : 'ingredient';
  if (params.target === 'category') return <CategoryOrder key={kind} kind={kind} />;
  return kind === 'recipe' ? <RecipeOrder /> : <IngredientOrder />;
}
