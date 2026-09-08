import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { changeStamp } from '@/features/changes';
import { COLOR, T, space, won } from '@/theme/tokens';
import { deltaTone, type ProfitChange } from '../profitHistory';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** RCP-16's existing two-decimal rounding followed by the shared money formatter. */
export function formatProfitAmount(value: number): string {
  return `${won(Math.round(value * 100) / 100)}원`;
}

/** Keep each existing consumer's signed half-rounding order during layout reuse. */
export function formatProfitDeltaAmount(value: number, deltaRounding: 'absolute-first' | 'signed-first' = 'absolute-first'): string {
  return deltaRounding === 'signed-first'
    ? `${won(Math.abs(Math.round(value * 100) / 100))}원`
    : formatProfitAmount(Math.abs(value));
}

/** RCP-02 preview and RCP-16 list share server snapshot values and delta roles. */
export function ProfitChangeRow({ item, last, onPress, deltaRounding = 'absolute-first' }: {
  item: ProfitChange;
  last: boolean;
  onPress: () => void;
  deltaRounding?: 'absolute-first' | 'signed-first';
}) {
  const tone = deltaTone(item.profitDelta);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.summary ?? ''}. 순이익 ${formatProfitAmount(item.profitAfter)}`}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
        paddingVertical: space.md, paddingHorizontal: space.md,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: '50%', minWidth: 0, maxWidth: '100%' }}>
          <Text style={[{ fontSize: 13, color: COLOR.text.tertiary, fontWeight: '600', maxWidth: '100%' }, NUM]}>
            {changeStamp(item.occurredAt)}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink, marginTop: 4, maxWidth: '100%' }}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={{ fontSize: 14, color: T.sub, marginTop: space.xs, maxWidth: '100%' }}>
              {item.summary}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', paddingTop: space.md, marginLeft: 'auto', minWidth: 0, maxWidth: '100%', flexShrink: 1 }}>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, maxWidth: '100%', textAlign: 'right' }, NUM]}>
            {formatProfitAmount(item.profitAfter)}
          </Text>
          <View style={{ marginTop: space.xs, maxWidth: '100%' }}>
            {tone === 'flat' ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLOR.text.tertiary, maxWidth: '100%', textAlign: 'right' }}>변동 없음</Text>
            ) : (
              <Text style={[{ fontSize: 13, fontWeight: '800', color: tone === 'up' ? COLOR.status.positive : COLOR.status.negative, maxWidth: '100%', textAlign: 'right' }, NUM]}>
                {tone === 'up' ? '+' : '−'}{formatProfitDeltaAmount(item.profitDelta as number, deltaRounding)}
              </Text>
            )}
          </View>
        </View>
      </View>
      <Icon name="chevron" size={16} color={T.line3} />
    </Pressable>
  );
}
