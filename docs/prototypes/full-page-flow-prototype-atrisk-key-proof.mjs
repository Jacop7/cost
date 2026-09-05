// atRisk 기준선 키 교체가 실제로 데이터를 되살렸는지 증명한다.
//
// PRT-199 는 키에 hostIndex 를 넣었고, PRT-201 은 "형제 host 하나만 악화시켜도 FAIL" 을 보였다.
// 페이블이 그것으로는 절반이라고 지적했다 — "옛 키였다면 통과했을 것" 은 추론이지 실행이 아니다.
// 이 스크립트는 두 키 스킴을 나란히 돌려 거짓 음성을 **재현**한다.
//
// 내는 것:
//   rows            원시 atRisk 행 수
//   oldUniqueKeys   pass|target|selector 로 접었을 때 남는 칸 수 (데이터 손실의 직접 증거)
//   newUniqueKeys   pass|target|selector|hostIndex 로 접었을 때 남는 칸 수 (= rows 여야 한다)
//   worsening       가장 크게 겹치던 묶음에서 '옛 키에서 이기지 못하던' 행 하나만 악화시킨 뒤
//                   두 스킴이 각각 어떤 판정을 내는지. old=PASS 이고 new=FAIL 이어야 증명이 선다.
//   deletion        atRisk 행 하나를 지웠을 때 두 규칙(사라짐=NOTE / 사라짐=FAIL)이 내는 판정.
//                   숨김을 개선으로 세지 않는지 본다.
//
// 이 스크립트는 DOM 을 재지 않는다. 보존된 i18n-stress.json 을 입력으로 삼고,
// manifest 로 그 파일·적용본·동기화 ID 에 스스로를 묶는다.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { textSha256 } from './full-page-flow-prototype-text-sha256.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const stressPath = resolve(args[0] ?? 'docs/prototypes/full-page-flow-prototype-i18n-stress.json');
const knownPath  = resolve(args[1] ?? 'docs/prototypes/full-page-flow-prototype-i18n-known.json');
const outPath    = resolve(args[2] ?? 'docs/prototypes/full-page-flow-prototype-atrisk-key-proof.json');

const stressBytes = readFileSync(stressPath);
const knownBytes  = readFileSync(knownPath);
const stress = JSON.parse(stressBytes.toString('utf8'));
const known  = JSON.parse(knownBytes.toString('utf8'));
const selfBytes = readFileSync(new URL(import.meta.url));

const PASSES = ['w130', 'w150'];
const rows = [];
for (const p of PASSES) for (const r of stress.summary.stretch[p].atRisk) rows.push({ pass: p, ...r });

const oldKey = (r) => `${r.pass}|${r.target}|${r.sel}`;
const newKey = (r) => `${r.pass}|${r.target}|${r.sel}|${r.hostIndex}`;

// 두 스킴의 기준선을 각각 만든다. 옛 스킴은 마지막에 쓰인 값이 이긴다 — 그게 당시 동작이다.
const fold = (keyFn, list) => { const m = new Map(); for (const r of list) m.set(keyFn(r), r.missing); return m; };
const oldBase = fold(oldKey, rows);
const newBase = fold(newKey, rows);

// 게이트의 대조 규칙을 그대로 옮긴다. 관측이 기준선보다 0.5px 넘게 크면 악화다.
//
// 중요 — 관측 쪽도 **기준선과 같은 키로 접은 뒤** 비교해야 한다. 게이트가 그렇게 동작했다:
// `$observed[$key] = $r.missing` 은 같은 키의 앞 행을 덮어쓴다. 원시 행을 접힌 기준선에
// 그대로 대면 옛 스킴이 실제보다 훨씬 엄격해 보이고, 거짓 음성 재현 자체가 거짓이 된다.
const judge = (keyFn, base, list, { failOnGone }) => {
  const failures = [];
  const observed = fold(keyFn, list);
  for (const [k, v] of observed) {
    if (!base.has(k)) { failures.push(`알려지지 않은 atRisk — ${k}`); continue; }
    if (v > base.get(k) + 0.5) failures.push(`악화 — ${k} ${base.get(k)} → ${v}`);
  }
  for (const k of base.keys()) if (!observed.has(k)) {
    if (failOnGone) failures.push(`사라짐 — ${k} (숨김인지 개선인지 명시되지 않음)`);
  }
  return { verdict: failures.length ? 'FAIL' : 'PASS', failures };
};

