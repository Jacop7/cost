import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import { recoverSalesFinalize, submitSalesFinalize } from '@/features/sales/salesCommandOperation';

const native=vi.hoisted(()=>({getItemAsync:vi.fn(),setItemAsync:vi.fn(),deleteItemAsync:vi.fn()}));
vi.mock('expo-secure-store',()=>native);
const originalOS=Platform.OS;
const scope={actorId:'actor',storeId:'store',businessDate:'2026-09-15',draftId:'draft'};
const command={requestKey:'request',payloadHash:'a'.repeat(64),baseRevision:2};

beforeEach(()=>{Platform.OS='web';localStorage.clear();vi.restoreAllMocks();});
afterEach(()=>{Platform.OS=originalOS;});

it('응답 유실 뒤 저장한 동일 명령의 영수증부터 확인한다',async()=>{
  const execute=vi.fn(async()=>{expect(localStorage.length).toBe(1);throw Error('lost');});
  await expect(submitSalesFinalize(scope,command,execute,async()=>({resolved:'not_recorded'}))).rejects.toThrow('lost');
  const next=vi.fn(async()=>({status:'finalized'}));
  const resolve=vi.fn(async saved=>({resolved:'recorded' as const,result:{status:'finalized',key:saved.requestKey}}));
  await expect(submitSalesFinalize(scope,{...command,requestKey:'new'},next,resolve)).resolves.toMatchObject({resolved:'recorded'});
  expect(resolve).toHaveBeenCalledWith(command,scope);expect(next).not.toHaveBeenCalled();expect(localStorage.length).toBe(0);
});

it('명확한 판본 충돌은 복구 봉투를 제거한다',async()=>{
  await expect(submitSalesFinalize(scope,command,async()=>{throw {code:'45009'};},async()=>({resolved:'recorded'})))
    .rejects.toMatchObject({code:'45009'});
  expect(localStorage.length).toBe(0);
});

it('재시작 복구는 새 초안을 열기 전에 날짜 슬롯의 기존 draft 명령을 그대로 확인한다',async()=>{
  await expect(submitSalesFinalize(scope,command,async()=>{throw Error('lost');},
    async()=>({resolved:'not_recorded'}))).rejects.toThrow('lost');
  const resolve=vi.fn(async()=>({resolved:'not_recorded' as const}));
  await expect(recoverSalesFinalize({actorId:scope.actorId,storeId:scope.storeId,
    businessDate:scope.businessDate},resolve)).resolves.toEqual({resolved:'not_recorded'});
  expect(resolve).toHaveBeenCalledWith(command,scope);
  expect(localStorage.length).toBe(1);

  const newerScope={...scope,draftId:'new-draft'};
  const execute=vi.fn(async()=>({status:'finalized'}));
  await submitSalesFinalize(newerScope,{...command,requestKey:'new-request'},execute,
    async()=>({resolved:'not_recorded'}));
  expect(execute).toHaveBeenCalledWith(command,scope);
  expect(localStorage.length).toBe(0);
});

it('손상 봉투는 격리한 뒤 서버 초안 기준의 새 완료 요청을 실행한다',async()=>{
  await expect(submitSalesFinalize(scope,command,async()=>{throw Error('lost');},async()=>({resolved:'recorded'}))).rejects.toThrow();
  localStorage.setItem(localStorage.key(0)!,'{broken');
  const execute=vi.fn(async()=>({status:'finalized'}));
  await expect(submitSalesFinalize(scope,command,execute,async()=>({resolved:'recorded'}))).resolves.toEqual({status:'finalized'});
  expect(execute).toHaveBeenCalledOnce(); expect(localStorage.length).toBe(0);
});
