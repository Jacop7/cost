/**
 * RCP-02 레시피 상세 (② 4.2) — 메뉴 1개의 손익계산서.
 * 메뉴 요약 · 도넛 · 재료 · 부자재 · 고정지출 · 세금 · 손익 미리보기 · 손익 변동.
 * 손익은 @sikjae/core 공식(재료 라인 합계 기준)으로 미리보기, 확정값은 E3 RPC(향후).
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Donut, Icon } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { recommendedPrice, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { FIXED_ITEMS, getRecipe, pct, RECIPE_DETAILS } from '../demoData';
import { PriceSimSheet } from '../components/PriceSimSheet';

const NUM = { fontVariant: ['tabular-nums' as const] };

// 손익 변동 내역(데모) — 판매가 변경 이력. 실데이터는 Supabase 손익 스냅샷으로 교체 예정.
const PRICE_HISTORY = [
  { date: '2026.06.12', price: '12,000원', profit: '4,014원', rate: '33.4%', now: true },
  { date: '2026.05.28', price: '11,000원', profit: '3,470원', rate: '31.5%' },
  { date: '2026.04.15', price: '11,000원', profit: '3,183원', rate: '28.9%' },
];

// 섹션 카드 헤더 — 회색(surface2) 바 + 제목(+보조문/우측).
function SecHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{sub}</Text> : null}
      {right ? (
        <>
          <View style={{ flex: 1 }} />
          {right}
        </>
      ) : null}
    </View>
  );
}

// 기준 밑줄 탭 (10개 / 1개) — 재료·부자재·고정·세금 표시 배수 전환.
function CostTabs({ value, onChange }: { value: 'ten' | 'one'; onChange: (v: 'ten' | 'one') => void }) {
  const tabs: ['ten' | 'one', string][] = [['ten', '10개 기준'], ['one', '1개 기준']];
  return (
    <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 15, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
      {tabs.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={{ paddingTop: 13, paddingBottom: 11 }}>
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
  const r = getRecipe(id);
  const detail = id ? RECIPE_DETAILS[id] : undefined;
  const [costMode, setCostMode] = useState<'ten' | 'one'>('one'); // 재료·부자재·고정·세금 표시 기준(10개/1개)
  const [view, setView] = useState<'ten' | 'one' | 'month'>('one'); // 손익: 10개 / 1개 / 월평균
  const [simOpen, setSimOpen] = useState(false); // 판매가 시뮬레이션 시트

  if (!r) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AppHeader title="레시피" onBack={() => safeBack('/recipes')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: T.ter }}>메뉴를 찾을 수 없어요</Text>
        </View>
      </View>
    );
  }

  // 재료 라인(1인분) — 라인원가 합계를 재료 원가로 사용(화면 내 일관).
  const lines = (detail?.lines ?? []).map((l) => ({ ...l, cost: round(l.qty * l.unitPrice) }));
  const price = r.price;
  const material = lines.length ? lines.reduce((s, l) => s + l.cost, 0) : r.materialPerServing;
  const extras = detail?.extras ?? [];
  const extra = extras.reduce((s, e) => s + e.amount, 0) || r.extraPerServing;
  const tax = round((price * 10) / 110);
  const fixed = round(r.fixedRate * price);
  const profit = price - tax - material - fixed - extra;
  const profitRate = profit / price;
  const stopped = r.status === 'stopped';
  const warn = !stopped && profitRate < r.target;
  // 순이익 강조색 — 리스트와 동일 2단계: 목표 미달=빨강 / 목표 달성=초록
  const PROFIT = warn ? T.red : T.green;
  const recRaw = recommendedPrice(material + extra, r.fixedRate, r.target);
  const recommended = recRaw == null ? null : Math.round(recRaw / 100) * 100;
  const cm = costMode === 'ten' ? 10 : 1; // 재료·부자재·고정·세금 표시 배수
  const m = view === 'ten' ? 10 : view === 'one' ? 1 : r.salesVolume; // 손익 배수(10개/1개/월평균)
  const wm = (v: number) => `${won(v * m)}원`;

  // 도넛 — 판매가 구성. 순이익=상태색(미달 빨강/달성 초록), 비용=그레이 진하기.
  const breakdown = [
    { label: '재료', amt: material, color: T.ter },
    { label: '부자재', amt: extra, color: T.line3 },
    { label: '고정 지출', amt: fixed, color: T.sub },
    { label: '세금', amt: tax, color: T.gray400 },
    { label: '순이익', amt: profit, color: PROFIT },
  ].filter((s) => s.amt > 0);
  const segments = breakdown.map((b) => ({ label: b.label, value: (b.amt / price) * 100, color: b.color }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="레시피"
        onBack={() => safeBack('/recipes')}
        right={
          <Pressable onPress={() => router.push(`/recipes/add` as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 8 }}>
            <Icon name="edit" size={19} color={T.ink2} />
            <Text style={{ color: T.ink2, fontSize: 16, fontWeight: '700' }}>수정</Text>
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 28, gap: 11 }}>
        {/* 메뉴 요약 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{r.name}</Text>
            {r.cat ? <Badge tone="neutral" sm>{r.cat}</Badge> : null}
            {stopped ? <Badge tone="neutral" sm solid>판매중지</Badge> : warn ? <Badge tone="red" sm solid>목표 미달</Badge> : <Badge tone="green" sm solid>목표 달성</Badge>}
          </View>
          {([['판매가', `${won(price)}원`], ['월 평균 판매량', `${won(r.salesVolume)}개`], ['목표 순이익률', `${pct(r.target)}%`]] as const).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>{k}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{v}</Text>
            </View>
          ))}
        </Card>

        {/* 도넛 — 판매가 구성 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Donut segments={segments} size={112} thick={17} centerTop="순이익률" centerMain={`${pct(profitRate)}%`} mainSize={18} mainColor={PROFIT} />
            <View style={{ flex: 1, gap: 3 }}>
              {breakdown.map((b) => {
                const accent = b.label === '순이익';
                return (
                  <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: b.color }} />
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: accent ? '800' : '600', color: accent ? PROFIT : T.sub2 }}>{b.label}</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '800', color: accent ? PROFIT : T.ink, marginRight: 8 }, NUM]}>{won(b.amt)}원</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: accent ? PROFIT : T.ter, width: 40, textAlign: 'right' }, NUM]}>{pct(b.amt / price)}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>

        {/* 재료 */}
        {lines.length > 0 ? (
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <SecHead title="재료" />
            <CostTabs value={costMode} onChange={setCostMode} />
            <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
              {lines.map((l, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < lines.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{l.name}</Text>
                    <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>{l.unitPrice}원/{l.unit}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(l.cost * cm)}원</Text>
                    <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>{won(l.qty * cm)}{l.unit} / {pct(l.cost / price)}%</Text>
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(material * cm)}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{pct(material / price)}%</Text>
                </View>
              </View>
            </View>
          </Card>
        ) : null}

        {/* 부자재 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="부자재" sub="(이 메뉴에만 들어가는 부자재)" />
          <CostTabs value={costMode} onChange={setCostMode} />
          <View style={{ paddingHorizontal: 15, paddingVertical: 4 }}>
            {extras.length > 0 ? (
              extras.map((e, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{e.name}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(e.amount * cm)}원</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{pct(e.amount / price)}%</Text>
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
          <CostTabs value={costMode} onChange={setCostMode} />
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {FIXED_ITEMS.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < FIXED_ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{f.name}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(round(f.rate * price) * cm)}원</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 2 }, NUM]}>{pct(f.rate)}%</Text>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(fixed * cm)}원</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{pct(r.fixedRate)}%</Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 10 }}>월 고정비(임대료·인건비 등)를 메뉴 1개당 얼마씩 부담해야 하는지 판매량 기준으로 나눠 계산한 금액이에요.</Text>
          </View>
          <Pressable onPress={() => router.push('/recipes/fixed-cost' as Href)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
            <Icon name="chevron" size={16} color={T.ter} />
          </Pressable>
        </Card>

        {/* 세금 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="세금" />
          <CostTabs value={costMode} onChange={setCostMode} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>부가세</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(tax * cm)}원</Text>
              <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 2 }, NUM]}>{pct(tax / price)}%</Text>
            </View>
          </View>
        </Card>

        {/* 손익 미리보기 */}
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="손익 미리보기" sub="판매가 대비 %" />
          {/* 밑줄 탭 */}
          <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 15, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.line }}>
            {([['ten', '10개 기준'], ['one', '1개 기준'], ['month', '월평균 기준']] as const).map(([k, label]) => {
              const on = view === k;
              return (
                <Pressable key={k} onPress={() => setView(k)} style={{ paddingTop: 13, paddingBottom: 11 }}>
                  <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{label}</Text>
                  {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {/* 판매량 — 우측: 값(위) / 보조(아래) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매량</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{view === 'month' ? `월 ${won(r.salesVolume)}개` : view === 'ten' ? '10개' : '1개'}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }}>-</Text>
              </View>
            </View>
            {/* 판매가 — 우측: 금액(위) / % (아래) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink }}>판매가</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{wm(price)}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>100%</Text>
              </View>
            </View>
            {/* 비용 행 — 우측: 금액(위) / % (아래) */}
            {[
              { label: '세금', amt: tax },
              { label: '재료 원가', amt: material },
              { label: '고정 지출', amt: fixed },
              ...(extra > 0 ? [{ label: `부자재${extras.length > 1 ? ` (${extras.length}건)` : ''}`, amt: extra }] : []),
            ].map((c) => (
              <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>
                  <Text style={{ color: T.ter }}>(−) </Text>{c.label}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ter }, NUM]}>{wm(c.amt)}</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: T.ter, marginTop: 2 }, NUM]}>{pct(c.amt / price)}%</Text>
                </View>
              </View>
            ))}
            {/* 순이익 — 우측: 금액(위) / % (아래) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink }}>순이익</Text>
              <View style={{ marginLeft: 7 }}>{warn ? <Badge tone="red" sm solid>목표 미달</Badge> : <Badge tone="green" sm solid>목표 달성</Badge>}</View>
              <View style={{ flex: 1 }} />
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: PROFIT }, NUM]}>{wm(profit)}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '800', color: PROFIT, marginTop: 2 }, NUM]}>{pct(profitRate)}%</Text>
              </View>
            </View>
            {/* 권장 판매가 (목표 미달 시) — 우측: 금액(위) / % (아래) */}
            {warn && recommended != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: T.line }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2 }}>권장 판매가</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 1 }}>목표 {pct(r.target)}% 기준</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{won(recommended)}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.blue, marginTop: 2 }, NUM]}>{pct(r.target)}%</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Card>

        {/* 판매가 시뮬레이션 진입 */}
        <Pressable
          onPress={() => setSimOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}
        >
          <Icon name="trend" size={18} color={T.blue} sw={2.1} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>판매가 시뮬레이션</Text>
        </Pressable>

        {/* 손익 변동 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="손익 변동" />
          {PRICE_HISTORY.map((h, i) => (
            <Pressable key={i} onPress={() => router.push('/recipes/profit-history' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600' }, NUM]}>{h.date}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <Text style={[{ fontSize: 16, color: T.sub, fontWeight: '600' }, NUM]}>판매가 <Text style={{ color: T.ink2, fontWeight: '700' }}>{h.price}</Text></Text>
                  {h.now ? <Badge tone="blue" sm>현재 적용 중</Badge> : null}
                </View>
                <Text style={[{ fontSize: 16, color: T.sub, fontWeight: '600', marginTop: 3 }, NUM]}>순이익 <Text style={{ color: T.ink2, fontWeight: '700' }}>{h.profit}</Text> <Text style={{ fontSize: 14, color: T.sub2 }}>{h.rate}</Text></Text>
              </View>
              <Icon name="chevron" size={16} color={T.line3} />
            </Pressable>
          ))}
          {/* 자세히 보기 → 손익 변동 상세 */}
          <Pressable onPress={() => router.push('/recipes/profit-history' as Href)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, backgroundColor: T.surface2 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
            <Icon name="chevron" size={16} color={T.ter} />
          </Pressable>
        </Card>
      </ScrollView>

      <PriceSimSheet
        visible={simOpen}
        onClose={() => setSimOpen(false)}
        price={price}
        material={material}
        extra={extra}
        fixedRate={r.fixedRate}
        target={r.target}
      />
    </View>
  );
}
