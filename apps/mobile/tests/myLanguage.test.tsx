/** INTL-1E MY-08 — 앱 언어는 매장 국가·통화와 분리된 사용자별 판본이다. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RpcError } from '@/lib/supabase';

vi.mock('react-native',async(importOriginal)=>{const rn=await importOriginal<typeof import('react-native')>();return{...rn,Modal:({visible,children}:{visible?:boolean;children?:React.ReactNode})=>visible?<>{children}</>:null};});
vi.mock('expo-router',()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn(),back:vi.fn()}),router:{canGoBack:()=>true,back:vi.fn(),replace:vi.fn()}}));
const safeBack=vi.fn();vi.mock('@/lib/nav',()=>({safeBack:(...a:unknown[])=>safeBack(...a)}));
const preferenceQuery=vi.fn();const mutate=vi.fn();let pending=false;
vi.mock('@/features/international-tax',()=>({
  useUserPreferences:()=>preferenceQuery(),
  useSaveAppLanguage:()=>({mutate,isPending:pending}),
}));
import MyLanguageScreen from '@/features/my/screens/MyLanguageScreen';

const loaded=(language:'ko'|'en'|null='ko',revision=4)=>({data:{appLanguage:language,needsConfirmation:language===null,sourceLocale:language===null?'ja':language,revision},isLoading:false,isError:false,error:null,refetch:vi.fn(async()=>({data:{appLanguage:language,needsConfirmation:language===null,sourceLocale:null,revision},isError:false}))});
const disabled=(name:string)=>screen.getByLabelText(name).getAttribute('aria-disabled')==='true';
const callbacks=()=>mutate.mock.calls.at(-1)![1] as {onSuccess:(v:{appLanguage:'ko'|'en';needsConfirmation:false;sourceLocale:null;revision:number})=>void;onError:(e:unknown)=>void};
beforeEach(()=>{pending=false;mutate.mockReset();safeBack.mockReset();preferenceQuery.mockReset();preferenceQuery.mockReturnValue(loaded());});

describe('사용자 앱 언어',()=>{
  it('서버값 전에는 초안을 만들지 않고 오류와 로딩을 구분한다',()=>{
    preferenceQuery.mockReturnValue({data:undefined,isLoading:true,isError:false,error:null,refetch:vi.fn()});
    const {rerender}=render(<MyLanguageScreen/>);expect(screen.getByText('불러오는 중이에요')).toBeTruthy();expect(screen.queryByLabelText('한국어 선택')).toBeNull();
    preferenceQuery.mockReturnValue({data:undefined,isLoading:false,isError:true,error:new Error('fail'),refetch:vi.fn()});rerender(<MyLanguageScreen/>);expect(screen.getByText('정보를 불러오지 못했어요')).toBeTruthy();
  });
  it('한국어·영어만 고르고 통화는 바꾸지 않는다고 설명한다',()=>{
    render(<MyLanguageScreen/>);expect(screen.getByLabelText('한국어 선택').getAttribute('aria-checked')).toBe('true');expect(screen.getByText(/매장 국가·통화·세금·시간대는 바뀌지 않아요/)).toBeTruthy();expect(screen.queryByText('日本語')).toBeNull();
  });
  it('확인 필요 이관은 선택 전 저장할 수 없다',()=>{
    preferenceQuery.mockReturnValue(loaded(null));render(<MyLanguageScreen/>);expect(screen.getByText(/자동으로 옮길 수 없었어요/)).toBeTruthy();expect(disabled('저장')).toBe(true);
  });
  it('편집 기준 판본과 사용자 언어만 저장하고 성공 뒤 이동한다',async()=>{
    render(<MyLanguageScreen/>);fireEvent.click(screen.getByLabelText('English 선택'));fireEvent.click(screen.getByLabelText('저장'));fireEvent.click(screen.getByLabelText('앱 언어 저장 확정'));
    expect(mutate.mock.calls[0]![0]).toEqual({appLanguage:'en',baseRevision:4});expect(safeBack).not.toHaveBeenCalled();callbacks().onSuccess({appLanguage:'en',needsConfirmation:false,sourceLocale:null,revision:5});await waitFor(()=>expect(safeBack).toHaveBeenCalledWith('/my'));
  });
  it('실패는 화면 안에 남고 저장 중에는 이탈·연타를 막는다',async()=>{
    const {rerender}=render(<MyLanguageScreen/>);fireEvent.click(screen.getByLabelText('English 선택'));fireEvent.click(screen.getByLabelText('저장'));pending=true;rerender(<MyLanguageScreen/>);fireEvent.click(screen.getByLabelText('앱 언어 저장 확정'));fireEvent.click(screen.getByLabelText('앱 언어 저장 확정'));expect(mutate).toHaveBeenCalledTimes(0);
    pending=false;rerender(<MyLanguageScreen/>);fireEvent.click(screen.getByLabelText('앱 언어 저장 확정'));callbacks().onError(new Error('네트워크 오류'));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('네트워크 오류'));expect(safeBack).not.toHaveBeenCalled();
  });
  it('45009 뒤에는 더 높은 판본을 실제로 받아야 잠금이 풀린다',async()=>{
    const q=loaded('ko',4);q.refetch.mockResolvedValueOnce({data:{appLanguage:'ko',needsConfirmation:false,sourceLocale:null,revision:4},isError:false}).mockResolvedValueOnce({data:{appLanguage:'en',needsConfirmation:false,sourceLocale:null,revision:5},isError:false});preferenceQuery.mockReturnValue(q);
    render(<MyLanguageScreen/>);fireEvent.click(screen.getByLabelText('English 선택'));fireEvent.click(screen.getByLabelText('저장'));fireEvent.click(screen.getByLabelText('앱 언어 저장 확정'));callbacks().onError(new RpcError('충돌','45009','REVISION_CONFLICT'));
    await waitFor(()=>expect(screen.getByRole('status')).toBeTruthy());fireEvent.click(screen.getByText('새로고침'));await waitFor(()=>expect(q.refetch).toHaveBeenCalledTimes(1));expect(screen.getByRole('status')).toBeTruthy();fireEvent.click(screen.getByText('새로고침'));await waitFor(()=>expect(q.refetch).toHaveBeenCalledTimes(2));expect(screen.queryByRole('status')).toBeNull();expect(screen.getByLabelText('English 선택').getAttribute('aria-checked')).toBe('true');
  });
  it('배경에서 수락한 새 언어를 이후 변경 비교 기준으로 쓴다',async()=>{
    const q=loaded('ko',4);preferenceQuery.mockReturnValue(q);const {rerender}=render(<MyLanguageScreen/>);
    q.data={appLanguage:'en',needsConfirmation:false,sourceLocale:'en',revision:5};rerender(<MyLanguageScreen/>);
    await waitFor(()=>expect(screen.getByLabelText('English 선택').getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(screen.getByLabelText('한국어 선택'));
    expect(disabled('저장')).toBe(false);
  });
});