// --- 충돌 묶음 ---
const groups = new Map();
for (const r of rows) { const k = oldKey(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
const collided = [...groups.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
const collisions = rows.length - groups.size;

// --- 악화 시험 ---
// 가장 큰 묶음에서 '옛 스킴의 마지막 승자' 가 아닌 행을 고른다. 그 행이 나빠져도 옛 스킴은 모른다.
const [bigKey, bigRows] = collided[0];
const oldWinner = bigRows[bigRows.length - 1];
const victim = bigRows.reduce((a, b) => (a.missing >= b.missing ? a : b)); // 부족 폭이 가장 큰 행
const worsenedRows = rows.map(r => (r === victim ? { ...r, missing: Math.round((r.missing + 5) * 10) / 10 } : r));
const worsening = {
  group: bigKey,
  groupSize: bigRows.length,
  hostIndexes: bigRows.map(r => r.hostIndex),
  missingValues: bigRows.map(r => r.missing),
  oldSchemeStoredValue: oldWinner.missing,
  victimHostIndex: victim.hostIndex,
  victimMissing: victim.missing,
  victimMissingAfter: Math.round((victim.missing + 5) * 10) / 10,
  old: judge(oldKey, oldBase, worsenedRows, { failOnGone: false }),
  new: judge(newKey, newBase, worsenedRows, { failOnGone: false }),
};

// --- 삭제 시험 ---
// 행이 사라지는 것은 개선일 수도, overflow:hidden 으로 숨긴 것일 수도 있다.
// 게이트가 사라짐을 통과로 세면 숨김이 개선으로 기록된다.
const deletedRows = rows.filter(r => r !== victim);
const deletion = {
  deletedKey: newKey(victim),
  goneIsNote: judge(newKey, newBase, deletedRows, { failOnGone: false }),
  goneIsFail: judge(newKey, newBase, deletedRows, { failOnGone: true }),
};

const knownCount = Object.keys(known.entries).length;
const resolvedCount = Object.keys(known.resolved ?? {}).length;
const knownActiveCount = knownCount - resolvedCount;
const result = {
  manifest: {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    script: { name: basename(new URL(import.meta.url).pathname), sha256: textSha256(selfBytes) },
    source: {
      stress: { path: basename(stressPath), sha256: textSha256(stressBytes) },
      known: { path: basename(knownPath), sha256: textSha256(knownBytes) },
    },
    target: {
      sha256: stress.manifest.target.sha256,
      designSyncId: stress.manifest.target.designSyncId,
    },
    rules: {
      '옛 키': 'pass|target|selector — PRT-199 이전. 같은 selector 의 형제 host 가 한 칸을 공유하고 마지막에 쓰인 값이 이긴다',
      '새 키': 'pass|target|selector|hostIndex — host 의 DOM 순서 색인을 붙여 유일하게 만든다',
      '악화 판정': '관측 부족 폭이 기준선보다 0.5px 넘게 크면 FAIL. 게이트와 같은 규칙',
      '삭제 판정': '기준선에 있는 키가 관측에 없을 때. failOnGone=false 는 통과(현행), true 는 FAIL(제안)',
    },
  },
  summary: {
    rows: rows.length,
    oldUniqueKeys: groups.size,
    newUniqueKeys: new Set(rows.map(newKey)).size,
    collisions,
    collidedGroups: collided.length,
    knownEntries: knownCount,
    knownResolvedEntries: resolvedCount,
    knownActiveEntries: knownActiveCount,
    largestCollidedGroups: collided.slice(0, 5).map(([k, v]) => ({ key: k, size: v.length, missing: v.map(r => r.missing) })),
    worsening,
    deletion,
    assertions: {
      '새 키는 유일하다': new Set(rows.map(newKey)).size === rows.length,
      '옛 키는 행을 잃었다': groups.size < rows.length,
      '활성 기준선은 원시 행 수와 같다': knownActiveCount === rows.length,
      '옛 스킴은 악화를 놓친다': worsening.old.verdict === 'PASS',
      '새 스킴은 악화를 잡는다': worsening.new.verdict === 'FAIL',
      '사라짐을 NOTE 로 두면 삭제가 통과한다': deletion.goneIsNote.verdict === 'PASS',
      '사라짐을 FAIL 로 두면 삭제가 잡힌다': deletion.goneIsFail.verdict === 'FAIL',
    },
  },
};
result.summary.allAssertionsHold = Object.values(result.summary.assertions).every(Boolean);
writeFileSync(outPath, JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result.summary, null, 1));
