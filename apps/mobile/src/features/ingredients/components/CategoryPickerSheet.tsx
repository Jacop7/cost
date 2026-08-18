// CategoryPickerSheet.tsx — 카테고리 선택 바텀시트 (추가·수정 공용)
//
// 목록은 매장에 등록된 실제 카테고리다. 고정 배열을 쓰면 마이페이지에서 카테고리를
// 추가해도 여기서 고를 수 없어 "추가는 되는데 쓸 수가 없는" 상태가 된다.
import { ScrollView, Text, View, Pressable } from 'react-native';
import { Sheet, Icon, QueryState } from '../../../components/kit';
import { T } from '../../../theme/tokens';
import { useSettingsLists } from '@/features/my/hooks';

export function CategoryPickerSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  /** 선택된 카테고리 id */
  value?: string | null;
  onSelect: (id: string, name: string) => void;
  onClose: () => void;
}) {
  const lists = useSettingsLists();
  const cats = lists.data?.categories ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} height={560} title="카테고리 선택">
      <QueryState
        isLoading={lists.isLoading}
        error={lists.error}
        isEmpty={cats.length === 0}
        onRetry={() => void lists.refetch()}
        emptyTitle="등록된 카테고리가 없어요"
        emptyHint="마이페이지 → 카테고리 설정에서 추가해 주세요"
      >
        <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 30, gap: 8 }} showsVerticalScrollIndicator={false}>
          {cats.map((c) => {
            const on = value === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => { onSelect(c.id, c.name); onClose(); }}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: on ? T.blueTint : T.surface,
                  borderWidth: 1,
                  borderColor: on ? T.blue : T.line,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink2 }}>{c.name}</Text>
                  {c.defaultLossRate > 0 ? (
                    <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>기본 로스율 {c.defaultLossRate}%</Text>
                  ) : null}
                </View>
                {on ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </QueryState>
    </Sheet>
  );
}
