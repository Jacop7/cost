/**
 * MY-08 언어·통화 설정 — 언어(지역) 선택 → 통화기호·자릿수 구분자·소수점·금액 자릿수 반영.
 *
 * 이 화면이 정하는 것은 전부 "사실"이라 개별 선택지가 없다. 독일에서 1.250,50 은 고르는 게 아니라
 * 그냥 그렇게 쓰는 것이므로, 사장님은 언어만 고르고 서식 4종은 로케일에서 파생된다(packages/core locale.ts).
 * 반대로 취향이 갈리는 단가 소수 자릿수는 여기가 아니라 단위 설정(MY-04)에서 고른다.
 *
 * 플로우: 목록에서 고름(초안) → [저장] → 확인 시트에서 "이렇게 보여요" 미리보기 → [저장] → 확정.
 *   언어는 앱 전체 숫자 표기를 한 번에 바꾸는 설정이라, 고르는 즉시 적용하지 않고 결과를 보여준 뒤 확정한다.
 *
 * 확정값은 서버(settings)에 저장된다. 실제 언어 전환
 *   (UI 문구 번역·글꼴·RTL)은 아직 연결하지 않았다. 지금 확정되는 것은 숫자 서식 기준값뿐이다.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LOCALES,
  formatMoney,
  formatPercent,
  formatUnitPrice,
  getLocale,
  localeSample,
  type LocaleKey,
} from '@margincook/core';
import { AppHeader, Button, Card, Icon, Notice, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { RpcError } from '@/lib/supabase';
import { T, tnum } from '@/theme/tokens';
import { useSettings, useSettingsActions, useUnitDigits } from '../store';

// 미리보기는 검산 기준값을 그대로 쓴다 — 사장님이 자기 화면에서 보던 숫자로 비교할 수 있게.
const P_PRICE = 12000; // 제육볶음 판매가
// 4,000원에 850g 이 들어온 경우 → 4.7058…원/g.
// 나누어떨어지지 않는 값이라야 소수 자릿수 차이가 눈에 보인다.
// (0041 이후 단가는 매입액 ÷ 실입고량 그대로다 — 로스로 나누지 않는다.)
const P_UNIT = 4000 / 850;
const P_RATE = 0.3372; // 제육볶음 순이익 4,046.69 / 12,000

/** 스크립트가 다른 언어는 글꼴·방향을 시작 시 확정하므로 재시작이 필요하다(theme/fonts.ts). */
const NEEDS_RESTART = new Set(['ja', 'ar']);

/**
 * 아랍어 행이 우측으로 밀리는 것 방지.
 * 텍스트 방향은 첫 강방향 문자로 자동 판정되는데(bidi), "العربية…" 나 "1,250.00 ر.س" 는 첫 강방향 문자가
 * 아랍 문자라 그 줄만 RTL 문단이 되어 오른쪽 정렬된다. 지금 앱은 한국어(LTR) 이고 이 목록은 언어 "이름"을
 * 늘어놓는 자리이므로, 줄 방향은 LTR 로 고정하고 글자 자체의 RTL 셰이핑만 플랫폼에 맡긴다.
 * (아랍어를 실제 앱 언어로 전환하면 그때는 I18nManager 가 화면 전체 방향을 뒤집는다 — theme/fonts.ts)
 */
const LTR = { writingDirection: 'ltr', textAlign: 'left' } as const;

