import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const workingDirectory = resolve('.');
const mobileRoot = existsSync(join(workingDirectory, 'src'))
  ? workingDirectory
  : join(workingDirectory, 'apps/mobile');
const srcRoot = join(mobileRoot, 'src');
const testsRoot = join(mobileRoot, 'tests');
const slash = (path: string) => normalize(path).replaceAll('\\', '/');

const NEW_FILES = [
  'features/business-day/businessDay.ts',
  'features/business-day/components/BusinessDateGate.tsx',
  'features/settings/hooks.ts',
  'features/master-data/hooks.ts',
  'components/history/HistoryLayout.tsx',
  'lib/date.ts',
] as const;

const REMOVED_FILES = [
  'features/sales/businessDay.ts',
  'features/sales/components/BusinessDateGate.tsx',
  'features/ingredients/components/HistoryLayout.tsx',
] as const;

const FORBIDDEN_MODULE_PATHS = new Set([
  'features/sales/businessDay',
  'features/sales/components/BusinessDateGate',
  'features/ingredients/components/HistoryLayout',
]);

const forbiddenModule = (from: string, specifier: string): boolean => {
  const rooted = specifier.startsWith('@/')
    ? specifier.slice(2)
    : specifier.startsWith('.') ? slash(relative(srcRoot, resolve(dirname(from), specifier))) : specifier;
  const withoutExtension = rooted.replace(/\.(?:[cm]?[jt]sx?)$/, '').replace(/\/index$/, '');
  return FORBIDDEN_MODULE_PATHS.has(withoutExtension);
};

const SETTINGS_EXPORTS = [
  'StoreSettings', 'SETTINGS_SHAPE', 'parseStoreSettings', 'useStoreSettings', 'useSaveStoreTax',
  'SettingsSaveResult', 'TaxSaveResult', 'parseSettingsSaveResult', 'parseTaxSaveResult',
  'SaveSettingsInput', 'buildSettingsPayload', 'SaveSettingsMutation', 'useSaveSettings',
  'OperatingHours', 'HoursStatus', 'WeeklyRuleInfo', 'useHoursStatus', 'useSetOperatingHours',
  'useSetStoreTimezone',
] as const;

const MASTER_EXPORTS = [
  'CategoryKind', 'CategoryRow', 'VendorRow', 'ChannelRow', 'MaterialRow', 'SettingsLists',
  'useSettingsLists', 'useSaveCategory', 'useDeleteCategory', 'useReorderCategories',
  'useSaveVendor', 'useEnsureVendor', 'useDeleteVendor', 'useSaveChannel', 'useRetireChannel',
  'useSaveMaterial', 'useDeactivateMaterial',
] as const;

const DATE_EXPORTS = ['parseDay', 'addDays', 'startOfMonth', 'endOfMonth', 'dayLabel', 'rangeLabel'] as const;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

function sourceFile(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}

function moduleStrings(path: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const expression = node.expression;
      const isDynamicImport = expression.kind === ts.SyntaxKind.ImportKeyword;
      const isModuleTool = ts.isPropertyAccessExpression(expression)
        && ['mock', 'doMock', 'importActual', 'importMock'].includes(expression.name.text);
      const isRequire = ts.isIdentifier(expression) && expression.text === 'require';
      if (isDynamicImport || isModuleTool || isRequire) found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(path));
  return found;
}

function exportedNames(path: string, seen = new Set<string>()): Set<string> {
  if (seen.has(path)) return new Set();
  seen.add(path);
  const names = new Set<string>();
  for (const node of sourceFile(path).statements) {
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) names.add(element.name.text);
      } else if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const target = resolveLocal(path, node.moduleSpecifier.text);
        if (target) for (const name of exportedNames(target, seen)) names.add(name);
      }
      continue;
    }
    const exported = ts.canHaveModifiers(node)
      && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    if (ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node)
        || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node)) {
      if (node.name) names.add(node.name.text);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
  }
  return names;
}

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(srcRoot, specifier.slice(2))
    : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
  if (base === null) return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function localImports(path: string): string[] {
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = resolveLocal(path, node.moduleSpecifier.text);
      if (target) imports.push(target);
    }
    if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const expression = node.expression;
      const isDynamicImport = expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(expression) && expression.text === 'require';
      if (isDynamicImport || isRequire) {
        const target = resolveLocal(path, node.arguments[0].text);
        if (target) imports.push(target);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(path));
  return imports;
}

function cycleFrom(start: string, graph: Map<string, string[]>): boolean {
  const seen = new Set<string>();
  const pending = [...(graph.get(start) ?? [])];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    if (current === start) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(graph.get(current) ?? []));
  }
  return false;
}

