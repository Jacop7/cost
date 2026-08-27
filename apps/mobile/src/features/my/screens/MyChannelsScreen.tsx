/**
 * MY-07 판매 채널 — 이름과 사용 여부.
 *
 * ⚠ 수수료는 여기서 관리하지 않는다(0043). 플랫폼 수수료는 **고정 지출**의 한
 *   항목이고, 채널에도 요율을 두면 같은 돈이 손익에서 두 번 빠진다
 *   (실측: 19일간 503,397원 과소 계상).
 *
 * ⚠ 채널은 매장·배달·포장 **세 개로 고정**이다. daily_sales_items 가
 *   qty_hall / qty_delivery / qty_takeout 세 컬럼이라 네 번째를 만들어도
 *   수량을 넣을 곳이 없다. 그래서 추가 버튼을 두지 않는다.
 *
 * 채널을 지우지도 않는다. 과거 매출이 그 채널로 기록돼 있어서, 지우면
 * "어디서 팔았는지 모르는 매출"이 남는다. 안 쓰는 채널은 사용 중지로 감춘다.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useSaveChannel, useSettingsLists, type ChannelRow } from '@/features/master-data/hooks';

export default function MyChannelsScreen() {
  const lists = useSettingsLists();
  const saveChannel = useSaveChannel();

  const [editing, setEditing] = useState<ChannelRow | null>(null);
  const [name, setName] = useState('');

  const channels = lists.data?.channels ?? [];
  const nameError = name.trim() === '' ? '채널 이름을 입력해 주세요' : undefined;

  const openEdit = (c: ChannelRow) => { setEditing(c); setName(c.name); };

  const submit = () => {
    if (!editing || nameError) return;
    saveChannel.mutate(
      { id: editing.id, name: name.trim() },
      {
        onSuccess: () => setEditing(null),
        onError: (e) =>
          Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const toggleActive = (c: ChannelRow) => {
    const turningOff = c.active;
    const run = () =>
      saveChannel.mutate(
        { id: c.id, name: c.name, active: !c.active },
        {
          onError: (e) =>
            Alert.alert('바꾸지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
        },
      );

    if (!turningOff) { run(); return; }
    Alert.alert(
      `${c.name} 사용 안 함`,
      '지난 매출은 그대로 남고, 앞으로 매출 등록에서 이 채널이 보이지 않아요.',
      [{ text: '닫기', style: 'cancel' }, { text: '사용 안 함', style: 'destructive', onPress: run }],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="판매 채널" onBack={() => safeBack('/my')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 11 }}>
        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={channels.length === 0}
          onRetry={() => void lists.refetch()}
          emptyTitle="등록된 채널이 없어요"
          emptyHint="매장·배달·포장 세 채널이 기본으로 등록돼 있어야 해요"
        >
          {channels.map((c) => (
            <Card key={c.id} pad={0} style={{ overflow: 'hidden', opacity: c.active ? 1 : 0.55 }}>
              <Pressable
                onPress={() => openEdit(c)}
                accessibilityRole="button"
                accessibilityLabel={`${c.name} 이름 수정`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, paddingHorizontal: 15 }}
              >
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{c.name}</Text>
                  {!c.active ? <Badge tone="neutral" sm>사용 안 함</Badge> : null}
                </View>
                <Icon name="edit" size={17} color={T.ter} />
              </Pressable>
              <Pressable
                onPress={() => toggleActive(c)}
                accessibilityRole="button"
                accessibilityLabel={`${c.name} ${c.active ? '사용 안 함으로' : '사용함으로'} 바꾸기`}
                style={{ paddingVertical: 11, alignItems: 'center', borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2 }}>
                  {c.active ? '사용 안 함' : '다시 사용'}
                </Text>
              </Pressable>
            </Card>
          ))}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2, marginTop: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              배달앱 수수료는 <Text style={{ fontWeight: '700' }}>고정 지출</Text>의 ‘플랫폼 수수료’에서 관리해요.
              여기서도 받으면 같은 돈이 손익에서 두 번 빠져요.
            </Text>
          </View>
        </QueryState>
      </ScrollView>

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title="채널 이름">
        <Field label="이름" req error={name !== '' ? nameError : undefined}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="예) 배달앱"
            accessibilityLabel="채널 이름"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </Field>
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" size="lg" full onPress={() => setEditing(null)}>취소</Button>
          </View>
          <View style={{ flex: 2 }}>
            <Button kind="primary" size="lg" full loading={saveChannel.isPending} disabled={Boolean(nameError)} onPress={submit}>
              저장
            </Button>
          </View>
        </View>
      </Sheet>
    </View>
  );
}
