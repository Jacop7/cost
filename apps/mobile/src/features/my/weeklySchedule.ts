/**
 * 요일별 영업시간 편집 모델 (0156).
 *
 * 서버 `assert_weekly_schedule` 의 **거울**이다 — 권위는 서버다. 여기 검증은
 * 저장 버튼을 누르기 전에 같은 말을 미리 해 주는 것뿐이고, 두 곳의 규칙이
 * 어긋나면 안 된다(절대원칙 3과 같은 관계).
 *
 * ⚠ 이 파일은 **앱 의존이 없다.** dayContract 와 같은 이유다 — 시험이 화면을
 *   띄우지 않고 좋은 값·나쁜 값을 직접 넣어 볼 수 있어야 한다.
 *   시험은 `tests/weeklySchedule.test.ts`.
 */

export interface DaySchedule {
  /** 'HH:MM' */
  open: string;
  close: string;
  closed: boolean;
  breakStart: string | null;
  breakEnd: string | null;
}

/** dow 0(일)~6(토) → 그날 일정. 서버 weekly_hours 와 같은 키 체계다. */
export type WeeklySchedule = Record<number, DaySchedule>;

/** 화면 표시 순서 — 월~일. 서버 키(0=일요일)와 다르니 섞지 말 것. */
export const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const DEFAULT_DAY: DaySchedule = {
  open: '11:00', close: '22:00', closed: false, breakStart: null, breakEnd: null,
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** 종료가 시작보다 이르면 다음 날로 넘어간다는 뜻이다(서버 close_day_offset=1 과 동일). */
export const isOvernight = (open: string, close: string): boolean => toMin(close) < toMin(open);

/** 자정을 넘으면 24시간을 더해 길이를 구한다. */
export function spanMinutes(open: string, close: string): number {
  const d = toMin(close) - toMin(open);
  return d <= 0 ? d + 24 * 60 : d;
}

export const spanLabel = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

/** 'HH:MM:SS' 도 'HH:MM' 으로 눕힌다 — settings 경유로 만든 옛 규칙이 초를 달고 있다. */
const asHHMM = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.slice(0, 5);
  return HHMM.test(t) ? t : null;
};

/**
 * 서버 규칙 JSON(weekly_hours · weekly_breaks) → 편집 모델.
 *
 * ⚠ 모양이 어긋나면 기본값으로 메우지 않고 **null** 을 돌려준다(0153 검토와 같은 원칙).
 *   조용히 메우면 사장님이 저장하는 순간 진짜 규칙이 기본값으로 덮인다.
 */
export function fromRule(weeklyHours: unknown, weeklyBreaks: unknown): WeeklySchedule | null {
  if (typeof weeklyHours !== 'object' || weeklyHours === null) return null;
  const hoursRec = weeklyHours as Record<string, unknown>;
  const breaksRec = (typeof weeklyBreaks === 'object' && weeklyBreaks !== null)
    ? (weeklyBreaks as Record<string, unknown>) : {};

  const out: WeeklySchedule = {};
  for (let d = 0; d < 7; d += 1) {
    const h = hoursRec[String(d)];
    if (typeof h !== 'object' || h === null) return null;
    const hr = h as Record<string, unknown>;
    const open = asHHMM(hr.open);
    const close = asHHMM(hr.close);
    if (open === null || close === null) return null;

    const b = breaksRec[String(d)];
    let breakStart: string | null = null;
    let breakEnd: string | null = null;
    if (typeof b === 'object' && b !== null) {
      const br = b as Record<string, unknown>;
      breakStart = asHHMM(br.start);
      breakEnd = asHHMM(br.end);
      // 한쪽만 있으면 계약 위반이다 — 반쪽 브레이크를 화면에 실을 수 없다.
      if ((breakStart === null) !== (breakEnd === null)) return null;
    }

    out[d] = { open, close, closed: hr.closed === true, breakStart, breakEnd };
  }
  return out;
}

