/**
 * `sales_day` 응답 계약 — 앱이 쓰는 그 함수를 그대로 돌린다(복사본이 아니다).
 *
 * 왜 있나 — 서버가 새 필드를 안 주면 앱이 조용히 기능을 없앤다. `editable` 이 빠지면
 * 수정 버튼이 사라지고 `basis_quality` 가 빠지면 배지가 사라진다. 화면은 멀쩡해 보여서
 * 아무도 모른다. 그래서 "빠지면 던진다" 와 "서로 안 맞으면 던진다" 를 여기서 잰다.
 *
 * ⚠ 한때 `node --experimental-strip-types` 로 돌렸는데, 그건 **Node 24 전용**이라
 *   루트가 선언한 `engines.node: >=20` 과 어긋났다 — Node 20 에서 `pnpm test` 가 깨진다.
 *   `packages/core` 가 이미 쓰는 vitest 로 옮겼다(vitest 2 는 `^18 || >=20`).
 *   새 의존성도, 별도 러너도 필요 없다.
 */
import { describe, expect, it } from 'vitest';
import { parseAmendResultContract, parseSalesDayContract } from '../src/features/sales/dayContract';

/** 0153 이 실제로 주는 모양들. */
const OPEN_DAY = { revision: 3, basis_quality: 'exact', has_ledger: true, day_status: 'open', editable: true };
const CLOSED_DAY = { revision: 7, basis_quality: 'estimated_current', has_ledger: true, day_status: 'closed', editable: true };
const NO_LEDGER = { revision: 0, basis_quality: null, has_ledger: false, day_status: null, editable: true };
const TOO_OLD = { revision: 0, basis_quality: null, has_ledger: false, day_status: null, editable: false };

describe('정상 응답', () => {
  it('영업 중인 날', () => {
    expect(parseSalesDayContract(OPEN_DAY)).toEqual({
      revision: 3, basisQuality: 'exact', hasLedger: true, dayStatus: 'open', editable: true,
    });
  });

  it('종료된 날 · 현재 기준으로 계산됨', () => {
    expect(parseSalesDayContract(CLOSED_DAY)).toEqual({
      revision: 7, basisQuality: 'estimated_current', hasLedger: true, dayStatus: 'closed', editable: true,
    });
  });

  /** ⚠ null 은 정상 답이다. "장부가 없다" 는 뜻이지 계약 위반이 아니다. */
  it('기록 없는 날 — 기준 품질과 상태가 null 이어도 정상', () => {
    expect(parseSalesDayContract(NO_LEDGER)).toEqual({
      revision: 0, basisQuality: null, hasLedger: false, dayStatus: null, editable: true,
    });
  });

  /** `editable` 은 날짜만 보는 값이라 장부 유무와 무관하다 — 기록 없는 어제도 고칠 수 있다. */
  it('허용 기간 밖이면 editable=false', () => {
    expect(parseSalesDayContract(TOO_OLD).editable).toBe(false);
  });
});

describe('필드가 빠지거나 타입이 어긋나면 던진다', () => {
  it.each([
    ['editable 이 빠졌다', { revision: 1, basis_quality: null, has_ledger: false, day_status: null }],
    ['has_ledger 가 빠졌다', { revision: 1, basis_quality: null, day_status: null, editable: true }],
    ['basis_quality 키가 없다', { revision: 1, has_ledger: false, day_status: null, editable: true }],
    ['day_status 키가 없다', { revision: 1, basis_quality: null, has_ledger: false, editable: true }],
    ['editable 이 문자열이다', { revision: 1, basis_quality: null, has_ledger: false, day_status: null, editable: 'true' }],
    ['모르는 기준 품질', { revision: 1, basis_quality: 'guessed', has_ledger: true, day_status: 'open', editable: true }],
    ['모르는 장부 상태', { revision: 1, basis_quality: 'exact', has_ledger: true, day_status: 'reopened', editable: true }],
  ])('%s', (_label, payload) => {
    expect(() => parseSalesDayContract(payload)).toThrow();
  });

  /*
   * ⚠ `none` 은 `sales_day` 의 값이 아니다. 앱이 "장부가 없다" 를 나타내려고 만든 값이고
   *   DB 의 `business_day_status` 는 open|break|closed 뿐이다. 허용하면
   *   "장부는 있는데 상태가 none" 이 통과하고, 화면은 open·break 가 아니라는 이유로
   *   정정 버튼을 띄운다.
   */
  it('day_status=none 은 이 응답의 값이 아니다', () => {
    expect(() => parseSalesDayContract(
      { revision: 1, basis_quality: 'exact', has_ledger: true, day_status: 'none', editable: true },
    )).toThrow();
  });
});

