/**
 * 최근 수정 공통 행 — 식재료 상세(ING-03)와 레시피 상세(RCP-02)가 **같은 모양**을 쓴다.
 *
 *   ↻  최근 수정                [현재 매출 반영]                    ›
 *      26-08-18 09:10
 *
 * 라벨 아래 작은 날짜/시간을 배치하고 행 전체가 눌린다(사용자 결정).
 * 화면마다 따로 그리면 두 곳이 조금씩 달라진다 — 여기 하나만 둔다.
 */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { COLOR, COMPONENT, T, radius, space, TYPE } from '@/theme/tokens';
import { changeTime, stateLabel, type LastChange } from '../hooks';
import { useBusinessDay } from '@/features/business-day/businessDay';

const TONE = {
  green: { fg: COLOR.status.positive, bg: COLOR.status.positiveTint },
  amber: { fg: COLOR.status.caution, bg: COLOR.status.cautionTint },
  neutral: { fg: T.sub2, bg: T.line2 },
} as const;

export function RecentChangeRow({ change, onPress }: { change: LastChange; onPress: () => void }) {
  const timezone = useBusinessDay().data?.timezone;
  const timestamp = changeTime(change.occurredAt, timezone) || '—';
  // ⚠ 상태를 모르면 배지를 그리지 않는다. 기본값으로 메꾸면 없는 사실을 주장한다.
  const s = change.displayState ? stateLabel(change.displayState) : null;
  const c = s ? TONE[s.tone] : null;

  /**
   * ⚠ 한 번도 안 고쳤으면 그 시각은 **등록**이지 수정이 아니다(0082).
   *   '최근 수정'이라 해 놓고 눌러 보면 목록이 비어 있어서 사장님이 헤맸다.
   */
  const label = change.hasHistory ? '최근 수정' : '등록';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${timestamp}${s ? ` · ${s.text}` : ''}. 수정 내역 보기`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: space.md,
        paddingTop: space.md,
        borderTopWidth: 1,
        borderTopColor: T.line2,
      }}
    >
      {/* 되돌아오는 화살표 — "값이 갱신됐다"를 한 글자로 말한다 */}
      <View
        style={{
          width: 22, height: 22, borderRadius: radius.md,
          alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.action.primaryTint,
        }}
      >
        <Icon name="history" size={14} color={COLOR.action.primary} sw={2.2} />
      </View>

      <View style={{ flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ flexShrink: 1, fontSize: 14, fontWeight: '700', color: T.sub }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ ...COMPONENT.recentChange.timestamp, color: T.sub }} numberOfLines={1}>{timestamp}</Text>
      </View>

      {/* 상태 배지는 우측 화살표 바로 왼쪽. basis 0은 큰 글자에서 배지를 빈 점으로 만든다. */}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, alignItems: change.hasHistory ? 'flex-end' : 'flex-start' }}>
        {!change.hasHistory ? (
          <Text style={{ fontSize: 13, color: COLOR.text.tertiary }} numberOfLines={1}>아직 수정 없음</Text>
        ) : s && c ? (
          <View style={{ maxWidth: '100%', paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, backgroundColor: c.bg }}>
            <Text style={{ fontSize: TYPE.captionSm.fontSize, fontWeight: '700', color: c.fg }} numberOfLines={1}>
              {s.text}
            </Text>
          </View>
        ) : null}
      </View>

      <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
    </Pressable>
  );
}
