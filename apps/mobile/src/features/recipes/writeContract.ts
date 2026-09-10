/** Recipe write protocol. A submitted object is a value, never a getter over current draft/query data. */
export type RecipePatch = 'create' | 'full' | 'memo' | 'active';
export type RecipeScope = Readonly<{ actorId: string; storeId: string }>;
export type RecipePayload = Readonly<Record<string, unknown>>;
export interface RecipeInput {
  patch: RecipePatch;
  requestId: string;
  id?: string;
  expectedRevision?: string;
  name?: string;
  price?: number;
  categoryId?: string | null;
  active?: boolean;
  memo?: string | null;
  baseServings?: number;
  targetProfitRate?: number;
  avgMonthlySales?: number | null;
  lines?: { ingredientId?: string | null; subRecipeId?: string | null; inputQty: number }[];
  extras?: { materialId?: string | null; name?: string; amountPerServing?: number; qty?: number }[];
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function recipeRevision(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)
    || BigInt(value) > 9223372036854775807n) throw new Error('레시피 판본을 확인하지 못했어요. 다시 불러와 주세요.');
  return value;
}
export function recipeRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  // An idempotency identifier, not an authentication token. Collisions are rejected by the server.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
export function freezeRecipeValue<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (item: unknown): void => {
    if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); }
  };
  freeze(copy); return copy;
}
export function recipePayload(input: RecipeInput): RecipePayload {
  if (!UUID.test(input.requestId) || !['create', 'full', 'memo', 'active'].includes(input.patch)) {
    throw new Error('저장 요청을 준비하지 못했어요. 다시 시도해 주세요.');
  }
  const body: Record<string, unknown> = { contract_version: 2, request_id: input.requestId, patch: input.patch };
  if (input.patch === 'create') {
    if (input.id !== undefined || input.expectedRevision !== undefined || input.active !== undefined) {
      throw new Error('새 레시피 저장 요청이 올바르지 않아요.');
    }
  } else {
    if (typeof input.id !== 'string' || !UUID.test(input.id)) throw new Error('레시피 대상을 확인하지 못했어요.');
    body.id = input.id; body.expected_revision = recipeRevision(input.expectedRevision);
  }
  if (input.patch === 'memo' || input.patch === 'active') {
    // Never serialize an editable header into a narrow patch.
    if (input.patch === 'memo') {
      if (typeof input.memo !== 'string' && input.memo !== null) throw new Error('메모 저장 요청이 올바르지 않아요.');
      body.memo = input.memo;
    } else {
      if (typeof input.active !== 'boolean') throw new Error('판매 상태를 확인하지 못했어요.');
      body.active = input.active;
    }
  } else {
    if (typeof input.name !== 'string' || !input.name.trim() || !Number.isFinite(input.price)
      || !Number.isFinite(input.baseServings) || !Number.isFinite(input.targetProfitRate)) {
      throw new Error('레시피 입력 내용을 확인해 주세요.');
    }
    Object.assign(body, { name: input.name, price: input.price, base_servings: input.baseServings, target_profit_rate: input.targetProfitRate });
    if (input.avgMonthlySales !== undefined) body.avg_monthly_sales = input.avgMonthlySales;
    if (input.memo !== undefined) body.memo = input.memo;
    if (input.categoryId !== undefined) body.category_id = input.categoryId;
    if (input.active !== undefined) body.active = input.active;
    if (input.lines !== undefined) {
      if (input.lines.some(l => l.subRecipeId != null)) throw new Error('반제품은 저장할 수 없어요.');
      body.lines = input.lines.map(l => ({ ingredient_id: l.ingredientId ?? '', input_qty: l.inputQty }));
    }
    if (input.extras !== undefined) body.extras = input.extras.map(e => ({ material_id: e.materialId ?? '', name: e.name ?? '', qty: e.qty ?? 1,
      ...(e.materialId ? {} : { amount: e.amountPerServing ?? 0 }) }));
  }
  validateRecipePayload(body);
  return freezeRecipeValue(body);
}
/** Validate persisted data without normalizing it: replay must keep every original key/value. */
export function validateRecipePayload(value: unknown): asserts value is RecipePayload {
  const bad = () => { throw new Error('저장 요청 내용을 확인하지 못했어요.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad();
  const body = value as Record<string, unknown>;
  if (body.contract_version !== 2 || !validRecipeId(body.request_id)
    || !['create', 'full', 'memo', 'active'].includes(String(body.patch))) return bad();
  const keys = ['contract_version', 'request_id', 'patch'];
  if (body.patch === 'create') {
    if ('id' in body || 'expected_revision' in body || 'active' in body) return bad();
  } else {
    if (!validRecipeId(body.id)) return bad();
    recipeRevision(body.expected_revision); keys.push('id', 'expected_revision');
  }
  if (body.patch === 'memo') {
    if (typeof body.memo !== 'string' && body.memo !== null) return bad(); keys.push('memo');
  } else if (body.patch === 'active') {
    if (typeof body.active !== 'boolean') return bad(); keys.push('active');
  } else {
    keys.push('name', 'price', 'base_servings', 'target_profit_rate', 'avg_monthly_sales', 'category_id', 'memo', 'active', 'lines', 'extras');
    if (typeof body.name !== 'string' || !body.name.trim()
      || ![body.price, body.base_servings, body.target_profit_rate].every(Number.isFinite)) return bad();
    if ('memo' in body && body.memo !== null && typeof body.memo !== 'string') return bad();
    if ('active' in body && typeof body.active !== 'boolean') return bad();
    if ('category_id' in body && body.category_id !== null && typeof body.category_id !== 'string') return bad();
    if ('avg_monthly_sales' in body && body.avg_monthly_sales !== null && !Number.isFinite(body.avg_monthly_sales)) return bad();
    for (const field of ['lines', 'extras'] as const) {
      if (!(field in body)) continue;
      const rows = body[field]; if (!Array.isArray(rows)) return bad();
      for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return bad();
        if (field === 'lines') {
          if (typeof row.ingredient_id !== 'string' || !Number.isFinite(row.input_qty)
            || Object.keys(row).some(k => !['ingredient_id', 'input_qty'].includes(k))) return bad();
        } else if (typeof row.material_id !== 'string' || typeof row.name !== 'string' || !Number.isFinite(row.qty)
          || ('amount' in row && !Number.isFinite(row.amount))
          || Object.keys(row).some(k => !['material_id', 'name', 'qty', 'amount'].includes(k))) return bad();
      }
    }
  }
  if (Object.keys(body).some(key => !keys.includes(key))) return bad();
}
/** Only the normalized RpcError shape enters recipe recovery. Native DB serialization is not a revision conflict. */
export function isRecipeRevisionConflict(error: unknown): boolean {
  const e = error as { code?: unknown; detail?: unknown } | null;
  return e?.code === '45009' && e.detail === 'REVISION_CONFLICT';
}
export function validRecipeId(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
