import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { scaleRecipeSimulation } from '../src';
import type { RecipeSimulationRow } from '@margincook/types';

const one: RecipeSimulationRow = { servings: 1, listedTotal: 12000, tax: 1091, netSales: 10909, customerTotal: 12000,
  material: 2806.4, extra: 300, fixed: 3756, profit: 4046.6, profitRate: 4046.6 / 12000, meetsTarget: false };

it('서버 1인분 원본과 비율을 유지하고 반올림 전 금액에 수량을 곱한다', () => {
  const original = structuredClone(one);
  const result = scaleRecipeSimulation(one, 3);
  expect(result).toMatchObject({ servings: 3, tax: 3273, material: 8419.2, profit: 12139.8,
    profitRate: one.profitRate, meetsTarget: false });
  expect(one).toEqual(original);
  expect(scaleRecipeSimulation({ ...one, material: null, profit: null, profitRate: null, meetsTarget: null }, 3))
    .toMatchObject({ tax: 3273, material: null, profit: null, profitRate: null, meetsTarget: null });
});

it('잘못된 판매량과 표현 범위 초과를 계산값으로 표시하지 않는다', () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) expect(scaleRecipeSimulation(one, quantity)).toBeNull();
});

// 0203 SQL의 amount*n 비교를 PostgreSQL numeric으로 실행한다. DB 쓰기는 없다.
it.skipIf(!process.env.MARGINCOOK_PARITY_DB)('SQL numeric 인분 배수와 core 표시 값이 같다', () => {
  const fields = ['listedTotal','tax','netSales','customerTotal','material','extra','fixed','profit'] as const;
  const pairs = fields.map(k => `'${k}', ${one[k]}::numeric * n`).join(',');
  const sql = `select json_agg(json_build_object('servings',n,${pairs}) order by n) from (values (1),(3),(10)) as counts(n);`;
  const output = spawnSync('docker', ['exec','-i','supabase_db_margincook','psql','-U','postgres','-d',process.env.MARGINCOOK_PARITY_DB!, '-v','ON_ERROR_STOP=1','-At','-c',sql], { encoding:'utf8' });
  expect(output.status, output.stderr).toBe(0);
  for (const expected of JSON.parse(output.stdout)) expect(scaleRecipeSimulation(one, expected.servings)).toMatchObject(expected);
});
