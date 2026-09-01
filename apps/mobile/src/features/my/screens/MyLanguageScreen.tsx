/** MY-08 앱 언어 — 매장 국가·통화·업무 로케일과 분리된 사용자별 선호다(INTL-1E). */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Icon, Notice, QueryState, Sheet } from '@/components/kit';
import {
  useSaveAppLanguage,
  useUserPreferences,
  type UserPreferencesContract,
} from '@/features/international-tax';
import { safeBack } from '@/lib/nav';
import { RpcError } from '@/lib/supabase';
import { T } from '@/theme/tokens';

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
  const [draft, setDraft] = useState<'ko' | 'en' | null>(initial.appLanguage);
  const [accepted, setAccepted] = useState(initial);
  const [baseRevision, setBaseRevision] = useState(initial.revision);
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
      setDraft(next.appLanguage);
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
    setDraft(response.data.appLanguage);
    setAccepted(response.data);
    setBaseRevision(response.data.revision);
    setConflict(false);
    setError(null);
    setConfirm(false);
    conflictBaseRevision.current = null;
  };

  const blocked = draft === null
    || !dirty
    || conflict
    || query.isError
    || save.isPending;

  const submit = () => {
    if (blocked || draft === null) return;
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
          <Text role="alert" style={{ color: T.red, fontWeight: '700' }}>
            저장하지 못했어요 · {error}
          </Text>
        ) : null}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {OPTIONS.map((option, index) => (
            <Pressable
              key={option.code}
              accessibilityRole="radio"
              accessibilityState={{
                checked: draft === option.code,
                disabled: save.isPending || conflict || query.isError,
              }}
              aria-checked={draft === option.code}
              accessibilityLabel={`${option.title} 선택`}
              disabled={save.isPending || conflict || query.isError}
              onPress={() => {
                setDraft(option.code);
                setError(null);
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
                borderBottomWidth: index === 0 ? 1 : 0, borderBottomColor: T.line2,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: T.ink }}>{option.title}</Text>
                <Text style={{ fontSize: 13, color: T.ter, marginTop: 3 }}>{option.sample}</Text>
              </View>
              <Icon name={draft === option.code ? 'check' : 'chevron'} size={20} color={draft === option.code ? T.blue : T.gray400} />
            </Pressable>
          ))}
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
