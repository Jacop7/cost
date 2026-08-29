import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

function filesBelow(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesBelow(path);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [path] : [];
  });
}

function location(source, path, node) {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `${path}:${line + 1}`;
}

function looksLikeRpcClient(node, source) {
  const text = node.getText(source);
  return /(?:supabase|client)/i.test(text);
}

/**
 * 모바일 소스의 정적 `.rpc('literal')` 호출 이름을 모은다.
 *
 * 허용 목록과 대조할 수 없는 별칭·구조 분해·계산 키 호출은 조용히 건너뛰지 않고 실패한다.
 * 일반 `handlers[key]()`까지 막지 않도록 계산 키는 객체 표현식이 supabase/client 계열일 때만
 * RPC 후보로 취급한다.
 */
export function scanMobileRpcNames(roots) {
  const missingRoots = roots.filter((dir) => !existsSync(dir));
  if (missingRoots.length) throw new Error(`모바일 소스 루트가 없습니다: ${missingRoots.join(', ')}`);

  const files = roots.flatMap(filesBelow);
  if (files.length === 0) throw new Error(`모바일 소스를 하나도 찾지 못했습니다: ${roots.join(', ')}`);

  const names = new Set();
  const dynamic = [];

  for (const path of files) {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const isRpcProperty = ts.isPropertyAccessExpression(callee) && callee.name.text === 'rpc';
        const isRpcElement = ts.isElementAccessExpression(callee)
          && ts.isStringLiteralLike(callee.argumentExpression)
          && callee.argumentExpression.text === 'rpc';

        if (isRpcProperty || isRpcElement) {
          const first = node.arguments[0];
          if (isRpcProperty && first && ts.isStringLiteralLike(first)) names.add(first.text);
          else dynamic.push(location(source, path, node));
        }

        if (ts.isElementAccessExpression(callee)
            && !ts.isStringLiteralLike(callee.argumentExpression)
            && !ts.isNumericLiteral(callee.argumentExpression)
            && looksLikeRpcClient(callee.expression, source)) {
          dynamic.push(location(source, path, node));
        }
      }

      // `const { rpc } = client` / `const { rpc: call } = client`도 허용 목록과 대조할 수 없다.
      if (ts.isBindingElement(node)) {
        const bound = node.propertyName ?? node.name;
        if (ts.isIdentifier(bound) && bound.text === 'rpc') dynamic.push(location(source, path, node));
      }

      // `const call = client.rpc`처럼 호출 함수를 별칭으로 빼는 경로도 막는다.
      if (ts.isPropertyAccessExpression(node)
          && node.name.text === 'rpc'
          && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) {
        dynamic.push(location(source, path, node));
      }
      if (ts.isElementAccessExpression(node)
          && ts.isStringLiteralLike(node.argumentExpression)
          && node.argumentExpression.text === 'rpc'
          && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) {
        dynamic.push(location(source, path, node));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  if (dynamic.length) {
    throw new Error(`리터럴이 아닌 .rpc 이름 — 허용 목록 대조 불가: ${[...new Set(dynamic)].join(', ')}`);
  }
  return names;
}
