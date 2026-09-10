import type { LaunchCountryCode,LaunchCurrencyCode,BusinessLocaleCode,TaxPriceBasis,TaxTreatment } from './international';
export interface RecipeSimulationRow {
  servings:number; listedTotal:number; tax:number; netSales:number; customerTotal:number;
  material:number|null; extra:number; fixed:number|null; profit:number|null; profitRate:number|null; meetsTarget:boolean|null;
}
export interface RecipeSimulationContext {
  marketId:string; marketRevision:number; countryCode:LaunchCountryCode; currencyCode:LaunchCurrencyCode;
  locale:BusinessLocaleCode; minorUnit:0|2; priceBasis:TaxPriceBasis; taxProfileId:string; taxProfileRevision:number;
  treatment:TaxTreatment; taxCategory:string|null; overrideRevision:number; salesChannel:'hall';
}
export interface RecipeSimulationBasis {
  materialPerServing:number|null; extraPerServing:number; missingIngredientPriceIds:string[];
  fixedMonth:string; fixedRevenue:number|null; fixedTotal:number|null; fixedRate:number|null; targetProfitRate:number;
}
interface Identity { storeId:string;recipeId:string;inputPrice:number;localDate:string;baseServings:number;recipeUpdatedAt:string; }
export type RecipePriceSimulation = Identity & (
 {status:'unavailable';reason:'disabled'|'not_active'|'market_missing'|'tax_missing';context:null;one:null;batch:null;basis:null} |
 {status:'ready';reason:null;context:RecipeSimulationContext;one:RecipeSimulationRow;batch:RecipeSimulationRow;basis:RecipeSimulationBasis});
