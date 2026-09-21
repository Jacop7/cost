// Read-only feasibility probe for HOST-SCOPE-003.
// It never exports raw prompts, responses, transcript paths, or provider endpoint IDs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const declarationPath = resolve(root, 'docs/team/host-scope-003.json');
const preflightPath = resolve(root, 'docs/ai-review/evidence/TEAM-SERVICE-HOST-SCOPE-003-PREFLIGHT.json');
const outputPath = resolve(root, 'docs/ai-review/evidence/TEAM-SERVICE-HOST-SCOPE-003.json');
const startedAt = new Date();
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileSha = (path) => sha(readFileSync(path));
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

assert.equal(existsSync(outputPath), false, 'HOST-SCOPE-003 result is immutable; refusing overwrite');
const declaration = json(declarationPath);
const preflight = json(preflightPath);
assert.equal(declaration.scope_id, 'HOST-SCOPE-003');
assert.equal(declaration.scope_status, 'DECLARED_NOT_EXECUTED');
assert.equal(preflight.content_unchanged, true);
for (const input of declaration.baseline) {
  assert.equal(fileSha(resolve(root, input.path)), input.sha256, `baseline drift: ${input.path}`);
}

const sessionsRoot = resolve(process.env.USERPROFILE, '.codex', 'sessions');
let selected = null;
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (!selected && entry.isFile() && entry.name.endsWith('.jsonl') && fileSha(path) === preflight.content_sha256) selected = path;
  }
}
visit(sessionsRoot);
assert.ok(selected, 'Pinned historical rollout was not found by content hash');
assert.equal(statSync(selected).size, preflight.bytes);

