/**
 * MY-11 구매처 — 추가·이름변경·삭제.
 *
 * 발주 이력이 있는 거래처는 지우지 않고 숨긴다(서버가 판단). 지우면 과거 발주에서
 * 거래처가 사라져 "어디서 샀는지 모르는 입고"가 남는다.
 *
 * 이름이 비슷한 거래처는 알려만 준다. 병합은 과거 발주의 귀속을 바꾸는 일이라
 * 자동으로 하면 안 되고, 사장님이 이름을 고쳐 정리하는 편이 안전하다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useDeleteVendor, useSaveVendor, useSettingsLists, type VendorRow } from '@/features/master-data/hooks';

/** 공백·기호를 지운 뒤 같으면 "비슷한 이름"으로 본다('대림유통' vs '대림 유통'). */
const key = (s: string) => s.replace(/[\s·\-()]/g, '').toLowerCase();

export default function MyVendorsScreen() {
  const lists = useSettingsLists();
  const saveVendor = useSaveVendor();
  const deleteVendor = useDeleteVendor();

  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const vendors = lists.data?.vendors ?? [];

  /** 비슷한 이름 묶음 — 2개 이상인 것만. */
  const dupes = useMemo(() => {
    const m = new Map<string, VendorRow[]>();
    for (const v of vendors) {
      const k = key(v.name);
      const arr = m.get(k);
      if (arr) arr.push(v);
      else m.set(k, [v]);
    }
    return [...m.values()].filter((g) => g.length > 1);
  }, [vendors]);

  const dupIds = new Set(dupes.flat().map((v) => v.id));

  const openAdd = () => { setEditing(null); setName(''); setOpen(true); };
  const openEdit = (v: VendorRow) => { setEditing(v); setName(v.name); setOpen(true); };

  const submit = () => {
    const n = name.trim();
    if (n === '') return;
    saveVendor.mutate(
      { id: editing?.id, name: n },
      {
        onSuccess: () => { setOpen(false); setEditing(null); },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const confirmDelete = (v: VendorRow) => {
    Alert.alert(
      `${v.name} 삭제`,
      v.usedCount > 0
        ? `발주 ${v.usedCount}건에 쓰인 거래처예요. 목록에서만 숨겨지고 과거 발주는 그대로 남아요.`
        : '목록에서 사라져요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteVendor.mutate(v.id, {
            onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
          }),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="구매처"
        onBack={() => safeBack('/my')}
        right={
          <Pressable onPress={openAdd} hitSlop={6} accessibilityRole="button" accessibilityLabel="구매처 추가" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} color={T.blue} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        {dupes.map((g) => (
          <View key={g.map((v) => v.id).join('-')} style={{ backgroundColor: '#FFF9F0', borderWidth: 1, borderColor: T.amberTint, borderRadius: 16, padding: 14, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="swap" size={20} color={T.amberText} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.amberText }}>비슷한 이름이 있어요</Text>
                <Text style={{ fontSize: 14, color: T.sub2, marginTop: 2 }}>
                  {g.map((v) => `'${v.name}'`).join(' · ')} — 같은 곳이면 이름을 맞춰 주세요
                </Text>
              </View>
            </View>
          </View>
        ))}

        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>구매처 {vendors.length}</Text>

        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={vendors.length === 0}
          onRetry={() => void lists.refetch()}
          emptyTitle="등록된 구매처가 없어요"
          emptyHint="오른쪽 위 + 로 추가하거나, 발주할 때 바로 만들 수 있어요"
        >
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {vendors.map((v, i) => (
              <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingLeft: 15, paddingRight: 10, borderBottomWidth: i < vendors.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: T.line2, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="store" size={20} color={T.sub2} />
                </View>
                <Pressable onPress={() => openEdit(v)} accessibilityRole="button" accessibilityLabel={`${v.name} 수정`} style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{v.name}</Text>
                    {dupIds.has(v.id) ? <Badge tone="amber" sm>중복?</Badge> : null}
                  </View>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>발주 {v.usedCount}건</Text>
                </Pressable>
                <Pressable onPress={() => openEdit(v)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${v.name} 이름 변경`} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="edit" size={18} color={T.ter} sw={2} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(v)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${v.name} 삭제`} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={19} color={T.ter} />
                </Pressable>
              </View>
            ))}
          </Card>
        </QueryState>
      </ScrollView>

      <Sheet visible={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? '구매처 이름 변경' : '구매처 추가'} height={340}>
        <Field label="이름" req>
          <Input value={name} onChangeText={setName} placeholder="예) 성동청과" accessibilityLabel="구매처 이름" returnKeyType="done" onSubmitEditing={submit} />
        </Field>
        {editing && editing.usedCount > 0 ? (
          <Text style={{ fontSize: 14, color: T.sub2, marginTop: -8, marginBottom: 12, lineHeight: 20 }}>
            이름을 바꾸면 과거 발주 {editing.usedCount}건의 표기도 함께 바뀌어요.
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => { setOpen(false); setEditing(null); }}>취소</Button></View>
          <View style={{ flex: 2 }}>
            <Button kind="primary" size="lg" full loading={saveVendor.isPending} disabled={name.trim() === ''} onPress={submit}>
              {editing ? '저장' : '추가'}
            </Button>
          </View>
        </View>
      </Sheet>
    </View>
  );
}
