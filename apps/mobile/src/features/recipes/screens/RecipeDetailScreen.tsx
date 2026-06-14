/**
 * RCP-02 레시피 상세 (② 4.2) — 메뉴 1개의 손익계산서.
 * 정보(판매가·월평균판매량·목표) · 도넛+손익 구성 · 재료표 · 고정 지출 · 순이익률 추이 · 시뮬레이션.
 * 손익은 @sikjae/core 공식(재료 라인 합계 기준)으로 미리보기, 확정값은 E3 RPC(향후).
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, Badge, Card, Donut, Icon } from '@/components/kit';
import { recommendedPrice, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { FIXED_ITEMS, getRecipe, pct, RECIPE_DETAILS } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const PROFIT = T.amber; // 순이익 강조색(주황)

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: T.sub }}>{label}</Text>
      <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{value}</Text>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = getRecipe(id);
  const detail = id ? RECIPE_DETAILS[id] : undefined;
  const [view, setView] = useState<'one' | 'month'>('one'); // 1개 / 월 평균 토글

  if (!r) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AppHeader title="레시피" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: T.ter }}>메뉴를 찾을 수 없습니다.</Text>
        </View>
      </View>
    );
  }

  // 재료 라인(1인분) — 라인원가 합계를 재료 원가로 사용(화면 내 일관).
  const lines = (detail?.lines ?? []).map((l) => ({ ...l, cost: round(l.qty * l.unitPrice) }));
  const price = r.price;
  const material = lines.length ? lines.reduce((s, l) => s + l.cost, 0) : r.materialPerServing;
  const extra = detail?.extras.reduce((s, e) => s + e.amount, 0) ?? r.extraPerServing;
  const tax = round((price * 10) / 110);
  const fixed = round(r.fixedRate * price);
  const profit = price - tax - material - fixed - extra;
  const profitRate = profit / price;
  const stopped = r.status === 'stopped';
  const warn = !stopped && profitRate < r.target;
  const recRaw = recommendedPrice(material + extra, r.fixedRate, r.target);
  const recommended = recRaw == null ? null : Math.round(recRaw / 100) * 100;
  const m = view === 'one' ? 1 : r.salesVolume; // 금액 배수(월 평균)

  // 도넛 — 판매가 구성. 순이익=주황, 비용=그레이 진하기.
  const breakdown = [
    { label: '재료', amt: material, color: '#8B95A1' },
    { label: '추가 지출', amt: extra, color: '#CDD3DA' },
    { label: '고정 지출', amt: fixed, color: '#5B6573' },
    { label: '세금', amt: tax, color: '#B0B8C1' },
    { label: '순이익', amt: profit, color: PROFIT },
  ].filter((s) => s.amt > 0);
  const segments = breakdown.map((b) => ({ label: b.label, value: (b.amt / price) * 100, color: b.color }));

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="레시피"
        onBack={() => router.back()}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 8 }}>
            <Icon name="edit" size={19} color={T.ink2} fill />
            <Text style={{ color: T.ink2, fontSize: 16, fontWeight: '700' }}>수정</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 11 }}>
        {/* 정보 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <Text style={{ fontSize: 21, fontWeight: '800', letterSpacing: -0.4, color: T.ink }}>{r.name}</Text>
            {stopped ? <Badge tone="neutral" sm solid>판매중지</Badge> : warn ? <Badge tone="red" sm solid>목표 미달</Badge> : <Badge tone="green" sm solid>목표 달성</Badge>}
          </View>
          <InfoRow label="판매가" value={`${won(price)}원`} />
          <InfoRow label="월 평균 판매량" value={`${won(r.salesVolume)}개`} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 11 }}>
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: T.sub }}>목표 순이익률</Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{pct(r.target)}%</Text>
          </View>
        </Card>

        {/* 도넛 — 판매가 구성 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Donut
              segments={segments}
              size={120}
              thick={18}
              centerTop="순이익률"
              centerMain={`${pct(profitRate)}%`}
              mainSize={21}
              mainColor={PROFIT}
            />
            <View style={{ flex: 1, gap: 6 }}>
              {breakdown.map((b) => {
                const accent = b.label === '순이익';
                return (
                  <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: b.color }} />
                    <Text style={{ flex: 1, fontSize: 12.5, fontWeight: accent ? '800' : '600', color: accent ? PROFIT : T.sub }}>{b.label}</Text>
                    <Text style={[{ fontSize: 13, fontWeight: '800', color: accent ? PROFIT : T.ink }, NUM]}>{won(b.amt)}원</Text>
                    <Text style={[{ fontSize: 11.5, fontWeight: '600', color: accent ? PROFIT : T.ter, width: 40, textAlign: 'right' }, NUM]}>{pct(b.amt / price)}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Card>

        {/* 재료 */}
        {lines.length > 0 ? (
          <Card pad={16}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573' }}>재료 <Text style={{ fontSize: 13, fontWeight: '600', color: T.sub2 }}>(1개 기준)</Text></Text>
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 12, color: T.ter, fontWeight: '600' }}>(1회 생산량 : {won(r.servings)}개)</Text>
            </View>
            {lines.map((l, i) => (
              <View key={i} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: T.ink }}>{l.name}</Text>
                  <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{won(l.cost)}원</Text>
                  <Text style={[{ fontSize: 12.5, color: T.ter, fontWeight: '600', width: 48, textAlign: 'right' }, NUM]}>{pct(l.cost / price)}%</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <Text style={[{ flex: 1, fontSize: 12.5, color: T.ter, fontWeight: '600' }, NUM]}>{l.unitPrice}원/{l.unit}</Text>
                  <Text style={[{ fontSize: 12.5, color: T.ter, fontWeight: '600', marginRight: 48 }, NUM]}>{l.qty}{l.unit}</Text>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink2 }}>소계</Text>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(material)}원</Text>
              <Text style={[{ fontSize: 12.5, color: T.sub2, fontWeight: '700', width: 48, textAlign: 'right' }, NUM]}>{pct(material / price)}%</Text>
            </View>
          </Card>
        ) : null}

        {/* 추가 지출 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573' }}>추가 지출</Text>
            <Text style={{ fontSize: 12, color: T.ter, fontWeight: '600' }}>(이 메뉴에만 추가되는 지출)</Text>
          </View>
          {detail && detail.extras.length > 0 ? (
            detail.extras.map((e, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ink2 }}>{e.name}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(e.amount)}원</Text>
                <Text style={[{ fontSize: 12.5, color: T.ter, fontWeight: '600', width: 48, textAlign: 'right' }, NUM]}>{pct(e.amount / price)}%</Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 13, color: T.ter, paddingVertical: 4 }}>등록된 추가 지출이 없습니다.</Text>
          )}
        </Card>

        {/* 고정 지출 항목별 */}
        <Card pad={16}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573', marginBottom: 8 }}>고정 지출</Text>
          {FIXED_ITEMS.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < FIXED_ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ink2 }}>{f.name}</Text>
              <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(round(f.rate * price))}원</Text>
              <Text style={[{ fontSize: 12.5, color: T.ter, fontWeight: '600', width: 48, textAlign: 'right' }, NUM]}>{pct(f.rate)}%</Text>
            </View>
          ))}
          {/* 소계 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: T.ink2 }}>소계</Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(fixed)}원</Text>
            <Text style={[{ fontSize: 12.5, color: T.sub2, fontWeight: '700', width: 48, textAlign: 'right' }, NUM]}>{pct(r.fixedRate)}%</Text>
          </View>
          <Text style={{ fontSize: 12, color: T.ter, marginTop: 8, lineHeight: 18 }}>월 고정비(임대료·인건비 등)를 메뉴 1개당 얼마씩 부담해야 하는지 판매량 기준으로 나누어 계산한 금액입니다.</Text>
        </Card>

        {/* 세금 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573' }}>세금</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ink2 }}>부가세</Text>
            <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(tax)}원</Text>
            <Text style={[{ fontSize: 12.5, color: T.ter, fontWeight: '600', width: 48, textAlign: 'right' }, NUM]}>{pct(tax / price)}%</Text>
          </View>
        </Card>

        {/* 손익 미리보기 표 */}
        <Card pad={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573' }}>손익 미리보기</Text>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: '#E8EBEE', borderRadius: 9, padding: 3 }}>
              {([['one', '1개'], ['month', '월 평균']] as const).map(([k, label]) => (
                <Pressable key={k} onPress={() => setView(k)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 7, backgroundColor: view === k ? T.surface : 'transparent' }}>
                  <Text style={{ fontSize: 13, fontWeight: view === k ? '700' : '600', color: view === k ? T.ink : T.ter }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 판매량 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub }}>판매량</Text>
            <Text style={[{ fontSize: 14.5, fontWeight: '700', color: T.ink }, NUM]}>{won(m)}개</Text>
            <Text style={{ fontSize: 12, color: T.ter, width: 46, textAlign: 'right' }}>—</Text>
          </View>
          {/* 판매가 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }}>판매가</Text>
            <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink }, NUM]}>{won(price * m)}원</Text>
            <Text style={[{ fontSize: 12, fontWeight: '600', color: T.ter, width: 46, textAlign: 'right' }, NUM]}>100%</Text>
          </View>
          {/* 비용 행 */}
          {[
            { label: '세금', amt: tax },
            { label: '재료 원가', amt: material },
            { label: '고정 지출', amt: fixed },
            ...(extra > 0 ? [{ label: '추가 지출', amt: extra }] : []),
          ].map((c) => (
            <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ink2 }}>
                <Text style={{ color: T.ter }}>(−) </Text>{c.label}
              </Text>
              <Text style={[{ fontSize: 14.5, fontWeight: '700', color: T.cost }, NUM]}>{won(c.amt * m)}원</Text>
              <Text style={[{ fontSize: 12, fontWeight: '600', color: T.ter, width: 46, textAlign: 'right' }, NUM]}>{pct(c.amt / price)}%</Text>
            </View>
          ))}
          {/* 순이익 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: warn && recommended != null ? 1 : 0, borderBottomColor: T.line2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: PROFIT }}>순이익</Text>
              {warn ? <Badge tone="red" sm solid>목표 미달</Badge> : null}
            </View>
            <Text style={[{ fontSize: 17, fontWeight: '800', color: PROFIT }, NUM]}>{won(profit * m)}원</Text>
            <Text style={[{ fontSize: 12.5, fontWeight: '700', color: PROFIT, width: 46, textAlign: 'right' }, NUM]}>{pct(profitRate)}%</Text>
          </View>
          {/* 권장 판매가 (목표 미달 시) */}
          {warn && recommended != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.sub }}>{view === 'month' ? '목표 순이익' : '권장 판매가'}</Text>
                <Text style={{ fontSize: 11.5, color: T.ter, marginTop: 1 }}>{pct(r.target)}% 기준</Text>
              </View>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{won(recommended * m)}원</Text>
              <Text style={[{ fontSize: 12, fontWeight: '700', color: T.blue, width: 46, textAlign: 'right' }, NUM]}>{pct(r.target)}%</Text>
            </View>
          ) : null}
        </Card>

      </ScrollView>
    </View>
  );
}
