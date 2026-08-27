/**
 * PostgREST/RPC 응답의 느슨한 숫자·문자열 값을 화면 모델로 옮긴다.
 *
 * 입력 폼 파싱이나 필수 응답 계약 검증과는 다른 경계다. 여기서는 기존 훅이
 * 사용하던 변환 의미를 그대로 보존하고, null 허용 여부만 함수 이름으로 드러낸다.
 */
export const rpcNumber = (value: unknown): number => Number(value ?? 0);

export const rpcNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export const rpcNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);
