/**
 * MY > 세금 — 매장 하나에 하나다(0087).
 *
 * 규칙은 하나다 — **판매가 × Σ(항목 요율)**(0090).
 * 포함/별도/면세 세 갈래는 없앴다. 사장님이 답해야 할 질문이 하나 더 생기는 것이었다.
 * 항목이 없으면 0원이고, 그게 면세다.
 *
 * ⚠ 부가세 포함 가격이면 **9.09%** 다(10/110). 10 을 적으면 메뉴당 109원이 더 빠진다.
 *
 * 고정 지출과 **같은 짜임**이다 —
 *   저장 → 전 레시피 손익 재계산 → 각 메뉴의 손익 변동에 '세금 반영' 한 줄.
 *
 * ⚠ 배달 중개 수수료는 여기가 아니라 **고정 지출**이다(0043).
 *   두 곳에 넣으면 같은 돈이 손익에서 두 번 빠진다(실측 19일 503,397원).
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Icon, Input, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { T, tnum } from '@/theme/tokens';
import { useSaveStoreTax, useStoreSettings } from '../hooks';

interface Row { name: string; rate: string }

export default function MyTaxScreen() {
  const settings = useStoreSettings();
  const save = useSaveStoreTax();

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 서버 값으로 한 번만 채운다. 매번 덮으면 입력 중에 글자가 되돌아간다.
  useEffect(() => {
    const s = settings.data;
    if (!s || loaded) return;
    setRows(s.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })));
    setLoaded(true);
  }, [settings.data, loaded]);

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const nameError = rows.some((t) => t.name.trim() === '') ? '항목 이름을 입력해 주세요' : undefined;
  const rateError = rows.some((t) => num(t.rate) < 0 || num(t.rate) >= 100)
    ? '요율은 0 이상 100 미만이어야 해요'
    : undefined;
  const error = nameError ?? rateError;

  /** 세금 = 적은 항목의 합. 서버 `tax_of()` 와 같은 공식이다(절대원칙 3). */
  const rate = rows.reduce((a, t) => a + num(t.rate) / 100, 0);

  const onSave = () => {
    if (error) return;
    save.mutate(
      rows.map((t) => ({ name: t.name.trim(), rate: num(t.rate) })),
      {
        onSuccess: (res) => {
          safeBack('/my');
          if (res.changed) {
            // 몇 개 메뉴가 다시 계산됐는지 말해 준다. 조용히 넘기면 무슨 일이 났는지 모른다.
            Alert.alert('세금을 저장했어요', `메뉴 ${res.recipes}개의 손익이 다시 계산됐어요.`);
          }
        },
        onError: (e) =>
          Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="세금" onBack={() => safeBack('/my')} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 11 }} showsVerticalScrollIndicator={false}>
        <QueryState
          isLoading={settings.isLoading}
          error={settings.error}
          isEmpty={false}
          onRetry={() => void settings.refetch()}
          emptyTitle="설정을 불러오지 못했어요"
        >
          {/* 그 밖의 세금·수수료 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>세금 항목</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: T.ter }}>판매가 대비 %</Text>
            </View>

            <View style={{ paddingHorizontal: 15, paddingVertical: 12, gap: 9 }}>
              {rows.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 2 }}>
                    <Input
                      value={t.name}
                      onChangeText={(v) => setRows((p) => p.map((x, k) => (k === i ? { ...x, name: v } : x)))}
                      placeholder="예) 부가세, 카드 수수료"
                      accessibilityLabel={`항목 ${i + 1} 이름`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={t.rate}
                      onChangeText={(v) =>
                        setRows((p) => p.map((x, k) => (k === i ? { ...x, rate: clampDecimals(v, 4) } : x)))
                      }
                      placeholder="0"
                      suffix="%"
                      mono
                      keyboardType="decimal-pad"
                      accessibilityLabel={`항목 ${i + 1} 요율`}
                    />
                  </View>
                  <Pressable
                    onPress={() => setRows((p) => p.filter((_, k) => k !== i))}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name || `항목 ${i + 1}`} 삭제`}
                    hitSlop={8}
                    style={{ width: 32, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="close" size={18} color={T.ter} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() => setRows((p) => [...p, { name: '', rate: '' }])}
                accessibilityRole="button"
                accessibilityLabel="세금 항목 추가"
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                  paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue,
                }}
              >
                <Icon name="plus" size={17} color={T.blue} sw={2.2} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>항목 추가</Text>
              </Pressable>

              {error ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.red }}>{error}</Text>
              ) : null}
            </View>
          </Card>

          {/*
            ⚠ 이 한 줄이 0043 의 실측을 막는다. 배달 수수료를 여기와 고정 지출 두 곳에
              넣으면 같은 돈이 손익에서 두 번 빠진다(19일 503,397원).
          */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 2 }}>
            <Icon name="info" size={15} color={T.ter} />
            <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
              배달앱 중개 수수료는 여기가 아니라 <Text style={{ fontWeight: '700' }}>MY {'>'} 고정 지출</Text>에서
              관리해요. 두 곳에 넣으면 같은 돈이 두 번 빠져요.
            </Text>
          </View>
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        {/* 저장 직전에 얼마가 빠지는지 — 재고 추가 화면 하단과 같은 짜임 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.sub }}>판매가에서 빠지는 몫</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, tnum]}>
            {(Math.round(rate * 1000) / 10).toFixed(1)}%
          </Text>
        </View>
        <Button
          kind="primary"
          size="lg"
          full
          disabled={Boolean(error) || !loaded}
          loading={save.isPending}
          onPress={onSave}
        >
          저장
        </Button>
      </View>
    </View>
  );
}
