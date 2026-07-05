/**
 * RCP-03 레시피 추가/수정 (② 4.3) — 프로토타입 레이아웃 그대로 이식.
 * 기본정보(+정보 툴팁) · 재료(10/1개 탭) · 부자재(10/1개 탭) · 고정지출(10/1개 탭) · 손익 미리보기(10/1/월).
 * ⚠ 디자인 프로토타입(정적·제육볶음 프리필). 실제 입력/계산/저장(E3)은 데이터 연결 단계에서.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, Select } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { recommendedPrice, round } from '@sikjae/core';
import { T, won } from '@/theme/tokens';
import { FIXED_ITEMS, getRecipe, pct, RECIPE_DETAILS } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

// 제육볶음(RCP-0007) 프리필 — 손익 미리보기 실시간 계산 예시.
const R = getRecipe('RCP-0007')!;
const D = RECIPE_DETAILS['RCP-0007']!;

// 섹션 카드 헤더 — 회색(surface2) 바.
function SecHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: T.surface2, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.sub }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 14, color: T.ter, fontWeight: '600' }}>{sub}</Text> : null}
    </View>
  );
}

// 필드 우측 정보(?) 버튼.
function InfoBtn({ active, onPress }: { active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ padding: 2 }}>
      <Icon name="info" size={14} color={active ? T.blue : T.ter} />
    </Pressable>
  );
}

type CostMode = 'ten' | 'one';
type PlMode = 'ten' | 'one' | 'month';

// 기준 밑줄 탭 (10개/1개[/월평균]).
function ModeTabs<T2 extends string>({ tabs, value, onChange }: { tabs: [T2, string][]; value: T2; onChange: (v: T2) => void }) {
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

function Footer({ children }: { children: ReactNode }) {
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 15, backgroundColor: T.surface2, borderTopWidth: 1, borderTopColor: T.line2 }}>
      <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export default function RecipeAddScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<'sales' | 'target' | null>(null);
  const [costMode, setCostMode] = useState<CostMode>('ten');
  const [plMode, setPlMode] = useState<PlMode>('one');
  const [extras, setExtras] = useState(() => D.extras.map((e) => ({ ...e })));
  const removeExtra = (i: number) => setExtras((prev) => prev.filter((_, j) => j !== i));

  const lines = D.lines.map((l) => ({ ...l, cost: round(l.qty * l.unitPrice) }));
  const price = R.price;
  const material = lines.reduce((s, l) => s + l.cost, 0);
  const extra = extras.reduce((s, e) => s + e.amount, 0);
  const tax = round((price * 10) / 110);
  const fixed = round(R.fixedRate * price);
  const profit = price - tax - material - fixed - extra;
  const profitRate = profit / price;
  const warn = profitRate < R.target;
  const PROFIT = warn ? T.red : T.green;
  const recRaw = recommendedPrice(material + extra, R.fixedRate, R.target);
  const recommended = recRaw == null ? null : Math.round(recRaw / 100) * 100;

  const cm = costMode === 'ten' ? 10 : 1; // 재료·부자재·고정 표시 배수
  const m = plMode === 'ten' ? 10 : plMode === 'month' ? R.salesVolume : 1; // 손익 배수
  const wm = (v: number) => `${won(v * m)}원`;

  const costTabs: [CostMode, string][] = [['ten', '10개 기준'], ['one', '1개 기준']];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="레시피 추가" onBack={() => safeBack('/recipes')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}>
        {/* 기본 정보 */}
        <View style={{ marginBottom: 14 }}>
          <Field label="메뉴명" req><Input value="제육볶음" /></Field>
          <Field label="카테고리" req><Select value="볶음" /></Field>
          <Field label="판매가" req><Input value="12,000" suffix="원" mono /></Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="월 평균 판매량" right={<InfoBtn active={info === 'sales'} onPress={() => setInfo((v) => (v === 'sales' ? null : 'sales'))} />}>
                <Pressable onPress={() => router.push('/recipes/avg-sales' as Href)}>
                  <Input value="300" suffix="개" mono right={<Icon name="chevron" size={16} color={T.line3} />} />
                </Pressable>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="1회 생산량"><Input value="10" suffix="개" mono /></Field>
            </View>
          </View>
          <View style={{ marginBottom: -4 }}>
            <Field label="목표 순이익률" right={<InfoBtn active={info === 'target'} onPress={() => setInfo((v) => (v === 'target' ? null : 'target'))} />}>
              <Input value="40" suffix="%" mono />
            </Field>
          </View>
        </View>

        {/* 정보 툴팁 */}
        {info ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: -8, marginBottom: 18, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: T.blueTint, borderRadius: 10 }}>
            <Icon name="info" size={15} color={T.blue} />
            <Text style={{ flex: 1, fontSize: 14, color: T.sub, fontWeight: '600', lineHeight: 21 }}>
              {info === 'sales'
                ? '한 달 평균 판매 수량이에요. 이 값으로 고정 지출을 메뉴별로 나눠 1개당 원가에 반영해요. 많이 팔수록 1개가 떠안는 고정비가 줄어 순이익률이 올라가요.'
                : '이 메뉴에서 남기고 싶은 순이익 비율이에요. 현재 순이익률이 목표보다 낮으면 권장 판매가를 알려드려요.'}
            </Text>
          </View>
        ) : null}

        {/* 재료 */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="재료" />
          <ModeTabs tabs={costTabs} value={costMode} onChange={setCostMode} />
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {lines.map((l, i) => (
              <Pressable key={i} onPress={() => router.push('/recipes/ingredient-search' as Href)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: T.ink }}>{l.name}</Text>
                <View style={{ alignItems: 'flex-end', marginRight: 4 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(l.cost * cm)}원</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, marginTop: 1 }, NUM]}>{won(l.qty * cm)}{l.unit}</Text>
                </View>
                <Icon name="chevron" size={15} color={T.line3} />
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/recipes/ingredient-search' as Href)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}>
              <Icon name="search" size={17} color={T.blue} sw={2.1} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>재료 검색</Text>
            </Pressable>
          </View>
          <Footer>식재료는 검색해서만 추가됩니다(단가 자동 연동). 컵·스푼 입력 시 ml로 자동 환산.</Footer>
        </Card>

        <View style={{ height: 9 }} />

        {/* 부자재 */}
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="부자재" sub="(이 메뉴에만 들어가는 부자재)" />
          <ModeTabs tabs={costTabs} value={costMode} onChange={setCostMode} />
          <View style={{ paddingHorizontal: 15, paddingVertical: 13 }}>
            {extras.map((e, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: i < extras.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{e.name || '부자재'}</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, marginTop: 2 }, NUM]}>개당 {won(e.amount)}원</Text>
                </View>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(e.amount * cm)}원</Text>
                <Pressable onPress={() => removeExtra(i)} hitSlop={6} style={{ width: 28, alignItems: 'flex-end' }}>
                  <Icon name="close" size={18} color={T.ter} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => router.push('/recipes/material-search' as Href)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: extras.length ? 10 : 0, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: T.blue, backgroundColor: T.blueTint }}>
              <Icon name="search" size={17} color={T.blue} sw={2.1} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>부자재 검색</Text>
            </Pressable>
          </View>
          <Footer>부자재 마스터에서 검색해 담고 개당 수량만 입력하면 단가가 자동 연동됩니다.</Footer>
        </Card>

        <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 9, marginBottom: 16, paddingHorizontal: 2 }}>포장·배달 등 고정 지출에 이미 포함된 비용은 중복 입력하지 마세요.</Text>

        {/* 고정 지출 */}
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="고정 지출" sub="(개당 환산)" />
          <ModeTabs tabs={costTabs} value={costMode} onChange={setCostMode} />
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {FIXED_ITEMS.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < FIXED_ITEMS.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink2 }}>{f.name}</Text>
                <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{won(round(f.rate * price) * cm)}원</Text>
                  <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', marginTop: 2 }, NUM]}>{pct(f.rate)}%</Text>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.line }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: T.ink2 }}>소계</Text>
              <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{won(fixed * cm)}원</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', color: T.sub2, marginTop: 2 }, NUM]}>{pct(R.fixedRate)}%</Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, color: T.ter, lineHeight: 20, marginTop: 10 }}>월 고정비(임대료·인건비 등)를 메뉴 1개당 얼마씩 부담해야 하는지 판매량 기준으로 나누어 계산한 금액입니다.</Text>
          </View>
          <Pressable onPress={() => router.push('/recipes/fixed-cost' as Href)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 13, borderTopWidth: 1, borderTopColor: T.line2, backgroundColor: T.surface2 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub }}>자세히 보기</Text>
            <Icon name="chevron" size={16} color={T.ter} />
          </Pressable>
        </Card>

        <View style={{ height: 14 }} />

        {/* 손익 미리보기 */}
        <Card onLine pad={0} style={{ overflow: 'hidden' }}>
          <SecHead title="손익 미리보기" sub="판매가 대비 %" />
          <ModeTabs tabs={[['ten', '10개 기준'], ['one', '1개 기준'], ['month', '월평균 기준']]} value={plMode} onChange={setPlMode} />
          <View style={{ paddingHorizontal: 15, paddingTop: 4, paddingBottom: 15 }}>
            {/* 판매량 — 우측: 값(위) / 보조(아래) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line2 }}>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.sub }}>판매량</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[{ fontSize: 16, fontWeight: '700', color: T.ink }, NUM]}>{plMode === 'month' ? `월 ${won(R.salesVolume)}개` : `${m}개`}</Text>
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
            {/* 권장 판매가 — 우측: 금액(위) / % (아래) */}
            {warn && recommended != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: T.line }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2 }}>권장 판매가</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 1 }}>목표 {pct(R.target)}% 기준</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[{ fontSize: 16, fontWeight: '800', color: T.blue }, NUM]}>{won(recommended)}원</Text>
                  <Text style={[{ fontSize: 14, fontWeight: '700', color: T.blue, marginTop: 2 }, NUM]}>{pct(R.target)}%</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Card>
      </ScrollView>

      {/* 하단 저장 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 11, paddingBottom: 28, backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.line2 }}>
        <Button kind="primary" size="lg" full onPress={() => safeBack('/recipes')}>저장</Button>
      </View>
    </View>
  );
}
