/**
 * MY-10 계정 관리 — 인증 계정과 영업 원장의 수명주기를 분리한다.
 * 탈퇴는 접근을 즉시 끊지만 매출·입고·재고 기록을 물리 삭제하지 않는다(0173).
 */
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Field, Input, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, TYPE, space } from '@/theme/tokens';
import { useRetireAccount } from '../hooks';

const CONFIRM_WORD = '탈퇴';

const messageOf = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== ''
    ? error.message
    : '잠시 후 다시 시도해 주세요.';

export default function MyAccountScreen() {
  const retire = useRetireAccount();
  const submitting = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (retire.isPending || submitting.current) return;
    setConfirming(false);
    setWord('');
    setError(null);
  };

  const open = () => {
    if (retire.isPending || submitting.current) return;
    setWord('');
    setError(null);
    setConfirming(true);
  };

  const submit = () => {
    if (retire.isPending || submitting.current || word !== CONFIRM_WORD) return;
    submitting.current = true;
    setError(null);
    retire.mutate(undefined, {
      // 성공하면 전역 세션 게이트가 로그인 화면으로 전환한다. 시트를 먼저 닫아 성공처럼 위장하지 않는다.
      onError: (e) => { submitting.current = false; setError(messageOf(e)); },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="계정 관리" onBack={() => { if (!retire.isPending && !submitting.current) safeBack('/my'); }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: LAYOUT.scroll.start, paddingBottom: LAYOUT.scroll.end, gap: space.md }}>
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
