import type { Database,Json } from '@margincook/db';
/** Authored recipe read RPC contracts while DB execution/type generation is explicitly deferred.
 * Replace this overlay with generated Functions after the verified migration/type run.
 * No runtime cast or untyped client is used. */
export type PendingRecipeDatabase = Omit<Database,'public'> & {
 public:Omit<Database['public'],'Functions'> & {Functions:Database['public']['Functions'] & {
  recipe_price_simulation:{Args:{p_store:string;p_recipe:string;p_price:number};Returns:Json};
  recipe_draft_preview:{Args:{p_store:string;p_input:Json};Returns:Json};
  recipe_price_recommendation:{Args:{p_store:string;p_recipe:string};Returns:Json};
 }};
};
