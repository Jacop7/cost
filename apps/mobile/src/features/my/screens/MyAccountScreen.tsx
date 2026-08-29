/**
 * MY-10 계정 관리 — 인증 계정과 영업 원장의 수명주기를 분리한다.
 * 탈퇴는 접근을 즉시 끊지만 매출·입고·재고 기록을 물리 삭제하지 않는다(0173).
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Field, Icon, Input, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { useRetireAccount } from '../hooks';

const CONFIRM_WORD = '탈퇴';

const messageOf = (error: unknown): string =>
  error instanceof Error && error.message.trim() !== ''
    ? error.message
    : '잠시 후 다시 시도해 주세요.';

export default function MyAccountScreen() {
  const retire = useRetireAccount();
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (retire.isPending) return;
    setConfirming(false);
    setWord('');
    setError(null);
  };

  const open = () => {
    if (retire.isPending) return;
    setWord('');
    setError(null);
    setConfirming(true);
  };

  const submit = () => {
    if (retire.isPending || word !== CONFIRM_WORD) return;
    setError(null);
    retire.mutate(undefined, {
      // 성공하면 전역 세션 게이트가 로그인 화면으로 전환한다. 시트를 먼저 닫아 성공처럼 위장하지 않는다.
      onError: (e) => setError(messageOf(e)),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="계정 관리" onBack={() => { if (!retire.isPending) safeBack('/my'); }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        <Card pad={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: T.redTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="user" size={22} color={T.red} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink }}>계정 탈퇴</Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: T.sub2, marginTop: 2 }}>앱과 매장 데이터에 대한 접근이 즉시 종료돼요.</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: T.line2, marginVertical: 16 }} />
          <Text style={{ fontSize: 15, lineHeight: 23, color: T.sub }}>
            매출·입고·재고 원장은 운영 기록과 감사 근거이므로 탈퇴와 동시에 물리 삭제하지 않고 보존해요.
            다시 로그인하거나 기존 매장에 접근할 수는 없어요.
          </Text>
          <Button kind="danger" full size="lg" onPress={open} style={{ marginTop: 18 }}>계정 탈퇴</Button>
        </Card>
      </ScrollView>

      <Sheet visible={confirming} onClose={close} title="계정을 탈퇴할까요?" sub="완료하면 되돌릴 수 없어요" height={430} scroll={false}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: T.sub, marginBottom: 16 }}>
            계속하려면 아래에 ‘탈퇴’를 입력해 주세요. 영업 원장은 보존되지만 계정과 기존 매장 접근은 즉시 사라져요.
          </Text>
          <Field label="확인 문구" error={error ?? undefined}>
            <Input
              value={word}
              placeholder="탈퇴"
              disabled={retire.isPending}
              error={error !== null}
              accessibilityLabel="탈퇴 확인 문구"
              onChangeText={(next) => { setWord(next); setError(null); }}
              onSubmitEditing={submit}
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
            <View style={{ flex: 1 }}><Button kind="ghost" full size="lg" disabled={retire.isPending} onPress={close}>취소</Button></View>
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
