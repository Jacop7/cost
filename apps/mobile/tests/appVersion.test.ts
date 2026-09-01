import { describe, expect, it } from 'vitest';
import appConfig from '../app.json';
import { APP_VERSION, APP_VERSION_HEADER } from '@/lib/appVersion';

describe('클라이언트 앱 판본 헤더', () => {
  it('app.json의 세 자리 판본을 단일 원본으로 사용한다', () => {
    expect(APP_VERSION).toBe(appConfig.expo.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('서버와 약속한 헤더 이름을 사용한다', () => {
    expect(APP_VERSION_HEADER).toBe('x-margincook-app-version');
  });
});
