// 문서가 숫자 목록으로 한 주장을 코드 실측과 대조한다 (페이블 제안 · W1 종결).
//
// 왜 필요한가: 이 회차에만 문서가 코드보다 앞서 있는 자리가 다섯 번 나왔다.
// §4.9 radius.sm 6→8 · §6.4 뱃지 계약 6→8 · §4.7 space 7단계→6단계 ·
// §7.3.1 스크롤 값 목록 · R-TY-WEIGHT-PRIM 의 400. 넷은 눈으로 걸렸지만
// §7.3.1 은 **값 개수(7)와 총 건수(49)가 우연히 같아** 대조에서 통과하고 있었다.
// 개수만 세는 대조는 이런 것을 잡지 못한다. 값 자체를 봐야 한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const auditPath  = resolve(args[0] ?? 'docs/token-adoption-audit.json');
const claimsPath = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-doc-claims.json');
const outPath    = resolve(args[2] ?? 'docs/prototypes/full-page-flow-prototype-doc-claims-check.json');

const auditBytes = readFileSync(auditPath), claimBytes = readFileSync(claimsPath);
const audit = JSON.parse(auditBytes.toString('utf8'));
const claims = JSON.parse(claimBytes.toString('utf8'));

const num = (v) => (typeof v === 'number' ? v : Number(v));
const failures = [];
const results = [];

for (const c of claims.claims) {
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
if (failures.length && process.argv.includes('--strict')) process.exit(1);
