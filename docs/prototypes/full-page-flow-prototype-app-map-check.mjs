// 앱 선언 전수 배정 검사기 (W1 · P1b).
//
// token-adoption-audit.json 의 **사용처 선언**을 앱 매핑표의 규칙에 태워
// 다섯 통 중 하나에 배정하고, 배정이 성립하는지 검사한다.
//
//   primitive          tokens.ts 에 실재하는 값
//   componentOwned     단일 컴포넌트가 소유하는 고유값 — **이름 필수**
//   defect             같은 역할의 팔레트 값이 따로 있는데 벗어난 값 — **수렴 대상 또는 열린 결정 ID 필수**
//   pendingApproval    분류 제안. 결정이 사람에게 가야 하는 것 — **질문과 증거 필수**
//   approvedException  승인된 예외. **W1 완료 시점에 0 이어야 한다**
//
// 마지막 통이 0 이어야 하는 이유: W1 은 제안을 내는 단계이고 승인은 검수 뒤다.
// 산출물에 "승인 예외" 가 채워져 있으면 그 자체가 독단이다 (페이블 검수 조건 1).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';

// 모두 UTF-8 텍스트 입력이다. checkout 의 CRLF/LF가 증거를 바꾸지 않도록 Git 정규화와
// 같은 방향으로 LF를 해시한다(PRT-216의 "내용을 재고 OS를 재지 않는다" 계약).
const sha = (b) => createHash('sha256')
  .update(Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')).digest('hex');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const auditPath = resolve(args[0] ?? 'docs/token-adoption-audit.json');
const mapPath   = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-app-token-map.json');
const protoPath = resolve(args[2] ?? 'docs/prototypes/full-page-flow-prototype-token-map.json');
const outPath   = resolve(args[3] ?? 'docs/prototypes/full-page-flow-prototype-app-map-check.json');
// 축 측정 산출물 — `방향` 산문을 믿지 않고 **선언마다 잰 축**과 대조한다 (솔 `W1 R1 F03`).
// 위치 인자 5번은 이미 이전 회차 매핑표(대차용)가 쓰고 있으므로 이름 있는 옵션으로 받는다.
const axisOpt = process.argv.slice(2).find(a => a.startsWith('--axis='));
const axisPath  = resolve(axisOpt ? axisOpt.slice('--axis='.length) : '.tmp/axis-at.json');

const auditBytes = readFileSync(auditPath);
const mapBytes = readFileSync(mapPath);
const protoBytes = readFileSync(protoPath);
const audit = JSON.parse(auditBytes.toString('utf8'));
const map = JSON.parse(mapBytes.toString('utf8'));
const proto = JSON.parse(protoBytes.toString('utf8'));
const axisArt = existsSync(axisPath) ? JSON.parse(readFileSync(axisPath, 'utf8')) : null;
const selfBytes = readFileSync(new URL(import.meta.url));

// ⚠ `semantic` 통을 **없앤다** (솔 검수 `W1 R1 F02`).
//
// 산출물은 "P4 에서 치환되면 semantic 이 채워진다" 고 적고 있었는데 그 기전이 성립하지 않는다.
// 감사기는 **숫자 리터럴만** 선언으로 모은다. `fontSize: 16` 을 `TYPE.body` 로 치환하면 그
// 선언은 `semantic` 으로 **이동하는 것이 아니라 입력에서 사라진다.** 영원히 0 인 통을 놓고
// "아직 안 채워졌다" 고 적는 것은 분류가 아니라 변명이다.
//
// 그래서 W1 의 범위를 정직하게 **"하드코딩 리터럴의 배정"** 으로 좁힌다. 의미 토큰 채택률은
// 같은 감사기가 이미 모으고 있는 `tokenAccess` 로 따로 보는 지표다 — 이 표의 통이 아니다.
// 입력이 결속돼 있는지 **검사기가 직접 본다** (솔 검수 `W1 R1 F01`).
// 결속 없이 만들어진 감사 산출물을 그대로 배정하면 W1 은 또 남의 나무를 세게 된다.
if (!audit.manifest?.결속?.expectCommit || !audit.manifest?.결속?.범위해시) {
  console.error('앱 선언 전수 배정 검사 — 입력 결속 FAIL');
  console.error('  - 감사 산출물에 결속(expectCommit · 범위해시)이 없다. token-adoption-audit.mjs 를 --expect-commit 과 함께 clean checkout 에서 다시 돌려라');
  process.exit(1);
}
/**
 * 산출물↔산출물 결속은 **파일 바이트가 아니라 파싱한 JSON 의 정규형**으로 잰다
 * (페이블 `R6` 차단). 바이트로 재면 줄끝·들여쓰기·직렬화 방식이 바뀌는 순간 갈리고,
 * 그건 "내용이 달라졌다" 가 아니라 "다시 썼다" 를 잰 것이다.
 * 키를 정렬하고 LF 로 이어 붙여 sha256 한다 — 재직렬화해도 같은 값이 나온다.
 */
const canon = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
};
const canonHash = (v) => createHash('sha256').update(canon(v), 'utf8').digest('hex');

