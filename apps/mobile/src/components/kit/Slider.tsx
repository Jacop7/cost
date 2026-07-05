/**
 * Slider — 드래그 가능한 값 슬라이더(판매가 시뮬레이션·채널 비중 등).
 * PanResponder 로 트랙 위 터치/드래그 → 값. 트랙·손잡이는 pointerEvents=none 으로
 * 부모(응답자) 기준 locationX 가 일관되게 잡히도록 한다.
 */
import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { T } from '@/theme/tokens';

export function Slider({ value, min, max, step = 1, onChange, color = T.blue }: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);

  const toValue = (x: number): number => {
    const width = wRef.current || 1;
    const ratio = Math.max(0, Math.min(1, x / width));
    const raw = min + ratio * (max - min);
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(toValue(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onChange(toValue(e.nativeEvent.locationX)),
    }),
  ).current;

  const pct = max > min ? (value - min) / (max - min) : 0;

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => { wRef.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); }}
      style={{ height: 28, justifyContent: 'center' }}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: T.line2 }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, borderRadius: 3, backgroundColor: color }} />
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: Math.max(0, pct * w - 13), width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', borderWidth: 2, borderColor: color, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }}
      />
    </View>
  );
}
