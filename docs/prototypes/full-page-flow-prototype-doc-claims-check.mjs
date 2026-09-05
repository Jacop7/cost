// 문서가 숫자 목록으로 한 주장을 코드 실측과 대조한다 (페이블 제안 · W1 종결).
//
// 왜 필요한가: 이 회차에만 문서가 코드보다 앞서 있는 자리가 다섯 번 나왔다.
// §4.9 radius.sm 6→8 · §6.4 뱃지 계약 6→8 · §4.7 space 7단계→6단계 ·
// §7.3.1 스크롤 값 목록 · R-TY-WEIGHT-PRIM 의 400. 넷은 눈으로 걸렸지만
// §7.3.1 은 **값 개수(7)와 총 건수(49)가 우연히 같아** 대조에서 통과하고 있었다.
// 개수만 세는 대조는 이런 것을 잡지 못한다. 값 자체를 봐야 한다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const sha = (b) => createHash('sha256').update(b).digest('hex');
/**
 * git blob id — CRLF→LF 정규화 뒤 계산하므로 체크아웃한 OS 에 좌우되지 않는다.
 * 대조한 **문서 판본**을 산출물에 박아 두는 데 쓴다 (솔 검수 `W1 R2 F01`).
 */
const blobId = (buf) => {
  const lf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${lf.length}\u0000`, 'utf8'), lf])).digest('hex');
};
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const auditPath  = resolve(args[0] ?? 'docs/token-adoption-audit.json');
const claimsPath = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-doc-claims.json');
const outPath    = resolve(args[2] ?? 'docs/prototypes/full-page-flow-prototype-doc-claims-check.json');

const auditBytes = readFileSync(auditPath), claimBytes = readFileSync(claimsPath);
const audit = JSON.parse(auditBytes.toString('utf8'));
const claims = JSON.parse(claimBytes.toString('utf8'));


/**
 * §7.3 의 수치 블록을 **산출물에서 생성**한다. 문서가 이것과 한 글자라도 다르면 FAIL 이다.
 * 사람이 손으로 옮겨 적는 자리를 없애는 것이 목적이다 — 옮겨 적으면 낡는다.
 */
const nf = (n) => Number(n).toLocaleString('en-US');
function renderW1Block(sum) {
  const bins = sum.byBin ?? {};
  const pairs = sum.multiMatchPairs ?? {};
  const rows = (sum.perRule ?? []).slice()
    .sort((a, b) => (b.declarations - a.declarations) || String(a.id).localeCompare(String(b.id)));
  const L = [];
  L.push('');
  L.push(`선언 **${nf(sum.declarations)}** · 미분류 **${sum.unmatchedCount}** · 다중 일치 **${nf(sum.multiMatchCount)}**(고유 충돌 체인 **${Object.keys(pairs).length}**개)`);
  L.push('');
  L.push('| 통 | 선언 |');
  L.push('|---|---:|');
  for (const b of ['primitive', 'componentOwned', 'defect', 'pendingApproval', 'approvedException'])
    L.push(`| \`${b}\` | **${nf(bins[b] ?? 0)}** |`);
  L.push('');
  L.push('| 규칙 | 통 | 선언 |');
  L.push('|---|---|---:|');
  for (const r of rows) L.push(`| \`${r.id}\` | ${r.bin} | ${nf(r.declarations)} |`);
  L.push('');
  L.push('| 충돌 체인 | 선언 |');
  L.push('|---|---:|');
  for (const [k, v] of Object.entries(pairs).sort((a, b) => b[1] - a[1]))
    L.push(`| \`${k}\` | ${nf(v)} |`);
  L.push('');
  return L.join('\n');
}

const num = (v) => (typeof v === 'number' ? v : Number(v));
const failures = [];
const results = [];