const BINS = ['primitive', 'componentOwned', 'defect', 'pendingApproval', 'approvedException'];
const STAGES = ['S1', 'S2', 'S3a', 'S3b', 'S3c', 'S4'];
const AXES = ['horizontal', 'vertical', 'both', 'none', 'derived'];
const DELTAS = ['shrink', 'same', 'grow', 'mixed', 'unknown'];
const TARGET_FIELDS = ['targetValue', 'targetMap', 'protoConverge', 'targetDerived'];
const RUNTIME_DERIVED_TARGET_KINDS = ['scrollStart', 'scrollEnd', 'scrollEndFab'];
const DETERMINISTIC_DERIVED_TARGET_KINDS = ['typeLineHeightByFontSize'];
const DERIVED_TARGET_KINDS = [...RUNTIME_DERIVED_TARGET_KINDS, ...DETERMINISTIC_DERIVED_TARGET_KINDS];
// 사용자 결정 6-2의 폐쇄표다. targetDerived가 같은 표를 품는 이유는 산출물만 읽어도
// 실행 계약이 보이게 하기 위해서이고, 검사기는 이 상수와 **값까지** 대조한다.
// `mixed`라는 delta 하나만 맞춰 두고 틀린 targetMap을 통과시키던 PRT-220 결함을 막는다.
const TYPE_LINE_HEIGHT_BY_FONT_SIZE_V1 = Object.freeze({
  12: 18, 13: 18, 14: 20, 15: 22, 16: 22, 18: 24, 20: 26, 22: 28,
});
const TYPE_LINE_HEIGHT_DECISION = 'DS-20260905-001#6-2';
const failures = [];
const fail = (m) => failures.push(m);

const declKey = (d) => `${d.file}:${d.line}:${d.prop}`;
const targetFieldsOf = (r) => TARGET_FIELDS.filter(k => r[k] !== undefined);
const deltaOf = (current, target) => target < current ? 'shrink' : target > current ? 'grow' : 'same';
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 토큰 정본의 정의가 하드코딩 실행 우주에 다시 섞이면 정본 자신을 defect로 바꾸게 된다.
if (!audit.definitions || !Array.isArray(audit.definitions.declarations))
  fail('감사 산출물에 분리된 definitions 인벤토리가 없다');
for (const d of audit.declarations ?? []) if (d.layer === 'tokenDefinition')
  fail(`토큰 정의가 실행 우주 declarations에 섞였다 — ${declKey(d)}`);

