import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { buildModel } from './appmap/model.mjs';

const root = process.cwd();
const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputPath = resolve(root, outputArg?.slice('--output='.length)
  ?? 'docs/ai-review/tasks/APP-215-SURFACE-AUDIT-20260920/inventory.json');
const registryPath = resolve(root, 'apps/mobile/src/dev/surfaceRegistry.generated.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const model = buildModel(root);

function walk(directory, predicate) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path, predicate);
    return predicate(path) ? [path] : [];
  });
}

const testFiles = [
  ...walk(resolve(root, 'apps/mobile/tests'), (path) => /\.test\.[cm]?[jt]sx?$/.test(path)),
  ...walk(resolve(root, 'packages/core'), (path) => /\.test\.[cm]?[jt]s$/.test(path)),
  ...walk(resolve(root, 'packages/db/tests'), (path) => /\.(?:sql|mjs)$/.test(path)),
];
function resolveModule(fromPath, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = resolve(root, 'apps/mobile/src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromPath), specifier);
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const testCorpus = testFiles.map((path) => {
  const text = readFileSync(path, 'utf8');
  const moduleSpecifiers = [
    ...text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
    ...text.matchAll(/\b(?:import|vi\.mock)\(\s*['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);
  return {
    path: relative(root, path).replaceAll('\\', '/'),
    text,
    importedModules: [...new Set(moduleSpecifiers.map((specifier) => resolveModule(path, specifier)).filter(Boolean))],
  };
});

function resolveExportedComponent(path, symbol) {
  if (!path || !symbol || !existsSync(path)) return path;
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const exports = match[1].split(',').map((part) => part.trim()).filter(Boolean);
    const exposesSymbol = exports.some((entry) => {
      const alias = entry.split(/\s+as\s+/).map((value) => value.trim());
      return (alias[1] ?? alias[0]) === symbol;
    });
    if (exposesSymbol) return resolveModule(path, match[2]) ?? path;
  }
  return path;
}

function linkedSource(path, maxDepth = 4) {
  if (!path || !existsSync(path)) return { files: [], text: '' };
  const files = [];
  const seen = new Set();
  const normalizedPath = path.replaceAll('\\', '/');
  const featureMatch = normalizedPath.match(/^(.*\/apps\/mobile\/src\/features\/[^/]+)\//);
  const featureRoot = featureMatch?.[1] ?? null;
  const visit = (file, depth) => {
    if (!file || seen.has(file) || depth > maxDepth) return;
    if (depth > 0 && featureRoot && !file.replaceAll('\\', '/').startsWith(`${featureRoot}/`)) return;
    seen.add(file);
    files.push(file);
    const text = readFileSync(file, 'utf8');
    const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)]
      .map((match) => resolveModule(file, match[1]))
      .filter(Boolean);
    for (const imported of imports) visit(imported, depth + 1);
  };
  visit(path, 0);
  return { files, text: files.map((file) => readFileSync(file, 'utf8')).join('\n') };
}

function hookTraces(paths) {
  const traces = [];
  for (const path of paths) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const modulePath = resolveModule(path, match[2]);
      if (!modulePath) continue;
      const moduleText = readFileSync(modulePath, 'utf8');
      const names = match[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[1] ?? part.trim().split(/\s+as\s+/)[0])
        .filter((name) => /^use[A-Z][A-Za-z0-9_]*$/.test(name) && new RegExp(`\\b${name}\\b`).test(source.slice(match.index + match[0].length)));
      for (const name of names) {
        const startPattern = new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${name}\\b`);
        const start = moduleText.search(startPattern);
        if (start < 0) continue;
        const rest = moduleText.slice(start);
        const next = rest.slice(1).search(/\nexport\s+(?:async\s+)?(?:function|const|interface|type)\s+/);
        const body = next < 0 ? rest : rest.slice(0, next + 1);
        const rpcReferences = [...new Set([...body.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((rpc) => rpc[1]))];
        traces.push({
          hook: name,
          module: relative(root, modulePath).replaceAll('\\', '/'),
          rpcReferences,
          mutationCandidate: /(?:Save|Create|Update|Delete|Remove|Restore|Finalize|Cancel|Amend|Adjust|Receive|Waste)/.test(name),
        });
      }
    }
  }
  return [...new Map(traces.map((trace) => [`${trace.module}#${trace.hook}`, trace])).values()];
}

function isCompatibilityRedirect(path) {
  if (!path || !existsSync(path)) return false;
  const text = readFileSync(path, 'utf8');
  if (!/<Redirect\b/.test(text)) return false;
  const componentTags = [...text.matchAll(/<([A-Z][A-Za-z0-9.]*)\b/g)].map((match) => match[1]);
  return componentTags.length > 0 && componentTags.every((tag) => tag === 'Redirect');
}

const routeFiles = new Map(registry.sources.routes.files.map(({ route, file }) => [route, file]));
const surfacesById = new Map(registry.surfaces.map((surface) => [surface.screenId, surface]));
const placeholderPattern = /화면 번역은 준비 중|기능은 준비 중|미구현|coming soon|not implemented|TODO|FIXME/gi;

const targets = model.targets.map((target) => {
  const surface = surfacesById.get(target.screenId) ?? null;
  const sourcePath = surface?.sourceComponent?.split('#')[0] ?? null;
  const componentName = surface?.sourceComponent?.split('#')[1] ?? '';
  const absoluteSourceEntry = sourcePath ? resolve(root, sourcePath) : null;
  const absoluteSource = resolveExportedComponent(absoluteSourceEntry, componentName);
  const linked = linkedSource(absoluteSource);
  const hooks = hookTraces(linked.files);
  const placeholderMarkers = [...new Set(linked.text.match(placeholderPattern) ?? [])];
  const route = target.expoRoute?.replace(/^\//, '').split('?')[0] ?? null;
  const searchableComponentName = componentName && componentName !== 'default' ? componentName : '';
  const testReferences = testCorpus
    .filter(({ text, importedModules }) => linked.files.some((file) => importedModules.includes(file))
      || importedModules.includes(absoluteSource)
      || importedModules.includes(absoluteSourceEntry)
      || (searchableComponentName && new RegExp(`\\b${searchableComponentName}\\b`).test(text)))
    .map(({ path }) => path);
  let auditClass = 'requires_functional_trace';
  if (surface?.catalogMode === 'unsupported') auditClass = 'intentional_unsupported';
  else if (isCompatibilityRedirect(absoluteSource)) auditClass = 'compatibility_redirect';
  else if (placeholderMarkers.length) auditClass = 'explicit_partial';
  else if (surface?.catalogMode === 'fixture' || target.previewOnly) auditClass = 'fixture_entry_requires_real_flow';
  return {
    targetId: target.id,
    domain: model.screens[target.screen]?.domain ?? 'unknown',
    screen: target.screen,
    popup: target.popup,
    hidden: Boolean(target.hidden),
    appmapOnly: Boolean(target.appmapOnly),
    previewOnly: Boolean(target.previewOnly),
    expoRoute: target.expoRoute,
    routeFile: route ? routeFiles.get(route) ?? null : null,
    screenId: target.screenId,
    candidateScreenIds: [...new Set([
      target.screenId,
      ...(target.candidates ?? []),
      ...registry.surfaces
        .filter((candidate) => candidate.prototypeTargets?.includes(target.id))
        .map((candidate) => candidate.screenId),
    ].filter(Boolean))],
    mapping: target.mapping,
    registryParity: surface?.parity ?? null,
    catalogMode: surface?.catalogMode ?? null,
    sourceComponent: surface?.sourceComponent ?? null,
    linkedSourceFiles: linked.files.map((file) => relative(root, file).replaceAll('\\', '/')),
    hooks,
    rpcReferences: [...new Set(hooks.flatMap((hook) => hook.rpcReferences))],
    hasMutationCandidate: hooks.some((hook) => hook.mutationCandidate),
    placeholderMarkers,
    testReferences,
    testEvidenceScope: target.popup ? 'screen_entry_only_requires_popup_assertion' : 'screen',
    auditClass,
  };
});

const representedScreenIds = new Set(targets.flatMap((target) => target.candidateScreenIds));
const registrySurfaces = registry.surfaces.map((surface) => {
  const sourcePath = surface.sourceComponent?.split('#')[0] ?? null;
  const componentName = surface.sourceComponent?.split('#')[1] ?? '';
  const absoluteSourceEntry = sourcePath ? resolve(root, sourcePath) : null;
  const absoluteSource = resolveExportedComponent(absoluteSourceEntry, componentName);
  const linked = linkedSource(absoluteSource);
  const placeholderMarkers = [...new Set(linked.text.match(placeholderPattern) ?? [])];
  let auditClass = 'requires_functional_trace';
  if (surface.catalogMode === 'unsupported') auditClass = 'intentional_unsupported';
  else if (isCompatibilityRedirect(absoluteSource)) auditClass = 'compatibility_redirect';
  else if (placeholderMarkers.length) auditClass = 'explicit_partial';
  else if (surface.catalogMode === 'fixture') auditClass = 'fixture_entry_requires_real_flow';
  return {
    screenId: surface.screenId,
    domain: surface.domain,
    name: surface.name,
    expoRoute: surface.expoRoute ?? null,
    sourceComponent: surface.sourceComponent ?? null,
    parity: surface.parity,
    catalogMode: surface.catalogMode ?? null,
    representedInAppMapTargets: representedScreenIds.has(surface.screenId),
    placeholderMarkers,
    auditClass,
  };
});

const countBy = (key) => Object.fromEntries([...new Set(targets.map((target) => target[key]))]
  .map((value) => [String(value), targets.filter((target) => target[key] === value).length])
  .sort(([a], [b]) => a.localeCompare(b)));
const structuralFailures = targets.filter((target) => !target.expoRoute || !target.routeFile || !target.screenId || !target.sourceComponent);
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    registryPath: relative(root, registryPath).replaceAll('\\', '/'),
    registrySha256: createHash('sha256').update(readFileSync(registryPath)).digest('hex'),
    appMapSource: model.source,
    appMapSourceSha256: model.sourceSha256,
  },
  scope: {
    total: model.counts.total,
    active: model.counts.active,
    hidden: model.counts.hidden,
    screens: model.counts.screens,
    popups: model.counts.popups,
    registryScreenIds: registry.surfaces.length,
  },
  summary: {
    byDomain: countBy('domain'),
    byAuditClass: countBy('auditClass'),
    withDirectTestReference: targets.filter((target) => target.testReferences.length > 0).length,
    withRpcTrace: targets.filter((target) => target.rpcReferences.length > 0).length,
    withMutationCandidate: targets.filter((target) => target.hasMutationCandidate).length,
    withoutHookOrRpcTrace: targets.filter((target) => target.hooks.length === 0 && target.rpcReferences.length === 0).length,
    structuralFailures: structuralFailures.length,
    registryByAuditClass: Object.fromEntries([...new Set(registrySurfaces.map((surface) => surface.auditClass))]
      .map((value) => [value, registrySurfaces.filter((surface) => surface.auditClass === value).length])
      .sort(([a], [b]) => a.localeCompare(b))),
    registryNotRepresentedAsChosenTarget: registrySurfaces.filter((surface) => !surface.representedInAppMapTargets).length,
  },
  interpretation: [
    '이 파일은 구조·명시적 부분 구현·직접 시험 참조의 기준선이며 기능 완료 판정이 아니다.',
    'requires_functional_trace는 정상 판정이 아니라 조회·입력·저장·오류·재시도·원장 전파를 후속 검증해야 한다는 뜻이다.',
    'fixture_entry_requires_real_flow는 AppMap fixture가 존재하므로 실제 제품 진입점과 서버 저장 흐름을 별도로 검증해야 한다.',
    'hooks·rpcReferences는 화면에서 최대 4단계의 내부 import를 따라 찾은 후보 연결이다. 동작 성공·권한·원장 전파를 증명하지 않으며 수동 추적의 시작점으로만 쓴다.',
    '팝업의 testReferences는 진입 화면 시험 후보일 뿐이다. 해당 팝업을 여는 동작과 결과 assertion이 확인되기 전에는 팝업 시험 증거로 인정하지 않는다.',
  ],
  structuralFailures,
  registrySurfaces,
  targets,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: relative(root, outputPath).replaceAll('\\', '/'), ...output.scope, ...output.summary }, null, 2));
if (structuralFailures.length) process.exitCode = 1;
