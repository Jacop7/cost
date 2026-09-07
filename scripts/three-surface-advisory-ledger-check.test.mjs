#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = resolve(fileURLToPath(new URL('./three-surface-advisory-ledger-check.mjs', import.meta.url)));
const root = mkdtempSync(join(tmpdir(), 'three-surface-ledger-'));
const taskDir = resolve(root, 'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001');
const jsonPath = resolve(taskDir, 'advisory-ledger.json'); const mdPath = resolve(taskDir, 'advisory-ledger.md');
const planPaths = ['docs/프로토타입-Expo-3표면-동기화-기획안.md', 'docs/프로토타입-Expo-3표면-동기화-세부실행서.md'];
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const put = (path, text) => { const full = resolve(root, path); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, text); };
const commit = (message) => { git(['add', '--all']); assert.equal(git(['-c', 'user.name=Ledger Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', message]).status, 0); return git(['rev-parse', 'HEAD']).stdout.trim(); };
const tableEscape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const render = (data) => {
  const out = ['# 프로토타입·Expo 3표면 동기화 Opus 자문 Finding 장부', '', '> 성격: `OPUS_DIRECT_ADVISORY`의 기계 원본 JSON에서 생성한 projection이다.', '> Fable 판정이나 R2/R3 종결 증거가 아니다.'];
  for (const round of data.rounds) out.push(`> ${round.id} target: \`${round.targetCommit}\` · ${round.verdict}`);
  out.push('', '| ID | 심각도 | 제기 회차 | 상태 | 처리 근거 | 검증 SHA |', '|---|---|---|---|---|---|');
  for (const item of data.findings) out.push(`| ${item.id} | ${item.severity} | ${item.raisedIn} | ${item.disposition} | ${tableEscape(item.resolution)} | \`${item.closingSha}\` |`);
  out.push('', `총 ${data.findings.length}건 · 완료 회차 ${data.rounds.length}개 · 최종 자문 ${data.finalVerdict}`, '');
  return out.join('\n');
};
const run = (args = []) => spawnSync(process.execPath, [checker, `--root=${root}`, ...args], { encoding: 'utf8' });
let passed = 0;
const expectFail = (message, args = []) => { const result = run(args); assert.notEqual(result.status, 0); assert.match(`${result.stdout}${result.stderr}`, message); passed += 1; };

try {
  git(['init']);
  for (const path of planPaths) put(path, '# target\n');
  const target = commit('target');
  for (const path of planPaths) put(path, '# closed\n');
  const closing = commit('closing');
  const findings = Array.from({ length: 8 }, (_, index) => ({ id: `F${index + 1}`, severity: 'Major', raisedIn: `R${index + 1}`,
    disposition: 'closed', resolution: 'fixed', closingSha: closing, evidencePaths: [planPaths[index % 2]] }));
  const rounds = Array.from({ length: 9 }, (_, index) => ({ id: `R${index + 1}`, targetCommit: target,
    verdict: index === 8 ? 'PASS' : 'CHANGES_REQUIRED', findings: index === 8 ? [] : [`F${index + 1}`] }));
  const originalData = { schemaVersion: 1, authority: 'OPUS_DIRECT_ADVISORY', scope: 'PLAN_ONLY', finalVerdict: 'PASS', rounds, findings };
  mkdirSync(taskDir, { recursive: true }); writeFileSync(jsonPath, canonical(originalData)); writeFileSync(mdPath, render(originalData));
  assert.equal(run().status, 0); passed += 1;
  const restore = () => { writeFileSync(jsonPath, canonical(originalData)); writeFileSync(mdPath, render(originalData)); };

  const oldClosing = structuredClone(originalData); oldClosing.findings[0].closingSha = target; writeFileSync(jsonPath, canonical(oldClosing)); writeFileSync(mdPath, render(oldClosing)); expectFail(/target 이후/); restore();
  const missingRound = structuredClone(originalData); missingRound.rounds.pop(); writeFileSync(jsonPath, canonical(missingRound)); writeFileSync(mdPath, render(missingRound)); expectFail(/R1~R9/); restore();
  writeFileSync(mdPath, `${readFileSync(mdPath, 'utf8')}manual\n`); expectFail(/projection/); restore();
  const badPath = structuredClone(originalData); badPath.findings[0].evidencePaths = ['docs/not-changed.md']; writeFileSync(jsonPath, canonical(badPath)); writeFileSync(mdPath, render(badPath)); expectFail(/evidencePath/); restore();
  const mismatched = structuredClone(originalData); mismatched.rounds[0].findings = []; writeFileSync(jsonPath, canonical(mismatched)); writeFileSync(mdPath, render(mismatched)); expectFail(/양방향 불일치/);
  restore();
  const constantEvidence = structuredClone(originalData);
  constantEvidence.findings[1].raisedIn = 'R1'; constantEvidence.findings[1].evidencePaths = constantEvidence.findings[0].evidencePaths;
  constantEvidence.rounds[0].findings.push('F2'); constantEvidence.rounds[1].findings = []; constantEvidence.rounds[1].verdict = 'PASS';
  writeFileSync(jsonPath, canonical(constantEvidence)); writeFileSync(mdPath, render(constantEvidence)); expectFail(/provenance 집합/); restore();
  const belowFloor = structuredClone(originalData);
  belowFloor.findings.push({ ...belowFloor.findings[0], id: 'F9' });
  for (const item of belowFloor.findings) { item.raisedIn = 'R1'; item.evidencePaths = [planPaths[Number(item.id.slice(1)) % 2]]; }
  for (const round of belowFloor.rounds) { round.findings = []; round.verdict = 'PASS'; }
  belowFloor.rounds[0].findings = belowFloor.findings.map((item) => item.id); belowFloor.rounds[0].verdict = 'CHANGES_REQUIRED';
  writeFileSync(jsonPath, canonical(belowFloor)); writeFileSync(mdPath, render(belowFloor)); expectFail(/최소 3/); restore();
  expectFail(/일회성/, ['--backfill-evidence']);
  expectFail(/일회성/, ['--migrate']);
  expectFail(/--expect-commit/, ['--write', '--force']);
  assert.equal(passed, 11);
  console.log(`three-surface advisory ledger 실행 음성 계약 ${passed}/11 PASS`);
} finally { rmSync(root, { recursive: true, force: true }); }
