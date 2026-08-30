/**
 * RCP-05 판매가 시뮬레이션 (시트) — 임시 판매가로 손익이 어떻게 바뀌는지 **여기서만** 본다.
 * 계산은 상세(RCP-02)와 동일 공식: tax=판매가×세금비율, fixed=fixedRate×판매가.
 * 세금비율은 부가세(10/110)에 사장님이 더한 세금 항목까지 합친 값이다(0052) —
 * 부가세만 넣으면 카드 수수료가 빠져 순이익이 실제보다 높게 보인다.
 *
 * ⚠ **저장하지 않는다.** 한때 '이 판매가로 적용'이 실제 저장(E3)이었는데,
 *   슬라이더를 움직이며 눌러 보는 사이 판매가가 14,000 → 36,700 으로 바뀌고
 *   profit_trends 에 가짜 점 3개(46.02·39.08·32.79)가 박혔다. 추이는 절대원칙 4 로
 *   지울 수 없어 영구히 남는다. "만약 이 가격이면?" 을 보려던 것이 데이터를 바꾸면 안 된다.
 *   판매가를 진짜 바꾸려면 메뉴 수정으로 간다 — 그게 편집이고, 이건 미리보기다.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Icon, Sheet, Slider } from '@/components/kit';
import { formatPercent, recommendedPrice, round } from '@margincook/core';
import { T, won } from '@/theme/tokens';

const NUM = { fontVariant: ['tabular-nums' as const] };

export function PriceSimSheet({
  visible, onClose, price, material, extra, fixedRate, target, taxRatio,
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
  /** 판매가 대비 세금 비율(0~1). 부가세 + 세금 항목(0052). */
  taxRatio: number;
}) {
  const min = Math.max(100, Math.round((price * 0.75) / 100) * 100);
  const max = Math.round(((price * 5) / 3) / 100) * 100;
  const [temp, setTemp] = useState(price);

  // 열릴 때 현재 판매가로 되돌린다. 이전 시뮬레이션 값이 남아 있으면 오해한다.
  useEffect(() => { if (visible) setTemp(price); }, [visible, price]);

  const calc = (p: number) => {
    const tax = round(p * taxRatio);
    const fixed = round(fixedRate * p);
    const profit = p - tax - material - fixed - extra;
    return { tax, fixed, profit, rate: p > 0 ? profit / p : 0 };
  };
  const cur = calc(price);
  const now = calc(temp);
  const met = now.rate >= target;
  const PROFIT = met ? T.green : T.red;
  const diff = temp - price;

  // 목표 달성 권장가(100원 단위). 분모가 0 이하면 어떤 가격으로도 목표를 못 맞춘다.
  const recRaw = recommendedPrice(material + extra, fixedRate, target, taxRatio);
  const rec = recRaw !== null && recRaw > 0 ? Math.round(recRaw / 100) * 100 : null;

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

      {/*
        임시 판매가로 다시 계산한 손익 구성 — 상세 카드와 **같은 항목·같은 순서**다.
        카드 값을 건드리지 않고 여기서만 보여주므로, 닫으면 아무것도 바뀌지 않는다.
        재료·부자재는 판매가와 무관하므로 금액이 그대로고 비중만 움직인다.
      */}
      <Card onLine pad={0} style={{ overflow: 'hidden', marginTop: 10 }}>
        <View style={{ paddingHorizontal: 14, paddingVertical: 11 }}>
          {([
            ['세금', now.tax],
            ['재료 원가', material],
            ['고정 지출', now.fixed],
            ['부자재', extra],
          ] as const).map(([label, amt], i) => (
            <View
              key={label}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 7,
                borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: T.line2,
                opacity: amt <= 0 ? 0.45 : 1,
              }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>(−) {label}</Text>
              <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink, marginRight: 8 }, NUM]}>
                {won(Math.round(amt))}원
              </Text>
              <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, width: 46, textAlign: 'right' }, NUM]}>
                {temp > 0 ? formatPercent(amt / temp) : '—'}
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: T.ink2 }}>순이익</Text>
            <Text style={[{ fontSize: 14, fontWeight: '800', color: PROFIT, marginRight: 8 }, NUM]}>
              {won(Math.round(now.profit))}원
            </Text>
            <Text style={[{ fontSize: 14, fontWeight: '800', color: PROFIT, width: 46, textAlign: 'right' }, NUM]}>
              {formatPercent(now.rate)}
            </Text>
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

      <View style={{ marginTop: 16 }}>
        <Button kind="ghost" size="lg" full onPress={onClose}>닫기</Button>
      </View>
    </Sheet>
  );
}
