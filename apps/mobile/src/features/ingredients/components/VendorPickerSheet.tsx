// VendorPickerSheet.tsx — 거래처 선택 바텀시트 (식재료·구매옵션·발주 공용)
//
// 목록에 없으면 여기서 바로 만들 수 있어야 한다. 발주를 넣다가 거래처가 없어서
// 마이페이지로 나갔다 돌아오면 입력하던 내용이 날아간다.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, Platform } from 'react-native';
import { Button, ConfirmSheet, Icon, Input, Sheet, QueryState } from '../../../components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { COLOR, T, space } from '../../../theme/tokens';
import { useSaveVendor, useSettingsLists } from '@/features/master-data/hooks';

export function VendorPickerSheet({
  visible,
  value,
  onSelect,
  onClose,
  allowNone = true,
  startAdding = false,
  allowAddAction = true,
}: {
  visible: boolean;
  /** 선택된 거래처 id */
  value?: string | null;
  onSelect: (id: string | null, name: string | null) => void;
  onClose: () => void;
  allowNone?: boolean;
  startAdding?: boolean;
  allowAddAction?: boolean;
}) {
  const lists = useSettingsLists();
  const saveVendor = useSaveVendor();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  useEffect(() => { if (visible && (startAdding || !allowAddAction)) setAdding(startAdding); }, [visible, startAdding, allowAddAction]);

  const vendors = lists.data?.vendors ?? [];

  const add = () => {
    const n = name.trim();
    if (n === '') return;
    saveVendor.mutate(
      { name: n },
      {
        onSuccess: () => { setAdding(false); setName(''); },
        onError: (e) => setAddError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  return (
    <>
    {/* 오류를 확인하는 동안 두 시트를 겹치지 않는다. 입력·선택은 이 컴포넌트에 보존한다. */}
    <Sheet visible={visible && addError === null} onClose={onClose} height={!allowAddAction && adding ? undefined : 560} title={!allowAddAction && adding ? '새 구매처' : '구매처 선택'}>
      <QueryState
        isLoading={lists.isLoading}
        error={lists.error}
        isEmpty={false}
        onRetry={() => void lists.refetch()}
        emptyTitle=""
      >
        {(!adding || allowAddAction) ? <ScrollView contentContainerStyle={{ paddingBottom: space.lg }} showsVerticalScrollIndicator={false}>
          {allowNone ? (
            <SelectionRow label="지정 안 함" selected={!value} last={vendors.length === 0}
              onPress={() => { onSelect(null, null); onClose(); }}
              accessibilityLabel={Platform.OS === 'web' && !value ? '거래처 없음, 현재 선택됨' : '거래처 없음'}
            />
          ) : null}

          {vendors.map((v, i) => {
            const on = value === v.id;
            return (
              <SelectionRow label={v.name} selected={on} last={i === vendors.length - 1}
                description={`발주 ${v.usedCount}건`} labelStyle={{ fontWeight: '700', color: T.ink }}
                key={v.id}
                onPress={() => { onSelect(v.id, v.name); onClose(); }}
                accessibilityLabel={Platform.OS === 'web' && on ? `${v.name}, 현재 선택됨` : v.name}
              />
            );
          })}
        </ScrollView> : null}

        {adding ? (
          <View style={{ gap: space.sm, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <Input value={name} onChangeText={setName} placeholder="거래처 이름" accessibilityLabel="새 거래처 이름" returnKeyType="done" onSubmitEditing={add} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => { setAdding(false); setName(''); }}>취소</Button></View>
              <View style={{ flex: 1 }}><Button kind="primary" size="lg" full loading={saveVendor.isPending} disabled={name.trim() === ''} onPress={add}>추가</Button></View>
            </View>
          </View>
        ) : allowAddAction ? (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button" accessibilityLabel="거래처 추가"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.md, borderRadius: 12, borderWidth: 1, borderColor: COLOR.action.primary, backgroundColor: COLOR.action.primaryTint }}
          >
            <Icon name="plus" size={18} color={COLOR.action.primary} sw={2.2} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.text.link }}>거래처 추가</Text>
          </Pressable>
        ) : null}
      </QueryState>
    </Sheet>
    <ConfirmSheet
      visible={visible && addError !== null}
      title="추가하지 못했어요"
      message={addError ?? ''}
      confirmText="확인"
      cancelText="닫기"
      onCancel={() => setAddError(null)}
      onConfirm={() => setAddError(null)}
    />
    </>
  );
}
