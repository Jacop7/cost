/**
 * RCP-05 판매가 시뮬레이션 (시트) — 임시 판매가를 슬라이더로 바꿔 순이익을 미리 확인.
 * 계산은 상세(RCP-02)와 동일 공식: tax=판매가×10/110, fixed=fixedRate×판매가.
 *
 * '이 판매가로 적용'은 실제로 **저장한다**(E3). 이전에는 시트만 닫혀서
 * 사장님이 바꿨다고 생각한 값이 반영되지 않았다.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Icon, Sheet, Slider } from '@/components/kit';
import { formatPercent, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

export function PriceSimSheet({
  visible, onClose, price, material, extra, fixedRate, target,
  taxIncluded = true, onApply, saving = false,
}: {
  visible: boolean;
  onClose: () => void;
  price: number;
  material: number;
  extra: number;
  /** 0~1 비율 */
  fixedRate: number;
  /** 0~1 비율 */
  target: number;
  taxIncluded?: boolean;
  onApply?: (nextPrice: number) => void;
  saving?: boolean;
}) {
  const min = Math.max(100, Math.round((price * 0.75) / 100) * 100);
  const max = Math.round(((price * 5) / 3) / 100) * 100;
  const [temp, setTemp] = useState(price);

  // 열릴 때 현재 판매가로 되돌린다. 이전 시뮬레이션 값이 남아 있으면 오해한다.
  useEffect(() => { if (visible) setTemp(price); }, [visible, price]);

  const calc = (p: number) => {
    const tax = taxIncluded ? round((p * 10) / 110) : 0;
    const fixed = round(fixedRate * p);
    const profit = p - tax - material - fixed - extra;
    return { profit, rate: p > 0 ? profit / p : 0 };
  };
  const cur = calc(price);
  const now = calc(temp);
  const met = now.rate >= target;
  const PROFIT = met ? T.green : T.red;
  const diff = temp - price;

  // 목표 달성 권장가(100원 단위). 분모가 0 이하면 어떤 가격으로도 목표를 못 맞춘다.
  const denom = 1 - target - fixedRate - (taxIncluded ? 10 / 110 : 0);
  const recRaw = denom > 0 ? (material + extra) / denom : NaN;
  const rec = Number.isFinite(recRaw) && recRaw > 0 ? Math.round(recRaw / 100) * 100 : null;

  return (
    <Sheet visible={visible} onClose={onClose} title="판매가 시뮬레이션" sub="판매가를 바꿔 순이익을 미리 확인해요" height={560}>
      <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 2 }}>
        <Text style={{ fontSize: 14, color: T.ter, fontWeight: '700' }}>임시 판매가</Text>
        <Text style={[{ fontSize: 22, fontWeight: '800', color: T.blue, letterSpacing: -0.6, marginTop: 2 }, NUM]}>
          {won(temp)}<Text style={{ fontSize: 18 }}>원</Text>
        </Text>
        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 2 }, NUM]}>
          현재 {won(price)}원에서 {diff >= 0 ? '+' : '−'}{won(Math.abs(diff))}원
        </Text>
      </View>

      <View style={{ marginTop: 16, marginBottom: 6, marginHorizontal: 4 }}>
        <Slider value={temp} min={min} max={max} step={100} onChange={setTemp} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={[{ fontSize: 14, color: T.ter }, NUM]}>{won(min)}원</Text>
          <Text style={[{ fontSize: 14, color: T.ter }, NUM]}>{won(max)}원</Text>
        </View>
      </View>

      <Card onLine pad={16}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 14, color: T.ter, fontWeight: '700' }}>순이익률</Text>
            <Text style={{ fontSize: 14, color: T.ter, fontWeight: '700' }}>순이익</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[{ fontSize: 14, color: T.ter, textDecorationLine: 'line-through' }, NUM]}>{formatPercent(cur.rate)}</Text>
              <Icon name="arrowRight" size={16} color={T.ter} />
              <Text style={[{ fontSize: 20, fontWeight: '800', color: PROFIT }, NUM]}>{formatPercent(now.rate)}</Text>
              {met ? <Badge tone="green" sm solid>목표 달성</Badge> : <Badge tone="red" sm solid>목표 미달</Badge>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[{ fontSize: 14, color: T.ter, textDecorationLine: 'line-through' }, NUM]}>{won(Math.round(cur.profit))}원</Text>
              <Icon name="arrowRight" size={16} color={T.ter} />
              <Text style={[{ fontSize: 18, fontWeight: '800', color: PROFIT }, NUM]}>{won(Math.round(now.profit))}원</Text>
            </View>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingHorizontal: 2 }}>
        <Icon name="info" size={15} color={rec != null ? T.blue : T.amberText} />
        <Text style={[{ flex: 1, fontSize: 14, color: rec != null ? T.blue : T.amberText, fontWeight: '600', lineHeight: 20 }, NUM]}>
          {rec != null
            ? `목표 ${formatPercent(target)} 달성 권장가는 ${won(rec)}원이에요`
            : '지금 원가 구조로는 목표 순이익률을 맞출 수 없어요. 재료비나 목표를 조정해 주세요.'}
        </Text>
      </View>

      <View style={{ marginTop: 18 }}>
        <Button
          kind="primary" size="lg" full
          loading={saving}
          disabled={!onApply || temp === price}
          onPress={() => onApply?.(temp)}
        >
          {temp === price ? '판매가 변경 없음' : `${won(temp)}원으로 저장`}
        </Button>
      </View>
    </Sheet>
  );
}
