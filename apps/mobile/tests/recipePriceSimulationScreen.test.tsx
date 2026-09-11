vi.mock('@/features/recipes/draftPreviewQuery', () => ({ useRecipeDraftPreview: () => ({ data: undefined, isFetching: false, error: null, refetch: vi.fn() }), useRecipeRecommendation: () => ({ data: undefined, isFetching: false, error: null, refetch: vi.fn() }) }));
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import Simulation from '@/features/recipes/screens/RecipePriceSimulationScreen';
import {simulationRaw,simulationStore,simulationRecipe} from './fixtures/recipePriceSimulation';
const mock=vi.hoisted(()=>({rpc:vi.fn(),cap:vi.fn(),price:12.34}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc:mock.rpc},rpcError:(e:{message:string})=>new Error(e.message)}));
vi.mock('@/lib/SessionProvider',()=>({useStoreId:()=>simulationStore}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({id:simulationRecipe}),router:{canGoBack:()=>false,replace:vi.fn()}}));
vi.mock('@/features/international-tax',()=>({useAppCapabilities:mock.cap}));
vi.mock('@/features/recipes/hooks',()=>({useRecipeDetail:(_id:string,options?:{readOnly:true})=>{
 if(options?.readOnly!==true)throw new Error('Simulation must not require the revisioned edit contract');
 return {data:{id:simulationRecipe,price:mock.price,baseServings:2,editRevision:null},isLoading:false,isFetched:true,error:null,refetch:vi.fn()};
}}));
let client:QueryClient;
beforeEach(()=>{mock.price=12.34;mock.rpc.mockReset();mock.cap.mockReturnValue({data:{internationalTax:{readEnabled:true}},isLoading:false,error:null,refetch:vi.fn()});client=new QueryClient({defaultOptions:{queries:{retry:false}}});});
afterEach(()=>{cleanup();client.clear();});
const show=()=>render(<QueryClientProvider client={client}><Simulation/></QueryClientProvider>);
it('shows server profit, net sales and batch with read calls only',async()=>{
 mock.rpc.mockResolvedValue({data:simulationRaw(),error:null});show();await screen.findByText('$7.87');
 expect(screen.getByText('세금 별도 판매가',{exact:false})).toBeTruthy();expect(screen.getAllByText('$12.34').length).toBeGreaterThan(0);
 fireEvent.click(screen.getByText('2인분'));await screen.findByText('$15.74');
 expect(mock.rpc.mock.calls.every(([name])=>name==='recipe_price_simulation')).toBe(true);
 expect(mock.rpc.mock.calls[0]?.[1]).toEqual({p_store:simulationStore,p_recipe:simulationRecipe,p_price:12.34});
});
it('a late old-price response never replaces the current price result',async()=>{
 let resolve!:(x:unknown)=>void;mock.rpc.mockImplementation((_name:string,args:{p_price:number})=>args.p_price===12.34?new Promise(r=>{resolve=r}):Promise.resolve({data:{...simulationRaw(20),one:{...simulationRaw(20).one,profit:16}},error:null}));
 show();await waitFor(()=>expect(mock.rpc).toHaveBeenCalledTimes(1));
 fireEvent.change(screen.getByRole('textbox',{name:'시뮬레이션 판매가'}),{target:{value:'20'}});await screen.findByText('$16.00');
 await act(async()=>{resolve({data:simulationRaw(),error:null});});expect(screen.queryByText('$7.87')).toBeNull();expect(screen.getByText('$16.00')).toBeTruthy();
});
it('empty input disables calculation without replacing it with zero',async()=>{
 mock.rpc.mockResolvedValue({data:simulationRaw(),error:null});show();await screen.findByText('$7.87');
 fireEvent.change(screen.getByRole('textbox',{name:'시뮬레이션 판매가'}),{target:{value:''}});
 expect(screen.getByText('올바른 판매가를 입력해 주세요.')).toBeTruthy();expect(mock.rpc).toHaveBeenCalledTimes(1);
});
it('capability errors never start international or legacy calculations',()=>{
 mock.cap.mockReturnValue({data:undefined,isLoading:false,error:new Error('missing'),refetch:vi.fn()});show();expect(screen.queryByRole('textbox')).toBeNull();expect(mock.rpc).not.toHaveBeenCalled();
});

it('missing fixed basis stays unavailable while tax remains visible',async()=>{
 const raw=simulationRaw();const data={...raw,basis:{...raw.basis,fixed_rate:null},one:{...raw.one,fixed:null,profit:null,profit_rate:null,meets_target:null},batch:{...raw.batch,fixed:null,profit:null,profit_rate:null,meets_target:null}};
 mock.rpc.mockResolvedValue({data,error:null});show();await screen.findByText('이익률 산출 전');expect(screen.getByText('$1.23')).toBeTruthy();expect(screen.queryByText('$7.87')).toBeNull();
});
it('unavailable settings do not turn into legacy profit',async()=>{
 const raw=simulationRaw();mock.rpc.mockResolvedValue({data:{...raw,status:'unavailable',reason:'tax_missing',context:null,quote:null,basis:null,one:null,batch:null},error:null});
 show();await screen.findByText(/현재 적용된 국가/);expect(screen.queryByText('순이익')).toBeNull();
});
it('retry preserves entered price and calls the same read-only endpoint',async()=>{
 mock.rpc.mockResolvedValueOnce({data:null,error:{message:'offline'}}).mockResolvedValue({data:simulationRaw(),error:null});show();
 await screen.findByText('정보를 불러오지 못했어요');fireEvent.click(screen.getByText('다시 시도'));await screen.findByText('$7.87');expect(mock.rpc).toHaveBeenCalledTimes(2);
});
it('negative input is rejected rather than converted into a positive price',async()=>{
 mock.rpc.mockResolvedValue({data:simulationRaw(),error:null});show();await screen.findByText('$7.87');
 fireEvent.change(screen.getByRole('textbox',{name:'시뮬레이션 판매가'}),{target:{value:'-12'}});expect(screen.getByText('올바른 판매가를 입력해 주세요.')).toBeTruthy();expect(mock.rpc).toHaveBeenCalledTimes(1);
});

it('KR uses server included tax and whole-won formatting',async()=>{
 mock.price=12000;const raw=simulationRaw(12000);
 const one={...raw.one,listed_total:12000,tax:1091,net_sales:10909,customer_total:12000,material:2000,extra:300,fixed:3756,profit:4853};
 const data={...raw,context:{...raw.context,country_code:'KR',currency_code:'KRW',business_locale_code:'ko-KR',minor_unit:0,price_basis:'tax_inclusive'},
  quote:{...raw.quote,listed_total:12000,net_sales:10909,customer_total:12000,tax_total:1091,merchant_tax_liability:1091},
  basis:{...raw.basis,material_per_serving:2000,extra_per_serving:300,fixed_rate:0.313},one,
  batch:{...one,servings:2,listed_total:24000,tax:2182,net_sales:21818,customer_total:24000,material:4000,extra:600,fixed:7512,profit:9706}};
 mock.rpc.mockResolvedValue({data,error:null});show();await screen.findByText('₩4,853');expect(screen.getByText('₩1,091')).toBeTruthy();
 expect(screen.getByText('KRW · 세금 포함 판매가')).toBeTruthy();
});
