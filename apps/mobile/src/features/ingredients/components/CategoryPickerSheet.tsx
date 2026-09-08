// CategoryPickerSheet.tsx — 카테고리 선택 바텀시트 (추가·수정 공용)
//
// 목록은 매장에 등록된 실제 카테고리다. 고정 배열을 쓰면 마이페이지에서 카테고리를
// 추가해도 여기서 고를 수 없어 "추가는 되는데 쓸 수가 없는" 상태가 된다.
import { ScrollView, Text, View, Pressable, Platform } from 'react-native';
import { Sheet, Icon, QueryState } from '../../../components/kit';
import { LAYOUT, COLOR, T, space } from '../../../theme/tokens';
import { useSettingsLists } from '@/features/master-data/hooks';

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
        <ScrollView contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: LAYOUT.scroll.end, gap: 8 }} showsVerticalScrollIndicator={false}>
          {cats.map((c) => {
            const on = value === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => { onSelect(c.id, c.name); onClose(); }}
                accessibilityRole="button"
                accessibilityLabel={Platform.OS === 'web' && on ? `${c.name}, 현재 선택됨` : c.name}
                accessibilityState={{ selected: on }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: space.md,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: on ? COLOR.action.primaryTint : T.surface,
                  borderWidth: 1,
                  borderColor: on ? COLOR.action.primary : T.line,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: on ? COLOR.state.selectedText : T.ink2 }}>{c.name}</Text>
                </View>
                {on ? <Icon name="check" size={17} color={COLOR.action.primary} sw={2.4} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </QueryState>
    </Sheet>
  );
}