// --- 규칙 형식 검사 --------------------------------------------------------
for (const r of map.rules) {
  if (!r.id) fail('규칙에 id 가 없다');
  if (!BINS.includes(r.bin)) fail(`${r.id} : 알 수 없는 통 '${r.bin}'`);
  // `semantic` 은 삭제된 통이다(솔 `W1 R1 F02`). 되살아나면 곧바로 잡는다.
  if (r.bin === 'semantic') fail(`${r.id} : semantic 통은 삭제됐다 — 하드코딩 리터럴은 semantic 으로 이동하지 않는다. 의미 토큰 채택률은 tokenAccess 로 본다`);
  // pendingApproval 은 evidence 가 곧 근거다. 둘 중 하나는 반드시 있어야 한다.
  if (!r.근거 && !r.evidence) fail(`${r.id} : 근거가 없다 — 어디서 나온 판정인지 적어야 한다`);
  if (r.bin === 'componentOwned' && !r.name) fail(`${r.id} : componentOwned 인데 이름이 없다. 이름 없는 px 는 예외가 아니라 미매핑이다`);
  if (r.bin === 'defect' && r.target === undefined && !r.openDecision) fail(`${r.id} : defect 인데 수렴 대상도 열린 결정 ID 도 없다`);
  // `방향` 은 산문 한 칸에 **실행 단계와 축과 증감**을 섞어 담고 있었고, 검사기는 그 칸이
  // 비어 있지 않은지만 봤다 — `S33a` 같은 오타도 통과했다 (솔 검수 `W1 R1 F03`).
  // 셋을 갈라 열거값으로 강제하고, 축 판정은 **결속된 측정 산출물**을 대게 한다.
  if (r.bin === 'defect') {
    if (!STAGES.includes(r.executionStage)) fail(`${r.id} : executionStage 가 ${STAGES.join('/')} 중 하나가 아니다 — '${r.executionStage ?? '없음'}'`);
    if (!AXES.includes(r.axis)) fail(`${r.id} : axis 가 ${AXES.join('/')} 중 하나가 아니다 — '${r.axis ?? '없음'}'`);
    if (!DELTAS.includes(r.delta)) fail(`${r.id} : delta 가 ${DELTAS.join('/')} 중 하나가 아니다 — '${r.delta ?? '없음'}'`);
    if (!r.evidenceRef) fail(`${r.id} : evidenceRef 가 없다 — 축 판정의 근거가 되는 측정 산출물을 대야 한다`);
    // `target` 산문에서 숫자를 긁지 않는다. 실행 방향의 근거는 아래 네 필드 중 정확히 하나다.
    // 산문을 파싱하면 "32/38" 중 어느 선언이 어디로 가는지 다시 추측하게 된다.
    const tf = targetFieldsOf(r);
    if (r.axis !== 'none' && tf.length !== 1)
      fail(`${r.id} : axis '${r.axis}' 인 defect 는 targetValue/targetMap/protoConverge/targetDerived 중 정확히 하나가 필요하다 — 지금 ${tf.length}개`);
    if (r.targetValue !== undefined && !Number.isFinite(r.targetValue))
      fail(`${r.id} : targetValue 는 유한한 숫자여야 한다`);
    if (r.targetMap !== undefined && (r.targetMap === null || Array.isArray(r.targetMap) || typeof r.targetMap !== 'object'))
      fail(`${r.id} : targetMap 은 { "파일:줄:속성": 숫자 } 객체여야 한다`);
    if (r.targetMap && Object.entries(r.targetMap).some(([, v]) => !Number.isFinite(v)))
      fail(`${r.id} : targetMap 의 모든 목적지는 유한한 숫자여야 한다`);
    if (r.protoConverge !== undefined && (!proto.converge?.[r.protoConverge] || typeof proto.converge[r.protoConverge] !== 'object'))
      fail(`${r.id} : protoConverge '${r.protoConverge}' 표가 없다`);
    if (r.targetDerived !== undefined) {
      if (!r.targetDerived || typeof r.targetDerived !== 'object' ||
          !DERIVED_TARGET_KINDS.includes(r.targetDerived.kind) ||
          r.targetDerived.formulaVersion !== 1 || !r.targetDerived.evidenceRef)
        fail(`${r.id} : targetDerived 는 지원 kind(${DERIVED_TARGET_KINDS.join('/')}) · formulaVersion=1 · evidenceRef 를 가져야 한다`);
      if (RUNTIME_DERIVED_TARGET_KINDS.includes(r.targetDerived.kind)) {
        if (r.axis !== 'derived') fail(`${r.id} : 런타임 targetDerived 를 쓰는 규칙의 axis 는 derived 여야 한다`);
        if (r.delta !== 'unknown') fail(`${r.id} : 런타임 파생 목적지는 계산 전 delta 를 unknown 으로 둬야 한다`);
      }
      if (r.targetDerived.kind === 'typeLineHeightByFontSize') {
        if (r.targetDerived.decisionRef !== TYPE_LINE_HEIGHT_DECISION)
          fail(`${r.id} : lineHeight 파생의 decisionRef 는 ${TYPE_LINE_HEIGHT_DECISION} 이어야 한다`);
        if (!sameJson(r.targetDerived.table, TYPE_LINE_HEIGHT_BY_FONT_SIZE_V1))
          fail(`${r.id} : lineHeight 파생표가 사용자 확정 6-2와 다르다 — ${JSON.stringify(r.targetDerived.table)}`);
        if (r.axis === 'derived') fail(`${r.id} : lineHeight 파생은 숫자 목적지가 확정된 세로 변경이다 — axis=vertical 이어야 한다`);
      }
    }
  }
  // 기존 결정의 적용이라고 말하려면 그 결정이 어디 있는지 대야 한다.
  if (r.bin === 'defect' && /기존 결정|이미 정한|새 결정이 아니/.test(String(r.근거 ?? '')) && !r.출처) fail(`${r.id} : "기존 결정" 이라 적었는데 출처가 없다`);
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
  if (m.fontSizePairStatus && d.fontSizePair?.status !== m.fontSizePairStatus) return false;
  if (m.protoConverge) {
    const table = proto.converge[m.protoConverge];
    if (!table || !(String(num(d.value)) in table)) return false;
  }
  if (m.files && !m.files.some(f => d.file.includes(f))) return false;
  // at 항목은 `파일:줄` 또는 `파일:줄:속성` 이다. 한 줄에 같은 그룹의 선언이 둘 이상 있고
  // 서로 다른 통에 가야 하면 줄만으로는 못 가른다 (축이 갈리는 gap/padding 이 그 경우다).
  if (m.at && !m.at.some(a => {
    const parts = a.split(':');
    const prop = parts.length >= 3 ? parts.pop() : null;
    const ln = parts.pop();
    const f = parts.join(':');
    return d.file.endsWith(f) && Number(ln) === d.line && (!prop || prop === d.prop);
  })) return false;
  return true;
};

