// 판매 채널 revision·매출 초안이 같은 매장 쓰기 잠금을 공유하는지 실제 2세션으로 검증한다.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const db = process.argv[2];
if (!db || !/^fresh_[a-z0-9_]+$/.test(db)) {
  throw new Error('Explicit disposable fresh_* DB required');
}

const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_costkeep';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'];
const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;

function q(sql) {
  const result = spawnSync('docker', args, { input: sql, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `psql exited ${result.status}`);
  return result.stdout.trim();
}

function run(sql) {
  const process = spawn('docker', args);
  let out = '';
  let err = '';
  process.stdout.on('data', chunk => { out += chunk; });
  process.stderr.on('data', chunk => { err += chunk; });
  process.stdin.end(sql);
  return new Promise(resolve => process.on('close', code => resolve({ code, out, err })));
}

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForActivity(applicationName, predicate) {
  // A loaded Windows/Docker host can spend several seconds starting the psql
  // process and entering the RPC before it reaches the deliberate barrier.
  // Keep the transaction's two-second barrier unchanged, but allow enough time
  // to observe its arrival instead of treating process startup as a DB failure.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const found = q(`select exists(
      select 1 from pg_stat_activity
       where application_name=${sqlLiteral(applicationName)} and ${predicate}
    );`);
    if (found === 't') return;
    await pause(50);
  }
  throw new Error(`Missing session barrier: ${applicationName}`);
}

function authenticated(owner) {
  return `set local role authenticated;
    set local request.jwt.claims=${sqlLiteral(JSON.stringify({ sub: owner, role: 'authenticated' }))};`;
}

function createStore({ activeSales = false } = {}) {
  const owner = randomUUID();
  const store = q(`begin;
    insert into auth.users(id) values(${sqlLiteral(owner)});
    ${authenticated(owner)}
    select public.create_store('판매 채널 경합','Asia/Seoul')->>'store_id';
    commit;`).split('\n').find(line => /^[0-9a-f-]{36}$/.test(line));
  if (!store) throw new Error('Store setup failed');
  let day;
  if (activeSales) {
    q(`begin;
      update public.sales_lifecycle_cutover_state set phase='active' where store_id=${sqlLiteral(store)};
      commit;`);
    const clock = JSON.parse(q(`begin; ${authenticated(owner)}
      select public.sales_lifecycle_clock(${sqlLiteral(store)});
      rollback;`).split('\n').find(line => line.startsWith('{')));
    day = clock.recommended_sales_date;
    q(`begin;
      set local request.jwt.claims=${sqlLiteral(JSON.stringify({ sub: owner, role: 'authenticated' }))};
      select public.publish_sales_basis_version(${sqlLiteral(store)},${sqlLiteral(day)});
      commit;`);
  }
  if (activeSales && !day) throw new Error('Sales date setup failed');
  return { owner, store, day };
}

const results = [];

// 활성 4개에서 동일 revision으로 두 채널을 추가하면 하나만 5번째가 되고 다른 쪽은 conflict여야 한다.
{
  const { owner, store } = createStore();
  q(`begin; ${authenticated(owner)}
    select public.create_sales_channel(${sqlLiteral(store)},'선행 채널',0);
    commit;`);
  const tagA = `channel-limit-a-${randomUUID()}`;
  const tagB = `channel-limit-b-${randomUUID()}`;
  const first = run(`begin; set local application_name=${sqlLiteral(tagA)}; ${authenticated(owner)}
    select public.create_sales_channel(${sqlLiteral(store)},'동시 채널 A',1);
    select pg_sleep(2); commit;`);
  await waitForActivity(tagA, "wait_event='PgSleep'");
  const second = run(`begin; set local application_name=${sqlLiteral(tagB)}; ${authenticated(owner)}
    select public.create_sales_channel(${sqlLiteral(store)},'동시 채널 B',1);
    commit;`);
  await waitForActivity(tagB, "wait_event_type='Lock'");
  const [a, b] = await Promise.all([first, second]);
  if (a.code !== 0 || b.code === 0 || !b.err.includes('SALES_CHANNEL_REVISION_CONFLICT')) {
    throw new Error(JSON.stringify({ scenario: 'same-revision-create', a, b }));
  }
  const state = JSON.parse(q(`begin; ${authenticated(owner)}
    select public.sales_channel_settings(${sqlLiteral(store)}); rollback;`).split('\n').find(line => line.startsWith('{')));
  const concurrentNames = state.channels.filter(channel => channel.name.startsWith('동시 채널'));
  if (state.active_count !== 5 || state.revision !== 2 || concurrentNames.length !== 1) {
    throw new Error(JSON.stringify({ scenario: 'same-revision-create', state }));
  }
  results.push({ scenario: 'same-revision-create', lockObserved: true, conflict: true, pass: true });
}

// 초안을 먼저 연 트랜잭션 뒤의 채널 추가는 기다린 다음 SALES_CHANNELS_LOCKED_BY_DRAFT로 거절한다.
{
  const { owner, store, day } = createStore({ activeSales: true });
  const draft = randomUUID();
  const tagA = `draft-first-a-${randomUUID()}`;
  const tagB = `draft-first-b-${randomUUID()}`;
  const first = run(`begin; set local application_name=${sqlLiteral(tagA)}; ${authenticated(owner)}
    select public.open_sales_draft(${sqlLiteral(store)},${sqlLiteral(day)},${sqlLiteral(draft)});
    select pg_sleep(2); commit;`);
  await waitForActivity(tagA, "wait_event='PgSleep'");
  const second = run(`begin; set local application_name=${sqlLiteral(tagB)}; ${authenticated(owner)}
    select public.create_sales_channel(${sqlLiteral(store)},'초안 뒤 채널',0);
    commit;`);
  await waitForActivity(tagB, "wait_event_type='Lock'");
  const [a, b] = await Promise.all([first, second]);
  if (a.code !== 0 || b.code === 0 || !b.err.includes('SALES_CHANNELS_LOCKED_BY_DRAFT')) {
    throw new Error(JSON.stringify({ scenario: 'draft-before-channel', a, b }));
  }
  results.push({ scenario: 'draft-before-channel', lockObserved: true, draftGuard: true, pass: true });
}

// 채널 추가를 먼저 커밋하면 뒤의 초안은 기다린 다음 새 채널까지 포함한 완전한 manifest를 만든다.
{
  const { owner, store, day } = createStore({ activeSales: true });
  const draft = randomUUID();
  const tagA = `channel-first-a-${randomUUID()}`;
  const tagB = `channel-first-b-${randomUUID()}`;
  const first = run(`begin; set local application_name=${sqlLiteral(tagA)}; ${authenticated(owner)}
    select public.create_sales_channel(${sqlLiteral(store)},'초안 전 채널',0);
    select pg_sleep(2); commit;`);
  await waitForActivity(tagA, "wait_event='PgSleep'");
  const second = run(`begin; set local application_name=${sqlLiteral(tagB)}; ${authenticated(owner)}
    select public.open_sales_draft(${sqlLiteral(store)},${sqlLiteral(day)},${sqlLiteral(draft)});
    commit;`);
  await waitForActivity(tagB, "wait_event_type='Lock'");
  const [a, b] = await Promise.all([first, second]);
  if (a.code !== 0 || b.code !== 0) {
    throw new Error(JSON.stringify({ scenario: 'channel-before-draft', a, b }));
  }
  const manifest = JSON.parse(q(`select jsonb_build_object(
    'count',count(*),
    'names',jsonb_agg(channel_name_snapshot order by sort_order)
  ) from public.sales_draft_channel_manifests where draft_id=${sqlLiteral(draft)};`));
  if (manifest.count !== 4 || !manifest.names.includes('초안 전 채널')) {
    throw new Error(JSON.stringify({ scenario: 'channel-before-draft', manifest }));
  }
  results.push({ scenario: 'channel-before-draft', lockObserved: true, manifestCount: 4, pass: true });
}

console.log(JSON.stringify({ database: db, runAt: new Date().toISOString(), results }, null, 2));