for (const c of claims.claims) {
  // `문서블록` — **Markdown 을 실제로 읽는다** (솔 검수 `W1 R2 F01`).
  //
  // 초판의 `합계` 모드는 산출물의 통 합계만 봤고 **문서는 읽지도 않았다**(`c.문서` 는 결과에
  // 복사만 됐다). 그래서 §7.3 의 "순서 영향 1,810건"(실제 929) · "체인 12개"(실제 10) ·
  // 규칙별 건수 여덟 자리가 전부 통과했다. 특히 `CONTROL-BOX −2` 와 `CATEGORY-ACCENT +2` 가
  // **같은 `defect` 통 안에서 상쇄**돼 합계 게이트로는 보이지 않았다.
  //
  // 그래서 표를 **산출물에서 생성**하고, 문서의 표식 사이 내용과 글자 그대로 대조한다.
  // 규칙 하나의 건수만 어긋나도 잡히고, 상쇄로 숨을 수 없다. 고치는 법은 하나다 —
  // 검사기가 찍어 주는 블록을 문서에 붙여 넣는 것.
  if (c.mode === '문서블록') {
    const docPath = resolve(claimsPath, '..', '..', '..', c.문서);
    const srcArt = resolve(claimsPath, '..', c.출처);
    if (!existsSync(docPath)) { failures.push(`${c.id} : 문서를 찾을 수 없다 — ${c.문서}`); results.push({ id: c.id, verdict: 'FAIL', mode: '문서블록' }); continue; }
    if (!existsSync(srcArt)) { failures.push(`${c.id} : 대조할 산출물이 없다 — ${c.출처}`); results.push({ id: c.id, verdict: 'FAIL', mode: '문서블록' }); continue; }
    const sum = JSON.parse(readFileSync(srcArt, 'utf8')).summary ?? {};
    const want = renderW1Block(sum);
    const docBytes = readFileSync(docPath);
    // **어느 판본의 문서와 맞춰 봤는가** 를 산출물에 박는다. 검증은 블록 대조가 하고,
    // 이 값은 출처다 — 보고서가 "문서와 맞다" 고 말할 때 어느 문서인지 남는다.
    // `문서blob` 을 claim 에 적어 두면 **그 판본으로 고정**된다(선택). 적지 않으면 기록만 한다 —
    // 블록이 문서와 함께 바뀌는 자리라 매번 고정하면 갱신이 끝없이 돈다.
    const docBlob = blobId(docBytes);
    const md = docBytes.toString('utf8').replace(/\r\n/g, '\n');
    const open = `<!-- ${c.마커}: 자동 생성 -->`, close = `<!-- /${c.마커} -->`;
    const i = md.indexOf(open), j = md.indexOf(close);
    let verdict = 'PASS';
    if (i < 0 || j < 0 || j < i) {
      verdict = 'FAIL';
      failures.push(`${c.id} : 문서에 ${open} … ${close} 표식이 없다 — 자동 생성 블록을 넣어야 대조할 수 있다`);
    } else {
      const got = md.slice(i + open.length, j).trim();
      if (got !== want.trim()) {
        verdict = 'FAIL';
        const g = got.split('\n'), w = want.trim().split('\n');
        const n = g.findIndex((l, k) => l !== w[k]);
        failures.push(`${c.id} : ${c.절} 의 자동 생성 블록이 산출물과 다르다 — 첫 어긋남 ${n + 1}행 · 문서 "${(g[n] ?? '(없음)').slice(0, 70)}" · 실제 "${(w[n] ?? '(없음)').slice(0, 70)}". 아래 블록을 붙여 넣어라:\n${want}`);
      }
    }
    if (c.문서blob && c.문서blob !== docBlob) {
      verdict = 'FAIL';
      failures.push(`${c.id} : 고정된 문서 판본이 아니다 — claim ${String(c.문서blob).slice(0, 12)} · 지금 ${docBlob.slice(0, 12)}`);
    }
    results.push({ id: c.id, 문서: c.문서, 절: c.절, 주장: c.주장, mode: '문서블록', 마커: c.마커,
      문서blob: docBlob, 문서blob고정: c.문서blob ?? null, verdict });
    continue;
  }
  // `합계` — 값 목록이 아니라 **배정 결과의 수**를 주장한다 (페이블 W1 재종결 조건).
  // 문서와 산출물 사이의 대조라 선언 필터를 타지 않는다.
  if (c.mode === '합계') {
    const src = resolve(claimsPath, '..', c.출처);
    if (!existsSync(src)) { failures.push(`${c.id} : 대조할 산출물이 없다 — ${c.출처}`); results.push({ id: c.id, verdict: 'FAIL', mode: '합계' }); continue; }
    const got = JSON.parse(readFileSync(src, 'utf8')).summary ?? {};
    const actual = { 선언: got.declarations, 미분류: got.unmatchedCount, ...(got.byBin ?? {}) };
    const diff = Object.entries(c.기대).filter(([k, v]) => actual[k] !== v)
      .map(([k, v]) => `${k} 문서 ${v} ≠ 실제 ${actual[k]}`);
    if (diff.length) failures.push(`${c.id} : ${c.절} — ${diff.join(' · ')}`);
    results.push({ id: c.id, 문서: c.문서, 절: c.절, 주장: c.주장, mode: '합계',
      기대: c.기대, 실제: actual, verdict: diff.length ? 'FAIL' : 'PASS' });
    continue;
  }
  const ds = audit.declarations.filter(d => {
    if (c.group && d.group !== c.group) return false;
    if (c.props && !c.props.includes(d.prop)) return false;
    if (c.propPrefix && !c.propPrefix.some(p => d.prop.startsWith(p))) return false;
    if (c.numericGt !== undefined && !(num(d.value) > c.numericGt)) return false;
    if (c.numericLt !== undefined && !(num(d.value) < c.numericLt)) return false;
    return true;
  });
  const seen = new Map();
  for (const d of ds) { const n = num(d.value); if (Number.isFinite(n)) seen.set(n, (seen.get(n) ?? 0) + 1); }
  const claimed = new Set(c.values.map(num));
  const ghost = c.values.map(num).filter(v => !seen.has(v));            // 문서에만 있는 값
  const missing = [...seen.keys()].filter(v => !claimed.has(v)).sort((a, b) => a - b); // 코드에만 있는 값
  const r = {
    id: c.id, 문서: c.문서, 절: c.절, 주장: c.주장,
    claimedValues: c.values, observedValues: [...seen.keys()].sort((a, b) => a - b),
    observedCount: ds.length, claimedCount: c.count ?? null,
    ghost, missing, verdict: 'PASS',
  };
  // mode 는 주장의 종류다.
  //   전수 — "이 역할이 쓰는 값은 이 목록이 전부다". 양방향으로 본다.
  //   존재 — "스케일은 이 값들이다". 목록의 값이 코드에 하나도 없으면 유령이다.
  //          코드에 스케일 밖 값이 있는 것은 문서의 잘못이 아니라 W1 이 세고 있는 결함이다.
  r.mode = c.mode ?? '전수';
  if (ghost.length) { r.verdict = 'FAIL'; failures.push(`${c.id} : 문서에만 있고 코드에 없는 값 ${ghost.join('·')} — ${c.절}`); }
  if (r.mode === '전수' && missing.length) { r.verdict = 'FAIL'; failures.push(`${c.id} : 코드에만 있는 값 ${missing.join('·')} — ${c.절} 이 빠뜨렸다`); }
  if (c.count !== undefined && ds.length !== c.count) {
    r.verdict = 'FAIL'; failures.push(`${c.id} : 건수 ${ds.length} 인데 문서는 ${c.count} 라고 적었다`);
  }
  results.push(r);
}

const out = {
  manifest: {
    script: 'docs/prototypes/full-page-flow-prototype-doc-claims-check.mjs',
    scriptSha256: sha(readFileSync(new URL(import.meta.url))),
    auditSha256: sha(auditBytes), claimsSha256: sha(claimBytes),
    node: process.version, generatedAt: new Date().toISOString(),
    판정: '값 목록을 값으로 대조한다. 개수만 세면 §7.3.1 같은 자리를 놓친다.',
  },
  status: failures.length ? 'FAIL' : 'PASS',
  claimCount: results.length,
  failures, results,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ status: out.status, claims: out.claimCount, failures }, null, 1));
// FAIL 인데 종료 코드가 0 이면 단독 실행과 CI 체인이 성공으로 오인한다. `--strict` 를 붙여야
// 실패하던 것을 **기본 동작**으로 바꾼다 — 같은 결함을 app-map-check 에서 이미 한 번 고쳤다
// (솔 검수 `W1 R1 F05`). 검사기가 조용히 통과하는 길을 남겨 두지 않는다.
if (failures.length) process.exitCode = 1;