const hit = Object.fromEntries(map.rules.map(r => [r.id, 0]));
const binCount = Object.fromEntries(BINS.map(b => [b, 0]));
const unmatched = [];
const perRuleValues = Object.fromEntries(map.rules.map(r => [r.id, {}]));
const wonKeys = {};
const wonDeclarations = {};

// "첫 일치가 이긴다" 는 숨은 결정이다. 한 선언이 규칙 둘 이상에 걸리면 그 배정의 근거는
// 규칙이 아니라 **배치 순서**가 된다. 그래서 다중 일치를 세어 낸다 (페이블 검수 조건 B).
// 0 이면 순서는 장식이고 안전하다. 0 이 아니면 그 행들과 이유를 표로 내야 한다.
const multiMatch = [];
const multiMatchPairs = {};

for (const d of audit.declarations) {
  const all = map.rules.filter(rule => matches(rule, d));
  if (all.length > 1) {
    const pair = all.map(r => r.id).join(' > ');
    multiMatchPairs[pair] = (multiMatchPairs[pair] || 0) + 1;
    multiMatch.push({ decl: `${d.group}/${d.prop}:${d.value} @ ${d.file}:${d.line}`, rules: all.map(r => r.id) });
  }
  const r = all[0];
  if (!r) { unmatched.push(`${d.group}/${d.prop}:${d.value} @ ${d.file}:${d.line}`); continue; }
  hit[r.id]++;
  binCount[r.bin]++;
  (wonKeys[r.id] ??= []).push(declKey(d));
  (wonDeclarations[r.id] ??= []).push(d);
  const k = `${d.prop}:${d.value}`;
  perRuleValues[r.id][k] = (perRuleValues[r.id][k] || 0) + 1;
}

// --- 목적지·증감 교차 검증 (솔 `W1 R2 F03`) -------------------------------
// `delta` 를 규칙 작성자가 직접 적고 검사기가 열거값만 보던 구조를 끝낸다. 현재값은 감사
// 산출물에서, 목적지는 targetValue/targetMap/protoConverge/결정적 targetDerived 중 하나에서
// 읽어 선언마다 계산한다. 런타임 좌표계에서만 정해지는 값은 별도 targetDerived kind로
// 명시하고, formula+근거가 없으면 통과하지 않는다.
const computedDirection = {};
const resolveTarget = (r, d) => {
  if (r.targetValue !== undefined) return r.targetValue;
  if (r.targetMap !== undefined) return r.targetMap[declKey(d)];
  if (r.protoConverge !== undefined) return proto.converge?.[r.protoConverge]?.[String(num(d.value))];
  if (r.targetDerived?.kind === 'typeLineHeightByFontSize') {
    if (d.fontSizePair?.status !== 'direct') return undefined;
    return r.targetDerived.table?.[String(d.fontSizePair.value)];
  }
  return undefined;
};

