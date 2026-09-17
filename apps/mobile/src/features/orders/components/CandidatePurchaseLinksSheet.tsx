import { Alert, Linking } from 'react-native';
import { QueryState, Sheet } from '@/components/kit';
import { DetailPreviewRow } from '@/features/ingredients/components/DetailPreview';
import { PurchaseAmount } from '@/features/ingredients/components/PurchaseAmount';
import { useIngredientDetail } from '@/features/ingredients/hooks';
import { normalizePurchaseUrl } from '@/features/ingredients/purchaseUrl';
import { dispUnit } from '@/features/ingredients/ledger';
import { useUnitPriceFormat } from '@/lib/unitPriceFormat';
import { formatQuantity } from '@costkeep/core';
import { won } from '@/theme/tokens';

export function CandidatePurchaseLinksSheet({ ingredientId, onClose }: {
  ingredientId: string; onClose: () => void;
}) {
  const detail = useIngredientDetail(ingredientId);
  const formatUnitPrice = useUnitPriceFormat();
  const options = detail.data?.options ?? [];
  const unit = dispUnit(detail.data?.baseUnit ?? 'g');
  return <Sheet visible onClose={onClose} title="구매처 선택">
    <QueryState isLoading={detail.isLoading} error={detail.error} isEmpty={options.length === 0}
      onRetry={() => void detail.refetch()} emptyTitle="등록된 구매 링크가 없어요"
      emptyHint="재료 상세 → 구매 링크에서 먼저 등록해 주세요">
      {options.map((option, index) => <DetailPreviewRow key={option.id}
        title={option.brandName ?? option.vendorName ?? '구매처 미지정'}
        subAfter={<PurchaseAmount>{`${won(option.amount)}원`}</PurchaseAmount>}
        value={formatQuantity(option.volume, unit)}
        detail={option.volume > 0 ? formatUnitPrice(option.amount / option.volume, unit) : '단가 산출 전'}
        showChevron last={index === options.length - 1} accessibilityLabel={`${option.name} 구매 링크 열기`}
        onPress={() => {
          const link = normalizePurchaseUrl(option.url ?? '');
          if (!link) { Alert.alert('링크를 열 수 없어요', '등록된 구매 링크가 없거나 올바르지 않아요.'); return; }
          void Linking.openURL(link).catch(() => Alert.alert('링크를 열 수 없어요', '주소를 확인한 뒤 다시 시도해 주세요.'));
        }} />)}
    </QueryState>
  </Sheet>;
}
