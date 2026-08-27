/**
 * 단위·언어·알림·세금·영업시간처럼 여러 화면이 공유하는 매장 설정 훅.
 * 설정 응답 계약과 판본 저장은 이 경계에서만 소유한다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidate, invalidateOn, qk } from '@/lib/queryClient';
import { rpcError, supabase } from '@/lib/supabase';
import { asJson } from '@/lib/json';
import { useStoreId } from '@/lib/SessionProvider';
import type { TaxMode } from '@sikjae/types';
import { LOCALES } from '@sikjae/core';
import { rpcNumber } from '@/lib/rpcValue';

// ── 매장 설정 (MY-06 단위 · MY-08 언어/통화 · 알림) ───────────
export interface StoreSettings {
  unitSystem: string;
  cupVolume: number;
  defaultTargetProfitRate: number;
  locale: string;
  currency: string;
  unitPriceDigits: number;
  quantityDigits: number;
  moneyDigits: number;
  alertMorningSummary: boolean;
  alertInboundDelay: boolean;
  alertPriceSpike: boolean;
  alertTargetMiss: boolean;
  /** 영업 시작 시각 'HH:MM'. */
  /** ⚠ 표시 폼의 **월요일** 값이다(0156 이후 영업시간은 요일별이다). 권위는 규칙이다. */
  openTime: string;
  /** 영업 종료 시각 'HH:MM'. 시작보다 이르면 자정을 넘는 영업이다. */
  closeTime: string;
  /** 브레이크 타임(선택). 없으면 null. */
  breakStart: string | null;
  breakEnd: string | null;
  /** 자정을 넘는 영업인가 — 서버가 판단해서 준다. */
  overnight: boolean;
  /** 총 영업 시간(분). 10:00~02:00 이면 960. */
  openMinutes: number;
  /**
   * 세금 — **매장 하나에 하나다**(0087). 레시피마다 다르지 않다.
   * 고치는 길은 MY > 세금 뿐이고, 고치면 전 레시피 손익 변동에 기록된다.
   */
  taxMode: TaxMode;
  taxItems: { name: string; rate: number }[];
  /** 저장 토큰(0171) — save_settings 의 p_base_revision. 다른 기기가 먼저 저장했으면 45009. */
  revision: number;
}

/**
 * get_settings 응답 계약 — 키와 JSON 타입. 하나라도 빠지면 오류다(기본값으로 메우지 않는다).
 * ⚠ DB 시험 32 가 **실제 RPC 응답**의 키 집합을 이 목록과 같은 리터럴로 재고, 앱 시험(settingsResponse)이
 *   그 리터럴을 읽어 여기와 대조한다 — 어느 한쪽만 고치면 빨개진다(검토 P0: cup_volume 이 RPC 에 없었다).
 */
export const SETTINGS_SHAPE = {
  locale: 'string', currency: 'string', unit_system: 'string',
  cup_volume: 'number', default_target_profit_rate: 'number',
  unit_price_digits: 'number', quantity_digits: 'number', money_digits: 'number',
  alert_morning_summary: 'boolean', alert_inbound_delay: 'boolean', alert_price_spike: 'boolean', alert_target_miss: 'boolean',
  open_time: 'string', close_time: 'string', break_start: 'string|null', break_end: 'string|null',
  overnight: 'boolean', open_minutes: 'number', tax_mode: 'string', tax_items: 'array',
  revision: 'number',
} as const;

/**
 * 응답 경계 검증(검토 지적). 예전엔 `data ?? {}` 로 null 을 빈 객체로 바꾸고 ko/KRW 를 채워서,
 * 설정 행이 없거나 RLS 가 회귀해도 **정상 한국어 설정처럼** 보였다. 이제 null·키 누락·타입 불일치는
 * 오류이고, 화면은 그걸 오류로 그린다. 시험이 이 함수만 떼어 잰다.
 */
