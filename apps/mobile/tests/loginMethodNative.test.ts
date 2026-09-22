import { beforeEach, describe, expect, it, vi } from 'vitest';

const secure = vi.hoisted(() => ({
  stored: null as string | null,
  getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: secure.getItemAsync,
  setItemAsync: secure.setItemAsync,
  deleteItemAsync: secure.deleteItemAsync,
}));

import { clearLoginMethod, isAppleLoginSession, rememberLoginMethod } from '@/lib/loginMethod.native';

beforeEach(() => {
  secure.stored = null;
  secure.getItemAsync.mockReset().mockImplementation(async () => secure.stored);
  secure.setItemAsync.mockReset().mockImplementation(async (_key: string, value: string) => { secure.stored = value; });
  secure.deleteItemAsync.mockReset().mockImplementation(async () => { secure.stored = null; });
});

describe('현재 기기 로그인 방식', () => {
  it('Apple 로그인 세션의 같은 사용자만 감시한다', async () => {
    await rememberLoginMethod('owner-a', 'apple');
    expect(await isAppleLoginSession('owner-a')).toBe(true);
    expect(await isAppleLoginSession('owner-b')).toBe(false);
  });

  it('같은 사용자라도 Google 재로그인은 Apple 철회 감시 대상이 아니다', async () => {
    await rememberLoginMethod('owner-a', 'apple');
    await rememberLoginMethod('owner-a', 'google');
    expect(await isAppleLoginSession('owner-a')).toBe(false);
  });

  it('로그아웃하면 이전 Apple 세션 표시를 지운다', async () => {
    await rememberLoginMethod('owner-a', 'apple');
    await clearLoginMethod();
    expect(await isAppleLoginSession('owner-a')).toBe(false);
  });
});
