let sequence = 0;

/** 식별용 키(인증 토큰 아님). 값이 같은 별도 작업과 통신 재시도를 구별한다. */
export function newOperationKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** 같은 제출의 재시도만 같은 키를 쓴다. 성공하거나 입력이 바뀌면 별도 작업이다. */
export function operationKeyFor(previous: { payload: string; key: string } | null, payload: unknown, prefix: string) {
  const serialized = JSON.stringify(payload);
  return previous?.payload === serialized ? previous : { payload: serialized, key: newOperationKey(prefix) };
}
