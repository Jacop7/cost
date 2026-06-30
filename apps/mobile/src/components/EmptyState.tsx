import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { space, T } from '@/theme/tokens';

/** 빈 상태 (B7-1, ⑦ 6장). 유도 문구 + 액션 슬롯. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: T.ink, textAlign: 'center' }}>{title}</Text>
      {hint ? <Text style={{ marginTop: space.sm, color: T.sub2, textAlign: 'center', lineHeight: 20 }}>{hint}</Text> : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}
