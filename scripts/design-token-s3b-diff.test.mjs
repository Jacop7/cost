import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gate = fileURLToPath(new URL('./design-token-s3b-diff.mjs', import.meta.url));
const tokens = `export const TYPE={captionSm:{fontSize:13,lineHeight:18}} as const;\nexport const space={xs:4,sm:8,md:12,lg:16,xl:20,xxl:24} as const;\nexport const radius={sm:8,md:12,lg:16,xl:20,full:999} as const;\nexport const controlVisualHeight={sm:32,md:38} as const;\n`;
const run = (edit, touchAdjustments = [], mutateKnown = () => {}) => {
  const dir = mkdtempSync(join(tmpdir(), 's3b-')), base = join(dir, 'base'), cur = join(dir, 'cur');
  try {
    for (const root of [base, cur]) { mkdirSync(join(root, 'apps/mobile/src/theme'), { recursive: true }); mkdirSync(join(root, 'docs/prototypes'), { recursive: true }); }
    const before = `const x={paddingHorizontal:6,fontSize:12,color:'#000'};\nconst y=<Pressable hitSlop={5}/>;`;
    const after = edit ?? `import {space,TYPE} from './theme/tokens';\nconst x={paddingHorizontal:space.sm,fontSize:TYPE.captionSm.fontSize,color:'#000'};\nconst y=<Pressable hitSlop={5}/>;`;
    writeFileSync(join(base, 'apps/mobile/src/A.tsx'), before); writeFileSync(join(cur, 'apps/mobile/src/A.tsx'), after);
    writeFileSync(join(base, 'apps/mobile/src/theme/tokens.ts'), tokens); writeFileSync(join(cur, 'apps/mobile/src/theme/tokens.ts'), tokens);
    writeFileSync(join(base, 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html'), '<style>.x{height:44px}</style>');
    writeFileSync(join(cur, 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html'), '<style>.x{height:44px}</style>');
    const known = { baselineCommit: 'fixture', assignments: 2, files: 1,
      byRule: { A: 1, B: 1 },
      tokenContract: { space: { xs:4,sm:8,md:12,lg:16,xl:20,xxl:24 }, radius:{sm:8,md:12,lg:16,xl:20,full:999}, TYPE:{captionSm:{fontSize:13,lineHeight:18}}, controlVisualHeight:{sm:32,md:38} },
      assignmentPlan: [
        { key:'apps/mobile/src/A.tsx:1:paddingHorizontal', rule:'A', current:6, target:8, axis:'H', expression:'space.sm' },
        { key:'apps/mobile/src/A.tsx:1:fontSize', rule:'B', current:12, target:13, axis:'B', expression:'TYPE.captionSm.fontSize' },
      ], touchAdjustments };
    mutateKnown(known);
    const knownPath = join(dir, 'known.json'); writeFileSync(knownPath, JSON.stringify(known));
    return spawnSync(process.execPath, [gate, `--root=${cur}`, `--baseline-root=${base}`, `--known=${knownPath}`], { encoding:'utf8' });
  } finally { rmSync(dir, { recursive:true, force:true }); }
};
test('승인된 두 치환만 있으면 통과한다', () => assert.equal(run().status, 0));
test('승인 목적지 대신 다른 토큰을 쓰면 실패한다', () => assert.equal(run(`import {space,TYPE} from './theme/tokens';\nconst x={paddingHorizontal:space.md,fontSize:TYPE.captionSm.fontSize,color:'#000'};`).status, 1));
test('승인되지 않은 기하 변경을 함께 넣으면 실패한다', () => assert.equal(run(`import {space,TYPE} from './theme/tokens';\nconst x={paddingHorizontal:space.sm,fontSize:TYPE.captionSm.fontSize,width:40,color:'#000'};`).status, 1));
test('승인된 hitSlop 보정은 통과한다', () => assert.equal(run(
  `import {space,TYPE} from './theme/tokens';\nconst x={paddingHorizontal:space.sm,fontSize:TYPE.captionSm.fontSize,color:'#000'};\nconst y=<Pressable hitSlop={6}/>;`,
  [{ key:'apps/mobile/src/A.tsx:2:hitSlop', before:'5', after:'6' }],
).status, 0));
test('승인되지 않은 hitSlop 변경은 실패한다', () => assert.equal(run(
  `import {space,TYPE} from './theme/tokens';\nconst x={paddingHorizontal:space.sm,fontSize:TYPE.captionSm.fontSize,color:'#000'};\nconst y=<Pressable hitSlop={6}/>;`,
).status, 1));
test('계획 current가 실제 기준선 리터럴과 다르면 실패한다', () => assert.equal(run(
  undefined, [], known => { known.assignmentPlan[0].current = 5; },
).status, 1));
test('계획 target이 토큰 표현식의 실제 값과 다르면 실패한다', () => assert.equal(run(
  undefined, [], known => { known.assignmentPlan[0].target = 9; },
).status, 1));
test('S3b에 축소 계획을 넣으면 실패한다', () => assert.equal(run(
  undefined, [], known => { known.assignmentPlan[0].current = 9; },
).status, 1));
