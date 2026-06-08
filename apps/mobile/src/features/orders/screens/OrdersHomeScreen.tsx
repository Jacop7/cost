import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';

/**
 * ORD-01 발주 현황 홈 (③ 3장).
 * 3탭(후보/대기/완료) · 후보 카드(사유 뱃지·권장수량 ±·최근주문) · [레시피로 계산].
 */
export default function OrdersHomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <EmptyState title="발주할 것이 없어요" hint="안전재고 미달·곧소진 시 후보가 자동으로 모입니다." />
    </View>
  );
}
