/**
 * P0-2 보호 게이트 validator.
 *
 * CI가 제공한 정확한 SHA와 선행 job 결과를 다시 묶고, 저장소의 AI gate decision이 가리키는
 * review/run/input hash와 anchor 조상 관계를 검증한다. GitHub 성공 표시는 이 파일의 입력이
 * 아니며 workflow `needs`가 전달한 같은 run의 결과만 받는다.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateClosureReview } from './fable-review/protocol-v12.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHA256_RE = /^[0-9a-f]{64}$/;
const OID_RE = /^[0-9a-f]{40}$/;
const REQUIRED_NEEDS = ['full-db-required', 'verify'];
const REQUIRED_CONTEXTS = ['verify (node 20.19.4)', 'verify (node 24)', 'full-db-required', 'protected-gate'];

export class GateValidationError extends Error {}

const fail = (message) => { throw new GateValidationError(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (path) => sha256(readFileSync(path));

function inputFilesHash(files) {
  return sha256(Buffer.from(JSON.stringify(files), 'utf8'));
}

export function artifactSetHash(files) {
  const artifacts = files
    .filter((file) => file.path_role === 'ARTIFACT')
    .map(({ path, change_type, size, git_blob_oid, sha256: hash }) => ({
      path, change_type, size, git_blob_oid, sha256: hash,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return sha256(Buffer.from(`${JSON.stringify(artifacts)}\n`, 'utf8'));
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitOk(args) {
  try { execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' }); return true; } catch { return false; }
}

function directories(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function field(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^- ${escaped}: ` + '`([^`]+)`$', 'm').exec(block)?.[1] ?? null;
}

function latestRound(taskDir) {
  const roundsDir = join(taskDir, 'rounds');
  const rounds = directories(roundsDir).filter((name) => /^r\d{3}$/.test(name)).sort();
  if (!rounds.length) fail(`${taskDir}에 공개 회차가 없습니다.`);
  return join(roundsDir, rounds.at(-1));
}

function initialHistoryPins(task) {
  if (task.closure_review) {
    return {
      run: task.closure_review.from_run_sha256,
      review: task.closure_review.from_review_sha256,
    };
  }
  if (task.engine_contract?.fallback) {
    return {
      run: task.engine_contract.fallback.from_run_sha256,
      review: task.engine_contract.fallback.from_review_sha256 ?? null,
    };
  }
  return {
    run: task.predecessor_review?.run_sha256 ?? null,
    review: task.predecessor_review?.review_sha256 ?? null,
  };
}

export function validateRoundHistory(rounds, initial = { run: null, review: null }) {
  let priorRun = initial.run ?? null;
  let latestReview = initial.review ?? null;
  const evidence = [];
  for (const round of rounds) {
    const runHash = sha256(round.runRaw);
    const reviewHash = round.reviewRaw ? sha256(round.reviewRaw) : null;
    if (round.manifest.previous_run_sha256 !== priorRun) fail(`${round.name} previous_run_sha256 연속성이 끊겼습니다.`);
    if ((round.manifest.previous_review_sha256 ?? null) !== latestReview) fail(`${round.name} previous_review_sha256가 최신 성공 검수를 가리키지 않습니다.`);
    if (inputFilesHash(round.manifest.input_files) !== round.manifest.input_files_sha256) fail(`${round.name} input_files metadata hash가 다릅니다.`);
    if (round.run.manifest_sha256 !== sha256(round.manifestRaw)
      || round.run.input_files_sha256 !== round.manifest.input_files_sha256) {
      fail(`${round.name} manifest/run hash가 다릅니다.`);
    }
    if (round.run.run_state === 'RESULT_RECEIVED') {
      if (!reviewHash || round.run.review_sha256 !== reviewHash) fail(`${round.name} 성공 run의 review hash가 다릅니다.`);
      latestReview = reviewHash;
    } else if (round.run.review_sha256 !== null || reviewHash !== null) {
      fail(`${round.name} 실패 run에 공식 review가 존재합니다.`);
    }
    evidence.push({
      round: round.name,
      run_sha256: runHash,
      review_sha256: reviewHash,
      input_files_sha256: round.manifest.input_files_sha256,
      artifact_set_sha256: artifactSetHash(round.manifest.input_files),
    });
    priorRun = runHash;
  }
  return { priorRun, latestReview, evidence };
}

function verifyCommitArtifacts(manifest, roundName) {
  if (manifest.snapshot_mode !== 'COMMIT') return;
  if (!OID_RE.test(manifest.target_commit_sha ?? '')) fail(`${roundName} COMMIT target SHA가 잘못됐습니다.`);
  for (const file of manifest.input_files.filter((item) => item.path_role === 'ARTIFACT')) {
    if (file.change_type === 'DELETED') continue;
    let bytes;
    try { bytes = execFileSync('git', ['show', `${manifest.target_commit_sha}:${file.path}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { fail(`${roundName} target commit에서 artifact를 읽지 못했습니다: ${file.path}`); }
    const blob = git(['rev-parse', `${manifest.target_commit_sha}:${file.path}`]);
    if (sha256(bytes) !== file.sha256 || blob !== file.git_blob_oid || bytes.length !== file.size) {
      fail(`${roundName} artifact 봉인이 target commit과 다릅니다: ${file.path}`);
    }
  }
}

function taskHistory(taskDir) {
  const task = JSON.parse(readFileSync(join(taskDir, 'task.json'), 'utf8'));
  const allRoundDirs = directories(join(taskDir, 'rounds'));
  if (allRoundDirs.some((name) => /^\.r\d{3}\.stage-/.test(name))) fail(`${task.task_id}에 준비 중 회차가 남았습니다.`);
  const roundNames = allRoundDirs.filter((name) => /^r\d{3}$/.test(name)).sort();
  const rounds = roundNames.map((name) => {
    const dir = join(taskDir, 'rounds', name);
    const manifestRaw = readFileSync(join(dir, 'manifest.json'));
    const runRaw = readFileSync(join(dir, 'run.json'));
    const reviewPath = join(dir, 'review.json');
    const manifest = JSON.parse(manifestRaw.toString('utf8'));
    verifyCommitArtifacts(manifest, `${task.task_id}/${name}`);
    return {
      name,
      manifestRaw,
      manifest,
      runRaw,
      run: JSON.parse(runRaw.toString('utf8')),
      reviewRaw: existsSync(reviewPath) ? readFileSync(reviewPath) : null,
    };
  });
  return validateRoundHistory(rounds, initialHistoryPins(task));
}

function decisionBlocks(raw) {
  const headings = [...raw.matchAll(/^## .*$/gm)].map((match) => ({ index: match.index, text: match[0] }));
  return headings.flatMap((heading, index) => (
    heading.text.startsWith('## AI_DEPUTY_GATE_DECISION')
      ? [raw.slice(heading.index, headings[index + 1]?.index ?? raw.length).trim()]
      : []
  ));
}

export function validateAnchorCommit(anchorSha, decisionSha, isAncestor) {
  if (!OID_RE.test(anchorSha ?? '') || !OID_RE.test(decisionSha ?? '')
    || !isAncestor(anchorSha, decisionSha)) {
    fail('gate anchor가 decision commit의 조상이 아닙니다.');
  }
  return anchorSha;
}

function validateDecision(taskDir, block, headSha) {
  const reviewSha = field(block, 'verified_review_sha256');
  const runSha = field(block, 'verified_run_sha256');
  const inputSha = field(block, 'verified_input_files_sha256');
  const anchor = field(block, 'gate_anchor_commit_sha');
  const required = field(block, 'open_required_finding_ids');
  const outcome = field(block, 'requested_outcome');
  if (![reviewSha, runSha, inputSha].every((value) => SHA256_RE.test(value ?? ''))) {
    fail(`${taskDir} gate decision의 review/run/input hash가 잘못됐습니다.`);
  }
  try {
    validateAnchorCommit(anchor, headSha, (candidate, decision) => gitOk([
      'merge-base', '--is-ancestor', candidate, decision,
    ]));
  } catch (error) {
    if (error instanceof GateValidationError) fail(`${taskDir} ${error.message}`);
    throw error;
  }
  if (required !== '[]') fail(`${taskDir} gate decision에 필수 미해결 Finding이 남았습니다.`);
  if (!new Set(['AWAIT_HUMAN', 'MERGE_CANDIDATE', 'CLOSE']).has(outcome)) {
    fail(`${taskDir} gate decision의 requested_outcome이 계약 밖입니다.`);
  }
  const history = taskHistory(taskDir);
  const round = latestRound(taskDir);
  if (fileHash(join(round, 'review.json')) !== reviewSha) fail(`${taskDir} review hash가 다릅니다.`);
  if (fileHash(join(round, 'run.json')) !== runSha) fail(`${taskDir} run hash가 다릅니다.`);
  const manifest = JSON.parse(readFileSync(join(round, 'manifest.json'), 'utf8'));
  if (manifest.input_files_sha256 !== inputSha) fail(`${taskDir} input_files hash가 다릅니다.`);
  const review = JSON.parse(readFileSync(join(round, 'review.json'), 'utf8'));
  if (!Array.isArray(review.remaining_required_finding_ids) || review.remaining_required_finding_ids.length !== 0) {
    fail(`${taskDir} 최신 review에 필수 미해결 Finding이 있습니다.`);
  }
  const finalRound = history.evidence.at(-1);
  if (!finalRound || finalRound.review_sha256 !== reviewSha || finalRound.run_sha256 !== runSha
    || finalRound.input_files_sha256 !== inputSha) {
    fail(`${taskDir} gate decision이 최신 회차 봉인을 가리키지 않습니다.`);
  }
  return {
    task_id: manifest.task_id,
    anchor_commit_sha: anchor,
    requested_outcome: outcome,
    review_sha256: reviewSha,
    run_sha256: runSha,
    input_files_sha256: inputSha,
    artifact_set_sha256: finalRound.artifact_set_sha256,
    round_chain: history.evidence,
  };
}

export function validateDependencyResults(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('REQUIRED_RESULTS가 JSON이 아닙니다.'); }
  const keys = Object.keys(parsed).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...REQUIRED_NEEDS].sort())) fail(`선행 job 집합이 다릅니다: ${keys.join(', ')}`);
  for (const name of REQUIRED_NEEDS) if (parsed[name]?.result !== 'success') fail(`${name} 결과가 success가 아닙니다.`);
  return Object.fromEntries(REQUIRED_NEEDS.map((name) => [name, 'success']));
}

export function validateCheckRuns({ decisionSha, requiredContexts, checkRuns, protectedHeadSha, isAncestor }) {
  if (!OID_RE.test(decisionSha) || !OID_RE.test(protectedHeadSha)) fail('decision/protected SHA가 잘못됐습니다.');
  if (!isAncestor(decisionSha, protectedHeadSha)) fail('decision commit이 보호 ref에 포함되지 않았습니다.');
  for (const context of requiredContexts) {
    const exact = checkRuns.filter((run) => run.sha === decisionSha && run.context === context);
    if (exact.length !== 1 || exact[0].conclusion !== 'success') fail(`정확한 SHA의 필수 check가 성공하지 않았습니다: ${context}`);
  }
  return true;
}

async function githubJson(path) {
  const repository = process.env.GITHUB_REPOSITORY ?? 'Jacop7/cost';
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'sikjae-protected-gate' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { headers });
  if (!response.ok) fail(`GitHub API ${response.status}: ${path}`);
  return response.json();
}

async function protectedRefHead(protectedRef) {
  const branch = protectedRef.replace(/^refs\/heads\//, '');
  const data = await githubJson(`/git/ref/heads/${encodeURIComponent(branch)}`);
  return data.object?.sha;
}

async function decisionWorkflowEvidence(decisionSha, protectedRef, contexts) {
  const branch = protectedRef.replace(/^refs\/heads\//, '');
  const runs = await githubJson(`/actions/runs?event=push&branch=${encodeURIComponent(branch)}&head_sha=${decisionSha}&per_page=20`);
  const run = (runs.workflow_runs ?? []).find((item) => item.name === 'verify' && item.head_sha === decisionSha
    && item.status === 'completed' && item.conclusion === 'success');
  if (!run) fail('decision SHA의 보호 ref 성공 workflow run이 없습니다.');
  const jobs = await githubJson(`/actions/runs/${run.id}/jobs?per_page=100`);
  const checkRuns = contexts.map((context) => {
    const exact = (jobs.jobs ?? []).filter((job) => job.name === context);
    if (exact.length !== 1) fail(`workflow run의 check context 개수가 1이 아닙니다: ${context}`);
    return { sha: decisionSha, context, conclusion: exact[0].conclusion, check_run_id: exact[0].id, details_url: exact[0].html_url };
  });
  const headSha = await protectedRefHead(protectedRef);
  const comparison = await githubJson(`/compare/${decisionSha}...${headSha}`);
  const isAncestor = () => decisionSha === headSha || new Set(['ahead', 'identical']).has(comparison.status);
  validateCheckRuns({ decisionSha, requiredContexts: contexts, checkRuns, protectedHeadSha: headSha, isAncestor });
  return { workflow_run_id: run.id, workflow_run_url: run.html_url, protected_head_sha: headSha, check_runs: checkRuns };
}

export function validateRunChain(rounds) {
  let previous = null;
  for (const round of rounds) {
    if (!SHA256_RE.test(round.run_sha256) || (round.previous_run_sha256 !== null && !SHA256_RE.test(round.previous_run_sha256))) {
      fail('run chain hash 형식이 잘못됐습니다.');
    }
    if (previous !== null && round.previous_run_sha256 !== previous) fail('previous_run_sha256 연속성이 끊겼습니다.');
    previous = round.run_sha256;
  }
  return previous;
}

export function validateClosureSuccessor({ decisionSha, targetSha, inheritedRegistrySha, predecessorRegistrySha, snapshotMode, route, predecessorRoute }) {
  if (snapshotMode !== 'COMMIT') fail('closure successor는 COMMIT이어야 합니다.');
  if (route !== predecessorRoute) fail('closure successor가 원 route를 바꿨습니다.');
  if (inheritedRegistrySha !== predecessorRegistrySha || !SHA256_RE.test(inheritedRegistrySha)) fail('closure successor의 Finding registry가 다릅니다.');
  if (!OID_RE.test(decisionSha) || !OID_RE.test(targetSha)) fail('closure successor commit SHA가 잘못됐습니다.');
  return true;
}

function closureEvidencePaths(decisionSha) {
  const dir = join(ROOT, 'docs', 'ai-review', 'gate-evidence', decisionSha);
  return {
    validator: join(dir, 'protected-gate-evidence.json'),
    checks: join(dir, 'checks-evidence.json'),
  };
}

async function validateClosureTask(taskId) {
  if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(taskId)) fail('closure Task ID 형식이 잘못됐습니다.');
  const taskPath = join(ROOT, 'docs', 'ai-review', 'tasks', taskId, 'task.json');
  if (!existsSync(taskPath)) fail(`closure task가 없습니다: ${taskId}`);
  const task = JSON.parse(readFileSync(taskPath, 'utf8'));
  const closure = validateClosureReview(task.closure_review, task);
  if (!gitOk(['merge-base', '--is-ancestor', closure.decision_commit_sha, task.target_commit_sha])) {
    fail('closure target이 decision commit을 포함하지 않습니다.');
  }
  const paths = closureEvidencePaths(closure.decision_commit_sha);
  if (!existsSync(paths.validator) || !existsSync(paths.checks)) fail('closure 보호 게이트 증거 파일이 없습니다.');
  if (fileHash(paths.validator) !== closure.p0_2_validator_run_sha256) fail('보호 validator run hash가 다릅니다.');
  if (fileHash(paths.checks) !== closure.checks_evidence_sha256) fail('보호 check evidence hash가 다릅니다.');
  const validator = JSON.parse(readFileSync(paths.validator, 'utf8'));
  const checks = JSON.parse(readFileSync(paths.checks, 'utf8'));
  if (validator.commit_sha !== closure.decision_commit_sha || validator.ref !== closure.protected_ref
    || validator.dependency_results?.verify !== 'success'
    || validator.dependency_results?.['full-db-required'] !== 'success') {
    fail('보호 validator 증거가 decision/ref/선행 job과 다릅니다.');
  }
  if (checks.decision_commit_sha !== closure.decision_commit_sha || checks.protected_ref !== closure.protected_ref
    || JSON.stringify(checks.check_contexts) !== JSON.stringify(closure.check_contexts)) {
    fail('check evidence가 closure 계약과 다릅니다.');
  }
  const live = await decisionWorkflowEvidence(closure.decision_commit_sha, closure.protected_ref, closure.check_contexts);
  if (String(live.workflow_run_id) !== String(checks.workflow_run_id)
    || live.protected_head_sha !== checks.protected_head_sha) {
    fail('저장된 check evidence가 현재 GitHub 보호 ref 증거와 다릅니다.');
  }
  console.log(`closure 보호 증거 통과 — ${taskId} · decision ${closure.decision_commit_sha}`);
  return true;
}

async function captureChecks(decisionSha, protectedRef, outputDir) {
  if (!OID_RE.test(decisionSha)) fail('decision SHA 형식이 잘못됐습니다.');
  if (!/^refs\/heads\/[A-Za-z0-9._\/-]+$/.test(protectedRef)) fail('protected ref 형식이 잘못됐습니다.');
  const live = await decisionWorkflowEvidence(decisionSha, protectedRef, REQUIRED_CONTEXTS);
  const payload = {
    schema_version: '1.0',
    repository: process.env.GITHUB_REPOSITORY ?? 'Jacop7/cost',
    decision_commit_sha: decisionSha,
    protected_ref: protectedRef,
    protected_head_sha: live.protected_head_sha,
    workflow_run_id: String(live.workflow_run_id),
    workflow_run_url: live.workflow_run_url,
    check_contexts: REQUIRED_CONTEXTS,
    check_runs: live.check_runs,
  };
  const out = resolve(ROOT, outputDir, 'checks-evidence.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`check evidence 저장 — ${out} · ${fileHash(out)}`);
}

function repositoryDecisions(headSha) {
  const root = join(ROOT, 'docs', 'ai-review', 'tasks');
  const decisions = [];
  for (const taskId of directories(root).sort()) {
    const taskDir = join(root, taskId);
    const ledger = join(taskDir, 'collaboration.md');
    if (!existsSync(ledger)) continue;
    const blocks = decisionBlocks(readFileSync(ledger, 'utf8'));
    for (const block of blocks) decisions.push(validateDecision(taskDir, block, headSha));
  }
  return decisions;
}

function parseArgs(argv) {
  const args = { mode: null, output: null, taskId: null, decisionSha: null, protectedRef: 'refs/heads/main' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ci') args.mode = 'ci';
    else if (argv[i] === '--closure-task') { args.mode = 'closure'; args.taskId = argv[++i]; }
    else if (argv[i] === '--capture-checks') { args.mode = 'capture'; args.decisionSha = argv[++i]; }
    else if (argv[i] === '--protected-ref') args.protectedRef = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
    else fail(`알 수 없는 인자: ${argv[i]}`);
  }
  if (!args.mode) fail('--ci, --closure-task 또는 --capture-checks가 필요합니다.');
  if (new Set(['ci', 'capture']).has(args.mode) && !args.output) fail('--output 경로가 필요합니다.');
  if (args.mode === 'closure' && !args.taskId) fail('--closure-task 뒤에 Task ID가 필요합니다.');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'closure') return validateClosureTask(args.taskId);
  if (args.mode === 'capture') return captureChecks(args.decisionSha, args.protectedRef, args.output);
  const headSha = git(['rev-parse', 'HEAD']);
  const githubSha = process.env.GITHUB_SHA;
  const githubRef = process.env.GITHUB_REF;
  if (!OID_RE.test(githubSha ?? '') || githubSha !== headSha) fail('checkout HEAD와 GITHUB_SHA가 다릅니다.');
  if (!/^refs\/heads\/[A-Za-z0-9._\/-]+$/.test(githubRef ?? '')) fail('보호 게이트는 branch push SHA에서만 실행합니다.');
  const dependencies = validateDependencyResults(process.env.REQUIRED_RESULTS ?? '');
  const decisions = repositoryDecisions(headSha);
  const payload = {
    schema_version: '1.0',
    commit_sha: headSha,
    ref: githubRef,
    workflow_run_id: String(process.env.GITHUB_RUN_ID ?? ''),
    workflow_run_attempt: String(process.env.GITHUB_RUN_ATTEMPT ?? ''),
    dependency_results: dependencies,
    decision_records: decisions,
    validator_sha256: fileHash(fileURLToPath(import.meta.url)),
  };
  const out = resolve(ROOT, args.output);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`protected gate 통과 — ${headSha} · decision ${decisions.length}건 · evidence ${sha256(readFileSync(out))}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(`protected gate 실패: ${error.message}`); process.exit(1); });
}
