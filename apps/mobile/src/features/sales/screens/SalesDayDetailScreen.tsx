/**
 * SALES-03 일 손익 상세 — 채널 구성 도넛 + 일 손익 계산(브레이크다운) + 메뉴별 판매량.
 * 손익 = 매출 − (세금+재료원가+부자재+고정지출+추가지출+폐기손실). ⚠ 디자인 프로토타입(정적·데모).
 *
 * 구성 블록은 매출 분석(SALES-02)과 공유한다(components/ProfitBlocks) — 이쪽은 하루치 수치를 넣는다.
 */
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { AppHeader } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { SALES, type SaleMenu } from '../demoData';
import { ChannelMixCard, MenuSalesList, ProfitBreakdownCard, SecLabel } from '../components/ProfitBlocks';
import { MenuProfitSheet } from '../components/MenuProfitSheet';

export default function SalesDayDetailScreen() {
  const router = useRouter();
  const s = SALES;
  const [showAll, setShowAll] = useState(false);
  const [sel, setSel] = useState<SaleMenu | null>(null); // 메뉴별 손익 팝업
  const qty = s.menu.reduce((a, m) => a + m.qty, 0);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="6월 18일 손익" onBack={() => safeBack('/sales' as Href)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 24, gap: 11 }}>
        <SecLabel title="채널 구성" onPress={() => router.push('/sales/channel' as Href)} />
        <ChannelMixCard revenue={s.revenue} profit={s.profit} mix={s.channelMix} />

        <SecLabel title="일 손익 계산" onPress={() => router.push('/sales/day-detail' as Href)} />
        <ProfitBreakdownCard b={{ ...s, qty }} qtyLabel={`오늘 ${qty}개`} />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 4 }}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: T.sub }}>메뉴별 판매량</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.ter }}>총 {s.menu.length}개 · 판매량순</Text>
        </View>
        <MenuSalesList menu={s.menu} showAll={showAll} onShowAll={() => setShowAll(true)} onSelect={setSel} />
      </ScrollView>

      <MenuProfitSheet sel={sel} totals={s} periodLabel="오늘" onClose={() => setSel(null)} />
    </View>
  );
}
