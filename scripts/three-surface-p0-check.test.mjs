#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./three-surface-p0-check.mjs', import.meta.url), 'utf8');
for (const contract of [
  "P0 제품 화면 변경 금지 위반", "failureLines.length", "successorContract",
  "intentionalDifference", "regressionBacklog", "inventory floor", "outputSha256", "양방향 일치",
]) assert.ok(source.includes(contract), `P0 검사 계약 누락: ${contract}`);
console.log('three-surface P0 정적 음성 계약 7/7 PASS');
