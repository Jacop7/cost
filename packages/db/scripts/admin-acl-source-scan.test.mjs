import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanMobileRpcNames } from './admin-acl-source-scan.mjs';

let passed = 0;

function ok(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function fixture(files, { includeApp = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sikjae-acl-source-'));
  const src = join(root, 'src');
  const app = join(root, 'app');
  mkdirSync(src);
  if (includeApp) mkdirSync(app);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(src, name), body, 'utf8');
  return { root, roots: [src, app] };
}

function withFixture(files, fn, options) {
  const value = fixture(files, options);
  try { fn(value); } finally { rmSync(value.root, { recursive: true, force: true }); }
}

function expectFailure(files, pattern, options) {
  withFixture(files, ({ roots }) => {
    let message = '';
    try { scanMobileRpcNames(roots); } catch (error) { message = error instanceof Error ? error.message : String(error); }
    if (!pattern.test(message)) throw new Error(`기대 오류와 다릅니다: ${message || '(오류 없음)'}`);
  }, options);
}

ok('정적 RPC 리터럴을 수집한다', () => withFixture(
  { 'literal.ts': `client.rpc('business_day_state');\nclient.rpc('get_settings');\n` },
  ({ roots }) => {
    const names = [...scanMobileRpcNames(roots)].sort();
    if (names.join(',') !== 'business_day_state,get_settings') throw new Error(`관측=${names.join(',')}`);
  },
));
ok('구조 분해 rpc 별칭을 거부한다', () => expectFailure(
  { 'destructure.ts': `const { rpc } = client; rpc('business_day_state');\n` },
  /리터럴이 아닌 \.rpc 이름/,
));
ok('이름을 바꾼 구조 분해 rpc 별칭도 거부한다', () => expectFailure(
  { 'destructure-alias.ts': `const { rpc: call } = client; call('business_day_state');\n` },
  /리터럴이 아닌 \.rpc 이름/,
));
ok('client 계산 키 호출을 거부한다', () => expectFailure(
  { 'computed.ts': `const key = 'rpc'; client[key]('business_day_state');\n` },
  /리터럴이 아닌 \.rpc 이름/,
));
ok('일반 객체의 계산 키 호출은 RPC로 오인하지 않는다', () => withFixture(
  { 'handler.ts': `const key = 'save'; handlers[key]();\nclient.rpc('get_settings');\n` },
  ({ roots }) => {
    const names = [...scanMobileRpcNames(roots)];
    if (names.join(',') !== 'get_settings') throw new Error(`관측=${names.join(',')}`);
  },
));
ok('필수 모바일 루트 누락을 경로와 함께 진단한다', () => expectFailure(
  { 'literal.ts': `client.rpc('get_settings');\n` },
  /모바일 소스 루트가 없습니다: .*app/,
  { includeApp: false },
));

if (process.exitCode) process.exit(process.exitCode);
console.log(`admin-acl 소스 스캔 회귀시험 ${passed}/${passed} 통과`);
