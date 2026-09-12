import { ConfigurationHistoryLink } from '@/features/changes/components/ConfigurationHistoryLink';
/** MY-02: capability로 국제 세금 화면과 기존 설정 계약을 분리한다. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Button, Card, Icon, Input, QueryState, Notice } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { RpcError } from '@/lib/supabase';
import { COMPONENT, LAYOUT, COLOR, T, tnum, TYPE, space } from '@/theme/tokens';
import { useSaveStoreTax, useStoreSettings } from '@/features/settings/hooks';
import { useAppCapabilities } from '@/features/international-tax';
import { InternationalTaxScreen } from './InternationalTaxScreen';

interface Row { name: string; rate: string }

export default function MyTaxScreen(){
  const capabilities=useAppCapabilities();
  if(capabilities.isLoading)return <TaxShell><Text style={{color:COLOR.text.tertiary}}>불러오는 중…</Text></TaxShell>;
  if(capabilities.isError||!capabilities.data)return <TaxShell><QueryState isLoading={false} error={capabilities.error??new Error('capabilities missing')} isEmpty={false} onRetry={()=>void capabilities.refetch()} emptyTitle="세금 계약이 없어요"><View/></QueryState></TaxShell>;
  return capabilities.data.internationalTax.readEnabled?<InternationalTaxScreen/>:<LegacyTaxScreen/>;
}

function TaxShell({children}:{children:ReactNode}){return <View style={{flex:1,backgroundColor:T.bg}}><AppHeader title="세금" onBack={()=>safeBack('/my')}/><View style={{padding:16}}>{children}</View></View>;}

function LegacyTaxScreen() {
  const settings = useStoreSettings();
  const save = useSaveStoreTax();

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [touched, setTouched] = useState(false);
  const [baseRevision, setBaseRevision] = useState<number | null>(null);
  const [serverChanged, setServerChanged] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seenRevision = useRef<number | null>(null);
  const conflictBaseRevision = useRef<number | null>(null);

  // 서버 값으로 한 번만 채운다. 매번 덮으면 입력 중에 글자가 되돌아간다.
  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    if (!loaded) {
      setRows(s.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })));
      setBaseRevision(s.revision);
      seenRevision.current = s.revision;
      setLoaded(true);
      return;
    }
    if (seenRevision.current === s.revision) return;
    // 자체 저장/충돌 새로고침 뒤 늦게 끝난 옛 조회가 더 낮은 판본을 돌려줘도 초안과 기준을 되돌리지 않는다.
    if (seenRevision.current !== null && s.revision < seenRevision.current) return;
    seenRevision.current = s.revision;
    if (!touched && !save.isPending) {
      setRows(s.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })));
      setBaseRevision(s.revision);
    } else if (s.revision !== baseRevision) {
      setServerChanged(true);
    }
  }, [settings.data, loaded, touched, save.isPending, baseRevision]);

  const editRows = (fn: (prev: Row[]) => Row[]) => {
    setRows(fn);
    setTouched(true);
    setSaveError(null);
  };

  /** 충돌 해결 — 성공 응답의 세금 항목·판본을 편집 기준으로 채택한다. */
  const adoptLatest = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const r = await settings.refetch();
      if (r.isError || !r.data) return;
      const s = r.data;
      const conflictBase = conflictBaseRevision.current;
      if (serverChanged && (
        conflictBase === null
        || s.revision <= conflictBase
        || (seenRevision.current !== null && s.revision < seenRevision.current)
      )) return;
      seenRevision.current = s.revision;
      setRows(s.taxItems.map((t) => ({ name: t.name, rate: String(t.rate) })));
      setBaseRevision(s.revision);
      setTouched(false);
      conflictBaseRevision.current = null;
      setServerChanged(false);
      setSaveError(null);
    } finally { setRefreshing(false); }
  };

  /** 배경 재조회 실패 재시도 — 서버 조회만 다시 하고 사용자가 쓰던 초안은 유지한다. */
  const retryPreservingDraft = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await settings.refetch(); }
    finally { setRefreshing(false); }
  };

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
    if (error || baseRevision === null || serverChanged || settings.isError || save.isPending) return;
    setSaveError(null);
    save.mutate(
      { items: rows.map((t) => ({ name: t.name.trim(), rate: num(t.rate) })), baseRevision },
      {
        onSuccess: (res) => {
          seenRevision.current = res.revision;
          setBaseRevision(res.revision);
          safeBack('/my');
          if (res.changed) {
            // 몇 개 메뉴가 다시 계산됐는지 말해 준다. 조용히 넘기면 무슨 일이 났는지 모른다.
            Alert.alert('세금을 저장했어요', `메뉴 ${res.recipes}개의 손익이 다시 계산됐어요.`);
          }
        },
        onError: (e) => {
          if (e instanceof RpcError && e.code === '45009') {
            conflictBaseRevision.current = baseRevision;
            setServerChanged(true);
            return;
          }
          setSaveError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="세금" onBack={() => { if (!save.isPending) safeBack('/my'); }} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: LAYOUT.scroll.end, gap: space.md }} showsVerticalScrollIndicator={false}>
        <ConfigurationHistoryLink kind="tax" />
        <QueryState
          isLoading={settings.isLoading}
          error={settings.data ? null : settings.error}
          isEmpty={false}
          onRetry={() => void settings.refetch()}
          emptyTitle="설정을 불러오지 못했어요"
        >
          {settings.isError && settings.data ? (
            <View role="alert" style={{ padding: space.md, borderRadius: 12, backgroundColor: COLOR.status.negativeTint }}>
              <Text style={{ color: COLOR.status.negative, fontWeight: '700' }}>최신 설정을 불러오지 못했어요. 다시 시도해 주세요.</Text>
              <View style={{ marginTop: 8 }}><Button kind="gray" size="md" loading={refreshing} onPress={() => { void retryPreservingDraft(); }}>다시 시도</Button></View>
            </View>
          ) : null}
          {serverChanged ? (
            <View role="status" style={{ padding: space.md, borderRadius: 12, backgroundColor: COLOR.status.negativeTint, borderWidth: 1, borderColor: COLOR.status.negative }}>
              <Text style={{ color: COLOR.status.negative, fontWeight: '700' }}>다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요.</Text>
              <View style={{ marginTop: 8 }}><Button kind="gray" size="md" loading={refreshing} onPress={() => { void adoptLatest(); }} accessibilityLabel="새로고침">새로고침</Button></View>
            </View>
          ) : null}
          {saveError ? <Text role="alert" style={{ color: COLOR.status.negative, fontWeight: '700' }}>저장하지 못했어요 · {saveError}</Text> : null}
          {/* 그 밖의 세금·수수료 */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.md, backgroundColor: T.surface2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.sub }}>세금 항목</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: COLOR.text.tertiary }}>판매가 대비 %</Text>
            </View>

            <View style={{ paddingHorizontal: space.md, paddingVertical: 12, gap: space.sm }}>
              {rows.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 2 }}>
                    <Input
                      value={t.name}
                      disabled={save.isPending || serverChanged || settings.isError}
                      onChangeText={(v) => editRows((p) => p.map((x, k) => (k === i ? { ...x, name: v } : x)))}
                      placeholder="예) 부가세, 카드 수수료"
                      accessibilityLabel={`항목 ${i + 1} 이름`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      value={t.rate}
                      disabled={save.isPending || serverChanged || settings.isError}
                      onChangeText={(v) =>
                        editRows((p) => p.map((x, k) => (k === i ? { ...x, rate: clampDecimals(v, 4) } : x)))
                      }
                      placeholder="0"
                      suffix="%"
                      mono
                      keyboardType="decimal-pad"
                      accessibilityLabel={`항목 ${i + 1} 요율`}
                    />
                  </View>
                  <Pressable
                    onPress={() => editRows((p) => p.filter((_, k) => k !== i))}
                    disabled={save.isPending || serverChanged || settings.isError}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name || `항목 ${i + 1}`} 삭제`}
                    hitSlop={8}
                    style={{ width: 32, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="close" size={18} color={COLOR.text.tertiary} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() => editRows((p) => [...p, { name: '', rate: '' }])}
                disabled={save.isPending || serverChanged || settings.isError}
                accessibilityState={{ disabled: save.isPending || serverChanged || settings.isError }}
                accessibilityRole="button"
                accessibilityLabel="세금 항목 추가"
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
                  paddingVertical: space.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: COLOR.action.primary,
                }}
              >
                <Icon name="plus" size={17} color={COLOR.action.primary} sw={2.2} />
                <Text style={{ fontSize: COMPONENT.cardFooter.largeFontSize, fontWeight: '700', color: COLOR.text.link }}>항목 추가</Text>
              </Pressable>

              {error ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLOR.status.negative }}>{error}</Text>
              ) : null}
            </View>
          </Card>

          {/*
            ⚠ 이 한 줄이 0043 의 실측을 막는다. 배달 수수료를 여기와 고정 지출 두 곳에
              넣으면 같은 돈이 손익에서 두 번 빠진다(19일 503,397원).
          */}
          <Notice>
            배달앱 중개 수수료는 여기가 아니라 <Text style={{ fontWeight: '700' }}>MY {'>'} 고정 지출</Text>에서
            관리해요. 두 곳에 넣으면 같은 돈이 두 번 빠져요.
          </Notice>
        </QueryState>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: LAYOUT.scroll.end, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        {/* 저장 직전에 얼마가 빠지는지 — 재고 추가 화면 하단과 같은 짜임 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: TYPE.caption.fontSize, fontWeight: '700', color: T.sub }}>판매가에서 빠지는 몫</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: COLOR.text.accent }, tnum]}>
            {(Math.round(rate * 1000) / 10).toFixed(1)}%
          </Text>
        </View>
        <Button
          kind="primary"
          size="lg"
          full
          disabled={Boolean(error) || !loaded || baseRevision === null || serverChanged || settings.isError}
          loading={save.isPending}
          onPress={onSave}
        >
          저장
        </Button>
      </View>
    </View>
  );
}
