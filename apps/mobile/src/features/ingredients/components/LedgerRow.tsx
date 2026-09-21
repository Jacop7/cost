// LedgerRow.tsx — 재고 변동 내역 한 줄 (상세 ING-03 · 재고내역 ING-07 공용).
//
// 원장 행에는 더보기 아이콘이나 기록 상세 팝업을 노출하지 않는다.
// 폰트/색/라인 단일 출처: 일시14 · 항목16 · 설명14 · 증감16(양수 파랑/음수 빨강) · 잔량14.
import React from 'react';
import { View, Text } from 'react-native';
import { COLOR, T, tnum, space, TYPE } from '../../../theme/tokens';
import { historyRowStyles } from '@/components/history/historyRowStyles';

export function LedgerRow({
  date,
  act,
  memo,
  delta,
  bal,
  balNeg,
  up,
  px = space.lg,
  last = false,
}: {
  date: string;
  act: string;
  memo: string;
  delta: string;
  bal: string; // 표시 그대로 (예: '잔량 3.9kg')
  /** 그 잔량이 음수인가. 참이면 빨강 — `−750g` 을 회색으로 쓰면 그냥 지나친다(0102). */
  balNeg?: boolean;
  up: boolean; // true=입고(양수, 파랑) / false=소진·폐기(음수, 빨강)
  px?: number; // 좌우 패딩 (카드 기본 16 · 전체폭 화면은 호출부에서 지정)
  last?: boolean; // 그룹의 마지막 행이면 하단 구분선 제거
}) {
  // 증감값: 숫자만 굵게, 단위(kg·g·ml·개)는 일반 굵기.
  const dm = delta.match(/^([+\-−]?\s?[\d.,]+)(.*)$/);
  const dNum = dm?.[1] ?? delta;
  const dUnit = dm?.[2] ?? '';
  return (
    <View
      style={{
        paddingVertical: historyRowStyles.spacing.paddingVertical,
        paddingHorizontal: px,
        backgroundColor: T.surface,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: T.line2,
      }}
    >
      <Text style={[historyRowStyles.date, { marginBottom: space.xs }, tnum]}>{date}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={[historyRowStyles.title, { flex: 1, minWidth: 0 }]}>{act}</Text>
        <Text style={[{ maxWidth: '44%', marginLeft: 'auto', flexShrink: 1, fontSize: 16, fontWeight: '800', textAlign: 'right', color: up ? COLOR.text.accent : COLOR.status.negative }, tnum]}>{dNum}<Text style={{ fontWeight: '600' }}>{dUnit}</Text></Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs }}>
        {/*
          메모가 없어도 오른쪽 잔량은 3번째 줄에 고정한다. 왼쪽에는 빈 View만 둔다.
          색은 구매 요약(`총 3.5kg (500g × 7개) · 68,600원`)과 **같은 톤**이다 —
          둘 다 "그래서 무엇이 얼마나"를 받쳐 주는 줄이라 같은 무게로 읽혀야 한다.
        */}
        {memo ? (
          <Text style={[historyRowStyles.description, { flex: 1, minWidth: 0 }]} numberOfLines={2}>{memo}</Text>
        ) : <View style={{ flex: 1 }} />}
        <Text style={[{ maxWidth: '44%', marginLeft: 'auto', flexShrink: 1, fontSize: 14, textAlign: 'right', color: balNeg ? COLOR.status.negative : COLOR.text.tertiary, fontWeight: balNeg ? '800' : '400' }, tnum]}>{bal}</Text>
      </View>
    </View>
  );
}
