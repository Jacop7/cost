/**
 * ORD-01 발주 현황 홈 — 프로토타입(발주 현황 페이지 정리본) 이식.
 * 3탭: 발주 후보(안전재고·소진 분류) / 입고 예정 / 입고 완료.
 * 후보 → 주문하기(구매 링크 시트 → ORD-02 발주 완료) / 발주 완료(옵션 선택 시트). 예정 → 입고 완료(확인 시트).
 * ⚠ 디자인 프로토타입(정적 데모). 발주 등록(E7)·입고 확정(E1)은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Icon, SearchBar, Sheet } from '@/components/kit';
import { T, won } from '@/theme/tokens';
import { Candidate, CANDIDATES, Done, DONE, optionsFor, OrderOption, Waiting, WAITING } from '../demoData';

const NUM = { fontVariant: ['tabular-nums' as const] };

// 실제(글로벌) 날짜 기준 유틸
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtMD = (d: Date) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
const waitingDue = (offset: number, today: Date) => {
  const md = fmtMD(addDays(today, offset));
  if (offset < 0) return `${-offset}일 지연 (${md})`;
  if (offset === 0) return `오늘 도착 (${md})`;
  if (offset === 1) return `내일 도착 (${md})`;
  return `${offset}일 후 도착 (${md})`;
};
const doneDue = (agoOffset: number, today: Date) => `입고 완료 (${fmtMD(addDays(today, -agoOffset))})`;

function reasonTone(reason: Candidate['reason']): 'red' | 'amber' | 'blue' {
  return reason === 'out' ? 'red' : reason === 'low' ? 'amber' : 'blue';
}

// ── 발주 후보 카드 ─────────────────────────────────────────────
function CandidateCard({ c, onOrder, onComplete }: { c: Candidate; onOrder: () => void; onComplete: () => void }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Badge tone={reasonTone(c.reason)} solid sm>{c.reasonLabel}</Badge>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{c.name}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 11, marginBottom: 10 }}>
          <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>권장 발주</Text>
            <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink, marginTop: 3 }, NUM]}>{c.rec}{c.recUnit}</Text>
          </View>
          <View style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: T.surface2, borderRadius: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>현재 재고</Text>
            <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: 3 }, NUM]}>{c.remain}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone="neutral" sm>최근 주문</Badge>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.sub2 }}>{c.recent}</Text>
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
function WaitingCard({ w, today, onReceive, onEdit }: { w: Waiting; today: Date; onReceive: () => void; onEdit: () => void }) {
  const late = w.dueOffset < 0;
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone={late ? 'red' : 'blue'} solid sm>{late ? '입고지연' : '입고예정'}</Badge>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{w.name}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: late ? T.red : T.ink2, marginTop: 9 }}>{waitingDue(w.dueOffset, today)}</Text>
        <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>{w.buy}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button kind="gray" size="sm" full onPress={onEdit} style={{ flex: 1 }}>발주 수정</Button>
          <Button kind="primary" size="sm" full icon="check" onPress={onReceive} style={{ flex: 1 }}>입고 완료</Button>
        </View>
      </View>
    </Card>
  );
}

// ── 입고 완료 카드 ─────────────────────────────────────────────
function DoneCard({ d, today, onCancel, onEdit }: { d: Done; today: Date; onCancel: () => void; onEdit: () => void }) {
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge tone="green" solid sm>입고 완료</Badge>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: T.ink }}>{d.name}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2, marginTop: 9 }}>{doneDue(d.agoOffset, today)}</Text>
        <Text style={[{ fontSize: 16, fontWeight: '600', color: T.sub, marginTop: 7 }, NUM]}>{d.buy}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.line2 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: T.sub2 }}>입고 단가</Text>
          <Text style={[{ fontSize: 16, fontWeight: '800', color: T.ink }, NUM]}>{d.per}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button kind="danger" size="sm" full onPress={onCancel} style={{ flex: 1 }}>입고 취소</Button>
          <Button kind="gray" size="sm" full onPress={onEdit} style={{ flex: 1 }}>입고 수정</Button>
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
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{o.name}, {won(o.amt)}원</Text>
        <Text numberOfLines={1} style={[{ fontSize: 14, color: T.sub2, marginTop: 3 }, NUM]}>{o.vendor} · {o.per}원/{o.unit}</Text>
      </View>
      {trailing}
    </View>
  );
}

// ── 안내 배너 (연파랑) ─────────────────────────────────────────
function NoticeBanner({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.blueTint, borderWidth: 1, borderColor: T.blue, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
      <Icon name="info" size={16} color={T.blue} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: T.blue, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

// 표준 용어: '발주 후보'. `docs/구현-변경점.md` §4 의 사용자 결정(후보 → **발주 후보**)이자
// 가이드 §9.2 용어 사전의 표준 표현이다. '발주 대기'와 혼용하지 않는다.
const TABS = ['발주 후보', '입고 예정', '입고 완료'];

/** 목록 비어 있음 — 검색 결과 0건과 원래 데이터 0건을 구분해서 보여준다(가이드 §9.8). */
function EmptyBox({ query, empty }: { query: string; empty: string }) {
  const searching = query.trim() !== '';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 6 }}>
      <Text style={{ fontSize: 16, color: T.ter }}>{searching ? `'${query.trim()}' 검색 결과가 없어요` : empty}</Text>
      {searching ? <Text style={{ fontSize: 14, color: T.ter }}>다른 식재료명이나 구매처로 찾아보세요</Text> : null}
    </View>
  );
}

