import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { COLOR, COMPONENT, TYPE, space } from '@/theme/tokens';

export const FIXED_COST_GUIDANCE =
  '가게의 월 고정 지출을 매출 비율로 나누어, 이 메뉴 1인분에 들어가는 비용으로 환산한 금액입니다.';

export const FIXED_COST_MISSING_GUIDANCE =
  '메뉴와 매출 페이지에서 순이익을 확인하려면 고정 지출 항목을 입력해 주세요.';

export function RecipeFixedCostGuidance({ calculated }: { calculated: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const line = calculated ? FIXED_COST_GUIDANCE : FIXED_COST_MISSING_GUIDANCE;
  return (
    <View style={{ backgroundColor: COLOR.action.primaryTint, borderWidth: 1, borderColor: COMPONENT.notice.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: space.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`필독사항 ${expanded ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(value => !value)}
        style={{ minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="info" size={18} color={COLOR.action.primary} fill />
        <Text style={{ ...TYPE.caption, flex: 1, fontWeight: '800', color: COLOR.action.onTint }}>필독사항</Text>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={16} color={COLOR.action.onTint} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={{ ...TYPE.caption, color: COLOR.action.onTint }}>-</Text>
          <Text style={{ ...TYPE.caption, flex: 1, fontWeight: '600', color: COLOR.action.onTint }}>{line}</Text>
        </View>
      ) : null}
    </View>
  );
}
