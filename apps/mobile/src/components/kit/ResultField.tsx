import { Text, View } from 'react-native';
import { Field } from './Field';
import { COLOR, COMPONENT, T, TYPE, radius, tnum } from '@/theme/tokens';

/** 식재료에서 확정한 회색 읽기 전용 결과 규격. 입력 컴포넌트가 아니다. */
export function ResultField({ label, value, negative = false }: {
  label: string; value: string; negative?: boolean;
}) {
  return <Field label={label} variant="stacked">
    <View style={{ minHeight: COMPONENT.stackedForm.controlMinHeight,
      paddingHorizontal: COMPONENT.stackedForm.controlPaddingHorizontal, justifyContent: 'center',
      borderWidth: 1, borderColor: COMPONENT.input.border.default, borderRadius: radius.md, backgroundColor: T.line }}>
      <Text style={[TYPE.body, tnum, { fontWeight: '800', textAlign: 'right', color: negative ? COLOR.status.negative : T.ink }]}>{value}</Text>
    </View>
  </Field>;
}
