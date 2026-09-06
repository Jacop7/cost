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
    `${kit}/templates/CHAT-MANIFEST.md`,
    `${kit}/templates/TEAM-ROUTER-POLICY.json`,
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
    `${kit}/templates/CHAT-MANIFEST.md`,
    `${kit}/templates/TEAM-ROUTER-POLICY.json`,
    `${kit}/adapters/README.md`,
  ].map(read).join('\n');
  assert.match(sources, /chat_is_approval_authority: false/);
  assert.match(sources, /운영 실행 권한/);
  assert.doesNotMatch(sources, /MarginCook|margincook|supabase_admin/i);
});

test('Chat Manifest v2는 15개 필드만 가지고 본문·승인 권한을 만들지 않는다', () => {
  const template = read(`${kit}/templates/CHAT-MANIFEST.md`).replace(/\r\n/g, '\n');
  const match = template.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  assert.ok(match);
  const fields = match[1].split('\n').map((line) => line.match(/^([a-z][a-z0-9_]*):/)?.[1]);
  assert.deepEqual(fields, [
    'chat_id', 'schema_version', 'accepts_from', 'sends_to', 'route_edges',
    'title', 'purpose', 'role_context_ids', 'input', 'output', 'authority_links',
    'allowed_routes', 'stop_conditions', 'handoff_in', 'handoff_out',
  ]);
  assert.equal(match[2].trim(), '');
  assert.doesNotMatch(template, /approval_authority|current_task|plugin_state|token_threshold/);
  const boundaryDocs = [
    `${kit}/README.md`, `${kit}/START-HERE.md`, `${kit}/CORE-CONTRACT.md`, `${kit}/adapters/README.md`,
  ].map(read).join('\n');
  assert.match(boundaryDocs, /exact title/);
  assert.match(boundaryDocs, /승인.*권한.*만들지 않/);
  assert.doesNotMatch(`${template}\n${boundaryDocs}`, /MarginCook|margincook|SOLAR-ORCH|Supabase|supabase_admin/);
});
