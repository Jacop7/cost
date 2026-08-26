/**
 * `sales_day` 응답이 **약속한 모양인지** 본다. 아니면 던진다.
 *
 * ⚠ 없는 값을 기본값으로 메우면 안 된다(0153 검토). 서버 배포가 어긋났을 때
 *   `editable` 이 빠지면 `false` 로 읽혀 **수정 버튼이 조용히 사라지고**,
 *   `basis_quality` 가 빠지면 **배지가 조용히 사라진다.** 둘 다 화면은 멀쩡해 보이는데
 *   사장님이 쓸 수 있어야 할 기능이 없어진 상태다 — 오류로 보이는 편이 낫다.
 *   `QueryState` 가 이 오류를 받아 재시도 버튼과 함께 보여 준다.
 *
 * ⚠ **필드를 따로따로 보면 부족하다.** 넷이 서로를 설명하는 값이라, 하나씩만 보면
 *   말이 안 되는 응답이 통과한다 — 예컨대
 *     `{ has_ledger: true, basis_quality: null, day_status: null, editable: true }`
 *   는 "장부는 있는데 그 장부가 무엇으로 계산됐는지도, 지금 상태가 뭔지도 모른다" 는
 *   뜻이다. 그런 응답을 받으면 화면은 배지를 안 그리고 `수정` 버튼을 띄운다.
 *   그래서 `parseSalesDayContract()` 가 넷을 **한 번에** 읽고 관계까지 본다.
 *
 * ⚠ 이 파일은 **앱 의존이 없다.** `node --experimental-strip-types` 로 그대로 돌려
 *   좋은 응답·나쁜 응답을 실제로 넣어 볼 수 있어야 한다 — 시험이 복사본을 재면
 *   본체가 바뀌어도 초록으로 남는다. 곁의 `dayContract.check.ts` 가 그 시험이고
 *   `pnpm --filter @sikjae/mobile test` 로 돈다.
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
  basisQuality: SalesDayBasisQuality | null;
  hasLedger: boolean;
  dayStatus: SalesDayStatus | null;
  editable: boolean;
}

const BASIS_QUALITIES: readonly SalesDayBasisQuality[] = ['exact', 'estimated_current'];
const DAY_STATUSES: readonly SalesDayStatus[] = ['open', 'break', 'closed'];

const bad = (detail: string): Error => new Error(`${CONTRACT_HINT} (${detail})`);

function needBool(r: Record<string, unknown>, key: string): boolean {
  if (typeof r[key] !== 'boolean') throw bad(`sales_day.${key}`);
  return r[key] as boolean;
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
  if (!(key in r)) throw bad(`sales_day.${key}`);
  const v = r[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || !allowed.includes(v as V)) {
    throw bad(`sales_day.${key}=${String(v)}`);
  }
  return v as V;
}

/**
 * 네 필드를 **한 번에** 읽고 서로 맞는지까지 본다.
 *
 * 관계 규칙 —
 *   · 장부가 있으면 기준 품질과 상태가 **반드시 있다**
 *   · 장부가 없으면 둘 다 **반드시 null 이다**
 * (`editable` 은 날짜만 보는 값이라 장부 유무와 무관하다 — 기록 없는 어제도 고칠 수 있고,
 *  장부가 살아 있는 오늘도 고칠 수 있는 기간 안이다.)
 */
export function parseSalesDayContract(r: Record<string, unknown>): SalesDayContract {
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

  return { basisQuality, hasLedger, dayStatus, editable };
}