export function parseStoreSettings(data: unknown): StoreSettings {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('설정 응답이 비어 있어요 — 설정 행이 없거나 권한이 없어요');
  }
  const r = data as Record<string, unknown>;
  for (const [k, t] of Object.entries(SETTINGS_SHAPE)) {
    const v = r[k];
    const ok = t === 'array' ? Array.isArray(v)
      : t === 'string|null' ? (v === null || typeof v === 'string')
      : typeof v === t;
    if (!ok) throw new Error(`설정 응답에 ${k} 가 없거나 형식이 달라요 (${t})`);
  }
  /*
   * 값의 뜻(검토 P1) — 타입만 보면 미등록 언어·통화, 음수 컵, 자릿수 9, "25:00", 깨진 세금 항목이 통과하고
   * 미등록 언어는 나중에 ko 로 위장된다. 서버(0167~0169)와 같은 규칙으로 여기서도 거른다.
   */
  const bad = (k: string, why: string): never => { throw new Error(`설정 응답의 ${k} 가 이상해요: ${why}`); };
  const loc = LOCALES.find((l) => l.key === r.locale);
  if (!loc) bad('locale', `미등록 언어 ${String(r.locale)}`);
  if (r.currency !== loc!.currency) bad('currency', `${String(r.currency)} 는 ${loc!.key} 의 통화(${loc!.currency})가 아니에요`);
  if (r.money_digits !== loc!.moneyDigits) bad('money_digits', `${String(r.money_digits)} ≠ 통화 자릿수 ${loc!.moneyDigits}`);
  if (r.unit_system !== 'metric') bad('unit_system', `1차는 metric 뿐 (${String(r.unit_system)})`);
  const cup = r.cup_volume as number;
  if (!Number.isFinite(cup) || cup <= 0 || cup > 5000) bad('cup_volume', `0 < v ≤ 5000 (${cup})`);
  for (const k of ['unit_price_digits', 'quantity_digits'] as const) {
    const v = r[k] as number;
    if (!Number.isInteger(v) || v < 0 || v > 4) bad(k, `0~4 정수 (${v})`);
  }
  const rate = r.default_target_profit_rate as number;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) bad('default_target_profit_rate', `0~100 (${rate})`);
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const k of ['open_time', 'close_time'] as const) if (!HHMM.test(r[k] as string)) bad(k, `HH:MM 이 아니에요 (${String(r[k])})`);
  for (const k of ['break_start', 'break_end'] as const) if (r[k] !== null && !HHMM.test(r[k] as string)) bad(k, `HH:MM 이 아니에요 (${String(r[k])})`);
  if (!Number.isInteger(r.open_minutes) || (r.open_minutes as number) < 0 || (r.open_minutes as number) > 1440) bad('open_minutes', `0~1440 (${String(r.open_minutes)})`);
  if (!TAX_MODES.has(r.tax_mode as string)) bad('tax_mode', `모르는 값 ${String(r.tax_mode)}`);
  if (!Number.isSafeInteger(r.revision) || (r.revision as number) < 1) bad('revision', `1 이상 정수 (${String(r.revision)})`);
  // 서버 assert_tax_items 와 같은 규칙 — 이름은 다듬어 비어 있지 않고, 요율은 0 이상 100 **미만**.
  for (const [i, t] of (r.tax_items as unknown[]).entries()) {
    const it = t as Record<string, unknown> | null;
    if (!it || typeof it !== 'object' || typeof it.name !== 'string' || it.name.trim() === ''
        || typeof it.rate !== 'number' || !Number.isFinite(it.rate) || it.rate < 0 || it.rate >= 100) {
      bad('tax_items', `${i}번째 항목이 {name: 비어 있지 않은 문자열, rate: 0 이상 100 미만} 이 아니에요`);
    }
  }
  return {
    unitSystem: r.unit_system as string,
    cupVolume: r.cup_volume as number,
    defaultTargetProfitRate: r.default_target_profit_rate as number,
    // core LocaleKey 다('ko', 'en-US', …). 예전 기본값 'ko-KR' 은 0168 이 'ko' 로 옮겼다.
    locale: r.locale as string,
    currency: r.currency as string,
    unitPriceDigits: r.unit_price_digits as number,
    quantityDigits: r.quantity_digits as number,
    moneyDigits: r.money_digits as number,
    alertMorningSummary: r.alert_morning_summary as boolean,
    alertInboundDelay: r.alert_inbound_delay as boolean,
    alertPriceSpike: r.alert_price_spike as boolean,
    alertTargetMiss: r.alert_target_miss as boolean,
    openTime: r.open_time as string,
    closeTime: r.close_time as string,
    breakStart: r.break_start as string | null,
    breakEnd: r.break_end as string | null,
    overnight: r.overnight as boolean,
    openMinutes: r.open_minutes as number,
    taxMode: r.tax_mode as TaxMode,
    taxItems: (r.tax_items as { name: string; rate: number }[]).map((t) => ({ name: t.name, rate: t.rate })),
    revision: r.revision as number,
  };
}
/** 서버 settings.tax_mode 의 값 집합(0090 이후 tax_of 가 읽지 않지만 응답엔 남아 있다). */
const TAX_MODES = new Set(['included', 'separate', 'exempt']);

