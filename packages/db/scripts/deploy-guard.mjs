/** 환경·SHA·보호 게이트를 고정한 Supabase staging/production 배포 문. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(DB_ROOT, '..', '..');
const PROJECT_REF_PATH = join(DB_ROOT, 'supabase', '.temp', 'project-ref');
const SUPABASE_CLI = join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const TARGETS = new Set(['staging', 'production']);
const MODES = new Set(['plan', 'apply']);
const REF_RE = /^[a-z0-9]{20}$/;
const SHA_RE = /^[0-9a-f]{40}$/;

export class DeployGuardError extends Error {}
const fail = (message) => { throw new DeployGuardError(message); };
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function parseDeployArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!new Set(['--target', '--mode']).has(key) || value === undefined) {
      fail('사용법: deploy-guard.mjs --target <staging|production> --mode <plan|apply>');
    }
    if (options[key]) fail(`중복 인자입니다: ${key}`);
    options[key] = value;
  }
  if (!TARGETS.has(options['--target']) || !MODES.has(options['--mode'])) {
    fail('사용법: deploy-guard.mjs --target <staging|production> --mode <plan|apply>');
  }
  return { target: options['--target'], mode: options['--mode'] };
}

export function expectedRefEnv(target) {
  return target === 'production' ? 'SIKJAE_PRODUCTION_PROJECT_REF' : 'SIKJAE_STAGING_PROJECT_REF';
}

export function confirmationPhrase({ target, projectRef, sha }) {
  return `APPLY:${target}:${projectRef}:${sha}`;
}

export function validateDeployContext({ target, mode, expectedRef, linkedRef, approvedSha, headSha,
  remoteMainSha, branch, clean, protectedGate }) {
  if (!TARGETS.has(target) || !MODES.has(mode)) fail('배포 target 또는 mode가 계약 밖입니다.');
  if (!REF_RE.test(expectedRef ?? '')) fail(`${expectedRefEnv(target)}가 없거나 project ref 형식이 아닙니다.`);
  if (!REF_RE.test(linkedRef ?? '')) fail('현재 Supabase 링크의 project ref가 없거나 형식이 아닙니다.');
  if (linkedRef !== expectedRef) fail('현재 Supabase 링크와 승인된 대상 project ref가 다릅니다.');
  if (!SHA_RE.test(approvedSha ?? '')) fail('SIKJAE_APPROVED_DEPLOY_SHA가 없거나 40자리 SHA가 아닙니다.');
  if (!SHA_RE.test(headSha ?? '') || !SHA_RE.test(remoteMainSha ?? '')) fail('Git SHA를 확인하지 못했습니다.');
  if (branch !== 'main') fail('운영·스테이징 배포는 main 브랜치에서만 실행합니다.');
  if (!clean) fail('배포 전 worktree가 깨끗해야 합니다.');
  if (headSha !== remoteMainSha || headSha !== approvedSha) fail('HEAD·origin/main·승인된 배포 SHA가 같지 않습니다.');
  if (!protectedGate || protectedGate.sha !== headSha || protectedGate.conclusion !== 'success') {
    fail('정확한 배포 SHA의 protected-gate 성공을 확인하지 못했습니다.');
  }
  return { target, mode, projectRef: linkedRef, sha: headSha, protectedGate };
}

export function pendingMigrationFiles(dryRunOutput, migrationFiles) {
  const versions = new Set(dryRunOutput.match(/\b\d{14}\b/g) ?? []);
  return migrationFiles.filter((name) => versions.has(name.slice(0, 14))).sort();
}

export function deploymentCommands(mode) {
  const base = [
    ['migration', 'list', '--linked'],
    ['db', 'push', '--linked', '--dry-run'],
  ];
  return mode === 'apply' ? [...base, ['db', 'push', '--linked', '--yes'], ['migration', 'list', '--linked'], ['db', 'push', '--linked', '--dry-run']] : base;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', cwd: ROOT, encoding: 'utf8',
  });
  const secret = /^password=(.*)$/m.exec(result.stdout)?.[1];
  if (result.status !== 0 || !secret) fail('GitHub 보호 게이트를 확인할 자격증명이 없습니다.');
  return secret;
}

function repository() {
  const match = /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/.exec(git(['remote', 'get-url', 'origin']));
  if (!match) fail('origin GitHub 저장소를 판별하지 못했습니다.');
  return `${match[1]}/${match[2]}`;
}

async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repository()}${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${githubToken()}`,
      'User-Agent': 'sikjae-deploy-guard', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) fail(`GitHub API ${response.status}: 보호 게이트를 확인하지 못했습니다.`);
  return response.json();
}

async function protectedGateFor(sha) {
  const runs = await api(`/actions/runs?event=push&branch=main&head_sha=${sha}&per_page=20`);
  const run = (runs.workflow_runs ?? []).find((item) => item.name === 'verify' && item.head_sha === sha
    && item.status === 'completed' && item.conclusion === 'success');
  if (!run) return null;
  const jobs = await api(`/actions/runs/${run.id}/jobs?per_page=100`);
  const exact = (jobs.jobs ?? []).filter((job) => job.name === 'protected-gate');
  if (exact.length !== 1) return null;
  return { sha, conclusion: exact[0].conclusion, workflowRunId: run.id, checkRunId: exact[0].id };
}

function remoteMainSha() {
  const line = git(['ls-remote', '--heads', 'origin', 'refs/heads/main']);
  const sha = line.split(/\s+/)[0];
  if (!SHA_RE.test(sha ?? '')) fail('원격 main SHA를 확인하지 못했습니다.');
  return sha;
}

function runSupabase(args) {
  const result = spawnSync(process.execPath, [SUPABASE_CLI, ...args], {
    cwd: DB_ROOT, encoding: 'utf8', env: process.env, maxBuffer: 20 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  if (result.status !== 0) fail(`Supabase CLI 실패: supabase ${args.join(' ')}`);
  return output;
}

function migrationFiles() {
  return readdirSync(join(DB_ROOT, 'supabase', 'migrations'))
    .filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
}

function evidencePath(target, sha) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(ROOT, 'docs', 'deployments', `${stamp}-${target}-${sha.slice(0, 7)}.json`);
}

function writeEvidence(record) {
  const path = evidencePath(record.target, record.deploy_sha);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  renameSync(temporary, path);
  return path;
}

async function main() {
  const { target, mode } = parseDeployArgs(process.argv.slice(2));
  const headSha = git(['rev-parse', 'HEAD']);
  const branch = git(['branch', '--show-current']);
  const clean = git(['status', '--porcelain']) === '';
  // 링크·GitHub 조회보다 먼저 로컬에서 거절한다. feature나 dirty 상태가 원격을
  // 조회했다는 이유로 배포 문 가까이까지 진행한 것처럼 보이면 안 된다.
  if (branch !== 'main') fail('운영·스테이징 배포는 main 브랜치에서만 실행합니다.');
  if (!clean) fail('배포 전 worktree가 깨끗해야 합니다.');
  if (!existsSync(PROJECT_REF_PATH)) fail('Supabase project가 링크되지 않았습니다. 먼저 대상 프로젝트를 명시적으로 link 하세요.');
  const context = validateDeployContext({
    target,
    mode,
    expectedRef: process.env[expectedRefEnv(target)],
    linkedRef: readFileSync(PROJECT_REF_PATH, 'utf8').trim(),
    approvedSha: process.env.SIKJAE_APPROVED_DEPLOY_SHA,
    headSha,
    remoteMainSha: remoteMainSha(),
    branch,
    clean,
    protectedGate: await protectedGateFor(headSha),
  });
  const files = migrationFiles();
  const commands = deploymentCommands(mode);
  console.log(`배포 계획 — target=${target} · project_ref=${context.projectRef} · sha=${context.sha} · mode=${mode}`);
  const migrationListBefore = runSupabase(commands[0]);
  const dryRunBefore = runSupabase(commands[1]);
  const pending = pendingMigrationFiles(dryRunBefore, files);
  console.log(`적용 예정 migration ${pending.length}개${pending.length ? ` — ${pending.join(', ')}` : ''}`);

  let applied = [];
  let migrationListAfter = '';
  let dryRunAfter = '';
  if (mode === 'apply') {
    const expected = confirmationPhrase({ target, projectRef: context.projectRef, sha: context.sha });
    if (process.env.SIKJAE_DEPLOY_CONFIRM !== expected) {
      fail(`실제 적용 확인값이 다릅니다. 계획 검토 후 SIKJAE_DEPLOY_CONFIRM=${expected} 를 명시하세요.`);
    }
    runSupabase(commands[2]);
    migrationListAfter = runSupabase(commands[3]);
    dryRunAfter = runSupabase(commands[4]);
    const remaining = pendingMigrationFiles(dryRunAfter, files);
    if (remaining.length) fail(`적용 뒤에도 pending migration이 남았습니다: ${remaining.join(', ')}`);
    applied = pending;
  }

  const record = {
    schema_version: 1,
    recorded_at: new Date().toISOString(),
    status: mode === 'apply' ? 'APPLIED' : 'PLAN_ONLY',
    target,
    project_ref: context.projectRef,
    deploy_sha: context.sha,
    branch: 'main',
    protected_gate: context.protectedGate,
    migration_count: files.length,
    pending_migrations: pending,
    applied_migrations: applied,
    evidence_hashes: {
      migration_list_before_sha256: sha256(migrationListBefore),
      dry_run_before_sha256: sha256(dryRunBefore),
      migration_list_after_sha256: migrationListAfter ? sha256(migrationListAfter) : null,
      dry_run_after_sha256: dryRunAfter ? sha256(dryRunAfter) : null,
    },
  };
  if (mode === 'apply') {
    const path = writeEvidence(record);
    console.log(`배포 기록 생성: ${path}`);
  } else {
    // plan이 추적 파일을 만들면 다음 apply의 clean-worktree 가드를 스스로 깨뜨린다.
    // 검토할 값은 stdout에 남기고, 영구 증거는 실제 적용 성공 뒤에만 만든다.
    console.log(`PLAN_ONLY — pending=${pending.length} · 실제 DB 변경과 배포 기록 생성 없음`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`배포 가드 실패: ${error.message}`);
    process.exit(1);
  });
}
