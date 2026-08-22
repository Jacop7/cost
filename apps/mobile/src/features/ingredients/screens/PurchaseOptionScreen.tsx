/**
 * ING-05 구매 링크 · 옵션 — 같은 재료를 어디서 얼마에 살 수 있는지.
 *
 * 이전 구현은 추가·수정·삭제 버튼이 셋 다 `safeBack()` 만 했다. 화면은 있는데 저장이 없었다.
 * 지금은 서버에 저장되고, 발주 화면이 이 값을 그대로 가져다 쓴다.
 *
 * ⚠ 절대원칙 2: 구매 옵션은 **가격 후보**일 뿐 기준단가를 바꾸지 않는다.
 *   기준단가는 실제 입고(E1) 이력의 가중평균이다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, Select } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';
import { displayToBase, formatQuantity, formatUnitPrice, isDisplayUnit } from '@sikjae/core';
import { safeBack } from '@/lib/nav';
import { clampByUnit, clampDecimals } from '@/lib/num';
import { UnitPickerSheet } from '../components/UnitPickerSheet';
import { VendorPickerSheet } from '../components/VendorPickerSheet';
import { dispUnit } from '../ledger';
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

  const [name, setName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [vol, setVol] = useState('');
  const [unit, setUnit] = useState<string>(base);
  const [amount, setAmount] = useState('');
  const [url, setUrl] = useState('');
  const [vendorOpen, setVendorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);

  // 기준단위가 정해지면 입력 단위 기본값도 그걸로 맞춘다.
  useEffect(() => { if (g) setUnit((u) => (u === 'g' && base !== 'g' ? base : u)); }, [g, base]);

  const editing = useMemo(() => g?.options.find((o) => o.id === editingId) ?? null, [g, editingId]);

  // 수정 진입 — 서버 값으로 폼을 채운다.
  useEffect(() => {
    if (!formOpen) return;
    if (editing) {
      setName(editing.name);
      setVendorId(editing.vendorId);
      setVendorName(editing.vendorName);
      setVol(String(editing.volume));
      setUnit(base);
      setAmount(String(editing.amount));
      setUrl(editing.url ?? '');
    }
  }, [formOpen, editing, base]);

  const openNew = () => {
    setEditingId(null);
    setName('');
    setVendorId(null);
    setVendorName(null);
    setVol('');
    setUnit(base);
    setAmount('');
    setUrl('');
    setFormOpen(true);
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
  const canSave = !nameError && !volError && !amountError && Boolean(ingredientId);

  const onSave = () => {
    if (!canSave || !ingredientId) return;
    saveOption.mutate(
      {
        id: editingId ?? undefined,
        ingredientId,
        name: name.trim(),
        vendorId,
        volume: volBase,
        amount: num(amount),
        url: url.trim() || null,
      },
      {
        onSuccess: () => setFormOpen(false),
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const confirmDelete = (id: string, label: string) => {
    Alert.alert(`${label} 삭제`, '이 구매 옵션만 지워지고 입고 기록은 남아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          deleteOption.mutate(id, {
            onSuccess: () => { if (editingId === id) setFormOpen(false); },
            onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
          }),
      },
    ]);
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
        <View style={{ paddingVertical: 48, paddingHorizontal: 32, alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, textAlign: 'center' }}>식재료를 먼저 저장해 주세요</Text>
          <Text style={{ fontSize: 14, color: T.sub2, textAlign: 'center', lineHeight: 20 }}>
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
        title={formOpen ? (editingId ? '구매 옵션 수정' : '구매 옵션 추가') : '구매 링크 · 옵션'}
        onBack={() => (formOpen ? setFormOpen(false) : safeBack(`/ingredients/${ingredientId}`))}
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
              <Field label="옵션 이름" req error={name !== '' ? nameError : undefined}>
                <Input value={name} onChangeText={setName} placeholder="예) 대파 1kg 박스" error={name !== '' && Boolean(nameError)} accessibilityLabel="옵션 이름" />
              </Field>

              <Field label="구매처">
                <Select value={vendorName ?? ''} placeholder="지정 안 함" onPress={() => setVendorOpen(true)} />
              </Field>

              <Field label="용량" req error={vol !== '' ? volError : undefined}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 2 }}>
                    <Input value={vol} onChangeText={(t) => setVol(clampByUnit(t, unit))} placeholder="0" mono keyboardType="decimal-pad" error={vol !== '' && Boolean(volError)} accessibilityLabel="용량" />
                  </View>
                  <Pressable
                    onPress={() => setUnitOpen(true)}
                    accessibilityRole="button" accessibilityLabel={`단위 ${unit} 변경`}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 }}
                  >
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink }}>{unit}</Text>
                    <Icon name="chevronDown" size={18} color={T.ter} />
                  </Pressable>
                </View>
              </Field>

              <Field label="금액" req error={amount !== '' ? amountError : undefined}>
                <Input value={amount} onChangeText={(t) => setAmount(clampDecimals(t, 0))} placeholder="0" suffix="원" mono keyboardType="number-pad" error={amount !== '' && Boolean(amountError)} accessibilityLabel="금액" />
              </Field>

              <Field label="구매 링크 (선택)">
                <Input value={url} onChangeText={setUrl} placeholder="https://" accessibilityLabel="구매 링크" />
              </Field>

            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
              {/*
                버튼 바로 위 한 줄 — 재고 추가 화면의 하단과 같은 짜임이다.
                고친 값이 단가를 어디로 옮기는지 누르기 직전에 보인다.
              */}
              {unitPrice !== null && Number.isFinite(unitPrice) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2, paddingBottom: 12 }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.sub }}>단가</Text>
                  {/* 값이 실제로 움직였을 때만 전후를 보여 준다. 같은 값을 두 번 쓰면 읽는 데 방해만 된다. */}
                  {prevUnitPrice !== null && Math.abs(prevUnitPrice - unitPrice) > 0.005 ? (
                    <>
                      <Text style={[{ fontSize: 14, color: T.ter }, tnum]}>{formatUnitPrice(prevUnitPrice, base)}</Text>
                      <Icon name="arrowRight" size={14} color={T.blue} sw={2.2} />
                    </>
                  ) : null}
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, tnum]}>
                    {formatUnitPrice(unitPrice, base)}
                  </Text>
                </View>
              ) : null}
              <Button kind="primary" size="lg" full disabled={!canSave} loading={saveOption.isPending} onPress={onSave}>
                {editingId ? '저장' : '추가'}
              </Button>
            </View>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 11 }} showsVerticalScrollIndicator={false}>
              {(g?.options.length ?? 0) === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, color: T.ter }}>등록된 구매 옵션이 없어요</Text>
                  <Text style={{ fontSize: 14, color: T.ter, textAlign: 'center' }}>자주 사는 곳과 용량·가격을 등록해 두면 발주가 빨라져요</Text>
                </View>
              ) : (
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  {g!.options.map((o, i) => {
                    const per = perOf(o.volume, o.amount);
                    const isLow = lowest !== null && per === lowest && g!.options.length > 1;
                    const isHigh = highest !== null && per === highest && g!.options.length > 1;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => { setEditingId(o.id); setFormOpen(true); }}
                        accessibilityRole="button" accessibilityLabel={`${o.name} 수정`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 72, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i < g!.options.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                      >
                        {/*
                          식재료 상세의 구매 옵션 줄과 **같은 짜임**이다.
                            동네마트  [최저]                200g
                            CJ 국물용 멸치              50.00원/g
                            10,000원
                          같은 것을 두 화면이 다르게 그리면 사장님은 다른 정보라고 읽는다.
                        */}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>
                            {o.brandName ?? o.vendorName ?? '구매처 미지정'}
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{o.name}</Text>
                          <Text style={[{ fontSize: 12, color: T.sub, fontWeight: '600', marginTop: 3 }, tnum]}>
                            {o.amount.toLocaleString('ko-KR')}원
                          </Text>
                        </View>
                        {/*
                          최저·최고는 **단가 쪽**에 붙는다 — 그 배지가 가리키는 게 단가다.
                          구매 이력(ING-09)도 같은 자리를 쓴다.
                        */}
                        <View style={{ alignItems: 'flex-end' }}>
                          <View style={{ height: 18, justifyContent: 'center' }}>
                            {isLow ? <Badge tone="blue" sm>최저</Badge> : isHigh ? <Badge tone="red" sm>최고</Badge> : null}
                          </View>
                          <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 2 }, tnum]}>
                            {formatQuantity(o.volume, base)}
                          </Text>
                          <Text style={[{ fontSize: 12, color: T.ter, fontWeight: '700', marginTop: 3 }, tnum]}>
                            {formatUnitPrice(per, base)}
                          </Text>
                        </View>
                        {o.url ? <Icon name="link" size={16} color={T.ter} /> : null}
                        <Icon name="chevron" size={16} color={T.line3} />
                      </Pressable>
                    );
                  })}
                </Card>
              )}

            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
              <Button kind="primary" size="lg" full onPress={openNew}>구매 옵션 추가</Button>
            </View>
          </>
        )}
      </QueryState>

      {/*
        헤더 ⋮ 메뉴 — 식재료 상세의 '수정' 메뉴와 **같은 모양**이다.
        같은 자리에서 같은 동작이 같은 모습으로 열려야 사장님이 두 번 배우지 않는다.
      */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} statusBarTranslucent>
        <Pressable onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="메뉴 닫기" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: T.scrim }}>
          {/* 시트 본문 탭이 배경까지 전달돼 닫히지 않게 여기서 삼킨다.
              빈 onPress 를 단 Pressable 로 막으면 스크린리더가 "버튼"이라고 읽는다 — View 로 처리한다. */}
          <View onStartShouldSetResponder={() => true} style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16 }}>
            <View style={{ alignItems: 'center', paddingBottom: 14 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: T.line }} />
            </View>
            <View style={{ backgroundColor: T.surface2, borderRadius: 14, overflow: 'hidden', marginBottom: 9 }}>
              <Pressable
                onPress={() => { setMenuOpen(false); if (editingId) confirmDelete(editingId, name || '이 옵션'); }}
                accessibilityRole="button" accessibilityLabel="구매 옵션 삭제"
                style={{ paddingVertical: 20, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: T.red }}>삭제</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="닫기" style={{ paddingVertical: 20, borderRadius: 14, backgroundColor: T.surface2, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink }}>닫기</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <VendorPickerSheet
        visible={vendorOpen}
        value={vendorId}
        onSelect={(vid, vname) => { setVendorId(vid); setVendorName(vname); }}
        onClose={() => setVendorOpen(false)}
      />
      <UnitPickerSheet visible={unitOpen} unit={unit} onSelect={(u) => { setUnit(u); setVol((p) => clampByUnit(p, u)); }} onClose={() => setUnitOpen(false)} />
    </View>
  );
}
