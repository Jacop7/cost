/**
 * 2세션 경합 시험 — 판매 저장 ↔ 자동 마감/자동 브레이크 (검토 항목, 재작성).
 *
 * run.mjs 의 단일 세션·롤백 하네스로는 **두 연결의 경합**을 재현할 수 없다.
 * 여기서는 docker psql 연결을 실제로 동시에 돌린다:
 *   A(사장님): 판매 저장을 **트랜잭션 안에서 잠금을 쥔 채 잠시 머문 뒤** 커밋
 *              (begin; save_sale; pg_sleep; commit) — 행 잠금 경합을 실제로 만든다
 *   B(크론):   close_due_business_days() + apply_due_breaks() 를 촘촘히
 *   W(관찰자): pg_stat_activity 를 폴링해 **잠금 대기가 실제로 있었는지** 기록
 *
 * 처음 판(4484219)이 증명하지 못한 것과 그 고침 —
 *   · 브레이크 픽스처가 없어 자동 브레이크가 한 번도 안 돌았다 → 오늘 규칙에 지금을
 *     덮는 브레이크 창을 굳히고 시작 전이를 창 앞으로 되민다(시험 30 ②와 같은 준비).
 *   · ON_ERROR_STOP=0 이라 교착·SQL 오류가 있어도 종료코드 0 이었다 → 모든 SQLSTATE 를
 *     VERBOSITY verbose 로 받아 **전수 기록**하고, 허용 목록(A: 45002뿐 · B: 없음) 밖이면 실패.
 *   · occurred_at 은 영업일 자정이라 "마감 뒤 이벤트 0" 이 항상 참이었다 → 각 저장이
 *     커밋 직전 clock_timestamp() 를 찍고, 성공한 저장의 시각이 전부 마감 시각 전인지 본다.
 *   · READY 장벽·잠금 대기 확인이 없었다 → 두 세션이 같은 순간을 기다렸다가 출발하고
 *     (pg_sleep 까지의 동기), 관찰자가 Lock 대기를 최소 한 번 잡아야 통과.
 *   · 중복 차감이 재저장만 봤다 → **원장 합계**: 판매 이벤트의 재료별 합 = -(최종 수량 × 1인분
 *     필요량), 그날 스냅샷 기준. 스톰 중 어떤 순서로 커밋됐든 이 등식은 깨지면 안 된다.
 *
 * ⚠ 커밋이 남는 시험이다 — 반드시 일회용 DB 에서만 돈다(공유 개발 DB 금지).
 *    verify ③ 이 일회용 DB 위에서 스위트 다음에 이걸 돌린다.
 */
import { spawnSync, spawn } from 'node:child_process';

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_sikjae';
const DB = process.argv[2] ?? process.env.PGDATABASE;
const STORE = '00000000-0000-0000-0000-0000000000b1';
const CLAIMS = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

if (!DB || !/^fresh_/.test(DB)) {
  console.error(`경합 시험은 fresh_* 일회용 DB 에서만 돕니다 (지금: ${DB ?? '(없음)'})`);
  process.exit(1);
}

let failed = 0;
const ok = (label, cond, extra = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else { failed += 1; console.error(`  FAIL ${label}${extra ? `  — ${extra}` : ''}`); }
};