const rows = readFileSync(selected, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
const names = ['send_message_to_thread', 'read_thread', 'wait_threads'];
const metrics = Object.fromEntries(names.map((name) => [name, {
  outer_calls: 0,
  paired_outer_results: 0,
  single_nested_call_batches: 0,
  named_nested_outputs: 0,
  literal_target_refs_in_invocation: 0,
  target_refs_repeated_in_nested_output: 0,
  nonce_or_challenge_in_invocation: 0,
  truncation_markers: 0,
}]));

for (let index = 0; index < rows.length; index += 1) {
  const payload = rows[index].payload ?? {};
  if (rows[index].type !== 'response_item' || payload.type !== 'custom_tool_call' || payload.name !== 'exec') continue;
  const source = typeof payload.input === 'string' ? payload.input : '';
  for (const name of names) {
    const nestedMatches = [...source.matchAll(new RegExp(`mcp__codex_app__${name}`, 'g'))];
    if (!nestedMatches.length) continue;
    const metric = metrics[name];
    metric.outer_calls += 1;
    if (nestedMatches.length === 1) metric.single_nested_call_batches += 1;
    const resultIndex = rows.findIndex((row, candidate) => candidate > index
      && row.type === 'response_item'
      && row.payload?.type === 'custom_tool_call_output'
      && row.payload?.call_id === payload.call_id);
    if (resultIndex < 0) continue;
    metric.paired_outer_results += 1;
    const nestedRows = rows.slice(index + 1, resultIndex);
    metric.named_nested_outputs += nestedRows.filter((row) => row.payload?.type === 'function_call_output' && row.payload?.name === name).length;
    const nestedRaw = JSON.stringify(nestedRows);
    const refs = [
      ...source.matchAll(/threadId\s*:\s*['\"]([^'\"]+)['\"]/g),
      ...source.matchAll(/\"threadId\"\s*:\s*\"([^\"]+)\"/g),
    ].map((match) => match[1]);
    metric.literal_target_refs_in_invocation += refs.length;
    metric.target_refs_repeated_in_nested_output += refs.filter((ref) => nestedRaw.includes(ref)).length;
    if (/nonce|challenge/i.test(source)) metric.nonce_or_challenge_in_invocation += 1;
    if (/truncat|original_token_count|output[^a-z]+omitted/i.test(JSON.stringify(rows[resultIndex].payload?.output))) metric.truncation_markers += 1;
  }
}

for (const name of names) {
  assert.equal(metrics[name].outer_calls, preflight.counts[name].nested_outer_calls);
  assert.equal(metrics[name].paired_outer_results, preflight.counts[name].outer_result_pairs);
}

const actualCallResult = names.every((name) => metrics[name].paired_outer_results === metrics[name].outer_calls)
  && names.every((name) => metrics[name].named_nested_outputs > 0)
  ? 'OBSERVED'
  : 'UNAVAILABLE_IN_SCOPE';
const targetBinding = names.every((name) => metrics[name].literal_target_refs_in_invocation > 0)
  && names.every((name) => metrics[name].target_refs_repeated_in_nested_output === metrics[name].literal_target_refs_in_invocation)
  && names.every((name) => metrics[name].nonce_or_challenge_in_invocation > 0)
  ? 'OBSERVED'
  : 'UNAVAILABLE_IN_SCOPE';
const observations = [
  {
    id: 'HOST_RECORD_WRITER_AND_SAME_USER_ADMIN_LIMITATION',
    result: 'OBSERVED_WITH_LIMITATION',
    evidence: 'Pinned rollout exists under the current Windows user runtime and is content-hash stable for this read. The same user or administrator can still alter runtime bytes; no provider signature is present.',
  },
  {
    id: 'ACTUAL_CALL_AND_RESULT_LINK_NOT_PROMPT_ECHO',
    result: actualCallResult,
    evidence: 'Outer executor calls pair with outer results by call_id. The metric requires named nested outputs inside that interval; absence means the invocation-unit actual-call/result link is unavailable.',
  },
  {
    id: 'TARGET_BINDING_AND_NONCE_INTENT_MATCH_CAPABILITY',
    result: targetBinding,
    evidence: 'The metric requires literal targets, exact repetition in the linked output, and a nonce/challenge in every selected tool family. Missing any condition is unavailable, not inferred from content similarity.',
  },
  {
    id: 'QUEUED_SEPARATE_FROM_TARGET_RESPONSE',
    result: 'PARTIAL',
    evidence: 'send, read, and wait are distinct named tool events, so queued transport can be modeled separately. The log format itself does not prove that a later response was authored by the intended target agent.',
  },
  {
    id: 'NESTED_FUNCTIONS_EXEC_BATCHING_AND_RESULT_TRUNCATION',
    result: 'OBSERVED',
    evidence: 'The pinned source contains nested tool execution inside outer executor calls. The collector must reject ambiguous multi-call batches and any truncated result rather than infer a pairing.',
  },
  {
    id: 'PARTIAL_WRITE_DUPLICATE_STALE_GENERATION_REPLAY_REJECTION',
    result: 'NOT_EVALUABLE_FROM_HOST_RECORD',
    evidence: 'This is a future collector implementation property. The pinned host record alone cannot prove or disprove it.',
  },
  {
    id: 'CAPTURE_BEFORE_NORMALIZATION_AND_REDACTED_DERIVATIVE_SEPARATION',
    result: 'NOT_EVALUABLE_FROM_HOST_RECORD',
    evidence: 'This is a future collector implementation property. The pinned host record alone cannot prove or disprove it.',
  },
  {
    id: 'PROTECTED_CAPTURE_ACL_AND_RECOVERY_LIMITATIONS',
    result: 'NOT_EVALUABLE_FROM_HOST_RECORD',
    evidence: 'This is a future collector implementation property. The pinned host record alone cannot prove or disprove it.',
  },
];
const decisiveMissing = observations.filter((row) => row.result === 'UNAVAILABLE_IN_SCOPE').map((row) => row.id);
const incomplete = observations.some((row) => ['PARTIAL', 'NOT_EVALUABLE_FROM_HOST_RECORD'].includes(row.result));
const outcome = decisiveMissing.length
  ? 'CAPTURE_LINK_UNAVAILABLE_IN_SCOPE'
  : incomplete
    ? 'DISCOVERY_INCOMPLETE'
    : 'CAPTURE_LINK_AVAILABLE_IN_SCOPE';

const result = {
  schema_version: 1,
  scope_id: declaration.scope_id,
  kind: declaration.kind,
  started_at: startedAt.toISOString(),
  ended_at: new Date().toISOString(),
  declaration: { path: 'docs/team/host-scope-003.json', sha256: fileSha(declarationPath) },
  preflight: { path: 'docs/ai-review/evidence/TEAM-SERVICE-HOST-SCOPE-003-PREFLIGHT.json', sha256: fileSha(preflightPath) },
  pinned_source: {
    reference: `LOCAL_RUNTIME_CONTENT_SHA256:${preflight.content_sha256}`,
    filename_sha256: sha(basename(selected)),
    bytes: statSync(selected).size,
    raw_path_exported: false,
    raw_conversation_exported: false,
    endpoint_ids_exported: false,
  },
  tool_schema_observation: {
    send_message_to_thread: 'Accepts a target thread reference and prompt; return type has no declared provider-signed caller/target attestation.',
    read_thread: 'Queries an explicit target thread reference; returned task data is observation, not agent identity authentication.',
    wait_threads: 'Queries explicit target records; completion/attention events remain separate from message authorship attestation.',
  },
  metrics,
  observations,
  outcome,
  decisive_missing: decisiveMissing,
  claims: {
    strict_host_binding_promoted: false,
    cooperative_flow_adopted: false,
    observed_receipt_implemented: false,
    send_enabled: false,
    service_ready: false,
  },
  limitations: [
    'This is a bounded inspection of one pinned historical rollout, not a statement that the platform can never provide a collector.',
    'Hash stability detects drift after pinning but does not authenticate the provider, caller, target agent, or same-user administrator.',
    'A future host or collector implementation requires a new positive scope; this result never rewrites HOST-SCOPE-001 or HOST-SCOPE-002.',
  ],
};
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ output: outputPath, outcome: result.outcome, decisive_missing: result.decisive_missing, metrics }, null, 2));
