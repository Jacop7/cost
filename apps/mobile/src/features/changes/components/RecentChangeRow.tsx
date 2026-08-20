/**
 * 최근 수정 한 줄 — 식재료 상세(ING-03)와 레시피 상세(RCP-02)가 **같은 모양**을 쓴다.
 *
 *   ↻  최근 수정 08.18 09:10   [현재 매출 반영]                    ›
 *
 * 기획 §2. 반드시 한 줄이고, 행 전체가 눌린다.
 * 화면마다 따로 그리면 두 곳이 조금씩 달라진다 — 여기 하나만 둔다.
 */
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/kit';
import { T } from '@/theme/tokens';
import { changeTime, stateLabel, type LastChange } from '../hooks';

const TONE = {
  green: { fg: T.green, bg: T.greenTint },
  amber: { fg: T.amberText, bg: T.amberTint },
  neutral: { fg: T.sub2, bg: T.line2 },
} as const;

export function RecentChangeRow({ change, onPress }: { change: LastChange; onPress: () => void }) {
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
      accessibilityLabel={`${label} ${changeTime(change.occurredAt)}${s ? ` · ${s.text}` : ''}. 수정 내역 보기`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 13,
        paddingTop: 13,
        borderTopWidth: 1,
        borderTopColor: T.line2,
      }}
    >
      {/* 되돌아오는 화살표 — "값이 갱신됐다"를 한 글자로 말한다 */}
      <View
        style={{
          width: 22, height: 22, borderRadius: 11,
          alignItems: 'center', justifyContent: 'center', backgroundColor: T.blueTint,
        }}
      >
        <Icon name="history" size={14} color={T.blue} sw={2.2} />
      </View>

      <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }} numberOfLines={1}>
        {label} {changeTime(change.occurredAt)}
      </Text>

      {/* ⚠ 한 줄을 지켜야 한다. 배지가 길어지면 이름 쪽이 아니라 여기가 줄어든다. */}
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
        {!change.hasHistory ? (
          <Text style={{ fontSize: 13, color: T.ter }} numberOfLines={1}>아직 수정 없음</Text>
        ) : s && c ? (
          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: c.bg }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.fg }} numberOfLines={1}>
              {s.text}
            </Text>
          </View>
        ) : null}
      </View>

      <Icon name="chevron" size={16} color={T.ter} />
    </Pressable>
  );
}
