/**
 * RCP-13 부자재 관리 (+ RCP-14 부자재 수정 시트) — 부자재 마스터 CRUD.
 *
 * 구매 단위(박스)로 입력하면 낱개 단가로 환산해 저장한다(절대원칙 1 — 저장 직전 1회 환산).
 * 여기서 단가를 고치면 이 부자재를 쓰는 **모든 메뉴의 원가**가 서버에서 함께 갱신된다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, FAB, Field, Icon, Input, QueryState, SearchBar, Select, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, won } from '@/theme/tokens';
import { clampDecimals } from '@/lib/num';
import {
  useDeactivateMaterial,
  useSaveMaterial,
  useSettingsLists,
  type MaterialRow,
} from '@/features/master-data/hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const num = (s: string) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

export default function MaterialManageScreen() {
  const lists = useSettingsLists();
  const saveMaterial = useSaveMaterial();
  const deactivate = useDeactivateMaterial();

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<MaterialRow | null>(null);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const [name, setName] = useState('');
  const [catId, setCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [perBox, setPerBox] = useState('1');
  const [boxPrice, setBoxPrice] = useState('');
  const [unitLabel, setUnitLabel] = useState('개');

  const items = useMemo(() => {
    const n = squash(query);
    return (lists.data?.materials ?? []).filter(
      (m) => n === '' || squash(m.name).includes(n) || squash(m.categoryName ?? '').includes(n),
    );
  }, [lists.data, query]);

  const openNew = () => {
    setEditing(null);
    setName(''); setCatId(null); setCatName('');
    setPerBox('1'); setBoxPrice(''); setUnitLabel('개');
    setOpen(true);
  };

  const openEdit = (m: MaterialRow) => {
    setEditing(m);
    setName(m.name);
    setCatId(m.categoryId);
    setCatName(m.categoryName ?? '');
    // 저장값은 낱개 단가다. 수정 화면에서는 1개 단위로 되돌려 보여준다.
    setPerBox('1');
    setBoxPrice(String(m.unitCost));
    setUnitLabel(m.unitLabel);
    setOpen(true);
  };

  const count = Math.max(1, num(perBox));
  const unitPrice = count > 0 ? Math.round(num(boxPrice) / count) : 0;

  const nameError = name.trim() === '' ? '부자재 이름을 입력해 주세요' : undefined;
  const priceError = num(boxPrice) < 0 ? '금액은 0 이상이어야 해요' : undefined;
  const canSave = !nameError && !priceError && !saveMaterial.isPending;

  const submit = () => {
    if (!canSave) return;
    saveMaterial.mutate(
      {
        id: editing?.id,
        name: name.trim(),
        categoryId: catId,
        unitCost: unitPrice,
        unitLabel: unitLabel.trim() || '개',
      },
      {
        onSuccess: () => { setOpen(false); setEditing(null); },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const confirmDelete = (m: MaterialRow) => {
    Alert.alert(
      `${m.name} 삭제`,
      m.usedCount > 0
        ? `이 부자재를 쓰는 메뉴가 ${m.usedCount}개 있어요. 목록에서만 사라지고 기존 메뉴의 금액은 그대로 남아요.`
        : '목록에서 사라져요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () =>
            deactivate.mutate(m.id, {
              onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
            }),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="부자재 관리" onBack={() => safeBack('/my/categories')} />
      <SearchBar value={query} onChange={setQuery} placeholder="부자재 이름으로 검색" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2, marginBottom: 11 }}>등록된 부자재 {items.length}</Text>

        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={items.length === 0}
          onRetry={() => void lists.refetch()}
          emptyTitle={query ? `'${query}' 검색 결과가 없어요` : '등록된 부자재가 없어요'}
          emptyHint="포장용기·소스팩처럼 메뉴에 딸려 나가는 것들을 등록해 주세요"
        >
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {items.map((m, i) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 14, paddingRight: 10, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Pressable onPress={() => openEdit(m)} accessibilityRole="button" accessibilityLabel={`${m.name} 수정`} style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{m.name}</Text>
                    {m.categoryName ? <Badge tone="neutral" sm>{m.categoryName}</Badge> : null}
                  </View>
                  <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 4, fontWeight: '600' }, NUM]}>
                    기준 단가 <Text style={{ color: T.ink, fontWeight: '700' }}>{won(m.unitCost)}원/{m.unitLabel}</Text>
                    {m.usedCount > 0 ? <Text style={{ color: T.ter }}>  ·  메뉴 {m.usedCount}개</Text> : null}
                  </Text>
                </Pressable>
                <Pressable onPress={() => openEdit(m)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${m.name} 수정`} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="edit" size={18} color={T.ter} sw={2} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(m)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${m.name} 삭제`} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={19} color={T.ter} />
                </Pressable>
              </View>
            ))}
          </Card>
        </QueryState>
      </ScrollView>

      <FAB label="부자재 추가" onPress={openNew} />

      {/* RCP-14 부자재 수정 */}
      <Sheet
        visible={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing ? '부자재 수정' : '부자재 추가'}
        sub="구매 단위로 입력하면 개당 단가가 자동 계산돼요"
        height={620}
      >
        <Field label="부자재명" req error={name !== '' ? nameError : undefined}>
          <Input value={name} onChangeText={setName} placeholder="예) 제육볶음 전용 소스팩" error={name !== '' && Boolean(nameError)} accessibilityLabel="부자재명" />
        </Field>
        <Field label="카테고리">
          <Select value={catName} placeholder="지정 안 함" onPress={() => setCatOpen(true)} />
        </Field>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="구매 수량" req hint="박스로 사면 박스당 개수">
              <Input value={perBox} onChangeText={(t) => setPerBox(clampDecimals(t, 0))} placeholder="1" suffix={unitLabel} mono keyboardType="number-pad" accessibilityLabel="구매 수량" />
            </Field>
          </View>
          <View style={{ flex: 1.3 }}>
            <Field label="구매 가격" req error={boxPrice !== '' ? priceError : undefined}>
              <Input value={boxPrice} onChangeText={(t) => setBoxPrice(clampDecimals(t, 0))} placeholder="0" suffix="원" mono keyboardType="number-pad" error={boxPrice !== '' && Boolean(priceError)} accessibilityLabel="구매 가격" />
            </Field>
          </View>
        </View>
        <Field label="단위 이름" hint="개 · 회 · 장 등">
          <Input value={unitLabel} onChangeText={setUnitLabel} placeholder="개" accessibilityLabel="단위 이름" maxLength={4} />
        </Field>

        {/* 단가 미리보기 */}
        <View style={{ backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 }}>
            <Icon name="info" size={17} color={T.blue} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>단가 미리보기</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.blue }}>
              개당 단가 <Text style={{ fontWeight: '600', color: T.sub2 }}>({won(num(boxPrice))} ÷ {count})</Text>
            </Text>
            <Text style={[{ fontSize: 20, fontWeight: '800', color: T.blue }, NUM]}>
              {won(unitPrice)}<Text style={{ fontSize: 14 }}>원/{unitLabel || '개'}</Text>
            </Text>
          </View>
        </View>

        {editing && editing.usedCount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: T.amberTint }}>
            <Icon name="info" size={15} color={T.amberText} />
            <Text style={{ flex: 1, fontSize: 14, color: T.amberText, lineHeight: 20 }}>
              단가를 바꾸면 이 부자재를 쓰는 메뉴 {editing.usedCount}개의 원가도 함께 바뀌어요.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => { setOpen(false); setEditing(null); }}>취소</Button></View>
          <View style={{ flex: 2 }}>
            <Button kind="primary" size="lg" full disabled={!canSave} loading={saveMaterial.isPending} onPress={submit}>
              {editing ? '저장' : '추가'}
            </Button>
          </View>
        </View>
      </Sheet>

      {/* 부자재 카테고리 선택 */}
      <Sheet visible={catOpen} onClose={() => setCatOpen(false)} title="부자재 카테고리" height={460}>
        <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => { setCatId(null); setCatName(''); setCatOpen(false); }}
            accessibilityRole="button" accessibilityLabel="지정 안 함"
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: catId === null ? T.blue : T.line, backgroundColor: catId === null ? T.blueTint : T.surface }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: catId === null ? T.blue : T.ter }}>지정 안 함</Text>
            {catId === null ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
          </Pressable>
          {(lists.data?.materialCategories ?? []).map((c) => {
            const on = catId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => { setCatId(c.id); setCatName(c.name); setCatOpen(false); }}
                accessibilityRole="button" accessibilityLabel={c.name} accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
              >
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink2 }}>{c.name}</Text>
                {on ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}