/**
 * 필드를 따로만 보면 **말이 안 되는 조합**이 통과한다.
 * `{ has_ledger: true, basis_quality: null, day_status: null }` 은
 * "장부는 있는데 무엇으로 계산됐는지도, 지금 상태가 뭔지도 모른다" 는 응답인데,
 * 그대로 지나가면 화면은 배지를 안 그리고 정정 버튼만 띄운다.
 */
describe('서로 모순된 조합도 던진다', () => {
  it.each([
    ['장부가 있는데 기준 품질이 null', { revision: 1, basis_quality: null, has_ledger: true, day_status: 'open', editable: true }],
    ['장부가 있는데 상태가 null', { revision: 1, basis_quality: 'exact', has_ledger: true, day_status: null, editable: true }],
    ['장부가 있는데 둘 다 null', { revision: 1, basis_quality: null, has_ledger: true, day_status: null, editable: true }],
    ['장부가 없는데 기준 품질이 있다', { revision: 1, basis_quality: 'exact', has_ledger: false, day_status: null, editable: true }],
    ['장부가 없는데 상태가 있다', { revision: 1, basis_quality: null, has_ledger: false, day_status: 'closed', editable: true }],
  ])('%s', (_label, payload) => {
    expect(() => parseSalesDayContract(payload)).toThrow();
  });
});


/**
 * 판본은 **0 으로 메우면 안 된다.**
 *
 * `Number(v ?? 0)` 으로 읽으면 서버가 빠뜨렸을 때 0 이 되고, 화면은 그 0 을 들고
 * 저장하러 갔다가 45009(다른 기기에서 바뀌었어요)를 맞는다. 사장님 눈에는 아무 이유 없이
 * 저장이 막히는 것으로 보인다 — 오류로 보이는 편이 낫다.
 */
describe('판본', () => {
  const base = { basis_quality: null, has_ledger: false, day_status: null, editable: true };

  it.each([
    ['revision 이 빠졌다', base],
    ['revision 이 null 이다', { ...base, revision: null }],
    ['revision 이 숫자가 아니다', { ...base, revision: 'abc' }],
    ['revision 이 정수가 아니다', { ...base, revision: 1.5 }],
  ])('%s → 던진다', (_label, payload) => {
    expect(() => parseSalesDayContract(payload)).toThrow();
  });

  /** PostgREST 가 큰 정수를 문자열로 실어 보내는 경우가 있어 숫자 문자열은 받는다. */
  it('숫자 문자열은 받는다', () => {
    expect(parseSalesDayContract({ ...base, revision: '12' }).revision).toBe(12);
  });
});

describe('정정 응답 계약', () => {
  const OK = {
    changed: true, created: false, revision: 9, audit_revision_no: 2, basis_quality: 'estimated_current',
  };

  it('정상 응답', () => {
    expect(parseAmendResultContract(OK)).toEqual({
      changed: true, created: false, revision: 9, auditRevisionNo: 2, basisQuality: 'estimated_current',
    });
  });

  /*
   * 두 판본은 **다른 값**이다(0147). 화면이 다음 저장에 되보낼 것은 `revision` 이고
   * `audit_revision_no` 는 정정 횟수다. 섞으면 다음 저장이 곧바로 45009 를 맞는다.
   */
  it('두 판본을 각자 읽는다', () => {
    const r = parseAmendResultContract(OK);
    expect(r.revision).toBe(9);
    expect(r.auditRevisionNo).toBe(2);
  });

  it.each([
    ['changed 가 빠졌다', { created: false, revision: 9, audit_revision_no: 2, basis_quality: 'exact' }],
    ['created 가 빠졌다', { changed: true, revision: 9, audit_revision_no: 2, basis_quality: 'exact' }],
    ['revision 이 빠졌다', { changed: true, created: false, audit_revision_no: 2, basis_quality: 'exact' }],
    ['audit_revision_no 가 빠졌다', { changed: true, created: false, revision: 9, basis_quality: 'exact' }],
    ['basis_quality 키가 없다', { changed: true, created: false, revision: 9, audit_revision_no: 2 }],
    ['모르는 기준 품질', { changed: true, created: false, revision: 9, audit_revision_no: 2, basis_quality: 'guessed' }],
  ])('%s → 던진다', (_label, payload) => {
    expect(() => parseAmendResultContract(payload)).toThrow();
  });
});
