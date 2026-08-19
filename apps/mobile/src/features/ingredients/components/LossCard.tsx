/**
 * 실측 로스율 — 이 재료를 얼마나 버리고 있나 (0042).
 *
 * ⚠ 이 숫자는 **기준단가에 곱해지지 않는다.** 0041 이전에는 곱해졌고, 그래서
 *   폐기를 입력할수록 단가가 오히려 내려가는 역전이 있었다. 지금은 순수하게
 *   "얼마나 버렸나"를 알려줄 뿐이다 — 그게 이 숫자가 있어야 할 자리다.
 *
 * 바로 아래 '현재 재고' 카드와 **같은 형태**로 만든다(0046).
 *   헤더에 요약 → 최근 몇 건 목록 → 자세히 보기
 * 요약 두 줄(조리 전 x% / 조리 후 y%)만 있으면 비율은 알아도 **무슨 일이
 * 있었는지**를 모른다. 사장님이 알고 싶은 건 "언제 뭘 얼마나 버렸나"다.
 * 조리 전·후 구분은 각 줄의 라벨이 지고, 비율 비교는 드릴다운의 탭이 진다.
 */
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, Icon } from '@/components/kit';
import { formatQuantity } from '@sikjae/core';
import { T, tnum, won } from '@/theme/tokens';
import type { IngredientLoss, LedgerEntry } from '../hooks';
import { dispUnit } from '../ledger';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 이 정도면 한 번 들여다볼 만하다. 신선 채소는 보통 한 자릿수 초반이다. */
const WATCH = 10;

/** 카드에 몇 줄까지 — '현재 재고' 와 같은 수. 그보다 많으면 목록이 카드를 잡아먹는다. */
const PREVIEW = 4;

const pct = (v: number) => `${Math.round(v * 10) / 10}%`;

export function LossCard({ loss, baseUnit, discards, unitPrice, onPress }: {
  loss: IngredientLoss;
  baseUnit: 'g' | 'ml' | 'ea';
  /** 폐기 원장(최신순). 카드가 최근 몇 건을 그대로 보여준다. */
  discards: LedgerEntry[];
  /** 기준단가 — 줄마다 버린 금액을 내는 데 쓴다. 없으면 금액을 감춘다. */
  unitPrice: number | null;
  /** 폐기 내역으로 들어가기. 없으면 카드가 눌리지 않는다. */
  onPress?: () => void;
}) {
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
  const recent = discards.slice(0, PREVIEW);

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      {/*
        헤더 — '현재 재고' 와 **같은 배경**을 쓴다. 카드마다 배경이 다르면 한 화면에
        나란히 놓였을 때 목록이 들썩인다. 높은 로스율은 숫자 색과 배지로만 알린다.
      */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>로스율</Text>
        {high ? <Badge tone="amber" sm>확인 필요</Badge> : null}
        <Text style={[{ fontSize: 16, fontWeight: '800', color: high ? T.amberText : T.ink }, NUM]}>
          {pct(loss.rate)}
        </Text>
      </View>

      {recent.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: T.ter }}>불러오는 중이에요</Text>
        </View>
      ) : (
        recent.map((e, i) => {
          const amount = Math.abs(e.countDelta);
          return (
            <Pressable
              key={e.id}
              onPress={onPress}
              disabled={!onPress}
              accessibilityRole={onPress ? 'button' : undefined}
              accessibilityLabel={`${e.date} ${e.waste ? '조리 후 폐기' : '조리 전 폐기'} ${formatQuantity(amount, u)}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 12, paddingHorizontal: 15,
                borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: T.line2,
                opacity: e.reverted ? 0.45 : 1,
              }}
            >
              <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', width: 44 }, tnum]}>
                {e.date.slice(5).replace('-', '/')}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: T.ink2 }} numberOfLines={1}>
                  {e.waste ? '조리 후 폐기' : '조리 전 폐기'}
                  {e.reverted ? ' · 취소됨' : ''}
                </Text>
                {e.note ? (
                  <Text style={{ fontSize: 13, color: T.ter, marginTop: 1 }} numberOfLines={1}>{e.note}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 15, fontWeight: '800', color: T.red }, NUM]}>
                  −{formatQuantity(amount, u)}
                </Text>
                {unitPrice !== null ? (
                  <Text style={[{ fontSize: 13, color: T.sub2, marginTop: 1 }, NUM]}>
                    {won(Math.round(amount * unitPrice))}원
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}

      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button" accessibilityLabel="폐기 내역 전체 보기"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
          <Icon name="chevron" size={16} color={T.ter} />
        </Pressable>
      ) : null}
    </Card>
  );
}
