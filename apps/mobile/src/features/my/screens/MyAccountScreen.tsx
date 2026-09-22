/**
 * MY-10 계정 관리 — 인증 계정과 영업 원장의 수명주기를 분리한다.
 * 탈퇴는 접근을 즉시 끊지만 매출·입고·재고 기록을 물리 삭제하지 않는다(0173).
 */
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Field, Input, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, TYPE, space } from '@/theme/tokens';
import { useSessionState } from '@/lib/SessionProvider';
import { AppleSignInButton } from '@/lib/AppleSignInButton';
import type { SocialAvailability, SocialProvider } from '@/lib/socialAuthTypes';
import { AppleRetirementPreparationError, useLinkedAuthMethods, useRetireAccount } from '../hooks';
import type { RetireAccountRequest } from '../hooks';

const CONFIRM_WORD = '탈퇴';

const messageOf = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== ''
    ? error.message
    : '잠시 후 다시 시도해 주세요.';

export default function MyAccountScreen() {
  const session = useSessionState();
  const identities = useLinkedAuthMethods(session.userId);
  const retire = useRetireAccount();
  const submitting = useRef(false);
  const confirmedTarget = useRef<Pick<RetireAccountRequest, 'confirmedOwnerId' | 'confirmedSessionGeneration'> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [manualRevocation, setManualRevocation] = useState(false);
  const [linking, setLinking] = useState<SocialProvider | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [social, setSocial] = useState<SocialAvailability>({ google: false, apple: false });

  useEffect(() => {
    let active = true;
    void session.socialAvailability().then((available) => { if (active) setSocial(available); });
    return () => { active = false; };
  }, [session.socialAvailability]);

  const connect = async (provider: SocialProvider) => {
    if (linking !== null || retire.isPending) return;
    setLinking(provider);
    setLinkError(null);
    const result = await session.linkSocial(provider);
    setLinkError(result);
    if (result === null) await identities.refetch();
    setLinking(null);
  };

  const close = () => {
    if (retire.isPending || submitting.current) return;
    setConfirming(false);
    setWord('');
    setError(null);
    setManualRevocation(false);
    confirmedTarget.current = null;
  };

  const open = () => {
    if (retire.isPending || submitting.current) return;
    setWord('');
    setError(null);
    setManualRevocation(false);
    setConfirming(true);
  };

  const submit = () => {
    if (retire.isPending || submitting.current || word !== CONFIRM_WORD) return;
    if (session.userId === null || session.sessionGeneration === undefined) {
      setError('로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.');
      return;
    }
    const target = {
      confirmedOwnerId: session.userId,
      confirmedSessionGeneration: session.sessionGeneration,
    };
    confirmedTarget.current = target;
    submitting.current = true;
    setError(null);
    setManualRevocation(false);
    retire.mutate(target, {
      // 성공하면 전역 세션 게이트가 로그인 화면으로 전환한다. 시트를 먼저 닫아 성공처럼 위장하지 않는다.
      onError: (e) => {
        submitting.current = false;
        setError(messageOf(e));
        setManualRevocation(e instanceof AppleRetirementPreparationError && e.manualAllowed);
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="계정 관리" onBack={() => { if (!retire.isPending && !submitting.current) safeBack('/my'); }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
        <Card pad={16} style={{ gap: space.md }}>
          <Text style={{ ...TYPE.body, fontWeight: '700', color: T.ink }}>로그인 방법</Text>
          <Text style={{ ...TYPE.caption, color: T.sub }}>내부 사용자 ID · {session.userId ?? '확인 중'}</Text>
          <Text style={{ ...TYPE.body, color: T.ink }}>
            연결됨 · {identities.isLoading ? '확인 중' : identities.isError ? '불러오지 못함'
              : (identities.data ?? []).map((provider) => provider === 'email' ? '이메일'
                : provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : provider).join(' · ') || '확인 중'}
          </Text>
          {(social.google && !identities.data?.includes('google')) ? (
            <Button kind="gray" full size="md" loading={linking === 'google'} disabled={linking !== null}
              onPress={() => { void connect('google'); }}>Google 계정 연결</Button>
          ) : null}
          {(social.apple && !identities.data?.includes('apple')) ? (
            <AppleSignInButton disabled={linking !== null} onPress={() => { void connect('apple'); }} />
          ) : null}
          {linkError ? <Text accessibilityRole="alert" style={{ ...TYPE.caption, color: COLOR.status.negative }}>{linkError}</Text> : null}
          <Text style={{ ...TYPE.caption, color: T.sub }}>
            기존 매장을 유지하려면 이 화면에서 로그인 방식을 연결해 주세요. 이미 다른 계정에 연결된 방식은 고객 지원 확인이 필요해요.
          </Text>
        </Card>
        <Card pad={16}>
          <Text style={{ ...TYPE.body, fontWeight: '700', color: COLOR.status.negative }}>계정 탈퇴</Text>
          <Text style={{ ...TYPE.caption, color: T.sub, marginVertical: space.md }}>앱과 매장 데이터에 대한 접근이 즉시 종료돼요.</Text>
          <Text style={{ ...TYPE.caption, color: T.sub }}>
            매출·입고·재고 원장은 운영 기록과 감사 근거이므로 탈퇴와 동시에 물리 삭제하지 않고 보존해요.
            다시 로그인하거나 기존 매장에 접근할 수는 없어요.
          </Text>
          <Button kind="danger" full size="md" onPress={open} style={{ marginTop: space.lg, backgroundColor: T.surface,
            borderWidth: 1, borderColor: COLOR.status.negativeTint }}>계정 탈퇴</Button>
        </Card>
      </ScrollView>

      <Sheet visible={confirming} onClose={close} title="계정을 탈퇴할까요?" sub="완료하면 되돌릴 수 없어요">
        <View>
          <Field label="확인 문구" error={error ?? undefined} variant="stacked">
            <Input
              value={word}
              placeholder="탈퇴"
              variant="stacked"
              disabled={retire.isPending}
              error={error !== null}
              accessibilityLabel="탈퇴 확인 문구"
              onChangeText={(next) => { setWord(next); setError(null); }}
              onSubmitEditing={submit}
            />
          </Field>
          <Text style={{ ...TYPE.caption, color: T.sub, marginBottom: space.md }}>
            영업 원장은 보존되지만 계정과 기존 매장 접근은 즉시 사라져요.
          </Text>
          {manualRevocation ? (
            <View style={{ gap: space.sm, marginBottom: space.md }}>
              <Text style={{ ...TYPE.caption, color: T.sub }}>
                Apple 연결 해제가 자동으로 완료되지 않았어요. 계정 탈퇴를 계속한 뒤 iPhone 설정의 Apple 계정 → Apple로 로그인에서 코스트킵 접근을 직접 해제해 주세요.
              </Text>
              <Button kind="gray" full size="md" disabled={word !== CONFIRM_WORD || retire.isPending}
                onPress={() => {
                  if (submitting.current || retire.isPending) return;
                  const target = confirmedTarget.current;
                  if (target === null) {
                    setError('로그인 정보를 다시 확인해 주세요.');
                    return;
                  }
                  submitting.current = true;
                  setError(null);
                  retire.mutate({ ...target, allowManualAppleRevocation: true }, {
                    onError: (cause) => { submitting.current = false; setError(messageOf(cause)); },
                  });
                }}>직접 연결 해제하고 탈퇴</Button>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><Button kind="gray" full size="lg" disabled={retire.isPending} onPress={close}>취소</Button></View>
            <View style={{ flex: 1 }}>
              <Button
                kind="danger"
                full
                size="lg"
                accessibilityLabel="계정 탈퇴 확정"
                disabled={word !== CONFIRM_WORD}
                loading={retire.isPending}
                onPress={submit}
              >탈퇴하기</Button>
            </View>
          </View>
        </View>
      </Sheet>
    </View>
  );
}
