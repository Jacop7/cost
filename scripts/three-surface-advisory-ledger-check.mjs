#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
const root = resolve(option('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const taskDir = resolve(root, 'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001');
const jsonPath = resolve(taskDir, 'advisory-ledger.json');
const mdPath = resolve(taskDir, 'advisory-ledger.md');

const git = (input) => spawnSync('git', ['-c', 'core.quotepath=false', ...input], { cwd: root, encoding: 'utf8' });
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const tableEscape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

function render(data) {
  const out = [
    '# 프로토타입·Expo 3표면 동기화 Opus 자문 Finding 장부', '',
    '> 성격: `OPUS_DIRECT_ADVISORY`의 기계 원본 JSON에서 생성한 projection이다.',
    '> Fable 판정이나 R2/R3 종결 증거가 아니다.',
  ];
  for (const round of data.rounds) out.push(`> ${round.id} target: \`${round.targetCommit}\` · ${round.verdict}`);
  out.push('', '| ID | 심각도 | 제기 회차 | 상태 | 처리 근거 | 검증 SHA |', '|---|---|---|---|---|---|');
  for (const item of data.findings) out.push(`| ${item.id} | ${item.severity} | ${item.raisedIn} | ${item.disposition} | ${tableEscape(item.resolution)} | \`${item.closingSha}\` |`);
  out.push('', `총 ${data.findings.length}건 · 완료 회차 ${data.rounds.length}개 · 최종 자문 ${data.finalVerdict}`, '');
  return out.join('\n');
}

if (flag('--migrate') || flag('--backfill-evidence')) throw new Error('일회성 장부 migration/backfill 쓰기 경로는 폐쇄됐다.');
if (!existsSync(jsonPath)) throw new Error('advisory-ledger.json이 없다.');
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const failures = [];
const fail = (message) => failures.push(message);
if (data.schemaVersion !== 1 || data.authority !== 'OPUS_DIRECT_ADVISORY' || data.scope !== 'PLAN_ONLY') fail('장부 header 계약이 다르다');
if (data.finalVerdict !== 'PASS') fail('최종 R9 자문 PASS가 기록되지 않았다');
const expectedRounds = Array.from({ length: 9 }, (_, index) => `R${index + 1}`);
if (JSON.stringify(data.rounds?.map((round) => round.id)) !== JSON.stringify(expectedRounds)) fail('R1~R9 회차가 연속으로 전부 보존되지 않았다');
const ids = new Set();
for (const item of data.findings ?? []) {
  if (ids.has(item.id)) fail(`중복 Finding ${item.id}`); ids.add(item.id);
  if (!['Blocking', 'Major', 'Minor'].includes(item.severity)) fail(`${item.id} 심각도 오류`);
  if (item.disposition !== 'closed' || !item.resolution) fail(`${item.id} 처리 또는 근거 누락`);
  if (!/^[0-9a-f]{40}$/.test(item.closingSha ?? '')) fail(`${item.id} closing SHA 누락`);
  else {
    const round = data.rounds?.find((candidate) => candidate.id === item.raisedIn);
    const exists = git(['cat-file', '-e', `${item.closingSha}^{commit}`]);
    const ancestor = git(['merge-base', '--is-ancestor', item.closingSha, 'HEAD']);
    if (exists.status !== 0 || ancestor.status !== 0) fail(`${item.id} closing SHA가 현재 이력의 검증 가능한 커밋이 아니다`);
    if (!round || git(['merge-base', '--is-ancestor', round.targetCommit, item.closingSha]).status !== 0 || round.targetCommit === item.closingSha) fail(`${item.id} closing SHA가 target 이후 커밋이 아니다`);
    if (!Array.isArray(item.evidencePaths) || item.evidencePaths.length === 0) fail(`${item.id} evidencePaths 누락`);
    else for (const path of item.evidencePaths) {
      const changed = git(['diff', '--name-only', `${round.targetCommit}..${item.closingSha}`, '--', path]);
      if (changed.status !== 0 || !changed.stdout.trim().split(/\r?\n/).includes(path)) fail(`${item.id} closing SHA가 evidencePath를 바꾸지 않았다: ${path}`);
    }
  }
}
for (const round of data.rounds ?? []) {
  if (!/^[0-9a-f]{40}$/.test(round.targetCommit ?? '')) fail(`${round.id} target SHA 오류`);
  const actual = data.findings.filter((item) => item.raisedIn === round.id).map((item) => item.id);
  if (JSON.stringify(actual) !== JSON.stringify(round.findings)) fail(`${round.id} Finding 목록 양방향 불일치`);
  if (round.verdict === 'PASS' && round.findings.length) fail(`${round.id} PASS에 Finding이 남았다`);
  if (round.verdict === 'CHANGES_REQUIRED' && !round.findings.length) fail(`${round.id} CHANGES_REQUIRED인데 Finding이 없다`);
  const roundItems = data.findings.filter((item) => item.raisedIn === round.id);
  const evidenceSets = new Set(roundItems.map((item) => JSON.stringify(item.evidencePaths)));
  const evidenceFloor = roundItems.length > 1 ? Math.max(2, Math.ceil(roundItems.length / 4)) : roundItems.length;
  if (evidenceSets.size < evidenceFloor) fail(`${round.id} evidencePaths provenance 집합 ${evidenceSets.size} < 최소 ${evidenceFloor}`);
}
const expectedMd = render(data);
const actualMd = readFileSync(mdPath, 'utf8').replaceAll('\r\n', '\n');
if (actualMd !== expectedMd && !flag('--write')) fail('advisory-ledger.md가 JSON projection과 다르다');
const actualJson = readFileSync(jsonPath, 'utf8');
if (readFileSync(jsonPath)[0] === 0xef || actualMd.includes('\r') || actualJson.includes('\r') || actualJson !== canonicalJson(data)) fail('장부 canonical JSON/byte 계약(BOM 없음·LF)이 깨졌다');
if (failures.length) { console.error(failures.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
if (flag('--write')) {
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  if (option('--expect-commit') !== head || !/^[0-9a-f]{40}$/.test(head)) throw new Error('--write는 --expect-commit=<현재 40자 SHA>가 필요하다.');
  if (!flag('--force')) throw new Error('--write는 --force가 필요하다.');
  if (git(['status', '--porcelain=v1', '--untracked-files=all']).stdout.trim()) throw new Error('--write는 clean worktree에서만 허용된다.');
  writeFileSync(mdPath, expectedMd);
}
console.log(`3표면 Opus 자문 장부 PASS — R1~R9 · Finding ${data.findings.length}건 · 최종 PASS (Fable 대체 아님)`);
