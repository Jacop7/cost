/**
 * 차트 — kit.jsx 의 Donut·TrendChart 를 react-native-svg 로 이식.
 * 추이 그래프는 2차 기능이나, 컴포넌트는 1차에 준비(데이터는 1차부터 적재).
 */
import { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Txt } from './index';
import { T } from '@/theme/tokens';

export interface DonutSeg {
  label: string;
  value: number; // %
  color: string;
}

/** 도넛 차트 (② 손익 구성). */
export function Donut({ segments, size = 150, thick = 22, centerTop, centerMain, centerSub, mainSize = 26, mainColor }: {
  segments: DonutSeg[];
  size?: number;
  thick?: number;
  centerTop?: string;
  centerMain?: ReactNode;
  centerSub?: string;
  mainSize?: number;
  mainColor?: string;
}) {
  const r = (size - thick) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let acc = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={T.line2} strokeWidth={thick} />
        {segments.map((s, i) => {
          const len = (s.value / 100) * c;
          const el = (
            <Circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={s.color} strokeWidth={thick} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} strokeLinecap="butt" />
          );
          acc += len;
          return el;
        })}
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {centerTop ? <Txt style={{ fontSize: 12.5, fontWeight: '700', color: T.ter }}>{centerTop}</Txt> : null}
        <Txt num style={{ fontSize: mainSize, fontWeight: '800', color: mainColor || T.green, letterSpacing: -0.5 }}>{centerMain}</Txt>
        {centerSub ? <Txt style={{ fontSize: 13, fontWeight: '600', color: T.sub2 }}>{centerSub}</Txt> : null}
      </View>
    </View>
  );
}

export interface TrendPoint {
  v: number;
  big?: boolean;
  c?: string; // 점 색(추이 원인색)
}

/** 추이 라인 차트 (① 가격 추이 · ② 순이익률 추이). */
export function TrendChart({ points, w = 320, h = 110, color = T.blue, target, fmt = (v) => `${v}`, pad = 8, markMinMax, solidDots }: {
  points: TrendPoint[];
  w?: number;
  h?: number;
  color?: string;
  target?: number;
  fmt?: (v: number) => string;
  pad?: number;
  markMinMax?: boolean;
  solidDots?: boolean;
}) {
  const xs = points.map((p) => p.v);
  const min = Math.min(...xs, target ?? Infinity) * 0.96;
  const max = Math.max(...xs, target ?? -Infinity) * 1.04;
  const X = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const Y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.v)}`).join(' ');
  const area = `${line} L${X(points.length - 1)},${h - pad} L${X(0)},${h - pad} Z`;
  const lo = xs.indexOf(Math.min(...xs));
  const hi = xs.indexOf(Math.max(...xs));
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.18" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {target != null ? <Line x1={pad} x2={w - pad} y1={Y(target)} y2={Y(target)} stroke={T.ter} strokeWidth={1.3} strokeDasharray="4 4" /> : null}
      <Path d={area} fill="url(#tg)" />
      <Path d={line} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={X(i)}
          cy={Y(p.v)}
          r={solidDots ? 3.6 : p.big ? 5 : 3.2}
          fill={solidDots ? color : '#fff'}
          stroke={solidDots ? 'none' : p.c || color}
          strokeWidth={2.3}
        />
      ))}
      {markMinMax
        ? [lo, hi].map((idx, k) => (
            <SvgText key={k} x={X(idx)} y={Y(xs[idx]!) - 10} textAnchor="middle" fontSize={11} fontWeight="700" fill={color}>
              {fmt(xs[idx]!)}
            </SvgText>
          ))
        : null}
    </Svg>
  );
}
