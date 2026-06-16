/**
 * RCP-03 레시피 추가 (② 4.3) — 레시피 상세(RCP-02) 레이아웃 기준의 입력 폼.
 * 메뉴명·기준인분·판매가·부가세·목표·월평균판매량 + 재료(검색·담기) + 추가지출 + 고정지출(읽기전용) + 손익 미리보기 + 저장.
 * ⚠ 현재는 디자인 프로토타입(정적 입력·제육볶음 프리필). 실제 입력/계산/저장은 데이터 연결 단계에서 TextInput·RPC(E3)로.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Field, Icon, Input, Select, Sheet } from '@/components/kit';
import { recommendedPrice, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { FIXED_ITEMS, getRecipe, pct, RECIPE_DETAILS } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };
const PROFIT = T.amber;

// 제육볶음(RCP-0007) 프리필 — 손익 미리보기 실시간 계산 예시.
const R = getRecipe('RCP-0007')!;
const D = RECIPE_DETAILS['RCP-0007']!;

export default function RecipeAddScreen() {
  const router = useRouter();
  const [view, setView] = useState<'one' | 'month'>('one'); // 1개 / 월 평균
  const m = view === 'one' ? 1 : R.salesVolume;
  const [extras, setExtras] = useState(() => D.extras.map((e) => ({ ...e })));
  const addExtra = () => setExtras((prev) => [...prev, { name: '', amount: 0 }]);
  const removeExtra = (i: number) => setExtras((prev) => prev.filter((_, j) => j !== i));
  const [lineItems, setLineItems] = useState(() => D.lines.map((l) => ({ ...l })));
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const removeLine = (i: number) => setLineItems((prev) => prev.filter((_, j) => j !== i));

  const lines = lineItems.map((l) => ({ ...l, cost: round(l.qty * l.unitPrice) }));
  const price = R.price;
  const material = lines.reduce((s, l) => s + l.cost, 0);
  const extra = extras.reduce((s, e) => s + e.amount, 0);
  const tax = round((price * 10) / 110);
  const fixed = round(R.fixedRate * price);
  const profit = price - tax - material - fixed - extra;
  const profitRate = profit / price;
  const warn = profitRate < R.target;
  const recRaw = recommendedPrice(material + extra, R.fixedRate, R.target);
  const recommended = recRaw == null ? null : Math.round(recRaw / 100) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="레시피 추가" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 11 }}>
        {/* 기본 정보 */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16 }}>
          <Field label="메뉴명" req>
            <Input value="제육볶음" />
          </Field>
          <Field label="판매가" req>
            <Input value="12,000" suffix="원" mono />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="월 평균 판매량" right={<Icon name="info" size={14} color={T.ter} />}>
                <Input value="300" suffix="개" mono />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="1회 생산량" right={<Icon name="info" size={14} color={T.ter} />}>
                <Input value={String(R.servings)} suffix="개" mono />
              </Field>
            </View>
          </View>
          <Field label="목표 순이익률" right={<Icon name="info" size={14} color={T.ter} />}>
            <Input value="40" suffix="%" mono />
          </Field>
        </View>

        {/* 재료 — 검색·담기 */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573', marginBottom: 4 }}>재료</Text>
          {/* 표 헤더 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 12, color: T.ter, fontWeight: '700' }}>재료명</Text>
            <Text style={{ width: 80, fontSize: 12, color: T.ter, fontWeight: '700', textAlign: 'right' }}>{won(R.servings)}개</Text>
            <Text style={{ width: 70, fontSize: 12, color: T.ter, fontWeight: '700', textAlign: 'right' }}>1개</Text>
            <View style={{ width: 26 }} />
          </View>
          {lines.map((l, i) => (
            <Pressable key={i} onPress={() => setEditIdx(i)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: T.ink }}>{l.name}</Text>
              <View style={{ width: 80, alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink }, NUM]}>{won(l.cost * R.servings)}원</Text>
                <Text style={[{ fontSize: 11.5, color: T.ter, fontWeight: '600', marginTop: 1 }, NUM]}>{won(l.qty * R.servings)}{l.unit}</Text>
              </View>
              <View style={{ width: 70, alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 14, fontWeight: '800', color: T.ink }, NUM]}>{won(l.cost)}원</Text>
                <Text style={[{ fontSize: 11.5, color: T.ter, fontWeight: '600', marginTop: 1 }, NUM]}>{l.qty}{l.unit}</Text>
              </View>
              <View style={{ width: 26, alignItems: 'flex-end' }}>
                <Icon name="chevron" size={18} color="#C5CCD3" />
              </View>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/recipes/ingredient-search' as Href)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}>
            <Icon name="search" size={17} color={T.blue} />
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.blue }}>재료 검색 · 담기</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: T.ter, marginTop: 8 }}>식재료는 검색해서만 추가됩니다(단가 자동 연동). 컵·스푼 입력 시 ml로 자동 환산.</Text>
        </View>

        {/* 추가 지출 */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573' }}>추가 지출</Text>
            <Text style={{ fontSize: 12, color: T.ter, fontWeight: '600' }}>(이 메뉴에만 추가되는 지출)</Text>
          </View>
          <View style={{ gap: 8 }}>
            {extras.map((e, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Input value={e.name} placeholder="지출명" />
                </View>
                <View style={{ width: 132 }}>
                  <Input value={e.amount > 0 ? won(e.amount) : ''} placeholder="금액" mono />
                </View>
                <Pressable hitSlop={6} onPress={() => removeExtra(i)}>
                  <Icon name="close" size={18} color={T.ter} />
                </Pressable>
              </View>
            ))}
          </View>
          <Pressable onPress={addExtra} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: T.blue, borderStyle: 'dashed', backgroundColor: T.blueTint }}>
            <Icon name="plus" size={17} color={T.blue} sw={2.2} />
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.blue }}>추가</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: T.ter, marginTop: 8, lineHeight: 17 }}>포장·배달 등 고정 지출에 이미 포함된 비용은 중복 입력하지 마세요.</Text>
        </View>

        {/* 고정 지출 (자동·읽기전용) */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#5B6573' }}>고정 지출</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => router.push('/recipes/fixed-cost' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
              <Icon name="chevron" size={15} color={T.ter} />
            </Pressable>
          </View>
          {FIXED_ITEMS.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < FIXED_ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ink2 }}>{f.name}</Text>
              <Text style={[{ fontSize: 14, fontWeight: '700', color: T.ink }, NUM]}>{won(round(f.rate * price))}원</Text>
              <Text style={[{ fontSize: 12.5, color: T.ter, fontWeight: '600', width: 48, textAlign: 'right' }, NUM]}>{pct(f.rate)}%</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '800', color: T.ink2 }}>소계</Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(fixed)}원</Text>
            <Text style={[{ fontSize: 12.5, color: T.sub2, fontWeight: '700', width: 48, textAlign: 'right' }, NUM]}>{pct(R.fixedRate)}%</Text>
          </View>
        </View>

        {/* 손익 미리보기 */}
        <View style={{ backgroundColor: T.surface, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: '#5B6573' }}>손익 미리보기</Text>
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
          {[
            { label: '세금', amt: tax },
            { label: '재료 원가', amt: material },
            { label: '고정 지출', amt: fixed },
            { label: '추가 지출', amt: extra },
          ].map((c) => (
            <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.ink2 }}>
                <Text style={{ color: T.ter }}>(−) </Text>{c.label}
              </Text>
              <Text style={[{ fontSize: 14.5, fontWeight: '700', color: T.cost }, NUM]}>{won(c.amt * m)}원</Text>
              <Text style={[{ fontSize: 12, fontWeight: '600', color: T.ter, width: 46, textAlign: 'right' }, NUM]}>{pct(c.amt / price)}%</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: warn && recommended != null ? 1 : 0, borderBottomColor: T.line2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: PROFIT }}>순이익</Text>
              {warn ? <Badge tone="red" sm solid>목표 미달</Badge> : null}
            </View>
            <Text style={[{ fontSize: 17, fontWeight: '800', color: PROFIT }, NUM]}>{won(profit * m)}원</Text>
            <Text style={[{ fontSize: 12.5, fontWeight: '700', color: PROFIT, width: 46, textAlign: 'right' }, NUM]}>{pct(profitRate)}%</Text>
          </View>
          {warn && recommended != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.sub }}>{view === 'month' ? '목표 순이익' : '권장 판매가'}</Text>
                <Text style={{ fontSize: 11.5, color: T.ter, marginTop: 1 }}>{pct(R.target)}% 기준</Text>
              </View>
              <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{won(recommended * m)}원</Text>
              <Text style={[{ fontSize: 12, fontWeight: '700', color: T.blue, width: 46, textAlign: 'right' }, NUM]}>{pct(R.target)}%</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* 하단 저장 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => router.back()}>
          저장
        </Button>
      </View>

      {/* 재료 사용량 입력/수정 시트 */}
      <Sheet visible={editIdx != null} onClose={() => setEditIdx(null)} title={editIdx != null ? lineItems[editIdx]?.name : undefined} height={440}>
        {editIdx != null && lineItems[editIdx]
          ? (() => {
              const l = lineItems[editIdx];
              const batchQty = l.qty * R.servings;
              const batchCost = round(l.unitPrice * batchQty);
              const per = round(batchCost / R.servings);
              return (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: T.blueTint, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, marginTop: 2, marginBottom: 14 }}>
                    <Icon name="box" size={15} color={T.blue} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: T.blue }}>{R.servings}개 생산량을 입력하세요. (1회 생산량)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1, borderWidth: 1.5, borderColor: T.blue, borderRadius: 12, backgroundColor: T.surface, paddingVertical: 13, paddingHorizontal: 16 }}>
                      <Text style={[{ fontSize: 20, fontWeight: '700', color: T.ink }, NUM]}>{won(batchQty)}</Text>
                    </View>
                    <View style={{ width: 96 }}>
                      <Select value={l.unit} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <View style={{ flex: 1, backgroundColor: T.surface2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.sub2 }}>{R.servings}개 기준</Text>
                      <Text style={[{ fontSize: 18, fontWeight: '800', color: T.ink, marginTop: 4 }, NUM]}>{won(batchCost)}<Text style={{ fontSize: 13, fontWeight: '700' }}>원</Text></Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: T.blueTint, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 15 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.blue }}>1개당</Text>
                      <Text style={[{ fontSize: 18, fontWeight: '800', color: T.blue, marginTop: 4 }, NUM]}>{won(per)}<Text style={{ fontSize: 13, fontWeight: '700' }}>원</Text></Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                    <Button kind="danger" size="lg" onPress={() => { removeLine(editIdx); setEditIdx(null); }} style={{ flex: 1 }}>
                      삭제
                    </Button>
                    <Button kind="primary" size="lg" onPress={() => setEditIdx(null)} style={{ flex: 1.6 }}>
                      담기
                    </Button>
                  </View>
                </View>
              );
            })()
          : null}
      </Sheet>
    </View>
  );
}
