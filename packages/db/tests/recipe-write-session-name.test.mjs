import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeWriteSessionName } from './recipe-write-session-name.mjs';
test('the old long-label identity is truncated by PostgreSQL but new identities fit intact',()=>{
 const old='recipe_0204_different-active-same-basisA_00000000-0000-4000-8000-000000000001';
 assert.ok(Buffer.byteLength(old,'utf8')>63);
 const names=new Set();for(let i=0;i<100;i++){
  const name=recipeWriteSessionName();assert.ok(Buffer.byteLength(name,'utf8')<=63);
  assert.match(name,/^recipe_0204_[0-9a-f-]{36}$/);assert.equal(names.has(name),false);names.add(name);
 }
});
