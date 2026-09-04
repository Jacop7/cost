// 앱 선언 전수 배정 검사기 (W1 · P1b).
//
// token-adoption-audit.json 의 선언 3,677건을 앱 매핑표의 규칙에 태워
// 여섯 통 중 하나에 배정하고, 배정이 성립하는지 검사한다.
//
//   primitive          tokens.ts 에 실재하는 값
//   semantic           역할 이름이 값을 소유하는 자리
//   componentOwned     단일 컴포넌트가 소유하는 고유값 — **이름 필수**
//   defect             같은 역할의 팔레트 값이 따로 있는데 벗어난 값 — **수렴 대상 또는 열린 결정 ID 필수**
//   pendingApproval    분류 제안. 결정이 사람에게 가야 하는 것 — **질문과 증거 필수**
//   approvedException  승인된 예외. **W1 완료 시점에 0 이어야 한다**
//
// 마지막 통이 0 이어야 하는 이유: W1 은 제안을 내는 단계이고 승인은 검수 뒤다.
// 산출물에 "승인 예외" 가 채워져 있으면 그 자체가 독단이다 (페이블 검수 조건 1).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const auditPath = resolve(args[0] ?? 'docs/token-adoption-audit.json');
const mapPath   = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-app-token-map.json');
const protoPath = resolve(args[2] ?? 'docs/prototypes/full-page-flow-prototype-token-map.json');
const outPath   = resolve(args[3] ?? 'docs/prototypes/full-page-flow-prototype-app-map-check.json');

const auditBytes = readFileSync(auditPath);
const mapBytes = readFileSync(mapPath);
const protoBytes = readFileSync(protoPath);
const audit = JSON.parse(auditBytes.toString('utf8'));
const map = JSON.parse(mapBytes.toString('utf8'));
const proto = JSON.parse(protoBytes.toString('utf8'));
const selfBytes = readFileSync(new URL(import.meta.url));

const BINS = ['primitive', 'semantic', 'componentOwned', 'defect', 'pendingApproval', 'approvedException'];
const failures = [];
const fail = (m) => failures.push(m);

// --- 규칙 형식 검사 --------------------------------------------------------
for (const r of map.rules) {
  if (!r.id) fail('규칙에 id 가 없다');
  if (!BINS.includes(r.bin)) fail(`${r.id} : 알 수 없는 통 '${r.bin}'`);
  // pendingApproval 은 evidence 가 곧 근거다. 둘 중 하나는 반드시 있어야 한다.
  if (!r.근거 && !r.evidence) fail(`${r.id} : 근거가 없다 — 어디서 나온 판정인지 적어야 한다`);
  if (r.bin === 'componentOwned' && !r.name) fail(`${r.id} : componentOwned 인데 이름이 없다. 이름 없는 px 는 예외가 아니라 미매핑이다`);
  if (r.bin === 'defect' && r.target === undefined && !r.openDecision) fail(`${r.id} : defect 인데 수렴 대상도 열린 결정 ID 도 없다`);
  if (r.bin === 'pendingApproval' && (!r.question || !r.evidence)) fail(`${r.id} : pendingApproval 인데 질문 또는 증거가 없다`);
}

// --- 규칙 적용 -------------------------------------------------------------
const num = (v) => (typeof v === 'number' ? v : Number(v));
const matches = (r, d) => {
  const m = r.match;
  if (m.group && m.group !== d.group) return false;
  if (m.props && !m.props.includes(d.prop)) return false;
  if (m.propPrefix && !m.propPrefix.some(p => d.prop.startsWith(p))) return false;
  if (m.values && !m.values.map(String).includes(String(d.value))) return false;
  if (m.valuesUpper && !m.valuesUpper.includes(String(d.value).toUpperCase())) return false;
  if (m.numericIn && !m.numericIn.includes(num(d.value))) return false;
  if (m.numericGt !== undefined && !(num(d.value) > m.numericGt)) return false;
  if (m.numericLt !== undefined && !(num(d.value) < m.numericLt)) return false;
  if (m.protoConverge) {
    const table = proto.converge[m.protoConverge];
    if (!table || !(String(num(d.value)) in table)) return false;
  }
  if (m.files && !m.files.some(f => d.file.includes(f))) return false;
  return true;
};

const hit = Object.fromEntries(map.rules.map(r => [r.id, 0]));
const binCount = Object.fromEntries(BINS.map(b => [b, 0]));
const unmatched = [];
const perRuleValues = Object.fromEntries(map.rules.map(r => [r.id, {}]));

for (const d of audit.declarations) {
  const r = map.rules.find(rule => matches(rule, d));
  if (!r) { unmatched.push(`${d.group}/${d.prop}:${d.value} @ ${d.file}:${d.line}`); continue; }
  hit[r.id]++;
  binCount[r.bin]++;
  const k = `${d.prop}:${d.value}`;
  perRuleValues[r.id][k] = (perRuleValues[r.id][k] || 0) + 1;
}

// --- 완료 조건 -------------------------------------------------------------
const total = audit.declarations.length;
const assigned = Object.values(binCount).reduce((a, b) => a + b, 0);
if (unmatched.length) fail(`미분류 ${unmatched.length}건 — 전수 배정이 아니다`);
if (assigned !== total) fail(`배정 합계 ${assigned} 이 선언 ${total} 과 다르다`);
if (binCount.approvedException !== 0) fail(`승인 예외 통이 ${binCount.approvedException}건 — W1 은 제안 단계다. 승인은 검수 뒤다`);
for (const r of map.rules) if (hit[r.id] === 0) fail(`${r.id} : 걸리는 선언이 0건 — 낡은 규칙이다`);

const result = {
  manifest: {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    script: { name: basename(new URL(import.meta.url).pathname), sha256: sha(selfBytes) },
    source: {
      audit: { path: basename(auditPath), sha256: sha(auditBytes), declarations: total },
      appMap: { path: basename(mapPath), sha256: sha(mapBytes) },
      prototypeMap: { path: basename(protoPath), sha256: sha(protoBytes) },
    },
    rules: {
      '통': 'primitive · semantic · componentOwned · defect · pendingApproval · approvedException',
      '완료 조건': '선언 = 여섯 통의 합 · 미분류 0 · approvedException 0 · componentOwned 이름 필수 · defect 수렴 대상 또는 열린 결정 필수 · pendingApproval 질문·증거 필수 · 걸리지 않는 규칙 0',
      '첫 일치': '규칙은 순서대로 평가하고 처음 일치한 것이 이긴다. 순서가 곧 우선순위다',
    },
  },
  summary: {
    status: failures.length ? 'FAIL' : 'PROPOSAL_COMPLETE',
    declarations: total,
    byBin: binCount,
    unmatchedCount: unmatched.length,
    unmatched: unmatched.slice(0, 50),
    openQuestions: map.rules.filter(r => r.bin === 'pendingApproval')
      .map(r => ({ id: r.id, question: r.question, declarations: hit[r.id], evidence: r.evidence, ownerDecision: r.ownerDecision ?? null })),
    perRule: map.rules.map(r => ({
      id: r.id, bin: r.bin, declarations: hit[r.id],
      name: r.name ?? null, target: r.target ?? null, openDecision: r.openDecision ?? null,
      values: Object.entries(perRuleValues[r.id]).sort((a, b) => b[1] - a[1]).slice(0, 12),
    })),
    failures,
  },
};
writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ status: result.summary.status, byBin: binCount, unmatched: unmatched.length, failures }, null, 1));
if (unmatched.length) console.log('미분류 예시:', unmatched.slice(0, 10));
