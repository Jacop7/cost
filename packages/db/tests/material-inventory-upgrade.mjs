// Exercise the actual transition SQL against legacy OFF data inside a rollback.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const database = process.argv[2];
if (!/^fresh_[a-zA-Z0-9_]+$/.test(database ?? '')) throw new Error('Fresh DB required');
const prelude = readFileSync(new URL('./_prelude.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260914000003_restore_material_inventory.sql', import.meta.url), 'utf8')
  .replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
const quoted = `'${migration.replaceAll("'", "''")}'`;
const sql = `${prelude}
set local role postgres;
do $test$
declare s uuid:=pg_temp.store(); i uuid; r uuid; day date; h text; after_h text;
begin
  insert into ingredients(store_id,name,base_unit,per_volume,stock_tracking,menu_unit_price_override)
    values(s,'이관 전 재고 제외 용기','ea',1,false,300) returning id into i;
  insert into recipes(store_id,name,price,base_servings) values(s,'이관 전 메뉴',1000,1) returning id into r;
  insert into recipe_lines(store_id,recipe_id,ingredient_id,input_qty) values(s,r,i,1);
  day:=pg_temp.open_today();
  perform pg_temp.e10(s,day,r,2);
  -- Test helpers restore the app executor role after product RPC calls. The
  -- migration itself is deployed by postgres, so restore that deployment role
  -- before each dynamic execution being asserted.
  set local role postgres;
  perform pg_temp.raises('영업 중 전환 차단',${quoted},'55000');
  update business_days set status='break' where store_id=s and business_date=day;
  set local role postgres;
  perform pg_temp.raises('브레이크 중 전환 차단',${quoted},'55000');
  perform pg_temp.close_today();
  set local role postgres;
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'')) into h from inventory_events e;
  execute ${quoted};
  select md5(coalesce(jsonb_agg(to_jsonb(e) order by e.id)::text,'')) into after_h from inventory_events e;
  perform pg_temp.eq_t('실제 전환 SQL은 기존 원장을 보존',after_h,h);
  perform pg_temp.ok('이관 재료 추적 활성화',(select stock_tracking from ingredients where id=i));
  perform pg_temp.eq('이관 중 초기 재고를 만들지 않음',(select count(*) from inventory_states where ingredient_id=i),0);
  perform pg_temp.eq('이관 중 기존 기준 단가 유지',current_ingredient_unit_price(i),300);
  perform pg_temp.ok('동결된 과거 판매는 추적 제외 유지',not exists(select 1 from day_stock_needs(s,day,r,2) where ingredient_id=i));
  perform pg_temp.ok('새 스냅샷은 재고 추적', (recipe_snapshot_entry(r,day+1)#>>'{lines,0,stock_tracking}')::boolean);
end $test$;
rollback;`;
const result = spawnSync('docker', ['exec','-i',process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_costkeep','psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-q'], {input:sql,encoding:'utf8'});
process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
process.exit(result.status ?? 1);
