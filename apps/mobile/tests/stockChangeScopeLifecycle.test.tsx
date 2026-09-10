import {act,fireEvent,render,screen} from '@testing-library/react';
import {useEffect,type ReactNode} from 'react';
import {beforeEach,expect,it,vi} from 'vitest';
import {StockChangeScreen} from '@/features/ingredients/screens/StockChangeScreen';
import {dismissToast,getToast} from '@/lib/toast';
const m=vi.hoisted(()=>({userId:'actor-a',storeId:'store-a',id:'g1',mode:'deduct',focused:true,save:vi.fn(),replace:vi.fn()}));
vi.mock('@/lib/SessionProvider',()=>({useSessionState:()=>({phase:'ready',userId:m.userId,storeId:m.storeId})}));
vi.mock('expo-router',()=>({useLocalSearchParams:()=>({id:m.id,mode:m.mode}),useRouter:()=>({replace:m.replace}),
 useFocusEffect:(callback:()=>void|(()=>void))=>useEffect(()=>m.focused?callback():undefined,[callback,m.focused]),router:{canGoBack:()=>false,replace:m.replace}}));
vi.mock('react-native',async original=>{const rn=await original<typeof import('react-native')>();return {...rn,Modal:({visible,children}:{visible?:boolean;children?:ReactNode})=>visible?<div>{children}</div>:null};});
vi.mock('@/features/ingredients/screens/QuickInboundScreen',()=>({QuickInboundScreen:()=>null}));
vi.mock('@/features/ingredients/hooks',()=>({useStockChange:()=>({mutate:m.save,isPending:false}),useIngredientDetail:()=>({data:{id:m.id,name:'대파',stockTotal:1000,basePrice:4,baseUnit:'g'},isLoading:false,isSuccess:true,isFetching:false,isFetchedAfterMount:true,error:null,refetch:vi.fn()})}));
beforeEach(()=>{m.userId='actor-a';m.storeId='store-a';m.id='g1';m.mode='deduct';m.focused=true;m.save.mockReset();m.replace.mockReset();const t=getToast();if(t)dismissToast(t.id);});
const start=()=>{const view=render(<StockChangeScreen/>);fireEvent.change(screen.getByRole('textbox',{name:'차감할 수량'}),{target:{value:'100'}});fireEvent.change(screen.getByRole('textbox',{name:'차감 사유'}),{target:{value:'내 사유'}});fireEvent.click(screen.getByRole('button',{name:'재고 차감'}));fireEvent.click(screen.getByRole('button',{name:'차감'}));expect(m.save).toHaveBeenCalledOnce();return {view,callback:m.save.mock.calls[0]![1]};};
for(const outcome of ['success','error'] as const)it.each(['actor','store','id','mode','blur','unmount'] as const)(`대기 ${outcome} 뒤 %s 전환은 새 화면의 toast/navigation/상태를 건드리지 않는다`,part=>{
 const {view,callback}=start();if(part==='actor')m.userId='actor-b';if(part==='store')m.storeId='store-b';if(part==='id')m.id='g2';if(part==='mode')m.mode='waste';if(part==='blur')m.focused=false;
 if(part==='unmount')view.unmount();else view.rerender(<StockChangeScreen/>);
 act(()=>{if(outcome==='success')callback.onSuccess({skipped:false});else callback.onError(Object.assign(new Error('이전 실패'),{code:'45009',details:'REVISION_CONFLICT'}));});
 expect(m.replace).not.toHaveBeenCalled();expect(getToast()).toBeNull();expect(screen.queryByText('이전 실패')).toBeNull();
});
it('A→B→A 뒤 이전 성공 callback은 새 확인창과 새 제출의 잠금을 바꾸지 않는다',()=>{
 const {view,callback}=start();m.userId='actor-b';view.rerender(<StockChangeScreen/>);m.userId='actor-a';view.rerender(<StockChangeScreen/>);
 fireEvent.change(screen.getByRole('textbox',{name:'차감할 수량'}),{target:{value:'50'}});fireEvent.change(screen.getByRole('textbox',{name:'차감 사유'}),{target:{value:'새 사유'}});
 fireEvent.click(screen.getByRole('button',{name:'재고 차감'}));const button=screen.getByRole('button',{name:'차감'});fireEvent.click(button);
 act(()=>callback.onSuccess({skipped:false}));fireEvent.click(button);
 expect(m.save).toHaveBeenCalledTimes(2);expect(getToast()).toBeNull();expect(m.replace).not.toHaveBeenCalled();
});
