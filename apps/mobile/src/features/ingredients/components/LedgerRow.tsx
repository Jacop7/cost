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
  px = 15,
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
  px?: number; // 좌우 패딩 (카드 15 · 전체폭 22)
  last?: boolean; // 그룹의 마지막 행이면 하단 구분선 제거
}) {
  // 증감값: 숫자만 굵게, 단위(kg·g·ml·개)는 일반 굵기.
  const dm = delta.match(/^([+\-−]?\s?[\d.,]+)(.*)$/);
  const dNum = dm?.[1] ?? delta;
  const dUnit = dm?.[2] ?? '';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: historyRowStyles.spacing.paddingVertical,
        paddingHorizontal: px,
        backgroundColor: T.surface,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[historyRowStyles.date, { marginBottom: space.xs }, tnum]}>{date}</Text>
        <Text style={historyRowStyles.title}>{act}</Text>
        {/*
          메모가 없으면 줄 자체를 그리지 않는다. 빈 Text 는 빈 줄만큼 자리를 먹는다.
          색은 구매 요약(`총 3.5kg (500g × 7개) · 68,600원`)과 **같은 톤**이다 —
          둘 다 "그래서 무엇이 얼마나"를 받쳐 주는 줄이라 같은 무게로 읽혀야 한다.
        */}
        {memo ? (
          <Text style={[historyRowStyles.description, { marginTop: space.xs }]} numberOfLines={2}>{memo}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', maxWidth: '44%', marginLeft: 'auto', flexShrink: 1 }}>
        <Text style={[{ fontSize: 16, fontWeight: '800', color: up ? COLOR.text.accent : COLOR.status.negative }, tnum]}>{dNum}<Text style={{ fontWeight: '600' }}>{dUnit}</Text></Text>
        <Text style={[{ fontSize: 14, color: balNeg ? COLOR.status.negative : COLOR.text.tertiary, fontWeight: balNeg ? '800' : '400', marginTop: space.xs }, tnum]}>{bal}</Text>
      </View>
    </View>
  );
}
