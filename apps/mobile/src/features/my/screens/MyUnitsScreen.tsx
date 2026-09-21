/**
 * MY-04 단위 설정.
 *
 * 내부 저장 단위는 항상 g·ml·개이고 1차 서버 계약은 metric 하나뿐이다. 화면에는 사용자가
 * 실제로 확인하거나 바꿀 값만 남긴다. 수량 단위는 별도 RPC, 단가 표기 자릿수는 settings 판본으로
 * 저장한다. 서버에 남아 있는 cup_volume은 현재 입력·계산에서 소비하지 않으므로 노출하지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { UNIT_PRICE_DIGIT_OPTIONS, formatUnitPrice, getLocale, unitPriceDigits } from '@costkeep/core';
import { AppHeader, Button, Card, Icon, Notice, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { RpcError } from '@/lib/supabase';
import { COLOR, LAYOUT, T, TYPE, iconSize, minTouchTarget, space, tnum } from '@/theme/tokens';
import { BundleUnitManager } from '../BundleUnitManager';
import { useSettings, useSettingsActions, useUnitDigits } from '../store';

const SAMPLE_UNIT_PRICE = 4000 / 850;

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ ...TYPE.header, color: COLOR.text.primary, marginBottom: space.sm }}>{children}</Text>;
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1 }}>{label}</Text>
      <Text style={{ ...TYPE.bodyWeak, color: COLOR.text.secondary, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function MyUnitsScreen() {
  const settings = useSettings();
  const { locale } = settings;
  const { setUnitDigits, saving } = useSettingsActions();
  const digits = useUnitDigits();
  const defaultDigits = unitPriceDigits(locale);
  const L = getLocale(locale);
  const [digitSheetOpen, setDigitSheetOpen] = useState(false);
  const [baseRevision, setBaseRevision] = useState<number | null>(settings.revision);
  const [serverChanged, setServerChanged] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const seenRevision = useRef(settings.revision);
  const conflictBaseRevision = useRef<number | null>(null);

  useEffect(() => {
    if (settings.revision === null) return;
    if (baseRevision === null) {
      seenRevision.current = settings.revision;
      setBaseRevision(settings.revision);
      return;
    }
    if (seenRevision.current !== null && settings.revision < seenRevision.current) return;
    if (seenRevision.current === settings.revision) return;
    seenRevision.current = settings.revision;
    if (!serverChanged && !saving) setBaseRevision(settings.revision);
  }, [settings.revision, baseRevision, serverChanged, saving]);

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
    conflictBaseRevision.current = null;
    setServerChanged(false);
    setSaveError(null);
  };

  const onSaveError = (cause: unknown) => {
    if (cause instanceof RpcError && cause.code === '45009') {
      conflictBaseRevision.current = baseRevision;
      setServerChanged(true);
      return;
    }
    setSaveError(cause instanceof Error ? cause.message : '잠시 후 다시 시도해 주세요');
  };

  const saveDigits = (next: number) => {
    if (saving || serverChanged || settings.error || baseRevision === null) return;
    if (next === digits) {
      setDigitSheetOpen(false);
      return;
    }
    setSaveError(null);
    setUnitDigits(next === defaultDigits ? null : next, baseRevision, {
      onSuccess: (result) => {
        seenRevision.current = result.revision;
        setBaseRevision(result.revision);
        setDigitSheetOpen(false);
      },
      onError: onSaveError,
    });
  };

  const blocked = saving || serverChanged || settings.error;
  const pattern = digits === 0 ? '0' : `0${L.decimal}${'0'.repeat(digits)}`;

  if (settings.loading) {
    return <View style={{ flex: 1, backgroundColor: T.bg }}><AppHeader title="단위 설정" onBack={() => safeBack('/my')} /><Text style={{ margin: 20, color: COLOR.text.tertiary }}>불러오는 중…</Text></View>;
  }
  if ((settings.error && !settings.hasData) || baseRevision === null || settings.unitSystem === null) {
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: LAYOUT.scroll.end }}>
        {settings.error && settings.hasData ? (
          <View role="alert" accessibilityLabel="재조회 실패" style={{ marginBottom: space.sm, padding: space.md, borderRadius: 12, backgroundColor: COLOR.status.negativeTint }}>
            <Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>최신 설정을 불러오지 못했어요. 다시 시도해 주세요.</Text>
            <View style={{ marginTop: space.sm }}><Button kind="gray" size="md" onPress={() => { void settings.refetch(); }} accessibilityLabel="다시 시도">다시 시도</Button></View>
          </View>
        ) : null}
        {serverChanged ? (
          <View role="status" style={{ marginBottom: space.sm, padding: space.md, borderRadius: 12, backgroundColor: COLOR.status.negativeTint, borderWidth: 1, borderColor: COLOR.status.negative }}>
            <Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 선택해 주세요.</Text>
            <View style={{ marginTop: space.sm }}><Button kind="gray" size="md" onPress={() => { void adoptLatest(); }} accessibilityLabel="새로고침">새로고침</Button></View>
          </View>
        ) : null}
        {saveError ? <Text role="alert" style={{ ...TYPE.caption, color: COLOR.status.negative, marginBottom: space.sm }}>저장하지 못했어요 · {saveError}</Text> : null}

        <SectionTitle>기준 단위</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: space.xl }}>
          <DetailRow label="무게" value="g · kg" />
          <DetailRow label="부피" value="ml · L" />
          <DetailRow label="수량" value="개" last />
        </Card>

        <BundleUnitManager />

        <SectionTitle>단가 표기</SectionTitle>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`단가 소수 자릿수 ${digits}자리`}
            accessibilityState={{ disabled: blocked }}
            disabled={blocked}
            onPress={() => { setSaveError(null); setDigitSheetOpen(true); }}
            style={{ minHeight: minTouchTarget + 14, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg }}
          >
            <Text style={{ ...TYPE.body, color: COLOR.text.primary, flex: 1 }}>소수 자릿수</Text>
            <Text style={{ ...TYPE.body, ...tnum, color: COLOR.text.primary }}>{pattern}</Text>
            <Icon name="chevron" size={iconSize.sm} color={COLOR.text.tertiary} />
          </Pressable>
        </Card>
      </ScrollView>

      <Sheet visible={digitSheetOpen} onClose={() => { if (!saving) setDigitSheetOpen(false); }} title="단가 소수 자릿수">
        <View>
          {UNIT_PRICE_DIGIT_OPTIONS.map((value, index) => {
            const selected = value === digits;
            const optionPattern = value === 0 ? '0' : `0${L.decimal}${'0'.repeat(value)}`;
            return (
              <Pressable
                key={value}
                onPress={() => saveDigits(value)}
                disabled={blocked}
                accessibilityRole="radio"
                accessibilityLabel={`단가 소수 ${value}자리`}
                accessibilityState={{ checked: selected, disabled: blocked }}
                style={{ minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: index < UNIT_PRICE_DIGIT_OPTIONS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
              >
                <View style={{ flex: 1, gap: space.xs }}>
                  <Text style={{ ...TYPE.body, ...tnum, color: selected ? COLOR.state.selectedText : COLOR.text.primary }}>{optionPattern}</Text>
                  <Text style={{ ...TYPE.caption, ...tnum, color: COLOR.text.secondary }}>{formatUnitPrice(SAMPLE_UNIT_PRICE, 'g', locale, value)}</Text>
                </View>
                {selected ? <Icon name="check" size={iconSize.md} color={COLOR.state.selectedText} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
