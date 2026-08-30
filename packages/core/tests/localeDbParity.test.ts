/**
 * core LOCALES ↔ **살아 있는 DB** 의 locale_defaults()·locale_combo_ok() 대조 (검토 지적).
 * 정규식으로 SQL 파일을 읽는 시험(localeSqlParity)은 대소문자·문자열 안 문구·quoted identifier 에 속을 수
 * 있다. 여기서는 실제 함수를 **호출한 결과**를 core 목록과 비교한다 — 값이 하나라도 다르면 빨개진다.
 *
 * 실행 조건: MARGINCOOK_PARITY_DB=<db 이름> (로컬 supabase 컨테이너의 DB). 없으면 건너뛰되 그 사실을 남긴다 —
 * `pnpm verify` ③ 이 새 DB 이름으로 이 시험을 돌린다. CI(--no-db)에서는 돌지 않는다.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { LOCALES } from '../src/locale';

const DB = process.env.MARGINCOOK_PARITY_DB;
const CT = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_margincook';

function q(sql: string): string {
  const r = spawnSync('docker', ['exec', '-i', CT, 'psql', '-U', 'postgres', '-d', DB!, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql 실패: ${r.stderr}`);
  return r.stdout.trim();
}

const d = DB ? describe : describe.skip;

d(`locale_defaults(DB=${DB ?? '없음'}) ↔ LOCALES(core)`, () => {
  it('core 의 언어마다 DB 함수가 같은 통화·금액 자릿수를 준다', () => {
    const got = JSON.parse(q(`select coalesce(json_agg(json_build_object('key', k, 'currency', d.currency, 'money_digits', d.money_digits) order by k), '[]')
       from unnest(array[${LOCALES.map((l) => `'${l.key}'`).join(',')}]) k
       left join lateral public.locale_defaults(k) d on true`)) as { key: string; currency: string | null; money_digits: number | null }[];
    const expected = LOCALES.map((l) => ({ key: l.key, currency: l.currency, money_digits: l.moneyDigits }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
    expect(got).toEqual(expected);
  });

  it('DB 가 아는 언어는 core 밖에 없다 — 표의 조합 CHECK 가 core 키 집합으로 닫혀 있다', () => {
    // settings_locale_ck 의 허용 목록을 실제 제약 정의에서 꺼내 core 와 비교한다.
    const def = q(`select pg_get_constraintdef(oid) from pg_constraint where conname = 'settings_locale_ck' and conrelid = 'public.settings'::regclass`);
    const keys = [...def.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
    expect(keys).toEqual(LOCALES.map((l) => l.key).sort());
    // 모르는 키는 어떤 통화로도 조합이 안 된다.
    expect(q(`select public.locale_combo_ok('xx-XX', 'KRW', 0)`)).toBe('f');
    for (const l of LOCALES) {
      expect(q(`select public.locale_combo_ok('${l.key}', '${l.currency}', ${l.moneyDigits})`), l.key).toBe('t');
    }
  });
});

if (!DB) {
  it('MARGINCOOK_PARITY_DB 가 없어 살아 있는 DB 대조는 건너뛴다 (pnpm verify ③ 이 돌린다)', () => {
    expect(true).toBe(true);
  });
}