describe('REF-1 도메인 폴더 경계', () => {
  it('새 소유 경로만 남기고 옛 호환 파일을 두지 않는다', () => {
    for (const path of NEW_FILES) expect(existsSync(join(srcRoot, path)), path).toBe(true);
    for (const path of REMOVED_FILES) expect(existsSync(join(srcRoot, path)), path).toBe(false);
  });

  it('import·re-export·동적 import·vi.mock에 옛 모듈 경로가 없다', () => {
    const stale = [...walk(srcRoot), ...walk(testsRoot)].flatMap((path) =>
      moduleStrings(path)
        .filter((specifier) => forbiddenModule(path, specifier))
        .map((specifier) => `${slash(relative(mobileRoot, path))}: ${specifier}`));
    expect(stale).toEqual([]);
  });

  it('설정·마스터 데이터·날짜 함수의 export 소유권이 한 곳뿐이다', () => {
    const my = exportedNames(join(srcRoot, 'features/my/hooks.ts'));
    const settings = exportedNames(join(srcRoot, 'features/settings/hooks.ts'));
    const master = exportedNames(join(srcRoot, 'features/master-data/hooks.ts'));
    const date = exportedNames(join(srcRoot, 'lib/date.ts'));
    const period = exportedNames(join(srcRoot, 'features/sales/period.ts'));
    const allExports = new Map(walk(srcRoot).map((path) => [path, exportedNames(path)]));

    const expectSoleOwner = (name: string, owner: string): void => {
      const actual = [...allExports]
        .filter(([, names]) => names.has(name))
        .map(([path]) => slash(relative(srcRoot, path)));
      expect(actual, `export 소유자: ${name}`).toEqual([owner]);
    };

    for (const name of SETTINGS_EXPORTS) {
      expect(settings.has(name), `settings: ${name}`).toBe(true);
      expect(my.has(name), `my 잔존: ${name}`).toBe(false);
      expectSoleOwner(name, 'features/settings/hooks.ts');
    }
    for (const name of MASTER_EXPORTS) {
      expect(master.has(name), `master-data: ${name}`).toBe(true);
      expect(my.has(name), `my 잔존: ${name}`).toBe(false);
      expectSoleOwner(name, 'features/master-data/hooks.ts');
    }
    for (const name of DATE_EXPORTS) {
      expect(date.has(name), `date: ${name}`).toBe(true);
      expect(period.has(name), `sales/period 잔존: ${name}`).toBe(false);
      expectSoleOwner(name, 'lib/date.ts');
    }
    expect(period.has('periods')).toBe(true);
  });

  it('공통 모듈이 화면 도메인을 역으로 참조하지 않는다', () => {
    const dateModules = moduleStrings(join(srcRoot, 'lib/date.ts'));
    const historyModules = moduleStrings(join(srcRoot, 'components/history/HistoryLayout.tsx'));
    const settingsModules = moduleStrings(join(srcRoot, 'features/settings/hooks.ts'));
    const masterModules = moduleStrings(join(srcRoot, 'features/master-data/hooks.ts'));
    const myModules = moduleStrings(join(srcRoot, 'features/my/hooks.ts'));
    const businessModules = NEW_FILES
      .filter((path) => path.startsWith('features/business-day/'))
      .flatMap((path) => moduleStrings(join(srcRoot, path)));

    expect(dateModules).toEqual([]);
    expect(historyModules.filter((module) => module.startsWith('@/features/'))).toEqual([]);
    expect(settingsModules.filter((module) => module.startsWith('@/features/'))).toEqual([]);
    expect(masterModules.filter((module) => module.startsWith('@/features/'))).toEqual([]);
    expect(myModules.filter((module) => /^@\/features\/(settings|master-data)(\/|$)/.test(module))).toEqual([]);
    expect(businessModules.filter((module) =>
      module.startsWith('@/features/') && !module.startsWith('@/features/business-day/'))).toEqual([]);
  });

  it('새 경계 모듈이 참여하는 순환 의존이 없다', () => {
    const sourceFiles = walk(srcRoot);
    const graph = new Map(sourceFiles.map((path) => [path, localImports(path)]));
    const cyclic = NEW_FILES
      .map((path) => join(srcRoot, path))
      .filter((path) => cycleFrom(path, graph))
      .map((path) => slash(relative(srcRoot, path)));
    expect(cyclic).toEqual([]);
  });

  it('kit 하위 모듈은 공개 배럴을 역참조하지 않고 전체 kit 순환이 없다', () => {
    const kitRoot = join(srcRoot, 'components/kit');
    const kitFiles = walk(kitRoot);
    const barrel = join(kitRoot, 'index.tsx');
    const reverseImports = kitFiles
      .filter((path) => path !== barrel)
      .flatMap((path) => moduleStrings(path)
        .filter((specifier) => specifier === './index' || specifier === '@/components/kit')
        .map((specifier) => `${slash(relative(srcRoot, path))}: ${specifier}`));
    const graph = new Map(kitFiles.map((path) => [
      path,
      localImports(path).filter((target) => target.startsWith(kitRoot)),
    ]));
    const cyclic = kitFiles
      .filter((path) => cycleFrom(path, graph))
      .map((path) => slash(relative(srcRoot, path)));

    expect(reverseImports).toEqual([]);
    expect(cyclic).toEqual([]);
  });
});
