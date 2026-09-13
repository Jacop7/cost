import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const forbidden = /MarginCook|margincook|MARGINCOOK|마진쿡/g;
const extensions = /\.(?:json|md|mjs|js|ts|tsx|html|toml|ya?ml)$/;

const roots = [
  'apps/mobile/src',
  'apps/mobile/tests',
  'packages/core',
  'packages/types',
  'packages/db/src',
  'scripts/appmap',
  '.github/workflows',
];
const files = [
  'package.json',
  'apps/mobile/package.json',
  'packages/core/package.json',
  'packages/db/package.json',
  'packages/types/package.json',
  'pnpm-lock.yaml',
  'tsconfig.base.json',
  'packages/db/supabase/config.toml',
  'docs/AI-오케스트레이션-상세기획안.md',
  'docs/AI-지식-온톨로지-기획안.md',
  'docs/AI-품질-학습-자율성-평가기획안.md',
  'docs/디렉터리-문서신경망-재설계-기획안.md',
  'docs/팀구성_상세기획안.md',
  'docs/브랜치-DB-운영-기획안.md',
  'docs/operations/cron-rpc-alerting.md',
  'docs/프로토타입-Expo-3표면-동기화-세부실행서.md',
];

function walk(path) {
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const child = join(path, name);
    if (statSync(child).isDirectory()) walk(child);
    else if (extensions.test(name)) files.push(relative(root, child));
  }
}
for (const path of roots) walk(join(root, path));

const failures = [];
for (const path of [...new Set(files)].sort()) {
  const text = readFileSync(join(root, path), 'utf8');
  const matches = [...text.matchAll(forbidden)].map(match => match[0]);
  if (matches.length) failures.push(`${path}: ${[...new Set(matches)].join(', ')}`);
}

const app = JSON.parse(readFileSync(join(root, 'apps/mobile/app.json'), 'utf8')).expo;
for (const [field, actual, expected] of [
  ['name', app.name, '코스트킵'],
  ['slug', app.slug, 'costkeep'],
  ['scheme', app.scheme, 'costkeep'],
  ['ios.bundleIdentifier', app.ios?.bundleIdentifier, 'com.jacop7223.costkeep'],
  ['android.package', app.android?.package, 'com.jacop7223.costkeep'],
]) if (actual !== expected) failures.push(`apps/mobile/app.json ${field}: ${actual} != ${expected}`);

if (failures.length) {
  console.error('Costkeep 현재 계약에 이전 브랜드 이름이 남았습니다.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Costkeep 현재 계약 통과 — 활성 파일 ${new Set(files).size}개와 앱 표시·네이티브 ID 설정 확인`);
}
