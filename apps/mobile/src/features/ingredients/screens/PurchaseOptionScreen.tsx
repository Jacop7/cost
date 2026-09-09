/**
 * ING-06 구매 링크 · 옵션 — 같은 재료를 어디서 얼마에 살 수 있는지.
 *
 * 이전 구현은 추가·수정·삭제 버튼이 셋 다 `safeBack()` 만 했다. 화면은 있는데 저장이 없었다.
 * 지금은 서버에 저장되고, 발주 화면이 이 값을 그대로 가져다 쓴다.
 *
 * ⚠ 절대원칙 2: 구매 옵션은 **가격 후보**일 뿐 기준단가를 바꾸지 않는다.
 *   기준단가는 실제 입고(E1) 이력의 가중평균이다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheet, AppHeader, Button, Card, Field, Icon, Input, QueryState, Select } from '../../../components/kit';
import { COLOR, T, tnum, TYPE, space } from '../../../theme/tokens';
import { displayToBase, formatQuantity, formatUnitPrice, isDisplayUnit } from '@margincook/core';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals } from '@/lib/num';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { VendorPickerSheet } from '../components/VendorPickerSheet';
import { PurchaseOptionRow } from '../components/PurchaseOptionRow';
import { dispUnit } from '../ledger';
import { normalizePurchaseUrl } from '../purchaseUrl';
import { convertUnitInput, unitFamily } from '../unitInput';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { useDeletePurchaseOption, useIngredientDetail, useSavePurchaseOption } from '../hooks';

const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
export function PurchaseOptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ingredient?: string; option?: string }>();
  const ingredientId = params.ingredient;

  const detail = useIngredientDetail(ingredientId);
  const saveOption = useSavePurchaseOption();
  const deleteOption = useDeletePurchaseOption(ingredientId ?? '');

  const g = detail.data;
  const base = g ? dispUnit(g.baseUnit) : 'g';

  const [editingId, setEditingId] = useState<string | null>(params.option ?? null);
  const [formOpen, setFormOpen] = useState(Boolean(params.option));
  const currentEditingId = useRef(editingId);
  const hydratedOptionId = useRef<string | null>(null);
  const editorGeneration = useRef(0);
  const openEditor = (nextId: string | null) => {
    // 이벤트 안에서 갱신해야 effect 전에 도착한 이전 응답도 새 대상을 본다.
    currentEditingId.current = nextId;
    editorGeneration.current += 1;
    hydratedOptionId.current = null;
    setEditingId(nextId);
    setFormOpen(true);
  };
  const closeEditor = () => {
    editorGeneration.current += 1;
    hydratedOptionId.current = null;
    setFormOpen(false);
  };

  const [name, setName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [vol, setVol] = useState('');
  const [unit, setUnit] = useState<string>(base);
  const [amount, setAmount] = useState('');
  const [url, setUrl] = useState('');
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorStartAdding, setVendorStartAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const deleting = useRef(false);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const cardOption = g?.options.find(o => o.id === cardMenuId);
  const [unitOpen, setUnitOpen] = useState(false);

  // 기준단위가 정해지면 입력 단위 기본값도 그걸로 맞춘다.
  useEffect(() => { if (g) setUnit((u) => (u === 'g' && base !== 'g' ? base : u)); }, [g, base]);

  const editing = useMemo(() => g?.options.find((o) => o.id === editingId) ?? null, [g, editingId]);

  // 수정 진입/대상 변경 때만 채운다. 다른 옵션 삭제의 재조회가 편집 초안을 덮지 않는다.
  useEffect(() => {
    if (!formOpen || editingId === null) { hydratedOptionId.current = null; return; }
    if (editing) {
      if (hydratedOptionId.current === editing.id) return;
      hydratedOptionId.current = editing.id;
      setName(editing.name);
      setVendorId(editing.vendorId);
      setVendorName(editing.vendorName);
      setVol(String(editing.volume));
      setUnit(base);
      setAmount(String(editing.amount));
      setUrl(editing.url ?? '');
    }
  }, [formOpen, editingId, editing, base]);

  const openNew = () => {
    setName('');
    setVendorId(null);
    setVendorName(null);
    setVol('');
    setUnit(base);
    setAmount('');
    setUrl('');
    openEditor(null);
  };

  // 입력 단위(kg·L)를 기준단위로 환산한다 — 저장 직전 한 번(절대원칙 1).
  const volBase = isDisplayUnit(unit) ? displayToBase(num(vol), unit) : num(vol);

  /*
   * 이 옵션의 단가. 하단 바가 "얼마짜리를 저장하는지" 를 마지막으로 보여 준다.
   *
   * ⚠ 이건 **기준단가가 아니다.** 기준단가는 실제 입고의 가중평균이고 구매 옵션은
   *   건드리지 못한다(절대원칙 2). 여기에 '기준단가'라고 쓰면 사장님은 저장만 해도
   *   원가가 바뀐다고 읽는다 — 그건 사실이 아니다.
   */
  const unitPrice = volBase > 0 ? num(amount) / volBase : null;
  const prevUnitPrice = (() => {
    const o = editingId ? g?.options.find((x) => x.id === editingId) : undefined;
    return o && o.volume > 0 ? o.amount / o.volume : null;
  })();

  const nameError = name.trim() === '' ? '옵션 이름을 입력해 주세요' : undefined;
  const volError = volBase <= 0 ? '용량은 0보다 커야 해요' : undefined;
  const amountError = num(amount) <= 0 ? '금액을 입력해 주세요' : undefined;
  const normalizedUrl = normalizePurchaseUrl(url);
  const urlError = !normalizedUrl ? '올바른 구매 링크를 입력해 주세요 (예: example.com)' : undefined;
  const canSave = !!g && unitFamily(unit) === g.baseUnit && !nameError && !volError && !amountError && !!vendorId && !urlError && Boolean(ingredientId) && !saveOption.isPending;

  const onSave = () => {
    if (!canSave || !ingredientId) return;
    const submittedGeneration = editorGeneration.current;
    saveOption.mutate(
      {
        id: editingId ?? undefined,
        ingredientId,
        name: name.trim(),
        vendorId,
        volume: volBase,
        baseUnit: g?.baseUnit,
        amount: num(amount),
        url: normalizedUrl,
      },
      {
        // 같은 ID/신규 폼을 다시 열어도 이전 제출과는 다른 편집 세션이다.
        onSuccess: () => { if (editorGeneration.current === submittedGeneration) closeEditor(); },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const confirmDelete = (id: string, label: string) => {
    if (!deleting.current && !deleteOption.isPending) setDeleteTarget({ id, label });
  };

  // 최저·최고 단가 표시 — 어느 옵션이 유리한지 한눈에 보이게.
  const perOf = (volume: number, amt: number) => (volume > 0 ? amt / volume : Infinity);
  const pers = (g?.options ?? []).map((o) => perOf(o.volume, o.amount));
  const lowest = pers.length > 0 ? Math.min(...pers) : null;
  const highest = pers.length > 1 ? Math.max(...pers) : null;

  if (!ingredientId) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AppHeader title="구매 링크 · 옵션" onBack={() => safeBack('/ingredients')} />
        <View style={{ paddingVertical: 48, paddingHorizontal: 32, alignItems: 'center', gap: space.sm }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, textAlign: 'center' }}>식재료를 먼저 저장해 주세요</Text>
          <Text style={{ fontSize: 14, color: T.sub2, textAlign: 'center', lineHeight: TYPE.caption.lineHeight }}>
            구매 옵션은 식재료에 붙는 정보라 식재료가 있어야 등록할 수 있어요.
          </Text>
          <Button kind="primary" size="md" onPress={() => safeBack('/ingredients')}>돌아가기</Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={formOpen ? (editingId ? '구매 링크 수정' : '구매 링크 추가') : '구매 링크'}
        onBack={() => (formOpen ? closeEditor() : safeBack(`/ingredients/${ingredientId}`))}
        right={
          /* 수정 중일 때만 띄운다 — 아직 만들지도 않은 옵션에는 지울 게 없다. */
          formOpen && editingId ? (
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button" accessibilityLabel="더보기"
              hitSlop={6}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="more" size={20} color={T.ink2} />
            </Pressable>
          ) : undefined
        }
      />

      <QueryState
        isLoading={detail.isLoading}
        error={detail.error}
        isEmpty={detail.isFetched && !g}
        onRetry={() => void detail.refetch()}
        emptyTitle="식재료를 찾을 수 없어요"
      >
        {formOpen ? (
          <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              <Field label="링크 이름" variant="stacked" req error={name !== '' ? nameError : undefined}>
                <Input variant="stacked" value={name} onChangeText={setName} placeholder="예) 대파 1kg 박스" error={name !== '' && Boolean(nameError)} accessibilityLabel="옵션 이름" />
              </Field>

              <Field label="구매처" variant="stacked" req error={!vendorId ? '구매처를 선택해 주세요' : undefined}
                right={<Pressable accessibilityRole="button" accessibilityLabel="새 구매처 추가" onPress={() => { setVendorStartAdding(true); setVendorOpen(true); }}
                  style={{ marginLeft: 'auto', minHeight: 44, paddingHorizontal: space.xs, justifyContent: 'center' }}>
                  <Text style={{ ...TYPE.captionSm, fontWeight: '700', color: COLOR.text.link }}>＋ 새 구매처</Text>
                </Pressable>}>
                <Select variant="stacked" value={vendorId ? vendorName ?? '' : ''} placeholder="미선택" onPress={() => setVendorOpen(true)}
                  accessibilityLabel={`구매처 변경, ${vendorId ? vendorName ?? '지정 안 함' : '지정 안 함'}`} expanded={vendorOpen} />
              </Field>

              <Field label="용량" variant="stacked" req error={vol !== '' ? volError : undefined}>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Input variant="stacked" value={vol} onChangeText={(t) => setVol(clampByUnit(t, unit))} placeholder="0" mono keyboardType="decimal-pad" error={vol !== '' && Boolean(volError)} accessibilityLabel="용량" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Select variant="stacked" textAlign="right" value={unit} onPress={() => setUnitOpen(true)}
                      accessibilityLabel={`단위 ${unit} 변경`} expanded={unitOpen} />
                  </View>
                </View>
              </Field>

              <Field label="금액" variant="stacked" req error={amount !== '' ? amountError : undefined}>
                <Input variant="stacked" value={amount} onChangeText={(t) => setAmount(clampDecimals(t, 0))} placeholder="0" suffix="원" mono keyboardType="number-pad" error={amount !== '' && Boolean(amountError)} accessibilityLabel="금액" />
              </Field>

              <Field label="구매 링크" variant="stacked" req error={url !== '' ? urlError : undefined}>
                <Input variant="stacked" value={url} onChangeText={setUrl} placeholder="example.com" accessibilityLabel="구매 링크" />
              </Field>

            </ScrollView>

            <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
              {/*
                버튼 바로 위 단가 — 긴 값/큰 글자는 순서를 유지하며 다음 줄로 내린다.
                고친 값이 단가를 어디로 옮기는지 누르기 직전에 보인다.
              */}
              {unitPrice !== null && Number.isFinite(unitPrice) ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingHorizontal: 2, paddingBottom: 12 }}>
                  <Text style={{ fontSize: TYPE.caption.fontSize, fontWeight: '700', color: T.sub }}>단가</Text>
                  <View style={{ flex: 1 }} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm, maxWidth: '100%', marginLeft: 'auto' }}>
                  {/* 값이 실제로 움직였을 때만 전후를 보여 준다. 같은 값을 두 번 쓰면 읽는 데 방해만 된다. */}
                  {prevUnitPrice !== null && Math.abs(prevUnitPrice - unitPrice) > 0.005 ? (
                    <>
                      <Text style={[{ maxWidth: '100%', fontSize: 14, color: COLOR.text.tertiary }, tnum]}>{formatUnitPrice(prevUnitPrice, base)}</Text>
                    </>
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: '100%' }}>
                  {prevUnitPrice !== null && Math.abs(prevUnitPrice - unitPrice) > 0.005 ? <Icon name="arrowRight" size={14} color={COLOR.action.primary} sw={2.2} /> : null}
                  <Text style={[{ flexShrink: 1, fontSize: 16, fontWeight: '800', color: COLOR.text.accent }, tnum]}>
                    {formatUnitPrice(unitPrice, base)}
                  </Text>
                  </View>
                  </View>
                </View>
              ) : null}
              <Button kind="primary" size="md" full disabled={!canSave} loading={saveOption.isPending} onPress={onSave}>
                {editingId ? '저장' : '추가'}
              </Button>
            </View>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: space.md }} showsVerticalScrollIndicator={false}>
              {(g?.options.length ?? 0) === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, color: COLOR.text.tertiary }}>등록된 구매 옵션이 없어요</Text>
                  <Text style={{ fontSize: 14, color: COLOR.text.tertiary, textAlign: 'center' }}>자주 사는 곳과 용량·가격을 등록해 두면 발주가 빨라져요</Text>
                </View>
              ) : (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  {g!.options.map((o, i) => {
                    const per = perOf(o.volume, o.amount);
                    const isLow = lowest !== null && per === lowest && g!.options.length > 1;
                    const isHigh = highest !== null && per === highest && g!.options.length > 1;
                    return (
                      <PurchaseOptionRow
                        key={o.id}
                        onPress={() => setCardMenuId(o.id)} accessibilityLabel={`${o.name} 구매 링크 메뉴 열기`}
                        variant="management" last={i === g!.options.length - 1}
                        name={o.name} seller={o.brandName ?? o.vendorName ?? '구매처 미지정'}
                        amount={`${o.amount.toLocaleString('ko-KR')}원`} quantity={formatQuantity(o.volume, base)} unitPrice={formatUnitPrice(per, base)}
                        badge={isLow ? 'low' : isHigh ? 'high' : undefined} hasLink={Boolean(o.url)}
                      />
                    );
                  })}
                </Card>
              )}

            </ScrollView>

            <View style={{ paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: space.md, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
              <Button kind="primary" size="md" full onPress={openNew} accessibilityLabel="구매 옵션 추가">구매 링크 추가</Button>
            </View>
          </>
        )}
      </QueryState>

      {/*
        헤더 ⋮ 메뉴 — 식재료 상세의 '수정' 메뉴와 **같은 모양**이다.
        같은 자리에서 같은 동작이 같은 모습으로 열려야 사장님이 두 번 배우지 않는다.
      */}
      <ActionSheet
        floating
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[{
          label: '삭제',
          accessibilityLabel: '구매 옵션 삭제',
          danger: true,
          onPress: () => { if (editingId) confirmDelete(editingId, name || '이 옵션'); },
        }]}
      />
      <ActionSheet floating visible={!!cardOption} onClose={() => setCardMenuId(null)} items={[
        { label: '구매 링크 열기', onPress: () => {
          const link = normalizePurchaseUrl(cardOption?.url ?? '');
          if (!link) { Alert.alert('링크를 열 수 없어요', '올바른 구매 링크를 등록해 주세요.'); return; }
          void Linking.openURL(link).catch(() => Alert.alert('링크를 열 수 없어요', '주소를 확인한 뒤 다시 시도해 주세요.'));
        } },
        { label: '구매 링크 수정', onPress: () => { if (cardOption) openEditor(cardOption.id); } },
      ]} />
      <ConfirmDialog visible={deleteTarget !== null} title="구매 링크를 삭제할까요?"
        message={`${deleteTarget?.label ?? ''}\n이 구매 옵션만 지워지고 입고 기록은 남아요.`}
        confirmText="삭제" closeLabel="구매 링크 삭제 확인 닫기" loading={deleteOption.isPending}
        onCancel={() => setDeleteTarget(null)} onConfirm={() => {
          if (!deleteTarget || deleting.current || deleteOption.isPending) return;
          const { id } = deleteTarget;
          deleting.current = true;
          setDeleteTarget(null);
          deleteOption.mutate(id, {
            onSuccess: () => { deleting.current = false; if (currentEditingId.current === id) closeEditor(); },
            onError: e => { deleting.current = false; Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'); },
          });
        }} />

      <VendorPickerSheet
        visible={vendorOpen}
        startAdding={vendorStartAdding}
        allowAddAction={false}
        allowNone={false}
        value={vendorId}
        onSelect={(vid, vname) => { setVendorId(vid); setVendorName(vname); }}
        onClose={() => { setVendorOpen(false); setVendorStartAdding(false); }}
      />
      <UnitPickerSheet visible={unitOpen} unit={unit} base={base} onSelect={(u) => { setVol((p) => convertUnitInput(p, unit, u)); setUnit(u); }} onClose={() => setUnitOpen(false)} />
    </View>
  );
}
