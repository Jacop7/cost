import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { COLOR, T, radius, space } from '@/theme/tokens';
import { ActionSheet } from './ActionSheet';
import { Icon } from './Icon';

export interface DragOrderItem { id: string; name: string; detail?: string; deleteBlocked?: string }
export function moveOrderItem<T>(rows: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length) return [...rows];
  const next = [...rows]; const [row] = next.splice(from, 1); next.splice(to, 0, row!); return next;
}

/** 손잡이 드래그와 경계 자동 스크롤. 접근성·키보드도 같은 순서 변경을 제공한다. */
export function DragOrderList({ rows, onChange, onDelete, onBlockedDelete, disabled = false }: {
  rows: DragOrderItem[]; onChange: (rows: DragOrderItem[]) => void; onDelete?: (id: string) => void;
  onBlockedDelete?: (id: string) => void; disabled?: boolean;
}) {
  const scroll = useRef<ScrollView>(null);
  const frame = useRef<View>(null);
  const offset = useRef(0);
  const viewport = useRef({ y: 0, height: 0 });
  const current = useRef({ rows, onChange, disabled }); current.current = { rows, onChange, disabled };
  const drag = useRef<{ id: string; index: number; startOffset: number; dy: number; y: number; moved: boolean } | null>(null);
  const [visual, setVisual] = useState<{ id: string; dy: number; target: number } | null>(null);
  const [actions, setActions] = useState<string | null>(null);
  const rowHeight = 72;
  const update = () => {
    const d = drag.current; if (!d) return;
    const delta = d.dy + offset.current - d.startOffset;
    const target = Math.max(0, Math.min(current.current.rows.length - 1, d.index + Math.round(delta / rowHeight)));
    setVisual({ id: d.id, dy: delta, target });
  };
  useEffect(() => {
    if (!visual) return;
    const timer = setInterval(() => {
      const d = drag.current; const box = viewport.current;
      if (!d?.moved || !box.height) return;
      const step = d.y < box.y + 48 ? -12 : d.y > box.y + box.height - 48 ? 12 : 0;
      const next = Math.max(0, Math.min(Math.max(0, current.current.rows.length * rowHeight - box.height), offset.current + step));
      if (next !== offset.current) { offset.current = next; scroll.current?.scrollTo({ y: next, animated: false }); update(); }
    }, 32);
    return () => clearInterval(timer);
  }, [visual !== null]);
  const release = (cancelled: boolean) => {
    const d = drag.current;
    if (d && !cancelled && !current.current.disabled) {
      if (d.moved) {
        const from = current.current.rows.findIndex(row => row.id === d.id);
        const to = Math.max(0, Math.min(current.current.rows.length - 1, d.index + Math.round((d.dy + offset.current - d.startOffset) / rowHeight)));
        if (from >= 0 && from !== to) current.current.onChange(moveOrderItem(current.current.rows, from, to));
      } else setActions(d.id);
    }
    drag.current = null; setVisual(null);
  };
  const handles = useRef(new Map<string, ReturnType<typeof PanResponder.create>>());
  const handle = (id: string) => {
    if (!handles.current.has(id)) handles.current.set(id, PanResponder.create({
      onStartShouldSetPanResponder: () => !current.current.disabled && current.current.rows.length > 1,
      onMoveShouldSetPanResponder: () => !current.current.disabled,
      onPanResponderGrant: (_, gesture) => {
        frame.current?.measureInWindow((_x, y, _width, height) => { viewport.current = { y, height }; });
        drag.current = { id, index: current.current.rows.findIndex(row => row.id === id), startOffset: offset.current, dy: 0, y: gesture.y0, moved: false };
        update();
      },
      onPanResponderMove: (_, gesture) => {
        if (!drag.current) return;
        drag.current.dy = gesture.dy; drag.current.y = gesture.moveY;
        if (Math.abs(gesture.dy) > 5) drag.current.moved = true;
        update();
      },
      onPanResponderRelease: () => release(false),
      onPanResponderTerminate: () => release(true),
      onPanResponderTerminationRequest: () => false,
    }));
    return handles.current.get(id)!.panHandlers;
  };
  const moveSelected = (direction: number) => {
    const index = rows.findIndex(row => row.id === actions);
    if (!disabled && index >= 0) onChange(moveOrderItem(rows, index, index + direction));
  };
  return <View ref={frame} style={{ flex: 1, minHeight: 0 }}>
    <ScrollView ref={scroll} scrollEnabled={!visual} scrollEventThrottle={16}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: space.md }}>
      <View style={{ backgroundColor: T.surface, borderRadius: radius.lg }}>
        {rows.map((row, index) => {
          const active = visual?.id === row.id;
          const source = visual ? rows.findIndex(item => item.id === visual.id) : -1;
          const shift = visual && !active
            ? source < index && index <= visual.target ? -rowHeight
              : visual.target <= index && index < source ? rowHeight : 0
            : 0;
          return <View key={row.id} style={{ height: rowHeight, flexDirection: 'row', alignItems: 'center', gap: space.sm,
            paddingHorizontal: space.sm, backgroundColor: active ? COLOR.action.primaryTint : T.surface,
            borderTopLeftRadius: index === 0 ? radius.lg : 0, borderTopRightRadius: index === 0 ? radius.lg : 0,
            borderBottomLeftRadius: index === rows.length - 1 ? radius.lg : 0, borderBottomRightRadius: index === rows.length - 1 ? radius.lg : 0,
            borderBottomWidth: index < rows.length - 1 ? 1 : 0, borderBottomColor: T.line2,
            zIndex: active ? 2 : 0, transform: [{ translateY: active ? visual.dy : shift }] }}>
            <View {...handle(row.id)} accessible focusable accessibilityRole="adjustable" accessibilityLabel={`${row.name} 순서 변경`}
              accessibilityHint="드래그하거나 활성화하여 순서를 변경합니다"
              aria-valuemin={1} aria-valuemax={rows.length} aria-valuenow={index + 1} aria-valuetext={`${rows.length}개 중 ${index + 1}번째`}
              accessibilityActions={[{ name: 'increment', label: '아래로 이동' }, { name: 'decrement', label: '위로 이동' }, { name: 'activate', label: '이동 메뉴' }]}
              onAccessibilityAction={event => {
                if (disabled) return;
                if (event.nativeEvent.actionName === 'activate') setActions(row.id);
                else onChange(moveOrderItem(rows, index, index + (event.nativeEvent.actionName === 'increment' ? 1 : -1)));
              }}
              {...{ onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                if (disabled) return;
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); onChange(moveOrderItem(rows, index, index + (event.key === 'ArrowUp' ? -1 : 1))); }
                else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActions(row.id); }
              } }}
              style={({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', touchAction: 'none' } as unknown as ViewStyle)}>
              <Icon name="grip" size={20} color={COLOR.text.tertiary} />
            </View>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: COLOR.text.primary }}>{row.name}</Text>
              {row.detail ? <Text numberOfLines={1} style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: 4 }}>{row.detail}</Text> : null}
            </View>
            {active ? <Text style={{ color: COLOR.text.accent, paddingRight: space.sm }}>{visual.target + 1}</Text> : null}
            {onDelete ? <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} 삭제`}
              accessibilityHint={row.deleteBlocked ?? '삭제 전 확인창을 엽니다'}
              accessibilityState={{ disabled: disabled || !!visual || (!!row.deleteBlocked && !onBlockedDelete) }}
              disabled={disabled || !!visual || (!!row.deleteBlocked && !onBlockedDelete)}
              onPress={() => row.deleteBlocked ? onBlockedDelete?.(row.id) : onDelete(row.id)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={row.deleteBlocked ? COLOR.text.disabled : COLOR.text.tertiary} />
            </Pressable> : null}
          </View>;
        })}
      </View>
    </ScrollView>
    {actions ? <ActionSheet floating visible onClose={() => setActions(null)} items={[
      ...(rows.findIndex(row => row.id === actions) > 0 ? [{ label: '위로 이동', onPress: () => moveSelected(-1) }] : []),
      ...(rows.findIndex(row => row.id === actions) < rows.length - 1 ? [{ label: '아래로 이동', onPress: () => moveSelected(1) }] : []),
    ]} /> : null}
  </View>;
}
