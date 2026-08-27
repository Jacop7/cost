/**
 * 도메인 열거형 — ⑤ 통합 ERD 2.1 기준.
 * DB에는 보통 text + CHECK 제약으로 저장하고, 앱/계산에서는 아래 유니온으로 다룬다.
 */

/** 기준 단위 — 모든 저장·계산의 표준. kg→g, L→ml 로 정규화. ea = '개'. */
export type BaseUnit = 'g' | 'ml' | 'ea';

/** 재고 상태 — 여유(ok) · 소진 임박(low) · 소진(out). 판정은 core `stockStateOf` 한 곳이다. */
export type StockBadge = 'ok' | 'low' | 'out';

/** 재고 이벤트 유형 (⑤ 재고이벤트). 폐기 누적 → 실측 로스율. */
export type InventoryEventType =
  | 'inbound' // 입고 (E1)
  | 'consume' // 소진
  | 'discard' // 폐기 (E2)
  | 'stocktake' // 실사
  | 'adjust'; // 조정

/** 발주 레코드 상태 (③ 8.3). */
export type OrderRecordStatus = 'ordered' | 'partial' | 'received' | 'canceled'; // 발주됨/부분입고/입고완료/취소

/** 발주 레코드 출처. */
export type OrderRecordSource = 'manual' | 'ocr' | 'option' | 'recipe';

/** 발주 후보 사유 (③ 2.2) — 복수 동시 가능(합산 시 병기). */
/** 발주 후보가 뜬 이유. 레시피 계산(ORD-04)은 1차 범위 밖이라 뺐다(0060). */
export type CandidateReason = 'safety_stock' | 'soon_out' | 'manual';

/** 발주 후보 상태. */
export type CandidateStatus = 'pending' | 'ordered' | 'excluded'; // 대기/주문함/제외

/**
 * 옛 세금 모드 필드. 현재 계산은 이 값을 읽지 않고 매장 `TaxItem[]` 합만 사용한다.
 * 저장 계약 호환을 위해 타입 자리는 유지한다.
 */
export type TaxMode = 'included' | 'separate' | 'exempt';

/**
 * 매장 세금 항목. 부가세도 항목 하나이며 기본으로 더해지는 세금은 없다(0090).
 * rate 는 판매가 대비 %(2.5 = 2.5%). 부가세 포함 가격이면 10이 아니라 10/110을 넣는다.
 */
export interface TaxItem {
  name: string;
  rate: number;
}

/** 순이익률 추이 원인 색 (⑦ 4 전파 원칙): 재료=주황, 레시피=파랑, 고정=회색. */
export type TrendCause = 'material' | 'recipe' | 'fixed';

/** 고정 지출 입력 모드 (④ 2) — 총액 위주(1차) / 상세(2차). */
export type FixedCostMode = 'total' | 'detail';

/** 단위 시스템 (④ 4.2) — 1차는 metric 고정. */
export type UnitSystem = 'metric' | 'us' | 'uk';
