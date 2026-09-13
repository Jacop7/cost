import { useState } from 'react';
import { Pressable } from 'react-native';
import { COLOR } from '@/theme/tokens';
import { ActionSheet, type ActionSheetItem } from './ActionSheet';
import { Icon } from './Icon';

/** 헤더의 세로 더보기와 공통 행동 시트. */
export function HeaderOverflowAction({ label, items }: { label: string; items: ActionSheetItem[] }) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} aria-expanded={open}
      onPress={() => setOpen(true)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="more" size={19} color={COLOR.text.primary} />
    </Pressable>
    {open ? <ActionSheet floating visible onClose={() => setOpen(false)} items={items} /> : null}
  </>;
}
