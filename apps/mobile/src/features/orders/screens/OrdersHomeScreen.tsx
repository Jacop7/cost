/**
 * ORD-01 발주 현황 홈 (③ 3장) — 프로토타입 ScreenORD01 을 kit 컴포넌트로 RN 이식.
 * 3탭: 발주 후보(안전재고·소진 자동 분류) / 도착 대기(입고 확정) / 입고 완료.
 * ⚠ 디자인 프로토타입(정적 데모). 발주 등록(E7)·입고 확정(E1)은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Icon, Sheet } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { Candidate, CANDIDATES, Done, DONE, Waiting, WAITING } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

function ReasonBadge({ c }: { c: Candidate }) {
  const tone = c.reason === 'out' ? 'red' : c.reason === 'low' ? 'amber' : 'blue';
  return (
    <Badge tone={tone} solid sm>
      {c.reasonLabel}
    </Badge>
  );
}

function CandidateCard({ c, onOrder, onDone }: { c: Candidate; onOrder: () => void; onDone: () => void }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingVertical: 13, paddingHorizontal: 15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <ReasonBadge c={c} />
          <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{c.name}</Text>
        </View>
        {c.calcNote ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Icon name="receipt" size={13} color={T.blue} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: T.blue }}>{c.calcNote}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 11 }}>
          <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: T.sub }}>권장 발주</Text>
            <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 3 }, NUM]}>{c.rec}</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: T.sub }}>현재 재고</Text>
            <Text style={[{ fontSize: 14, fontWeight: '800', color: T.sub, marginTop: 3 }, NUM]}>{c.remain}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="history" size={14} color={T.ter} />
          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '500', color: T.sub2 }}>{c.recent}</Text>
        </View>
        {c.hint ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 }}>
            <Icon name="trend" size={13} color={T.green} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: T.green }}>{c.hint}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button kind="tint" size="sm" icon="link" style={{ flex: 1 }} onPress={onOrder}>주문하기</Button>
          <Button kind="primary" size="sm" style={{ flex: 1 }} onPress={onDone}>발주 완료</Button>
        </View>
      </View>
    </Card>
  );
}

function WaitingCard({ w }: { w: Waiting }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingVertical: 13, paddingHorizontal: 15 }}>
        {/* 입고예정/입고지연 + 이름 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone={w.late ? 'red' : 'blue'} sm solid>
            {w.late ? '입고지연' : '입고예정'}
          </Badge>
          <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{w.name}</Text>
        </View>
        {/* 도착 예정일 */}
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: w.late ? T.red : T.ink2, marginTop: 9 }}>{w.due}</Text>
        {/* 구매처 · 브랜드 · 금액 */}
        <Text style={[{ fontSize: 13.5, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>
          {w.vendor}{w.brand ? ` · ${w.brand}` : ''} · {won(w.amt)}원
        </Text>
        {/* 버튼 2열 */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button kind="gray" size="sm" style={{ flex: 1 }}>예정일 수정</Button>
          <Button kind="primary" size="sm" style={{ flex: 1 }}>입고 완료</Button>
        </View>
      </View>
    </Card>
  );
}

function DoneCard({ d }: { d: Done }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ paddingVertical: 13, paddingHorizontal: 15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone="green" sm solid>입고완료</Badge>
          <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{d.name}</Text>
        </View>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.ink2, marginTop: 9 }}>{d.date} 입고</Text>
        <Text style={[{ fontSize: 13.5, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>
          {d.vendor} · {won(d.amt)}원
        </Text>
      </View>
    </Card>
  );
}

const TABS = ['발주 후보', '입고 예정', '입고 완료'];

export default function OrdersHomeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [orderSel, setOrderSel] = useState<Candidate | null>(null);
  const [doneSel, setDoneSel] = useState<Candidate | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>발주 현황</Text>
          </View>
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="search" size={23} color={T.ink2} />
          </Pressable>
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={24} color={T.ink2} />
            <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: T.red, borderWidth: 1.5, borderColor: '#fff' }} />
          </Pressable>
        </View>
      </View>

      {/* 탭 — 밑줄형, 좌측 정렬 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#D1D6DB', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 20 }}>
          {TABS.map((t, i) => {
            const on = tab === i;
            return (
              <Pressable key={i} onPress={() => setTab(i)} style={{ paddingBottom: 11 }}>
                <Text style={{ fontSize: 16, fontWeight: on ? '700' : '600', color: on ? T.ink : T.ter }}>{t}</Text>
                {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2.5, backgroundColor: T.ink, borderRadius: 2 }} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 탭 콘텐츠 */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 104, gap: 11, flexGrow: 1 }}>
        {tab === 0 ? (
          <>
            {CANDIDATES.map((c, i) => (
              <CandidateCard key={i} c={c} onOrder={() => setOrderSel(c)} onDone={() => setDoneSel(c)} />
            ))}
          </>
        ) : tab === 1 ? (
          <>
            {WAITING.map((w, i) => (
              <WaitingCard key={i} w={w} />
            ))}
            <Text style={{ textAlign: 'center', fontSize: 12.5, color: T.ter, marginTop: 4 }}>
              잔여재고·평균단가는 입고 확정 시점에만 갱신돼요
            </Text>
          </>
        ) : DONE.length > 0 ? (
          DONE.map((d, i) => <DoneCard key={i} d={d} />)
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <Text style={{ fontSize: 15, color: T.ter }}>입고 완료 내역이 없어요</Text>
          </View>
        )}
      </ScrollView>

      {/* 주문하기 — 구매 링크·옵션 시트 (ORD-05) */}
      <Sheet
        visible={orderSel != null}
        onClose={() => setOrderSel(null)}
        title="구매 링크 · 옵션"
        sub={orderSel ? `${orderSel.name} · 등록된 구매처에서 주문하세요` : undefined}
        height={460}
      >
        {orderSel ? (
          <View style={{ gap: 10 }}>
            {orderSel.options.map((o, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: T.surface2, borderRadius: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 14.5, fontWeight: '700', color: T.ink }, NUM]}>{o.name} · {o.vol} · {won(o.amt)}원</Text>
                  <Text style={[{ fontSize: 12.5, color: T.ter, marginTop: 3 }, NUM]}>{o.vendor} · {o.per}</Text>
                </View>
                <Button kind="tint" size="sm" icon="link">주문</Button>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Icon name="info" size={15} color={T.ter} />
              <Text style={{ fontSize: 12, color: T.ter }}>링크는 식재료 상세에서 추가·관리할 수 있어요</Text>
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* 발주 완료 — 구매처 선택 시트 (ORD-06) */}
      <Sheet
        visible={doneSel != null}
        onClose={() => setDoneSel(null)}
        title="발주 완료"
        sub={doneSel ? `${doneSel.name} · 어디서 샀는지 선택하세요` : undefined}
        height={480}
      >
        {doneSel ? (
          <View style={{ gap: 10 }}>
            {doneSel.options.map((o, i) => (
              <Pressable key={i} onPress={() => setDoneSel(null)} style={{ paddingVertical: 13, paddingHorizontal: 14, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12 }}>
                <Text style={[{ fontSize: 14.5, fontWeight: '700', color: T.ink }, NUM]}>{o.name} · {o.vol} · {won(o.amt)}원</Text>
                <Text style={[{ fontSize: 12.5, color: T.ter, marginTop: 3 }, NUM]}>{o.vendor} · {o.per}</Text>
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Icon name="info" size={15} color={T.ter} />
              <Text style={{ fontSize: 12, color: T.ter }}>링크는 식재료 상세에서 추가·관리할 수 있어요</Text>
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
