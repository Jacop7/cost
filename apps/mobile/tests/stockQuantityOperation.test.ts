import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Platform } from 'react-native';
import { hasPendingStockQuantity, resolvePendingStockQuantity, submitStockQuantity } from '@/features/ingredients/stockQuantityOperation';
const native=vi.hoisted(()=>({getItemAsync:vi.fn(),setItemAsync:vi.fn(),deleteItemAsync:vi.fn()}));
vi.mock('expo-secure-store',()=>native);
const scope={actorId:'actor',storeId:'store',ingredientId:'ingredient'};
const originalOS=Platform.OS;
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();});
afterEach(()=>{Platform.OS=originalOS;});
it.each(['deduct','discard'] as const)('%s 응답 유실 후 조회만 하고 다음 명시적 입력은 새 작업으로 실행한다',async kind=>{
  const execute=vi.fn(async()=>{expect(localStorage.length).toBe(1);throw Error('lost');});
  const resolve=vi.fn(async()=> 'recorded' as const);
  await expect(submitStockQuantity(scope,'first',kind,execute,resolve)).rejects.toThrow('lost');
  expect(JSON.parse(localStorage.getItem(localStorage.key(0)!)!)).toEqual({version:1,scope,key:'first',kind});
  const next=vi.fn(async()=>({ok:true}));
  await expect(submitStockQuantity(scope,'changed-input','deduct',next,resolve)).resolves.toEqual({resolved:'recorded',previousKind:kind});
  expect(resolve).toHaveBeenCalledWith('first');expect(next).not.toHaveBeenCalled();expect(localStorage.length).toBe(0);
  await expect(submitStockQuantity(scope,'new','deduct',next,resolve)).resolves.toEqual({ok:true});
  expect(next).toHaveBeenCalledTimes(1);
});
it('미반영 확인도 기존·새 수량을 실행하지 않는다',async()=>{
  const write=vi.fn(async()=>{throw Error('offline');});
  const resolve=vi.fn(async()=> 'not_recorded' as const);
  await expect(submitStockQuantity(scope,'old','deduct',write,resolve)).rejects.toThrow();
  await expect(submitStockQuantity(scope,'new','discard',write,resolve)).resolves.toMatchObject({resolved:'not_recorded'});
  expect(write).toHaveBeenCalledTimes(1);expect(localStorage.length).toBe(0);
});
it('조회 실패는 키를 유지하고 재차감하지 않는다',async()=>{
  const write=vi.fn(async()=>{throw Error('lost');});const resolve=vi.fn(async()=>{throw Error('lookup');});
  await expect(submitStockQuantity(scope,'old','deduct',write,resolve)).rejects.toThrow('lost');
  for(let n=0;n<2;n++)await expect(submitStockQuantity(scope,'new','deduct',write,resolve)).rejects.toThrow('lookup');
  expect(write).toHaveBeenCalledTimes(1);expect(localStorage.length).toBe(1);
});
it.each(['actorId','storeId','ingredientId'] as const)('%s 범위를 분리한다',async field=>{
  const write=vi.fn(async()=>{throw Error('lost');});const resolve=vi.fn(async()=> 'recorded' as const);
  await expect(submitStockQuantity(scope,'old','deduct',write,resolve)).rejects.toThrow();
  const success=vi.fn(async()=>true);
  await expect(submitStockQuantity({...scope,[field]:'other'},'new','deduct',success,resolve)).resolves.toBe(true);
  expect(resolve).not.toHaveBeenCalled();expect(localStorage.length).toBe(1);
});
it('저장 실패는 서버를 호출하지 않는다',async()=>{
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});
  const write=vi.fn(async()=>true);const resolve=vi.fn(async()=> 'recorded' as const);
  await expect(submitStockQuantity(scope,'key','deduct',write,resolve)).rejects.toThrow('quota');expect(write).not.toHaveBeenCalled();
});
it('손상된 확인 정보를 기존 수량 재전송으로 복구하지 않는다',async()=>{
  const write=vi.fn(async()=>{throw Error('lost');});const resolve=vi.fn(async()=> 'recorded' as const);
  await expect(submitStockQuantity(scope,'old','deduct',write,resolve)).rejects.toThrow();
  localStorage.setItem(localStorage.key(0)!,'invalid');
  await expect(submitStockQuantity(scope,'new','deduct',write,resolve)).rejects.toThrow();
  expect(write).toHaveBeenCalledTimes(1);expect(resolve).not.toHaveBeenCalled();
});
it('명확한 판본 충돌만 확인 키를 해제한다',async()=>{
  const write=async()=>{throw {code:'45009',details:'REVISION_CONFLICT'};};
  await expect(submitStockQuantity(scope,'key','deduct',write,async()=> 'recorded')).rejects.toMatchObject({code:'45009'});
  expect(localStorage.length).toBe(0);
});
it('네이티브는 SecureStore 확인 후 실행하고 응답 유실 키를 조회한다',async()=>{
  Platform.OS='ios';let saved:string|null=null;
  native.getItemAsync.mockImplementation(async()=>saved);
  native.setItemAsync.mockImplementation(async(_key,value)=>{saved=value;});
  native.deleteItemAsync.mockImplementation(async()=>{saved=null;});
  const write=vi.fn(async()=>{expect(saved).not.toBeNull();throw Error('lost');});
  await expect(submitStockQuantity(scope,'native','discard',write,async()=> 'recorded')).rejects.toThrow();
  await expect(submitStockQuantity(scope,'new','discard',write,async()=> 'recorded')).resolves.toMatchObject({resolved:'recorded'});
  expect(saved).toBeNull();expect(write).toHaveBeenCalledTimes(1);
});

