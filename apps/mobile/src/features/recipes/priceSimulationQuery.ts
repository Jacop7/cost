import { useQuery } from '@tanstack/react-query';
import { useStoreId } from '@/lib/SessionProvider';
import { supabase,rpcError } from '@/lib/supabase';
import { qk } from '@/lib/queryClient';
import { parseRecipePriceSimulation } from './priceSimulationContract';
export function useRecipePriceSimulation(recipeId:string,price:number|null){
 const storeId=useStoreId();return useQuery({queryKey:qk.recipePriceSimulation(recipeId,storeId,price),
  enabled:Boolean(storeId&&recipeId&&price!==null),staleTime:0,refetchOnMount:'always',
  queryFn:async()=>{if(price===null)throw new Error('판매가를 입력해 주세요.');
   const {data,error}=await supabase.rpc('recipe_price_simulation',{p_store:storeId,p_recipe:recipeId,p_price:price});
   if(error)throw rpcError(error);return parseRecipePriceSimulation(data,storeId,recipeId,price);
  }});
}
