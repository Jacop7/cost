/**
 * RCP-13 부자재 관리 (+ RCP-14 부자재 수정 시트) — 부자재 마스터 CRUD.
 *
 * 구매 단위(박스)로 입력하면 낱개 단가로 환산해 저장한다(절대원칙 1 — 저장 직전 1회 환산).
 * 여기서 단가를 고치면 이 부자재를 쓰는 **모든 메뉴의 원가**가 서버에서 함께 갱신된다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, FAB, Field, Icon, Input, QueryState, SearchBar, Select, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, COMPONENT, T, won, TYPE, controlVisualHeight, radius, space } from '@/theme/tokens';
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
  const editSession = useRef(0);
  useEffect(() => () => { editSession.current += 1; }, []);

  const closeEditor = () => {
    editSession.current += 1;
    setOpen(false); setEditing(null); setCatOpen(false);
  };

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
    editSession.current += 1;
    setEditing(null);
    setName(''); setCatId(null); setCatName('');
    setPerBox('1'); setBoxPrice(''); setUnitLabel('개');
    setOpen(true);
  };

  const openEdit = (m: MaterialRow) => {
    editSession.current += 1;
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
    const submittedSession = editSession.current;
    saveMaterial.mutate(
      {
        id: editing?.id,
        name: name.trim(),
        categoryId: catId,
        unitCost: unitPrice,
        unitLabel: unitLabel.trim() || '개',
      },
      {
        onSuccess: () => { if (submittedSession === editSession.current) closeEditor(); },
        onError: (e) => {
          if (submittedSession === editSession.current) Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
        },
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: LAYOUT.scroll.endWithFab }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2, marginBottom: space.md }}>등록된 부자재 {items.length}</Text>

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
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: COMPONENT.adjacentActions.gap, paddingVertical: 12, paddingLeft: space.md, paddingRight: space.sm, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Pressable onPress={() => openEdit(m)} hitSlop={{ top: 2, bottom: 2 }} accessibilityRole="button" accessibilityLabel={`${m.name} 수정`} style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ maxWidth: '100%', flexShrink: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{m.name}</Text>
                    {m.categoryName ? <Badge tone="neutral" sm>{m.categoryName}</Badge> : null}
                  </View>
                  <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 4, fontWeight: '600' }, NUM]}>
                    기준 단가 <Text style={{ color: T.ink, fontWeight: '700' }}>{won(m.unitCost)}원/{m.unitLabel}</Text>
                    {m.usedCount > 0 ? <Text style={{ color: COLOR.text.tertiary }}>  ·  메뉴 {m.usedCount}개</Text> : null}
                  </Text>
                </Pressable>
                <Pressable onPress={() => openEdit(m)} hitSlop={COMPONENT.adjacentActions.hitSlop} accessibilityRole="button" accessibilityLabel={`${m.name} 수정`} style={{ width: controlVisualHeight.sm, height: controlVisualHeight.sm, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="edit" size={18} color={COLOR.text.tertiary} sw={2} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(m)} hitSlop={COMPONENT.adjacentActions.hitSlop} accessibilityRole="button" accessibilityLabel={`${m.name} 삭제`} style={{ width: controlVisualHeight.sm, height: controlVisualHeight.sm, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={19} color={COLOR.text.tertiary} />
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
        onClose={closeEditor}
        title={editing ? '부자재 수정' : '부자재 추가'}
        sub="구매 단위로 입력하면 개당 단가가 자동 계산돼요"
        height={620}
      >
        <Field label="부자재명" req error={name !== '' ? nameError : undefined}>
          <Input value={name} onChangeText={setName} placeholder="예) 제육볶음 전용 소스팩" error={name !== '' && Boolean(nameError)} accessibilityLabel="부자재명" />
        </Field>
        <Field label="카테고리">
          <Select value={catName} placeholder="지정 안 함" accessibilityLabel={`카테고리 선택: ${catName || '지정 안 함'}`} expanded={catOpen} onPress={() => setCatOpen(true)} />
        </Field>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <View style={{ flexGrow: 1, flexBasis: 'auto', minWidth: '45%', maxWidth: '100%' }}>
            <Field label="구매 수량" req hint="박스로 사면 박스당 개수">
              <Input value={perBox} onChangeText={(t) => setPerBox(clampDecimals(t, 0))} placeholder="1" suffix={unitLabel} mono keyboardType="number-pad" accessibilityLabel="구매 수량" />
            </Field>
          </View>
          <View style={{ flexGrow: 1.3, flexBasis: 'auto', minWidth: '45%', maxWidth: '100%' }}>
            <Field label="구매 가격" req error={boxPrice !== '' ? priceError : undefined}>
              <Input value={boxPrice} onChangeText={(t) => setBoxPrice(clampDecimals(t, 0))} placeholder="0" suffix="원" mono keyboardType="number-pad" error={boxPrice !== '' && Boolean(priceError)} accessibilityLabel="구매 가격" />
            </Field>
          </View>
        </View>
        <Field label="단위 이름" hint="개 · 회 · 장 등">
          <Input value={unitLabel} onChangeText={setUnitLabel} placeholder="개" accessibilityLabel="단위 이름" maxLength={4} />
        </Field>

        {/* 단가 미리보기 */}
        <View style={{ backgroundColor: COLOR.action.primaryTint, borderWidth: 1, borderColor: COLOR.action.primary, borderRadius: 12, paddingVertical: space.md, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
            <Icon name="info" size={17} color={COLOR.action.primary} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.text.accent }}>단가 미리보기</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingTop: space.xs }}>
            <Text style={{ flexGrow: 1, maxWidth: '100%', fontSize: 14, fontWeight: '700', color: COLOR.text.accent }}>
              개당 단가 <Text style={{ fontWeight: '600', color: T.sub2 }}>({won(num(boxPrice))} ÷ {count})</Text>
            </Text>
            <Text style={[{ maxWidth: '100%', fontSize: 20, fontWeight: '800', color: COLOR.text.accent }, NUM]}>
              {won(unitPrice)}<Text style={{ fontSize: 14 }}>원/{unitLabel || '개'}</Text>
            </Text>
          </View>
        </View>

        {editing && editing.usedCount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: 12, paddingVertical: 12, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: COLOR.status.cautionTint }}>
            <Icon name="info" size={15} color={COLOR.status.caution} />
            <Text style={{ flex: 1, fontSize: 14, color: COLOR.status.caution, lineHeight: TYPE.caption.lineHeight }}>
              단가를 바꾸면 이 부자재를 쓰는 메뉴 {editing.usedCount}개의 원가도 함께 바뀌어요.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={closeEditor}>취소</Button></View>
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
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: catId === null ? COLOR.action.primary : T.line, backgroundColor: catId === null ? COLOR.action.primaryTint : T.surface }}
          >
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: catId === null ? COLOR.state.selectedText : COLOR.text.tertiary }}>지정 안 함</Text>
            {catId === null ? <Icon name="check" size={17} color={COLOR.action.primary} sw={2.4} /> : null}
          </Pressable>
          {(lists.data?.materialCategories ?? []).map((c) => {
            const on = catId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => { setCatId(c.id); setCatName(c.name); setCatOpen(false); }}
                accessibilityRole="button" accessibilityLabel={c.name} accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: on ? COLOR.action.primary : T.line, backgroundColor: on ? COLOR.action.primaryTint : T.surface }}
              >
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: on ? COLOR.state.selectedText : T.ink2 }}>{c.name}</Text>
                {on ? <Icon name="check" size={17} color={COLOR.action.primary} sw={2.4} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}