export function useStoreSettings() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: qk.storeSettings,
    queryFn: async (): Promise<StoreSettings> => {
      const { data, error } = await supabase.rpc('get_settings', { p_store: storeId });
      if (error) throw new Error(error.message);
      return parseStoreSettings(data);
    },
  });
}

/**
 * 세금 저장(0087). 전 레시피 손익이 다시 계산되고 손익 변동에 한 줄씩 남는다.
 * ⚠ 그래서 레시피·매출·수정 내역까지 함께 무효화한다 — 고정지출(E4)과 같다.
 */
export function useSaveStoreTax() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: { items: { name: string; rate: number }[]; baseRevision: number }) => {
      if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 1) {
        throw new Error('설정을 아직 불러오지 못했어요 — 잠시 후 다시 시도해 주세요');
      }
      const items = input.items
        // 서버 assert_tax_items 계약과 같다. 0%도 아직 요율을 정하지 않은 유효 항목으로 보존한다.
        .filter((t) => t.name.trim() !== '' && t.rate >= 0)
        .map((t) => ({ name: t.name.trim(), rate: t.rate }));
      const { data, error } = await supabase.rpc('save_store_tax', {
        p_store: storeId,
        // ⚠ 서버 인자는 남아 있지만 tax_of() 가 더는 읽지 않는다(0090).
        //   세금은 항목의 합뿐이다. 인자를 지우려면 RPC 를 drop 해야 해서 자리만 뒀다.
        p_mode: 'included',
        p_items: items,
        p_base_revision: input.baseRevision,
      });
      if (error) throw rpcError(error);
      return { ...parseTaxSaveResult(data), items };
    },
    onSuccess: (result) => {
      qc.setQueryData<StoreSettings>(qk.storeSettings, (old) => old
        ? { ...old, taxMode: 'included', taxItems: result.items, revision: result.revision }
        : old);
      invalidate(qc, [qk.storeSettings, ...invalidateOn.e4()]);
    },
  });
}

export interface SettingsSaveResult { changed: boolean; revision: number }
export interface TaxSaveResult extends SettingsSaveResult { recipes: number }

function resultObject(data: unknown, what: string): Record<string, unknown> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`서버가 ${what} 저장 결과를 주지 않았어요`);
  }
  return data as Record<string, unknown>;
}

function resultBool(r: Record<string, unknown>, key: string, what: string): boolean {
  if (typeof r[key] !== 'boolean') throw new Error(`서버 ${what} 결과의 ${key} 형식이 달라요`);
  return r[key] as boolean;
}

