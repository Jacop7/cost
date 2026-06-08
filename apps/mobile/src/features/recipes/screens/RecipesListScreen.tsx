import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';

/**
 * RCP-01 레시피 리스트 (② 4장).
 * 순이익률 낮은순 정렬 · 목표 미달 경고 뱃지 · [+] FAB.
 * 손익은 @sikjae/core computeProfit 으로 미리보기, 확정값은 E3 RPC.
 */
export default function RecipesListScreen() {
  return (
    <View style={{ flex: 1 }}>
      <EmptyState title="메뉴를 등록해 원가·손익을 확인하세요" hint="재료를 검색해 N인분으로 입력하면 1인분 원가가 자동 계산됩니다." />
    </View>
  );
}
