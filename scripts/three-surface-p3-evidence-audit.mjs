/**
 * Read-only, partial P3 evidence adapter. No approval/verify integration.
 * Supported packet: ingredient-save before/after rows emitted by
 * three-surface-vendor-failure-capture.mjs (subject=ingredient).
 * Registry/optional contract/packet JSON are read from exact target Git blobs;
 * PNG bytes are independently read from disk and checked against Git and packet.
 * targetCommit is the evidence-preservation HEAD (registry/contract/packet authority).
 * sourceTargetCommit is a separately selected ancestor: CURRENT only means that
 * packet.sourceCommit equals this selected source, NEVER promotion to preservation HEAD.
 * A source SHA and PNG hash do NOT prove which bundle a server actually served.
 * An explicit contract is a recorded declaration, NOT an authenticated approval.
 * Without it no state/viewport/pass denominator is invented from capture rows.
 * Optional contract v1: {schemaVersion:1,registryBlob,states:[{id,screenId,binding,
 * state,host,width,height,pass,evidencePath,rowKey,phase}]}. binding must be a
 * literal prototype target owned by that surface, or null for an app-only surface.
 * pass is web-text-1 or web-text-2; state mapping is supplied, never inferred.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSafeRepoPath } from './three-surface-p3-successor-contract.mjs';

const OID = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const SCRIPT = 'scripts/three-surface-vendor-failure-capture.mjs';
const REGISTRY = 'apps/mobile/src/dev/surfaceRegistry.generated.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const array = (v, label) => { assert(Array.isArray(v), `${label}: array required`); return v; };
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
const unique = (values, label) => assert(new Set(values).size === values.length, `${label}: duplicate`);

export function auditP3Evidence({ root, targetCommit, sourceTargetCommit, evidencePaths = [], contractPath,
  registryPath = REGISTRY, requestedStatus = 'CANDIDATE_ONLY' } = {}) {
  const result = {
    status: 'CANDIDATE_ONLY', completeness: 'PARTIAL', fullP3Complete: false,
    evidenceCommit: targetCommit, sourceTargetCommit, absentContract: !contractPath, contractAuthority: 'UNKNOWN',
    externalReview: 'UNVERIFIED', nativeEvidence: 'UNVERIFIED',
    bindings: [], states: [], packets: [], failures: [],
    limitations: [
      'Only ingredient-save rows format is supported; no visual correctness or approval is inferred.',
      'Registry ready/aligned does not establish state coverage. Contract declarations are not approval.',
      'Source commits and file hashes do not attest the bundle served at capture time.',
      'Packet paths/metadata are not observation identities. Identical source/script/viewport/pass/PNG observations cannot cover multiple states; independent identical-pixel runs need a future authenticated run identity.',
      'CURRENT is relative to explicit sourceTargetCommit, not evidence HEAD or latest product approval.',
      'Script hashes must equal raw source Git blob SHA256; CRLF checkout-byte hashes are INVALID, not silently normalized.',
      'No runtime cleanliness, official reviewer provenance, native completion, or full verify PASS is asserted.',
      'Existing P0/P2 gates, thresholds and baseline remain unchanged; this tool cannot supersede them.',
    ],
  };
  try {
    assert(requestedStatus === 'CANDIDATE_ONLY', 'approval/final-closure requests are prohibited');
    assert(typeof root === 'string' && OID.test(targetCommit ?? ''), 'root and exact target SHA required');
    const repo = resolve(root);
    const key = p => process.platform === 'win32' ? p.toLowerCase() : p;
    assert(key(realpathSync.native(repo)) === key(repo), 'root alias/symlink prohibited');
    const git = (...args) => execFileSync('git', ['--literal-pathspecs', '--no-replace-objects', ...args], {
      cwd: repo, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const text = (...args) => git(...args).toString('utf8').trim();
    assert(key(resolve(text('rev-parse', '--show-toplevel'))) === key(repo), 'root is not Git top level');
    const commit = sha => assert(OID.test(sha ?? '') && text('cat-file', '-t', sha) === 'commit', 'invalid source commit');
    commit(targetCommit);
    const stable = () => {
      assert(text('rev-parse', 'HEAD') === targetCommit, 'HEAD differs from target');
      assert(!text('status', '--porcelain', '--untracked-files=no'), 'dirty tracked checkout');
      assert(!git('ls-files', '-v', '-z').toString('utf8').split('\0').some(s => /^[a-zS] /.test(s)), 'concealed index flags');
    };
    stable();
    const safeFile = path => {
      assert(isSafeRepoPath(path) && !path.split('/').some(p => p.toLowerCase() === '.git'), `unsafe path: ${path}`);
      let cursor = repo;
      const parts = path.split('/');
      for (let i = 0; i < parts.length; i++) {
        cursor = resolve(cursor, parts[i]);
        const rel = relative(repo, cursor);
        assert(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'path escapes repository');
        const st = lstatSync(cursor);
        assert(!st.isSymbolicLink(), `symlink prohibited: ${path}`);
        assert(i === parts.length - 1 ? st.isFile() : st.isDirectory(), `not a regular path: ${path}`);
      }
      return cursor;
    };
    const blob = (sha, path) => {
      assert(isSafeRepoPath(path), `unsafe blob path: ${path}`);
      const row = git('ls-tree', '-z', sha, '--', path).toString('utf8');
      const m = row.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
      assert(m && m[3] === path, `missing/nonregular Git blob: ${path}`);
      return { oid: m[2], bytes: git('cat-file', 'blob', m[2]) };
    };
    const current = path => { safeFile(path); return blob(targetCommit, path); };
    const json = path => { const b = current(path); return { oid: b.oid, value: JSON.parse(b.bytes.toString('utf8')) }; };
    const registry = json(registryPath);
    assert(registry.value.schemaVersion === 1, 'unsupported registry schema');
    const surfaces = array(registry.value.surfaces, 'registry.surfaces');
    unique(surfaces.map(s => s.screenId), 'registry surfaces');
    for (const surface of surfaces) {
      assert(nonempty(surface.screenId), 'missing screen ID');
      unique(array(surface.states, 'registry.states'), 'registry states');
      const bindings = array(surface.prototypeTargets ?? [], 'prototypeTargets');
      unique(bindings, 'prototypeTargets');
      assert(bindings.every(nonempty), 'invalid prototype target');
      assert(bindings.length || surface.parity === 'expoOnly', 'surface without declared binding');
      for (const binding of bindings.length ? bindings : [null])
        result.bindings.push({ screenId: surface.screenId, binding, status: 'UNMAPPED' });
    }
    result.registry = { path: registryPath, blob: registry.oid, surfaces: surfaces.length,
      bindingCount: result.bindings.length, scope: 'All registry surfaces, not capture-derived' };
    let specs = [];
    if (contractPath) {
      const contract = json(contractPath);
      assert(contract.value.schemaVersion === 1 && contract.value.registryBlob === registry.oid, 'contract registry binding mismatch');
      specs = array(contract.value.states, 'contract.states');
      unique(specs.map(s => s.id), 'contract state IDs');
      unique(specs.map(s => JSON.stringify([s.screenId, s.binding, s.state, s.width, s.height, s.pass, s.phase])), 'contract state identities');
      for (const s of specs) {
        assert(nonempty(s.id) && nonempty(s.state) && nonempty(s.rowKey), 'invalid explicit state');
        assert(result.bindings.some(b => b.screenId === s.screenId && b.binding === s.binding), 'unknown contract binding');
        assert((s.host === 'add' && s.screenId === 'ING-02') || (s.host === 'edit' && s.screenId === 'ING-04'), 'unsupported host mapping');
        assert(Number.isInteger(s.width) && s.width > 0 && Number.isInteger(s.height) && s.height > 0, 'invalid viewport');
        assert(['web-text-1', 'web-text-2'].includes(s.pass) && ['before', 'after'].includes(s.phase), 'unsupported pass/phase');
        assert(isSafeRepoPath(s.evidencePath), 'unsafe contract evidence path');
      }
      result.contract = { path: contractPath, blob: contract.oid, stateCount: specs.length };
      result.contractAuthority = 'DECLARED_NOT_APPROVED';
    }
    unique(array(evidencePaths, 'evidencePaths'), 'packet paths');
    const paths = [...new Set([...evidencePaths, ...specs.map(s => s.evidencePath)])];
    if (paths.length) {
      assert(OID.test(sourceTargetCommit ?? ''), 'explicit sourceTargetCommit required for evidence comparison');
      commit(sourceTargetCommit);
      git('merge-base', '--is-ancestor', sourceTargetCommit, targetCommit);
    }
    const observations = new Map();
    for (const path of paths) {
      const packet = json(path), p = packet.value;
      assert(p.subject === 'ingredient' && ['before', 'after'].includes(p.phase), `unsupported packet format: ${path}`);
      commit(p.sourceCommit);
      git('merge-base', '--is-ancestor', p.sourceCommit, targetCommit);
      const script = blob(p.sourceCommit, SCRIPT);
      assert(HASH.test(p.scriptSha256 ?? '') && hash(script.bytes) === p.scriptSha256, 'source script raw Git blob hash mismatch');
      const rows = array(p.rows, 'packet.rows');
      assert(rows.length > 0, 'empty supported packet');
      unique(rows.map(r => r.key), 'packet row keys');
      const packetStatus = p.sourceCommit === sourceTargetCommit ? 'CURRENT' : 'STALE';
      for (const row of rows) {
        assert(['add', 'edit'].includes(row.host) && Number.isInteger(row.width) && row.width > 0 && Number.isInteger(row.height) && row.height > 0, 'invalid row viewport/host');
        assert([1, 2].includes(row.scaling?.factor) && row.key === `${row.host}-${row.width}-text${row.scaling.factor}`, 'row key/pass mismatch');
        assert(row.sourceCommit === p.sourceCommit, 'row source mismatch');
        assert(typeof row.errorShown === 'boolean' && typeof row.retained === 'boolean'
          && Number.isInteger(row.simulatedFailures) && row.simulatedFailures >= 0
          && Number.isInteger(row.scaling.mismatches) && row.scaling.mismatches >= 0, 'missing execution observation');
        array(row.scaling.fontFailures, 'fontFailures');
        assert(nonempty(row.shot?.file) && row.shot.file.endsWith('.png') && !row.shot.file.includes('/') && isSafeRepoPath(row.shot.file), 'unsafe shot filename');
        const shotPath = `${path.slice(0, path.lastIndexOf('/') + 1)}${row.shot.file}`;
        const shot = current(shotPath), actual = readFileSync(safeFile(shotPath));
        assert(actual.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'not a PNG artifact');
        assert(HASH.test(row.shot.sha256 ?? '') && hash(actual) === row.shot.sha256 && actual.equals(shot.bytes), 'PNG missing/modified/hash mismatch');
        // No packet path, phase, declared state, filename or arbitrary metadata:
        // copying/relabeling the same physical artifact cannot create coverage.
        // The supported format has no independently attested run identity, so
        // identical-pixel runs are deliberately not distinguished here.
        const identity = hash(JSON.stringify([p.sourceCommit, script.oid, row.host,
          row.width, row.height, row.scaling.factor, row.shot.sha256]));
        observations.set(`${path}\0${row.key}`, { path, key: row.key, identity, phase: p.phase, host: row.host,
          width: row.width, height: row.height, pass: `web-text-${row.scaling.factor}`, status: packetStatus,
          sourceCommit: p.sourceCommit, shotPath, sha256: row.shot.sha256 });
      }
      result.packets.push({ path, blob: packet.oid, sourceCommit: p.sourceCommit, status: packetStatus,
        scriptPath: SCRIPT, scriptBlob: script.oid, scriptSha256: p.scriptSha256, rows: rows.length,
        execution: { blocked: array(p.blocked, 'blocked').length, pageErrors: array(p.pageErrors, 'pageErrors').length,
          consoleErrors: array(p.consoleErrors, 'consoleErrors').length },
        executionVerdict: 'NOT_INFERRED', visualVerdict: 'NOT_INFERRED' });
    }
    const consumed = new Set(), consumedIdentities = new Set();
    for (const s of specs) {
      const key = `${s.evidencePath}\0${s.rowKey}`, observation = observations.get(key);
      if (observation) {
        assert(!consumedIdentities.has(observation.identity), 'one observation reused for multiple declared states');
        for (const field of ['host', 'width', 'height', 'pass', 'phase']) assert(s[field] === observation[field], `state/observation mismatch: ${field}`);
        consumed.add(key);
        consumedIdentities.add(observation.identity);
      }
      result.states.push({ ...s, status: observation?.status ?? 'MISSING' });
    }
    result.unmappedEvidence = [...observations].filter(([key]) => !consumed.has(key)).map(([, row]) => row);
    for (const binding of result.bindings) {
      const states = result.states.filter(s => s.screenId === binding.screenId && s.binding === binding.binding);
      if (states.length) binding.status = states.some(s => s.status === 'MISSING') ? 'MISSING'
        : states.some(s => s.status === 'STALE') ? 'STALE' : 'CURRENT';
    }
    result.formatCompleteness = paths.length ? 'COMPLETE_FOR_SUPPORTED_PACKETS' : 'UNKNOWN';
    // Registry has no full independent state×viewport×pass contract. Never infer P3 completion.
    result.completeness = 'PARTIAL';
    stable();
  } catch (error) {
    result.completeness = 'INVALID';
    result.failures.push({ code: 'EVIDENCE_INTEGRITY', message: String(error.message ?? error) });
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {}, evidencePaths = [];
    for (const arg of process.argv.slice(2)) {
      const at = arg.indexOf('='); assert(at > 2, 'use --name=value arguments');
      const name = arg.slice(0, at), value = arg.slice(at + 1);
      assert(['--root', '--expect-commit', '--source-target', '--registry', '--state-contract', '--evidence', '--requested-status'].includes(name), `unknown argument ${name}`);
      if (name === '--evidence') evidencePaths.push(value);
      else { assert(!(name in options), 'duplicate option'); options[name] = value; }
    }
    const result = auditP3Evidence({ root: options['--root'] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'),
      targetCommit: options['--expect-commit'], registryPath: options['--registry'] ?? REGISTRY,
      sourceTargetCommit: options['--source-target'],
      contractPath: options['--state-contract'], requestedStatus: options['--requested-status'] ?? 'CANDIDATE_ONLY', evidencePaths });
    console.log(JSON.stringify(result, null, 2));
    if (result.completeness === 'INVALID') process.exitCode = 1;
  } catch (error) { console.error(String(error.message ?? error)); process.exitCode = 1; }
}
