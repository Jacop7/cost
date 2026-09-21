/** MY-07 판매 채널 — 기본 3개와 사용자 채널을 합쳐 최대 5개까지 관리한다. */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ActionSheet, AppHeader, Button, Card, CardFooterAction, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { safeBack } from '@/lib/nav';
import { COLOR, COMPONENT, LAYOUT, T, TYPE, space } from '@/theme/tokens';
import {
  useCreateSalesChannel,
  useDeleteSalesChannel,
  useRestoreSalesChannel,
  useSalesChannelSettings,
  type ChannelRow,
} from '@/features/master-data/hooks';

const mutationMessage = (error: unknown) =>
  error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요';

const CHANNEL_LOCK_GUIDANCE = [
  '현재 입력 중인 매출 내역이 있어 판매 채널을 삭제하거나 추가할 수 없습니다.',
  '매출 등록을 완료하거나 초기화한 후 다시 시도해 주세요.',
] as const;

function ChannelLockGuidance() {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={{ backgroundColor: COLOR.action.primaryTint, borderWidth: 1, borderColor: COMPONENT.notice.border,
      borderRadius: 12, paddingVertical: 10, paddingHorizontal: space.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`필독사항 ${expanded ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded }} aria-expanded={expanded} onPress={() => setExpanded(value => !value)}
        style={{ minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="info" size={18} color={COLOR.action.primary} fill />
        <Text style={{ ...TYPE.caption, flex: 1, fontWeight: '800', color: COLOR.action.onTint }}>필독사항</Text>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={16} color={COLOR.action.onTint} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: space.sm, gap: 5 }}>
          {CHANNEL_LOCK_GUIDANCE.map(line => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Text style={{ ...TYPE.caption, color: COLOR.action.onTint }}>-</Text>
              <Text style={{ ...TYPE.caption, flex: 1, color: COLOR.action.onTint }}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function MyChannelsScreen() {
  const settings = useSalesChannelSettings();
  const createChannel = useCreateSalesChannel();
  const deleteChannel = useDeleteSalesChannel();
  const restoreChannel = useRestoreSalesChannel();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [menuFor, setMenuFor] = useState<ChannelRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<ChannelRow | null>(null);

  const data = settings.data;
  const channels = data?.channels ?? [];
  const active = channels.filter(channel => channel.active);
  const retired = channels.filter(channel => !channel.active);
  const pending = createChannel.isPending || deleteChannel.isPending || restoreChannel.isPending;
  const locked = data?.lockedByDraft === true;
  const limitReached = (data?.activeCount ?? 0) >= (data?.maxActive ?? 5);
  const nameError = name.trim() === '' ? '채널 이름을 입력해 주세요' : undefined;

  const add = () => {
    if (!data || nameError || pending || locked || limitReached) return;
    createChannel.mutate({ name: name.trim(), expectedRevision: data.revision }, {
      onSuccess: () => { setAdding(false); setName(''); },
      onError: error => Alert.alert('추가하지 못했어요', mutationMessage(error)),
    });
  };

  const remove = () => {
    if (!data || !deleteFor || pending || locked) return;
    deleteChannel.mutate({ id: deleteFor.id, expectedRevision: data.revision }, {
      onSuccess: result => {
        setDeleteFor(null);
        const action = (result as { action?: string } | null)?.action;
        if (action === 'retired') Alert.alert('판매 채널을 삭제했어요', '과거 판매 기록에는 당시 채널명이 유지됩니다.');
      },
      onError: error => Alert.alert('삭제하지 못했어요', mutationMessage(error)),
    });
  };

  const restore = (channel: ChannelRow) => {
    if (!data || pending || locked || limitReached) return;
    restoreChannel.mutate({ id: channel.id, expectedRevision: data.revision }, {
      onError: error => Alert.alert('복구하지 못했어요', mutationMessage(error)),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="판매 채널" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
        {locked ? <ChannelLockGuidance /> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.secondary }}>사용 중</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.accent }}>{data?.activeCount ?? 0}/{data?.maxActive ?? 5}</Text>
        </View>

        <QueryState isLoading={settings.isLoading} error={settings.error} isEmpty={channels.length === 0}
          onRetry={() => void settings.refetch()} emptyTitle="등록된 채널이 없어요"
          emptyHint="매장·배달·포장 채널을 다시 불러와 주세요">
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {active.map(channel => (
              <View key={channel.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
                minHeight: 60, paddingHorizontal: space.lg,
                borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>{channel.name}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`${channel.name} 더보기`}
                  disabled={pending} onPress={() => setMenuFor(channel)}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pending ? 0.35 : 1 }}>
                  <Icon name="more" size={20} color={COLOR.text.tertiary} />
                </Pressable>
              </View>
            ))}
            <CardFooterAction tone="accent" icon="plus" accessibilityLabel="채널 추가"
              disabled={pending || locked || limitReached} onPress={() => setAdding(true)}>
              채널 추가
            </CardFooterAction>
          </Card>

          {retired.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: T.ink }}>사용하지 않는 채널</Text>
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {retired.map((channel, index) => (
                  <View key={channel.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56,
                    paddingHorizontal: space.lg, borderBottomWidth: index < retired.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: COLOR.text.tertiary }}>{channel.name}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${channel.name} 다시 사용`}
                      disabled={pending || locked || limitReached} onPress={() => restore(channel)}
                      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm,
                        opacity: pending || locked || limitReached ? 0.35 : 1 }}>
                      <Text style={{ color: COLOR.text.link, fontWeight: '700' }}>다시 사용</Text>
                    </Pressable>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

        </QueryState>
      </ScrollView>

      <ActionSheet
        floating
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        items={[{
          label: '삭제',
          accessibilityLabel: `${menuFor?.name ?? '판매 채널'} 삭제`,
          danger: true,
          disabled: pending || locked || active.length <= 1,
          onPress: () => {
            const channel = menuFor;
            if (channel) setDeleteFor(channel);
          },
        }]}
      />

      <Sheet visible={adding} onClose={() => { setAdding(false); setName(''); }} title="판매 채널 추가">
        <Field label="채널 이름" req variant="stacked" error={name !== '' ? nameError : undefined}>
          <Input variant="stacked" value={name} onChangeText={setName} placeholder="예) 쿠팡이츠"
            accessibilityLabel="판매 채널 이름" returnKeyType="done" onSubmitEditing={add} />
        </Field>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Button kind="gray" size="lg" full onPress={() => { setAdding(false); setName(''); }}>취소</Button></View>
          <View style={{ flex: 1 }}><Button kind="primary" size="lg" full loading={createChannel.isPending}
            disabled={Boolean(nameError)} onPress={add}>추가</Button></View>
        </View>
      </Sheet>

      <ConfirmDialog visible={deleteFor !== null} title="판매 채널 삭제"
        message={`${deleteFor?.name ?? ''}\n\n판매 기록이 있으면 과거 내역에는 유지되고 새 매출 작성에서만 숨겨집니다.`}
        confirmText="삭제" closeLabel="판매 채널 삭제 확인 닫기" loading={deleteChannel.isPending}
        onCancel={() => setDeleteFor(null)} onConfirm={remove} />
    </View>
  );
}