it('이전 요청이 없으면 수량 없는 확인은 RPC 없이 끝난다',async()=>{
  const resolve=vi.fn(async()=> 'recorded' as const);
  expect(await hasPendingStockQuantity(scope)).toBe(false);
  await expect(resolvePendingStockQuantity(scope,resolve)).resolves.toBeNull();
  expect(resolve).not.toHaveBeenCalled();expect(localStorage.length).toBe(0);
});
it.each(['deduct','discard'] as const)('%s 수량 없는 확인은 저장한 원래 키만 조회하고 새 작업을 만들지 않는다',async kind=>{
  const write=vi.fn(async()=>{throw Error('lost');});const resolve=vi.fn(async()=> 'recorded' as const);
  await expect(submitStockQuantity(scope,'old',kind,write,resolve)).rejects.toThrow('lost');
  expect(await hasPendingStockQuantity(scope)).toBe(true);
  await expect(resolvePendingStockQuantity(scope,resolve)).resolves.toEqual({resolved:'recorded',previousKind:kind});
  expect(resolve).toHaveBeenCalledTimes(1);expect(resolve).toHaveBeenCalledWith('old');expect(write).toHaveBeenCalledTimes(1);
  expect(await hasPendingStockQuantity(scope)).toBe(false);
});
it('수량 없는 조회 실패·키 정리 실패는 확인 정보를 남겨 다시 조회할 수 있다',async()=>{
  await expect(submitStockQuantity(scope,'old','discard',async()=>{throw Error('lost');},async()=> 'recorded')).rejects.toThrow();
  await expect(resolvePendingStockQuantity(scope,async()=>{throw Error('lookup');})).rejects.toThrow('lookup');
  expect(await hasPendingStockQuantity(scope)).toBe(true);
  const remove=vi.spyOn(Storage.prototype,'removeItem').mockImplementationOnce(()=>{throw Error('remove');});
  await expect(resolvePendingStockQuantity(scope,async()=> 'recorded')).rejects.toThrow('remove');
  expect(await hasPendingStockQuantity(scope)).toBe(true);remove.mockRestore();
  await expect(resolvePendingStockQuantity(scope,async()=> 'recorded')).resolves.toMatchObject({resolved:'recorded'});
  expect(localStorage.length).toBe(0);
});
it('수량 없는 결과 확인 중 같은 범위의 새 쓰기는 중복 실행되지 않는다',async()=>{
  await expect(submitStockQuantity(scope,'old','deduct',async()=>{throw Error('lost');},async()=> 'recorded')).rejects.toThrow();
  let finish!:(value:'recorded')=>void;
  const resolver=vi.fn(()=>new Promise<'recorded'>(r=>{finish=r;}));
  const checking=resolvePendingStockQuantity(scope,resolver);
  await vi.waitFor(()=>expect(resolver).toHaveBeenCalledOnce());
  const next=vi.fn(async()=>true);
  await expect(submitStockQuantity(scope,'new','deduct',next,async()=> 'recorded')).rejects.toThrow('확인하고 있어요');
  expect(next).not.toHaveBeenCalled();finish('recorded');await checking;
  expect(localStorage.length).toBe(0);
});
