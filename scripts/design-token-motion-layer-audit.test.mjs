import assert from 'node:assert/strict';
import test from 'node:test';
import { auditRepository, classifyDeclarations, scanSource } from './design-token-motion-layer-audit.mjs';

test('주석·문자열은 선언으로 세지 않고 JSX animationType만 센다', () => {
  const rows = scanSource(`
    // animationType="fade" zIndex: 30
    const note = 'animationType="slide"';
    export const X = () => <Modal animationType="fade" />;
  `);
  assert.equal(rows.length, 1);
  assert.deepEqual({ prop: rows[0].prop, value: rows[0].value }, { prop: 'animationType', value: 'fade' });
});

test('zIndex 숫자는 레이어 선언이고 elevation은 그림자라 제외한다', () => {
  const rows = scanSource(`const styles = { fab: { zIndex: 30, elevation: 6 } };`, { file: 'x.ts' });
  assert.deepEqual(rows.map(({ group, prop, value }) => ({ group, prop, value })),
    [{ group: 'layer', prop: 'zIndex', value: 30 }]);
});

test('동적 값과 알려지지 않은 값은 조용히 분류하지 않는다', () => {
  const rows = scanSource(`const X=()=> <Modal animationType={mode} />; const s={zIndex:40};`);
  const result = classifyDeclarations(rows);
  assert.equal(result.unmapped.length, 2);
});

test('정적 회전은 모션이 아니고 실제 Animated 호출만 센다', () => {
  const rows = scanSource(`
    const style={transform:[{rotate:'180deg'}]};
    Animated.timing(value,{toValue:1}).start();
    withSpring(1);
  `, { file: 'x.ts' });
  assert.deepEqual(rows.map((row) => row.value), ['Animated.timing', 'withSpring']);
});

test('저장소 현재 P1c 인벤토리는 6건을 세 역할에 전부 배정한다', () => {
  const result = auditRepository();
  assert.equal(result.status, 'PROPOSAL_COMPLETE');
  assert.deepEqual(result.summary, {
    declarations: 6,
    motion: 5,
    layer: 1,
    animationType: { fade: 4, slide: 1, other: 0 },
    customMotionApiCalls: 0,
    zIndexValues: [30],
    unmapped: 0,
  });
  assert.deepEqual([...new Set(result.assignments.map((row) => row.role))].sort(), [
    'COMPONENT.contextMenu.animationType', 'COMPONENT.fab.zIndex', 'COMPONENT.sheet.animationType',
  ]);
});
