import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { rpcNullableNumber, rpcNullableString, rpcNumber } from '../src/lib/rpcValue';

const sourceRoot = resolve('src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

describe('RPC 응답 값 변환', () => {
  it('null과 undefined 숫자는 0으로 옮긴다', () => {
    expect(rpcNumber(null)).toBe(0);
    expect(rpcNumber(undefined)).toBe(0);
  });

  it('숫자와 숫자 문자열은 Number 의미를 유지한다', () => {
    expect(rpcNumber(12.5)).toBe(12.5);
    expect(rpcNumber('12.5')).toBe(12.5);
  });

  it('잘못된 숫자 문자열은 기존처럼 NaN으로 드러낸다', () => {
    expect(rpcNumber('not-a-number')).toBeNaN();
  });

  it('nullable 숫자는 null을 보존한다', () => {
    expect(rpcNullableNumber(null)).toBeNull();
    expect(rpcNullableNumber(undefined)).toBeNull();
    expect(rpcNullableNumber('3.25')).toBe(3.25);
    expect(rpcNullableNumber('')).toBe(0);
    expect(rpcNullableNumber('not-a-number')).toBeNaN();
  });

  it('nullable 문자열은 null을 보존하고 나머지를 문자열로 옮긴다', () => {
    expect(rpcNullableString(null)).toBeNull();
    expect(rpcNullableString(undefined)).toBeNull();
    expect(rpcNullableString(42)).toBe('42');
    expect(rpcNullableString('')).toBe('');
  });

  it('같은 느슨한 변환을 화면 훅에 다시 만들지 않는다', () => {
    const duplicates = sourceFiles(sourceRoot)
      .filter((path) => !path.endsWith(join('lib', 'rpcValue.ts')))
      .filter((path) => {
        const codeWithoutComments = ts.transpileModule(readFileSync(path, 'utf8'), {
          compilerOptions: { removeComments: true, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        return /Number\([^)]* \?\? 0\)/.test(codeWithoutComments)
          || /([\w$.]+) === null \|\| \1 === undefined \? null : (?:Number|String)\(\1\)/
            .test(codeWithoutComments);
      });

    expect(duplicates).toEqual([]);
  });
});
