import { EmptyDataText } from '@/components/kit/EmptyDataText';
import { ReactNode } from 'react';
import { View } from 'react-native';
import { space } from '@/theme/tokens';

/** 빈 상태 (B7-1, ⑦ 6장). 유도 문구 + 액션 슬롯. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
      <EmptyDataText variant="title" style={{ textAlign: 'center' }}>{title}</EmptyDataText>
      {hint ? <EmptyDataText style={{ marginTop: space.sm, textAlign: 'center' }}>{hint}</EmptyDataText> : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}
