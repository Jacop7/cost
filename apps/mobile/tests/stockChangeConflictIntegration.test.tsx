import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StockChangeScreen } from '@/features/ingredients/screens/StockChangeScreen';
import { dismissToast, getToast } from '@/lib/toast';
const m=vi.hoisted(()=>({rpc:vi.fn(),replace:vi.fn(),userId:'actor-a',storeId:'store-a',id:'g1',mode:'deduct',focused:true}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc:m.rpc}}));
vi.mock('@/features/ingredients/hooks',async original=>({
  ...await original<typeof import('@/features/ingredients/hooks')>(),
  useInventoryOccurrenceContext:()=>({data:{requiresConfirmation:false},isLoading:false,error:null,refetch:vi.fn()}),
}));
vi.mock('@/lib/SessionProvider',()=>({useStoreId:()=>m.storeId,useSessionState:()=>({phase:'ready',userId:m.userId,storeId:m.storeId})}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({id:m.id,mode:m.mode}),useRouter:()=>({replace:m.replace}),
  useFocusEffect:(callback:()=>void|(()=>void))=>useEffect(()=>m.focused?callback():undefined,[callback,m.focused]),
  router:{canGoBack:()=>false,replace:m.replace}}));
vi.mock('react-native',async original=>{const rn=await original<typeof import('react-native')>();return {...rn,Modal:({visible,children}:{visible?:boolean;children?:ReactNode})=>visible?<div>{children}</div>:null};});
vi.mock('@/features/ingredients/screens/QuickInboundScreen',()=>({QuickInboundScreen:()=>null}));
const raw=(stock=1000,id=m.id)=>({id,name:'대파',base_unit:'g',per_volume:1000,stock_total:stock,base_price:4,safety_stock:0,min_order_qty:1,memo:null,category_id:null,category_name:null,options:[],orders:[],price_trends:[],last_change:{display_state:null,occurred_at:null,has_history:false}});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
const clients:QueryClient[]=[];
const writes=()=>m.rpc.mock.calls.filter(([name])=>name==='record_current_stock_quantity');
const reads=()=>m.rpc.mock.calls.filter(([name])=>name==='ingredient_detail');
const quantity=()=>screen.getByRole('textbox',{name:m.mode==='waste'?'폐기할 수량':'차감할 수량'}) as HTMLInputElement;
const reason=()=>screen.getByRole('textbox',{name:m.mode==='waste'?'폐기 사유':'차감 사유'}) as HTMLInputElement;
const openButton=()=>screen.getByRole('button',{name:m.mode==='waste'?'폐기 기록':'차감 입력 확인'});
const fill=()=>{fireEvent.change(quantity(),{target:{value:'100'}});fireEvent.change(reason(),{target:{value:'내 사유'}});};
const submit=()=>{fireEvent.click(openButton());fireEvent.click(screen.getByRole('button',{name:m.mode==='waste'?'폐기':'차감'}));};
describe('재고 exact 충돌의 실제 query/mutation 연결',()=>{
 let stock:number;
 const receipts=new Set<string>();
 let nextRead:{promise:Promise<{data:ReturnType<typeof raw>|null;error:null|{message:string}}> }|null;
 let failure:{code:string;details?:string;message:string}|null;
 beforeEach(()=>{
  localStorage.clear();receipts.clear();
  m.userId='actor-a';m.storeId='store-a';m.id='g1';m.mode='deduct';m.focused=true;m.replace.mockReset();stock=1000;nextRead=null;failure=null;
  const toast=getToast();if(toast)dismissToast(toast.id);
  m.rpc.mockReset().mockImplementation(async(name,args)=>{
   if(name==='ingredient_detail'){if(nextRead){const pending=nextRead;nextRead=null;return pending.promise;}return {data:raw(stock,args.p_ingredient),error:null};}
   if(name==='resolve_stock_quantity')return {data:{status:receipts.has(args.p_request_key)?'recorded':'not_recorded'},error:null};
   if(name==='record_current_stock_quantity'){
    if(failure)return {data:null,error:failure};
    if(args.p_expected_stock!==stock)return {data:null,error:{code:'40001',message:'재고 변경'}};
    receipts.add(args.p_idempotency_key);stock-=args.p_quantity;return {data:{discarded:args.p_quantity},error:null};
   }
   return {data:null,error:null};
  });
 });
 afterEach(()=>clients.splice(0).forEach(c=>c.clear()));
 async function open(options:{fill?:boolean}={}){
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity},mutations:{retry:2,retryDelay:0}}});clients.push(client);
  const element=()=> <QueryClientProvider client={client}><StockChangeScreen/></QueryClientProvider>;
  const view=render(element());await screen.findByRole('textbox',{name:m.mode==='waste'?'폐기할 수량':'차감할 수량'});
  if(options.fill!==false){fill();await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());}
  await act(async()=>{});
  return {client,view,rerender:()=>view.rerender(element())};
 }
 it.each(['deduct','waste'])('%s 서버 처리 후 응답 유실·재진입은 같은 처리를 다시 차감하지 않는다',async mode=>{
  m.mode=mode;let loseResponse=true;const original=m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation(async(name,args)=>{const result=await original(name,args);
   if(name==='record_current_stock_quantity'&&loseResponse){loseResponse=false;return {data:null,error:{code:'NETWORK',message:'응답 유실'}};}
   return result;});
  const first=await open();submit();await screen.findByText('응답 유실');expect(stock).toBe(900);
  first.view.unmount();await open();submit();
  await waitFor(()=>expect(getToast()).not.toBeNull());
  expect(writes()).toHaveLength(1);expect(stock).toBe(900);
 });
 it.each([{mode:'deduct',currentStock:0},{mode:'waste',currentStock:0},{mode:'deduct',currentStock:-50},{mode:'waste',currentStock:-50}])('$mode 전량 처리 후 응답 유실·재진입 $currentStock 재고는 새 수량 없이 결과를 확인할 수 있다',async({mode,currentStock})=>{
  m.mode=mode;let loseResponse=true;const original=m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation(async(name,args)=>{const result=await original(name,args);
   if(name==='record_current_stock_quantity'&&loseResponse){loseResponse=false;return {data:null,error:{code:'NETWORK',message:'응답 유실'}};}
   return result;});
  const first=await open();fireEvent.change(quantity(),{target:{value:'1000'}});submit();
  await screen.findByText('응답 유실');expect(stock).toBe(0);expect(writes()).toHaveLength(1);
  const originalKey=writes()[0]![1].p_idempotency_key;
  expect(localStorage.length).toBe(1);first.view.unmount();stock=currentStock;
  await open({fill:false});expect(quantity().value).toBe('');expect(reason().value).toBe('');
  expect(openButton().getAttribute('aria-disabled')).toBe('true');
  // Either resolve on entry or offer an explicit read-only recovery action.
  // Neither path may require a new valid quantity when the stock is exhausted.
  const recovery=screen.queryByRole('button',{name:/이전.*처리.*확인|처리 결과 확인/});
  if(recovery)fireEvent.click(recovery);
  await waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('resolve_stock_quantity',expect.objectContaining({p_request_key:originalKey})));
  await waitFor(()=>expect(localStorage.length).toBe(0));
  expect(writes()).toHaveLength(1);expect(stock).toBe(currentStock);expect(m.replace).not.toHaveBeenCalled();
 });
 it('0 재고의 수량 없는 결과 확인 실패는 키를 보존하고 다시 확인해도 재차감하지 않는다',async()=>{
  let loseResponse=true;let failResolve=true;const original=m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation(async(name,args)=>{
   if(name==='resolve_stock_quantity'&&failResolve)return {data:null,error:{code:'NETWORK',message:'결과 조회 실패'}};
   const result=await original(name,args);
   if(name==='record_current_stock_quantity'&&loseResponse){loseResponse=false;return {data:null,error:{code:'NETWORK',message:'응답 유실'}};}
   return result;});
  const first=await open();fireEvent.change(quantity(),{target:{value:'1000'}});submit();await screen.findByText('응답 유실');
  first.view.unmount();await open({fill:false});
  fireEvent.click(await screen.findByRole('button',{name:'이전 처리 결과 확인'}));await screen.findByText('결과 조회 실패');
  expect(localStorage.length).toBe(1);expect(stock).toBe(0);expect(writes()).toHaveLength(1);
  expect(quantity().value).toBe('');expect(reason().value).toBe('');
  expect(openButton().getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'확인'}));failResolve=false;
  fireEvent.click(screen.getByRole('button',{name:'이전 처리 결과 확인'}));
  await waitFor(()=>expect(localStorage.length).toBe(0));expect(writes()).toHaveLength(1);expect(stock).toBe(0);
 });
 it.each(['actor','store','id','mode'] as const)('수량 없는 결과 확인 도중 %s 전환은 늦은 완료를 새 화면에 표시하지 않는다',async part=>{
  let loseResponse=true;const pending=deferred<{data:{status:'recorded'};error:null}>();const original=m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation(async(name,args)=>{
   if(name==='resolve_stock_quantity')return pending.promise;
   const result=await original(name,args);
   if(name==='record_current_stock_quantity'&&loseResponse){loseResponse=false;return {data:null,error:{code:'NETWORK',message:'응답 유실'}};}
   return result;});
  const first=await open();fireEvent.change(quantity(),{target:{value:'1000'}});submit();await screen.findByText('응답 유실');
  first.view.unmount();const second=await open({fill:false});
  fireEvent.click(await screen.findByRole('button',{name:'이전 처리 결과 확인'}));
  await waitFor(()=>expect(m.rpc.mock.calls.filter(([name])=>name==='resolve_stock_quantity')).toHaveLength(1));
  if(part==='actor')m.userId='actor-b';if(part==='store')m.storeId='store-b';if(part==='id')m.id='g2';if(part==='mode')m.mode='waste';
  second.rerender();await screen.findByRole('textbox',{name:m.mode==='waste'?'폐기할 수량':'차감할 수량'});
  await act(async()=>pending.resolve({data:{status:'recorded'},error:null}));
  expect(quantity().value).toBe('');expect(reason().value).toBe('');expect(getToast()).toBeNull();expect(m.replace).not.toHaveBeenCalled();expect(writes()).toHaveLength(1);
 });
 it('복귀 재고 조회 중 결과 확인은 이전 응답 대신 확인 후 새 재고를 읽는다',async()=>{
  let loseResponse=true;const original=m.rpc.getMockImplementation()!;
  m.rpc.mockImplementation(async(name,args)=>{const result=await original(name,args);
   if(name==='record_current_stock_quantity'&&loseResponse){loseResponse=false;return {data:null,error:{code:'NETWORK',message:'응답 유실'}};}
   return result;});
  const f=await open();fireEvent.change(quantity(),{target:{value:'1000'}});submit();await screen.findByText('응답 유실');
  fireEvent.click(screen.getByRole('button',{name:'확인'}));
  m.focused=false;f.rerender();
  const oldRead=deferred<{data:ReturnType<typeof raw>;error:null}>();nextRead=oldRead;m.focused=true;f.rerender();
  await waitFor(()=>expect(reads()).toHaveLength(2));
  // Another transaction changes stock after this old read's snapshot was taken.
  stock=300;
  fireEvent.click(await screen.findByRole('button',{name:'이전 처리 결과 확인'}));
  await act(async()=>{});
  await act(async()=>oldRead.resolve({data:raw(100),error:null}));
  await waitFor(()=>expect(f.client.getQueryCache().findAll({queryKey:['ingredients','g1']})[0]?.state.fetchStatus).toBe('idle'));
  // A serializing UI may defer confirmation; either way the final basis must be a post-resolution read.
  const recovery=screen.queryByRole('button',{name:'이전 처리 결과 확인'});
  if(recovery)fireEvent.click(recovery);
  await waitFor(()=>expect(reads().length).toBeGreaterThanOrEqual(3));
  await screen.findByText('300g');
  expect(m.rpc.mock.calls.filter(([name])=>name==='resolve_stock_quantity')).toHaveLength(1);
  expect(writes()).toHaveLength(1);expect(stock).toBe(300);expect(localStorage.length).toBe(0);
 });
 it('결과 확인 뒤 새 조회 지연·실패에서 이전 응답은 새 입력 잠금을 풀지 않는다',async()=>{
  let loseResponse=true;let holdFresh=false;const original=m.rpc.getMockImplementation()!;
  const freshRead=deferred<{data:ReturnType<typeof raw>|null;error:null|{message:string}}>();
  m.rpc.mockImplementation(async(name,args)=>{
   if(name==='ingredient_detail'&&holdFresh)return freshRead.promise;
   const result=await original(name,args);
   if(name==='resolve_stock_quantity')holdFresh=true;
   if(name==='record_current_stock_quantity'&&loseResponse){loseResponse=false;return {data:null,error:{code:'NETWORK',message:'응답 유실'}};}
   return result;});
  const f=await open();fireEvent.change(quantity(),{target:{value:'1000'}});submit();await screen.findByText('응답 유실');
  fireEvent.click(screen.getByRole('button',{name:'확인'}));fireEvent.change(quantity(),{target:{value:'100'}});
  m.focused=false;f.rerender();const oldRead=deferred<{data:ReturnType<typeof raw>;error:null}>();
  nextRead=oldRead;m.focused=true;f.rerender();await waitFor(()=>expect(reads()).toHaveLength(2));
  stock=300;
  fireEvent.click(await screen.findByRole('button',{name:'이전 처리 결과 확인'}));
  await waitFor(()=>expect(reads().length).toBeGreaterThanOrEqual(3));
  await act(async()=>oldRead.resolve({data:raw(100),error:null}));
  expect(openButton().getAttribute('aria-disabled')).toBe('true');expect(writes()).toHaveLength(1);
  await act(async()=>freshRead.resolve({data:null,error:{message:'확인 후 재고 조회 실패'}}));
  await screen.findByText('최신 재고를 불러오지 못했어요. 입력한 내용은 유지돼요.');
  expect(openButton().getAttribute('aria-disabled')).toBe('true');expect(quantity().value).toBe('100');expect(localStorage.length).toBe(0);
  holdFresh=false;fireEvent.click(screen.getByRole('button',{name:'최신 재고 다시 불러오기'}));await screen.findByText('300g');
  await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());
  expect(writes()).toHaveLength(1);expect(stock).toBe(300);
 });
 it.each(['40001','22000','45010','42501','P0002'])('명확한 서버 거절 %s는 현재 화면에서 최신 재고 확인 후 새 키로 저장한다',async code=>{
  await open();failure={code,message:'서버 거절'};submit();await screen.findByText('서버 거절');
  await waitFor(()=>expect(reads()).toHaveLength(2));expect(localStorage.length).toBe(0);
  failure=null;fireEvent.click(screen.getByRole('button',{name:'확인'}));
  await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());submit();
  await waitFor(()=>expect(stock).toBe(900));expect(writes()).toHaveLength(2);
  expect(writes()[1]![1].p_idempotency_key).not.toBe(writes()[0]![1].p_idempotency_key);
  expect(m.rpc.mock.calls.filter(([name])=>name==='resolve_stock_quantity')).toHaveLength(0);
 });
 it('충돌 뒤 최신조회 대기에는 중복쓰기0, 같은 초안을 재확인한 뒤 새키로1회 쓴다',async()=>{
  await open();stock=1200;const pending=deferred<{data:ReturnType<typeof raw>;error:null}>();nextRead=pending;
  submit();await waitFor(()=>expect(reads()).toHaveLength(2));expect(writes()).toHaveLength(1);
  const first=writes()[0]![1];expect(openButton().getAttribute('aria-disabled')).toBe('true');fireEvent.click(openButton());expect(writes()).toHaveLength(1);
  expect(quantity().value).toBe('100');expect(reason().value).toBe('내 사유');
  await act(async()=>pending.resolve({data:raw(1200),error:null}));
  await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());
  fireEvent.click(screen.getByRole('button',{name:'확인'}));submit();await waitFor(()=>expect(writes()).toHaveLength(2));
  expect(writes()[1]![1]).toMatchObject({p_quantity:100,p_expected_stock:1200});expect(writes()[1]![1].p_idempotency_key).not.toBe(first.p_idempotency_key);
 });
 it('최신조회 실패는 초안과 차단을 유지하고 사용자의 읽기 재시도 후에만 확인을 허용한다',async()=>{
  await open();stock=1200;const pending=deferred<{data:ReturnType<typeof raw>|null;error:null|{message:string}}>();nextRead=pending;submit();
  await waitFor(()=>expect(reads()).toHaveLength(2));await act(async()=>pending.resolve({data:null,error:{message:'읽기 실패'}}));
  expect(openButton().getAttribute('aria-disabled')).toBe('true');expect(quantity().value).toBe('100');expect(reason().value).toBe('내 사유');
  fireEvent.click(await screen.findByRole('button',{name:'최신 재고 다시 불러오기'}));
  await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());expect(writes()).toHaveLength(1);
 });
 it.each([
  {code:'NETWORK'},{code:'PGRST000'},
  {code:'45009'},{code:'45009',details:'OPTION_EDIT_CONFLICT'},{code:'PT409',details:'REVISION_CONFLICT'},
 ])('일반 $code/$details 후 다시 확인은 처리 여부만 조회하고 재전송하지 않는다',async error=>{
  await open();failure={...error,message:'일반 실패'};submit();await screen.findByText('일반 실패');
  expect(reads()).toHaveLength(1);expect(writes()).toHaveLength(1);const first=writes()[0]![1];
  expect(quantity().value).toBe('100');expect(reason().value).toBe('내 사유');
  fireEvent.click(screen.getByRole('button',{name:'확인'}));submit();await waitFor(()=>expect(getToast()).not.toBeNull());
  expect(writes()).toHaveLength(1);expect(m.rpc).toHaveBeenCalledWith('resolve_stock_quantity',expect.objectContaining({p_request_key:first.p_idempotency_key}));
 });
 it.each(['actor','store','id','mode'] as const)('복구 read 도중 %s 교체는 늦은 결과를 새 scope에 적용하지 않는다',async part=>{
  const f=await open();stock=1200;const pending=deferred<{data:ReturnType<typeof raw>;error:null}>();nextRead=pending;submit();await waitFor(()=>expect(reads()).toHaveLength(2));
  if(part==='actor')m.userId='actor-b';if(part==='store')m.storeId='store-b';if(part==='id')m.id='g2';if(part==='mode')m.mode='waste';
  f.rerender();await waitFor(()=>expect(quantity().value).toBe(''));await act(async()=>pending.resolve({data:raw(3000,'g1'),error:null}));
  expect(quantity().value).toBe('');expect(reason().value).toBe('');expect(m.replace).not.toHaveBeenCalled();expect(getToast()).toBeNull();expect(writes()).toHaveLength(1);
 });
 it('같은 scope의 배경 조회는 수량과 사유 초안을 지우지 않는다',async()=>{
  const f=await open();stock=700;await act(async()=>{await f.client.invalidateQueries({queryKey:['ingredients','g1']});});
  expect(quantity().value).toBe('100');expect(reason().value).toBe('내 사유');expect(writes()).toHaveLength(0);
 });
 it('대상이 다른 복구 응답은 화면의 재료를 바꾸거나 저장을 허용하지 않는다',async()=>{
  await open();stock=1200;const pending=deferred<{data:ReturnType<typeof raw>;error:null}>();nextRead=pending;submit();
  await waitFor(()=>expect(reads()).toHaveLength(2));
  await act(async()=>pending.resolve({data:{...raw(9000,'foreign'),name:'다른 재료'},error:null}));
  await screen.findByText('최신 재고를 불러오지 못했어요. 입력한 내용은 유지돼요.');
  expect(screen.queryByText('다른 재료')).toBeNull();expect(quantity().value).toBe('100');
  expect(openButton().getAttribute('aria-disabled')).toBe('true');expect(writes()).toHaveLength(1);
 });
 it('확인창을 연 뒤 재고가 갱신되면 새 확인 전에는 쓰지 않는다',async()=>{
  const f=await open();fireEvent.click(openButton());stock=1100;
  await act(async()=>{await f.client.invalidateQueries({queryKey:['ingredients','g1']});});
  await screen.findByText('1.1kg');await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());
  fireEvent.click(screen.getByRole('button',{name:'차감'}));
  expect(writes()).toHaveLength(0);await screen.findByText('재고가 바뀌었어요. 수량을 확인한 뒤 다시 저장해 주세요.');
  fireEvent.click(screen.getByRole('button',{name:'확인'}));submit();await waitFor(()=>expect(writes()).toHaveLength(1));
  expect(writes()[0]![1].p_expected_stock).toBe(1100);
 });
 it('확인 뒤 초안 변경은 이전 확인을 취소하고 다시 확인하도록 한다',async()=>{
  await open();fireEvent.click(openButton());fireEvent.change(quantity(),{target:{value:'50'}});
  expect(screen.queryByRole('button',{name:'차감'})).toBeNull();expect(writes()).toHaveLength(0);
  submit();await waitFor(()=>expect(writes()).toHaveLength(1));expect(writes()[0]![1].p_quantity).toBe(50);
 });
 it('blur 후 재진입한 새 조회가 끝나기 전에는 이전 조회로 잠금을 풀지 않는다',async()=>{
  const f=await open();stock=1200;const oldRead=deferred<{data:ReturnType<typeof raw>;error:null}>();nextRead=oldRead;submit();
  await waitFor(()=>expect(reads()).toHaveLength(2));m.focused=false;f.rerender();
  const freshRead=deferred<{data:ReturnType<typeof raw>;error:null}>();nextRead=freshRead;m.focused=true;f.rerender();
  await waitFor(()=>expect(reads()).toHaveLength(3));await act(async()=>oldRead.resolve({data:raw(3000),error:null}));
  expect(openButton().getAttribute('aria-disabled')).toBe('true');expect(writes()).toHaveLength(1);
  await act(async()=>freshRead.resolve({data:raw(1200),error:null}));
  await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());
  expect(quantity().value).toBe('100');expect(reason().value).toBe('내 사유');
 });
 it.each(['invalidate','refetch'] as const)('복구 중 외부 %s가 결과 객체를 바꿔도 수동 재조회로 복구하며 중복 쓰기 없이 초안을 유지한다',async method=>{
  const f=await open();
  const scopedQueries=f.client.getQueryCache().findAll({queryKey:['ingredients','g1']});
  expect(scopedQueries).toHaveLength(1);
  const scopedKey=scopedQueries[0]!.queryKey;
  const originalData=f.client.getQueryData(scopedKey);
  stock=1200;
  const recoveryRead=deferred<{data:ReturnType<typeof raw>;error:null}>();
  nextRead=recoveryRead;submit();await waitFor(()=>expect(reads()).toHaveLength(2));

  const externalRead=deferred<{data:ReturnType<typeof raw>;error:null}>();
  nextRead=externalRead;
  let externalDone!:Promise<void>;
  // Start the external read at the first read's success notification, before
  // the screen accepts its candidate. An earlier cancellation can instead
  // make React Query's refetch promise adopt the external result directly.
  const unsubscribe=f.client.getQueryCache().subscribe(event=>{
   if(event.type!=='updated'||event.query!==scopedQueries[0]||event.action.type!=='success')return;
   unsubscribe();
   externalDone=method==='invalidate'
    ? f.client.invalidateQueries({queryKey:scopedKey,exact:true})
    : f.client.refetchQueries({queryKey:scopedKey,exact:true});
  });
  await act(async()=>recoveryRead.resolve({data:raw(1200),error:null}));
  await waitFor(()=>expect(reads()).toHaveLength(3));
  expect(f.client.getQueryData(scopedKey)).toMatchObject({id:'g1',stockTotal:1200});
  expect(openButton().getAttribute('aria-disabled')).toBe('true');
  stock=1300;
  await act(async()=>{
   externalRead.resolve({data:raw(1300),error:null});
   await externalDone;
  });
  await screen.findByText('1.3kg');
  await waitFor(()=>expect(f.client.getQueryState(scopedKey)?.fetchStatus).toBe('idle'));
  const externalData=f.client.getQueryData(scopedKey);
  expect(externalData).not.toBe(originalData);
  expect(externalData).toMatchObject({id:'g1',stockTotal:1300});
  expect(openButton().getAttribute('aria-disabled')).toBe('true');
  expect(quantity().value).toBe('100');expect(reason().value).toBe('내 사유');
  fireEvent.click(openButton());expect(writes()).toHaveLength(1);

  const manualRead=deferred<{data:ReturnType<typeof raw>;error:null}>();nextRead=manualRead;
  const retry=screen.getByRole('button',{name:'최신 재고 다시 불러오기'});
  expect(retry.getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(retry);fireEvent.click(retry);
  await waitFor(()=>expect(reads()).toHaveLength(4));
  expect(writes()).toHaveLength(1);expect(openButton().getAttribute('aria-disabled')).toBe('true');
  await act(async()=>manualRead.resolve({data:raw(1300),error:null}));
  await waitFor(()=>expect(openButton().getAttribute('aria-disabled')).toBeNull());
  expect(reads()).toHaveLength(4);expect(writes()).toHaveLength(1);
  expect(quantity().value).toBe('100');expect(reason().value).toBe('내 사유');
  fireEvent.click(screen.getByRole('button',{name:'확인'}));submit();
  await waitFor(()=>expect(writes()).toHaveLength(2));
  expect(writes()[1]![1]).toMatchObject({p_quantity:100,p_expected_stock:1300,p_note:'내 사유'});
  expect(writes()[1]![1].p_idempotency_key).not.toBe(writes()[0]![1].p_idempotency_key);
 });
});