/** 소유자 단발 질의. 실패는 곧 시험 실패다. */
function q(sql) {
  const r = spawnSync('docker', ['exec', '-i', CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres', '-d', DB, '-c', sql],
    { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql 실패: ${sql}\n${r.stderr}`);
  return r.stdout.trim();
}

/** 세션 하나 — SQL 을 stdin 으로 흘리고 끝날 때까지 기다린다. SQLSTATE 는 stderr 에서 전수 수집. */
function session(name, sql, timeoutMs) {
  return new Promise((resolve) => {
    const p = spawn('docker', ['exec', '-i', CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=0', '-At', '-U', 'postgres', '-d', DB]);
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      resolve({ name, code: -1, out, err: `${err}\n[TIMEOUT ${timeoutMs}ms — 교착 의심]`, states: ['TIMEOUT'] });
    }, timeoutMs);
    p.on('close', (code) => {
      clearTimeout(timer);
      // VERBOSITY verbose 는 `ERROR:  45002: ...` 꼴로 SQLSTATE 를 앞세운다.
      const states = [...err.matchAll(/^ERROR:\s+([0-9A-Z]{5}):/gm)].map((m) => m[1]);
      resolve({ name, code, out, err, states });
    });
    p.stdin.write(`\\set VERBOSITY verbose\n${sql}`);
    p.stdin.end();
  });
}

/**
 * 관찰자 — **상주 세션** 하나가 10ms 간격으로 pg_stat_activity 의 Lock 대기를 센다.
 * ⚠ 표본마다 psql 을 새로 띄우면 간격이 150ms 를 넘어 잠금 대기(수십 ms)를 놓친다 —
 *   실측: 마감 경합에서 32표본 0건. DO 블록 안 루프는 다른 세션의 대기를 실시간으로 본다.
 */
function lockWatcher(seconds) {
  const n = Math.round(seconds * 100);
  const sql = `do $w$ declare n int := 0; c int; i int; begin
    for i in 1..${n} loop
      perform pg_sleep(0.01);
      select count(*) into c from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock';
      if c > 0 then n := n + 1; end if;
    end loop;
    raise notice 'WAITS:%:%', n, ${n};
  end $w$;
`;
  return session('W', sql, seconds * 1000 + 10_000).then((r) => {
    const m = r.err.match(/WAITS:(\d+):(\d+)/);
    return { waits: m ? Number(m[1]) : -1, samples: m ? Number(m[2]) : 0 };
  });
}

/** 같은 순간에 출발시키는 장벽 — 두 세션이 절대 시각까지 잠든 뒤 시작한다. */
const barrierSql = (startAtIso) =>
  `select pg_sleep(greatest(0, extract(epoch from ('${startAtIso}'::timestamptz - clock_timestamp()))));\n`;

const recipeId = q(`select id from recipes where store_id='${STORE}' and name='제육볶음'`);
const today = q(`select (resolve_sales_business_context('${STORE}'::uuid)).sales_date`);
const dayId = q(`select id from business_days where store_id='${STORE}' and business_date='${today}'`);
if (!dayId) { console.error('오늘 장부가 없습니다 — 시드가 오늘을 열어 둬야 합니다'); process.exit(1); }
const items = (qty) =>
  `jsonb_build_array(jsonb_build_object('recipe_id','${recipeId}','qty_hall',${qty},'qty_delivery',0,'qty_takeout',0,'qty_waste',0))`;

/**
 * A 세션 — 판매 i=1..n. 각 저장은 트랜잭션 안에서 잠금을 쥔 채 hold 만큼 머문 뒤 커밋한다.
 * 성공한 회차는 `OK:i:<커밋 직전 시각>` 을 찍는다(실패한 트랜잭션은 롤백돼 아무것도 안 찍는다).
 */
function sellerSql(n, hold, startAtIso) {
  const head = `set role authenticated;\nset request.jwt.claims='${CLAIMS}';\n${barrierSql(startAtIso)}`;
  const body = Array.from({ length: n }, (_, k) => {
    const i = k + 1;
    return [
      'begin;',
      `select save_sale('${STORE}','${today}',${items(i)});`,
      `select pg_sleep(${hold});`,
      `select 'OK:${i}:'||clock_timestamp();`,
      'commit;',
    ].join('\n');
  }).join('\n');
  return head + body + '\n';
}

/** B 세션 — 크론 둘을 촘촘히. 소유자(크론과 같은 권한). */
function cronSql(n, sleep, startAtIso) {
  const body = Array.from({ length: n }, () =>
    `select 'SWEEP:'||(close_due_business_days()->>'closed');\nselect 'BREAK:'||(apply_due_breaks()->>'break_started')||':'||(apply_due_breaks()->>'resumed');\nselect pg_sleep(${sleep});`,
  ).join('\n');
  return barrierSql(startAtIso) + body + '\n';
}

const startIn = (sec) => new Date(Date.now() + sec * 1000).toISOString();

/** 원장 합계 — 판매 이벤트의 재료별 합이 그날 스냅샷 기준 -(수량 × 1인분) 과 같은가. */
function ledgerMismatch(expectedQty) {
  return q(`
    with need as (
      select (l->>'ingredient_id')::uuid as ingredient_id,
             (l->>'per_serving')::numeric as per_serving
        from business_days d,
             jsonb_array_elements(d.snapshot->'recipes'->'${recipeId}'->'lines') l
       where d.id = '${dayId}'
    ),
    got as (
      select e.ingredient_id, sum(e.count_delta) as delta
        from inventory_events e
        join daily_sales_items i on i.id = e.sales_item_id
        join daily_sales s on s.id = i.daily_sales_id
       where s.store_id='${STORE}' and s.sale_date='${today}' and i.recipe_id='${recipeId}'
       group by e.ingredient_id
    )
    select count(*) from need n left join got g using (ingredient_id)
     where coalesce(g.delta, 0) <> -(${expectedQty} * n.per_serving)`);
}

const finalQty = () => Number(q(
  `select qty_hall from daily_sales_items i join daily_sales s on s.id=i.daily_sales_id
    where s.store_id='${STORE}' and s.sale_date='${today}' and i.recipe_id='${recipeId}'`));

console.log(`\n경합 시험 · db=${DB} · today=${today}`);
ok('전제: 스냅샷에 제육볶음 재료선이 있다(원장 합계의 기준)', Number(q(
  `select jsonb_array_length(snapshot->'recipes'->'${recipeId}'->'lines') from business_days where id='${dayId}'`)) > 0);

// ── ① 평시 폭풍 + 자동 브레이크 — 열린 장부는 멀쩡하고, 브레이크는 실제로 돈다 ──
{
  /*
   * 브레이크 픽스처: 장부에 굳은 규칙의 브레이크를 [00:00, 23:59] 로 두고, 시작 전이를
   * 창 앞으로 되민다(크론은 "경계 이후 전이가 있으면 물러선다" — 시험 30 ②와 같은 준비).
   * 자동 브레이크가 폭풍 **중간에** 상태를 open→break 로 바꾸는 동안 판매가 계속 들어온다.
   */
  q(`update operating_rules r set weekly_breaks = (select jsonb_object_agg(d::text, jsonb_build_object('start','00:00','end','23:59')) from generate_series(0,6) d)
      from business_days b where b.id = '${dayId}' and r.id = b.operating_rule_id`);
  q(`update business_state_transitions set at = ('${today}'::timestamp at time zone store_timezone('${STORE}')) - interval '1 hour'
      where business_day_id = '${dayId}'`);
  ok('전제: 자동 브레이크 픽스처가 굳었다', q(`select (rule_hours_on(operating_rule_id, business_date)->>'break_end')::time = time '23:59' from business_days where id='${dayId}'`) === 't');

  const startAt = startIn(1.5);
  const [a, b, { waits, samples }] = await Promise.all([
    session('A', sellerSql(15, 0.06, startAt), 40_000),
    session('B', cronSql(60, 0.02, startAt), 40_000),
    lockWatcher(6),
  ]);

  ok('평시: 두 세션 모두 정상 종료(교착·타임아웃 없음)', a.code === 0 && b.code === 0 && !a.states.includes('TIMEOUT') && !b.states.includes('TIMEOUT'),
    `a=${a.code} b=${b.code}`);
  ok('평시: A 에 SQL 오류가 하나도 없다(SQLSTATE 전수)', a.states.length === 0, `states=${a.states.join(',')}`);
  ok('평시: B 에 SQL 오류가 하나도 없다(SQLSTATE 전수)', b.states.length === 0, `states=${b.states.join(',')}`);
  ok('평시: 판매 15건 전부 성공', (a.out.match(/^OK:/gm) ?? []).length === 15);
  ok('평시: 관찰자가 실제 잠금 대기를 봤다 — 경합이 있었다', waits > 0, `waits=${waits}/${samples}`);
  ok('평시: 자동 브레이크가 폭풍 중에 실제로 돌았다', /BREAK:[1-9]/.test(b.out) && q(
    `select count(*) from business_state_transitions where business_day_id='${dayId}' and to_status='break' and method='auto'`) === '1');
  const st = q(`select status::text from business_days where id='${dayId}'`);
  ok('평시: 장부는 닫히지 않았다 — 예정 종료 전 스윕은 무해하다', st === 'open' || st === 'break', `status=${st}`);
  ok('평시: 최종 수량 = 마지막 저장 수량', finalQty() === 15);
  ok('평시: 원장 합계 = -(15 × 1인분) — 브레이크 전환 중에도 중복·누락 차감 없음',
    ledgerMismatch(15) === '0', `어긋난 재료 ${ledgerMismatch(15)}종`);
}

// ── ② 마감 경합 — 기한이 폭풍 한가운데 온다 ───────────────────────
{
  // 브레이크 중이면 재개해 둔다(닫힘 경합만 본다). 기한 = 출발 2초 뒤.
  q(`update business_days set status = 'open' where id='${dayId}' and status = 'break'`);
  q(`update business_days set planned_close_at = clock_timestamp() - auto_close_grace() + interval '3.5 seconds' where id='${dayId}'`);
  const startAt = startIn(1.5);
  const [a, b, { waits, samples }] = await Promise.all([
    session('A', sellerSql(40, 0.06, startAt), 60_000),
    session('B', cronSql(120, 0.02, startAt), 60_000),
    lockWatcher(10),
  ]);

  ok('경합: 두 세션 모두 정상 종료(교착·타임아웃 없음)', a.code === 0 && b.code === 0 && !a.states.includes('TIMEOUT') && !b.states.includes('TIMEOUT'));
  /*
   * 25P02(in_failed_sql_transaction)는 명시 트랜잭션 안에서 45002 로 실패한 **뒤** 같은
   * 트랜잭션의 다음 문(pg_sleep·OK 출력)이 내는 부수 코드다 — 실제 오류가 아니라
   * 45002 의 그림자다. 45002 없이 25P02 만 있으면 그건 다른 문제다.
   */
  const other = a.states.filter((s) => s !== '45002' && !(s === '25P02' && a.states.includes('45002')));
  ok('경합: A 의 오류는 45002(마감)와 그 그림자(25P02)뿐 — 교착(40P01)·기타 없음', other.length === 0,
    `states=${[...new Set(a.states)].join(',')}`);
  ok('경합: B 에 SQL 오류가 없다', b.states.length === 0, `states=${b.states.join(',')}`);
  // 마감은 한 순간이라 잠금 대기가 관찰될지는 확률적이다 — 필수 증명은 ①이 한다. 여기선 기록만.
  console.log(`  info 경합: 잠금 대기 표본 ${waits}/${samples}`);

  const oks = [...a.out.matchAll(/^OK:(\d+):(.+)$/gm)].map((m) => ({ i: Number(m[1]), at: m[2] }));
  ok('경합: 경계 전 저장은 성공했다', oks.length >= 1, `성공 ${oks.length}`);
  ok('경합: 경계 뒤 저장은 45002 로 막혔다', oks.length < 40 && a.states.includes('45002'), `성공 ${oks.length}/40`);

  ok('경합: 장부는 auto 로 닫혔다', q(`select close_method::text from business_days where id='${dayId}'`) === 'auto');
  ok('경합: 닫힘 전이는 정확히 한 번', q(
    `select count(*) from business_state_transitions where business_day_id='${dayId}' and to_status='closed'`) === '1');
  ok('경합: 스윕이 실제로 닫았다', /SWEEP:[1-9]/.test(b.out));

  const lastOk = oks.length ? Math.max(...oks.map((o) => o.i)) : 0;
  ok('경합: 최종 수량 = 마지막 성공 수량 — 반쯤 남은 저장이 없다', finalQty() === lastOk, `qty=${finalQty()} lastOk=${lastOk}`);
  ok('경합: 원장 합계 = -(마지막 성공 수량 × 1인분)', ledgerMismatch(lastOk) === '0');

  /*
   * 직렬화 증명 — 성공한 저장의 커밋 직전 시각이 전부 **마감이 실제로 실행된 시각**
   * (마감 전이 기록 at = 잠금을 쥔 뒤의 clock_timestamp) 전이다.
   * ⚠ closed_at 과 비교하면 안 된다 — 그건 고정 기한(예정 + 유예)이지 마감이 커밋된
   *   순간이 아니다. 기한 직전에 게이트를 통과한 저장은 잠금을 쥔 채 기한을 넘겨 커밋할 수
   *   있고, 그때 마감은 그 저장 **뒤에** 줄을 선다(실측: late=1 이 바로 그 경우였다).
   *   마감이 잠금을 쥔 뒤에 찍은 시각보다 늦게 커밋된 저장이 있다면, 그게 진짜 위반이다.
   */
  const closeStamp = q(`select at from business_state_transitions where business_day_id='${dayId}' and to_status='closed'`);
  const late = q(`select count(*) from unnest(array[${oks.map((o) => `'${o.at}'::timestamptz`).join(',') || 'null::timestamptz'}]) t
                   where t > '${closeStamp}'::timestamptz`);
  ok('경합: 마감이 실행된 뒤에 커밋된 저장이 없다(직렬화)', late === '0', `late=${late} close_stamp=${closeStamp}`);
}

if (failed > 0) {
  console.error(`\n경합 시험 실패 ${failed}건`);
  process.exit(1);
}
console.log('\n경합 시험 통과');
