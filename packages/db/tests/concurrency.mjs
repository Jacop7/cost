/**
 * 2세션 경합 시험 (검토 마지막 항목) — 판매 저장 ↔ 자동 마감/자동 브레이크.
 *
 * run.mjs 의 단일 세션·롤백 하네스로는 **두 연결의 경합**을 재현할 수 없다.
 * 여기서는 docker psql 연결 두 개를 실제로 동시에 돌린다:
 *   A(사장님): 판매 저장을 연달아 커밋
 *   B(크론):   close_due_business_days() + apply_due_breaks() 를 50ms 간격으로
 *
 * 재는 것 —
 *   ① 교착 없음: 두 세션 모두 제한 시간 안에 정상 종료
 *   ② 중복 차감 없음: 같은 수량 재저장이 재고 이벤트를 하나도 더 만들지 않는다(0028)
 *   ③ 잘못된 종료 없음(평시): 예정 종료 전에는 폭풍이 지나도 장부가 열려 있다
 *   ④ 마감 원자성(경합): 기한이 스톰 중간에 오면 — 닫힘은 정확히 한 번(auto),
 *      경계 전 저장은 성공하고 경계 뒤는 45002, 마감 시각 뒤의 판매 이벤트는 없다
 *
 * ⚠ 커밋이 남는 시험이다 — 반드시 일회용 DB 에서만 돈다(공유 개발 DB 금지).
 *    verify ③ 이 fresh_verify 위에서 суite 다음에 이걸 돌린다.
 */
import { spawnSync, spawn } from 'node:child_process';

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_sikjae';
const DB = process.argv[2] ?? process.env.PGDATABASE;
const STORE = '00000000-0000-0000-0000-0000000000b1';
const CLAIMS = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

if (!DB || !/^fresh_/.test(DB)) {
  // 사보타주·경합 검증은 일회용 DB 에서만 — 커밋이 남는 시험이라 공유 DB 를 오염시킨다.
  console.error(`경합 시험은 fresh_* 일회용 DB 에서만 돕니다 (지금: ${DB ?? '(없음)'})`);
  process.exit(1);
}

let failed = 0;
const ok = (label, cond, extra = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else { failed += 1; console.error(`  FAIL ${label}${extra ? `  — ${extra}` : ''}`); }
};