/** 편집 모델 → `set_operating_hours` 인자. 브레이크 없는 요일은 키를 안 만든다. */
export function toWeeklyJson(days: WeeklySchedule): {
  hours: Record<string, { open: string; close: string; closed: boolean }>;
  breaks: Record<string, { start: string; end: string }>;
} {
  const hours: Record<string, { open: string; close: string; closed: boolean }> = {};
  const breaks: Record<string, { start: string; end: string }> = {};
  for (let d = 0; d < 7; d += 1) {
    const day = days[d] ?? DEFAULT_DAY;
    hours[String(d)] = { open: day.open, close: day.close, closed: day.closed };
    if (!day.closed && day.breakStart !== null && day.breakEnd !== null) {
      breaks[String(d)] = { start: day.breakStart, end: day.breakEnd };
    }
  }
  return { hours, breaks };
}

/**
 * 서버 `assert_weekly_schedule` 의 거울 — 첫 오류 문구를 돌려주고, 없으면 null.
 * 서버와 같은 순서·같은 규칙으로 본다. 문구도 서버와 같은 뜻이어야 한다 —
 * 여기서 통과한 값이 서버에서 거절되면 사장님은 이유를 알 길이 없다.
 */
export function validateWeeklySchedule(days: WeeklySchedule): string | null {
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const label = DOW_LABEL[d];
    const day = days[d];
    if (!day) return `${label}요일 일정이 비어 있어요`;

    if (day.closed) {
      if (day.breakStart !== null || day.breakEnd !== null) {
        return `${label}요일은 휴무인데 브레이크가 있어요`;
      }
      continue;
    }
    if (!HHMM.test(day.open) || !HHMM.test(day.close)) {
      return `${label}요일 시각 형식이 틀렸어요 (HH:MM)`;
    }
    if (day.open === day.close) {
      return `${label}요일 시작과 종료가 같아요 — 영업일 경계를 정할 수 없어요`;
    }
    const overnight = isOvernight(day.open, day.close);

    // 자정 넘김이면 다음 날 영업과 겹치면 안 된다. 종료=다음 날 시작은 허용(경계).
    if (overnight) {
      const next = days[(d + 1) % 7];
      if (next && !next.closed && HHMM.test(next.open) && toMin(day.close) > toMin(next.open)) {
        return `${label}요일 영업이 다음 날 ${day.close}까지인데 ${DOW_LABEL[(d + 1) % 7]}요일 영업이 ${next.open}에 시작해요 — 겹칠 수 없어요`;
      }
    }

    if ((day.breakStart === null) !== (day.breakEnd === null)) {
      return `${label}요일 브레이크는 시작과 종료를 모두 정하거나, 둘 다 비워 주세요`;
    }
    if (day.breakStart !== null && day.breakEnd !== null) {
      if (!HHMM.test(day.breakStart) || !HHMM.test(day.breakEnd)) {
        return `${label}요일 브레이크 시각 형식이 틀렸어요 (HH:MM)`;
      }
      const bs = toMin(day.breakStart);
      const be = toMin(day.breakEnd);
      if (bs === be) return `${label}요일 브레이크 시작과 종료가 같아요`;
      if (bs > be) return `${label}요일 브레이크가 자정을 넘어요 — 자정 전이나 후 한쪽에만 둘 수 있어요`;
      if (overnight) {
        if (!(bs >= toMin(day.open) || be <= toMin(day.close))) {
          return `${label}요일 브레이크(${day.breakStart}~${day.breakEnd})가 영업시간 밖이에요`;
        }
      } else if (bs < toMin(day.open) || be > toMin(day.close)) {
        return `${label}요일 브레이크(${day.breakStart}~${day.breakEnd})가 영업시간(${day.open}~${day.close}) 밖이에요`;
      }
    }
  }
  return null;
}

/** 15분 단위 시각 목록 — 선택지. 직접 입력은 따로 받는다. */
export const QUARTER_SLOTS: readonly string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

/** 직접 입력 정규화 — '9:0'→'09:00', '930'→'09:30'. 못 읽으면 null. */
export function normalizeTimeInput(raw: string): string | null {
  const t = raw.trim();
  let h: number; let m: number;
  const colon = t.match(/^(\d{1,2}):(\d{1,2})$/);
  const plain = t.match(/^(\d{1,2})(\d{2})$/);
  if (colon) { h = Number(colon[1]); m = Number(colon[2]); }
  else if (plain) { h = Number(plain[1]); m = Number(plain[2]); }
  else if (/^\d{1,2}$/.test(t)) { h = Number(t); m = 0; }
  else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
