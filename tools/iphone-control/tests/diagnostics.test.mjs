import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { PIN, parseDeviceList, probeDevices, diagnosis, queryEnvironment, runReadQuery } from '../src/diagnostics.mjs';

const executable = resolve('fixture-ios.exe');
const privateId = '00008030-000FAKEDEVICE1234';
function fixture(overrides = {}) {
  const calls = [];
  return { calls, options: { platform: 'win32', hash: async () => PIN.sha256,
    run: async (_path, command) => { calls.push(command); return JSON.stringify(command === 'version'
      ? { version: PIN.version } : { deviceList: [privateId] }); }, ...overrides } };
}

test('query success without devices is not device/control readiness', async () => {
  const result = diagnosis(parseDeviceList('{"deviceList":[]}'));
  assert.equal(result.discovery.reasonCode, 'NO_DEVICE');
  assert.equal(result.control.state, 'BLOCKED');
  assert.equal(result.capture.state, 'UNVERIFIED');
  assert.equal(result.environmentState, 'UNVERIFIED');
  assert.equal(result.outputPermission, 'METADATA_ONLY');
});
test('device identifier never leaves parser', () => {
  const result = parseDeviceList(JSON.stringify({ deviceList: [privateId] }));
  assert.equal(result.deviceCount, 1);
  assert.equal(JSON.stringify(result).includes(privateId), false);
  assert.equal(diagnosis(result).control.state, 'BLOCKED');
});
test('observed non-sensitive go-ios 1.3.2 golden responses', async () => {
  const version = await readFile(new URL('./fixtures/go-ios-1.3.2-version.json', import.meta.url), 'utf8');
  const list = await readFile(new URL('./fixtures/go-ios-1.3.2-list-empty.json', import.meta.url), 'utf8');
  const f = fixture({ run: async (_path, cmd) => cmd === 'version' ? version : list });
  assert.equal((await probeDevices(executable, f.options)).reasonCode, 'NO_DEVICE');
  assert.equal(parseDeviceList(list).deviceCount, 0);
});
for (const [name, raw] of Object.entries({ null: 'null', array: '[]', string: '"secret"', malformed: '{',
  missing: '{}', notArray: '{"deviceList":{}}', numeric: '{"deviceList":[123]}',
  duplicate: JSON.stringify({ deviceList: [privateId, privateId] }),
  extraField: JSON.stringify({ deviceList: [], secret: privateId }),
  content: '{"deviceList":["display name / private text"]}',
  oversized: ' '.repeat(65537), many: JSON.stringify({ deviceList: Array(65).fill(privateId) }) })) {
  test(`reject invalid output: ${name}`, () => {
    const result = parseDeviceList(raw);
    assert.equal(result.reasonCode, 'INVALID_RESPONSE');
    assert.equal(result.deviceCount, null);
    assert.equal(JSON.stringify(result).includes(privateId), false);
  });
}
test('only pinned version/list invoked and no retries', async () => {
  const f = fixture();
  assert.equal((await probeDevices(executable, f.options)).state, 'READY');
  assert.deepEqual(f.calls, ['version', 'list']);
});
for (const [name, options, expected] of [
  ['missing', { hash: async () => { throw new Error('private-path'); } }, 'TOOL_MISSING'],
  ['wrong hash', { hash: async () => 'a'.repeat(64) }, 'TOOL_HASH_MISMATCH'],
  ['unsupported', { platform: 'linux' }, 'HOST_UNSUPPORTED'],
]) test(name, async () => {
  const f = fixture(options);
  assert.equal((await probeDevices(executable, f.options)).reasonCode, expected);
  assert.deepEqual(f.calls, []);
});
test('relative executable denied', async () => {
  const f = fixture();
  assert.equal((await probeDevices('ios.exe', f.options)).reasonCode, 'TOOL_MISSING');
  assert.deepEqual(f.calls, []);
});
test('mismatched version prevents device query', async () => {
  const calls = [];
  const f = fixture({ run: async (_path, cmd) => { calls.push(cmd); return '{"version":"9.9.9"}'; } });
  assert.equal((await probeDevices(executable, f.options)).reasonCode, 'TOOL_VERSION_MISMATCH');
  assert.deepEqual(calls, ['version']);
});
for (const moment of [2, 3]) test(`changed tool at hash check ${moment}`, async () => {
  let count = 0;
  const f = fixture({ hash: async () => ++count === moment ? 'changed' : PIN.sha256 });
  assert.equal((await probeDevices(executable, f.options)).reasonCode, 'TOOL_CHANGED');
  assert.equal(f.calls.length, moment - 1);
});
for (const moment of [2, 3]) test(`unreadable tool at hash check ${moment} blocks`, async () => {
  let count = 0;
  const f = fixture({ hash: async () => { if (++count === moment) throw new Error('private-path'); return PIN.sha256; } });
  const result = await probeDevices(executable, f.options);
  assert.equal(result.reasonCode, 'TOOL_CHANGED');
  assert.equal(result.state, 'BLOCKED');
  assert.equal(f.calls.length, moment - 1);
});
for (const message of ['QUERY_TIMEOUT', 'private-device-id private-token']) test(`query failure ${message === 'QUERY_TIMEOUT' ? 'timeout' : 'redaction'}`, async () => {
  let attempts = 0;
  const f = fixture({ run: async () => { attempts++; throw new Error(message); } });
  const result = await probeDevices(executable, f.options);
  assert.equal(result.state, 'UNVERIFIED');
  assert.equal(result.reasonCode, message === 'QUERY_TIMEOUT' ? 'QUERY_TIMEOUT' : 'QUERY_FAILED');
  assert.equal(attempts, 1);
  assert.equal(JSON.stringify(result).includes('private-'), false);
});
test('child environment excludes routing/injection/secrets', () => {
  assert.deepEqual(queryEnvironment({ SystemRoot: 'C:\\Windows', TEMP: 'C:\\Temp',
    GO_IOS_AGENT_HOST: 'remote', HTTP_PROXY: 'secret', NODE_OPTIONS: '--inspect',
    SUPABASE_SERVICE_ROLE_KEY: 'secret', PATH: 'untrusted' }),
  { SystemRoot: 'C:\\Windows', TEMP: 'C:\\Temp' });
});
test('adapter cannot execute arbitrary operation or relative command', async () => {
  await assert.rejects(runReadQuery(executable, /** @type {any} */ ('erase')), /QUERY_FAILED/);
  await assert.rejects(runReadQuery('ios.exe', 'list'), /QUERY_FAILED/);
});
test('development manifest does not advertise unavailable server/skills/hooks', async () => {
  const manifest = JSON.parse(await readFile(new URL('../plugin/iphone-control/.codex-plugin/plugin.json', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'iphone-control');
  assert.equal(manifest.mcpServers, undefined);
  assert.equal(manifest.skills, undefined);
  assert.equal(manifest.hooks, undefined);
  assert.deepEqual(manifest.interface.capabilities, []);
});
