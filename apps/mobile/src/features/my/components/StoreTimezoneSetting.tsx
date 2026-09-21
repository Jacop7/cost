import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, FilterChip, Icon, QueryState, Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { useHoursStatus, useSetStoreTimezone } from '@/features/settings/hooks';
import { COLOR, TYPE, minTouchTarget, space } from '@/theme/tokens';

const TIMEZONE_COUNTRIES = [
  { key: 'KR', label: '한국', timezones: ['Asia/Seoul'] },
  { key: 'US', label: '미국', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'] },
  { key: 'GB', label: '영국', timezones: ['Europe/London'] },
  { key: 'AU', label: '호주', timezones: ['Australia/Sydney', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Perth'] },
  { key: 'CA', label: '캐나다', timezones: ['America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'America/Halifax', 'America/St_Johns'] },
] as const;

const TIMEZONE_CITIES: Record<string, string> = {
  'Asia/Seoul': '서울', 'Asia/Tokyo': '도쿄', 'Asia/Shanghai': '상하이',
  'Asia/Singapore': '싱가포르', 'Asia/Bangkok': '방콕',
  'America/New_York': '뉴욕', 'America/Los_Angeles': '로스앤젤레스',
  'America/Chicago': '시카고', 'America/Denver': '덴버',
  'Europe/London': '런던', 'Australia/Sydney': '시드니', 'Australia/Adelaide': '애들레이드',
  'Australia/Brisbane': '브리즈번', 'Australia/Perth': '퍼스',
  'America/Toronto': '토론토', 'America/Winnipeg': '위니펙', 'America/Edmonton': '에드먼턴',
  'America/Vancouver': '밴쿠버', 'America/Halifax': '핼리팩스', 'America/St_Johns': '세인트존스', UTC: 'UTC',
};

function countryForTimezone(timezone?: string): string {
  return TIMEZONE_COUNTRIES.find(country => country.timezones.some(item => item === timezone))?.key ?? 'KR';
}

function timezoneOffset(timezone: string): string {
  try {
    const name = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
    return name === 'GMT' ? 'UTC+0' : name.replace('GMT', 'UTC');
  } catch { return 'UTC'; }
}

function timezoneLabel(timezone: string): string {
  const fallback = timezone.split('/').at(-1)?.replaceAll('_', ' ') || timezone;
  return `${TIMEZONE_CITIES[timezone] ?? fallback} · ${timezoneOffset(timezone)}`;
}

function timezoneNow(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
    return `현재 ${value('dayPeriod') === 'AM' ? '오전' : '오후'} ${value('hour')}:${value('minute')}`;
  }
  catch { return '현재 시각을 확인할 수 없어요'; }
}

function deviceTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timezone === 'string' && timezone.trim() ? timezone : null;
  } catch {
    return null;
  }
}

/** 국가·통화와 함께 관리하는 매장 현지 시간대. 서버의 영업일 계산 계약은 그대로 사용한다. */
export function StoreTimezoneSetting({ embedded = false }: { embedded?: boolean }) {
  const status = useHoursStatus();
  const saveTimezone = useSetStoreTimezone();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState(() => countryForTimezone(status.data?.timezone));
  const [message, setMessage] = useState<string | null>(null);
  const store = status.data;
  const device = deviceTimezone();

  const choose = (timezone: string) => {
    setOpen(false);
    saveTimezone.mutate(timezone, {
      onSuccess: () => setMessage(`시간대를 ${timezoneLabel(timezone)}로 저장했어요.`),
      onError: (error) => {
        const text = error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요';
        Alert.alert('시간대를 바꾸지 못했어요', text);
        setMessage(text);
      },
    });
  };

  const openTimezoneSheet = () => {
    setCountry(countryForTimezone(store?.timezone));
    setOpen(true);
  };
  const choices = TIMEZONE_COUNTRIES.find(item => item.key === country)?.timezones ?? TIMEZONE_COUNTRIES[0].timezones;

  return <View style={{ gap: space.md }}>
    <QueryState
      isLoading={status.isLoading}
      error={status.error}
      isEmpty={false}
      onRetry={() => void status.refetch()}
      emptyTitle="시간대를 불러오지 못했어요"
    >
      {store && !store.timezoneConfirmed && device ? <Card pad={0} style={{ overflow: 'hidden', borderColor: COLOR.action.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg }}>
          <Icon name="info" size={18} color={COLOR.action.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...TYPE.caption, fontWeight: '800', color: COLOR.text.accent }}>매장 시간대를 정해 주세요</Text>
            <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, marginTop: space.xs }}>기기 시간대는 {device} 예요.</Text>
          </View>
          <Button kind="primary" size="sm" loading={saveTimezone.isPending} onPress={() => choose(device)}>기기 시간대 사용</Button>
        </View>
      </Card> : null}

      {embedded ? <Pressable
          onPress={openTimezoneSheet}
          accessibilityRole="button"
          accessibilityLabel="시간대 선택"
          style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg }}
        >
          <Text style={{ ...TYPE.bodyWeak, color: COLOR.text.secondary }}>시간대</Text>
          <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1, textAlign: 'right' }}>{timezoneLabel(store?.timezone ?? 'Asia/Seoul')}</Text>
          <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
        </Pressable> : <Card pad={0} style={{ overflow: 'hidden' }}><Pressable
          onPress={openTimezoneSheet} accessibilityRole="button" accessibilityLabel="시간대 선택"
          style={{ minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.lg }}>
          <Text style={{ ...TYPE.bodyWeak, color: COLOR.text.secondary, flex: 1 }}>시간대</Text>
          <Text style={{ ...TYPE.body, color: COLOR.text.primary }}>{timezoneLabel(store?.timezone ?? 'Asia/Seoul')}</Text>
          <Icon name="chevron" size={16} color={COLOR.text.tertiary} />
        </Pressable></Card>}
      {message ? <Text role="status" style={{ ...TYPE.caption, color: COLOR.text.accent }}>{message}</Text> : null}
    </QueryState>

    <Sheet visible={open} onClose={() => setOpen(false)} title="매장 시간대" height="72%">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
        {TIMEZONE_COUNTRIES.map(item => <FilterChip
          key={item.key}
          label={item.label}
          accessibilityLabel={item.label}
          selected={country === item.key}
          onPress={() => setCountry(item.key)}
          paddingHorizontal={space.md}
        />)}
      </ScrollView>
      {choices.map((timezone, index) => {
        const selected = timezone === store?.timezone;
        return <SelectionRow
          key={timezone}
          onPress={() => choose(timezone)}
          label={timezoneLabel(timezone)}
          accessibilityLabel={timezoneLabel(timezone)}
          description={`${timezoneNow(timezone)}${timezone === device ? ' · 기기' : ''}`}
          selected={selected}
          last={index === choices.length - 1}
        />;
      })}
      <View style={{ height: space.xxl }} />
    </Sheet>
  </View>;
}
