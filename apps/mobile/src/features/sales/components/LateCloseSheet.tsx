/**
 * 늦은 개점 — 오늘 마칠 시간 고르기 (0162, 검토 P1-4).
 *
 * 규칙상 오늘 영업이 이미 끝난 시각에 시작하면 서버가 45015 로 "종료 시간을
 * 골라 주세요"라고 답한다. 여기서 고른 시간은 **그 영업일에만** 적용되고
 * 주간 설정은 안 바뀐다. 새벽 시각(예: 01:30)은 서버가 다음 날로 해석한다.
 *
 * 기본값: 매장 현지 지금 + 1시간을 15분 단위로 올림 — 서버 권장안 그대로.
 */
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, Sheet } from '@/components/kit';
import { T } from '@/theme/tokens';
import { QUARTER_SLOTS, normalizeTimeInput } from '@/features/my/weeklySchedule';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 매장 현지 지금 + 1시간, 15분 올림. 시간대를 못 읽으면 null — 기본값 없이 고르게 한다. */
export function lateCloseDefault(timezone: string, plusMinutes = 60): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const total = (h * 60 + m + plusMinutes + 14) - ((h * 60 + m + plusMinutes + 14) % 15);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

export function LateCloseSheet({ visible, timezone, loading, onCancel, onConfirm }: {
  visible: boolean;
  /** 매장 시간대 — 기본값 제안이 **매장 현지** 기준이어야 한다(기기 시간대가 아니다). */
  timezone: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (closeTime: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [warn, setWarn] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setPicked(lateCloseDefault(timezone)); setTyped(''); setWarn(null); }
  }, [visible, timezone]);

  const confirm = () => {
    const t = typed.trim() !== '' ? normalizeTimeInput(typed) : picked;
    if (t === null) { setWarn('시각은 HH:MM 으로 적어 주세요'); return; }
    onConfirm(t);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="오늘은 몇 시까지 하실까요?"
      sub="영업시간이 이미 지나 오늘 마칠 시간이 필요해요 · 오늘만 적용돼요"
      height="72%"
    >
      <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 11, alignItems: 'center' }}>
        <TextInput
          value={typed}
          onChangeText={(v) => { setTyped(v); setWarn(null); }}
          placeholder={picked ? `직접 입력 · 예) ${picked}` : '직접 입력 · 예) 01:30'}
          placeholderTextColor={T.ter}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="마칠 시각 직접 입력"
          style={{ flex: 1, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontSize: 15, color: T.ink, backgroundColor: T.surface }}
        />
        <Button kind="primary" size="sm" loading={loading} onPress={confirm}>
          이 시간으로 시작
        </Button>
      </View>
      {warn ? <Text style={{ fontSize: 13.5, color: T.red, paddingBottom: 8 }}>{warn}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingBottom: 24 }}>
        {QUARTER_SLOTS.map((t) => {
          const on = t === picked && typed.trim() === '';
          return (
            <Pressable
              key={t}
              onPress={() => { setPicked(t); setTyped(''); setWarn(null); }}
              accessibilityRole="button" accessibilityLabel={t}
              accessibilityState={{ selected: on }}
              style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: on ? T.blue : T.line, backgroundColor: on ? T.blueTint : T.surface }}
            >
              <Text style={[{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? T.blue : T.sub2 }, NUM]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
