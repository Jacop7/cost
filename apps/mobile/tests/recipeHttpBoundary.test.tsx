// Real hooks + real RpcError. Controlled transport only; REDs expose missing integration.
import { createElement, type ReactNode } from 'react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook,cleanup,waitFor } from '@testing-library/react';
import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import { useRecipeDetail,useSaveRecipe } from '@/features/recipes/hooks';
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc:m.rpc})}));
vi.mock('expo-secure-store',()=>({}));
vi.mock('@/lib/supabase',async original=>await original<typeof import('@/lib/supabase')>());
vi.mock('@/lib/SessionProvider',()=>({useSessionState:()=>({userId:'recipe-actor-a'}),useStoreId:()=> '00000000-0000-0000-0000-0000000000b1'}));
let client:QueryClient;
const wrapper=({children}:{children:ReactNode})=>createElement(QueryClientProvider,{client},children);
const id='22222222-2222-4222-8222-222222222222',requestId='22222222-2222-4222-8222-333333333333';
const input={id,name:'F2 hook-only',price:13000,baseServings:1,targetProfitRate:30,patch:'full' as const,requestId,expectedRevision:'9007199254740993'};
beforeEach(()=>{localStorage.clear();m.rpc.mockReset();client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});});
afterEach(()=>{cleanup();client.clear();});
it('real RpcError retains HTTP45009 and REVISION_CONFLICT in normalized detail',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'45009',details:'REVISION_CONFLICT',message:'conflict'}});
 const h=renderHook(()=>useSaveRecipe(),{wrapper});let error:unknown;
 await act(async()=>{try{await h.result.current.mutateAsync(input);}catch(e){error=e;}});
 expect(error).toMatchObject({code:'45009',detail:'REVISION_CONFLICT'});
});
it('detail mapper must preserve bigint revision string',async()=>{
 m.rpc.mockResolvedValue({data:{id,name:'F2 hook-only',price:12000,edit_revision:'9007199254740993',category_id:null,
 fixed_month:'2026-09',fixed_items:[],lines:[],extras:[],tax_items:[],last_change:{display_state:null,has_history:false}},error:null});
 const h=renderHook(()=>useRecipeDetail(id),{wrapper});await waitFor(()=>expect(h.result.current.isSuccess).toBe(true));
 expect(h.result.current.data).toHaveProperty('editRevision','9007199254740993');
});
it('full hook must send sealed request id/basis and v2 envelope',async()=>{
 m.rpc.mockResolvedValue({data:id,error:null});const h=renderHook(()=>useSaveRecipe(),{wrapper});
 await act(async()=>{await h.result.current.mutateAsync(input);});
 expect(m.rpc.mock.calls[0]![1].p_payload).toMatchObject({contract_version:2,patch:'full',request_id:requestId,expected_revision:'9007199254740993'});
});
it('create must omit id and expected_revision',async()=>{
 m.rpc.mockResolvedValue({data:id,error:null});const h=renderHook(()=>useSaveRecipe(),{wrapper});
 await act(async()=>{const {id:_id,expectedRevision:_basis,...create}=input;await h.result.current.mutateAsync({...create,patch:'create'});});
 expect(m.rpc.mock.calls[0]![1].p_payload).not.toHaveProperty('id');
});
it('memo must send narrow payload without stale editable header',async()=>{
 m.rpc.mockResolvedValue({data:id,error:null});const h=renderHook(()=>useSaveRecipe(),{wrapper});
 await act(async()=>{await h.result.current.mutateAsync({...input,memo:'mine',patch:'memo'});});
 const p=m.rpc.mock.calls[0]![1].p_payload;
 expect(p).toEqual({contract_version:2,patch:'memo',id,request_id:requestId,expected_revision:'9007199254740993',memo:'mine'});
});
it('revision conflict must not retry even when global mutation retry is enabled',async()=>{
 client.setDefaultOptions({queries:{retry:false},mutations:{retry:1,retryDelay:0}});
 m.rpc.mockResolvedValue({data:null,error:{code:'45009',details:'REVISION_CONFLICT',message:'conflict'}});
 const h=renderHook(()=>useSaveRecipe(),{wrapper});await act(async()=>{try{await h.result.current.mutateAsync(input);}catch{}});
 expect(m.rpc.mock.calls.filter(x=>x[0]==='save_recipe')).toHaveLength(1);
});
