#!/usr/bin/env node
/**
 * W1 앱 값 매핑 검사기의 목적지·delta 음성 시험 (PRT-217 F02·F03).
 * 작성자가 적은 방향이 아니라 감사 현재값→기계 판독 목적지의 계산이 권위다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const CHECK = join(here, 'full-page-flow-prototype-app-map-check.mjs');
const AUDIT = join(here, '..', 'token-adoption-audit.json');
const MAP = join(here, 'full-page-flow-prototype-app-token-map.json');
const PROTO = join(here, 'full-page-flow-prototype-token-map.json');
const AXIS = join(here, 'full-page-flow-prototype-axis-at.json');
const original = JSON.parse(readFileSync(MAP, 'utf8'));
const audit = JSON.parse(readFileSync(AUDIT, 'utf8'));

const run = (mutate = () => {}, eol = '\n') => {
  const dir = mkdtempSync(join(tmpdir(), 'app-map-delta-'));
  try {
    const map = structuredClone(original);
    mutate(map);
    const mapPath = join(dir, 'map.json');
    const outPath = join(dir, 'out.json');
    writeFileSync(mapPath, (JSON.stringify(map, null, 1) + '\n').replace(/\n/g, eol));
    const r = spawnSync(process.execPath,
      [CHECK, AUDIT, mapPath, PROTO, outPath, `--axis=${AXIS}`],
      { encoding: 'utf8' });
    const out = (() => { try { return JSON.parse(readFileSync(outPath, 'utf8')); } catch { return null; } })();
    return { code: r.status, text: `${r.stdout ?? ''}\n${r.stderr ?? ''}`, out };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
const rule = (map, id) => map.rules.find(r => r.id === id);
const declarationKey = (d) => `${d.file}:${d.line}:${d.prop}`;
const asControlBoxDefect = (map) => {
  const x = rule(map, 'R-SZ-CONTROL-ROW-OVERFLOW');
  x.bin = 'defect';
  delete x.name;
  x.target = 44;
  x.targetMap = Object.fromEntries(audit.declarations
    .filter(d => d.group === 'size' && /DiscardHistoryScreen\.tsx$/.test(d.file)
      && [198, 203].includes(d.line) && ['width', 'height'].includes(d.prop))
    .map(d => [declarationKey(d), 44]));
  x.executionStage = 'S3a';
  x.axis = 'both';
  x.delta = 'same';
  x.evidenceRef = 'test synthetic target map';
  return x;
};
const TYPE_LINE_HEIGHT_TABLE = { '12': 18, '13': 18, '14': 20, '15': 22, '16': 22, '18': 24, '20': 26, '22': 28 };

test('최종 W1은 정의 21건을 분리하고 음수 포함 사용처 2,353건을 다섯 통에 배정한다', () => {
  const r = run();
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(r.out.summary.byBin, {
    primitive: 2063, componentOwned: 249, defect: 8,
    pendingApproval: 33, approvedException: 0,
  });
  assert.equal(audit.summary.declarations, 2353);
  assert.equal(audit.declarations.filter(d => Number(d.value) < 0).length, 32);
  assert.equal(audit.definitions.total, 21);
  assert.equal(audit.definitions.declarations.filter(d => d.prop === 'lineHeight').length, 7);
  assert.equal(audit.declarations.filter(d => d.layer === 'tokenDefinition').length, 0);
  const per = Object.fromEntries(r.out.summary.perRule.map(x => [x.id, x]));
  assert.equal(per['R-SZ-APPHEADER-ACTION'].declarations, 24);
  assert.equal(per['R-SZ-RECIPE-EDITOR-TOUCH'].declarations, 8);
  assert.equal(per['R-SZ-BUTTON-SM-MINHEIGHT'].declarations, 1);
  assert.equal(per['R-SP-QUANTITY-TOUCH-ENVELOPE'].declarations, 2);
  assert.equal(per['R-SP-ROW-OVERFLOW-TOUCH-BOX'].declarations, 1);
  assert.equal(per['R-SP-FORM-AUXILIARY-OVERLAP'].declarations, 4);
  assert.equal(per['R-SP-PROFIT-SECTION-LABEL-OVERLAP'].declarations, 1);
  assert.equal(per['R-TY-LETTERSPACING-TITLE-TIGHT'].declarations, 10);
  assert.equal(per['R-TY-LETTERSPACING-UNDECIDED'].declarations, 15);
  assert.equal(per['R-SP-CAPTION-GAP-VIEW'].declarations, 5);
  assert.equal(per['R-SP-EMPTY-STANDARD-V'].declarations, 2);
  assert.equal(per['R-SP-EMPTY-STANDARD-H'].declarations, 2);
  assert.equal(per['R-SP-EMPTY-COMPACT'].declarations, 2);
  assert.equal(per['R-SP-EMPTY-SHEET'].declarations, 2);
  assert.equal(per['R-SP-EMPTY-DAY-DETAIL'].declarations, 1);
  assert.equal(per['R-SP-SESSION-GATE-H'].declarations, 1);
  assert.equal(r.out.summary.multiMatchCount, 774);
});

test('닫힌 역할을 질문·증거까지 붙여 pendingApproval로 되돌려도 계약이 막는다', () => {
  const r = run(map => {
    const x = rule(map, 'R-SZ-BUTTON-SM-MINHEIGHT');
    x.bin = 'pendingApproval';
    delete x.name;
    x.question = '다시 물을까';
    x.evidence = '이미 닫힌 D-11';
  });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /pendingApproval 규칙 집합이 계약과 다르다/);
});

test('목적지 변경으로 계산 방향이 뒤집히면 수기 delta와의 불일치를 잡는다', () => {
  const r = run(map => {
    const x = asControlBoxDefect(map);
    for (const key of Object.keys(x.targetMap)) x.targetMap[key] = 48;
  });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /수기 delta 'same'.*계산 'grow'/s);
});

test('목적지는 그대로인데 수기 delta만 조작해도 실패한다', () => {
  const r = run(map => { asControlBoxDefect(map).delta = 'shrink'; });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /수기 delta 'shrink'.*계산 'same'/s);
});

test('한 규칙 안에 same과 shrink가 섞인 목적지는 mixed로 계산한다', () => {
  const r = run(map => {
    const x = asControlBoxDefect(map);
    const keys = Object.keys(x.targetMap);
    x.targetMap[keys[0]] = 40;
    x.targetMap[keys[1]] = 48;
  });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /R-SZ-CONTROL-ROW-OVERFLOW.*계산 'mixed'/s);
});

test('axis가 있는 defect에서 숫자 목적지를 없애면 실패한다', () => {
  const r = run(map => { delete asControlBoxDefect(map).targetMap; });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /정확히 하나가 필요하다/);
});

test('targetMap이 이기지 않은 선언을 품으면 낡은 목적지로 실패한다', () => {
  const r = run(map => { asControlBoxDefect(map).targetMap['apps/mobile/src/없는화면.tsx:1:height'] = 44; });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /targetMap 항목이 이 규칙이 이긴 선언이 아니다/);
});

test('파생 목적지는 폐쇄 enum·판본·근거가 모두 있어야 한다', () => {
  const r = run(map => {
    const x = asControlBoxDefect(map);
    delete x.targetMap;
    x.axis = 'vertical';
    x.targetDerived = { kind: 'typeLineHeightByFontSize', formulaVersion: 1,
      decisionRef: 'DS-20260905-001#6-2', table: TYPE_LINE_HEIGHT_TABLE };
  });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /targetDerived 는 지원 kind/);
});

test('lineHeight 파생표가 사용자 확정 6-2와 한 값이라도 다르면 실패한다', () => {
  const r = run(map => {
    const x = asControlBoxDefect(map);
    delete x.targetMap;
    x.axis = 'vertical';
    x.targetDerived = { kind: 'typeLineHeightByFontSize', formulaVersion: 1,
      decisionRef: 'DS-20260905-001#6-2', evidenceRef: '기획서 §8.2 문항 6 결정 6-2',
      table: { ...TYPE_LINE_HEIGHT_TABLE, '18': 22 } };
  });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /lineHeight 파생표가 사용자 확정 6-2와 다르다/);
});

test('같은 매핑표의 CRLF와 LF는 같은 입력 해시를 낸다', () => {
  const lf = run(() => {}, '\n');
  const crlf = run(() => {}, '\r\n');
  assert.equal(lf.code, 0, lf.text);
  assert.equal(crlf.code, 0, crlf.text);
  assert.equal(lf.out.manifest.source.appMap.sha256, crlf.out.manifest.source.appMap.sha256);
});
