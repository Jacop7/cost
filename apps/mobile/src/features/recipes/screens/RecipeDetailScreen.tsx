/**
 * RCP-02 레시피 상세 — 메뉴 1개의 손익계산서.
 *
 * 숫자는 전부 서버가 낸 값이다(recipe_detail). 재료비는 재료 줄을 펼친 원가이고,
 * 고정지출률은 이번 영업월 값이다. 앱은 배수(10개/1개/월평균)만 곱해 보여준다.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Donut, Icon, QueryState } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { formatPercent, formatQuantity, formatUnitPrice, recommendedPrice, round, taxAmount, taxRate } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { useFixedCosts } from '@/features/my/hooks';
import { PriceSimSheet } from '../components/PriceSimSheet';
import { useDeactivateRecipe, useRecipeDetail, useSaveRecipe } from '../hooks';

const NUM = { fontVariant: ['tabular-nums' as const] };

/** 고정지출 항목 키 → 한글 라벨. */
const FIXED_LABEL: Record<string, string> = {
  labor: '인건비', rent: '임대료', utility: '공과금', commission: '플랫폼 수수료',
  packing: '포장비', delivery: '배달/배송', ads: '광고/홍보', etc: '기타',
};

const dispUnit = (u: 'g' | 'ml' | 'ea' | null) => (u === null ? null : u === 'ea' ? '개' : u);

function SecHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{sub}</Text> : null}
      {right ? (<><View style={{ flex: 1 }} />{right}</>) : null}
    </View>
  );
}

