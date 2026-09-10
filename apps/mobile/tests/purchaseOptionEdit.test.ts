import { describe, expect, it } from 'vitest';
import { mergeOptionDraft, optionDraftOf, optionMergeFields, purchaseOptionRevision } from '@/features/ingredients/purchaseOptionEdit';
import type { PurchaseOption } from '@/features/ingredients/hooks';
const option: PurchaseOption = { id: 'o1', editRevision: '1', name: '대파', vendorId: 'v1', vendorName: '원래 구매처',
  brandId: 'b1', brandName: '브랜드', volume: 1000, amount: 4000, url: 'https://example.invalid' };
const base = { option, baseUnit: 'g' as const };
describe('구매 옵션 판본과 필드별 의미 비교', () => {
  it.each(['1', '9007199254740993', '9223372036854775807'])('판본 %s 원문 유지', value => expect(purchaseOptionRevision(value)).toBe(value));
  it.each([undefined, null, 1, 9007199254740992, '', '0', '-1', ' 1', '01', '1.0', '9223372036854775808'])('비정상 판본 %s 차단', value => expect(purchaseOptionRevision(value)).toBeNull());
  it('미수정 필드는 최신값, 내 단독 수정은 raw 유지, 구매처 이름/ID는 같이 갱신한다', () => {
    const draft = { ...optionDraftOf(option, 'g'), name: ' 내 이름 ', unit: 'kg', vol: '1' };
    const latest = { ...option, editRevision: '2', volume: 2500, amount: 5000, vendorId: 'v2', vendorName: '최신 구매처' };
    expect(mergeOptionDraft(base, draft, latest, {})).toMatchObject({ name: ' 내 이름 ', unit: 'kg', vol: '2.5', amount: '5000', vendorId: 'v2', vendorName: '최신 구매처' });
  });
  it('양쪽 다른 금액은 선택 없이는 병합하지 않으며 선택한 값을 사용한다', () => {
    const draft = { ...optionDraftOf(option, 'g'), amount: '4500' };
    const latest = { ...option, amount: 5000 };
    expect(mergeOptionDraft(base, draft, latest, {})).toBeNull();
    expect(mergeOptionDraft(base, draft, latest, { amount: 'local' })?.amount).toBe('4500');
    expect(mergeOptionDraft(base, draft, latest, { amount: 'latest' })?.amount).toBe('5000');
  });
  it('같은 최종값이나 단위/URL 표기만 다른 경우 중복 충돌을 만들지 않는다', () => {
    const draft = { ...optionDraftOf(option, 'g'), amount: '5000', vol: '1', unit: 'kg', url: 'example.invalid' };
    expect(optionMergeFields(base, draft, { ...option, amount: 5000 }).some(f => f.conflict)).toBe(false);
  });
  it('불완전 URL은 null 서버값과 같은 것으로 취급하지 않고 raw 보존한다', () => {
    const empty = { ...option, url: null };
    const draft = { ...optionDraftOf(empty, 'g'), url: 'https://' };
    expect(mergeOptionDraft({ option: empty, baseUnit: 'g' }, draft, empty, {})?.url).toBe('https://');
  });
});
