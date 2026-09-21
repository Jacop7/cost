/** MY-08 앱 언어 — 매장 국가·통화·업무 로케일과 분리된 사용자별 선호다(INTL-1E). */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Icon, Notice, QueryState, Sheet } from '@/components/kit';
import { SelectionRow } from '@/components/kit/SelectionRow';
import {
  useSaveAppLanguage,
  useUserPreferences,
  type UserPreferencesContract,
} from '@/features/international-tax';
import { safeBack } from '@/lib/nav';
import { RpcError } from '@/lib/supabase';
import { COLOR, T, TYPE, minTouchTarget } from '@/theme/tokens';

const OPTIONS = [
  { code: 'ko' as const, title: '한국어', sample: '한국어 선호로 저장해요' },
  { code: 'en' as const, title: 'English', sample: '영어 선호로 저장해요 · 화면 번역은 준비 중이에요' },
];

export default function MyLanguageScreen() {
  const query = useUserPreferences();

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="앱 언어" onBack={() => safeBack('/my')} />
      <QueryState
        isLoading={query.isLoading}
        error={query.data ? null : query.error}
        isEmpty={false}
        onRetry={() => void query.refetch()}
        emptyTitle="언어 설정이 없어요"
      >
        {query.data ? <LanguageEditor initial={query.data} query={query} /> : null}
      </QueryState>
    </View>
  );
}

function LanguageEditor({
  initial,
  query,
}: {
  initial: UserPreferencesContract;
  query: ReturnType<typeof useUserPreferences>;
}) {
  const save = useSaveAppLanguage();
  const [draft, setDraft] = useState<'ko' | 'en'>(initial.appLanguage ?? 'ko');
  const [accepted, setAccepted] = useState(initial);
  const [baseRevision, setBaseRevision] = useState(initial.revision);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(initial.revision);
  const conflictBaseRevision = useRef<number | null>(null);
  const dirty = draft !== accepted.appLanguage;

  useEffect(() => {
    const next = query.data;
    if (!next || next.revision <= seen.current) return;
    seen.current = next.revision;
    if (!dirty && !save.isPending && !confirm) {
      setDraft(next.appLanguage ?? 'ko');
      setAccepted(next);
      setBaseRevision(next.revision);
      setConflict(false);
      conflictBaseRevision.current = null;
    } else {
      conflictBaseRevision.current ??= baseRevision;
      setConflict(true);
    }
  }, [query.data, dirty, save.isPending, confirm, baseRevision]);

  const refresh = async () => {
    const response = await query.refetch();
    if (response.isError || !response.data) return;
    const minimum = conflictBaseRevision.current ?? baseRevision;
    if (conflict && response.data.revision <= minimum) return;
    if (response.data.revision < seen.current) return;
    seen.current = response.data.revision;
    setDraft(response.data.appLanguage ?? 'ko');
    setAccepted(response.data);
    setBaseRevision(response.data.revision);
    setConflict(false);
    setError(null);
    setConfirm(false);
    conflictBaseRevision.current = null;
  };

  const blocked = !dirty
    || conflict
    || query.isError
    || save.isPending;

  const submit = () => {
    if (blocked) return;
    setError(null);
    save.mutate(
      { appLanguage: draft, baseRevision },
      {
        onSuccess: (result) => {
          seen.current = result.revision;
          setAccepted(result);
          setBaseRevision(result.revision);
          setConfirm(false);
          safeBack('/my');
        },
        onError: (cause) => {
          if (cause instanceof RpcError && cause.code === '45009') {
            conflictBaseRevision.current = baseRevision;
            setConflict(true);
            setConfirm(false);
            return;
          }
          setConfirm(false);
          setError(cause instanceof Error ? cause.message : '잠시 후 다시 시도해 주세요');
        },
      },
    );
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}>
        <Notice>지금은 언어 선호만 저장해요. 화면 번역은 준비 중이며 매장 국가·통화·세금·시간대는 바뀌지 않아요.</Notice>
        {accepted.needsConfirmation ? (
          <Notice>기존 언어를 자동으로 옮길 수 없었어요. 사용할 언어를 확인해 주세요.</Notice>
        ) : null}
        {query.isError ? (
          <View role="status">
            <Notice>최신 언어 설정을 불러오지 못했어요. 다시 확인하기 전에는 저장할 수 없어요.</Notice>
            <Button kind="gray" size="md" onPress={() => void query.refetch()}>다시 시도</Button>
          </View>
        ) : null}
        {conflict ? (
          <View role="status">
            <Notice>다른 기기에서 앱 언어가 변경됐어요. 새로고침 후 다시 저장해 주세요.</Notice>
            <Button kind="gray" size="md" onPress={() => void refresh()}>새로고침</Button>
          </View>
        ) : null}
        {error ? (
          <Text role="alert" style={{ color: COLOR.status.negative, fontWeight: '700' }}>
            저장하지 못했어요 · {error}
          </Text>
        ) : null}
        <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>언어</Text>
        <Card>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="앱 언어 선택"
            disabled={save.isPending || conflict || query.isError}
            onPress={() => setLanguageOpen(true)}
            style={{ minHeight: minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <Text style={{ ...TYPE.body, color: T.ink, flex: 1 }}>{OPTIONS.find(option => option.code === draft)?.title ?? '한국어'}</Text>
            <Icon name="chevronDown" size={20} color={COLOR.text.tertiary} />
          </Pressable>
        </Card>
        <Button
          kind="primary"
          size="lg"
          full
          disabled={blocked}
          onPress={() => setConfirm(true)}
          accessibilityLabel="저장"
        >
          저장
        </Button>
      </ScrollView>
      <Sheet visible={languageOpen} onClose={() => setLanguageOpen(false)} title="언어 선택">
        {OPTIONS.map((option, index) => (
          <SelectionRow
            key={option.code}
            label={option.title}
            description={option.sample}
            selected={draft === option.code}
            last={index === OPTIONS.length - 1}
            accessibilityLabel={`${option.title} 선택`}
            disabled={save.isPending || conflict || query.isError}
            onPress={() => {
              setDraft(option.code);
              setError(null);
              setLanguageOpen(false);
            }}
          />
        ))}
      </Sheet>
      <Sheet
        visible={confirm}
        onClose={() => { if (!save.isPending) setConfirm(false); }}
        title="앱 언어를 바꿀까요?"
      >
        <Text style={{ fontSize: 15, color: T.sub2, lineHeight: 22, marginBottom: 16 }}>
          이 계정의 언어 선호를 {draft === 'ko' ? '한국어' : 'English'}로 저장합니다. 화면 번역은 준비 중이며 매장 통화와 세금 기록은 그대로예요.
        </Text>
        <Button
          kind="primary"
          size="lg"
          full
          loading={save.isPending}
          disabled={save.isPending || conflict || query.isError}
          onPress={submit}
          accessibilityLabel="앱 언어 저장 확정"
        >
          확정
        </Button>
      </Sheet>
    </>
  );
}
