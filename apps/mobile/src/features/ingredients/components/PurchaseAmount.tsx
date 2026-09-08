import { Text } from 'react-native';
import { T, TYPE, space, tnum } from '@/theme/tokens';

/** 구매처 바로 아래의 금액. 호출부가 상품 금액/실입고 총액을 결정한다. */
export function PurchaseAmount({ children, regular = false }: { children: string; regular?: boolean }) {
  return <Text style={[{ ...(regular ? TYPE.caption : TYPE.captionSm), color: T.sub2,
    fontWeight: '600', marginTop: space.xs }, tnum]}>{children}</Text>;
}
