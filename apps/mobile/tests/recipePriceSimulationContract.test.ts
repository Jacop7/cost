import { describe,it,expect } from 'vitest';
import { parseRecipePriceSimulation } from '@/features/recipes/priceSimulationContract';
const store='00000000-0000-4000-8000-000000000001', recipe='00000000-0000-4000-8000-000000000002';
const raw=()=>({contract_version:1,store_id:store,recipe_id:recipe,input_price:12.34,local_date:'2026-09-11',base_servings:2,
 recipe_updated_at:'2026-09-11T00:00:00Z',recommendation_status:'not_supported',status:'unavailable',reason:'tax_missing',context:null,quote:null,basis:null,one:null,batch:null});
describe('price simulation boundary',()=>{
 it('preserves unavailable instead of legacy fallback',()=>expect(parseRecipePriceSimulation(raw(),store,recipe,12.34).status).toBe('unavailable'));
 it.each([{input_price:13},{store_id:recipe},{recipe_id:store},{contract_version:2},{input_price:NaN},{local_date:'2026-02-30'},{status:'ready'}])('rejects wrong identity or incomplete contract %j',patch=>expect(()=>parseRecipePriceSimulation({...raw(),...patch},store,recipe,12.34)).toThrow());
});

import {simulationRaw,simulationStore,simulationRecipe} from './fixtures/recipePriceSimulation';
it('keeps server monetary results without recalculating them',()=>{
 const r=parseRecipePriceSimulation(simulationRaw(),simulationStore,simulationRecipe,12.34);
 expect(r.status).toBe('ready');expect(r.one?.profit).toBe(7.872);expect(r.one?.netSales).toBe(12.34);
});
it.each([{currency_code:'KRW'},{minor_unit:0},{tax_profile_revision:0},{price_basis:'invalid'}])('rejects mismatched context %j',patch=>{
 const raw=simulationRaw();expect(()=>parseRecipePriceSimulation({...raw,context:{...raw.context,...patch}},simulationStore,simulationRecipe,12.34)).toThrow();
});
