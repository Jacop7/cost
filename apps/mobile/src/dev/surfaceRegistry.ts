import generated from './surfaceRegistry.generated.json';

export type SurfaceParity = 'aligned' | 'divergent' | 'specOnly' | 'expoOnly';
export type CatalogMode = 'route' | 'fixture' | 'unsupported';

export type SurfaceRegistryEntry = {
  screenId: string;
  domain: 'ingredients' | 'recipes' | 'orders' | 'sales' | 'my';
  name: string;
  expoRoute?: string;
  sourceComponent?: string;
  prototypeTargets?: string[];
  catalogMode?: CatalogMode;
  fixtureKind?: 'stub' | 'devSeedEntity';
  fixtureRef?: Record<string, unknown>;
  states?: string[];
  parity: SurfaceParity;
  reason?: string;
};

type SurfaceRegistryDocument = {
  schemaVersion: 1;
  stage: 'P1';
  surfaces: SurfaceRegistryEntry[];
  catalogProjection: SurfaceRegistryEntry[];
};

function assertSurfaceRegistry(value: unknown): asserts value is SurfaceRegistryDocument {
  if (!value || typeof value !== 'object') throw new Error('surface registry 문서가 객체가 아니다.');
  const document = value as Partial<SurfaceRegistryDocument>;
  if (document.schemaVersion !== 1 || document.stage !== 'P1' || !Array.isArray(document.surfaces))
    throw new Error('surface registry schema/stage가 올바르지 않다.');
  const ids = new Set<string>();
  for (const entry of document.surfaces) {
    if (!/^(?:ING|RCP|ORD|SALES|MY)-\d+[a-z]?$/.test(entry.screenId))
      throw new Error(`surface registry screenId 오류: ${entry.screenId}`);
    if (ids.has(entry.screenId)) throw new Error(`surface registry 중복 screenId: ${entry.screenId}`);
    ids.add(entry.screenId);
    if (!['aligned', 'divergent', 'specOnly', 'expoOnly'].includes(entry.parity))
      throw new Error(`surface registry parity 오류: ${entry.screenId}`);
    if (entry.parity === 'specOnly') {
      if (entry.expoRoute || entry.sourceComponent || entry.prototypeTargets)
        throw new Error(`specOnly 생성 필드 오류: ${entry.screenId}`);
    } else if (!entry.expoRoute || !entry.sourceComponent) {
      throw new Error(`Expo 생성 필드 누락: ${entry.screenId}`);
    }
    if (entry.parity === 'expoOnly' && entry.prototypeTargets)
      throw new Error(`expoOnly prototype target 오류: ${entry.screenId}`);
    if (!['specOnly', 'expoOnly'].includes(entry.parity) && !entry.prototypeTargets?.length)
      throw new Error(`prototype target 누락: ${entry.screenId}`);
  }
}

const registryDocument: unknown = generated;
assertSurfaceRegistry(registryDocument);

export const surfaceRegistry = registryDocument.surfaces;
export const surfaceCatalogProjection = registryDocument.catalogProjection;
