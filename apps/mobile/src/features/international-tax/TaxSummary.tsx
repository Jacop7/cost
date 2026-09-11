import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/kit';
import { COLOR, TYPE, T, minTouchTarget, rowMinHeight, space, tnum } from '@/theme/tokens';

/** 레시피 판매 손익과 같은 제목·행·금액/비율 위계. 세금 계산은 상위 화면이 소유한다. */
export function TaxSummaryCard({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return <Card pad={0} style={{ overflow: 'hidden' }}>
    <View style={{ minHeight: minTouchTarget, paddingHorizontal: space.lg, paddingVertical: space.md,
      backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{title}</Text>
      {count !== undefined ? <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary }}>{count}개</Text> : null}
    </View>
    {children}
  </Card>;
}
export function TaxSummaryRow({ label, value, rate, last = false }: { label: string; value: string; rate?: string; last?: boolean }) {
  return <View style={{ minHeight: rowMinHeight.oneLine, paddingHorizontal: space.lg, paddingVertical: space.md,
    flexDirection: 'row', alignItems: 'center', gap: space.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
    <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1, minWidth: 0 }}>{label}</Text>
    <View style={{ alignItems: 'flex-end', maxWidth: '52%', flexShrink: 1 }}>
      <Text style={{ ...TYPE.body, ...tnum, color: COLOR.text.primary, textAlign: 'right' }}>{value}</Text>
      {rate ? <Text style={{ ...TYPE.captionSm, ...tnum, color: COLOR.text.tertiary, marginTop: space.xs, textAlign: 'right' }}>{rate}</Text> : null}
    </View>
  </View>;
}
