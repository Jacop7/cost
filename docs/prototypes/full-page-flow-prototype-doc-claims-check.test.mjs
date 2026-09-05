#!/usr/bin/env node
/**
 * 문서 대조의 **음성 시험** (솔 검수 `W1 R2 F01`).
 *
 * 초판은 claims JSON 과 감사 JSON 만 읽고 **기획서를 열지도 않았다** — `문서` 경로는 결과에
 * 복사만 됐다. 그래서 §7.3 의 여덟 자리가 전부 통과했고, 특히 `CONTROL-BOX −2` 와
 * `CATEGORY-ACCENT +2` 는 **같은 통 안에서 상쇄**돼 합계로는 보이지 않았다.
 * 아래 시험들은 그 상쇄와 규칙 누락·추가를 각각 친다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..', '..');
const CHECK = join(here, 'full-page-flow-prototype-doc-claims-check.mjs');
const AUDIT = join(root, 'docs', 'token-adoption-audit.json');
const CLAIMS = join(here, 'full-page-flow-prototype-doc-claims.json');
const ART = join(here, 'full-page-flow-prototype-app-map-check.json');
const DOC = join(root, 'docs', '디자인-토큰-3계층-값-매핑-기획서.md');

/**
 * 산출물과 문서를 각각 변조해 검사기를 돌린다. 임시 저장소 모양을 그대로 만들어야
 * 검사기가 문서를 찾을 수 있다 — `claims` 파일 기준 두 단계 위가 저장소 뿌리다.
 */
const run = ({ artEdit = null, docEdit = null, claimsEol = null } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'docclaims-'));
  try {
    const proto = join(dir, 'docs', 'prototypes');
    mkdirSync(proto, { recursive: true });
    const art = JSON.parse(readFileSync(ART, 'utf8'));
    if (artEdit) artEdit(art.summary);
    writeFileSync(join(proto, 'full-page-flow-prototype-app-map-check.json'), JSON.stringify(art, null, 1));
    const claimsText = readFileSync(CLAIMS, 'utf8');
    writeFileSync(join(proto, 'full-page-flow-prototype-doc-claims.json'),
      claimsEol ? claimsText.replace(/\r?\n/g, claimsEol) : claimsText);
    let md = readFileSync(DOC, 'utf8');
    if (docEdit) md = docEdit(md);
    writeFileSync(join(dir, 'docs', '디자인-토큰-3계층-값-매핑-기획서.md'), md);
    const outPath = join(dir, 'out.json');
    const r = spawnSync(process.execPath, [CHECK, AUDIT,
      join(proto, 'full-page-flow-prototype-doc-claims.json'),
      outPath], { encoding: 'utf8' });
    const bytes = (() => { try { return readFileSync(outPath, 'utf8'); } catch { return null; } })();
    const result = (() => { try { return JSON.parse(bytes); } catch { return null; } })();
    return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? ''), result, bytes };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('저장소 그대로면 통과한다 — 시험 자체가 항상 FAIL 하는 것이 아님을 먼저 보인다', () => {
  const r = run({});
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /"status": "PASS"/);
});

test('같은 통 안에서 +2/−2 로 상쇄해도 FAIL 한다 — 합계 게이트가 놓치던 자리다', () => {
  const r = run({ artEdit: (s) => {
    const a = s.perRule.find(x => x.id === 'R-SZ-CONTROL-SM');
    const b = s.perRule.find(x => x.id === 'R-TY-LINEHEIGHT');
    a.declarations -= 2; b.declarations += 2;          // 통 합계도 선언 수도 그대로다
  } });
  assert.equal(r.code, 1, `같은 통 안의 상쇄를 놓쳤다\n${r.out}`);
  assert.match(r.out, /자동 생성 블록이 산출물과 다르다/);
});

test('규칙 하나가 사라지면 FAIL 한다', () => {
  const r = run({ artEdit: (s) => { s.perRule = s.perRule.filter(x => x.id !== 'R-RD-LEGEND-DOT'); } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /자동 생성 블록이 산출물과 다르다/);
});

test('없던 규칙이 늘어도 FAIL 한다', () => {
  const r = run({ artEdit: (s) => { s.perRule.push({ id: 'R-NEW-GHOST', bin: 'defect', declarations: 0 }); } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /자동 생성 블록이 산출물과 다르다/);
});

test('충돌 체인 수가 달라지면 FAIL 한다 — 문서의 "체인 12개" 가 통과하던 자리다', () => {
  const r = run({ artEdit: (s) => { s.multiMatchPairs = { ...s.multiMatchPairs, 'R-A > R-B': 1 }; } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /자동 생성 블록이 산출물과 다르다/);
});

test('문서에서 표식을 지우면 FAIL 한다 — 대조를 끄는 길을 막는다', () => {
  const r = run({ docEdit: (md) => md.replace('<!-- W1-수치: 자동 생성 -->', '') });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /표식이 없다/);
});

test('문서의 숫자를 손으로 고치면 FAIL 한다 — 문서를 실제로 읽는다는 증거다', () => {
  const r = run({ docEdit: (md) => md.replace(
    /(\| `pendingApproval` \| \*\*)(\d+)(\*\* \|)/,
    (_, a, n, b) => `${a}${Number(n) + 1}${b}`,
  ) });
  assert.equal(r.code, 1, `문서를 읽지 않고 있다\n${r.out}`);
  assert.match(r.out, /자동 생성 블록이 산출물과 다르다/);
});

test('claims JSON의 CRLF와 LF는 같은 입력 해시를 낸다', () => {
  const lf = run({ claimsEol: '\n' });
  const crlf = run({ claimsEol: '\r\n' });
  assert.equal(lf.code, 0, lf.out);
  assert.equal(crlf.code, 0, crlf.out);
  assert.equal(lf.result.manifest.claimsSha256, crlf.result.manifest.claimsSha256);
});

test('같은 입력을 두 번 검사해도 산출물 바이트가 같다 — 검사가 clean tree를 깨뜨리지 않는다', () => {
  const first = run({});
  const second = run({});
  assert.equal(first.code, 0, first.out);
  assert.equal(second.code, 0, second.out);
  assert.equal(first.bytes, second.bytes);
});
