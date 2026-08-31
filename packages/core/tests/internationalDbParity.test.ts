/** INTL-1A TypeScript 기준선과 살아 있는 DB `app_capabilities()` 응답을 직접 대조한다. */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { APP_CAPABILITIES_BASELINE } from '@margincook/types';

const DB = process.env.MARGINCOOK_PARITY_DB;
const CT = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';

function queryCapabilities(): unknown {
  const result = spawnSync(
    'docker',
    ['exec', '-i', CT, 'psql', '-U', 'postgres', '-d', DB!, '-v', 'ON_ERROR_STOP=1', '-At', '-c',
      'select public.app_capabilities()::text'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`psql 실패: ${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

const dbDescribe = DB ? describe : describe.skip;

dbDescribe(`app_capabilities(DB=${DB ?? '없음'}) ↔ TypeScript 기준선`, () => {
  it('서버와 공용 타입이 같은 판본·최소 버전·비활성 상태다', () => {
    const raw = queryCapabilities() as Record<string, unknown>;
    const tax = raw.international_tax as Record<string, unknown>;
    expect({
      contractVersion: raw.contract_version,
      minimumSupportedAppVersion: raw.minimum_supported_app_version,
      internationalTax: {
        contractVersion: tax.contract_version,
        readEnabled: tax.read_enabled,
        writeEnabled: tax.write_enabled,
        minimumWriteAppVersion: tax.minimum_write_app_version,
      },
    }).toEqual(APP_CAPABILITIES_BASELINE);
  });
});

if (!DB) {
  it('MARGINCOOK_PARITY_DB가 없어 살아 있는 DB 대조는 건너뛴다 (verify ④가 실행한다)', () => {
    expect(true).toBe(true);
  });
}