function PreviewRow({ label, value, hint, last }: { label: string; value: string; hint?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line2 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: T.sub }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 13, color: T.ter, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {/* 값은 우측 정렬이지만 방향은 LTR 고정 — 아랍어 통화기호가 붙어도 "12,000.00 ر.س" 순서를 유지한다. */}
      <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginLeft: 12 }, tnum, { writingDirection: 'ltr', textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

/**
 * 바깥 화면은 **게이트**다 — 서버 설정이 오기 전에는 초안을 만들지 않는다.
 * ⚠ 예전엔 캐시가 비면 fallback 'ko' 로 useState 가 굳어, 실제 언어가 en-US 여도 한국어가 선택된
 *   채 저장 버튼까지 살아 있었다(검토 지적). 로딩·오류는 각각 그렇게 보이고, 초안은 값이 온 뒤 만든다.
 */
export default function MyLanguageScreen() {
  const settings = useSettings();
  if (settings.loading) {
    return (
      <Shell>
        <Text style={{ fontSize: 15, color: T.ter, margin: 20 }}>불러오는 중…</Text>
      </Shell>
    );
  }
  // 값이 한 번도 안 온 채 실패했을 때만 오류 화면이다. 값이 있는데 **배경 재조회**가 실패한 경우는
  // 편집기를 없애지 않는다(초안·시트·저장 중 잠금·완료 콜백이 끊긴다 — 검토 지적) — 배너로만 알린다.
  if (settings.error && !settings.hasData) {
    return (
      <Shell>
        <Notice style={{ margin: 16 }}>설정을 불러오지 못했어요</Notice>
        <View style={{ marginHorizontal: 16 }}>
          <Button kind="gray" size="lg" full onPress={() => { void settings.refetch(); }}>다시 시도</Button>
        </View>
      </Shell>
    );
  }
  // ⚠ key 로 편집기를 다시 만들지 않는다 — 다른 기기 변경·재조회 때 초안·확인 시트·오류·저장 중 잠금과
  //   완료 콜백까지 사라진다(검토 지적). 편집기가 서버값 변화를 스스로 다룬다(아래 정책).
  if (settings.revision === null) {
    return <Shell><Notice style={{ margin: 16 }}>설정 판본을 불러오지 못했어요</Notice></Shell>;
  }
  return <LanguageEditor serverLocale={settings.locale} serverRevision={settings.revision} staleError={settings.error} refetch={settings.refetch} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="언어 · 통화" onBack={() => safeBack('/my')} />
      {children}
    </View>
  );
}

/**
 * 서버 언어가 바뀔 때의 정책(검토 지적) —
 *   · 수정 전(초안을 안 건드렸고 시트도 닫힘): 새 서버값으로 조용히 동기화.
 *   · 수정 중·저장 중: 초안을 **유지**하고 "다른 기기에서 설정이 변경됐어요" 를 보이며 저장을 잠근다.
 *     사용자가 [새로고침] 을 눌러 서버값으로 맞춘 뒤 다시 고른다. 진행 중인 저장은 끊지 않는다.
 */