for (const r of map.rules) {
  if (r.bin !== 'defect' || r.axis === 'none') continue;
  const ds = wonDeclarations[r.id] ?? [];
  if (!ds.length) continue;
  if (r.targetDerived !== undefined && RUNTIME_DERIVED_TARGET_KINDS.includes(r.targetDerived.kind)) {
    computedDirection[r.id] = { computedDelta: 'unknown', resolved: 0, derived: ds.length,
      transitions: { derived: ds.length }, targetSource: 'targetDerived' };
    continue;
  }

  const transitions = {};
  const directions = new Set();
  let resolved = 0;
  for (const d of ds) {
    const target = resolveTarget(r, d);
    if (!Number.isFinite(target)) {
      fail(`${r.id} : ${declKey(d)} 현재값 ${d.value} 의 숫자 목적지를 계산할 수 없다`);
      continue;
    }
    const current = num(d.value);
    if (!Number.isFinite(current)) {
      fail(`${r.id} : ${declKey(d)} 현재값 '${d.value}' 이 숫자가 아니다`);
      continue;
    }
    const direction = deltaOf(current, target);
    directions.add(direction);
    const k = `${current}→${target}`;
    transitions[k] = (transitions[k] ?? 0) + 1;
    resolved++;
  }
  if (r.targetMap !== undefined) {
    const won = new Set(ds.map(declKey));
    for (const k of Object.keys(r.targetMap)) if (!won.has(k))
      fail(`${r.id} : targetMap 항목이 이 규칙이 이긴 선언이 아니다 — ${k}`);
  }
  const computedDelta = directions.size === 1 ? [...directions][0] : directions.size > 1 ? 'mixed' : null;
  computedDirection[r.id] = { computedDelta, resolved, derived: 0, transitions,
    targetSource: targetFieldsOf(r)[0] ?? null };
  if (computedDelta && r.delta !== computedDelta)
    fail(`${r.id} : 수기 delta '${r.delta}' ≠ 현재값→목적지 계산 '${computedDelta}' — ${Object.entries(transitions).map(([k, v]) => `${k}×${v}`).join(' · ')}`);

  // 실행 단계와 **계산된** 방향을 서로 구속한다. 수기 delta 를 다시 믿지 않는다.
  if (r.executionStage === 'S3b' && !['horizontal', 'both'].includes(r.axis))
    fail(`${r.id} : S3b 인데 axis 가 '${r.axis}' 다 — S3b 는 폭이 느는 자리다`);
  if (r.executionStage === 'S3b' && !['grow', 'mixed'].includes(computedDelta))
    fail(`${r.id} : S3b 인데 계산 delta 가 '${computedDelta}' 다 — 폭이 늘지 않으면 S3a 다`);
  if (r.executionStage === 'S3a' && r.axis === 'horizontal' && ['grow', 'mixed'].includes(computedDelta))
    fail(`${r.id} : S3a 인데 계산상 가로로 늘어난다 — 그건 S3b 다`);
  if (r.executionStage === 'S3a' && r.axis === 'both' && computedDelta === 'grow')
    fail(`${r.id} : S3a 인데 계산상 두 축이 함께 는다 — 폭이 늘면 S3b 다`);
}

// pendingApproval은 단순 미분류 대기실이 아니다. 소유자의 **새 제품 결정**이 필요한
// 규칙만 허용한다(PRT-220). 닫힌 D-11의 역할 대응을 이 통으로 옮겨 숫자 목적지 검사를
// 우회하지 못하도록 매핑표의 명시 계약과 실제 규칙 집합을 양방향 대조한다.
{
  const contract = map.pendingApprovalContract;
  if (!contract || !Array.isArray(contract.ruleIds) || !Number.isInteger(contract.expectedDeclarations)) {
    fail('pendingApprovalContract(ruleIds · expectedDeclarations)가 없다');
  } else {
    const declared = [...contract.ruleIds].sort();
    const actual = map.rules.filter(r => r.bin === 'pendingApproval').map(r => r.id).sort();
    if (JSON.stringify(declared) !== JSON.stringify(actual))
      fail(`pendingApproval 규칙 집합이 계약과 다르다 — 계약 ${declared.join(', ')} · 실제 ${actual.join(', ')}`);
  }
}
const multiMatchCount = Object.values(multiMatchPairs).reduce((a, b) => a + b, 0);

