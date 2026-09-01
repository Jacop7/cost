import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, rpcError } from '@/lib/supabase';
import { invalidate, qk } from '@/lib/queryClient';
import { useStoreId } from '@/lib/SessionProvider';
import {
  parseAppCapabilities, parseInternationalTaxState, parseRecipeTaxState,
  parseSalesTaxDetail, parseUserPreferences, parseAppLanguageSaveResult,
  parseProfileSaveResult,parseMenuTaxSaveResult,
} from './contracts';
import type { BusinessLocaleCode, LaunchCountryCode, LaunchCurrencyCode, SalesChannelCode, TaxCalculationBasis, TaxComponentKind, TaxJurisdictionLevel, TaxPriceBasis, TaxRemittanceOwner, TaxTreatment } from '@margincook/types';

export function useAppCapabilities(){return useQuery({queryKey:[...qk.internationalTax,'capabilities'],queryFn:async()=>{
  const {data,error}=await supabase.rpc('app_capabilities'); if(error)throw rpcError(error); return parseAppCapabilities(data);
}});}
export function useInternationalTaxState(){const storeId=useStoreId();return useQuery({queryKey:qk.internationalTax,enabled:Boolean(storeId),queryFn:async()=>{
  const {data,error}=await supabase.rpc('international_tax_app_state',{p_store:storeId});if(error)throw rpcError(error);return parseInternationalTaxState(data);
}});}
export function useUserPreferences(){return useQuery({queryKey:qk.userPreferences,queryFn:async()=>{
  const {data,error}=await supabase.rpc('get_user_preferences');if(error)throw rpcError(error);return parseUserPreferences(data);
}});}
export function useSaveAppLanguage(){const qc=useQueryClient();return useMutation({mutationFn:async(input:{appLanguage:'ko'|'en';baseRevision:number})=>{
  const {data,error}=await supabase.rpc('save_app_language',{p_language:input.appLanguage,p_base_revision:input.baseRevision});if(error)throw rpcError(error);return parseAppLanguageSaveResult(data);
},onSuccess:(next)=>{qc.setQueryData(qk.userPreferences,next);invalidate(qc,[qk.userPreferences]);}});}
export function useRecipeTaxState(recipeId:string,enabled=true){const storeId=useStoreId();return useQuery({queryKey:qk.recipeTax(recipeId),enabled:Boolean(storeId&&recipeId&&enabled),queryFn:async()=>{
  const {data,error}=await supabase.rpc('recipe_tax_app_state',{p_store:storeId,p_recipe:recipeId});if(error)throw rpcError(error);return parseRecipeTaxState(data);
}});}
export function useSalesTaxDetail(from:string,to:string,enabled=true){const storeId=useStoreId();return useQuery({queryKey:qk.salesTaxDetail(from,to),enabled:Boolean(storeId&&from&&to&&enabled),queryFn:async()=>{
  const {data,error}=await supabase.rpc('sales_tax_app_detail',{p_store:storeId,p_from:from,p_to:to});if(error)throw rpcError(error);return parseSalesTaxDetail(data);
}});}

export function useInternationalTaxRegions(country:LaunchCountryCode,enabled=true){const storeId=useStoreId();return useQuery({
  queryKey:[...qk.internationalTax,'regions',country],enabled:Boolean(storeId&&enabled),queryFn:async()=>{
    const {data,error}=await supabase.rpc('international_tax_regions',{p_store:storeId,p_country:country});if(error)throw rpcError(error);
    if(!Array.isArray(data))throw new Error('서버 국제 세금 계약이 달라요 · 지역 배열 없음');
    return data.map((x)=>{if(!x||typeof x!=='object'||typeof (x as {region_code?:unknown}).region_code!=='string'||typeof (x as {name?:unknown}).name!=='string')throw new Error('서버 국제 세금 계약이 달라요 · 지역 항목');return{regionCode:(x as {region_code:string}).region_code,name:(x as {name:string}).name};});
  },
});}

export interface MarketProfileInput {countryCode:LaunchCountryCode;regionCode:string|null;currencyCode:LaunchCurrencyCode;businessLocaleCode:BusinessLocaleCode;priceBasis:TaxPriceBasis;baseProfileId:string|null;baseRevision:number|null}
export function useSaveMarketProfile(){const storeId=useStoreId();const qc=useQueryClient();return useMutation({mutationFn:async(input:MarketProfileInput)=>{
  const {data,error}=await supabase.rpc('save_store_market_profile',{p_store:storeId,p_payload:{country_code:input.countryCode,region_code:input.regionCode,currency_code:input.currencyCode,business_locale_code:input.businessLocaleCode,price_basis:input.priceBasis},p_base_profile_id:input.baseProfileId as string,p_base_revision:input.baseRevision as number});if(error)throw rpcError(error);return parseProfileSaveResult(data);
},onSuccess:()=>{invalidate(qc,[qk.internationalTax]);}});}

export interface TaxComponentInput {key:string;kind:TaxComponentKind;name:string;ratePct:number;jurisdictionLevel:TaxJurisdictionLevel;calculationBasis:TaxCalculationBasis;appliesToTreatments:TaxTreatment[];sortOrder:number;remittance:Record<SalesChannelCode,TaxRemittanceOwner>}
export interface TaxProfileInput {defaultTreatment:TaxTreatment;components:TaxComponentInput[];categories:{code:string;name:string;treatment:TaxTreatment;active:boolean}[];baseProfileId:string|null;baseRevision:number|null}
export function useSaveTaxProfile(){const storeId=useStoreId();const qc=useQueryClient();return useMutation({mutationFn:async(input:TaxProfileInput)=>{
  const {data,error}=await supabase.rpc('save_store_tax_profile',{p_store:storeId,p_payload:{default_treatment:input.defaultTreatment,components:input.components.map(c=>({key:c.key,kind:c.kind,name:c.name,rate_pct:c.ratePct,jurisdiction_level:c.jurisdictionLevel,calculation_basis:c.calculationBasis,applies_to_treatments:c.appliesToTreatments,sort_order:c.sortOrder,remittance:c.remittance})),categories:input.categories},p_base_profile_id:input.baseProfileId as string,p_base_revision:input.baseRevision as number});if(error)throw rpcError(error);return parseProfileSaveResult(data);
},onSuccess:()=>{invalidate(qc,[qk.internationalTax]);}});}

export function useSaveMenuTaxOverride(recipeId:string){const storeId=useStoreId();const qc=useQueryClient();return useMutation({mutationFn:async(input:{taxProfileId:string;taxCategory:string|null;treatment:TaxTreatment|null;baseRevision:number})=>{
  const {data,error}=await supabase.rpc('save_menu_tax_override',{p_store:storeId,p_recipe:recipeId,p_tax_profile:input.taxProfileId,p_tax_category:input.taxCategory as string,p_treatment:input.treatment as TaxTreatment,p_base_revision:input.baseRevision});if(error)throw rpcError(error);return parseMenuTaxSaveResult(data);
},onSuccess:()=>{invalidate(qc,[qk.recipeTax(recipeId),qk.internationalTax,qk.recipes,qk.sales]);}});}
