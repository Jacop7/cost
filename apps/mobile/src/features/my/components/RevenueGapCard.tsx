/**
 * M-030 · 고정지출률 분모(수기 월매출)와 실제 매출의 괴리.
 *
 * 총 월매출은 사장님이 직접 적는 값이고, 그게 **전 메뉴 순이익에 곱해진다**.
 * 한 번 적고 잊으면 실제와 벌어져도 앱이 알려주지 않아 모든 메뉴 손익이 조용히 틀어진다.
 * 그래서 자동으로 고치지 않고 — 문서가 수기 입력을 의도했다 —
 * **얼마나 어긋났는지 보여주고 고칠지는 사장님이 정한다.**
 */
import { Pressable, Text, View } from 'react-native';
import { Card, Icon } from '@/components/kit';
import { formatPercent } from '@margincook/core';
import { COLOR, T, won, TYPE, space } from '@/theme/tokens';
import type { RevenueCheck } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 이 정도 벌어지면 알려야 한다. 10%는 예상의 오차 범위로 본다. */
const WARN_GAP = 10;

export function RevenueGapCard({ check, onApply, applying = false }: {
  check: RevenueCheck;
  /** '실적으로 채우기' — 없으면 버튼을 감춘다(읽기 전용 화면). */
  onApply?: (next: number) => void;
  applying?: boolean;
}) {
  // 판매 기록이 없으면 비교할 것이 없다. 0% 괴리로 위장하지 않는다.
  if (!check.hasSales) {
    return (
      <Card pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="info" size={16} color={COLOR.text.tertiary} />
          <Text style={{ flex: 1, fontSize: 14, color: COLOR.text.tertiary, lineHeight: TYPE.caption.lineHeight }}>
            {Number(check.month.slice(5))}월은 아직 매출 기록이 없어요. 판매를 등록하면 실제 매출과 비교해 드려요.
          </Text>
        </View>
      </Card>
    );
  }

  const gap = check.gapPct;
  const over = (gap ?? 0) > 0;
  const big = gap !== null && Math.abs(gap) >= WARN_GAP;

  const projected = check.projectedRevenue ?? 0;

  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
        <Text style={{ flexShrink: 1, fontSize: 14, fontWeight: '800', color: T.ink }}>
          {big ? '적어둔 월매출이 실제와 많이 달라요' : '적어둔 월매출과 실제 비교'}
        </Text>
        {gap !== null ? (
          <Text style={{ ...TYPE.caption, color: T.sub2 }}>{over ? '+' : ''}{Math.round(gap * 10) / 10}%</Text>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: space.md }}>
        <Row label="적어둔 월매출" value={check.manualRevenue === null ? '미입력' : `${won(check.manualRevenue)}원`} />
        <Row
          label={check.inProgress ? `실제 매출 (${check.daysElapsed}/${check.daysTotal}일)` : '실제 매출 (월 전체)'}
          value={`${won(check.actualRevenue)}원`}
        />
        {check.inProgress ? (
          <Row label="이 속도면 월 합계" value={`${won(Math.round(projected))}원`} />
        ) : null}

        <Row
          label="지금 적용 중인 고정지출률"
          value={check.rateManual === null ? '—' : formatPercent(check.rateManual)}
        />
        <Row
          label={check.inProgress ? '실제 기준이면' : '실적 기준이면'}
          value={check.rateProjected === null ? '—' : formatPercent(check.rateProjected)}
        />

        <Text style={{ fontSize: 14, color: COLOR.text.tertiary, lineHeight: TYPE.caption.lineHeight, marginVertical: space.md }}>
          고정지출률은 <Text style={{ fontWeight: '700' }}>적어둔 월매출</Text>로 계산돼요. 실제 매출로 자동으로 바뀌지 않아요
          {check.inProgress ? ' — 월초에는 며칠치만으로 나눠 비율이 튀기 때문이에요.' : '.'}
        </Text>

      </View>
      {onApply && projected > 0 ? (
          <Pressable
            onPress={() => onApply(Math.round(projected))}
            disabled={applying}
            accessibilityRole="button"
            accessibilityLabel={`월매출을 ${won(Math.round(projected))}원으로 채우기`}
            accessibilityState={{ disabled: applying }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
              minHeight: 48, padding: space.md,
              borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2,
              opacity: applying ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>
              {won(Math.round(projected))}원으로 채우기
            </Text>
          </Pressable>
        ) : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink }}>{label}</Text>
      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink, maxWidth: '48%', textAlign: 'right' }, NUM]}>
        {value}
      </Text>
    </View>
  );
}
