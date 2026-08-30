/**
 * 서버 응답이 **약속한 모양인지** 본다. 아니면 던진다.
 *
 * ⚠ 없는 값을 기본값으로 메우면 안 된다(0153 검토). 서버 배포가 어긋났을 때
 *   `editable` 이 빠지면 `false` 로 읽혀 **수정 버튼이 조용히 사라지고**,
 *   `basis_quality` 가 빠지면 **배지가 조용히 사라진다.** 둘 다 화면은 멀쩡해 보이는데
 *   사장님이 쓸 수 있어야 할 기능이 없어진 상태다 — 오류로 보이는 편이 낫다.
 *   `QueryState` 가 이 오류를 받아 재시도 버튼과 함께 보여 준다.
 *
 * ⚠ **판본이 특히 그렇다.** `revision` 을 `Number(v ?? 0)` 으로 읽으면 서버가 빠뜨렸을 때
 *   0 이 되고, 화면은 그 0 을 들고 저장하러 갔다가 45009(다른 기기에서 바뀌었어요)를
 *   맞는다. 사장님 눈에는 아무 이유 없이 저장이 막히는 것으로 보인다.
 *
 * ⚠ **필드를 따로따로 보면 부족하다.** 넷이 서로를 설명하는 값이라, 하나씩만 보면
 *   말이 안 되는 응답이 통과한다 — 예컨대
 *     `{ has_ledger: true, basis_quality: null, day_status: null, editable: true }`
 *   는 "장부는 있는데 그 장부가 무엇으로 계산됐는지도, 지금 상태가 뭔지도 모른다" 는
 *   뜻이다. 그런 응답을 받으면 화면은 배지를 안 그리고 `수정` 버튼을 띄운다.
 *   그래서 `parseSalesDayContract()` 가 넷을 **한 번에** 읽고 관계까지 본다.
 *
 * ⚠ 이 파일은 **앱 의존이 없다.** 그래야 시험이 화면을 띄우지 않고 이 함수만 돌려
 *   좋은 응답·나쁜 응답을 실제로 넣어 볼 수 있다 — 시험이 복사본을 재면 본체가 바뀌어도
 *   초록으로 남는다. 시험은 `tests/salesDayContract.test.ts` 이고
 *   `pnpm --filter @margincook/mobile test` 로 돈다.
 */
export const CONTRACT_HINT = '앱과 서버 버전이 맞지 않아요. 잠시 뒤 다시 시도해 주세요.';

/** 그날 원가·손익을 무엇을 기준으로 계산했나(0144·0149). 장부가 없으면 null. */
export type SalesDayBasisQuality = 'exact' | 'estimated_current';

/**
 * 그날 장부 상태.
 *
 * ⚠ **`none` 이 없다.** 그건 앱이 "장부가 없다" 를 나타내려고 만든 값이고
 *   (`business_day_state` 쪽), DB 의 `business_day_status` 는
 *   `open | break | closed` 뿐이다. 여기에 `none` 을 허용하면
 *   "장부는 있는데 상태가 none" 같은 응답이 통과한다 — 그 뒤 화면은
 *   `open`·`break` 가 아니라는 이유로 정정 버튼을 띄운다.
 *   장부가 없으면 **null** 이다.
 */
export type SalesDayStatus = 'open' | 'break' | 'closed';

export interface SalesDayContract {
  /** 다음 저장에 되보낼 판본(0117). 없으면 계약 위반이다 — 0 으로 메우지 않는다. */
  revision: number;
  basisQuality: SalesDayBasisQuality | null;
  hasLedger: boolean;
  dayStatus: SalesDayStatus | null;
  editable: boolean;
}

/** 정정 RPC(`amend_ended_business_day`)의 응답 중 **판단에 쓰는** 값들. */
export interface AmendResultContract {
  /** 정말로 달라졌나. 같은 값을 다시 보내면 false 다(0148). */
  changed: boolean;
  /** 장부가 없어서 만들었나. */
  created: boolean;
  /** **다음 저장에 되보낼 판본.** 아래 `auditRevisionNo` 와 다른 값이다(0147). */
  revision: number;
  /** 이 장부를 몇 번 정정했나(감사용). */
  auditRevisionNo: number;
  /**
   * ⚠ `sales_day` 와 달리 **null 이 없다.** 정정이 성공했다는 건 장부가 반드시 있다는
   *   뜻이고, `business_days.basis_quality` 는 NOT NULL(0144)이다. null 을 받으면
   *   화면이 추정 배지를 그릴지 판단할 근거를 잃으므로 계약 위반으로 던진다.
   */
  basisQuality: SalesDayBasisQuality;
}

const BASIS_QUALITIES: readonly SalesDayBasisQuality[] = ['exact', 'estimated_current'];
const DAY_STATUSES: readonly SalesDayStatus[] = ['open', 'break', 'closed'];

const bad = (detail: string): Error => new Error(`${CONTRACT_HINT} (${detail})`);

function needBool(r: Record<string, unknown>, key: string): boolean {
  if (typeof r[key] !== 'boolean') throw bad(`${key}`);
  return r[key] as boolean;
}

/** PostgreSQL `integer`(int4) 상한. 판본·정정 횟수 컬럼이 전부 이 타입이다. */
const PG_INT_MAX = 2147483647;

