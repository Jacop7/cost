import { Text, View } from 'react-native';
import { COLOR, T, TYPE, radius, space, tnum } from '@/theme/tokens';
import { stateLabel, type ChangeState } from '../hooks';

/** Classification comes from the caller; this shared header only arranges it. */
export function ChangeDetailHeader({ title, stamp, description, sourceLabel, automatic = false, state, application: applicationOverride }: {
  title: string;
  stamp: string;
  description?: string;
  sourceLabel: string | string[] | null;
  automatic?: boolean;
  state?: ChangeState | null;
  application?: { text: string; tone: 'green' | 'amber' | 'neutral' } | null;
}) {
  const application = applicationOverride ?? (state ? stateLabel(state) : null);
  const colors = {
    green: { color: COLOR.status.positive, backgroundColor: COLOR.status.positiveTint },
    amber: { color: COLOR.status.caution, backgroundColor: COLOR.status.cautionTint },
    neutral: { color: COLOR.text.secondary, backgroundColor: T.line2 },
    blue: { color: COLOR.action.onTint, backgroundColor: COLOR.action.primaryTint },
  };
  const sourceColors = automatic ? colors.blue : colors.neutral;
  const sourceLabels = sourceLabel == null ? [] : Array.isArray(sourceLabel) ? sourceLabel : [sourceLabel];
  const badgeShape = { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, maxWidth: '100%' as const, flexShrink: 1 };
  const badgeText = { fontSize: TYPE.captionSm.fontSize, fontWeight: '700' as const };
  return <View style={{ gap: space.sm }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.sm }}>
      {sourceLabels.map(label => <View key={label} style={[badgeShape, { backgroundColor: sourceColors.backgroundColor }]}>
        <Text style={[badgeText, { color: sourceColors.color }]}>{label}</Text>
      </View>)}
      {application ? <View style={[badgeShape, { backgroundColor: colors[application.tone].backgroundColor }]}>
        <Text style={[badgeText, { color: colors[application.tone].color }]}>{application.text}</Text>
      </View> : null}
    </View>
    <View style={{ gap: space.xs }}>
      <Text style={{ ...TYPE.header, color: COLOR.text.primary }}>{title}</Text>
      {description ? <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>{description}</Text> : null}
      <Text style={[TYPE.captionSm, tnum, { color: COLOR.text.tertiary }]}>{stamp}</Text>
    </View>
  </View>;
}
