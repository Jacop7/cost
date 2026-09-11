import { describe, it, expect } from 'vitest';
import { parseDraftPreview } from '@/features/recipes/draftPreviewContract';
import { actor, store, previewInput, previewRaw } from './fixtures/recipeDraftPreview';
const parse = (v: unknown) => parseDraftPreview(v, actor, store, previewInput());
describe('draft quote identity and nullable contract', () => {
 it('uses server numeric results with full draft identity', () => { expect(parse(previewRaw()).one?.profit).toBe(7.872); });
 it.each([{ actor_id: store }, { store_id: actor }, { local_date: '2026-02-30' }, { contract_version: 2 },
   { input: { ...previewInput(), base_servings: 5 } }, { input: { ...previewInput(), lines: [] } }])('rejects mismatched response %j', patch => expect(() => parse({ ...previewRaw(), ...patch })).toThrow());
 it('accepts JSONB key reordering', () => {
   const input = previewInput(); expect(parse({ ...previewRaw(), input: { extras: input.extras, lines: input.lines, target_profit_rate: 30, base_servings: 2, price: 12.34, recipe_id: null } }).status).toBe('ready');
 });
 it('rejects recommendations below target or on the wrong price grid', () => {
   const raw = previewRaw(); for (const patch of [{ profit_rate: 0.29 }, { price: 4.001 }]) expect(() => parse({ ...raw, recommendation: { ...raw.recommendation, ...patch } })).toThrow();
 });
 it('does not turn missing price into zero profit', () => {
   const raw = previewRaw(); expect(() => parse({ ...raw, basis: { ...raw.basis, material_per_serving: null }, one: { ...raw.one, material: null } })).toThrow();
 });
 it('keeps unavailable settings explicitly unavailable', () => {
   expect(parse({ ...previewRaw(), status: 'unavailable', reason: 'not_active', context: null, basis: null, quote: null, one: null, batch: null, recommendation: null }).status).toBe('unavailable');
 });
});
