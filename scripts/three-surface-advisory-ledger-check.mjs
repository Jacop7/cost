#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const option = (name) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
const root = resolve(option('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const taskDir = resolve(root, 'docs/ai-review/tasks/PROTOTYPE-EXPO-THREE-SURFACE-001');
const jsonPath = resolve(taskDir, 'advisory-ledger.json');
const mdPath = resolve(taskDir, 'advisory-ledger.md');
const args = new Set(argv);
const closingByRound = {
  R1: '9da4e43559ce2d953652c7b279d7584365e3a519',
  R2: '9da4e43559ce2d953652c7b279d7584365e3a519',
  R3: '08741ab5f0fc1e6ca93b8d2a1dabaa75d6553b1d',
  R4: 'a02dec70b273e8db692f483b62bc5fbd18f9144b',
  R5: '776e7141cb620222e8d7015c90b65d8a2cc795b3',
  R6: '6912a5ac7355237459126ffea41a1860e66f0d33',
  R7: '7fb0ec2d51e2722bdbc08ed33b449d49e5dfc19e',
  R8: '72821f4029fd564ec0d41024b8212065b13caf04',
};

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

function migrate() {
  const source = readFileSync(mdPath, 'utf8').replaceAll('\r\n', '\n');
  const targets = new Map([...source.matchAll(/^> (R\d+) target: `([0-9a-f]{40})`/gm)].map((match) => [match[1], match[2]]));
  targets.set('R9', '72821f4029fd564ec0d41024b8212065b13caf04');
  const findings = [];
  for (const line of source.split('\n')) {
    const match = line.match(/^\| ([^|]+) \| ([^|]+) \| (R\d+) \| fixed \| (.*?) \| .*? \|$/);
    if (!match) continue;
    findings.push({ id: match[1].trim(), severity: match[2].trim(), raisedIn: match[3], disposition: 'closed', resolution: match[4].trim(), closingSha: closingByRound[match[3]],
      evidencePaths: ['docs/프로토타입-Expo-3표면-동기화-기획안.md', 'docs/프로토타입-Expo-3표면-동기화-세부실행서.md'] });
  }
  const rounds = [...targets].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([id, targetCommit]) => ({
    id, targetCommit, verdict: id === 'R9' ? 'PASS' : 'CHANGES_REQUIRED',
    findings: findings.filter((item) => item.raisedIn === id).map((item) => item.id),
  }));
  const data = { schemaVersion: 1, authority: 'OPUS_DIRECT_ADVISORY', scope: 'PLAN_ONLY', finalVerdict: 'PASS', rounds, findings };
  writeFileSync(jsonPath, canonicalJson(data));
  writeFileSync(mdPath, render(data));
}

if (args.has('--migrate')) migrate();
if (!existsSync(jsonPath)) throw new Error('advisory-ledger.json이 없다. --migrate로 기존 장부를 한 번 변환하라.');
if (args.has('--backfill-evidence')) {
  const source = JSON.parse(readFileSync(jsonPath, 'utf8'));
  source.findings = source.findings.map((item) => ({ ...item, evidencePaths: [
    'docs/프로토타입-Expo-3표면-동기화-기획안.md',
    'docs/프로토타입-Expo-3표면-동기화-세부실행서.md',
  ] }));
  writeFileSync(jsonPath, canonicalJson(source));
  writeFileSync(mdPath, render(source));
}
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
}
const expectedMd = render(data);
const actualMd = readFileSync(mdPath, 'utf8').replaceAll('\r\n', '\n');
if (actualMd !== expectedMd) fail('advisory-ledger.md가 JSON projection과 다르다');
const actualJson = readFileSync(jsonPath, 'utf8');
if (readFileSync(jsonPath)[0] === 0xef || actualMd.includes('\r') || actualJson.includes('\r') || actualJson !== canonicalJson(data)) fail('장부 canonical JSON/byte 계약(BOM 없음·LF)이 깨졌다');
if (args.has('--write')) writeFileSync(mdPath, expectedMd);
if (failures.length) { console.error(failures.map((item) => `  - ${item}`).join('\n')); process.exit(1); }
console.log(`3표면 Opus 자문 장부 PASS — R1~R9 · Finding ${data.findings.length}건 · 최종 PASS (Fable 대체 아님)`);
