/**
 * `sales_day` 응답이 **약속한 모양인지** 본다. 아니면 던진다.
 *
 * ⚠ 없는 값을 기본값으로 메우면 안 된다(0153 검토). 서버 배포가 어긋났을 때
 *   `editable` 이 빠지면 `false` 로 읽혀 **수정 버튼이 조용히 사라지고**,
 *   `basis_quality` 가 빠지면 **배지가 조용히 사라진다.** 둘 다 화면은 멀쩡해 보이는데
 *   사장님이 쓸 수 있어야 할 기능이 없어진 상태다 — 오류로 보이는 편이 낫다.
 *   `QueryState` 가 이 오류를 받아 재시도 버튼과 함께 보여 준다.
 *
 * ⚠ 이 파일은 **앱 의존이 없다.** `node --experimental-strip-types` 로 그대로 돌려
 *   좋은 응답·나쁜 응답을 실제로 넣어 볼 수 있어야 한다 — 시험이 복사본을 재면
 *   본체가 바뀌어도 초록으로 남는다.
 */
export const CONTRACT_HINT = '앱과 서버 버전이 맞지 않아요. 잠시 뒤 다시 시도해 주세요.';

export function needBool(r: Record<string, unknown>, key: string): boolean {
  if (typeof r[key] !== 'boolean') {
    throw new Error(`${CONTRACT_HINT} (sales_day.${key})`);
  }
  return r[key] as boolean;
}

/**
 * 있어야 하고, 값은 null 이거나 허용 목록 안이어야 한다.
 *
 * ⚠ **키 자체가 없으면 계약 위반**이다. `null` 과 구별해야 한다 —
 *   `basis_quality: null` 은 "그날 장부가 없다"는 정상 답이고,
 *   키가 없는 것은 "서버가 그 값을 모른다" 는 뜻이다.
 */
export function needEnum<V extends string>(
  r: Record<string, unknown>, key: string, allowed: readonly V[],
): V | null {
  if (!(key in r)) throw new Error(`${CONTRACT_HINT} (sales_day.${key})`);
  const v = r[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || !allowed.includes(v as V)) {
    throw new Error(`${CONTRACT_HINT} (sales_day.${key}=${String(v)})`);
  }
  return v as V;
}
