/**
 * 최근 수정 공통 행 — 식재료 상세(ING-03)와 레시피 상세(RCP-02)가 **같은 모양**을 쓴다.
 *
 *   ↻  현재 매출에 반영 중                        최근 수정       ›
 *                                    26-08-18 09:10
 *
 * 상태는 왼쪽 본문 텍스트, 최근 수정·등록과 날짜/시간은 오른쪽 두 줄로 표시한다.
 * 화면마다 따로 그리면 두 곳이 조금씩 달라진다 — 여기 하나만 둔다.
 */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { DetailRowIcon } from '@/components/kit/DetailRowIcon';
import { COLOR, COMPONENT, T, space, TYPE, minTouchTarget } from '@/theme/tokens';
import { changeTime, stateLabel, type LastChange } from '../hooks';
import { useBusinessDay } from '@/features/business-day/businessDay';

export function RecentChangeRow({ change, onPress, standalone = false }: { change: LastChange; onPress: () => void; standalone?: boolean }) {
  const timezone = useBusinessDay().data?.timezone;
  const timestamp = changeTime(change.occurredAt, timezone) || '—';
  // This card describes the current settings. Event classifications belong in history only.
  const pending = change.hasPendingChange ?? (change.hasHistory && (change.displayState === 'not_reflected' || change.displayState === 'partial'));
  const s = stateLabel('reflected');
  const pendingText = '영업 종료 후 반영 예정';

  /**
   * ⚠ 한 번도 안 고쳤으면 그 시각은 **등록**이지 수정이 아니다(0082).
   *   '최근 수정'이라 해 놓고 눌러 보면 목록이 비어 있어서 사장님이 헤맸다.
   */
  const label = change.hasHistory ? '최근 수정' : '등록';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${timestamp}${s ? ` · ${s.text}` : ''}${pending ? ` · ${pendingText}` : ''}. 수정 내역 보기`}
      style={{
        flexDirection: 'column',
        gap: 8,
        marginTop: standalone ? 0 : space.md,
        minHeight: minTouchTarget,
        paddingTop: standalone ? 0 : space.md,
        borderTopWidth: standalone ? 0 : 1,
        borderTopColor: T.line2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: minTouchTarget, alignSelf: 'stretch' }}>
      {/* 되돌아오는 화살표 — "값이 갱신됐다"를 한 글자로 말한다 */}
      <DetailRowIcon name="history" />

      {/* 판매가·기준 인분과 같은 공용 본문 스타일. */}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, alignItems: 'flex-start' }}>
        <Text style={{ ...TYPE.body, color: COLOR.text.primary }} numberOfLines={1}>{s.text}</Text>
      </View>

      <View style={{ flexShrink: 1, minWidth: 0, gap: 2, alignItems: 'flex-end' }}>
        <Text style={{ flexShrink: 1, fontSize: COMPONENT.recentChange.labelFontSize, fontWeight: '700', ...COMPONENT.detailMeta.label }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ ...COMPONENT.recentChange.timestamp, color: T.sub }} numberOfLines={1}>{timestamp}</Text>
      </View>

      <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
      </View>
      {pending ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 22, alignItems: 'center' }}>
          <Icon name="hourglass" size={14} color={COLOR.text.tertiary} />
        </View>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, flexShrink: 1 }}>{pendingText}</Text>
      </View> : null}
    </Pressable>
  );
}
