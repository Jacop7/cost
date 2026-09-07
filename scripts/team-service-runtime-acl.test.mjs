import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checker = resolve(root, 'scripts/team-service-runtime-acl.ps1');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';

function parseLastJson(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  return JSON.parse(lines.at(-1));
}

function configureFixture() {
  assert.equal(process.platform, 'win32', 'ACL_OS_UNSUPPORTED');
  assert.ok(process.env.LOCALAPPDATA, 'LOCALAPPDATA_KNOWN_FOLDER_REQUIRED');
  const path = resolve(process.env.LOCALAPPDATA, 'Codex-Team-Service', `acl-p4-${process.pid}-${Date.now()}`);
  const stdout = execFileSync(powershell, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', checker, '-Mode', 'Configure', '-Path', path,
  ], { encoding: 'utf8', windowsHide: true });
  return { path, evidence: parseLastJson(stdout) };
}

function runOtherTokenProbe(path, ownerSid) {
  const raw = process.env.TEAM_SERVICE_ACL_OTHER_TOKEN_LAUNCHER_JSON;
  if (!raw) throw new Error('ACL_NEGATIVE_UNVERIFIED');
  let launcher;
  try { launcher = JSON.parse(raw); } catch { throw new Error('INVALID_OTHER_TOKEN_LAUNCHER_JSON'); }
  assert.ok(Array.isArray(launcher) && launcher.length > 0 && launcher.every((item) => typeof item === 'string'));
  const values = { '{SCRIPT}': checker, '{PATH}': path, '{OWNER_SID}': ownerSid };
  const expanded = launcher.map((item) => Object.entries(values).reduce((value, [needle, replacement]) => value.replaceAll(needle, replacement), item));
  for (const marker of Object.keys(values)) assert.equal(expanded.some((item) => item.includes(marker)), false, `unexpanded ${marker}`);
  const result = spawnSync(expanded[0], expanded.slice(1), { encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return parseLastJson(result.stdout);
}

test('AC-23 service contract', () => {
  const { path, evidence } = configureFixture();
  try {
    assert.equal(evidence.resolved_path, path);
    assert.equal(evidence.owner_read_result, 'PASS');
    assert.equal(evidence.other_principal_denial_result, 'ACL_NEGATIVE_UNVERIFIED');
    assert.equal(evidence.principal_type, 'OWNER');
    assert.match(evidence.owner_sid, /^S-1-/);
    assert.match(evidence.sddl_sha256, /^[0-9a-f]{64}$/);
    assert.equal(evidence.checker_sha256, sha256(readFileSync(checker)));
    assert.equal(existsSync(evidence.probe_file), true);

    const probe = runOtherTokenProbe(path, evidence.owner_sid);
    assert.equal(probe.resolved_path, path);
    assert.equal(probe.owner_sid, evidence.owner_sid);
    assert.notEqual(probe.probe_sid, evidence.owner_sid);
    assert.equal(probe.principal_type, 'OTHER_NON_ADMIN');
    assert.equal(probe.other_principal_denial_result, 'PASS');
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});

test('missing other token is an execution failure, never a skip or pass', () => {
  const saved = process.env.TEAM_SERVICE_ACL_OTHER_TOKEN_LAUNCHER_JSON;
  delete process.env.TEAM_SERVICE_ACL_OTHER_TOKEN_LAUNCHER_JSON;
  try {
    assert.throws(() => runOtherTokenProbe('C:\\unreachable', 'S-1-5-21-owner'), /ACL_NEGATIVE_UNVERIFIED/);
  } finally {
    if (saved === undefined) delete process.env.TEAM_SERVICE_ACL_OTHER_TOKEN_LAUNCHER_JSON;
    else process.env.TEAM_SERVICE_ACL_OTHER_TOKEN_LAUNCHER_JSON = saved;
  }
});