/**
 * 정수여야 하는 값 — DB 컬럼이 int4 이므로 **0 ~ 2,147,483,647 의 십진 정수**만 참이다.
 *
 * ⚠ 숫자 문자열도 받는다 — PostgREST 가 큰 정수를 문자열로 실어 보내는 경우가 있어서다.
 *   대신 십진 숫자 **그대로**만이다(공백도 안 다듬는다 — 서버는 `' 12 '` 를 못 만든다).
 *   `Number()` 에 그냥 맡기면 `'1e3'`→1000, `'0x10'`→16 처럼 서버가 만들 리 없는 표기가
 *   통과하고, `'9007199254740993'` 은 …992 로 **반올림돼** 다른 판본으로 조용히 바뀐 채
 *   저장에 나간다. 음수도 마찬가지로 서버가 못 만드는 값이다.
 * ⚠ **없거나 범위 밖이면 던진다.** `Number(v ?? 0)` 은 없을 때 0 을 만들고,
 *   그 0 이 판본으로 나가면 저장이 45009 로 막힌다.
 */
function needInt(r: Record<string, unknown>, key: string): number {
  const v = r[key];
  if (v === null || v === undefined) throw bad(`${key}`);
  const n =
    typeof v === 'number' ? v
    : typeof v === 'string' && /^[0-9]+$/.test(v) ? Number(v)
    : NaN;
  if (!Number.isSafeInteger(n) || n < 0 || n > PG_INT_MAX) throw bad(`${key}=${String(v)}`);
  return n;
}

/**
 * 있어야 하고, 값은 null 이거나 허용 목록 안이어야 한다.
 *
 * ⚠ **키 자체가 없으면 계약 위반**이다. `null` 과 구별해야 한다 —
 *   `basis_quality: null` 은 "그날 장부가 없다" 는 정상 답이고,
 *   키가 없는 것은 "서버가 그 값을 모른다" 는 뜻이다.
 */
function needEnum<V extends string>(
  r: Record<string, unknown>, key: string, allowed: readonly V[],
): V | null {
  if (!(key in r)) throw bad(`${key}`);
  const v = r[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || !allowed.includes(v as V)) {
    throw bad(`${key}=${String(v)}`);
  }
  return v as V;
}

/** `needEnum` 과 같되 **null 도 계약 위반**이다 — 원천 컬럼이 NOT NULL 인 응답용. */
function needEnumNonNull<V extends string>(
  r: Record<string, unknown>, key: string, allowed: readonly V[],
): V {
  const v = needEnum(r, key, allowed);
  if (v === null) throw bad(`${key}=null`);
  return v;
}

/**
 * `sales_day` 의 판단용 값들을 **한 번에** 읽고 서로 맞는지까지 본다.
 *
 * 관계 규칙 —
 *   · 장부가 있으면 기준 품질과 상태가 **반드시 있다**
 *   · 장부가 없으면 둘 다 **반드시 null 이다**
 * (`editable` 은 날짜만 보는 값이라 장부 유무와 무관하다 — 기록 없는 어제도 고칠 수 있고,
 *  장부가 살아 있는 오늘도 고칠 수 있는 기간 안이다.)
 */
export function parseSalesDayContract(r: Record<string, unknown>): SalesDayContract {
  const revision = needInt(r, 'revision');
  const hasLedger = needBool(r, 'has_ledger');
  const editable = needBool(r, 'editable');
  const basisQuality = needEnum(r, 'basis_quality', BASIS_QUALITIES);
  const dayStatus = needEnum(r, 'day_status', DAY_STATUSES);

  if (hasLedger) {
    if (basisQuality === null) throw bad('장부가 있는데 basis_quality 가 null 이다');
    if (dayStatus === null) throw bad('장부가 있는데 day_status 가 null 이다');
  } else {
    if (basisQuality !== null) throw bad(`장부가 없는데 basis_quality=${basisQuality} 다`);
    if (dayStatus !== null) throw bad(`장부가 없는데 day_status=${dayStatus} 다`);
  }

  return { revision, basisQuality, hasLedger, dayStatus, editable };
}

/**
 * 정정 RPC 응답.
 *
 * ⚠ `revision` 과 `audit_revision_no` 는 **다른 값**이다(0147). 화면이 다음 저장에
 *   되보낼 것은 앞엣것이고, 뒤엣것은 정정 횟수다. 둘 다 없으면 던진다 —
 *   특히 `revision` 이 0 으로 메워지면 다음 저장이 곧바로 45009 로 막힌다.
 */
export function parseAmendResultContract(r: Record<string, unknown>): AmendResultContract {
  const changed = needBool(r, 'changed');
  const created = needBool(r, 'created');
  const revision = needInt(r, 'revision');
  const auditRevisionNo = needInt(r, 'audit_revision_no');
  const basisQuality = needEnumNonNull(r, 'basis_quality', BASIS_QUALITIES);

  /*
   * 관계 규칙 — `sales_day` 쪽과 같은 이유로, 필드가 각자 멀쩡해도 조합이 거짓말일 수 있다.
   * 장부를 만들었으면(created) 반드시
   *   · changed=true 다 — 0150 이 `v_changed := v_created or …` 로 묶었다.
   *     이걸 통과시키면 화면이 "바뀐 내용이 없어요" 라고 잘못 말한다.
   *   · basisQuality='estimated_current' 다 — 과거 장부를 지금 만들면 기준이 현재값이라
   *     0147 생성 분기가 그 값을 하드코딩했고, 이후 경로는 내리기만 한다.
   */
  if (created && !changed) throw bad('created 인데 changed=false 다');
  if (created && basisQuality !== 'estimated_current') {
    throw bad(`created 인데 basis_quality=${basisQuality} 다`);
  }

  return { changed, created, revision, auditRevisionNo, basisQuality };
}
