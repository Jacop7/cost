/**
 * RCP-05 판매가 시뮬레이션 (시트) — 임시 판매가를 슬라이더로 바꿔 순이익을 미리 확인.
 * 계산은 상세(RCP-02)와 동일 공식: tax=판매가×10/110, fixed=fixedRate×판매가.
 * ⚠ 미리보기 전용(확정값은 E3 RPC). 재고·단가 변경 없음.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Icon, Sheet, Slider } from '@/components/kit';
import { round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { pct } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

export function PriceSimSheet({ visible, onClose, price, material, extra, fixedRate, target }: {
  visible: boolean;
  onClose: () => void;
  price: number;
  material: number;
  extra: number;
  fixedRate: number;
  target: number;
}) {
  const min = Math.round((price * 0.75) / 100) * 100;
  const max = Math.round((price * 5 / 3) / 100) * 100;
  const [temp, setTemp] = useState(price);

  const calc = (p: number) => {
    const tax = round((p * 10) / 110);
    const fixed = round(fixedRate * p);
    const profit = p - tax - material - fixed - extra;
    return { profit, rate: profit / p };
  };
  const cur = calc(price);
  const now = calc(temp);
  const met = now.rate >= target;
  const PROFIT = met ? T.green : T.red;
  const diff = temp - price;

  // 목표 달성 권장가(100원 단위)
  const recRaw = (material + extra) / (1 - target - fixedRate - 10 / 110);
  const rec = Number.isFinite(recRaw) && recRaw > 0 ? Math.round(recRaw / 100) * 100 : null;

  return (
    <Sheet visible={visible} onClose={onClose} title="판매가 시뮬레이션" sub="판매가를 바꿔 순이익을 미리 확인해요" height={520}>
      {/* 임시 판매가 */}
      <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 2 }}>
        <Text style={{ fontSize: 14, color: T.ter, fontWeight: '700' }}>임시 판매가</Text>
        <Text style={[{ fontSize: 22, fontWeight: '800', color: T.blue, letterSpacing: -0.6, marginTop: 2 }, NUM]}>
          {won(temp)}<Text style={{ fontSize: 18 }}>원</Text>
        </Text>
        <Text style={[{ fontSize: 14, color: T.sub2, marginTop: 2 }, NUM]}>
          현재 {won(price)}원에서 {diff >= 0 ? '+' : '−'}{won(Math.abs(diff))}원
        </Text>
      </View>

      {/* 슬라이더 */}
      <View style={{ marginTop: 16, marginBottom: 6, marginHorizontal: 4 }}>
        <Slider value={temp} min={min} max={max} step={100} onChange={setTemp} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={[{ fontSize: 14, color: T.ter }, NUM]}>{won(min)}원</Text>
          <Text style={[{ fontSize: 14, color: T.ter }, NUM]}>{won(max)}원</Text>
        </View>
      </View>

      {/* 순이익률/순이익 비교 */}
      <Card onLine pad={16}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 14, color: T.ter, fontWeight: '700' }}>순이익률</Text>
            <Text style={{ fontSize: 14, color: T.ter, fontWeight: '700' }}>순이익</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[{ fontSize: 14, color: T.ter, textDecorationLine: 'line-through' }, NUM]}>{pct(cur.rate)}%</Text>
              <Icon name="arrowRight" size={16} color={T.ter} />
              <Text style={[{ fontSize: 20, fontWeight: '800', color: PROFIT }, NUM]}>{pct(now.rate)}%</Text>
              {met ? <Badge tone="green" sm solid>목표 달성</Badge> : <Badge tone="red" sm solid>목표 미달</Badge>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[{ fontSize: 14, color: T.ter, textDecorationLine: 'line-through' }, NUM]}>{won(cur.profit)}원</Text>
              <Icon name="arrowRight" size={16} color={T.ter} />
              <Text style={[{ fontSize: 18, fontWeight: '800', color: PROFIT }, NUM]}>{won(now.profit)}원</Text>
            </View>
          </View>
        </View>
      </Card>

      {rec != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 2 }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={[{ fontSize: 14, color: T.blue, fontWeight: '600' }, NUM]}>목표 {pct(target)}% 달성 권장가는 {won(rec)}원이에요</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 18 }}>
        <Button kind="primary" size="lg" full onPress={onClose}>이 판매가로 적용</Button>
      </View>
    </Sheet>
  );
}
