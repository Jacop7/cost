export type ChangeOperation = 'create' | 'update' | 'delete' | 'unknown';
export type ChangeSource = 'direct' | 'inbound' | 'ingredient' | 'fixed_cost' | 'material' | 'tax' | 'unknown';
export type ChangeSubjectType = 'ingredient' | 'recipe' | 'purchase_option' | 'fixed_cost' | 'tax' | 'material' | 'unknown';
export interface ChangeClassification {
  sourceType?: ChangeSource;
  operation?: ChangeOperation;
  operationSubjectType?: ChangeSubjectType;
  operationSubjectId?: string | null;
}
const sources = ['direct', 'inbound', 'ingredient', 'fixed_cost', 'material', 'tax'];
const subjects = ['ingredient', 'recipe', 'purchase_option', 'fixed_cost', 'tax', 'material'];

/** Only explicit server fields classify an event; titles and field diffs are not evidence. */
export function parseChangeClassification(raw: Record<string, unknown>): Required<ChangeClassification> {
  return {
    sourceType: sources.includes(String(raw.source_type)) ? raw.source_type as ChangeSource : 'unknown',
    operation: ['create', 'update', 'delete'].includes(String(raw.operation)) ? raw.operation as ChangeOperation : 'unknown',
    operationSubjectType: subjects.includes(String(raw.operation_subject_type)) ? raw.operation_subject_type as ChangeSubjectType : 'unknown',
    operationSubjectId: typeof raw.operation_subject_id === 'string' ? raw.operation_subject_id : null,
  };
}
export function operationLabel(operation?: ChangeOperation): string {
  return operation === 'create' ? '등록' : operation === 'update' ? '수정' : operation === 'delete' ? '삭제' : '변경';
}
export function classifyChange(change: ChangeClassification): { label: string; automatic: boolean } {
  if (change.sourceType && sources.includes(change.sourceType) && change.sourceType !== 'direct')
    return { label: '자동 갱신', automatic: true };
  return { label: change.sourceType === 'direct' ? operationLabel(change.operation) : '변경', automatic: false };
}

export type EntityChangeType = 'ingredient' | 'recipe';
export type EntityHistoryClassification = {
  label: '직접 수정' | '삭제' | '자동 갱신';
  automatic: boolean;
};

/**
 * 식재료·메뉴의 수정 내역은 사용자가 이해할 수 있는 세 종류만 표시한다.
 * 구매 링크의 추가·수정·삭제는 부모 식재료에 대한 직접 수정이고,
 * 부모 식재료·메뉴 자체를 없앤 사건만 삭제다.
 */
export function classifyEntityHistoryChange(
  change: ChangeClassification,
  entity: EntityChangeType,
): EntityHistoryClassification | null {
  if (change.sourceType && sources.includes(change.sourceType) && change.sourceType !== 'direct')
    return { label: '자동 갱신', automatic: true };
  if (change.sourceType !== 'direct') return null;
  if (change.operation === 'create' && change.operationSubjectType === entity) return null;
  if (change.operation === 'delete' && change.operationSubjectType === entity)
    return { label: '삭제', automatic: false };
  if (['create', 'update', 'delete'].includes(String(change.operation)))
    return { label: '직접 수정', automatic: false };
  return null;
}

/** 최초 등록만 있는 상세에서는 수정 내역 진입점을 만들지 않는다. */
export function hasVisibleEntityHistory(
  change: ChangeClassification & { hasHistory?: boolean },
  entity: EntityChangeType,
): boolean {
  return change.hasHistory === true
    && !(change.sourceType === 'direct' && change.operation === 'create' && change.operationSubjectType === entity);
}
