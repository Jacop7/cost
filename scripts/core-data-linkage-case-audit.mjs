import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = resolve(ROOT, 'docs/기능정의서.md');
const OUTPUT = resolve(
  ROOT,
  'docs/ai-review/tasks/APP-215-SURFACE-AUDIT-20260920/core-data-linkage-cases.json',
);
const CORE_DOMAINS = new Set(['ING', 'RCP', 'ORD', 'SALES']);
const PENDING_PATTERNS = [
  /개별 시나리오 증거 미대조/,
  /개별 결속 대기/,
  /증거 미대조/,
  /미실행/,
  /미확인/,
  /미완료/,
  /미수집/,
  /최신 실행과 미대조/,
  /전체 SHA 미봉인/,
  /추가 통합 필요/,
  /최종 판본 증거 연결/,
  /증거 없음/,
  /근거 없음/,
];
const PARTIAL_PATTERNS = [/부분 구현/, /관련 검사 확인/, /일부 확인/, /보강 필요/, /대기/];
const FAILED_PATTERNS = [/(?:^|\s)FAIL(?:\s|$)/i, /실패(?:함|$)/];

function cells(line) {
  return line.split('|').slice(1, -1).map(value => value.trim());
}

function domainsOf(value) {
  return [...new Set([...value.matchAll(/FN-(ING|RCP|ORD|SALES|MY)-\d+/g)].map(match => match[1]))];
}

export function evidenceState(result) {
  if (FAILED_PATTERNS.some(pattern => pattern.test(result))) return 'failed';
  if (PENDING_PATTERNS.some(pattern => pattern.test(result))) return 'needs_evidence';
  if (PARTIAL_PATTERNS.some(pattern => pattern.test(result))) return 'partial';
  return 'verified';
}

export function evidenceGaps(result, state = evidenceState(result)) {
  if (state === 'verified') return [];
  const gaps = [];
  if (/실기기|기기 확인|기기 검증|OS별|외부 복귀|자정 경계/.test(result)) gaps.push('native_device');
  if (/통신|네트워크|RPC 실패|오류 조합|오류 또는/.test(result)) gaps.push('failure_path');
  if (/최종 판본|SHA|최신 실행/.test(result)) gaps.push('version_binding');
  if (/보장 없음|실패 재현·수정|추가 통합 필요/.test(result)) gaps.push('implementation');
  if (!gaps.length) gaps.push('integration');
  return gaps;
}

function assertUnique(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`${label} ID 중복: ${row.id}`);
    seen.add(row.id);
  }
}

export function buildAudit(markdown) {
  const lines = markdown.split(/\r?\n/);
  const relationships = [];
  const scenarios = [];

  lines.forEach((line, index) => {
    if (/^\|\s*REL-\d+\s*\|/.test(line)) {
      const row = cells(line);
      if (row.length !== 8) throw new Error(`REL 표 열 수 오류: ${index + 1}행 (${row.length})`);
      const domains = domainsOf(row[1]);
      relationships.push({
        id: row[0],
        line: index + 1,
        sourceTarget: row[1],
        relationshipType: row[2],
        triggerAndPayload: row[3],
        serverTiming: row[4],
        refreshTarget: row[5],
        invariant: row[6],
        scenarioRef: row[7],
        domains,
      });
    }

    if (/^\|\s*SC-FN-[A-Z]+-\d+-\d+\s*\|/.test(line)) {
      const row = cells(line);
      if (row.length !== 4 && row.length !== 5) {
        throw new Error(`SC 표 열 수 오류: ${index + 1}행 (${row.length})`);
      }
      const domain = row[0].match(/^SC-FN-([A-Z]+)-/)?.[1];
      const requiredEvidence = row.length === 5 ? row[3] : null;
      const currentResult = row.length === 5 ? row[4] : row[3];
      const state = evidenceState(currentResult);
      scenarios.push({
        id: row[0],
        line: index + 1,
        domain,
        conditionAction: row[1],
        expectedResult: row[2],
        requiredEvidence,
        currentResult,
        evidenceState: state,
        evidenceGaps: evidenceGaps(currentResult, state),
      });
    }
  });

  assertUnique(relationships, '관계');
  assertUnique(scenarios, '시나리오');
  if (!relationships.length || !scenarios.length) throw new Error('핵심 관계 또는 시나리오를 찾지 못했습니다.');

  const coreRelationships = relationships.filter(row => row.domains.some(domain => CORE_DOMAINS.has(domain)));
  const scenarioIds = new Set(scenarios.map(row => row.id));
  const brokenScenarioRefs = coreRelationships
    .filter(row => row.scenarioRef.startsWith('SC-FN-') && !scenarioIds.has(row.scenarioRef))
    .map(row => ({ id: row.id, scenarioRef: row.scenarioRef }));
  if (brokenScenarioRefs.length) {
    throw new Error(`존재하지 않는 시나리오 참조: ${JSON.stringify(brokenScenarioRefs)}`);
  }

  const coreScenarios = scenarios.filter(row => CORE_DOMAINS.has(row.domain));
  const byState = Object.fromEntries(
    ['verified', 'partial', 'needs_evidence', 'failed'].map(state => [
      state,
      coreScenarios.filter(row => row.evidenceState === state).length,
    ]),
  );
  const byDomain = Object.fromEntries([...CORE_DOMAINS].map(domain => [
    domain,
    {
      relationships: coreRelationships.filter(row => row.domains.includes(domain)).length,
      scenarios: coreScenarios.filter(row => row.domain === domain).length,
      verified: coreScenarios.filter(row => row.domain === domain && row.evidenceState === 'verified').length,
      outstanding: coreScenarios.filter(row => row.domain === domain && row.evidenceState !== 'verified').length,
    },
  ]));
  const byGap = Object.fromEntries(
    ['implementation', 'failure_path', 'version_binding', 'native_device', 'integration'].map(gap => [
      gap,
      coreScenarios.filter(row => row.evidenceGaps.includes(gap)).length,
    ]),
  );

  return {
    schemaVersion: 1,
    source: relative(ROOT, SPEC).replaceAll('\\', '/'),
    scope: ['ING', 'RCP', 'ORD', 'SALES'],
    generatedFromSource: true,
    counts: {
      relationships: coreRelationships.length,
      scenarios: coreScenarios.length,
      ...byState,
      outstanding: coreScenarios.length - byState.verified,
    },
    byDomain,
    byGap,
    relationships: coreRelationships,
    scenarios: coreScenarios,
  };
}

function main() {
  const audit = buildAudit(readFileSync(SPEC, 'utf8'));
  const rendered = `${JSON.stringify(audit, null, 2)}\n`;

  if (process.argv.includes('--write')) {
    writeFileSync(OUTPUT, rendered, 'utf8');
    console.log(`WRITE ${relative(ROOT, OUTPUT)} — 관계 ${audit.counts.relationships}, 시나리오 ${audit.counts.scenarios}`);
  } else {
    const current = readFileSync(OUTPUT, 'utf8');
    if (current !== rendered) {
      console.error(`FAIL ${relative(ROOT, OUTPUT)}가 ${relative(ROOT, SPEC)}와 다릅니다. --write로 갱신하세요.`);
      process.exitCode = 1;
    } else {
      console.log(
        `PASS 핵심 데이터 연결 경우의 수: 관계 ${audit.counts.relationships}, ` +
        `시나리오 ${audit.counts.scenarios}, 검증 ${audit.counts.verified}, 미결 ${audit.counts.outstanding}`,
      );
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
