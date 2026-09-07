import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { numericLiteralValue } from './token-adoption-numeric-literal.mjs';

function initializerOf(source, propName) {
  const sf = ts.createSourceFile('fixture.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found = null;
  (function visit(node) {
    if (ts.isPropertyAssignment(node)
        && node.name.getText(sf).replace(/['"]/g, '') === propName) found = node.initializer;
    ts.forEachChild(node, visit);
  })(sf);
  return found;
}

test('marginTop: -8을 음수 선언으로 읽는다', () => {
  const node = initializerOf('const s = { marginTop: -8 };', 'marginTop');
  assert.equal(numericLiteralValue(ts, node), -8);
});

test('letterSpacing: -0.3을 소수 음수로 읽는다', () => {
  const node = initializerOf('const s = { letterSpacing: -0.3 };', 'letterSpacing');
  assert.equal(numericLiteralValue(ts, node), -0.3);
});

test('양수와 0은 기존대로 읽고 식은 숫자 리터럴로 오인하지 않는다', () => {
  assert.equal(numericLiteralValue(ts, initializerOf('const s = { gap: 7 };', 'gap')), 7);
  assert.equal(numericLiteralValue(ts, initializerOf('const s = { gap: 0 };', 'gap')), 0);
  assert.equal(numericLiteralValue(ts, initializerOf('const s = { gap: x - 1 };', 'gap')), null);
});