/** 검색어 매칭 — 식재료명과 구매 내역 한 줄을 함께 본다. 공백은 무시한다. */
const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const hit = (q: string, ...fields: (string | undefined)[]) => {
  const n = squash(q);
  return n === '' || fields.some((f) => squash(f ?? '').includes(n));
};

export default function OrdersHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<null | 'links' | 'confirm' | 'receive'>(null);
  const [selCand, setSelCand] = useState<Candidate | null>(null); // 주문하기/발주 완료 시트 대상
  const [waiting, setWaiting] = useState<Waiting[]>(WAITING);
  const [done, setDone] = useState<Done[]>(DONE);
  const [receiveIdx, setReceiveIdx] = useState<number | null>(null); // 입고 완료 처리 대상(입고 예정 인덱스)
  const [cancelIdx, setCancelIdx] = useState<number | null>(null); // 입고 취소 확인 대상

  const today = new Date(); // 실제 오늘(글로벌 기준)

  // 검색 결과는 **원본 인덱스를 함께** 들고 다닌다. 필터된 순번으로 상태를 바꾸면 검색 중에
  // 다른 항목이 입고·취소 처리된다.
  const candView = CANDIDATES.map((item, idx) => ({ item, idx })).filter(({ item }) => hit(query, item.name, item.recent));
  const waitView = waiting.map((item, idx) => ({ item, idx })).filter(({ item }) => hit(query, item.name, item.buy));
  const doneView = done.map((item, idx) => ({ item, idx })).filter(({ item }) => hit(query, item.name, item.buy));
  const applies = ['재고 상태 갱신', '구매 이력 추가 · 평균단가 재계산', '가격 추이 · 메뉴 손익 갱신'];

  // 입고 완료 — 입고 예정 항목을 입고 완료로 이동(오늘 입고).
  const confirmReceive = () => {
    if (receiveIdx != null) {
      const w = waiting[receiveIdx]!;
      setDone((prev) => [{ name: w.name, buy: w.buy, per: w.per, agoOffset: 0 }, ...prev]);
      setWaiting((prev) => prev.filter((_, j) => j !== receiveIdx));
    }
    setReceiveIdx(null);
    setSheet(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* 헤더 */}
      <View style={{ paddingTop: insets.top, backgroundColor: T.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 6, paddingBottom: 12 }}>
          <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.6 }}>발주 현황</Text>
          {/* 검색은 세 탭 모두에서 필요하다 — 후보에서만 쓸 이유가 없다. */}
          <Pressable
            onPress={() => setSearching((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="검색"
            accessibilityState={{ selected: searching }}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="search" size={23} color={searching ? T.blue : T.ink2} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/my/notifications' as Href)}
            accessibilityRole="button"
            accessibilityLabel="알림"
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="bell" size={24} color={T.ink2} />
            {tab === 0 ? <View style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: T.red, borderWidth: 1.5, borderColor: T.surface }} /> : null}
          </Pressable>
        </View>
        {searching ? (
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="식재료·구매처 검색"
            onClose={() => { setSearching(false); setQuery(''); }}
          />
        ) : null}
      </View>

      {/* 탭 — 밑줄형 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: T.line3, marginBottom: 8 }}>
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
          candView.length > 0 ? (
            candView.map(({ item: c, idx }) => (
              <CandidateCard key={idx} c={c} onOrder={() => { setSelCand(c); setSheet('links'); }} onComplete={() => { setSelCand(c); setSheet('confirm'); }} />
            ))
          ) : (
            <EmptyBox query={query} empty="발주 후보가 없어요" />
          )
        ) : tab === 1 ? (
          <>
            <NoticeBanner>입고 완료 시, 식재료 페이지의 재고가 업데이트됩니다.</NoticeBanner>
            {waitView.length > 0 ? (
              waitView.map(({ item: w, idx }) => (
                // idx 는 **원본 배열 기준**이어야 한다. 필터된 목록의 순번을 넘기면 검색 중에
                // 엉뚱한 항목이 입고 처리된다.
                <WaitingCard key={idx} w={w} today={today} onReceive={() => { setReceiveIdx(idx); setSheet('receive'); }} onEdit={() => router.push(`/orders/complete?mode=edit&ingredient=${encodeURIComponent(w.name)}` as Href)} />
              ))
            ) : (
              <EmptyBox query={query} empty="입고 예정 내역이 없어요" />
            )}
          </>
        ) : (
          doneView.length > 0 ? (
            <>
              <NoticeBanner>오늘 입고된 내역은 내일까지 노출되며, 이후 자동으로 사라집니다.</NoticeBanner>
              {doneView.map(({ item: d, idx }) => <DoneCard key={idx} d={d} today={today} onCancel={() => setCancelIdx(idx)} onEdit={() => router.push(`/orders/complete?mode=receive&ingredient=${encodeURIComponent(d.name)}` as Href)} />)}
            </>
          ) : (
            <EmptyBox query={query} empty="입고 완료 내역이 없어요" />
          )
        )}
      </ScrollView>

      {/* 주문하기 — 구매 링크·옵션 시트 (ORD-05) */}
      <Sheet visible={sheet === 'links'} onClose={() => setSheet(null)} title="구매 링크 · 옵션" sub={selCand ? selCand.name : undefined} height={460}>
        <View style={{ gap: 10 }}>
          {(selCand ? optionsFor(selCand.name) : []).map((o, i) => (
            <OptionRow key={i} o={o} trailing={<Button kind="primary" size="sm" onPress={() => { const n = selCand!.name; setSheet(null); router.push(`/orders/complete?ingredient=${encodeURIComponent(n)}&opt=${i}` as Href); }}>주문하기</Button>} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 2 }}>
          <Icon name="info" size={15} color={T.blue} />
          <Text style={{ fontSize: 14, color: T.blue }}>링크는 식재료 상세에서 추가·관리할 수 있어요</Text>
        </View>
      </Sheet>

      {/* 발주 완료 — 옵션 선택 시트 (ORD-06) */}
      <Sheet visible={sheet === 'confirm'} onClose={() => setSheet(null)} title="발주 완료" sub={selCand ? `${selCand.name} · 어디서 샀는지 선택하세요` : undefined} height={520}>
        <View style={{ gap: 10 }}>
          {(selCand ? optionsFor(selCand.name) : []).map((o, i) => (
            <Pressable key={i} onPress={() => { const n = selCand!.name; setSheet(null); router.push(`/orders/complete?ingredient=${encodeURIComponent(n)}&opt=${i}` as Href); }} accessibilityRole="button" accessibilityLabel="구매처 선택">
              <OptionRow o={o} line leading={<Icon name="check" size={18} color={T.line} sw={2.4} />} />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 2 }}>
          <Icon name="info" size={15} color={T.ter} />
          <Text style={{ fontSize: 14, color: T.ter }}>어디서 샀는지 선택하면 발주 완료 등록으로 이어집니다</Text>
        </View>
      </Sheet>

      {/* 입고 완료 — 확인 시트 (ORD-03) */}
      <Sheet visible={sheet === 'receive'} onClose={() => { setSheet(null); setReceiveIdx(null); }} title="입고 완료">
        <View style={{ backgroundColor: T.surface2, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: T.ink, marginBottom: 11 }}>입고 완료 처리 후 일괄 적용됩니다.</Text>
          {applies.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
              <Icon name="check" size={16} color={T.green} sw={2.4} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink }}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 18 }}>
          <Button kind="primary" size="lg" full icon="check" onPress={confirmReceive}>입고 완료</Button>
        </View>
      </Sheet>

      {/* 입고 취소 확인 다이얼로그 */}
      <Modal visible={cancelIdx != null} transparent animationType="fade" onRequestClose={() => setCancelIdx(null)}>
        <View style={{ flex: 1, backgroundColor: T.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: 18, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 14 }}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: T.ink, textAlign: 'center' }}>입고를 취소하시겠습니까?</Text>
              {/* 파괴적 작업이라 되돌아가는 범위를 구체적으로 밝힌다(가이드 §9.9). */}
              <Text style={{ fontSize: 16, color: T.sub, textAlign: 'center', lineHeight: 20 }}>
                늘어난 재고와 구매 이력, 기준단가 반영이 함께 되돌아가요.
              </Text>
            </View>
            {/* 버튼은 행동형으로(§9.2). 파괴적 행동은 대상과 결과를 드러낸다. */}
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 18 }}>
              <Pressable
                onPress={() => setCancelIdx(null)}
                accessibilityRole="button"
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.line2 }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink2 }}>닫기</Text>
              </Pressable>
              <Pressable
                onPress={() => { setDone((prev) => prev.filter((_, j) => j !== cancelIdx)); setCancelIdx(null); }}
                accessibilityRole="button"
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: T.red }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: T.onColor }}>입고 취소</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
