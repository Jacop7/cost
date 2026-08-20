// LedgerRow.tsx — 재고 변동 내역 한 줄 (상세 ING-03 · 재고내역 ING-07 공용).
//
// ⚠ 오른쪽 화살표는 없다. 줄마다 열리는 화면도 팝업도 없기 때문이다 —
//   상세는 카드 아래 '자세히 보기' 가 전부고, 재고 내역은 읽기만 한다.
//   화살표를 달아 두면 눌러 보고 아무 일이 없다.
// 폰트/색/라인 단일 출처: 일시14 · 항목16 · 설명14 · 증감16(양수 파랑/음수 빨강) · 잔량14.
import React from 'react';
import { View, Text, Pressable } from 'react-native';
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
      accessibilityRole={onPress ? 'button' : undefined}
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
        {/*
          메모가 없으면 줄 자체를 그리지 않는다. 빈 Text 는 빈 줄만큼 자리를 먹는다.
          색은 구매 요약(`총 3.5kg (500g × 7개) · 68,600원`)과 **같은 톤**이다 —
          둘 다 "그래서 무엇이 얼마나"를 받쳐 주는 줄이라 같은 무게로 읽혀야 한다.
        */}
        {memo ? <Text style={{ fontSize: 14, color: T.sub2, marginTop: 3 }}>{memo}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[{ fontSize: 16, fontWeight: '800', color: up ? T.blue : T.red }, tnum]}>{dNum}<Text style={{ fontWeight: '600' }}>{dUnit}</Text></Text>
        <Text style={[{ fontSize: 14, color: T.ter, marginTop: 3 }, tnum]}>{bal}</Text>
      </View>
    </Pressable>
  );
}
