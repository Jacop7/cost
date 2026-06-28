// types.ts — 식재료(잔여) 도메인 타입
import type { StatusKey } from '../../theme/tokens';

export interface Ingredient {
  id: string;
  name: string;
  cat: string;
  status: StatusKey;
  unit: 'g' | 'ml' | '개';
  per: number;
  perLabel: string;
  sealed: number;
  opened: number;
  soon: boolean;
  safe: number;
  price: number;
  priceUnit: string;
  loss: number;
  lossReal: number;
  last: string;
  vendor: string;
  avg: number;
  low: number;
  high: number;
  recent: number;
  memo: string;
  warn: boolean;
  warnPct?: number;
}

export interface PurchaseOption {
  name: string;
  vendor: string;
  brand: string;
  vol: string;
  price: string;
  per: number;
  badge: 'high' | 'low' | null;
}

export interface PurchaseRecord {
  date: string;
  vendor: string;
  brand: string;
  each: string;
  unitWon: number;
  qtyN: number;
  qty: string;
  per: number;
}

export interface TrendPointData {
  v: number;
  big?: boolean;
}

export interface PeriodSeries {
  unit: string;
  labels: string[];
  pts: TrendPointData[];
}

export interface StockLedgerRow {
  dt: string;
  act: string;
  memo: string;
  delta: string;
  bal: string;
  up: boolean;
}

export interface StockLedgerMonth {
  ym: string;
  rows: StockLedgerRow[];
}
