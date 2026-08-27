/**
 * 설정 저장 입력 — 서버(0167)와 합의한 12개 키만 실리고, 실을 게 없으면 오류다.
 * 타입 경계는 tsc 가 잰다(`@ts-expect-error` 가 남으면 컴파일이 실패한다 — tests 는 tsconfig include 다).
 */
import { describe, expect, it } from 'vitest';
import { buildSettingsPayload, type SaveSettingsInput } from '@/features/settings/hooks';

describe('buildSettingsPayload', () => {
  it('합의한 키를 snake_case 로 싣는다 — 단위·컵·언어 포함', () => {
    expect(buildSettingsPayload({ unitSystem: 'metric', cupVolume: 200, locale: 'en-US', alertTargetMiss: false }))
      .toEqual({ unit_system: 'metric', cup_volume: 200, locale: 'en-US', alert_target_miss: false });
  });

  it('통화·금액 자릿수는 보내지 않는다 — 언어가 정한다(0168)', () => {
    // @ts-expect-error currency 는 서버가 언어에서 파생한다
    const c: Partial<SaveSettingsInput> = { currency: 'USD' };
    // @ts-expect-error moneyDigits 도 통화가 정한다
    const m: Partial<SaveSettingsInput> = { moneyDigits: 2 };
    // 런타임에 섞여 와도(캐스트) 싣지 않는다 — 언어만 실린다.
    expect(buildSettingsPayload({ ...c, ...m, locale: 'ja' } as Partial<SaveSettingsInput>)).toEqual({ locale: 'ja' });
  });

  it('실을 게 없으면 던진다 — 빈 저장이 성공처럼 끝나지 않는다', () => {
    expect(() => buildSettingsPayload({})).toThrow('저장할 설정 값이 없어요');
    // 런타임에 낯선 키가 섞여 와도(캐스트) 싣지 않고, 그것만 있으면 역시 오류다.
    expect(() => buildSettingsPayload({ taxItems: [] } as unknown as Partial<SaveSettingsInput>)).toThrow();
  });

  it('타입이 세금·영업시간 필드를 막는다', () => {
    // @ts-expect-error taxItems 는 save_settings 로 못 간다 — MY > 세금(save_store_tax)의 일이다
    const tax: Partial<SaveSettingsInput> = { taxItems: [] };
    // @ts-expect-error openTime 은 set_operating_hours(판본 필수)의 일이다(0163)
    const hours: Partial<SaveSettingsInput> = { openTime: '11:00' };
    // @ts-expect-error overnight 은 서버가 계산해 주는 값이다
    const overnight: Partial<SaveSettingsInput> = { overnight: true };
    expect([tax, hours, overnight].length).toBe(3);
  });
});
