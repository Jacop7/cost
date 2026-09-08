/**
 * P3 successor CANDIDATE contract, not an official approval/verify gate.
 * Pure validation: this module does not read Git, disk, or reviewer services.
 * The caller MUST independently acquire and verify `observed` from Git/FS and
 * authenticated read-only review receipts. A self-authored manifest copied to
 * `observed` proves nothing. In particular, observed.anchorIsAncestor and review
 * provenance cannot be established by this function. Never promote a result
 * without that adapter and the existing project approval gates.
 *
 * Both inputs: anchorCommit, targetCommit, files[{path,beforeBlob,afterBlob,beforeMode,afterMode}].
 * observed also: anchorIsAncestor, cleanTracked, cleanUntrackedProduct,
 * requiredStates[string],
 * evidence[{stateId,path,sha256,targetCommit}], historicalFindings/currentFindings
 * [{id,ruleId,stateId,path,...}], reviews[{id,targetCommit,readOnly,verdict,...}],
 * pendingNative[string]. Manifest also: evidence (same shape), findings
 * {carried,new,resolved} (full Finding objects), reviews, requestedStatus.
 * SHA-1 Git repositories only. null blob+mode means absent; renames are delete+add.
 * Only regular files (100644/100755) are accepted, never symlinks/submodules.
 * cleanUntrackedProduct requires independent enumeration of the product roots:
 * git's clean tracked status alone misses untracked source used by a dev server.
 * Evidence state IDs include the full screen/state/surface/viewport/pass identity;
 * the independent inventory, not this manifest, defines requiredStates.
 */
const oid = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const statuses = new Set(['CANDIDATE_ONLY', 'APPROVED', 'FINAL_CLOSED']);
const canonical = (v) => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x);
const record = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