function resultInt(r: Record<string, unknown>, key: string, what: string, min: number): number {
  const v = r[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > 2147483647) {
    throw new Error(`서버 ${what} 결과의 ${key} 형식이 달라요`);
  }
  return v;
}

/** save_settings 응답 계약 — 누락을 false/0 으로 위장하지 않는다. */
export function parseSettingsSaveResult(data: unknown): SettingsSaveResult {
  const r = resultObject(data, '설정');
  return { changed: resultBool(r, 'changed', '설정'), revision: resultInt(r, 'revision', '설정', 1) };
}

/** save_store_tax 응답 계약. */
export function parseTaxSaveResult(data: unknown): TaxSaveResult {
  const r = resultObject(data, '세금');
  return {
    changed: resultBool(r, 'changed', '세금'),
    recipes: resultInt(r, 'recipes', '세금', 0),
    revision: resultInt(r, 'revision', '세금', 1),
  };
}

/**
 * 서버 save_settings(0172)와 합의한 **10개 키**. StoreSettings 의 나머지(taxItems·taxMode·
 * overnight·영업시간…)는 타입에서부터 못 넘긴다 — 예전엔 넓은 타입이 받아 놓고 전송에서
 * 버려서 빈 저장이 성공처럼 끝났다(검토 지적).
 */
export type SaveSettingsInput = Pick<StoreSettings,
  | 'locale' | 'unitSystem' | 'cupVolume' | 'defaultTargetProfitRate'
  | 'unitPriceDigits' | 'quantityDigits'
  | 'alertMorningSummary' | 'alertInboundDelay' | 'alertPriceSpike' | 'alertTargetMiss'>;
// ⚠ currency·moneyDigits 는 여기 없다 — **언어가 정한다**(0168 locale_defaults). 서버가 파생하고,
//   같은 요청에 다른 값이 실리면 거부한다. 앱은 locale 만 보낸다.

const SETTINGS_KEYS: Record<keyof SaveSettingsInput, string> = {
  locale: 'locale',
  unitSystem: 'unit_system',
  cupVolume: 'cup_volume',
  defaultTargetProfitRate: 'default_target_profit_rate',
  unitPriceDigits: 'unit_price_digits',
  quantityDigits: 'quantity_digits',
  alertMorningSummary: 'alert_morning_summary',
  alertInboundDelay: 'alert_inbound_delay',
  alertPriceSpike: 'alert_price_spike',
  alertTargetMiss: 'alert_target_miss',
};

/**
 * 전송 페이로드 — 합의한 키만 싣고, **실을 게 없으면 오류**다(조용한 no-op 금지).
 * ⚠ 영업시간은 여기로 안 간다(0163) — MY > 영업시간의 set_operating_hours(판본 필수)가 유일한 문이다.
 */
export function buildSettingsPayload(input: Partial<SaveSettingsInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const k of Object.keys(SETTINGS_KEYS) as (keyof SaveSettingsInput)[]) {
    const v = input[k];
    if (v !== undefined) payload[SETTINGS_KEYS[k]] = v;
  }
  if (Object.keys(payload).length === 0) throw new Error('저장할 설정 값이 없어요');
  return payload;
}

/**
 * 설정 저장 — **판본 토큰**(0171)을 함께 보낸다. 마지막으로 받은 설정의 revision 이 base 이고, 그 사이
 * 다른 기기가 저장했으면 서버가 45009 로 거절한다(화면은 코드로 갈라 충돌 배너를 띄운다).
 * 화면이 편집 시작 판본을 주지 않으면 보내지 않는다 — base 없이 보내면 서버가 BASE_REQUIRED 로 막는다.
 */
export interface SaveSettingsMutation {
  values: Partial<SaveSettingsInput>;
  /** 사용자가 편집을 시작했을 때의 판본. 저장 직전 최신 캐시로 바꾸면 낡은 초안이 덮어쓴다. */
  baseRevision: number;
}