/** 기준 밑줄 탭 — N인분 / 1인분. 기준 인분은 메뉴마다 다르므로 라벨을 데이터에서 만든다. */
function CostTabs({ value, onChange, servings }: { value: 'batch' | 'one'; onChange: (v: 'batch' | 'one') => void; servings: number }) {
  const tabs: ['batch' | 'one', string][] = [['batch', `${servings}인분 기준`], ['one', '1인분 기준']];
  return (
    <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 15, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
      {tabs.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }}
            style={{ paddingTop: 13, paddingBottom: 11 }}
          >
            <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{label}</Text>
            {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const detail = useRecipeDetail(id);
  const fixedCosts = useFixedCosts();
  const saveRecipe = useSaveRecipe();
  const deactivate = useDeactivateRecipe();

  const [costMode, setCostMode] = useState<'batch' | 'one'>('one');
  const [view, setView] = useState<'batch' | 'one' | 'month'>('one');
  const [simOpen, setSimOpen] = useState(false);

  const r = detail.data;

  const calc = useMemo(() => {
    if (!r) return null;
    const price = r.price;
    const material = r.materialCost;
    const extra = r.extraCost;
    // 세금 = 부가세 + 사장님이 더한 항목(0052). 서버 tax_of() 와 같은 공식이다.
    const tax = round(taxAmount(price, r.taxMode, r.taxItems));
    const fixed = round(r.fixedRate * price);
    const profit = price - tax - material - fixed - extra;
    const profitRate = price > 0 ? profit / price : 0;
    const target = r.targetProfitRate / 100;
    const recRaw = recommendedPrice(material + extra, r.fixedRate, target, taxRate(r.taxMode, r.taxItems));
    return {
      price, material, extra, tax, fixed, profit, profitRate, target,
      recommended: recRaw == null ? null : Math.round(recRaw / 100) * 100,
    };
  }, [r]);

  const toggleActive = () => {
    if (!r) return;
    if (r.active) {
      Alert.alert('판매 중지', `${r.name}을(를) 판매 중지할까요? 과거 매출 기록은 그대로 남아요.`, [
        { text: '취소', style: 'cancel' },
        {
          text: '판매 중지',
          onPress: () => deactivate.mutate(r.id, {
            onError: (e) => Alert.alert('바꾸지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
          }),
        },
      ]);
      return;
    }
    saveRecipe.mutate(
      {
        id: r.id, name: r.name, price: r.price, taxMode: r.taxMode,
        baseServings: r.baseServings, targetProfitRate: r.targetProfitRate,
        avgMonthlySales: r.avgMonthlySales, active: true,
      },
      { onError: (e) => Alert.alert('바꾸지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요') },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="레시피"
        onBack={() => safeBack('/recipes')}
        right={
          <Pressable
            onPress={() => router.push(`/recipes/add?id=${id}` as Href)}
            accessibilityRole="button" accessibilityLabel="레시피 수정"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <Icon name="edit" size={19} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 16, fontWeight: '700' }}>수정</Text>
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        <QueryState
          isLoading={detail.isLoading}
          error={detail.error}
          isEmpty={detail.isFetched && !r}
          onRetry={() => void detail.refetch()}
          emptyTitle="메뉴를 찾을 수 없어요"
        >
          {r && calc ? (() => {
            const { price, material, extra, tax, fixed, profit, profitRate, target, recommended } = calc;
            const warn = r.active && profitRate < target;
            const PROFIT = warn ? T.red : T.green;
            const cm = costMode === 'batch' ? r.baseServings : 1;
            const m = view === 'batch' ? r.baseServings : view === 'one' ? 1 : (r.avgMonthlySales ?? 0);
            const wm = (v: number) => `${won(Math.round(v * m))}원`;
            const p = (v: number) => (price > 0 ? formatPercent(v / price) : '0.0%');

            // 판매가 1,000원이 어디로 가는지 — 다섯 조각의 합이 곧 판매가다.
            // ⚠ 0원이어도 범례에서 지우지 않는다. 메뉴마다 항목 수가 달라지면
            //   같은 자리에서 다른 것을 읽게 되고, "부자재가 왜 없지?" 가 된다.
            //   도넛만 0을 걸러낸다 — 0인 조각은 그릴 수 없다.
            const breakdown = [
              { label: '재료', amt: material, color: T.ter },
              { label: '부자재', amt: extra, color: T.line3 },
              { label: '고정 지출', amt: fixed, color: T.sub },
              { label: '세금', amt: tax, color: T.gray400 },
              { label: '순이익', amt: profit, color: PROFIT },
            ];
            const segments = breakdown
              .filter((s) => s.amt > 0)
              // 판매가가 0 이면 비중을 낼 수 없다 — 0 으로 두어 도넛을 비운다.
              .map((b) => ({ label: b.label, value: price > 0 ? (b.amt / price) * 100 : 0, color: b.color }));

            // 고정지출 항목별 배분 — 월 합계 대비 비중으로 나눈다.
            const fixedSum = (fixedCosts.data?.items ?? []).reduce((a, i) => a + i.total, 0);
            const fixedItems = (fixedCosts.data?.items ?? []).map((i) => ({
              name: FIXED_LABEL[i.key] ?? i.key,
              amount: fixedSum > 0 ? (fixed * i.total) / fixedSum : 0,
              rate: fixedSum > 0 ? (r.fixedRate * i.total) / fixedSum : 0,
            }));

            const trends = [...r.profitTrends].reverse().slice(0, 4);

            return (
              <>
                {/* 메뉴 요약 */}
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
                    <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.ink }} numberOfLines={1}>{r.name}</Text>
                    {!r.active ? <Badge tone="neutral" sm solid>판매중지</Badge> : warn ? <Badge tone="red" sm solid>목표 미달</Badge> : <Badge tone="green" sm solid>목표 달성</Badge>}
                  </View>
                  {([
                    ['판매가', `${won(price)}원`],
                    ['기준 인분', `${r.baseServings}인분`],
                    ['최근 30일 판매', `${r.sales30d.qty}개${r.sales30d.waste > 0 ? ` · 폐기 ${r.sales30d.waste}` : ''}`],
                    ['월 평균 판매량', r.avgMonthlySales === null ? '미입력' : `${won(r.avgMonthlySales)}개`],
                    ['목표 순이익률', `${r.targetProfitRate}%`],
                  ] as const).map(([k, v]) => (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: T.line2 }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{k}</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{v}</Text>
                    </View>
                  ))}
                  <Pressable
                    onPress={toggleActive}
                    accessibilityRole="button" accessibilityLabel={r.active ? '판매 중지' : '판매 재개'}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: r.active ? T.red : T.blue }}>
                      {r.active ? '판매 중지' : '판매 재개'}
                    </Text>
                  </Pressable>
                </Card>

                {/* 판매가 구성 — 옆 카드들과 같은 헤더를 단다. 이 카드만 헤더가 없어
                    목록에서 혼자 떠 보였다. */}
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="판매가 구성" />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 }}>
                    <Donut segments={segments} size={112} thick={17} centerTop="순이익률" centerMain={formatPercent(profitRate)} mainSize={18} mainColor={PROFIT} />
                    <View style={{ flex: 1, gap: 3 }}>
                      {breakdown.map((b) => {
                        const accent = b.label === '순이익';
                        const zero = b.amt <= 0;
                        return (
                          <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, opacity: zero ? 0.45 : 1 }}>
                            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: b.color }} />
                            <Text style={{ flex: 1, fontSize: 14, fontWeight: accent ? '800' : '600', color: accent ? PROFIT : T.sub2 }}>{b.label}</Text>
                            <Text style={[{ fontSize: 14, fontWeight: '800', color: accent ? PROFIT : T.ink, marginRight: 8 }, NUM]}>{won(Math.round(b.amt))}원</Text>
                            <Text style={[{ fontSize: 14, fontWeight: '600', color: accent ? PROFIT : T.ter, width: 46, textAlign: 'right' }, NUM]}>{p(b.amt)}</Text>
                          </View>
                        );
                      })}

                      {/*
                        소계 — 다섯 조각의 합이 곧 판매가다. 헤더에 '(14,000원 기준)'
                        으로 적으면 전제처럼 읽히는데, 실제로는 **결과**다.
                        다른 카드(재료·고정 지출)도 소계를 아래에 두므로 형태도 맞는다.
                      */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: T.line }}>
                        <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: T.ink2 }}>소계</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink, marginRight: 8 }, NUM]}>{won(price)}원</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, width: 46, textAlign: 'right' }, NUM]}>
                          {price > 0 ? '100%' : '—'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>

                {/* 재료 */}
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead
                    title="재료"
                    right={
                      <Pressable onPress={() => router.push(`/recipes/add?id=${id}` as Href)} hitSlop={6} accessibilityRole="button" accessibilityLabel="재료 편집">
                        <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>편집</Text>
                      </Pressable>
                    }
                  />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                    {r.lines.length === 0 ? (
                      <Text style={{ fontSize: 16, color: T.ter, paddingVertical: 14 }}>등록된 재료가 없어요</Text>
                    ) : (
                      r.lines.map((l, i) => {
                        const unit = dispUnit(l.baseUnit);
                        const cost = l.unitPrice === null ? null : l.perServing * l.unitPrice;
                        return (
                          <Pressable
                            key={l.id}
                            onPress={() => l.ingredientId ? router.push(`/ingredients/${l.ingredientId}` as Href) : l.subRecipeId ? router.push(`/recipes/${l.subRecipeId}` as Href) : undefined}
                            accessibilityRole="button" accessibilityLabel={`${l.name} 상세`}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < r.lines.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }} numberOfLines={1}>
                                {l.name}
                              </Text>
                              <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                                {l.unitPrice === null ? '단가 산출 전' : unit === null ? `${won(Math.round(l.unitPrice))}원/인분` : formatUnitPrice(l.unitPrice, unit)}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[{ fontSize: 16, fontWeight: '800', color: cost === null ? T.ter : T.ink }, NUM]}>
                                {cost === null ? '—' : `${won(Math.round(cost * cm))}원`}
                              </Text>
                              <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>
                                {unit === null ? `${l.perServing * cm}인분` : formatQuantity(l.perServing * cm, unit)} / {cost === null ? '—' : p(cost)}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(material * cm))}원</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{p(material)}</Text>
                      </View>
                    </View>
                  </View>
                </Card>

                {/* 부자재 */}
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="부자재" sub="(이 메뉴에만 들어가는 부가 원가)" />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <View style={{ paddingHorizontal: 15, paddingVertical: 4 }}>
                    {r.extras.length > 0 ? (
                      r.extras.map((e) => (
                        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
                          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>
                            {e.name}{e.qty !== 1 ? <Text style={{ color: T.ter }}> ×{e.qty}</Text> : null}
                          </Text>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(e.amount * cm))}원</Text>
                            <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(e.amount)}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 16, color: T.ter, paddingVertical: 9 }}>등록된 부자재가 없어요</Text>
                    )}
                  </View>
                </Card>

                {/* 고정 지출 */}
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="고정 지출" sub="(개당 환산)" />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                    {fixedItems.length === 0 ? (
                      <Text style={{ fontSize: 16, color: T.ter, paddingVertical: 12 }}>
                        이번 달 고정지출이 아직 없어요. 마이페이지에서 등록해 주세요.
                      </Text>
                    ) : (
                      fixedItems.map((f, i) => (
                        <View key={f.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < fixedItems.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{f.name}</Text>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(f.amount * cm))}원</Text>
                            <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 2 }, NUM]}>{formatPercent(f.rate)}</Text>
                          </View>
                        </View>
                      ))
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(fixed * cm))}원</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{formatPercent(r.fixedRate)}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 10 }}>
                      월 고정비(임대료·인건비 등)를 매출 비율로 환산해 메뉴 1개가 부담하는 금액이에요.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/recipes/fixed-cost' as Href)}
                    accessibilityRole="button" accessibilityLabel="고정 지출 자세히 보기"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
                    <Icon name="chevron" size={16} color={T.ter} />
                  </Pressable>
                </Card>

                {/* 세금 — 부가세 + 사장님이 더한 항목(0052) */}
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead
                    title="세금"
                    sub={r.taxMode === 'included' ? '(판매가 포함)' : r.taxMode === 'separate' ? '(별도)' : '(면세)'}
                  />
                  <CostTabs value={costMode} onChange={setCostMode} servings={r.baseServings} />
                  <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                    {r.taxBreakdown.length === 0 ? (
                      <Text style={{ fontSize: 16, color: T.ter, paddingVertical: 13 }}>
                        빠지는 세금이 없어요.
                      </Text>
                    ) : (
                      r.taxBreakdown.map((t, i) => (
                        <View
                          key={`${t.name}-${i}`}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: i < r.taxBreakdown.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}
                        >
                          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{t.name}</Text>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(Math.round(t.amount * cm))}원</Text>
                            <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 2 }, NUM]}>{formatPercent(t.rate / 100)}</Text>
                          </View>
                        </View>
                      ))
                    )}
                    {/* 항목이 둘 이상일 때만 소계 — 한 줄이면 같은 숫자를 두 번 보여 주는 셈이다. */}
                    {r.taxBreakdown.length > 1 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(Math.round(tax * cm))}원</Text>
                          <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{p(tax)}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </Card>

                {/* 손익 미리보기 */}
                <Card onLine pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="손익 미리보기" sub="판매가 대비 %" />
                  <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 15, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
                    {([['batch', `${r.baseServings}인분`], ['one', '1인분'], ['month', '월평균']] as const).map(([k, label]) => {
                      const on = view === k;
                      const disabled = k === 'month' && (r.avgMonthlySales ?? 0) <= 0;
                      return (
                        <Pressable
                          key={k}
                          onPress={() => setView(k)}
                          disabled={disabled}
                          accessibilityRole="tab" accessibilityLabel={`${label} 기준`}
                          accessibilityState={{ selected: on, disabled }}
                          style={{ paddingTop: 13, paddingBottom: 11, opacity: disabled ? 0.4 : 1 }}
                        >
                          <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{label} 기준</Text>
                          {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매량</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>
                        {view === 'month' ? `월 ${won(r.avgMonthlySales ?? 0)}개` : view === 'batch' ? `${r.baseServings}개` : '1개'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>판매가</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{wm(price)}</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>100%</Text>
                      </View>
                    </View>
                    {[
                      { label: '세금', amt: tax },
                      { label: '재료 원가', amt: material },
                      { label: '고정 지출', amt: fixed },
                      ...(extra > 0 ? [{ label: `부자재${r.extras.length > 1 ? ` (${r.extras.length}건)` : ''}`, amt: extra }] : []),
                    ].map((c) => (
                      <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>
                          <Text style={{ color: T.ter }}>(−) </Text>{c.label}
                        </Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter }, NUM]}>{wm(c.amt)}</Text>
                          <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{p(c.amt)}</Text>
                        </View>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>순이익</Text>
                      <View style={{ marginLeft: 7 }}>{warn ? <Badge tone="red" sm solid>목표 미달</Badge> : <Badge tone="green" sm solid>목표 달성</Badge>}</View>
                      <View style={{ flex: 1 }} />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 16, fontWeight: '800', color: PROFIT }, NUM]}>{wm(profit)}</Text>
                        <Text style={[{ fontSize: 14, fontWeight: '800', color: PROFIT, marginTop: 2 }, NUM]}>{formatPercent(profitRate)}</Text>
                      </View>
                    </View>
                    {warn && recommended != null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: T.line }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2 }}>권장 판매가</Text>
                          <Text style={{ fontSize: 14, color: T.ter, marginTop: 1 }}>목표 {r.targetProfitRate}% 기준</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{won(recommended)}원</Text>
                          <Text style={[{ fontSize: 14, fontWeight: '700', color: T.blue, marginTop: 2 }, NUM]}>{r.targetProfitRate}%</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/*
                    판매가 시뮬레이션 — 카드 **안**의 하단 액션으로 둔다.
                    카드 밖에 떠 있으면 무엇에 대한 시뮬레이션인지 끊겨 보인다.
                    여기서 바꿔 볼 값(판매가)의 결과가 바로 위에 있으니 붙어 있어야 한다.
                    다른 카드의 '자세히 보기'와 같은 자리·같은 형태다.
                  */}
                  <Pressable
                    onPress={() => setSimOpen(true)}
                    accessibilityRole="button" accessibilityLabel="판매가 시뮬레이션"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 15, marginTop: 0, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}
                  >
                    <Icon name="trend" size={18} color={T.blue} sw={2.1} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>판매가 시뮬레이션</Text>
                  </Pressable>
                </Card>

                {/* 손익 변동 — profit_trends 스냅샷 */}
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  <SecHead title="손익 변동" sub={`${r.profitTrends.length}건`} />
                  {trends.length === 0 ? (
                    <Text style={{ fontSize: 16, color: T.ter, padding: 15 }}>아직 기록된 변동이 없어요</Text>
                  ) : (
                    trends.map((h, i) => (
                      <Pressable
                        key={`${h.date}-${i}`}
                        onPress={() => router.push(`/recipes/profit-history?id=${r.id}` as Href)}
                        accessibilityRole="button" accessibilityLabel={`${h.date} 손익 변동`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, NUM]}>{h.date.replace(/-/g, '.')}</Text>
                            {i === 0 ? <Badge tone="blue" sm>최근</Badge> : null}
                            <Badge tone="neutral" sm>
                              {h.cause === 'material' ? '재료 단가' : h.cause === 'fixed' ? '고정지출' : '레시피 변경'}
                            </Badge>
                          </View>
                          <Text style={[{ fontSize: 16, color: T.sub, fontWeight: '600', marginTop: 5 }, NUM]}>
                            순이익률 <Text style={{ color: T.ink2, fontWeight: '700' }}>{h.profitRate}%</Text>
                            {'  '}재료비율 <Text style={{ color: T.ink2, fontWeight: '700' }}>{h.materialRate}%</Text>
                          </Text>
                        </View>
                        <Icon name="chevron" size={16} color={T.line3} />
                      </Pressable>
                    ))
                  )}
                  <Pressable
                    onPress={() => router.push(`/recipes/profit-history?id=${r.id}` as Href)}
                    accessibilityRole="button" accessibilityLabel="손익 변동 자세히 보기"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, backgroundColor: T.surface2 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
                    <Icon name="chevron" size={16} color={T.ter} />
                  </Pressable>
                </Card>
              </>
            );
          })() : null}
        </QueryState>
      </ScrollView>

      {r && calc ? (
        <PriceSimSheet
          visible={simOpen}
          onClose={() => setSimOpen(false)}
          price={calc.price}
          material={calc.material}
          extra={calc.extra}
          fixedRate={r.fixedRate}
          target={calc.target}
          taxRatio={taxRate(r.taxMode, r.taxItems)}
        />
      ) : null}
    </View>
  );
}
