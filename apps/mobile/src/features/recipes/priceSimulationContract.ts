import { LAUNCH_MARKETS,TAX_PRICE_BASES,TAX_TREATMENTS,type RecipePriceSimulation,type RecipeSimulationRow } from '@margincook/types';
const bad=():never=>{throw new Error('판매가 계산 응답을 확인하지 못했어요. 다시 시도해 주세요.');};
const object=(x:unknown):Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:bad();
const text=(x:unknown)=>typeof x==='string'?x:bad();
const number=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:bad();
const nullable=(x:unknown)=>x===null?null:number(x);
const integer=(x:unknown,min=0)=>{const n=number(x);return Number.isSafeInteger(n)&&n>=min?n:bad();};
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x)?x:bad();
function oneOf<T extends string>(x:unknown,values:readonly T[]):T{return values.includes(x as T)?x as T:bad();}
function date(x:unknown){const s=text(x);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return bad();const y=Number(s.slice(0,4)),m=Number(s.slice(5,7)),d=Number(s.slice(8,10));const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];return m>=1&&m<=12&&d>=1&&d<=days[m-1]! ?s:bad();}
function row(x:unknown,servings:number):RecipeSimulationRow{const r=object(x);if(integer(r.servings,1)!==servings)bad();return{
 servings,listedTotal:number(r.listed_total),tax:number(r.tax),netSales:number(r.net_sales),customerTotal:number(r.customer_total),
 material:nullable(r.material),extra:number(r.extra),fixed:nullable(r.fixed),profit:nullable(r.profit),profitRate:nullable(r.profit_rate),
 meetsTarget:r.meets_target===null?null:typeof r.meets_target==='boolean'?r.meets_target:bad()};}
/** Validate response identity; never derive tax or profit from saved quotes or local estimates. */
export function parseRecipePriceSimulation(value:unknown,storeId:string,recipeId:string,price:number):RecipePriceSimulation{
 const r=object(value);if(r.contract_version!==1||r.store_id!==storeId||r.recipe_id!==recipeId||number(r.input_price)!==price||r.recommendation_status!=='not_supported')bad();
 const identity={storeId:uuid(r.store_id),recipeId:uuid(r.recipe_id),inputPrice:price,localDate:date(r.local_date),baseServings:integer(r.base_servings,1),recipeUpdatedAt:text(r.recipe_updated_at)};
 if(r.status==='unavailable'){
  if(['context','quote','one','batch','basis'].some(k=>r[k]!==null))bad();
  return {...identity,status:'unavailable',reason:oneOf(r.reason,['disabled','not_active','market_missing','tax_missing']),context:null,one:null,batch:null,basis:null};
 }
 if(r.status!=='ready'||r.reason!==null)bad();const c=object(r.context),b=object(r.basis),q=object(r.quote);
 const countryCode=oneOf(c.country_code,['KR','US','GB','AU','CA']);const market=LAUNCH_MARKETS[countryCode];
 if(c.currency_code!==market.currencyCode||c.business_locale_code!==market.businessLocaleCode||c.minor_unit!==market.minorUnit||c.sales_channel_code!=='hall')bad();
 for(const k of ['listed_total','net_sales','customer_total','tax_total','merchant_tax_liability','marketplace_tax_liability'])number(q[k]);
 if(!Array.isArray(q.components)||!Array.isArray(b.missing_ingredient_price_ids)||b.fixed_month!==identity.localDate.slice(0,7)||b.profit_rate_denominator!=='listed_total'||b.batch_basis!=='per_serving_comparison')bad();
 const context={marketId:uuid(c.market_id),marketRevision:integer(c.market_revision,1),countryCode,currencyCode:market.currencyCode,locale:market.businessLocaleCode,minorUnit:market.minorUnit,
  priceBasis:oneOf(c.price_basis,TAX_PRICE_BASES),taxProfileId:uuid(c.tax_profile_id),taxProfileRevision:integer(c.tax_profile_revision,1),
  treatment:oneOf(c.treatment,TAX_TREATMENTS),taxCategory:c.tax_category===null?null:text(c.tax_category),overrideRevision:integer(c.override_revision),salesChannel:'hall' as const};
 const basis={materialPerServing:nullable(b.material_per_serving),extraPerServing:number(b.extra_per_serving),missingIngredientPriceIds:(b.missing_ingredient_price_ids as unknown[]).map(uuid),
  fixedMonth:text(b.fixed_month),fixedRevenue:nullable(b.fixed_revenue),fixedTotal:nullable(b.fixed_total),fixedRate:nullable(b.fixed_rate),targetProfitRate:number(b.target_profit_rate)};
 const one=row(r.one,1),batch=row(r.batch,identity.baseServings);
 if(one.listedTotal!==price||one.tax!==q.tax_total||one.netSales!==q.net_sales||one.customerTotal!==q.customer_total)bad();
 if(basis.materialPerServing===null||basis.fixedRate===null){if([one,batch].some(x=>x.profit!==null||x.profitRate!==null||x.meetsTarget!==null))bad();}
 return {...identity,status:'ready',reason:null,context,basis,one,batch};
}