if (map.pendingApprovalContract && binCount.pendingApproval !== map.pendingApprovalContract.expectedDeclarations) {
  fail(`pendingApproval 선언 ${binCount.pendingApproval}건이 계약 ${map.pendingApprovalContract.expectedDeclarations}건과 다르다`);
}
// 순서 의존 — **아무 문자열이나 적혀 있으면 통과**하던 검사를 양방향 대조로 바꾼다
// (솔 검수 `W1 R1 F04`). 승자 규칙은 자기가 이기는 규칙들을 `precedes` 에 **정확한 id 로**
// 적어야 하고, 실제 충돌 쌍과 집합이 같아야 한다. 근거 문장도 그대로 요구한다 —
// 기계가 검사하는 것은 "적혀 있는가" 까지이고, "그 근거가 옳은가" 는 사람이 본다.
// 그래서 표본 상한을 없애고 **고유 충돌 체인 전부**를 산출물에 낸다.
const declaredPrecedes = new Map(map.rules.map(r => [r.id, new Set(r.precedes ?? [])]));
const actualPrecedes = new Map(map.rules.map(r => [r.id, new Set()]));
for (const pair of Object.keys(multiMatchPairs)) {
  const ids = pair.split(' > ');
  const winner = ids[0];
  for (const loser of ids.slice(1)) actualPrecedes.get(winner)?.add(loser);
}
for (const [id, actual] of actualPrecedes) {
  if (!actual.size) continue;
  const rule = map.rules.find(r => r.id === id);
  if (!rule?.순서근거) fail(`${id} : 순서 의존이 있는데 순서근거가 없다 — 배정의 근거가 규칙이 아니라 배치다`);
  const declared = declaredPrecedes.get(id) ?? new Set();
  // 근거가 **실제 충돌 규칙을 이름으로 대야** 한다. "포괄보다 앞선다" 같은 문장은 어느 포괄인지
  // 말하지 않아 검수할 대상이 안 잡힌다 (솔 `W1 R1 F04`).
  for (const l of actual) if (!String(rule?.순서근거 ?? '').includes(l))
    fail(`${id} : 순서근거가 ${l} 를 이름으로 대지 않는다 — 무엇을 이기는지 적지 않은 근거는 검수할 수 없다`);
  for (const l of actual) if (!declared.has(l)) fail(`${id} : ${l} 을 실제로 이기는데 precedes 에 없다 — 이긴 것을 적지 않으면 검수할 대상이 안 잡힌다`);
  for (const l of declared) if (!actual.has(l)) fail(`${id} : precedes 에 ${l} 이 있는데 실제 충돌이 없다 — 낡은 선언이다`);
}
for (const [id, declared] of declaredPrecedes) {
  if (declared.size && !(actualPrecedes.get(id) ?? new Set()).size)
    fail(`${id} : precedes 를 선언했는데 이 규칙이 이기는 충돌이 하나도 없다`);
}

// --- 축 교차 검증 (솔 `W1 R1 F03` · 페이블 재종결 조건 ④) --------------------
// 규칙이 스스로 적은 `axis` 를 믿지 않는다. 그 규칙이 **실제로 이긴 선언들**의 축을
// 측정 산출물에서 찾아 대조한다. 산문이 아니라 측정이 판정한다.
if (!axisArt) fail(`축 측정 산출물이 없다: ${axisPath} — 축 판정을 대조 없이 통과시키지 않는다`);
else if (axisArt.manifest?.auditCanon !== canonHash(audit))
  fail(`축 측정이 다른 감사 산출물에서 나왔다 — 축 ${String(axisArt.manifest?.auditCanon).slice(0, 12)} · 지금 ${canonHash(audit).slice(0, 12)}. 같은 입력으로 다시 재라 (바이트가 아니라 파싱한 JSON 의 정규형으로 대조한다 — 페이블 R6)`);
