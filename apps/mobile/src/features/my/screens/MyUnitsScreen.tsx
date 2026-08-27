/**
 * MY-04 단위 설정.
 *
 * 내부 저장 단위는 항상 g·ml·개이고 1차 서버 계약은 metric 하나뿐이다. 저장되지 않는
 * 미국식·영국식·스푼·묶음 입력을 데모로 보여 주지 않는다. 사용자가 바꿀 수 있는 값은
 * 서버에 실제로 저장되는 1컵 용량과 단가 표기 자릿수다.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { UNIT_PRICE_DIGIT_OPTIONS, formatUnitPrice, getLocale, unitPriceDigits } from '@sikjae/core';
import { AppHeader, Button, Card, Field, Input, Notice } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { clampDecimals } from '@/lib/num';
import { RpcError } from '@/lib/supabase';
import { T } from '@/theme/tokens';
import { useSettings, useSettingsActions, useUnitDigits } from '../store';

const SAMPLE_UNIT_PRICE = 4000 / 850;

function DetailRow({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, paddingHorizontal: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <Text style={{ width: 72, fontSize: 16, fontWeight: '600', color: T.sub }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{value}</Text>
        {sub ? <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export default function MyUnitsScreen() {
  const settings = useSettings();
  const { locale } = settings;
  const { setCupVolume, setUnitDigits, saving } = useSettingsActions();
  const digits = useUnitDigits();
  const defaultDigits = unitPriceDigits(locale);
  const L = getLocale(locale);

  const [cup, setCup] = useState(settings.cupVolume === null ? '' : String(settings.cupVolume));
  // 조회 캐시는 저장보다 먼저 시작된 응답으로 잠시 옛값이 될 수 있다. 변경 여부는 live cache 가
  // 아니라 사용자가 편집을 시작한 기준값과 비교한다.
  const [baseCup, setBaseCup] = useState<number | null>(settings.cupVolume);
  const [cupTouched, setCupTouched] = useState(false);
  const [baseRevision, setBaseRevision] = useState<number | null>(settings.revision);
  const [serverChanged, setServerChanged] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const seenRevision = useRef(settings.revision);
  const conflictBaseRevision = useRef<number | null>(null);

  useEffect(() => {
    if (settings.revision === null || settings.cupVolume === null) return;
    if (baseRevision === null) {
      seenRevision.current = settings.revision;
      setBaseRevision(settings.revision);
      setBaseCup(settings.cupVolume);
      setCup(String(settings.cupVolume));
      return;
    }
    // revision 은 단조 증가한다. 자체 저장 뒤 늦게 끝난 옛 refetch가 낮은 판본을 돌려줘도
    // 방금 저장한 기준값·판본을 되돌리면 안 된다.
    if (seenRevision.current !== null && settings.revision < seenRevision.current) return;
    if (seenRevision.current === settings.revision) return;
    seenRevision.current = settings.revision;
    if (!cupTouched && !saving) {
      setBaseRevision(settings.revision);
      setBaseCup(settings.cupVolume);
      setCup(String(settings.cupVolume));
    } else if (settings.revision !== baseRevision) {
      setServerChanged(true);
    }
  }, [settings.revision, settings.cupVolume, baseRevision, cupTouched, saving]);

  /** 충돌 해결/최초 오류 복구 — 성공한 최신 서버값을 편집 기준으로 채택한다. */
  const adoptLatest = async () => {
    const fresh = await settings.refetch();
    if (!fresh) return;
    const conflictBase = conflictBaseRevision.current;
    if (serverChanged && (
      conflictBase === null
      || fresh.revision <= conflictBase
      || (seenRevision.current !== null && fresh.revision < seenRevision.current)
    )) return;
    seenRevision.current = fresh.revision;
    setBaseRevision(fresh.revision);
    setBaseCup(fresh.cupVolume);
    setCup(String(fresh.cupVolume));
    setCupTouched(false);
    conflictBaseRevision.current = null;
    setServerChanged(false);
    setSaveError(null);
  };

  const onSaveError = (e: unknown) => {
    if (e instanceof RpcError && e.code === '45009') {
      conflictBaseRevision.current = baseRevision;
      setServerChanged(true);
      return;
    }
    setSaveError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
  };

  const acceptRevision = (revision: number) => {
    seenRevision.current = revision;
    setBaseRevision(revision);
  };

  const blocked = saving || serverChanged || settings.error;
  const cupNumber = Number(cup);
  // 서버 settings.cup_volume 은 numeric 이다. 236.5ml 같은 실제 컵값을 화면에서 정수로
  // 잘라 계약을 좁히지 않는다(소수 넷째 자리까지 입력, 저장값 비교는 숫자로).
  const cupValid = Number.isFinite(cupNumber) && cupNumber > 0 && cupNumber <= 5000;
  const cupChanged = baseCup !== null && cupNumber !== baseCup;

  const saveCup = () => {
    if (blocked || baseRevision === null || !cupValid || !cupChanged) return;
    setSaveError(null);
    setCupVolume(cupNumber, baseRevision, {
      onSuccess: (result) => {
        acceptRevision(result.revision);
        setBaseCup(cupNumber);
        setCupTouched(false);
      },
      onError: onSaveError,
    });
  };

  const saveDigits = (next: number, isDefault: boolean) => {
    if (blocked || baseRevision === null) return;
    setSaveError(null);
    setUnitDigits(isDefault ? null : next, baseRevision, {
      onSuccess: (result) => acceptRevision(result.revision),
      onError: onSaveError,
    });
  };

  if (settings.loading) {
    return <View style={{ flex: 1, backgroundColor: T.bg }}><AppHeader title="단위 설정" onBack={() => safeBack('/my')} /><Text style={{ margin: 20, color: T.ter }}>불러오는 중…</Text></View>;
  }
  if ((settings.error && !settings.hasData) || baseRevision === null || settings.cupVolume === null || settings.unitSystem === null) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AppHeader title="단위 설정" onBack={() => safeBack('/my')} />
        <Notice style={{ margin: 16 }}>설정을 불러오지 못했어요</Notice>
        <View style={{ marginHorizontal: 16 }}><Button kind="gray" size="lg" full onPress={() => { void adoptLatest(); }}>다시 시도</Button></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="단위 설정" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        {settings.error && settings.hasData ? (
          <View role="alert" accessibilityLabel="재조회 실패" style={{ marginBottom: 10, padding: 13, borderRadius: 12, backgroundColor: T.redTint }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.red }}>최신 설정을 불러오지 못했어요. 다시 시도해 주세요.</Text>
            {/* 배경 오류 재시도는 조회만 다시 한다. 수정 중인 컵 초안을 서버값으로 덮지 않는다. */}
            <View style={{ marginTop: 8 }}><Button kind="gray" size="md" onPress={() => { void settings.refetch(); }} accessibilityLabel="다시 시도">다시 시도</Button></View>
          </View>
        ) : null}
        {serverChanged ? (
          <View role="status" style={{ marginBottom: 10, padding: 13, borderRadius: 12, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.red }}>다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요.</Text>
            <View style={{ marginTop: 8 }}><Button kind="gray" size="md" onPress={() => { void adoptLatest(); }} accessibilityLabel="새로고침">새로고침</Button></View>
          </View>
        ) : null}
        {saveError ? <Text role="alert" style={{ color: T.red, fontWeight: '700', marginBottom: 10 }}>저장하지 못했어요 · {saveError}</Text> : null}

        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>기준 단위</Text>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
          <DetailRow label="방식" value="미터법" sub="내부 저장은 항상 최소 단위" />
          <DetailRow label="무게" value="g · kg" sub="1kg = 1,000g" />
          <DetailRow label="부피" value="ml · L" sub="1L = 1,000ml" last />
        </Card>

        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 8 }}>조리컵</Text>
        <Card style={{ marginBottom: 16 }}>
          <Field label="1컵 용량" hint="레시피 입력에서 컵을 ml로 환산할 때 사용해요.">
            <Input
              value={cup}
              suffix="ml"
              mono
              keyboardType="decimal-pad"
              disabled={blocked}
              onChangeText={(value) => {
                setCup(clampDecimals(value, 4));
                setCupTouched(true);
                setSaveError(null);
              }}
              accessibilityLabel="1컵 용량"
            />
          </Field>
          {!cupValid ? <Text style={{ color: T.red, fontSize: 14, marginBottom: 10 }}>0보다 크고 5,000ml 이하로 입력해 주세요.</Text> : null}
          <Button kind="primary" size="lg" full disabled={blocked || !cupValid || !cupChanged} loading={saving} onPress={saveCup} accessibilityLabel="컵 용량 저장">컵 용량 저장</Button>
        </Card>

        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 6 }}>단가 표기 자릿수</Text>
        <Notice style={{ marginBottom: 10 }}>식재료 단가·원가의 표기만 바뀌고 저장·계산 값은 그대로예요.</Notice>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {UNIT_PRICE_DIGIT_OPTIONS.map((d, i) => {
            const on = d === digits;
            const isDefault = d === defaultDigits;
            const pattern = d === 0 ? '0' : `0${L.decimal}${'0'.repeat(d)}`;
            return (
              <Pressable
                key={d}
                onPress={() => saveDigits(d, isDefault)}
                disabled={blocked}
                accessibilityRole="radio"
                accessibilityLabel={`단가 소수 ${d}자리`}
                accessibilityState={{ checked: on, disabled: blocked }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: i < UNIT_PRICE_DIGIT_OPTIONS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
              >
                <Text style={[{ width: 74, fontSize: 16, fontWeight: '600', color: T.sub }, { fontVariant: ['tabular-nums'] }]}>{pattern}</Text>
                <Text style={[{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }, { fontVariant: ['tabular-nums'] }]}>{formatUnitPrice(SAMPLE_UNIT_PRICE, 'g', locale, d)}</Text>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 7 : 2, borderColor: on ? T.blue : T.line, marginLeft: 12 }} />
              </Pressable>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
