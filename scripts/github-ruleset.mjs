/** GitHub main ruleset을 저장소의 선언 파일과 대조·적용한다. */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = resolve(ROOT, '.github', 'rulesets', 'main-required.json');

export function canonicalRuleset(value) {
  const status = value.rules.find((rule) => rule.type === 'required_status_checks');
  return {
    name: value.name,
    target: value.target,
    enforcement: value.enforcement,
    bypass_actors: value.bypass_actors ?? [],
    conditions: {
      ref_name: {
        include: [...(value.conditions?.ref_name?.include ?? [])].sort(),
        exclude: [...(value.conditions?.ref_name?.exclude ?? [])].sort(),
      },
    },
    rules: [
      ...value.rules.filter((rule) => rule.type !== 'required_status_checks')
        .map((rule) => ({ type: rule.type })).sort((a, b) => a.type.localeCompare(b.type)),
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: status?.parameters?.strict_required_status_checks_policy,
          do_not_enforce_on_create: status?.parameters?.do_not_enforce_on_create ?? false,
          required_status_checks: [...(status?.parameters?.required_status_checks ?? [])]
            .map((item) => ({ context: item.context }))
            .sort((a, b) => a.context.localeCompare(b.context)),
        },
      },
    ],
  };
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function repository() {
  const url = git(['remote', 'get-url', 'origin']);
  const match = /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(url);
  if (!match) throw new Error('origin GitHub 저장소를 판별할 수 없습니다.');
  return `${match[1]}/${match[2]}`;
}

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', cwd: ROOT,
  });
  if (result.status !== 0) throw new Error('GitHub 자격증명을 읽지 못했습니다.');
  const password = /^password=(.*)$/m.exec(result.stdout)?.[1];
  if (!password) throw new Error('GitHub token이 없습니다. GITHUB_TOKEN 또는 Git credential이 필요합니다.');
  return password;
}

async function api(path, { method = 'GET', body = null } = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository()}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token()}`,
      'User-Agent': 'margincook-ruleset-manager',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} ${method} ${path}`);
  return response.status === 204 ? null : response.json();
}

async function findRuleset(name) {
  const list = await api('/rulesets');
  const item = list.find((ruleset) => ruleset.name === name && ruleset.target === 'branch');
  return item ? api(`/rulesets/${item.id}`) : null;
}

async function assertHeadGateSuccess() {
  const sha = git(['rev-parse', 'HEAD']);
  const main = git(['rev-parse', 'origin/main']);
  try { execFileSync('git', ['merge-base', '--is-ancestor', main, sha], { cwd: ROOT, stdio: 'ignore' }); }
  catch { throw new Error('현재 SHA가 origin/main에서 전진한 commit이 아닙니다.'); }
  if (git(['status', '--porcelain'])) throw new Error('ruleset 적용 전 worktree가 깨끗해야 합니다.');
  const runs = await api(`/actions/runs?event=push&head_sha=${sha}&per_page=20`);
  const success = (runs.workflow_runs ?? []).find((run) => run.name === 'verify' && run.head_sha === sha
    && run.status === 'completed' && run.conclusion === 'success');
  if (!success) throw new Error('현재 SHA의 completed/success verify run이 없습니다.');
  const jobs = await api(`/actions/runs/${success.id}/jobs?per_page=100`);
  const gate = (jobs.jobs ?? []).filter((job) => job.name === 'protected-gate');
  if (gate.length !== 1 || gate[0].conclusion !== 'success') throw new Error('현재 SHA의 protected-gate가 성공하지 않았습니다.');
  return { sha, runId: success.id };
}

async function main() {
  const mode = process.argv[2];
  if (!new Set(['check', 'fix']).has(mode) || process.argv.length !== 3) {
    throw new Error('사용법: node scripts/github-ruleset.mjs <check|fix>');
  }
  const desiredRaw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const desired = canonicalRuleset(desiredRaw);
  let actual = await findRuleset(desired.name);
  if (mode === 'fix') {
    const gate = await assertHeadGateSuccess();
    actual = actual
      ? await api(`/rulesets/${actual.id}`, { method: 'PUT', body: desiredRaw })
      : await api('/rulesets', { method: 'POST', body: desiredRaw });
    console.log(`ruleset 적용 — SHA ${gate.sha} · verify run ${gate.runId}`);
  }
  if (!actual) throw new Error(`ruleset이 없습니다: ${desired.name}`);
  const actualCanonical = canonicalRuleset(actual);
  if (JSON.stringify(actualCanonical) !== JSON.stringify(desired)) {
    throw new Error(`원격 ruleset이 선언 파일과 다릅니다.\n기대: ${JSON.stringify(desired)}\n실제: ${JSON.stringify(actualCanonical)}`);
  }
  console.log(`ruleset ${mode} 통과 — ${desired.name} · required=protected-gate · bypass=0`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(`ruleset 실패: ${error.message}`); process.exit(1); });
}
