/**
 * `dayContract` 를 **실제로 돌려** 본다. 복사본이 아니라 앱이 쓰는 그 함수다.
 *
 *     node --experimental-strip-types apps/mobile/src/features/sales/dayContract.check.ts
 *
 * 왜 있나 — 서버가 새 필드를 안 주면 앱이 조용히 기능을 없애는 일이 있었다.
 * `editable` 이 빠지면 수정 버튼이 사라지고 `basis_quality` 가 빠지면 배지가 사라진다.
 * 화면은 멀쩡해 보여서 아무도 모른다. 그래서 "빠지면 던진다" 를 여기서 잰다.
 */
import { needBool, needEnum } from './dayContract.ts';

const DAY_STATUSES = ['none', 'open', 'break', 'closed'] as const;
const BASIS = ['exact', 'estimated_current'] as const;

let fail = 0;
const ok = (label: string, cond: boolean, got?: unknown) => {
  if (cond) console.log(`  ok   ${label}`);
  else { console.log(`  FAIL ${label}${got === undefined ? '' : `  (${String(got)})`}`); fail++; }
};
/** 던져야 하는 것. 안 던지면 실패다. */
const throws = (label: string, run: () => unknown) => {
  try { const v = run(); ok(label, false, `던지지 않고 ${JSON.stringify(v)} 를 돌려줬다`); }
  catch { ok(label, true); }
};

// 0153 이 실제로 주는 모양 두 가지.
const openDay = { basis_quality: 'exact', has_ledger: true, day_status: 'open', editable: true };
const noLedger = { basis_quality: null, has_ledger: false, day_status: null, editable: false };

ok('영업 중인 날 — 기준 품질', needEnum(openDay, 'basis_quality', BASIS) === 'exact');
ok('영업 중인 날 — 장부 있음', needBool(openDay, 'has_ledger') === true);
ok('영업 중인 날 — 상태', needEnum(openDay, 'day_status', DAY_STATUSES) === 'open');
ok('영업 중인 날 — 수정 가능', needBool(openDay, 'editable') === true);

// ⚠ `null` 은 정상 답이다. "장부가 없다" 는 뜻이지 계약 위반이 아니다.
ok('장부 없는 날 — 기준 품질은 null 이 정상', needEnum(noLedger, 'basis_quality', BASIS) === null);
ok('장부 없는 날 — 상태도 null 이 정상', needEnum(noLedger, 'day_status', DAY_STATUSES) === null);
ok('장부 없는 날 — 수정 불가', needBool(noLedger, 'editable') === false);

// 여기부터가 본론 — 필드가 **빠지면** 조용히 넘어가면 안 된다.
throws('editable 이 빠지면 던진다', () => needBool({ has_ledger: true }, 'editable'));
throws('has_ledger 가 빠지면 던진다', () => needBool({ editable: true }, 'has_ledger'));
throws('basis_quality 키가 없으면 던진다', () => needEnum({ has_ledger: true }, 'basis_quality', BASIS));
throws('day_status 키가 없으면 던진다', () => needEnum({ has_ledger: true }, 'day_status', DAY_STATUSES));

// 타입이 어긋나도 던진다 — 문자열 'false' 를 boolean 으로 받으면 안 된다.
throws('editable 이 문자열이면 던진다', () => needBool({ editable: 'true' }, 'editable'));
throws('모르는 기준 품질이면 던진다', () => needEnum({ basis_quality: 'guessed' }, 'basis_quality', BASIS));
throws('모르는 장부 상태면 던진다', () => needEnum({ day_status: 'reopened' }, 'day_status', DAY_STATUSES));

console.log(fail === 0 ? '\n응답 계약 14/14 통과' : `\n응답 계약 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
