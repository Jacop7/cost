import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, EmptyDataText, Field, Icon, Input, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { COLOR, TYPE, T, iconSize, minTouchTarget, rowMinHeight, space } from '@/theme/tokens';
import { useStoreId } from '@/lib/SessionProvider';
import { newBundleUnitId, useBundleUnitActions, useBundleUnits, type BundleUnit } from '@/features/settings/bundleUnits';

export function BundleUnitManager() {
  const storeId = useStoreId();
  return <Manager key={storeId} />;
}
function Manager() {
  const query = useBundleUnits(); const { save, remove } = useBundleUnitActions();
  const [edit, setEdit] = useState<{ unit: BundleUnit; name: string; quantity: string; itemUnitName: string } | null>(null);
  const [deleting, setDeleting] = useState<BundleUnit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending;
  const invalid = !edit || !edit.itemUnitName.trim() || edit.itemUnitName.trim().length > 20 || /[\u0000-\u001f\u007f]/.test(edit.itemUnitName) || !edit.name.trim() || edit.name.trim().length > 20 || /[\u0000-\u001f]/.test(edit.name)
    || ['개', '모', 'g', 'kg', 'ml', 'l', 'ea'].includes(edit.name.trim().toLowerCase())
    || !/^\d+$/.test(edit.quantity) || Number(edit.quantity) < 1 || Number(edit.quantity) > 1_000_000;
  const begin = (unit?: BundleUnit) => {
    setError(null); setEdit({ unit: unit ?? { id: newBundleUnitId(), name: '', quantity: 0, itemUnitName: '개', revision: 0 }, name: unit?.name ?? '', quantity: unit ? String(unit.quantity) : '', itemUnitName: unit?.itemUnitName ?? '개' });
  };
  return <Card pad={0} style={{ marginBottom: space.lg, overflow: 'hidden' }}>
    <View style={{ padding: space.lg, gap: space.sm }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>묶음 단위</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>박스·판처럼 여러 개를 묶는 단위예요. 낱개 단위명은 개·모·병처럼 입력해요.</Text>
      {query.isLoading ? <Text>불러오는 중…</Text> : query.isError ? <>
        <Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>묶음 단위를 불러오지 못했어요.</Text>
        <Button kind="gray" onPress={() => void query.refetch()}>다시 불러오기</Button>
      </> : !query.data?.length ? <EmptyDataText>등록된 묶음 단위가 없어요.</EmptyDataText> : query.data.map((unit, index) => <View key={unit.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: rowMinHeight.twoLine, paddingVertical: space.sm, borderBottomWidth: index < query.data!.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
        <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
          <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{unit.name}</Text>
          <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{unit.quantity.toLocaleString()}{unit.itemUnitName}들이</Text>
        </View>
        <Pressable disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} accessibilityLabel={`${unit.name} 묶음 단위 수정`} onPress={() => begin(unit)} style={{ width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="edit" size={iconSize.md} color={busy ? COLOR.text.disabled : COLOR.text.tertiary} />
        </Pressable>
        <Pressable disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} accessibilityLabel={`${unit.name} 묶음 단위 삭제`} onPress={() => { setError(null); setDeleting(unit); }} style={{ width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={iconSize.md} color={busy ? COLOR.text.disabled : COLOR.text.tertiary} />
        </Pressable>
      </View>)}
      {error && !edit ? <Text role="alert" style={{ ...TYPE.caption, color: COLOR.status.negative }}>{error}</Text> : null}
    </View>
    <Button kind="tint" full icon="plus" presentation="cardFooter" disabled={busy || query.isLoading || query.isError} onPress={() => begin()}>묶음 단위 추가</Button>
    <Sheet visible={edit !== null} onClose={() => { if (!busy) setEdit(null); }} title={edit?.unit.revision ? '묶음 단위 수정' : '묶음 단위 추가'}>
      {edit ? <View style={{ gap: space.md }}>
        <Field label="묶음 단위명" req variant="stacked"><Input variant="stacked" value={edit.name} maxLength={20} placeholder="예: 박스·판" accessibilityLabel="묶음 단위 이름" disabled={busy} onChangeText={name => setEdit({ ...edit, name })} /></Field>
        <Field label="1묶음당 수량" req variant="stacked"><Input variant="stacked" value={edit.quantity} suffix={edit.itemUnitName.trim() || undefined} placeholder="예: 30" keyboardType="number-pad" accessibilityLabel="1묶음 수량" disabled={busy} onChangeText={quantity => setEdit({ ...edit, quantity: quantity.replace(/[^0-9]/g, '') })} /></Field>
        <Field label="낱개 단위명" req variant="stacked"><Input variant="stacked" value={edit.itemUnitName} maxLength={20} placeholder="예: 개·모·병" accessibilityLabel="낱개 단위명" disabled={busy} onChangeText={itemUnitName => setEdit({ ...edit, itemUnitName })} /></Field>
        <Text accessibilityLabel="묶음 단위 환산" style={{ ...TYPE.body, color: COLOR.text.primary }}>{`1${edit.name.trim() || '묶음'} = ${edit.quantity || '0'}${edit.itemUnitName.trim()}`}</Text>
        <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>수정한 수량은 새 입력부터 사용해요. 기존 입고·발주 기록은 바뀌지 않아요.</Text>
        {error ? <><Text role="alert" style={{ ...TYPE.caption, color: COLOR.status.negative }}>{error}</Text><Button kind="gray" disabled={busy} onPress={async () => { const r = await query.refetch(); const fresh = r.data?.find(x => x.id === edit.unit.id); if (fresh && !r.error) { setEdit({ unit: fresh, name: fresh.name, quantity: String(fresh.quantity), itemUnitName: fresh.itemUnitName }); setError(null); } }}>최신 값 불러오기</Button></> : null}
        <Button kind="primary" full disabled={invalid || busy} loading={save.isPending} onPress={() => save.mutate({ ...edit.unit, name: edit.name, itemUnitName: edit.itemUnitName, quantity: Number(edit.quantity) }, { onSuccess: () => { setEdit(null); setError(null); }, onError: e => setError(e.message) })}>저장</Button>
      </View> : null}
    </Sheet>
    <ConfirmDialog visible={deleting !== null} title="묶음 단위를 삭제하시겠습니까?" message="새 입력의 선택 목록에서 삭제해요. 기존 입고·발주 기록은 그대로예요." loading={remove.isPending}
      onCancel={() => { if (!busy) setDeleting(null); }} onConfirm={() => { if (deleting && !busy) remove.mutate(deleting, { onSuccess: () => { setDeleting(null); setError(null); }, onError: e => { setDeleting(null); setError(e.message); void query.refetch(); } }); }} />
  </Card>;
}
