import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const kit = 'docs/ai-team-starter-kit';
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('v0.5 스타터 키트는 공통 core와 adapter 경계를 제공한다', () => {
  const required = [
    `${kit}/README.md`,
    `${kit}/START-HERE.md`,
    `${kit}/CORE-CONTRACT.md`,
    `${kit}/templates/TASK-PACKET.md`,
    `${kit}/templates/HANDOFF.md`,
    `${kit}/templates/ROLE-CONTEXT.md`,
    `${kit}/templates/TEAM-MANIFEST.md`,
    `${kit}/adapters/README.md`,
  ];
  for (const path of required) assert.match(read(path), /\S/, `${path}가 비어 있습니다.`);
  assert.match(read(`${kit}/CORE-CONTRACT.md`), /공통 core/);
  assert.match(read(`${kit}/adapters/README.md`), /특정 CI, DB, 배포/);
});

test('v0.5 스타터 키트는 승인·운영 권한과 프로젝트 고유값을 만들지 않는다', () => {
  const sources = [
    `${kit}/README.md`,
    `${kit}/CORE-CONTRACT.md`,
    `${kit}/templates/TEAM-MANIFEST.md`,
    `${kit}/adapters/README.md`,
  ].map(read).join('\n');
  assert.match(sources, /chat_is_approval_authority: false/);
  assert.match(sources, /운영 실행 권한/);
  assert.doesNotMatch(sources, /MarginCook|margincook|supabase_admin/i);
});