export function useSaveSettings() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: SaveSettingsMutation) => {
      if (!Number.isSafeInteger(input.baseRevision) || input.baseRevision < 1) throw new Error('설정을 아직 불러오지 못했어요 — 잠시 후 다시 시도해 주세요');
      const { data, error } = await supabase.rpc('save_settings', {
        p_store: storeId, p_payload: asJson(buildSettingsPayload(input.values)), p_base_revision: input.baseRevision,
      });
      // ⚠ 코드를 살려 던진다 — 화면이 45009(다른 기기 변경)를 문구가 아니라 코드로 가른다.
      if (error) throw rpcError(error);
      return parseSettingsSaveResult(data);
    },
    onSuccess: (result, input) => {
      // 새 판본을 즉시 올려 재조회 전 연속 저장이 방금 자기가 올린 판본과 충돌하지 않게 한다.
      qc.setQueryData<StoreSettings>(qk.storeSettings, (old) => {
        if (!old) return old;
        const next = { ...old, ...input.values, revision: result.revision };
        if (input.values.locale !== undefined) {
          const loc = LOCALES.find((l) => l.key === input.values.locale);
          if (loc) { next.currency = loc.currency; next.moneyDigits = loc.moneyDigits; }
        }
        return next;
      });
      invalidate(qc, [qk.settings, qk.storeSettings]);
    },
    // 45009 뒤에는 최신값을 받되, 화면은 사용자가 새로고침하기 전까지 자기 초안을 유지하고 저장을 막는다.
    onError: () => invalidate(qc, [qk.settings, qk.storeSettings]),
  });
}

export interface OperatingHours {
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  /** 종료가 시작보다 이르면 1 — 다음 날로 넘어간다는 뜻이다. 서버가 계산한다. */
  closeDayOffset: number;
  closed: boolean;
}

export interface HoursStatus {
  localDate: string;
  /** 매장 시간대(IANA). 정한 적 없으면 서버 기본(Asia/Seoul)이 온다. */
  timezone: string;
  /** 사장님이 **정한** 값인가(0122 confirmed). false 면 화면이 기기 시간대를 제안한다. */
  timezoneConfirmed: boolean;
  /** 오늘 **실제로** 적용 중인 시간. settings 입력값이 아니라 규칙에서 온다. */
  today: OperatingHours;
  /** 지금 적용 중인 규칙 전체(주간). 규칙이 없으면 null. */
  currentRule: WeeklyRuleInfo | null;
  /**
   * 아직 시작 안 한 규칙. 없으면 null.
   * ⚠ 있으면 **이게 편집 기준이다**(0159 · 검토 P1-1) — 예약 주간표를 통째로 받아
   *   이어서 편집해야 한다. 예전엔 그날 시간만 받아서, 재진입한 화면이 현재 규칙으로
   *   다시 편집했고 예약 변경이 조용히 사라졌다.
   */
  pending: (WeeklyRuleInfo & { effectiveFrom: string; hours: OperatingHours }) | null;
}

