/**
 * ORD-01 발주 현황 홈 — 프로토타입(발주 현황 페이지 정리본) 이식.
 * 3탭: 발주 대기(안전재고·소진 분류) / 입고 예정 / 입고 완료.
 * 대기 → 주문하기(구매 링크 시트 → ORD-02 발주완료) / 발주 완료(옵션 선택 시트). 예정 → 입고 완료(확인 시트).
 * ⚠ 디자인 프로토타입(정적 데모). 발주 등록(E7)·입고 확정(E1)은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Icon, Sheet, Stepper } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { Candidate, CANDIDATES, Done, DONE, OPTIONS, OrderOption, Waiting, WAITING } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

function reasonTone(reason: Candidate['reason']): 'red' | 'amber' | 'blue' {
  return reason === 'out' ? 'red' : reason === 'low' ? 'amber' : 'blue';
}

// ── 발주 대기 카드 ─────────────────────────────────────────────
function CandidateCard({ c, onOrder, onComplete }: { c: Candidate; onOrder: () => void; onComplete: () => void }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Badge tone={reasonTone(c.reason)} solid sm>{c.reasonLabel}</Badge>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{c.name}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 11, marginBottom: 10 }}>
          <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: T.sub }}>권장 발주</Text>
            <Text style={[{ fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 3 }, NUM]}>{c.rec}{c.recUnit}</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: T.sub }}>현재 재고</Text>
            <Text style={[{ fontSize: 14, fontWeight: '600', color: T.sub, marginTop: 3 }, NUM]}>{c.remain}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone="neutral" sm>최근 주문</Badge>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontWeight: '500', color: T.sub2 }}>{c.recent}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button kind="tint" size="sm" full onPress={onOrder} style={{ flex: 1 }}>주문하기</Button>
          <Button kind="primary" size="sm" full onPress={onComplete} style={{ flex: 1 }}>발주 완료</Button>
        </View>
      </View>
    </Card>
  );
}

// ── 입고 예정 카드 ─────────────────────────────────────────────
function WaitingCard({ w, onReceive, onEdit }: { w: Waiting; onReceive: () => void; onEdit: () => void }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone={w.late ? 'red' : 'blue'} solid sm>{w.late ? '입고지연' : '입고예정'}</Badge>
          <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{w.name}</Text>
        </View>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: w.late ? T.red : T.ink2, marginTop: 9 }}>{w.due}</Text>
        <Text style={[{ fontSize: 13.5, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>{w.buy}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button kind="gray" size="sm" full onPress={onEdit} style={{ flex: 1 }}>발주 수정</Button>
          <Button kind="primary" size="sm" full icon="check" onPress={onReceive} style={{ flex: 1 }}>입고 완료</Button>
        </View>
      </View>
    </Card>
  );
}

// ── 입고 완료 카드 ─────────────────────────────────────────────
function DoneCard({ d, onCancel }: { d: Done; onCancel: () => void }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone="green" solid sm>입고 완료</Badge>
          <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{d.name}</Text>
        </View>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.ink2, marginTop: 9 }}>{d.due}</Text>
        <Text style={[{ fontSize: 13.5, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>{d.buy}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.line2 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: T.sub2 }}>입고 단가</Text>
          <Text style={[{ fontSize: 13.5, fontWeight: '800', color: T.ink }, NUM]}>{d.per}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.red }}>입고 취소</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

// ── 옵션 행 (시트 공용) ────────────────────────────────────────
function OptionRow({ o, leading, trailing, line }: { o: OrderOption; leading?: React.ReactNode; trailing?: React.ReactNode; line?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: line ? T.surface : T.surface2, borderWidth: line ? 1 : 0, borderColor: T.line, borderRadius: 12 }}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: T.ink }}>{o.name}, {won(o.amt)}원</Text>
        <Text numberOfLines={1} style={[{ fontSize: 12.5, color: T.sub2, marginTop: 3 }, NUM]}>{o.vendor} · {o.per}원/g</Text>
      </View>
      {trailing}
    </View>
  );
}

const TABS = ['발주 대기', '입고 예정', '입고 완료'];

export default function OrdersHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [sheet, setSheet] = useState<null | 'links' | 'confirm' | 'receive'>(null);
  const [receiveMode, setReceiveMode] = useState<'full' | 'partial'>('full');
  const [receiveQty, setReceiveQty] = useState(1);
  const [done, setDone] = useState<Done[]>(DONE);
  const [cancelIdx, setCancelIdx] = useState<number | null>(null); // 입고 취소 확인 대상

  const applies = ['재고 상태 갱신', '구매 이력 추가 · 평균단가 재계산', '가격 추이 · 메뉴 손익 갱신'];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>발주 현황</Text>
          {tab === 0 ? (
            <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="search" size={23} color={T.ink2} />
            </Pressable>
          ) : null}
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={24} color={T.ink2} />
            {tab === 0 ? <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: T.red, borderWidth: 1.5, borderColor: '#fff' }} /> : null}
          </Pressable>
        </View>
      </View>

      {/* 탭 — 밑줄형 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#D1D6DB', marginBottom: 8 }}>
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

      {/* 콘텐츠 */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 104, gap: 11, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {tab === 0 ? (
          CANDIDATES.map((c, i) => (
            <CandidateCard key={i} c={c} onOrder={() => setSheet('links')} onComplete={() => setSheet('confirm')} />
          ))
        ) : tab === 1 ? (
          <>
            {WAITING.map((w, i) => (
              <WaitingCard key={i} w={w} onReceive={() => { setReceiveMode('full'); setReceiveQty(1); setSheet('receive'); }} onEdit={() => router.push('/orders/complete?mode=edit' as Href)} />
            ))}
            <Text style={{ textAlign: 'center', fontSize: 12.5, color: T.ter, marginTop: 4 }}>
              입고 완료 시, <Text style={{ fontWeight: '700', color: T.sub }}>식재료 페이지</Text>의 재고가 업데이트됩니다.
            </Text>
          </>
        ) : (
          done.length > 0 ? (
            <>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: T.sub2, paddingHorizontal: 2 }}>오늘 입고된 내역은 내일까지 노출되며, 이후 자동으로 사라집니다.</Text>
              {done.map((d, i) => <DoneCard key={i} d={d} onCancel={() => setCancelIdx(i)} />)}
            </>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
              <Text style={{ fontSize: 15, color: T.ter }}>입고 완료 내역이 없어요</Text>
            </View>
          )
        )}
      </ScrollView>

      {/* 주문하기 — 구매 링크·옵션 시트 (ORD-05) */}
      <Sheet visible={sheet === 'links'} onClose={() => setSheet(null)} title="구매 링크 · 옵션" height={460}>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((o, i) => (
            <OptionRow key={i} o={o} trailing={<Button kind="primary" size="sm" onPress={() => { setSheet(null); router.push('/orders/complete' as Href); }}>주문하기</Button>} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 2 }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ fontSize: 12, color: T.blue }}>링크는 식재료 상세에서 추가·관리할 수 있어요</Text>
        </View>
      </Sheet>

      {/* 발주 완료 — 옵션 선택 시트 (ORD-06) */}
      <Sheet visible={sheet === 'confirm'} onClose={() => setSheet(null)} title="발주 완료" height={520}>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((o, i) => (
            <Pressable key={i} onPress={() => { setSheet(null); router.push('/orders/complete' as Href); }}>
              <OptionRow o={o} line leading={<Icon name="check" size={18} color="#DDE2E7" sw={2.4} />} />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 2 }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ fontSize: 12, color: T.ter }}>어디서 샀는지 선택하면 발주 완료 등록으로 이어집니다</Text>
        </View>
      </Sheet>

      {/* 입고 완료 — 확인 시트 (ORD-03) */}
      <Sheet visible={sheet === 'receive'} onClose={() => setSheet(null)} title="입고 완료" sub="실제 도착 수량을 확인하세요" height={560}>
        <Card onLine pad={15} style={{ marginBottom: 14 }}>
          <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: T.ink }}>식용유 18L, 1개 45,000원</Text>
          <Text style={[{ fontSize: 12.5, color: T.ink, marginTop: 3 }, NUM]}>대림유통 · 2.5원/ml</Text>
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.ink }}>잔량 처리</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {([['full', '전량 도착'], ['partial', '부분입고']] as const).map(([k, label]) => {
              const on = receiveMode === k;
              return (
                <Pressable key={k} onPress={() => setReceiveMode(k)} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: on ? T.blue : T.surface, borderWidth: on ? 0 : 1, borderColor: T.line }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#fff' : T.sub }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {receiveMode === 'partial' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: T.line2 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: T.ink }}>실제 도착 수량</Text>
            <Stepper value={receiveQty} onChange={(v) => setReceiveQty(Math.max(0, v))} />
          </View>
        ) : null}

        <View style={{ backgroundColor: T.surface2, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, marginTop: 12 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: T.sub, marginBottom: 9 }}>입고완료 처리 후 일괄 적용됩니다.</Text>
          {applies.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 }}>
              <Icon name="check" size={15} color={T.green} sw={2.4} />
              <Text style={{ fontSize: 12.5, color: T.sub2 }}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 18 }}>
          <Button kind="primary" size="lg" full icon="check" onPress={() => setSheet(null)}>입고 완료</Button>
        </View>
      </Sheet>

      {/* 입고 취소 확인 다이얼로그 */}
      <Modal visible={cancelIdx != null} transparent animationType="fade" onRequestClose={() => setCancelIdx(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 17.5, fontWeight: '800', color: T.ink, textAlign: 'center' }}>입고를 취소하시겠습니까?</Text>
              <Text style={{ fontSize: 14, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                재고·구매 이력 반영도 함께 되돌아갑니다.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable onPress={() => setCancelIdx(null)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: T.ink2 }}>아니오</Text>
              </Pressable>
              <Pressable onPress={() => { setDone((prev) => prev.filter((_, j) => j !== cancelIdx)); setCancelIdx(null); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.red }}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: '#fff' }}>입고 취소</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
