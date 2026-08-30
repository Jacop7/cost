import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = resolve('.');
const mobileRoot = cwd.endsWith('apps\\mobile') || cwd.endsWith('apps/mobile')
  ? cwd
  : join(cwd, 'apps/mobile');
const repoRoot = resolve(mobileRoot, '../..');
const readMobile = (path: string) => readFileSync(join(mobileRoot, path), 'utf8');
const readRepo = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

interface InventoryRow {
  id: string;
  description: string;
  implementation: string;
}

function inventoryRows(): InventoryRow[] {
  return readMobile('src/features/README.md')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => /^(ING|RCP|ORD|SALES|MY)-/.test(cells[1] ?? ''))
    .map((cells) => ({ id: cells[1]!, description: cells[2]!, implementation: cells[3]! }));
}

describe('P2-4 화면 ID 단일 인벤토리', () => {
  it('인벤토리의 정식 ID는 형식이 맞고 서로 중복되지 않는다', () => {
    const rows = inventoryRows();
    expect(rows.length).toBeGreaterThan(40);
    for (const row of rows) expect(row.id).toMatch(/^(ING|RCP|ORD|SALES|MY)-\d{2}[a-z]?$/);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it('충돌을 해소한 화면은 라우트 인벤토리와 파일 머리말이 같은 ID를 쓴다', () => {
    const cases = [
      ['ING-06', '구매 링크·옵션 수정', 'ingredients/option', 'src/features/ingredients/screens/PurchaseOptionScreen.tsx'],
      ['ING-11', '식재료 수정 내역', 'ingredients/changes/[id]', 'src/features/changes/screens/ChangeHistoryScreen.tsx'],
      ['MY-02', '세금', 'my/tax', 'src/features/my/screens/MyTaxScreen.tsx'],
      ['MY-03a', '카테고리 편집', 'my/category', 'src/features/my/screens/MyCategoryScreen.tsx'],
      ['MY-05b', '고정 지출 수정', 'recipes/fixed-cost-edit', 'src/features/my/screens/FixedCostEditScreen.tsx'],
      ['MY-11', '구매처·브랜드', 'my/vendors', 'src/features/my/screens/MyVendorsScreen.tsx'],
      ['SALES-04', '채널별 손익', 'sales/channel', 'src/features/sales/screens/SalesChannelScreen.tsx'],
      ['SALES-11', '고정 지출 상세', 'sales/fixed', 'src/features/sales/screens/SalesFixedScreen.tsx'],
    ] as const;
    const rows = inventoryRows();
    for (const [id, description, route, sourcePath] of cases) {
      expect(rows, `${id}: 인벤토리`).toContainEqual(expect.objectContaining({ id }));
      const row = rows.find((candidate) => candidate.id === id)!;
      expect(row.description).toContain(description);
      expect(row.implementation).toContain(route);
      expect(existsSync(join(mobileRoot, 'app/(tabs)', `${route}.tsx`)), `${route}: Expo route`).toBe(true);
      expect(readMobile(sourcePath), `${sourcePath}: 머리말`).toContain(id);
    }
  });

  it('상세·이력 프로토타입도 현재 화면 인벤토리 번호를 쓴다', () => {
    const detail = readRepo('docs/prototypes/all-detail-history-screens.html');
    const expected = {
      stock_add: 'ING-03b', ingredient_changes: 'ING-11', options: 'ING-06',
      fixed_average: 'MY-05', fixed_actual: 'MY-05b',
      channel: 'SALES-04', menu: 'SALES-09', sales_fixed: 'SALES-11',
      revenue: 'SALES-12', material: 'SALES-13', extra: 'SALES-15',
      waste: 'SALES-17', tax: 'SALES-18', expense: 'SALES-20',
    } as const;
    for (const [key, id] of Object.entries(expected)) {
      expect(detail, `${key}: ${id}`).toMatch(new RegExp(`${key}:\\{[^\\n]+route:'${id}'`));
    }
    expect(readRepo('docs/prototypes/ingredient-stock-add.html')).toContain('ING-03b · 빠른 입고');
    expect(readRepo('docs/prototypes/ingredient-purchase-history-detail.html')).toContain('ING-09 · 구매 이력 상세');
  });
});
