import { Text, View } from 'react-native';
import { Field } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE, radius, tnum } from '@/theme/tokens';

/** 재고 수정 공용 결과: 라벨은 박스 위, 수치는 오른쪽·이름은 왼쪽 정렬. */
export function StockResultField({ label, value, negative = false, tone = 'neutral', accessibilityLabel, align = 'right' }: {
  label: string; value: string; negative?: boolean; tone?: 'neutral' | 'danger'; accessibilityLabel?: string; align?: 'left' | 'right';
}) {
  const textColor = negative || tone === 'danger' ? COLOR.status.negative : T.ink;
  return <Field label={label} variant="stacked">
    <View accessibilityLabel={accessibilityLabel} style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal,
      justifyContent: 'center', borderWidth: 1, borderColor: COMPONENT.input.border.default, borderRadius: radius.md, backgroundColor: T.line }}>
      <Text style={[{ ...TYPE.body, fontWeight: '800', textAlign: align, color: textColor }, tnum]}>{value}</Text>
    </View>
  </Field>;
}