function LanguageEditor({ serverLocale, serverRevision, staleError, refetch }: {
  serverLocale: LocaleKey;
  serverRevision: number;
  staleError: boolean;
  refetch: () => Promise<{ locale: LocaleKey; revision: number } | null>;
}) {
  const insets = useSafeAreaInsets();
  const { setLocale, saving } = useSettingsActions();
  const digits = useUnitDigits();

  const [draft, setDraft] = useState<LocaleKey>(serverLocale); // 확정 전 선택 — 서버값이 온 뒤에만 만들어진다
  const [baseLocale, setBaseLocale] = useState<LocaleKey>(serverLocale);
  const [baseRevision, setBaseRevision] = useState(serverRevision);
  const [touched, setTouched] = useState(false);               // 사용자가 초안을 건드렸나
  const [confirm, setConfirm] = useState(false); // 확인 시트
  // 저장 실패 문구 — **화면 안**에 그린다. Alert.alert 는 웹(react-native-web)에서 아무것도 안 보여 준다(검토 지적).
  const [saveError, setSaveError] = useState<string | null>(null);
  // 수정 중에 서버값이 바뀌었다 — 새로고침 전엔 저장을 막는다.
  const [serverChanged, setServerChanged] = useState(false);
  const seen = useRef(serverRevision);
  const conflictBaseRevision = useRef<number | null>(null);
  useEffect(() => {
    // revision 은 단조 증가한다. 늦게 도착한 낮은 판본으로 화면 기준과 다음 저장 토큰을
    // 되돌리면 서버가 다시 45009 를 내므로, 마지막으로 본 판본보다 낮은 응답은 무시한다.
    if (serverRevision < seen.current) return;
    if (seen.current === serverRevision) return;
    seen.current = serverRevision;
    if (!touched && !confirm && !saving) {
      setDraft(serverLocale);
      setBaseLocale(serverLocale);
      setBaseRevision(serverRevision);
    }
    else {
      conflictBaseRevision.current = baseRevision;
      setServerChanged(true);
    }
  }, [serverLocale, serverRevision, touched, confirm, saving, baseRevision]);

  const locale = baseLocale;
  const changed = draft !== baseLocale;
  const D = getLocale(draft);

  const pick = (k: LocaleKey) => { setDraft(k); setTouched(true); };
  const [refreshing, setRefreshing] = useState(false);
  /**
   * 새로고침 = **서버를 실제로 다시 조회**한다(검토 지적 — 예전엔 prop 을 복사하고 충돌만 지웠다).
   * 성공 응답이 온 뒤에만 초안·기준값을 바꾸고 충돌을 푼다. 실패하면 아무것도 바꾸지 않는다(배너가 남는다).
   */
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const fresh = await refetch();
      if (fresh === null) return;
      const conflictBase = conflictBaseRevision.current;
      if (serverChanged && (
        conflictBase === null
        || fresh.revision <= conflictBase
        || fresh.revision < seen.current
      )) return;
      seen.current = fresh.revision;
      setDraft(fresh.locale);
      setBaseLocale(fresh.locale);
      setBaseRevision(fresh.revision);
      setTouched(false);
      conflictBaseRevision.current = null;
      setServerChanged(false);
      setSaveError(null);
      setConfirm(false);
    } finally {
      setRefreshing(false);
    }
  };
  /**
   * 다시 시도(재조회 실패 배너) = 서버를 다시 조회만 한다. 초안은 건드리지 않는다 — 성공했는데 서버값이
   * 그대로면 사용자가 고른 값으로 이어서 저장할 수 있고, 서버값이 달라졌다면 위 효과가 충돌로 알린다.
   */
  const retry = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  };
  // 재조회 실패 중에는 저장을 막는다 — 캐시의 언어·단가 자릿수로 다른 기기의 최신 설정을 덮을 수 있다(검토 P1).
  const blocked = serverChanged || staleError || refreshing;

  // 저장 중엔 시트를 못 닫는다 — 취소 버튼뿐 아니라 배경 터치·Android 뒤로가기(onRequestClose)도 같은 문이다.
  const closeSheet = () => {
    if (saving) return;
    setConfirm(false);
    setSaveError(null);
  };

  // 성공 뒤에만 닫고 이동한다. 실패는 그 자리에서 알리고 시트를 유지한다(검토 지적).
  const onSave = () => {
    if (saving || blocked) return;
    setSaveError(null);
    setLocale(draft, baseRevision, {
      // 훅이 캐시에 새 판본을 먼저 반영한다. 이 화면의 기준 판본도 같이 올려 두지 않으면
      // 이동이 늦거나 실패한 순간 자기 저장을 "다른 기기 변경"으로 오인한다.
      onSuccess: (result) => {
        seen.current = result.revision;
        setBaseLocale(draft);
        setBaseRevision(result.revision);
        setTouched(false);
        conflictBaseRevision.current = null;
        setServerChanged(false);
        setConfirm(false);
        safeBack('/my');
      },
      onError: (e) => {
        // 45009 = 다른 기기가 먼저 저장했다(0171). 문구가 아니라 코드로 가른다 — 충돌 배너 + 새로고침.
        if (e instanceof RpcError && e.code === '45009') {
          conflictBaseRevision.current = baseRevision;
          setServerChanged(true);
          return;
        }
        setSaveError(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요');
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="언어 · 통화" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        {/* 언어·지역 — 통화와 숫자 서식이 여기서 함께 결정된다 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 6 }}>언어 · 지역</Text>
        <Notice style={{ marginBottom: 10 }}>금액의 기본 소수 자릿수는 통화가 정해요. 원·엔·동은 소수가 없어 0자리, 달러·유로 등은 2자리예요.</Notice>
        {staleError ? (
          <View role="status" accessibilityLabel="재조회 실패" style={{ marginBottom: 10, padding: 13, borderRadius: 12, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.red, lineHeight: 20 }}>최신 설정을 불러오지 못했어요. 마지막으로 받은 값 기준이에요.</Text>
            <View style={{ marginTop: 8 }}><Button kind="gray" size="md" loading={refreshing} onPress={() => { void retry(); }} accessibilityLabel="다시 시도">다시 시도</Button></View>
          </View>
        ) : null}
        {serverChanged ? (
          <View role="status" style={{ marginBottom: 10, padding: 13, borderRadius: 12, backgroundColor: T.redTint, borderWidth: 1, borderColor: T.red }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.red, lineHeight: 20 }}>다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요.</Text>
            <View style={{ marginTop: 8 }}><Button kind="gray" size="md" loading={refreshing} onPress={() => { void refresh(); }} accessibilityLabel="새로고침">새로고침</Button></View>
          </View>
        ) : null}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {LOCALES.map((l, i) => {
            const on = l.key === draft;
            const sub = l.native === l.label ? '' : `${l.label} · `;
            return (
              <Pressable
                key={l.key}
                onPress={() => pick(l.key as LocaleKey)}
                accessibilityRole="radio"
                accessibilityLabel={l.native}
                accessibilityState={{ checked: on }}
                aria-checked={on}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: i < LOCALES.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, LTR]}>{l.native}</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, marginTop: 3 }, LTR]}>
                    {sub}{l.currencyName} ({l.currency})
                  </Text>
                  {/* 기본 표시 예시 + 기본 소수 자릿수 — 구분자·소수점·자릿수가 한 줄에 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                    <Text style={[{ fontSize: 14, color: T.sub2, fontWeight: '600' }, tnum, LTR]}>{localeSample(l.key as LocaleKey)}</Text>
                    <Text style={{ fontSize: 13, color: T.ter, fontWeight: '600' }}>소수 {l.moneyDigits}자리</Text>
                  </View>
                </View>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 7 : 2, borderColor: on ? T.blue : T.line, marginLeft: 12 }} />
              </Pressable>
            );
          })}
        </Card>

        <View style={{ flexDirection: 'row', gap: 7, marginHorizontal: 4, marginTop: 16, alignItems: 'flex-start' }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 14, color: T.ter, lineHeight: 20 }}>
            표기만 바뀌어요. 저장·계산은 항상 최소단위(g·ml·개) 원래 값 그대로예요. 단가를 몇 자리까지 볼지는 단위 설정에서 고를 수 있어요.
          </Text>
        </View>
      </ScrollView>

      {/* 저장 — 고른 즉시가 아니라 확인 시트를 거쳐 확정 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) + 14, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full disabled={!changed || saving || blocked} onPress={() => setConfirm(true)} accessibilityLabel="저장">
          저장
        </Button>
      </View>

      {/* 확인 — 고른 언어로 실제 화면 숫자가 어떻게 보이는지 확인하고 확정 */}
      {/* sub 는 한국어 라벨을 앞에 둔다 — 아랍어 이름이 앞이면 그 줄이 RTL 로 판정돼 시트 헤더가 우측으로 밀린다. */}
      <Sheet visible={confirm} onClose={closeSheet} title="이렇게 보여요" sub={`${D.label} · ${D.currencyName} (${D.currency})`} height={NEEDS_RESTART.has(D.lang) ? 490 : 420}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 12 }} shadow={false}>
          <PreviewRow label="판매가" hint={`소수 ${D.moneyDigits}자리 · 통화가 정해요`} value={formatMoney(P_PRICE, draft)} />
          <PreviewRow label="대파 단가" hint={`소수 ${digits}자리 · 단위 설정에서 조정`} value={formatUnitPrice(P_UNIT, 'g', draft, digits)} />
          <PreviewRow label="순이익률" hint="비율은 소수 1자리 고정" value={formatPercent(P_RATE, draft)} last />
        </Card>

        {/* 글꼴·방향은 시작 시 확정 — 스크립트가 다른 언어는 재시작이 필요하다 */}
        {NEEDS_RESTART.has(D.lang) ? (
          <View style={{ flexDirection: 'row', gap: 7, marginBottom: 12, padding: 13, borderRadius: 12, backgroundColor: T.blueTint, alignItems: 'flex-start' }}>
            <Icon name="info" size={15} color={T.blue} />
            <Text style={{ flex: 1, fontSize: 14, color: T.blue, lineHeight: 20, fontWeight: '600' }}>
              {D.label}는 글꼴{D.rtl ? '과 오른쪽→왼쪽 방향' : ''}이 달라서, 앱을 다시 켜면 적용돼요. 숫자 표기는 저장하면 바로 바뀌어요.
            </Text>
          </View>
        ) : null}

        {saveError ? (
          <Text accessibilityRole="alert" style={{ fontSize: 14, fontWeight: '700', color: T.red, lineHeight: 20, marginBottom: 12 }}>
            저장하지 못했어요 · {saveError}
          </Text>
        ) : null}
        {serverChanged ? (
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.red, lineHeight: 20, marginBottom: 12 }}>
            다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요.
          </Text>
        ) : null}
        {staleError && !serverChanged ? (
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.red, lineHeight: 20, marginBottom: 12 }}>
            최신 설정을 확인하지 못해 저장할 수 없어요. 다시 시도한 뒤 저장해 주세요.
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full disabled={saving} onPress={closeSheet}>취소</Button></View>
          <View style={{ flex: 2 }}><Button kind="primary" size="lg" full loading={saving} disabled={blocked} onPress={onSave} accessibilityLabel="언어 저장 확정">저장</Button></View>
        </View>
      </Sheet>
    </View>
  );
}
