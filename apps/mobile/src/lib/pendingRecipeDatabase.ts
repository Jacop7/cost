import type { Database,Json } from '@margincook/db';
/** Authored 0203 RPC contract while DB execution/type generation is explicitly deferred.
 * Replace this overlay with generated Functions after the verified migration/type run.
 * No runtime cast or untyped client is used. */
export type PendingRecipeDatabase = Omit<Database,'public'> & {
 public:Omit<Database['public'],'Functions'> & {Functions:Database['public']['Functions'] & {
  recipe_price_simulation:{Args:{p_store:string;p_recipe:string;p_price:number};Returns:Json};
 }};
};
