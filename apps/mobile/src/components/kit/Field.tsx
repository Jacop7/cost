import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { COLOR, COMPONENT, T, TYPE, space } from '@/theme/tokens';

/** 기존 Field 계약을 독립 모듈로 분리. kit 내부에서 배럴을 역참조하지 않는다. */
export function Field({ label, children, hint, req, right, error, variant }: { label: string; children: ReactNode; hint?: string; req?: boolean; right?: ReactNode; error?: string; variant?: 'stacked' }) {
  return (
    <View style={{ marginBottom: variant ? COMPONENT.stackedForm.fieldGap : space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: variant ? COMPONENT.stackedForm.labelGap : 8, marginHorizontal: variant ? COMPONENT.stackedForm.labelInset : 0 }}>
        <Text style={{ flexShrink: 1, fontSize: 16, fontWeight: '700', color: T.sub, ...(variant ? COMPONENT.stackedForm.label : {}) }}>
          {label}
          {req ? <Text style={{ color: COLOR.text.required }}> *</Text> : null}
        </Text>
        {right}
      </View>
      {children}
      {error ? (
        <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative, marginTop: space.sm }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 16, color: COLOR.text.tertiary, marginTop: space.sm, lineHeight: TYPE.body.lineHeight }}>{hint}</Text>
      ) : null}
    </View>
  );
}
