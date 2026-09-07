#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./three-surface-advisory-ledger-check.mjs', import.meta.url), 'utf8');
for (const contract of [
  "item.disposition !== 'closed'", "item.closingSha", "merge-base', '--is-ancestor'",
  "round.verdict === 'PASS'", "actualMd !== expectedMd", "scope !== 'PLAN_ONLY'",
]) assert.ok(source.includes(contract), `검사기 계약 누락: ${contract}`);
console.log('three-surface advisory ledger 정적 음성 계약 6/6 PASS');

