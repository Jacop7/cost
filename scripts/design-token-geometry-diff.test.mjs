import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gate=fileURLToPath(new URL('./design-token-geometry-diff.mjs',import.meta.url));
const run=edit=>{ const d=mkdtempSync(join(tmpdir(),'geometry-')), base=join(d,'base'), cur=join(d,'cur'); try{
  for(const r of [base,cur]){ mkdirSync(join(r,'apps/mobile'),{recursive:true}); mkdirSync(join(r,'docs/prototypes'),{recursive:true}); }
  const tsx=`const s={fontSize:14,paddingHorizontal:12,width:40,color:'#3182F6'};`;
  const html=`<style>.x{height:44px;margin:4px;color:#3182F6}</style>`;
  writeFileSync(join(base,'apps/mobile/A.tsx'),tsx); writeFileSync(join(base,'docs/prototypes/0_full-page-flow-prototype-ui-applied.html'),html);
  writeFileSync(join(cur,'apps/mobile/A.tsx'),edit?.tsx??tsx); writeFileSync(join(cur,'docs/prototypes/0_full-page-flow-prototype-ui-applied.html'),edit?.html??html);
  return spawnSync(process.execPath,[gate,`--root=${cur}`,`--baseline-root=${base}`],{encoding:'utf8'});
} finally{rmSync(d,{recursive:true,force:true});}};
test('색만 바뀌면 통과한다',()=>assert.equal(run({tsx:`const s={fontSize:14,paddingHorizontal:12,width:40,color:'#1470F5'};`,html:`<style>.x{height:44px;margin:4px;color:#1470F5}</style>`}).status,0));
test('앱 padding 변경을 잡는다',()=>assert.equal(run({tsx:`const s={fontSize:14,paddingHorizontal:16,width:40,color:'#3182F6'};`}).status,1));
test('프로토타입 height 변경을 잡는다',()=>assert.equal(run({html:`<style>.x{height:48px;margin:4px;color:#3182F6}</style>`}).status,1));
test('fontSize 변경을 잡는다',()=>assert.equal(run({tsx:`const s={fontSize:16,paddingHorizontal:12,width:40,color:'#3182F6'};`}).status,1));
