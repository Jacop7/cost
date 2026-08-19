/**
 * 실측 로스율 — 이 재료를 얼마나 버리고 있나 (0042).
 *
 * ⚠ 이 숫자는 **기준단가에 곱해지지 않는다.** 0041 이전에는 곱해졌고, 그래서
 *   폐기를 입력할수록 단가가 오히려 내려가는 역전이 있었다. 지금은 순수하게
 *   "얼마나 버렸나"를 알려줄 뿐이다 — 그게 이 숫자가 있어야 할 자리다.
 *
 * 보관 폐기와 조리 폐기를 갈라서 보여준다. 한 숫자로 뭉치면
 * 발주를 줄여야 하는 건지 덜 만들어야 하는 건지 알 수 없다.
 */
import { Text, View } from 'react-native';
import { Card, Icon } from '@/components/kit';
import { formatQuantity } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import type { IngredientLoss } from '../hooks';
import { dispUnit } from '../ledger';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 이 정도면 한 번 들여다볼 만하다. 신선 채소는 보통 한 자릿수 초반이다. */
const WATCH = 10;

const pct = (v: number) => `${Math.round(v * 10) / 10}%`;

export function LossCard({ loss, baseUnit }: { loss: IngredientLoss; baseUnit: 'g' | 'ml' | 'ea' }) {
  const u = dispUnit(baseUnit);

  // 폐기 기록이 없으면 0% 라고 쓰지 않는다 — "안 버렸다"와 "아직 모른다"는 다르다.
  if (loss.rate === null) {
    return (
      <Card pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="info" size={16} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
            아직 폐기 기록이 없어요. 버린 걸 기록하면 로스율이 여기 표시돼요.
          </Text>
        </View>
      </Card>
    );
  }

  const high = loss.rate >= WATCH;

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: high ? T.amberTint : T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: high ? T.amberText : T.sub }}>로스율</Text>
        <Text style={[{ fontSize: 18, fontWeight: '800', color: high ? T.amberText : T.ink }, NUM]}>
          {pct(loss.rate)}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 15, paddingVertical: 12, gap: 9 }}>
        {loss.storageRate !== null ? (
          <Row
            label="보관 폐기"
            hint="상해서 버린 몫"
            value={pct(loss.storageRate)}
            sub={`${formatQuantity(loss.storageAmount, u)} · ${loss.storageCount}건`}
          />
        ) : null}
        {loss.cookingRate !== null ? (
          <Row
            label="조리 폐기"
            hint="만들었는데 못 판 몫"
            value={pct(loss.cookingRate)}
            sub={`${formatQuantity(loss.cookingAmount, u)} · ${loss.cookingCount}건`}
          />
        ) : null}

        <View style={{ height: 1, backgroundColor: T.line2, marginVertical: 2 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.sub }}>버린 금액</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>
            {loss.totalCost === null ? '—' : `${won(Math.round(loss.totalCost))}원`}
          </Text>
        </View>

        <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 2 }}>
          지금까지 들어온 {formatQuantity(loss.purchased, u)} 중 {formatQuantity(loss.totalAmount, u)}을 버렸어요.
          이 비율은 <Text style={{ fontWeight: '700' }}>원가에 반영되지 않아요</Text> — 버린 금액은 월 손익의 폐기 손실로 잡혀요.
        </Text>
      </View>
    </Card>
  );
}

function Row({ label, hint, value, sub }: { label: string; hint: string; value: string; sub: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{label}</Text>
        <Text style={{ fontSize: 14, color: T.ter, marginTop: 1 }}>{hint}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{value}</Text>
        <Text style={[{ fontSize: 14, color: T.ter, marginTop: 1 }, NUM]}>{sub}</Text>
      </View>
    </View>
  );
}
