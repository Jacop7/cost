/**
 * `parseSalesDayContract` 를 **실제로 돌려** 본다. 복사본이 아니라 앱이 쓰는 그 함수다.
 *
 *     pnpm --filter @sikjae/mobile test
 *     node --experimental-strip-types apps/mobile/src/features/sales/dayContract.check.ts
 *
 * 왜 있나 — 서버가 새 필드를 안 주면 앱이 조용히 기능을 없애는 일이 있었다.
 * `editable` 이 빠지면 수정 버튼이 사라지고 `basis_quality` 가 빠지면 배지가 사라진다.
 * 화면은 멀쩡해 보여서 아무도 모른다. 그래서 "빠지면 던진다" 를 여기서 잰다.
 *
 * ⚠ 필드를 **따로** 재면 부족하다. 넷이 서로를 설명하는 값이라, 하나씩만 맞으면
 *   말이 안 되는 조합이 통과한다 — 그 조합들이 아래 ③ 이다.
 */
import { parseSalesDayContract } from './dayContract.ts';

let fail = 0;
const ok = (label: string, cond: boolean, got?: unknown) => {
  if (cond) console.log(`  ok   ${label}`);
  else { console.log(`  FAIL ${label}${got === undefined ? '' : `  (${String(got)})`}`); fail++; }
};
/** 던져야 하는 것. 안 던지면 실패다. */
const throws = (label: string, r: Record<string, unknown>) => {
  try {
    const v = parseSalesDayContract(r);
    ok(label, false, `던지지 않고 ${JSON.stringify(v)} 를 돌려줬다`);
  } catch { ok(label, true); }
};

// ── ① 0153 이 실제로 주는 모양 ────────────────────────────────
const openDay = { basis_quality: 'exact', has_ledger: true, day_status: 'open', editable: true };
const closedDay = { basis_quality: 'estimated_current', has_ledger: true, day_status: 'closed', editable: true };
const noLedger = { basis_quality: null, has_ledger: false, day_status: null, editable: true };
const tooOld = { basis_quality: null, has_ledger: false, day_status: null, editable: false };

const a = parseSalesDayContract(openDay);
ok('영업 중인 날', a.basisQuality === 'exact' && a.hasLedger && a.dayStatus === 'open' && a.editable);
const b = parseSalesDayContract(closedDay);
ok('종료된 날 · 현재 기준으로 계산됨', b.basisQuality === 'estimated_current' && b.dayStatus === 'closed');
const c = parseSalesDayContract(noLedger);
ok('기록 없는 날 — 셋이 다 null/false 여도 정상', c.basisQuality === null && c.dayStatus === null && !c.hasLedger);
ok('기록은 없어도 고칠 수 있는 기간이면 editable', c.editable === true);
const d = parseSalesDayContract(tooOld);
ok('허용 기간 밖이면 editable=false', d.editable === false);

// ── ② 필드가 빠지거나 타입이 어긋나면 던진다 ──────────────────
throws('editable 이 빠지면 던진다', { basis_quality: null, has_ledger: false, day_status: null });
throws('has_ledger 가 빠지면 던진다', { basis_quality: null, day_status: null, editable: true });
throws('basis_quality 키가 없으면 던진다', { has_ledger: false, day_status: null, editable: true });
throws('day_status 키가 없으면 던진다', { basis_quality: null, has_ledger: false, editable: true });
throws('editable 이 문자열이면 던진다', { basis_quality: null, has_ledger: false, day_status: null, editable: 'true' });
throws('모르는 기준 품질이면 던진다', { basis_quality: 'guessed', has_ledger: true, day_status: 'open', editable: true });
throws('모르는 장부 상태면 던진다', { basis_quality: 'exact', has_ledger: true, day_status: 'reopened', editable: true });

/*
 * ⚠ `none` 은 `sales_day` 의 값이 아니다. 앱이 "장부가 없다" 를 나타내려고 만든 값이고
 *   DB 의 `business_day_status` 는 open|break|closed 뿐이다. 허용 목록에 남겨 두면
 *   "장부는 있는데 상태가 none" 이 통과하고, 화면은 open·break 가 아니라는 이유로
 *   정정 버튼을 띄운다.
 */
throws('day_status=none 은 이 응답의 값이 아니다', { basis_quality: 'exact', has_ledger: true, day_status: 'none', editable: true });

// ── ③ 서로 모순된 조합도 던진다 ───────────────────────────────
throws('장부가 있는데 기준 품질이 null', { basis_quality: null, has_ledger: true, day_status: 'open', editable: true });
throws('장부가 있는데 상태가 null', { basis_quality: 'exact', has_ledger: true, day_status: null, editable: true });
throws('장부가 있는데 둘 다 null', { basis_quality: null, has_ledger: true, day_status: null, editable: true });
throws('장부가 없는데 기준 품질이 있다', { basis_quality: 'exact', has_ledger: false, day_status: null, editable: true });
throws('장부가 없는데 상태가 있다', { basis_quality: null, has_ledger: false, day_status: 'closed', editable: true });

console.log(fail === 0 ? '\n응답 계약 18/18 통과' : `\n응답 계약 실패 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
