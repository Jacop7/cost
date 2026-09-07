#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./three-surface-byte-artifacts-check.mjs', import.meta.url), 'utf8');
for (const contract of ['manifest 자신이 첫 present', 'BOM 금지', 'CRLF/CR 금지', 'planned', '중복 artifact'])
  assert.ok(source.includes(contract), `byte manifest 검사 계약 누락: ${contract}`);
console.log('three-surface byte artifact 정적 음성 계약 5/5 PASS');

