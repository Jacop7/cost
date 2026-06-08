import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';

/**
 * MY-01 마이페이지 홈 (④).
 * 섹션: 고정 지출(월) · 카테고리 관리 · 단위 설정 · 구매처/브랜드 · 알림 · 월 손익 리포트.
 */
export default function MyHomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <EmptyState title="고정 지출을 입력하면 손익이 정확해져요" hint="총매출과 5개 항목(총액)을 입력하면 고정지출률이 전 레시피에 반영됩니다." />
    </View>
  );
}
