export const effectiveParity = (document, entry) => entry.parity ?? document.defaults?.parity;

export function migrationEntries(document) {
  return (document.surfaces ?? [])
    .filter((entry) => entry.migrationPending)
    .map((entry) => ({
      screenId: entry.screenId,
      owner: entry.migrationPending.owner,
      expiresAt: entry.migrationPending.expiresAt,
      targets: [...entry.migrationPending.targets],
    }))
    .sort((left, right) => left.screenId < right.screenId ? -1 : left.screenId > right.screenId ? 1 : 0);
}

export function validateMigrationTransition(previousBaseline, currentBaseline, previousDeclarations, currentDeclarations) {
  const failures = [];
  const previousMax = previousBaseline?.thresholds?.migrationBacklogMax;
  const currentMax = currentBaseline?.thresholds?.migrationBacklogMax;
  const previousMigrations = migrationEntries(previousDeclarations);
  const currentMigrations = migrationEntries(currentDeclarations);
  const previousMigrationIds = new Set(previousMigrations.map((entry) => entry.screenId));
  const addedMigrationIds = currentMigrations
    .map((entry) => entry.screenId)
    .filter((screenId) => !previousMigrationIds.has(screenId));

  if (Number.isInteger(previousMax) && Number.isInteger(currentMax)
    && currentMax > previousMax && addedMigrationIds.length > 0) {
    failures.push(`migrationBacklogMax 인상(${previousMax}→${currentMax})과 신규 migrationPending(${addedMigrationIds.join(', ')})을 같은 commit에 담을 수 없다.`);
  }

  const previousPermanent = new Set((previousDeclarations.surfaces ?? [])
    .filter((entry) => effectiveParity(previousDeclarations, entry) === 'divergent' && !entry.migrationPending)
    .map((entry) => entry.screenId));
  for (const entry of currentDeclarations.surfaces ?? []) {
    if (previousPermanent.has(entry.screenId) && entry.migrationPending)
      failures.push(`영구 divergent ${entry.screenId}에는 migrationPending을 붙일 수 없다.`);
  }
  return failures;
}

export function buildMigrationBacklog(generatedRegistry, baseline) {
  return {
    schemaVersion: 1,
    stage: 'P3_TO_P5',
    authority: 'GENERATED_FROM_SURFACE_REGISTRY',
    source: {
      declarations: generatedRegistry.sources.declarations,
      migrationBacklogMax: baseline.thresholds.migrationBacklogMax,
      migrationDeadlineUtc: baseline.thresholds.migrationDeadlineUtc,
    },
    entries: (generatedRegistry.surfaces ?? [])
      .filter((entry) => entry.migrationPending)
      .map((entry) => ({
        screenId: entry.screenId,
        domain: entry.domain,
        owner: entry.migrationPending.owner,
        expiresAt: entry.migrationPending.expiresAt,
        targets: [...entry.migrationPending.targets],
      }))
      .sort((left, right) => left.screenId < right.screenId ? -1 : left.screenId > right.screenId ? 1 : 0),
  };
}
