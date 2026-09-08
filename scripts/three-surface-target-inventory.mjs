#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = 'apps/mobile/src/dev/surfaceRegistry.generated.json';
const auditPath = 'docs/prototypes/full-page-flow-prototype-render-audit.json';
const sort = (values) => [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const array = (value, label) => {
  requireValue(Array.isArray(value), `${label}: array required`);
  return value;
};
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const unique = (values, label) => {
  requireValue(new Set(values).size === values.length, `${label}: duplicate entry`);
};
const checkCount = (actual, expected, label) => {
  requireValue(Number.isInteger(expected) && expected === actual, `${label}: declared ${expected}, calculated ${actual}`);
};
const frequencies = (values) => Object.fromEntries(sort(new Set(values)).map((key) => [key, values.filter((value) => value === key).length]));
const checkCounts = (actual, expected, label) => {
  requireValue(expected && typeof expected === 'object' && !Array.isArray(expected), `${label}: counts required`);
  requireValue(JSON.stringify(sort(Object.keys(actual))) === JSON.stringify(sort(Object.keys(expected))), `${label}: count keys differ`);
  for (const [key, value] of Object.entries(actual)) checkCount(value, expected[key], `${label}.${key}`);
};

/** Derived inventory only. Ownership does not establish state equivalence or approval. */
export function buildTargetInventory(registry, audit) {
  requireValue(registry?.schemaVersion === 1, 'registry schemaVersion must be 1');
  const surfaces = array(registry.surfaces, 'registry.surfaces');
  const targets = array(audit?.targets, 'audit.targets');
  const routes = array(registry.sources?.routes?.files, 'registry.sources.routes.files');
  unique(surfaces.map((surface) => surface.screenId), 'surface screenId');
  unique(targets.map((target) => target.target), 'audit target');
  unique(routes.map((route) => route.route), 'route name');
  unique(routes.map((route) => route.file), 'route file');
  for (const route of routes) requireValue(nonempty(route.route) && nonempty(route.file), 'route name/file required');

  const targetByKey = new Map();
  for (const target of targets) {
    requireValue(nonempty(target.screen) && typeof target.hidden === 'boolean', `invalid target screen/hidden: ${target.target}`);
    const isScreen = target.popup === null;
    requireValue(isScreen || nonempty(target.popup), `invalid popup: ${target.target}`);
    const expectedKey = isScreen ? `screen:${target.screen}` : `popup:${target.popup}@${target.screen}`;
    requireValue(target.target === expectedKey, `target key/host mismatch: ${target.target}`);
    const kind = target.render?.kind;
    requireValue(isScreen ? kind === 'screen' : ['overlay', 'pageState', 'independent', 'none'].includes(kind), `unknown renderKind: ${target.target}`);
    targetByKey.set(target.target, target);
  }
  // A popup cannot silently acquire a different visibility from its host.
  for (const target of targets.filter((row) => row.popup !== null)) {
    const host = targetByKey.get(`screen:${target.screen}`);
    requireValue(host && host.hidden === target.hidden, `popup host missing/hidden mismatch: ${target.target}`);
  }

  const owners = new Map(targets.map((target) => [target.target, []]));
  const appOnlySurfaces = [];
  for (const surface of surfaces) {
    requireValue(/^(?:ING|RCP|ORD|SALES|MY)-\d+[a-z]?$/.test(surface.screenId), `invalid screenId: ${surface.screenId}`);
    requireValue(nonempty(surface.domain), `domain required: ${surface.screenId}`);
    const states = array(surface.states, `${surface.screenId}.states`);
    requireValue(states.every(nonempty), `invalid states: ${surface.screenId}`);
    unique(states, `${surface.screenId}.states`);
    const owned = surface.prototypeTargets === undefined ? [] : array(surface.prototypeTargets, `${surface.screenId}.prototypeTargets`);
    unique(owned, `${surface.screenId}.prototypeTargets`);
    if (surface.parity === 'expoOnly') {
      requireValue(owned.length === 0 && nonempty(surface.reason), `expoOnly requires no targets and a reason: ${surface.screenId}`);
      appOnlySurfaces.push({ screenId: surface.screenId, domain: surface.domain, states: sort(states), reason: surface.reason });
    } else requireValue(owned.length > 0, `surface has no prototype target and is not expoOnly: ${surface.screenId}`);
    for (const key of owned) {
      requireValue(targetByKey.has(key), `unknown prototype target: ${surface.screenId} -> ${key}`);
      owners.get(key).push(surface.screenId);
    }
  }
  for (const [key, ids] of owners) requireValue(ids.length > 0, `orphan prototype target: ${key}`);

  const subsetCounts = (rows) => ({
    targets: rows.length,
    screens: rows.filter((row) => row.popup === null).length,
    popupPairs: rows.filter((row) => row.popup !== null).length,
    uniquePopupIds: new Set(rows.filter((row) => row.popup !== null).map((row) => row.popup)).size,
  });
  const active = targets.filter((target) => !target.hidden);
  const hidden = targets.filter((target) => target.hidden);
  const prototype = { total: subsetCounts(targets), active: subsetCounts(active), hidden: subsetCounts(hidden) };
  const domainRows = sort(new Set(surfaces.map((surface) => surface.domain))).map((domain) => {
    const domainSurfaces = surfaces.filter((surface) => surface.domain === domain);
    const keys = new Set(domainSurfaces.flatMap((surface) => surface.prototypeTargets ?? []));
    const rows = targets.filter((target) => keys.has(target.target));
    return { domain, appSurfaces: domainSurfaces.length, ...subsetCounts(rows), activeTargets: rows.filter((row) => !row.hidden).length, hiddenTargets: rows.filter((row) => row.hidden).length };
  });
  const activePopupKinds = new Map();
  for (const target of active.filter((row) => row.popup !== null)) {
    const previous = activePopupKinds.get(target.popup);
    requireValue(previous === undefined || previous === target.render.kind, `popup ID has ambiguous renderKind across hosts: ${target.popup}`);
    activePopupKinds.set(target.popup, target.render.kind);
  }
  const summary = {
    prototype,
    app: { surfaces: surfaces.length, routes: routes.length, declaredStateEntries: surfaces.reduce((sum, surface) => sum + surface.states.length, 0), appOnlySurfaces: appOnlySurfaces.length },
    ownershipEdges: [...owners.values()].reduce((sum, ids) => sum + ids.length, 0),
    sharedTargets: [...owners.values()].filter((ids) => ids.length > 1).length,
    domainTargetMemberships: domainRows.reduce((sum, domain) => sum + domain.targets, 0),
    crossDomainDuplicateMemberships: domainRows.reduce((sum, domain) => sum + domain.targets, 0) - targets.length,
    domains: domainRows,
  };
  const auditCounts = {
    targetsMeasured: targets.length, activeTargets: active.length, hiddenTargets: hidden.length,
    activeScreens: prototype.active.screens, activePopupPairs: prototype.active.popupPairs,
    activeUniquePopupIds: prototype.active.uniquePopupIds, duplicateTargets: 0,
  };
  for (const [key, value] of Object.entries(auditCounts)) checkCount(value, audit.summary?.[key], `audit.summary.${key}`);
  checkCounts(frequencies(active.map((target) => target.render.kind)), audit.summary?.renderKindByPair, 'audit.summary.renderKindByPair');
  checkCounts(frequencies([...activePopupKinds.values()]), audit.summary?.renderKindByUniquePopupId, 'audit.summary.renderKindByUniquePopupId');
  for (const [key, value] of Object.entries({ screenIds: surfaces.length, routes: routes.length, prototypeTargets: targets.length })) checkCount(value, registry.inventory?.[key], `registry.inventory.${key}`);
  checkCount(routes.length, registry.sources.routes.count, 'registry.sources.routes.count');
  for (const [key, value] of Object.entries({ screenCount: prototype.total.screens, popupTargetCount: prototype.total.popupPairs, hiddenScreenCount: prototype.hidden.screens, hiddenPopupTargetCount: prototype.hidden.popupPairs })) checkCount(value, registry.sources.prototype?.[key], `registry.sources.prototype.${key}`);

  return {
    schemaVersion: 1,
    kind: 'source-projection',
    scope: 'Declared target ownership only; state mappings, visual approval and completion are not inferred.',
    summary,
    targets: sort(targetByKey.keys()).map((key) => {
      const target = targetByKey.get(key);
      return { target: key, hidden: target.hidden, renderKind: target.render.kind, ownerScreenIds: sort(owners.get(key)) };
    }),
    appOnlySurfaces: appOnlySurfaces.sort((a, b) => a.screenId < b.screenId ? -1 : a.screenId > b.screenId ? 1 : 0),
  };
}

export function main(argv = process.argv.slice(2)) {
  requireValue(argv.length <= 1 && argv.every((arg) => arg.startsWith('--output=') && arg.length > '--output='.length), 'usage: node scripts/three-surface-target-inventory.mjs [--output=<new-file>]');
  const inputs = [registryPath, auditPath].map((path) => ({ path, bytes: readFileSync(resolve(root, path)) }));
  const projection = buildTargetInventory(...inputs.map(({ bytes }) => JSON.parse(bytes.toString('utf8'))));
  if (argv.length) {
    const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const evidence = {
      ...projection,
      provenance: {
        head: git(['rev-parse', 'HEAD']),
        inputWorkingTreeDirty: git(['status', '--porcelain=v1', '--', registryPath, auditPath]) !== '',
        inputs: inputs.map(({ path, bytes }) => ({ path, sha256: sha256(bytes), textSha256: sha256(bytes.toString('utf8').replaceAll('\r\n', '\n')) })),
        scriptSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
      },
    };
    // Exclusive creation: even identical existing diagnostics are never overwritten.
    writeFileSync(resolve(root, argv[0].slice('--output='.length)), `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  }
  console.log(JSON.stringify(projection.summary, null, 2));
  return projection;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`three-surface target inventory: FAIL — ${error.message}`); process.exitCode = 1; }
}
