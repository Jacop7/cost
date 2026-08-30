import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const has = (needle) => assert.ok(workflow.includes(needle), `verify.yml 계약 누락: ${needle}`);

has("node: ['20.19.4', 24]");
has('full-db-required:');
has('name: full-db-required');
has('pnpm --filter @margincook/db start');
has('bash packages/db/scripts/admin-acl.sh --local postgres fix');
has('bash packages/db/scripts/admin-acl.sh --local postgres check');
has('run: pnpm verify\n');
has('protected-gate:');
has('needs: [verify, full-db-required]');
has('if: always()');
has('name: protected-gate');
has('node scripts/protected-gate-validator.mjs --ci --output protected-gate-evidence.json');
has('name: protected-gate-${{ github.sha }}');
assert.ok(!workflow.includes('pull_request:'), '같은 SHA에 중복 check를 만드는 pull_request 트리거를 두지 않습니다.');
assert.ok(workflow.indexOf('pnpm --filter @margincook/db start') < workflow.indexOf('run: pnpm verify\n', workflow.indexOf('full-db-required:')), 'Supabase 시작이 전체 검증보다 먼저여야 합니다.');
assert.ok(workflow.indexOf('admin-acl.sh --local postgres check') < workflow.indexOf('run: pnpm verify\n', workflow.indexOf('full-db-required:')), '개발 DB ACL 정규화가 전체 검증보다 먼저여야 합니다.');

console.log('CI 필수 게이트 계약 통과');