/** 편집 기준 규칙 — 판본(revision)은 저장에 되보내는 토큰이다(0159). */
export interface WeeklyRuleInfo {
  ruleId: string;
  revision: number;
  effectiveFrom: string | null;
  weeklyHours: Record<string, unknown>;
  weeklyBreaks: Record<string, unknown>;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const YMD_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const failed = (what: string) =>
  new Error(`서버가 ${what}을 주지 않았어요. 잠시 후 다시 시도해 주세요`);

/** 시각 문자열. 형식이 아니면 던진다 — 빈 문자열로 넘기면 화면이 `~` 만 그린다. */
function reqTime(v: unknown, what: string): string {
  const t = typeof v === 'string' ? v : '';
  if (!HHMM.test(t)) throw failed(what);
  return t;
}

/** 브레이크는 **없는 게 정상**이다. 다만 있으면 시각이어야 한다. */
function optTime(v: unknown, what: string): string | null {
  if (v === null || v === undefined) return null;
  return reqTime(v, what);
}

/**
 * ⚠ 조용한 기본값을 두지 않는다(0132). `String(v.open_time ?? '')` 이면 서버가 키를
 *   빠뜨려도 화면이 멀쩡히 열리고 시간만 빈칸이 된다. 사장님은 영업시간이 지워진 줄 안다.
 */
const hoursOf = (v: Record<string, unknown>, where: string): OperatingHours => ({
  openTime: reqTime(v.open_time, `${where} 시작 시각`),
  closeTime: reqTime(v.close_time, `${where} 종료 시각`),
  breakStart: optTime(v.break_start, `${where} 브레이크 시작`),
  breakEnd: optTime(v.break_end, `${where} 브레이크 종료`),
  closeDayOffset: rpcNumber(v.close_day_offset),
  closed: Boolean(v.closed),
});

/**
 * 지금 적용 중인 영업시간과 **예약된** 영업시간(0131).
 *
 * ⚠ 왜 `useStoreSettings` 로 안 되는가 — 그건 **입력 폼**이라 저장하는 순간 새 값이 된다.
 *   그런데 영업 중에 바꾸면 실제 적용은 **다음 영업일**부터다(0130). 둘을 같은 값으로
 *   보여 주면 화면이 "오늘부터 바뀌었다"고 거짓말한다.
 */
export function useHoursStatus() {
  const storeId = useStoreId();
  return useQuery({
    queryKey: [...qk.storeSettings, 'hours-status'],
    enabled: Boolean(storeId),
    queryFn: async (): Promise<HoursStatus> => {
      const { data, error } = await supabase.rpc('operating_hours_status', { p_store: storeId });
      if (error) throw new Error(error.message);
      const r = (data ?? {}) as unknown as Record<string, unknown>;

      const localDate = typeof r.local_date === 'string' ? r.local_date : '';
      if (!YMD_RE.test(localDate)) throw failed('오늘 날짜');

      // ⚠ 조용한 기본값 금지(0132·0156). 없으면 던져야 배포 어긋남이 화면에 보인다.
      const timezone = typeof r.timezone === 'string' && r.timezone !== '' ? r.timezone : null;
      if (timezone === null) throw failed('매장 시간대');
      if (typeof r.timezone_confirmed !== 'boolean') throw failed('시간대 확정 여부');

      const ruleInfo = (v: unknown, what: string): WeeklyRuleInfo | null => {
        const rr = v as Record<string, unknown> | null | undefined;
        if (!rr) return null;
        const wh = rr.weekly_hours;
        const wb = rr.weekly_breaks;
        if (typeof wh !== 'object' || wh === null || typeof wb !== 'object' || wb === null) {
          throw failed(what);
        }
        // ⚠ 판본이 없으면 던진다 — 0 으로 메우면 저장이 45009 로 막힌다(dayContract 와 같은 이유).
        const rid = typeof rr.rule_id === 'string' && rr.rule_id !== '' ? rr.rule_id : null;
        const rev = typeof rr.revision === 'number' && Number.isSafeInteger(rr.revision) && rr.revision >= 1
          ? rr.revision : null;
        if (rid === null || rev === null) throw failed(`${what} 판본`);
        return {
          ruleId: rid, revision: rev,
          effectiveFrom: typeof rr.effective_from === 'string' && YMD_RE.test(rr.effective_from)
            ? rr.effective_from : null,
          weeklyHours: wh as Record<string, unknown>,
          weeklyBreaks: wb as Record<string, unknown>,
        };
      };
      const currentRule = ruleInfo(r.current_rule, '주간 규칙');

      const today = r.today as Record<string, unknown> | null;
      if (!today) throw failed('오늘 영업시간');

      const p = r.pending as Record<string, unknown> | null;
      let pending: HoursStatus['pending'] = null;
      if (p) {
        const info = ruleInfo(p, '예약 규칙');
        const from = info?.effectiveFrom ?? null;
        if (info === null || from === null) throw failed('영업시간 적용 시작일');
        pending = {
          ...info,
          effectiveFrom: from,
          hours: hoursOf((p.hours ?? {}) as Record<string, unknown>, '예약된'),
        };
      }

      return {
        localDate, timezone, timezoneConfirmed: r.timezone_confirmed,
        today: hoursOf(today, '오늘'), currentRule, pending,
      };
    },
  });
}

/**
 * 요일별 영업시간 저장(0156) — `set_operating_hours` 직행.
 *
 * ⚠ `useSaveSettings` 가 아니다. 그쪽(settings)은 요일 구분이 없는 옛 입력 폼이라
 *   월~일 공통값만 실을 수 있다. 요일별 규칙은 이 문으로만 온전히 간다.
 */
export function useSetOperatingHours() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (input: {
      weeklyHours: Record<string, unknown>;
      weeklyBreaks: Record<string, unknown>;
      /** 편집 기준(0159). **필수**다(0163) — 서버도 없으면 거부한다(BASE_REQUIRED). */
      baseRuleId: string;
      baseRevision: number;
    }): Promise<{ effectiveFrom: string; appliesToday: boolean; ruleId: string; ruleRevision: number }> => {
      const { data, error } = await supabase.rpc('set_operating_hours', {
        p_store: storeId,
        p_weekly_hours: asJson(input.weeklyHours),
        p_weekly_breaks: asJson(input.weeklyBreaks),
        p_base_rule_id: input.baseRuleId,
        p_base_revision: input.baseRevision,
      });
      // ⚠ 코드를 살려 던진다(0145) — 화면이 45009(다른 기기 변경)를 문구가 아니라 코드로 가른다.
      if (error) throw rpcError(error);
      const r = (data ?? {}) as unknown as Record<string, unknown>;
      // 언제부터인지는 화면이 반드시 말해야 한다(0130) — 없으면 계약 위반이다.
      const from = typeof r.effective_from === 'string' ? r.effective_from : '';
      if (!YMD_RE.test(from)) throw failed('적용 시작일');
      if (typeof r.applies_today !== 'boolean') throw failed('오늘 적용 여부');
      // 다음 저장에 되보낼 판본(0159) — 없으면 계약 위반이다.
      const rid = typeof r.rule_id === 'string' && r.rule_id !== '' ? r.rule_id : null;
      const rev = typeof r.rule_revision === 'number' && Number.isSafeInteger(r.rule_revision) && r.rule_revision >= 1
        ? r.rule_revision : null;
      if (rid === null || rev === null) throw failed('규칙 판본');
      return { effectiveFrom: from, appliesToday: r.applies_today, ruleId: rid, ruleRevision: rev };
    },
    // 영업시간은 상태 카드(business_day_state)에도 실린다 — 같이 다시 그린다.
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), ...invalidateOn.businessDay()]),
  });
}

/**
 * 매장 시간대 변경(0156) — 유일한 문. 영업 중이면 서버가 45011 로 거부한다.
 * 최초 제안은 화면이 기기 시간대(Intl)로 하고, 확정은 이 RPC 가 confirmed 로 남긴다.
 */
export function useSetStoreTimezone() {
  const qc = useQueryClient();
  const storeId = useStoreId();
  return useMutation({
    mutationFn: async (timezone: string): Promise<void> => {
      const { error } = await supabase.rpc('set_store_timezone', {
        p_store: storeId, p_timezone: timezone,
      });
      if (error) throw new Error(error.message);
    },
    // 시간대가 바뀌면 '오늘'이 움직인다 — 날짜를 쓰는 화면 전부가 대상이다.
    onSuccess: () => invalidate(qc, [...invalidateOn.settingsSaved(), ...invalidateOn.businessDay()]),
  });
}
