import type { Json } from '@margincook/db';

/**
 * jsonb 인자로 넘길 값의 타입 다리.
 *
 * 생성 타입의 `Json` 은 인덱스 시그니처를 요구해서, 우리가 쓰는 구체 인터페이스
 * (`FixedCostItem` 등)를 그대로 넣으면 구조가 같아도 거절당한다.
 * 실제로 직렬화 가능한 값만 여기 들어오므로 한 곳에서만 좁혀준다 —
 * 화면마다 `as any` 를 뿌리면 진짜 타입 오류까지 같이 묻힌다.
 */
export const asJson = (v: unknown): Json => v as Json;