else if (!axisArt.manifest?.audit결속)
  fail('축 측정의 입력 감사에 결속이 없다 — 결속 없는 입력에서 잰 축은 남의 나무를 잰 값일 수 있다');
else {
  const axisOf = new Map((axisArt.perDecl ?? []).map(x => [x.key, x.axis]));
  const WANT = { vertical: 'V', horizontal: 'H', none: 'N' };
  for (const r of map.rules) {
    if (r.bin !== 'defect') continue;
    const keys = wonKeys[r.id] ?? [];
    if (!keys.length) continue;
    const missing = keys.filter(k => !axisOf.has(k));
    if (missing.length) { fail(`${r.id} : 이긴 선언 ${missing.length}건이 축 측정에 없다 — 예: ${missing[0]}`); continue; }
    const seen = new Set(keys.map(k => axisOf.get(k)));
    if (r.axis === 'derived') continue;                       // 값이 뒤 단계에서 파생되는 자리
    const want = WANT[r.axis];
    if (want) {
      const wrong = [...seen].filter(a => a !== want);
      if (wrong.length) fail(`${r.id} : axis 가 '${r.axis}' 인데 측정된 축은 ${[...seen].join('·')} 다 — 예: ${keys.find(k => axisOf.get(k) !== want)}`);
    } else if (r.axis === 'both') {
      if (seen.size === 1 && !seen.has('B'))
        fail(`${r.id} : axis 가 'both' 인데 측정된 축은 전부 ${[...seen][0]} 다 — 한 축이면 그렇게 적어라`);
    }
  }
}

// --- 완료 조건 -------------------------------------------------------------
const total = audit.declarations.length;
const assigned = Object.values(binCount).reduce((a, b) => a + b, 0);
// `at` 항목이 아무 선언에도 닿지 않으면 **줄 번호가 낡은 것**이다. W1 초판의 오염이 정확히
// 그렇게 숨었다 — 목록은 남의 나무의 줄 번호였고 아무도 그것을 검사하지 않았다.
{
  const seenAt = new Set();
  for (const d of audit.declarations) seenAt.add(`${d.file}:${d.line}:${d.prop}`);
  for (const r of map.rules) for (const a of r.match.at ?? []) {
    const parts = a.split(':');
    const prop = parts.length >= 3 && !/^\d+$/.test(parts[parts.length - 1]) ? parts.pop() : null;
    const ln = parts.pop();
    const f = parts.join(':');
    const ok = audit.declarations.some(d => d.file.endsWith(f) && String(d.line) === ln && (!prop || d.prop === prop));
    if (!ok) fail(`${r.id} : at 항목이 어느 선언에도 닿지 않는다 — ${a}. 줄 번호가 낡았거나 다른 나무에서 적은 것이다`);
  }
}
if (unmatched.length) fail(`미분류 ${unmatched.length}건 — 전수 배정이 아니다`);
if (assigned !== total) fail(`배정 합계 ${assigned} 이 선언 ${total} 과 다르다`);
if (binCount.approvedException !== 0) fail(`승인 예외 통이 ${binCount.approvedException}건 — W1 은 제안 단계다. 승인은 검수 뒤다`);
for (const r of map.rules) if (hit[r.id] === 0) fail(`${r.id} : 걸리는 선언이 0건 — 낡은 규칙이다`);

