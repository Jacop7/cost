import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { COLOR, COMPONENT, T, space } from '@/theme/tokens';
import { ActionSheet } from './ActionSheet';
import { Icon } from './Icon';

/** 마스터 목록의 공통 행: 화살표 → 수정/삭제/닫기. 실제 변경은 호출한 화면이 담당한다. */
export function ManageItemRow({ name, children, onEdit, onDelete, onView, last = false, disabled = false }: {
  name: string; children: ReactNode; onEdit: () => void; onDelete?: () => void;
  onView?: () => void; last?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${name} 관리 메뉴 열기`}
      accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(true)}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: space.md,
        paddingVertical: 12, paddingHorizontal: COMPONENT.card.contentInset, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      <Icon name="chevron" size={18} color={COLOR.text.tertiary} />
    </Pressable>
    {open ? <ActionSheet floating visible onClose={() => setOpen(false)} items={[
      ...(onView ? [{ label: '자세히 보기', onPress: onView }] : []),
      { label: '수정', onPress: onEdit },
      ...(onDelete ? [{ label: '삭제', danger: true, onPress: onDelete }] : []),
    ]} /> : null}
  </>;
}
