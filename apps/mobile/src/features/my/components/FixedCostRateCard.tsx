import { Card, DetailSummaryRow } from '@/components/kit';
import { formatPercent } from '@costkeep/core';
import { won } from '@/theme/tokens';

export function FixedCostRateCard({ total, rate }: { total: number; rate: number | null }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <DetailSummaryRow label="고정 지출" value={`${won(total)}원`} />
      <DetailSummaryRow
        label="고정 지출률"
        value={rate === null ? '미산출' : formatPercent(rate)}
        last
      />
    </Card>
  );
}
