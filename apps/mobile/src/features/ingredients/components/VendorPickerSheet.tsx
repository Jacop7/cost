// VendorPickerSheet.tsx — 거래처 선택 바텀시트 (식재료·구매옵션·발주 공용)
//
// 목록에 없으면 여기서 바로 만들 수 있어야 한다. 발주를 넣다가 거래처가 없어서
// 마이페이지로 나갔다 돌아오면 입력하던 내용이 날아간다.
import { useState } from 'react';
import { Alert, ScrollView, Text, View, Pressable } from 'react-native';
import { Button, Icon, Input, Sheet, QueryState } from '../../../components/kit';
import { T } from '../../../theme/tokens';
import { useSaveVendor, useSettingsLists } from '@/features/my/hooks';

export function VendorPickerSheet({
  visible,
  value,
  onSelect,
  onClose,
  allowNone = true,
}: {
  visible: boolean;
  /** 선택된 거래처 id */
  value?: string | null;
  onSelect: (id: string | null, name: string | null) => void;
  onClose: () => void;
  allowNone?: boolean;
}) {
  const lists = useSettingsLists();
  const saveVendor = useSaveVendor();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const vendors = lists.data?.vendors ?? [];

  const add = () => {
    const n = name.trim();
    if (n === '') return;
    saveVendor.mutate(
      { name: n },
      {
        onSuccess: () => { setAdding(false); setName(''); },
        onError: (e) => Alert.alert('추가하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} height={560} title="거래처 선택">
      <QueryState
        isLoading={lists.isLoading}
        error={lists.error}
        isEmpty={false}
        onRetry={() => void lists.refetch()}
        emptyTitle=""
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 20, gap: 8 }} showsVerticalScrollIndicator={false}>
          {allowNone ? (
            <Pressable
              onPress={() => { onSelect(null, null); onClose(); }}
              accessibilityRole="button" accessibilityLabel="거래처 없음"
              accessibilityState={{ selected: !value }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16,
                borderRadius: 12, backgroundColor: !value ? T.blueTint : T.surface,
                borderWidth: 1, borderColor: !value ? T.blue : T.line,
              }}
            >
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: !value ? T.blue : T.ter }}>지정 안 함</Text>
              {!value ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
            </Pressable>
          ) : null}

          {vendors.map((v) => {
            const on = value === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => { onSelect(v.id, v.name); onClose(); }}
                accessibilityRole="button" accessibilityLabel={v.name}
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16,
                  borderRadius: 12, backgroundColor: on ? T.blueTint : T.surface,
                  borderWidth: 1, borderColor: on ? T.blue : T.line,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink2 }}>{v.name}</Text>
                  {v.usedCount > 0 ? <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>발주 {v.usedCount}건</Text> : null}
                </View>
                {on ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {adding ? (
          <View style={{ gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <Input value={name} onChangeText={setName} placeholder="거래처 이름" accessibilityLabel="새 거래처 이름" returnKeyType="done" onSubmitEditing={add} />
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => { setAdding(false); setName(''); }}>취소</Button></View>
              <View style={{ flex: 2 }}><Button kind="primary" size="lg" full loading={saveVendor.isPending} disabled={name.trim() === ''} onPress={add}>추가</Button></View>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button" accessibilityLabel="거래처 추가"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}
          >
            <Icon name="plus" size={18} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>거래처 추가</Text>
          </Pressable>
        )}
      </QueryState>
    </Sheet>
  );
}
