// LedgerRow.tsx — 재고 변동 내역 한 줄 (상세 ING-03 · 재고내역 ING-07 공용).
// 폰트/색/라인 단일 출처: 일시14 · 항목16 · 설명14 · 증감16(양수 파랑/음수 빨강) · 잔량14.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Icon } from '../../../components/kit';
import { T, tnum } from '../../../theme/tokens';

export function LedgerRow({
  date,
  act,
  memo,
  delta,
  bal,
  up,
  px = 15,
  last = false,
  onPress,
}: {
  date: string;
  act: string;
  memo: string;
  delta: string;
  bal: string; // 표시 그대로 (예: '잔량 3.9kg')
  up: boolean; // true=입고(양수, 파랑) / false=소진·폐기(음수, 빨강)
  px?: number; // 좌우 패딩 (카드 15 · 전체폭 22)
  last?: boolean; // 그룹의 마지막 행이면 하단 구분선 제거
  onPress?: () => void;
}) {
  // 증감값: 숫자만 굵게, 단위(kg·g·ml·개)는 일반 굵기.
  const dm = delta.match(/^([+\-−]?\s?[\d.,]+)(.*)$/);
  const dNum = dm?.[1] ?? delta;
  const dUnit = dm?.[2] ?? '';
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 14,
        paddingHorizontal: px,
        backgroundColor: T.surface,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: T.line2,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 14, color: T.ter, fontWeight: '600', marginBottom: 4 }, tnum]}>{date}</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: T.ink }}>{act}</Text>
        <Text style={{ fontSize: 14, color: T.ink, marginTop: 3 }}>{memo}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[{ fontSize: 16, fontWeight: '800', color: up ? T.blue : T.red }, tnum]}>{dNum}<Text style={{ fontWeight: '600' }}>{dUnit}</Text></Text>
        <Text style={[{ fontSize: 14, color: T.ter, marginTop: 3 }, tnum]}>{bal}</Text>
      </View>
      <Icon name="chevron" size={16} color={T.line3} />
    </Pressable>
  );
}
