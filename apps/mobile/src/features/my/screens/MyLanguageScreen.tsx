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
import { useState } from 'react';
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
} from '@sikjae/core';
import { AppHeader, Button, Card, Icon, Notice, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T, tnum } from '@/theme/tokens';
import { useSettings, useSettingsActions, useUnitDigits } from '../store';

// 미리보기는 검산 기준값을 그대로 쓴다 — 사장님이 자기 화면에서 보던 숫자로 비교할 수 있게.
const P_PRICE = 12000; // 제육볶음 판매가
const P_UNIT = 4000 / 1000 / (1 - 0.15); // 대파 4,000원/1,000g · 로스 15% → 4.7058…원/g
const P_RATE = 0.3345; // 순이익 4,014 / 12,000

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

export default function MyLanguageScreen() {
  const insets = useSafeAreaInsets();
  const { locale } = useSettings();
  const { setLocale, saving } = useSettingsActions();
  const digits = useUnitDigits();

  const [draft, setDraft] = useState<LocaleKey>(locale); // 확정 전 선택
  const [confirm, setConfirm] = useState(false); // 확인 시트
  const changed = draft !== locale;
  const D = getLocale(draft);

  const onSave = () => {
    setLocale(draft);
    setConfirm(false);
    safeBack('/my');
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="언어 · 통화" onBack={() => safeBack('/my')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        {/* 언어·지역 — 통화와 숫자 서식이 여기서 함께 결정된다 */}
        <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter, marginHorizontal: 4, marginBottom: 6 }}>언어 · 지역</Text>
        <Notice style={{ marginBottom: 10 }}>금액의 기본 소수 자릿수는 통화가 정해요. 원·엔·동은 소수가 없어 0자리, 달러·유로 등은 2자리예요.</Notice>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {LOCALES.map((l, i) => {
            const on = l.key === draft;
            const sub = l.native === l.label ? '' : `${l.label} · `;
            return (
              <Pressable
                key={l.key}
                onPress={() => setDraft(l.key as LocaleKey)}
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
        <Button kind="primary" size="lg" full onPress={() => changed && setConfirm(true)} style={changed ? undefined : { opacity: 0.4 }}>
          저장
        </Button>
      </View>

      {/* 확인 — 고른 언어로 실제 화면 숫자가 어떻게 보이는지 확인하고 확정 */}
      {/* sub 는 한국어 라벨을 앞에 둔다 — 아랍어 이름이 앞이면 그 줄이 RTL 로 판정돼 시트 헤더가 우측으로 밀린다. */}
      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="이렇게 보여요" sub={`${D.label} · ${D.currencyName} (${D.currency})`} height={NEEDS_RESTART.has(D.lang) ? 490 : 420}>
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

        <View style={{ flexDirection: 'row', gap: 9 }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => setConfirm(false)}>취소</Button></View>
          <View style={{ flex: 2 }}><Button kind="primary" size="lg" full onPress={onSave}>저장</Button></View>
        </View>
      </Sheet>
    </View>
  );
}
