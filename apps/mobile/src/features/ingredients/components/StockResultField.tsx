import { Text, View } from 'react-native';
import { Field } from '@/components/kit';
import { COLOR, COMPONENT, T, TYPE, radius, tnum } from '@/theme/tokens';

/** 재고 수정 공용 결과: 라벨은 박스 위, 값은 읽기 전용 박스 오른쪽. */
export function StockResultField({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return <Field label={label} variant="stacked">
    <View style={{ minHeight: COMPONENT.stackedForm.controlMinHeight, paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal,
      justifyContent: 'center', borderWidth: 1, borderColor: T.line3, borderRadius: radius.md, backgroundColor: T.surface2 }}>
      <Text style={[{ ...TYPE.body, fontWeight: '800', textAlign: 'right', color: negative ? COLOR.status.negative : T.ink }, tnum]}>{value}</Text>
    </View>
  </Field>;
}
