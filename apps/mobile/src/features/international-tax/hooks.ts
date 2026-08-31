import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, rpcError } from '@/lib/supabase';
import { invalidate, qk } from '@/lib/queryClient';
import { useStoreId } from '@/lib/SessionProvider';
import {
  parseAppCapabilities, parseInternationalTaxState, parseRecipeTaxState,
  parseSalesTaxDetail, parseUserPreferences, parseAppLanguageSaveResult,
} from './contracts';

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