/** 소유자 단발 질의. */
function q(sql) {
  const r = spawnSync('docker', ['exec', '-i', CONTAINER, 'psql', '-At', '-U', 'postgres', '-d', DB, '-c', sql],
    { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql 실패: ${sql}\n${r.stderr}`);
  return r.stdout.trim();
}

/** 세션 하나 — SQL 문자열을 stdin 으로 흘리고 끝날 때까지 기다린다. */
function session(sql, timeoutMs) {
  return new Promise((resolve) => {
    const p = spawn('docker', ['exec', '-i', CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=0', '-At', '-U', 'postgres', '-d', DB]);
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => {
      // 제한 시간 초과 = 교착 의심. 죽이고 실패로 처리한다.
      p.kill('SIGKILL');
      resolve({ code: -1, out, err: `${err}\n[TIMEOUT ${timeoutMs}ms — 교착 의심]` });
    }, timeoutMs);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
    p.stdin.write(sql);
    p.stdin.end();
  });
}

const recipeId = q(`select id from recipes where store_id='${STORE}' and name='제육볶음'`);
const today = q(`select (resolve_sales_business_context('${STORE}'::uuid)).sales_date`);
const items = (qty) =>
  `jsonb_build_array(jsonb_build_object('recipe_id','${recipeId}','qty_hall',${qty},'qty_delivery',0,'qty_takeout',0,'qty_waste',0))`;

/** A 세션 SQL — 판매 i=1..n 을 커밋하며, 성공한 회차만 OK:i 를 찍는다. */
function sellerSql(n, sleep) {
  // VERBOSITY verbose — 오류에 SQLSTATE(45002)가 실려야 경계 단언이 코드로 잰다.
  const head = `\\set VERBOSITY verbose\nset role authenticated;\nset request.jwt.claims='${CLAIMS}';\n`;
  const body = Array.from({ length: n }, (_, k) => {
    const i = k + 1;
    return `select pg_sleep(${sleep});\nselect 'OK:${i}' where (save_sale('${STORE}','${today}',${items(i)}))->>'revision' is not null;`;
  }).join('\n');
  return head + body + '\n';
}

/** B 세션 SQL — 크론 두 개를 짧은 간격으로. 소유자(크론과 같은 권한)로 돈다. */
function cronSql(n, sleep) {
  const body = Array.from({ length: n }, () =>
    `select 'SWEEP:'||(close_due_business_days()->>'closed');\nselect apply_due_breaks();\nselect pg_sleep(${sleep});`,
  ).join('\n');
  return body + '\n';
}

const saleEventCount = () => Number(q(
  `select count(*) from inventory_events e
     join daily_sales_items i on i.id = e.sales_item_id
     join daily_sales s on s.id = i.daily_sales_id
    where s.store_id='${STORE}' and s.sale_date='${today}'`));

console.log(`\n경합 시험 · db=${DB} · today=${today}`);

// ── ① 평시 폭풍 — 스윕이 돌아도 열린 장부는 멀쩡하다 ─────────────
{
  const [a, b] = await Promise.all([
    session(sellerSql(15, 0.05), 30_000),
    session(cronSql(40, 0.05), 30_000),
  ]);
  ok('평시: 두 세션 모두 정상 종료(교착 없음)', a.code === 0 && b.code === 0,
    `a=${a.code} b=${b.code} ${a.err.slice(0, 200)} ${b.err.slice(0, 200)}`);
  const okCount = (a.out.match(/OK:/g) ?? []).length;
  ok('평시: 판매 15건 전부 성공', okCount === 15, `성공 ${okCount}/15`);
  ok('평시: 장부는 열려 있다 — 예정 종료 전 스윕은 무해하다',
    q(`select status::text from business_days where store_id='${STORE}' and business_date='${today}'`) === 'open');

  // 중복 차감 없음(0028) — 같은 수량을 다시 저장해도 재고 이벤트가 하나도 안 는다.
  const before = saleEventCount();
  q(`set role authenticated; set request.jwt.claims='${CLAIMS}';
     select save_sale('${STORE}','${today}',${items(15)});`);
  const after = saleEventCount();
  ok('평시: 같은 수량 재저장은 이벤트 0건 추가(중복 차감 없음)', after === before,
    `before=${before} after=${after}`);
  ok('평시: 최종 수량 = 마지막 저장 수량', Number(q(
    `select qty_hall from daily_sales_items i join daily_sales s on s.id=i.daily_sales_id
      where s.store_id='${STORE}' and s.sale_date='${today}' and i.recipe_id='${recipeId}'`)) === 15);
}

// ── ② 마감 경합 — 기한이 스톰 한가운데 온다 ─────────────────────
{
  // 기한(예정 종료 + 유예)이 2초 뒤에 오도록 민다 — 소유자 준비.
  q(`update business_days set planned_close_at = clock_timestamp() - auto_close_grace() + interval '2 seconds'
      where store_id='${STORE}' and business_date='${today}'`);

  const [a, b] = await Promise.all([
    session(sellerSql(40, 0.08), 45_000),
    session(cronSql(80, 0.05), 45_000),
  ]);
  ok('경합: 두 세션 모두 정상 종료(교착 없음)', a.code === 0 && b.code === 0,
    `a=${a.code} b=${b.code}`);

  const okIdx = [...a.out.matchAll(/OK:(\d+)/g)].map((m) => Number(m[1]));
  const okCount = okIdx.length;
  const lastOk = okIdx.length ? Math.max(...okIdx) : 0;
  ok('경합: 경계 전 저장은 성공했다', okCount >= 1, `성공 ${okCount}`);
  ok('경합: 경계 뒤 저장은 막혔다(45002)', okCount < 40 && a.err.includes('45002'),
    `성공 ${okCount}/40`);

  ok('경합: 장부는 auto 로 닫혔다',
    q(`select close_method::text from business_days where store_id='${STORE}' and business_date='${today}'`) === 'auto');
  ok('경합: 닫힘 전이는 정확히 한 번', Number(q(
    `select count(*) from business_state_transitions t
       join business_days d on d.id = t.business_day_id
      where d.store_id='${STORE}' and d.business_date='${today}' and t.to_status='closed'`)) === 1);
  ok('경합: 스윕이 실제로 닫았다', /SWEEP:[1-9]/.test(b.out));

  ok('경합: 최종 수량 = 마지막 성공 수량 — 끊긴 저장이 반쯤 남지 않았다', Number(q(
    `select qty_hall from daily_sales_items i join daily_sales s on s.id=i.daily_sales_id
      where s.store_id='${STORE}' and s.sale_date='${today}' and i.recipe_id='${recipeId}'`)) === lastOk);

  /*
   * 마감 시각 뒤의 판매 이벤트는 없다 — 마감은 FOR UPDATE 로 저장과 줄을 서므로,
   * 진행 중이던 저장은 마감 **전에** 커밋되고 그 뒤 저장은 게이트(45002)에 막힌다.
   * closed_at(= 예정 + 유예, 고정 시각)과 같은 시계(도커 안 DB)라 1초 여유면 넉넉하다.
   */
  ok('경합: 마감 시각 뒤의 판매 이벤트가 없다', q(
    `select count(*) from inventory_events e
       join daily_sales_items i on i.id = e.sales_item_id
       join daily_sales s on s.id = i.daily_sales_id
      where s.store_id='${STORE}' and s.sale_date='${today}'
        and e.occurred_at > (select closed_at + interval '1 second' from business_days
                              where store_id='${STORE}' and business_date='${today}')`) === '0');
}

if (failed > 0) {
  console.error(`\n경합 시험 실패 ${failed}건`);
  process.exit(1);
}
console.log('\n경합 시험 통과');
