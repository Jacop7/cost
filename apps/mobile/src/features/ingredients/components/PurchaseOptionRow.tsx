import { Pressable, Text, View } from 'react-native';
import { Badge, Icon } from '../../../components/kit';
import { PurchaseAmount } from './PurchaseAmount';
import { COLOR, T, TYPE, rowMinHeight, space, tnum } from '../../../theme/tokens';

/** Shared layout only: hosts retain formatting, price comparison and navigation.
 * Detail and management intentionally keep their existing typography variants.
 * Values wrap below the identity block when they cannot share a line; neither
 * names nor monetary values are shrunk/ellipsized to reserve the trailing icons.
 */
export function PurchaseOptionRow({ name, seller, amount, quantity, unitPrice, variant, badge, hasLink, last, onPress, accessibilityLabel }: {
  name: string; seller: string; amount: string; quantity: string; unitPrice: string;
  variant: 'detail' | 'management'; badge?: 'low' | 'high'; hasLink?: boolean; last: boolean; onPress: () => void;
  accessibilityLabel?: string;
}) {
  const management = variant === 'management';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${name} 수정`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md,
        minHeight: management ? rowMinHeight.twoLine : undefined,
        paddingVertical: management ? space.xl : space.md, paddingHorizontal: management ? space.lg : 0,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}>
        <View style={{ flexGrow: 1, flexBasis: '50%', minWidth: '50%', maxWidth: '100%' }}>
          {management ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }}>
            {badge === 'low' ? <Badge tone="blue" sm alignSelf="center">최저</Badge> : badge === 'high' ? <Badge tone="red" sm alignSelf="center">최고</Badge> : null}
            <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>{seller}</Text>
          </View> : <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{name}</Text>
            <Text style={{ fontSize: 14, color: COLOR.text.tertiary, fontWeight: '600', marginTop: 4 }}>{seller}</Text>
          </>}
          <PurchaseAmount regular>{amount}</PurchaseAmount>
        </View>
        <View style={{ marginLeft: 'auto', alignItems: 'flex-end', maxWidth: '100%' }}>
          <Text style={[{ maxWidth: '100%', textAlign: 'right', fontSize: TYPE.body.fontSize, fontWeight: '800', color: T.ink }, tnum]}>{quantity}</Text>
          <Text style={[{ maxWidth: '100%', textAlign: 'right', fontSize: TYPE.caption.fontSize, color: COLOR.text.tertiary,
            fontWeight: management ? '700' : undefined, marginTop: space.xs }, tnum]}>{unitPrice}</Text>
        </View>
      </View>
      {!management && hasLink ? <Icon name="link" size={16} color={COLOR.text.tertiary} /> : null}
      {!management ? <Icon name="chevron" size={16} color={T.line3} /> : null}
    </Pressable>
  );
}
