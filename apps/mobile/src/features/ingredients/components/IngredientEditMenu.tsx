import { useRouter } from 'expo-router';
import { ActionSheet } from '@/components/kit';
import { useBusinessEditConfirmation } from '@/features/business-day/useBusinessEditConfirmation';
import { useIngredientDetail } from '../hooks';

/** 관리 목록의 재료 수정 진입점. 상세 ⋮의 기존 전체 메뉴와 구분한다. */
export function IngredientEditMenu({ id, visible, onClose }: {
  id: string; visible: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const confirmation = useBusinessEditConfirmation('재료');
  const detail = useIngredientDetail(id);
  return <>
    {confirmation.dialog}
    <ActionSheet floating visible={visible} onClose={onClose} items={[
      { label: '기본 정보 수정', onPress: () => confirmation.request(() => router.push(`/ingredients/edit/${id}`)) },
      ...(detail.data?.stockTracking !== false ? [{ label: '재고 조정', onPress: () => router.push(`/ingredients/add-stock/${id}?mode=deduct`) }] : []),
      { label: '구매 링크 수정', onPress: () => router.push(`/ingredients/option?ingredient=${id}`) },
    ]} />
  </>;
}
