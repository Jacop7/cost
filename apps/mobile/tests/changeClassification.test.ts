import { describe, expect, it } from 'vitest';
import { parseChangeEvent, parseLastChange } from '@/features/changes/hooks';
import { parseConfigurationEvent } from '@/features/changes/configurationHistory';
import { classifyChange, classifyEntityHistoryChange, hasVisibleEntityHistory, type ChangeOperation, type ChangeSource } from '@/features/changes/changeClassification';

describe('서버가 명시한 작업·주체 분류와 전후 항목의 동일성', () => {
  it.each([
    ['direct', 'create', '등록', false], ['direct', 'update', '수정', false], ['direct', 'delete', '삭제', false],
    ['direct', 'unknown', '변경', false], ['unknown', 'create', '변경', false],
    ['inbound', 'create', '자동 갱신', true], ['ingredient', 'delete', '자동 갱신', true],
    ['fixed_cost', 'update', '자동 갱신', true], ['tax', 'update', '자동 갱신', true], ['material', 'update', '자동 갱신', true],
  ] as [ChangeSource, ChangeOperation, string, boolean][])('%s/%s는 작업과 원인을 분리한다', (sourceType, operation, label, automatic) => {
    expect(classifyChange({ sourceType, operation })).toEqual({ label, automatic });
  });
  it('식재료·메뉴 수정 내역은 직접 수정·삭제·자동 갱신 세 종류만 쓴다', () => {
    expect(classifyEntityHistoryChange({ sourceType: 'direct', operation: 'create', operationSubjectType: 'purchase_option' }, 'ingredient'))
      .toEqual({ label: '직접 수정', automatic: false });
    expect(classifyEntityHistoryChange({ sourceType: 'direct', operation: 'delete', operationSubjectType: 'purchase_option' }, 'ingredient'))
      .toEqual({ label: '직접 수정', automatic: false });
    expect(classifyEntityHistoryChange({ sourceType: 'direct', operation: 'delete', operationSubjectType: 'recipe' }, 'recipe'))
      .toEqual({ label: '삭제', automatic: false });
    expect(classifyEntityHistoryChange({ sourceType: 'ingredient', operation: 'update', operationSubjectType: 'recipe' }, 'recipe'))
      .toEqual({ label: '자동 갱신', automatic: true });
    expect(classifyEntityHistoryChange({ sourceType: 'direct', operation: 'unknown', operationSubjectType: 'unknown' }, 'recipe')).toBeNull();
  });
  it('최초 등록만 있는 항목은 최근 수정 진입점을 표시하지 않는다', () => {
    expect(hasVisibleEntityHistory({ hasHistory: true, sourceType: 'direct', operation: 'create', operationSubjectType: 'ingredient' }, 'ingredient')).toBe(false);
    expect(hasVisibleEntityHistory({ hasHistory: true, sourceType: 'direct', operation: 'update', operationSubjectType: 'ingredient' }, 'ingredient')).toBe(true);
    expect(hasVisibleEntityHistory({ hasHistory: false, sourceType: 'direct', operation: 'update', operationSubjectType: 'ingredient' }, 'ingredient')).toBe(false);
  });
  it('등록 제목이나 파생 필드와 무관하게 서버 작업·주체를 읽는다', () => {
    expect(parseChangeEvent({ title: '이름에 등록이 포함된 수정', source_type: 'direct',
      operation: 'update', operation_subject_type: 'purchase_option', operation_subject_id: 'option-1',
      changes: [{ key: 'cost', before: 1, after: 2, change_kind: 'derived' }] })).toMatchObject({
      operation: 'update', operationSubjectType: 'purchase_option', operationSubjectId: 'option-1',
      sourceType: 'direct', changes: [{ kind: 'derived' }],
    });
  });
  it('분류 없는 과거 기록과 모르는 출처를 직접 수정으로 메우지 않는다', () => {
    expect(parseChangeEvent({ title: '최초 등록', source_type: 'future-source' })).toMatchObject({
      sourceType: 'unknown', operation: 'unknown', operationSubjectType: 'unknown', operationSubjectId: null,
    });
    expect(parseChangeEvent({ title: '삭제' }).sourceType).toBe('unknown');
  });
  it('마지막 변경의 등록 작업도 수정 여부와 독립적으로 유지한다', () => {
    expect(parseLastChange({ display_state: null, has_history: true, source_type: 'direct', operation: 'create',
      operation_subject_type: 'ingredient', operation_subject_id: 'ingredient-1' })).toMatchObject({
      operation: 'create', sourceType: 'direct', operationSubjectType: 'ingredient', operationSubjectId: 'ingredient-1',
    });
  });
  it('설정 종류가 fixed_cost여도 발생 출처는 direct로 따로 읽는다', () => {
    expect(parseConfigurationEvent({ id: 'fixed', occurred_at: '2026-09-14T01:00:00Z', source: 'fixed_cost',
      source_type: 'direct', operation: 'create', operation_subject_type: 'fixed_cost', operation_subject_id: '2026-09',
      before_value: null, after_value: { items: [] } })).toMatchObject({
      title: '고정 지출 등록', sourceType: 'direct', operation: 'create', operationSubjectId: '2026-09',
    });
  });
  it('ID 없는 고정 지출 항목 재정렬을 다른 직원의 금액 수정으로 표시하지 않는다', () => {
    const lines = [{ name: '직원', amount: 1000 }, { name: '직원', amount: 2000 }];
    const event = parseConfigurationEvent({ id: 'fixed', occurred_at: '2026-09-14T01:00:00Z', source: 'fixed_cost',
      before_value: { items: [{ key: 'labor', lines }] }, after_value: { items: [{ key: 'labor', lines: [...lines].reverse() }] } });
    expect(event.changes).toHaveLength(1);
    expect(event.changes[0]?.label).toContain('순서');
    expect(event.changes[0]?.before).toContain('1,000원');
    expect(event.changes[0]?.after).toContain('2,000원');
  });
  it('ID 없는 구형 세금 순서 변경을 세율 변경으로 만들지 않는다', () => {
    const entries = [{ name: '국세', rate: 10 }, { name: '지방세', rate: 2 }];
    const event = parseConfigurationEvent({ id: 'tax', occurred_at: '2026-09-14T01:00:00Z', source: 'legacy_tax',
      before_value: { tax_items: entries }, after_value: { tax_items: [...entries].reverse() } });
    expect(event.changes).toHaveLength(1);
    expect(event.changes[0]?.label).toContain('순서');
  });
  it('동명이인·이름 변경·추가 삭제가 섞인 무식별 항목은 전후 구성 전체를 보존한다', () => {
    const event = parseConfigurationEvent({ id: 'fixed', source: 'fixed_cost', occurred_at: '2026-09-14T01:00:00Z',
      operation: 'update', source_type: 'direct', operation_subject_type: 'fixed_cost', operation_subject_id: '2026-09',
      before_value: { items: [{ key: 'labor', lines: [{ name: '직원', amount: 1000 }, { name: '직원', amount: 2000 }] }] },
      after_value: { items: [{ key: 'labor', lines: [{ name: '새 직원', amount: 3000 }, { name: '직원', amount: 1000 }] }] } });
    expect(event.title).toBe('고정 지출 수정');
    expect(event.changes).toEqual([{ key: 'fixed.labor.lines.entries', label: '인건비 세부 항목',
      before: '직원 · 1,000원\n직원 · 2,000원', after: '새 직원 · 3,000원\n직원 · 1,000원' }]);
  });
  it('고유 key가 있는 세금은 재정렬·세율 수정을 같은 항목에 결속한다', () => {
    const a = { key: 'national', name: '국세', rate_pct: 10 }, b = { key: 'local', name: '지방세', rate_pct: 2 };
    const event = parseConfigurationEvent({ id: 'tax', source: 'tax_profile', occurred_at: '2026-09-14T01:00:00Z',
      before_value: { components: [a, b] }, after_value: { components: [b, { ...a, rate_pct: 12 }] } });
    expect(event.changes).toEqual([
      { key: 'tax.national.rate', label: '국세 세율', before: '10%', after: '12%' },
      { key: 'components.order', label: '세금 항목 순서', before: '국세 → 지방세', after: '지방세 → 국세' },
    ]);
  });
  it('중복 key인 과거 배열은 어떤 행도 덮거나 금액 변화로 추정하지 않는다', () => {
    const before = [{ key: 'vat', name: '세금A', rate_pct: 1 }, { key: 'vat', name: '세금B', rate_pct: 2 }];
    const after = [{ key: 'vat', name: '세금C', rate_pct: 3 }];
    const event = parseConfigurationEvent({ id: 'tax', source: 'tax_profile', occurred_at: '2026-09-14T01:00:00Z',
      before_value: { components: before }, after_value: { components: after } });
    expect(event.changes).toHaveLength(1);
    expect(event.changes[0]?.before).toContain('세금A'); expect(event.changes[0]?.before).toContain('세금B');
    expect(event.changes[0]?.after).toContain('세금C');
  });
  it('동일 이름의 고유 key 항목을 재정렬해도 서로 구별되는 순서 값을 표시한다', () => {
    const a = { key: 'national', name: '세금', rate_pct: 10 }, b = { key: 'local', name: '세금', rate_pct: 2 };
    const event = parseConfigurationEvent({ id: 'tax', source: 'tax_profile', occurred_at: '2026-09-14T01:00:00Z',
      before_value: { components: [a, b] }, after_value: { components: [b, a] } });
    expect(event.changes).toEqual([{ key: 'components.order', label: '세금 항목 순서',
      before: '세금 [national] → 세금 [local]', after: '세금 [local] → 세금 [national]' }]);
  });
  it('무변경과 JSON 객체 속성 순서는 가짜 변경을 만들지 않고 과거 제목 원문을 보존한다', () => {
    const event = parseConfigurationEvent({ id: 'fixed', source: 'fixed_cost', occurred_at: '2026-09-14T01:00:00Z', title: '직원 삭제 메모 원문',
      before_value: { items: [{ key: 'labor', lines: [{ name: 'delivery', amount: 1000 }] }] },
      after_value: { items: [{ key: 'labor', lines: [{ amount: 1000, name: 'delivery' }] }] } });
    expect(event.changes).toEqual([]); expect(event.title).toBe('직원 삭제 메모 원문');
    expect(classifyChange(event).label).toBe('변경');
  });
});
