/**
 * 도메인 엔터티 모델 — ⑤ 통합 ERD 2.1.
 * 손으로 작성한 개념 모델(camelCase). DB 컬럼(snake_case) ↔ 자동 생성 타입은
 * packages/db/src/database.types.ts 를 사용하고, 매퍼로 변환한다.
 *
 * (파생) 주석이 붙은 필드/엔터티는 입력이 아니라 계산값. → derived.ts 참조.
 */
import type {
  BaseUnit,
  CandidateReason,
  CandidateStatus,
  FixedCostMode,
  InventoryEventType,
  OrderRecordSource,
  OrderRecordStatus,
  StockBadge,
  TaxMode,
} from './enums';

export type ID = string; // uuid

/** 멀티테넌시 루트 — 모든 행이 store_id 로 RLS 격리. (다점포는 3차이나 스코프는 1차부터) */
export interface Store {
  id: ID;
  ownerId: ID; // auth.uid()
  name: string;
  createdAt: string;
}

// ── 기준정보 ─────────────────────────────────────────────
export interface Category {
  id: ID;
  storeId: ID;
  name: string;
  order: number;
  defaultLossRate: number; // 분류별 로스율 기본 제안값 (%)
}

export interface Ingredient {
  id: ID;
  storeId: ID;
  name: string;
  categoryId: ID;
  baseUnit: BaseUnit; // 기준 단위 (g/ml/ea)
  perVolume: number; // 개당 용량 (기준단위 기준). 'ea'면 포장당 개수.
  purchaseUnitLabel: string | null; // 구매단위 라벨(통/단/박스) — 표시용
  lossRate: number; // 등록 시 추정 로스율 (%)
  safetyStock: number; // 안전재고 (개수)
  minOrderQty: number; // 최소 발주 (개수)
  vendorId: ID | null; // 기본 거래처(선택)
  memo: string | null;
  active: boolean; // 사용중 삭제는 비활성 전환 (B-08)
}

export interface Vendor {
  id: ID;
  storeId: ID;
  name: string;
  hidden: boolean; // 발주 등록 시 자동 사전등록, MY-05에서 병합
}

export interface Brand {
  id: ID;
  storeId: ID;
  name: string;
  hidden: boolean;
}

export interface PurchaseOption {
  id: ID;
  storeId: ID;
  ingredientId: ID;
  purchaseName: string; // 구매식재료명 (예: '대파(흙대파) 1kg')
  vendorId: ID | null;
  brandId: ID | null;
  volume: number; // 용량 (기준단위)
  amount: number; // 금액 (원)
  url: string | null;
  hidden: boolean; // 단종/품절 보관
}

// ── 재고·구매 ────────────────────────────────────────────
/** 식재료 1:1 현재 재고 상태 (① 4.7). 개수 기반. */
export interface InventoryState {
  ingredientId: ID;
  storeId: ID;
  sealedCount: number; // 미개봉 수
  openedCount: 0 | 1; // 개봉 수 (0 또는 1)
  openedRemain: number | null; // 개봉분 남은 양(기준단위, 선택)
  soonOut: boolean; // 곧소진 플래그
  lastInboundAt: string | null; // 최근 입고일
}

export interface InventoryEvent {
  id: ID;
  storeId: ID;
  ingredientId: ID;
  type: InventoryEventType;
  count: number | null; // 개수 변동
  volume: number | null; // 양 변동 (폐기 남은 양 등)
  occurredAt: string;
  orderRecordId: ID | null; // 입고면 발주 레코드 참조
  note: string | null;
}

export interface OrderRecord {
  id: ID;
  storeId: ID;
  ingredientId: ID;
  vendorId: ID | null;
  brandId: ID | null;
  volume: number; // 용량 (구매단위 1개 기준 → 기준단위)
  amount: number; // 금액 (원)
  qty: number; // 수량 (구매단위 개수)
  orderedAt: string; // 발주일
  expectedAt: string | null; // 예정입고일
  status: OrderRecordStatus;
  source: OrderRecordSource;
  receivedQty: number; // 부분입고 누적 수량
}

export interface OrderCandidate {
  id: ID;
  storeId: ID;
  ingredientId: ID;
  reasons: CandidateReason[]; // 복수 사유 병기
  recommendedQty: number; // 권장 수량 (개수)
  status: CandidateStatus;
}

/** 레시피 계산 실행 (③ 2.3) — 발주 후보(사유=recipe) 산출 근거. */
export interface RecipeCalcRun {
  id: ID;
  storeId: ID;
  periodFrom: string;
  periodTo: string;
  items: { recipeId: ID; servings: number }[]; // 메뉴 × 인분
  result: { ingredientId: ID; required: number; shortage: number }[];
  ranAt: string;
}

// ── 레시피·손익 ──────────────────────────────────────────
export interface Recipe {
  id: ID;
  storeId: ID;
  name: string;
  price: number; // 판매가
  taxMode: TaxMode;
  taxItems: string[]; // 세금 항목(별도/면세 부가)
  baseServings: number; // 기준 인분 N
  targetProfitRate: number; // 목표 순이익률 (%)
  avgMonthlySales: number | null; // 월 평균 판매량 (배분용)
  active: boolean;
}

export interface RecipeLine {
  id: ID;
  storeId: ID;
  recipeId: ID;
  ingredientId: ID | null; // 식재료 참조
  subRecipeId: ID | null; // 레시피-예약(반제품, 2차)
  inputQty: number; // 입력량 (N인분 기준, 기준단위)
}

export interface RecipeExtraCost {
  id: ID;
  storeId: ID;
  recipeId: ID;
  name: string;
  amountPerServing: number; // 1인분 정액 (원)
}

// ── 월 경영 ──────────────────────────────────────────────
export interface FixedCostMonthly {
  id: ID;
  storeId: ID;
  month: string; // 'YYYY-MM'
  totalRevenue: number; // 총매출
  items: FixedCostItem[];
}

export interface FixedCostItem {
  key: 'labor' | 'commission' | 'packing' | 'delivery' | 'ads'; // 인건비/수수료/포장/배달/광고
  mode: FixedCostMode;
  total: number; // 총액 모드 금액
  lines: { label: string; amount: number }[]; // 상세 모드 라인(2차)
}

// ── 설정 ─────────────────────────────────────────────────
export interface Settings {
  storeId: ID;
  unitSystem: 'metric' | 'us' | 'uk';
  cupVolume: number; // 조리컵 용량(ml)
  defaultTargetProfitRate: number; // 목표 순이익률 기본값
  alerts: {
    morningSummary: boolean;
    inboundDelay: boolean;
    priceSpike: boolean;
    targetMiss: boolean;
  };
}

export type { BaseUnit, StockBadge };
