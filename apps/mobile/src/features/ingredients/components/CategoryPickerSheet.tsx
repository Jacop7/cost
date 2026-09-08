// CategoryPickerSheet.tsx — 카테고리 선택 바텀시트 (추가·수정 공용)
//
// 목록은 매장에 등록된 실제 카테고리다. 고정 배열을 쓰면 마이페이지에서 카테고리를
// 추가해도 여기서 고를 수 없어 "추가는 되는데 쓸 수가 없는" 상태가 된다.
import { Platform } from 'react-native';
import { Sheet, QueryState } from '../../../components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
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
          {cats.map((c, i) => {
            const on = value === c.id;
            return (
              <SelectionRow
                key={c.id}
                label={c.name}
                selected={on}
                last={i === cats.length - 1}
                onPress={() => { onSelect(c.id, c.name); onClose(); }}
                accessibilityLabel={Platform.OS === 'web' && on ? `${c.name}, 현재 선택됨` : c.name}
              />
            );
          })}
      </QueryState>
    </Sheet>
  );
}
