/**
 * TypeScript AST의 부호 있는 숫자 리터럴을 JS number로 읽는다.
 * `-7`은 NumericLiteral이 아니라 PrefixUnaryExpression(MinusToken)이므로
 * 양수만 검사하면 spacing·letterSpacing 음수 선언이 감사 우주에서 사라진다.
 */
export function numericLiteralValue(ts, node) {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node)
      && node.operator === ts.SyntaxKind.MinusToken
      && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  return null;
}
