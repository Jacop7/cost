import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const installer = join(root, 'scripts', 'Install-TeamServiceBootstrap.ps1');
const exporter = join(root, 'scripts', 'Export-TeamServiceBootstrap.ps1');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

function powershell(script, args) {
  for (const shell of ['pwsh', 'powershell']) {
    const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-File', script, ...args], {
      encoding: 'utf8', windowsHide: true,
    });
    if (result.error?.code === 'ENOENT') continue;
    return result;
  }
  throw new Error('POWERSHELL_UNAVAILABLE');
}

test('AT-06 clean-profile install and update preserve a usable personal marketplace', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'team-service-install-'));
  const user = join(base, '사용자');
  mkdirSync(user, { recursive: true });
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const first = powershell(installer, ['-SourceRoot', root, '-UserRoot', user, '-SkipCodexRegistration']);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const target = join(user, 'plugins', 'codex-team-service-bootstrap');
  const marketplace = join(user, '.agents', 'plugins', 'marketplace.json');
  assert(existsSync(join(target, '.codex-plugin', 'plugin.json')));
  const catalog = JSON.parse(readFileSync(marketplace, 'utf8'));
  assert.equal(catalog.name, 'personal');
  assert.equal(catalog.plugins.filter((item) => item.name === 'codex-team-service-bootstrap').length, 1);
  const second = powershell(installer, ['-SourceRoot', root, '-UserRoot', user, '-Update', '-SkipCodexRegistration']);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const updated = JSON.parse(readFileSync(marketplace, 'utf8'));
  assert.equal(updated.plugins.filter((item) => item.name === 'codex-team-service-bootstrap').length, 1);
});

test('AT-07 portable export contains a marketplace, plugin, installer, and inventory', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'team-service-export-'));
  const output = join(base, 'release');
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const result = powershell(exporter, ['-SourceRoot', root, '-OutputDirectory', output]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert(existsSync(join(output, 'marketplace.json')));
  assert(existsSync(join(output, 'Install-TeamServiceBootstrap.ps1')));
  assert(existsSync(join(output, 'plugins', 'codex-team-service-bootstrap', '.codex-plugin', 'plugin.json')));
  const inventory = JSON.parse(readFileSync(join(output, 'release-inventory.json'), 'utf8'));
  assert.equal(inventory.package, 'codex-team-service-bootstrap');
  assert(inventory.files.length >= 15);
});

test('AT-14 bootstrap commands do not mutate the four dependency plugin manifests', (t) => {
  const manifests = [
    'C:\\Codex-AI-Operations\\Codex-Mission-Relay\\plugins\\codex-mission-relay\\.codex-plugin\\plugin.json',
    'C:\\Codex-AI-Operations\\Codex-Project-Orchestrator\\plugins\\codex-project-orchestrator\\.codex-plugin\\plugin.json',
    'C:\\Codex-AI-Operations\\Codex-Team-Router\\plugins\\codex-team-router\\.codex-plugin\\plugin.json',
    'C:\\Codex-AI-Operations\\Codex-Account-Continuity\\plugins\\codex-account-continuity\\.codex-plugin\\plugin.json',
  ];
  if (!manifests.every(existsSync)) return t.skip('dependency plugin source unavailable');
  const before = manifests.map(hash);
  const f = mkdtempSync(join(tmpdir(), 'team-service-dependency-'));
  const project = join(f, 'project');
  mkdirSync(project, { recursive: true });
  t.after(() => rmSync(f, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'team-service.mjs'), 'doctor', '--project', project], {
    encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(manifests.map(hash), before);
});

test('AT-15 an exported package installs into a second clean profile without the source repository', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'team-service-rebuild-'));
  const output = join(base, 'release');
  const user = join(base, 'second-user');
  mkdirSync(user, { recursive: true });
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const exported = powershell(exporter, ['-SourceRoot', root, '-OutputDirectory', output]);
  assert.equal(exported.status, 0, exported.stderr || exported.stdout);
  const exportedPlugin = join(output, 'plugins', 'codex-team-service-bootstrap');
  const installed = powershell(join(output, 'Install-TeamServiceBootstrap.ps1'), [
    '-SourceRoot', exportedPlugin, '-UserRoot', user, '-SkipCodexRegistration',
  ]);
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);
  assert(existsSync(join(user, 'plugins', 'codex-team-service-bootstrap', 'docs', 'REBUILD-BLUEPRINT.md')));
});
