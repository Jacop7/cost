import { spawnSync } from 'node:child_process';

const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_costkeep';
const database = process.env.PGDATABASE ?? 'postgres';
const demoStore = '00000000-0000-0000-0000-0000000000b1';
const demoOwner = '00000000-0000-0000-0000-0000000000a1';

if (!/^fresh_[a-z0-9_]{1,50}$/.test(database) && database !== 'postgres') {
  console.error(`로컬 DB 이름만 사용할 수 있습니다: ${database}`);
  process.exit(2);
}

const sql = String.raw`
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"${demoOwner}","role":"authenticated"}';

do $activate$
declare
  v_clock jsonb;
  v_business_state jsonb;
  v_phase text;
  v_date date;
  v_calendar_revision integer;
  v_calendar_temporarily_closed boolean := false;
begin
  v_clock:=public.sales_lifecycle_clock('${demoStore}');
  v_phase:=v_clock->>'phase';
  if v_phase='active' then return; end if;
  if v_phase<>'legacy_active' then
    raise exception '로컬 데모 매출 전환 상태를 자동 복구할 수 없습니다: %',v_phase;
  end if;

  v_date:=(v_clock->>'recommended_sales_date')::date;
  v_business_state:=public.business_day_state('${demoStore}');
  if v_business_state->>'business_date'=v_date::text
     and v_business_state->>'status' in ('open','break') then
    perform public.transition_business_state('${demoStore}','end');
  elsif v_business_state->>'business_date' is distinct from v_date::text
     or v_business_state->>'status' is distinct from 'closed' then
    v_calendar_revision:=0;
    perform public.set_sales_calendar_day('${demoStore}',v_date,'closed',v_calendar_revision,
      '로컬 데모 매출 수명주기 전환 준비');
    v_calendar_temporarily_closed:=true;
  end if;

  perform public.set_sales_lifecycle_phase('${demoStore}',0,'draining','로컬 데모 전환');
  perform public.set_sales_lifecycle_phase('${demoStore}',1,'freezing','로컬 데모 전환');
  perform public.set_sales_lifecycle_phase('${demoStore}',2,'active','로컬 데모 전환');

  if v_calendar_temporarily_closed then
    perform public.set_sales_calendar_day('${demoStore}',v_date,'expected',1,
      '로컬 데모 작성일 복원');
  end if;
end $activate$;

commit;
`;

const result = spawnSync(
  'docker',
  ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q'],
  { input: sql, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] },
);

if (result.error) console.error(`로컬 데모 매출 전환 실패: ${result.error.message}`);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`로컬 데모 매출 작성 활성화 완료 (${database})`);
