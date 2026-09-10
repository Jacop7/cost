import { randomUUID } from 'node:crypto';
/** PostgreSQL application_name is at most 63 bytes. Keep report labels out of this identity. */
export function recipeWriteSessionName(){return 'recipe_0204_'+randomUUID();}