export function isSafeRepoPath(path) {
  if (typeof path !== 'string' || !path || path.trim() !== path) return false;
  // Literal exact matching ONLY, never shell/glob interpolation. [] and () are
  // legitimate Expo route filenames; [ab] means that exact Git path, not a glob.
  if (/[\\\x00-\x1f\x7f:*?"<>|%#{}]/u.test(path) || path.startsWith('/')) return false;
  return path.split('/').every((part) => part && part !== '.' && part !== '..'
    && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

export function validateP3Successor(manifest, observed) {
  const failures = [];
  const fail = (code, detail) => failures.push({ code, detail });
  if (!record(manifest) || !record(observed)) return {
    status: 'INVALID', failures: [{ code: 'INPUT', detail: 'manifest and observed must be objects' }],
  };
  const list = (value, label) => {
    if (!Array.isArray(value)) { fail('ARRAY_REQUIRED', label); return []; }
    return value;
  };
  const index = (rows, key, label) => {
    const result = new Map();
    for (const row of list(rows, label)) {
      if (!record(row) || typeof row[key] !== 'string' || !row[key].trim()) {
        fail('ROW_ID', label); continue;
      }
      if (result.has(row[key])) fail('DUPLICATE', `${label}:${row[key]}`);
      result.set(row[key], row);
    }
    return result;
  };
  const strings = (rows, label) => {
    const result = new Set();
    for (const value of list(rows, label)) {
      if (typeof value !== 'string' || !value.trim()) fail('STRING_ID', label);
      else {
        if (result.has(value)) fail('DUPLICATE', `${label}:${value}`);
        result.add(value);
      }
    }
    return result;
  };
  const equalSets = (a, b, label) => {
    for (const key of a) if (!b.has(key)) fail('EXTRA', `${label}:${key}`);
    for (const key of b) if (!a.has(key)) fail('MISSING', `${label}:${key}`);
  };
  const matchRows = (actual, expected, label) => {
    equalSets(new Set(actual.keys()), new Set(expected.keys()), label);
    for (const [key, value] of actual) if (expected.has(key) && canonical(value) !== canonical(expected.get(key)))
      fail('ROW_MISMATCH', `${label}:${key}`);
  };
  for (const field of ['anchorCommit', 'targetCommit']) {
    if (!oid.test(manifest[field] ?? '') || !oid.test(observed[field] ?? '')) fail('COMMIT_FORMAT', field);
    if (manifest[field] !== observed[field]) fail('COMMIT_MISMATCH', field);
  }
  if (observed.anchorIsAncestor !== true) fail('ANCHOR_ANCESTRY', 'Independent ancestry assertion required');
  if (observed.cleanTracked !== true) fail('DIRTY_TARGET', 'Independent clean tracked assertion required');
  if (observed.cleanUntrackedProduct !== true) fail('UNTRACKED_PRODUCT', 'Independent clean untracked product assertion required');

  const fileSets = [index(manifest.files, 'path', 'manifest.files'), index(observed.files, 'path', 'observed.files')];
  for (const files of fileSets) for (const file of files.values()) {
    if (!isSafeRepoPath(file.path)) fail('UNSAFE_PATH', file.path);
    for (const field of ['beforeBlob', 'afterBlob'])
      if (file[field] !== null && !oid.test(file[field] ?? '')) fail('BLOB_FORMAT', `${file.path}:${field}`);
    for (const side of ['before', 'after']) {
      const mode = file[`${side}Mode`], blob = file[`${side}Blob`];
      if (![null, '100644', '100755'].includes(mode)) fail('FILE_MODE', `${file.path}:${side}`);
      if ((mode === null) !== (blob === null)) fail('ABSENCE_PAIR', `${file.path}:${side}`);
    }
    if (file.beforeBlob === file.afterBlob && file.beforeMode === file.afterMode) fail('NOT_A_DELTA', file.path);
  }
  matchRows(fileSets[0], fileSets[1], 'files');

  const required = strings(observed.requiredStates, 'observed.requiredStates');
  if (!required.size) fail('EMPTY_INVENTORY', 'At least one independently enumerated state is required');
  const evidenceSets = [index(manifest.evidence, 'stateId', 'manifest.evidence'), index(observed.evidence, 'stateId', 'observed.evidence')];
  for (const evidence of evidenceSets) {
    equalSets(new Set(evidence.keys()), required, 'evidenceStates');
    for (const row of evidence.values()) {
      if (!isSafeRepoPath(row.path)) fail('UNSAFE_PATH', row.path);
      if (!digest.test(row.sha256 ?? '')) fail('EVIDENCE_DIGEST', row.stateId);
      if (row.targetCommit !== observed.targetCommit) fail('EVIDENCE_TARGET', row.stateId);
    }
  }
  matchRows(evidenceSets[0], evidenceSets[1], 'evidence');

  const previous = index(observed.historicalFindings, 'id', 'observed.historicalFindings');
  const current = index(observed.currentFindings, 'id', 'observed.currentFindings');
  const findingGroups = {};
  for (const name of ['carried', 'new', 'resolved'])
    findingGroups[name] = index(manifest.findings?.[name], 'id', `findings.${name}`);
  const identity = (f) => ({ id: f.id, ruleId: f.ruleId, stateId: f.stateId, path: f.path });
  for (const group of [previous, current, ...Object.values(findingGroups)]) for (const f of group.values()) {
    if (typeof f.ruleId !== 'string' || !f.ruleId.trim() || typeof f.stateId !== 'string' || !f.stateId.trim())
      fail('FINDING_IDENTITY', f.id);
    if (!isSafeRepoPath(f.path)) fail('UNSAFE_PATH', f.path);
  }
  // IDs cannot silently acquire a different rule/state/path between inventories.
  for (const [id, f] of current) if (previous.has(id) && canonical(identity(f)) !== canonical(identity(previous.get(id))))
    fail('FINDING_ID_REUSED', id);
  const expected = { carried: new Map(), new: new Map(), resolved: new Map() };
  for (const [id, f] of current) expected[previous.has(id) ? 'carried' : 'new'].set(id, f);
  for (const [id, f] of previous) if (!current.has(id)) expected.resolved.set(id, f);
  for (const name of Object.keys(expected)) matchRows(findingGroups[name], expected[name], `findings.${name}`);

  const reviews = index(manifest.reviews, 'id', 'manifest.reviews');
  const observedReviews = index(observed.reviews, 'id', 'observed.reviews');
  matchRows(reviews, observedReviews, 'reviews');
  for (const review of reviews.values()) {
    if (review.targetCommit !== observed.targetCommit) fail('REVIEW_TARGET', review.id);
    if (review.readOnly !== true) fail('REVIEW_NOT_READ_ONLY', review.id);
    if (!['PASS', 'CHANGES_REQUIRED'].includes(review.verdict)) fail('REVIEW_VERDICT', review.id);
  }
  const requested = manifest.requestedStatus;
  if (!statuses.has(requested)) fail('REQUESTED_STATUS', String(requested));
  const pendingNative = strings(observed.pendingNative, 'observed.pendingNative');
  if (requested === 'APPROVED' || requested === 'FINAL_CLOSED') {
    if (!reviews.size || [...reviews.values()].some((r) => r.verdict !== 'PASS'))
      fail('APPROVAL_REQUIRED', 'Exact-target, read-only PASS receipt required; unresolved review blocks approval');
  }
  if (requested === 'FINAL_CLOSED') {
    if (pendingNative.size) fail('NATIVE_PENDING', [...pendingNative].join(','));
    if (current.size) fail('FINDINGS_OPEN', [...current.keys()].join(','));
  }
  return {
    status: failures.length ? 'INVALID' : requested,
    failures,
    scope: 'Pure candidate consistency only; not Git/FS provenance or official project approval',
    targetCommit: observed.targetCommit,
    counts: { files: fileSets[1].size, states: required.size, carried: expected.carried.size,
      new: expected.new.size, resolved: expected.resolved.size, pendingNative: pendingNative.size },
  };
}