// --- 회차 간 통 이동 대차 (PRT-207) ---
// 배정을 바꾼 회차에서 "무엇이 어디로 갔는지" 를 손으로 쓰면 어긋난다. PRT-206 의 서술이
// 실제로 어긋났다. 이전 회차의 매핑표를 함께 주면 선언 단위로 대차를 내고, 그 합이
// 통 변화와 맞지 않으면 FAIL 한다 (페이블 검수 조건).
let ledger = null;
const prevMapPath = process.argv.slice(2).filter(a => !a.startsWith('--'))[4];
if (prevMapPath) {
  const prevMapBytes = readFileSync(resolve(prevMapPath));
  const prevMap = JSON.parse(prevMapBytes.toString('utf8'));
  const move = {};
  const prevBin = {}, nowBin = {};
  for (const d of audit.declarations) {
    const pr = prevMap.rules.find(rule => matches(rule, d));
    const nr = map.rules.find(rule => matches(rule, d));
    const from = pr ? pr.bin : '(미분류)', to = nr ? nr.bin : '(미분류)';
    prevBin[from] = (prevBin[from] || 0) + 1;
    nowBin[to] = (nowBin[to] || 0) + 1;
    if (from !== to) {
      const k = `${from} → ${to}`;
      (move[k] ??= { count: 0, rules: {} }).count++;
      const rk = `${pr ? pr.id : '-'} → ${nr ? nr.id : '-'}`;
      move[k].rules[rk] = (move[k].rules[rk] || 0) + 1;
    }
  }
  // 대차 검산: 각 통의 (이전 - 나간 것 + 들어온 것) 이 현재와 같아야 한다
  const recon = {};
  for (const b of BINS) {
    const out_ = Object.entries(move).filter(([k]) => k.startsWith(b + ' →')).reduce((a, [, v]) => a + v.count, 0);
    const in_ = Object.entries(move).filter(([k]) => k.endsWith('→ ' + b)).reduce((a, [, v]) => a + v.count, 0);
    const expected = (prevBin[b] || 0) - out_ + in_;
    recon[b] = { 이전: prevBin[b] || 0, 나감: out_, 들어옴: in_, 계산: expected, 실제: binCount[b] };
    if (expected !== binCount[b]) fail(`통 이동 대차 불일치 — ${b}: 이전 ${prevBin[b] || 0} - 나감 ${out_} + 들어옴 ${in_} = ${expected} 인데 실제는 ${binCount[b]}`);
  }
  ledger = { previousMap: basename(resolve(prevMapPath)), previousMapSha256: sha(prevMapBytes), moves: move, reconciliation: recon };
}

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
      '통': 'primitive · componentOwned · defect · pendingApproval · approvedException',
      '완료 조건': '선언 = 다섯 통의 합 · 미분류 0 · approvedException 0 · componentOwned 이름 필수 · axis!=none defect 목적지 기계 판독 및 delta 계산 일치 · pendingApproval 질문·증거 필수 · 걸리지 않는 규칙 0',
      '첫 일치': '규칙은 순서대로 평가하고 처음 일치한 것이 이긴다. 순서가 곧 우선순위다',
    },
  },
  summary: {
    status: failures.length ? 'FAIL' : 'PROPOSAL_COMPLETE',
    declarations: total,
    byBin: binCount,
    semantic통삭제사유: map.semanticNote ?? null,
    unmatchedCount: unmatched.length,
    unmatched: unmatched.slice(0, 50),
    multiMatchCount,
    multiMatchPairs,
    multiMatchSamples: multiMatch,
    binMovementLedger: ledger,
    openQuestions: map.rules.filter(r => r.bin === 'pendingApproval')
      .map(r => ({ id: r.id, question: r.question, declarations: hit[r.id], evidence: r.evidence, ownerDecision: r.ownerDecision ?? null })),
    perRule: map.rules.map(r => ({
      id: r.id, bin: r.bin, declarations: hit[r.id],
      name: r.name ?? null, target: r.target ?? null, openDecision: r.openDecision ?? null,
      executionStage: r.executionStage ?? null,
      axis: r.axis ?? null,
      targetSource: computedDirection[r.id]?.targetSource ?? null,
      declaredDelta: r.delta ?? null,
      computedDelta: computedDirection[r.id]?.computedDelta ?? null,
      targetResolved: computedDirection[r.id]?.resolved ?? 0,
      targetDerived: computedDirection[r.id]?.derived ?? 0,
      transitions: computedDirection[r.id]?.transitions ?? {},
      values: Object.entries(perRuleValues[r.id]).sort((a, b) => b[1] - a[1]).slice(0, 12),
    })),
    failures,
  },
};
writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ status: result.summary.status, byBin: binCount, unmatched: unmatched.length, multiMatch: multiMatchCount, failures }, null, 1));
if (unmatched.length) console.log('미분류 예시:', unmatched.slice(0, 10));
// FAIL 인데 종료 코드가 0 이면 단독 실행과 CI 체인이 성공으로 오인한다 (솔 검수 `W1 R1 F05`).
if (failures.length) process.exitCode = 1;
