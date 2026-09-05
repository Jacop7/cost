#!/usr/bin/env node
/** S2 정적 기하 게이트 — 기준 SHA와 현재의 기하 선언을 AST/선언 단위로 대조한다. */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const opt = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith('--')).map(x => {
  const i = x.indexOf('='); return i < 0 ? [x.slice(2), ''] : [x.slice(2, i), x.slice(i + 1)];
}));
const root = resolve(opt.root ?? fileURLToPath(new URL('..', import.meta.url)));
const baselineCommit = opt.baseline ?? '83f7ba438b2bbdf6ceb11014dcd5366ed67b2223';
const appRel = (opt['app-rel'] ?? 'apps/mobile').replaceAll('\\', '/');
const protoRel = (opt['prototype-rel'] ?? 'docs/prototypes/0_full-page-flow-prototype-ui-applied.html').replaceAll('\\', '/');
const baselineRoot = opt['baseline-root'] ? resolve(opt['baseline-root']) : null;
const outPath = opt.out ? resolve(opt.out) : null;
const PROPS = /^(?:fontSize|lineHeight|letterSpacing|padding(?:Top|Right|Bottom|Left|Horizontal|Vertical)?|margin(?:Top|Right|Bottom|Left|Horizontal|Vertical)?|gap|rowGap|columnGap|width|minWidth|maxWidth|height|minHeight|maxHeight|borderRadius|borderWidth|top|right|bottom|left)$/;
const CSS_PROPS = /^(?:font-size|line-height|letter-spacing|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|gap|row-gap|column-gap|width|min-width|max-width|height|min-height|max-height|border-radius|border-width|top|right|bottom|left)$/;
const norm = s => s.replace(/\s+/g, ' ').trim();

const listFs = (base) => {
  const out = [];
  const walk = d => { for (const n of readdirSync(d)) { if (n === 'node_modules') continue; const p=join(d,n), st=statSync(p); if(st.isDirectory()) walk(p); else if(/\.(?:ts|tsx)$/.test(n)) out.push(relative(base,p).replaceAll('\\','/')); } };
  if (existsSync(base)) walk(base); return out.sort();
};
const git = (args) => { const r=spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:50_000_000}); if(r.status!==0) throw new Error(r.stderr||r.stdout); return r.stdout; };
const currentFiles = listFs(resolve(root, appRel)).map(x => `${appRel}/${x}`);
const baselineFiles = baselineRoot
  ? listFs(resolve(baselineRoot, appRel)).map(x => `${appRel}/${x}`)
  : git(['ls-tree','-r','--name-only',baselineCommit,'--',appRel]).trim().split(/\r?\n/).filter(x=>/\.(?:ts|tsx)$/.test(x));
const readCurrent = rel => readFileSync(resolve(root, rel), 'utf8');
const readBaseline = rel => baselineRoot ? readFileSync(resolve(baselineRoot, rel), 'utf8') : git(['show',`${baselineCommit}:${rel}`]);

const appInventory = (src, file) => {
  const sf=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS); const rows=[];
  const inShadowOffset = n => { for (let p=n.parent; p; p=p.parent) if (ts.isPropertyAssignment(p) && p.name.getText(sf).replace(/^['"]|['"]$/g,'') === 'shadowOffset') return true; return false; };
  const visit=n=>{ if(ts.isPropertyAssignment(n)){ const name=n.name.getText(sf).replace(/^['"]|['"]$/g,''); if(PROPS.test(name) && !inShadowOffset(n)) rows.push(`${name}:${norm(n.initializer.getText(sf))}`); } ts.forEachChild(n,visit); };
  visit(sf); return rows;
};
const cssInventory = src => {
  const rows=[]; const re=/([A-Za-z-]+)\s*:\s*([^;{}"']+)/g; let m;
  while((m=re.exec(src))) if(CSS_PROPS.test(m[1])) rows.push(`${m[1]}:${norm(m[2])}`);
  return rows;
};
const failures=[]; let declarations=0;
for(const file of new Set([...baselineFiles,...currentFiles])){
  if(!baselineFiles.includes(file)){ failures.push(`${file} — 기준선 뒤 새 파일`); continue; }
  if(!currentFiles.includes(file)){ failures.push(`${file} — 기준선 파일 삭제`); continue; }
  const before=appInventory(readBaseline(file),file), now=appInventory(readCurrent(file),file); declarations+=now.length;
  if(JSON.stringify(before)!==JSON.stringify(now)) failures.push(`${file} — 기하 선언 변경 (${before.length}→${now.length})`);
}
const protoBefore=cssInventory(readBaseline(protoRel)), protoNow=cssInventory(readCurrent(protoRel)); declarations+=protoNow.length;
if(JSON.stringify(protoBefore)!==JSON.stringify(protoNow)) failures.push(`${protoRel} — CSS 기하 선언 변경 (${protoBefore.length}→${protoNow.length})`);
const result={schemaVersion:1,baseline:baselineRoot?'fixture':baselineCommit,geometryDeclarations:declarations,failures};
if(outPath) writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
console.log(`S2 기하 diff — ${declarations}개 선언`);
if(failures.length){ console.error(failures.map(x=>`  - ${x}`).join('\n')); process.exit(1); }
console.log('S2 기하 diff PASS');
