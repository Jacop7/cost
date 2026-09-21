import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BundleUnitManager } from '@/features/my/BundleUnitManager';
import { BundleUnitPicker } from '@/features/settings/BundleUnitPicker';
import { parseBundleUnit } from '@/features/settings/bundleUnits';
import { supabase } from '@/lib/supabase';
vi.mock('@/lib/SessionProvider', () => ({ useStoreId: () => 'store-a' }));
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
let rows: { id: string; name: string; quantity: number; item_unit_name?: string; revision: number }[];
beforeEach(() => { rows=[]; vi.spyOn(supabase, 'rpc').mockImplementation((async (name: string, args: any) => {
  if(name==='get_bundle_units') return { data: rows.map(x=>({...x})), error:null } as any;
  if(name==='save_bundle_unit') { const row={id:args.p_id,name:args.p_name,quantity:args.p_quantity,item_unit_name:args.p_item_unit_name,revision:args.p_base_revision+1};rows=[row];return {data:{...row,changed:true},error:null} as any; }
  if(name==='delete_bundle_unit'){rows=[];return {data:{changed:true},error:null} as any;}
  throw Error(name);
}) as any); });
function mount(node: React.ReactNode){ const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}}); return {client,...render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)}; }
it('이름·수량 입력을 서버에 저장하고 재조회로 표시한다',async()=>{
  mount(<BundleUnitManager/>); await screen.findByText('등록된 묶음 단위가 없어요.');
  fireEvent.click(screen.getByRole('button',{name:'묶음 단위 추가'}));
  expect(screen.getByRole('button',{name:'저장'}).getAttribute('aria-disabled')).toBe('true');
  fireEvent.change(screen.getByLabelText('묶음 단위명'),{target:{value:'박스'}});
  fireEvent.change(screen.getByLabelText('1묶음당 수량'),{target:{value:'30'}});
  fireEvent.change(screen.getByLabelText('낱개 단위명'),{target:{value:'모'}});
  fireEvent.click(screen.getByRole('button',{name:'저장'}));
  await screen.findByText('30모');
  expect(supabase.rpc).toHaveBeenCalledWith('save_bundle_unit',expect.objectContaining({p_store:'store-a',p_name:'박스',p_quantity:30,p_item_unit_name:'모',p_base_revision:0}));
});
it('수정은 현재 판본을 전송하고 삭제는 확인 후 실행한다',async()=>{
  rows=[{id,name:'박스',quantity:30,revision:7}];mount(<BundleUnitManager/>);
  fireEvent.click(await screen.findByRole('button',{name:'박스 묶음 단위 수정'}));
  fireEvent.change(screen.getByLabelText('1묶음당 수량'),{target:{value:'20'}});fireEvent.click(screen.getByRole('button',{name:'저장'}));
  await screen.findByText('20개');expect(supabase.rpc).toHaveBeenCalledWith('save_bundle_unit',expect.objectContaining({p_id:id,p_base_revision:7,p_quantity:20}));
  fireEvent.click(screen.getByRole('button',{name:'박스 묶음 단위 수정'}));
  fireEvent.click(screen.getByRole('button',{name:'묶음 단위 삭제'}));
  expect(supabase.rpc).not.toHaveBeenCalledWith('delete_bundle_unit',expect.anything());
  fireEvent.click(screen.getByRole('button',{name:'취소'}));expect(screen.getByText('20개')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'박스 묶음 단위 수정'}));fireEvent.click(screen.getByRole('button',{name:'묶음 단위 삭제'}));fireEvent.click(screen.getByRole('button',{name:/^삭제$/}));
  await screen.findByText('등록된 묶음 단위가 없어요.');expect(supabase.rpc).toHaveBeenCalledWith('delete_bundle_unit',{p_store:'store-a',p_id:id,p_base_revision:8});
});
it('선택은 기준 개수를 한번 복사하고 설정 변경/삭제가 초안을 재계산하지 않는다',async()=>{
  rows=[{id,name:'판',quantity:30,item_unit_name:'모',revision:1}];
  function Form(){const [value,setValue]=useState(0);return <><BundleUnitPicker value={String(value)} onSelect={setValue}/><output aria-label="입고 용량">{value}</output></>}
  const {client}=mount(<Form/>);fireEvent.click(screen.getByLabelText('묶음 단위 선택'));fireEvent.click(await screen.findByText('1판 = 30모'));
  expect(screen.getByLabelText('입고 용량').textContent).toBe('30');rows=[];await client.invalidateQueries();
  expect(screen.getByLabelText('입고 용량').textContent).toBe('30');
});
it('서버 오류를 빈 목록으로 표시하지 않고 재조회한다',async()=>{
  vi.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'offline'}} as any);mount(<BundleUnitManager/>);
  await screen.findByText('묶음 단위를 불러오지 못했어요.');expect(screen.queryByText('등록된 묶음 단위가 없어요.')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'다시 불러오기'}));await screen.findByText('등록된 묶음 단위가 없어요.');
});
it('잘못된 서버 수량과 판본을 거부한다',()=>{
  for(const patch of [{item_unit_name:''},{item_unit_name:'x'.repeat(21)},{item_unit_name:123},{quantity:0},{quantity:1.5},{quantity:1000001},{revision:0}])expect(()=>parseBundleUnit({id,name:'박스',quantity:30,revision:1,...patch})).toThrow();
});

it('낱개 단위명 공란은 저장할 수 없고 수정값도 RPC에 전달된다',async()=>{
  rows=[{id,name:'판',quantity:30,item_unit_name:'모',revision:2}];mount(<BundleUnitManager/>);
  fireEvent.click(await screen.findByRole('button',{name:'판 묶음 단위 수정'}));
  expect((screen.getByLabelText('낱개 단위명') as HTMLInputElement).value).toBe('모');
  fireEvent.change(screen.getByLabelText('낱개 단위명'),{target:{value:' '}});
  expect(screen.getByRole('button',{name:'저장'}).getAttribute('aria-disabled')).toBe('true');
  fireEvent.change(screen.getByLabelText('낱개 단위명'),{target:{value:'장'}});
  fireEvent.click(screen.getByRole('button',{name:'저장'}));
  await screen.findByText('30장');
  expect(supabase.rpc).toHaveBeenCalledWith('save_bundle_unit',expect.objectContaining({p_item_unit_name:'장',p_base_revision:2}));
});
