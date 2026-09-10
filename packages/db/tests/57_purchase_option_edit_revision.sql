-- 0200 contract. _prelude.sql owns the transaction; the runner rolls it back.
-- Compare complete visible rows, not just counts, around every rejected write.
create function pg_temp.option_snapshot() returns jsonb language plpgsql as $h$
declare table_name text; rows jsonb; result jsonb := '{}'::jsonb;
begin
  foreach table_name in array array['purchase_options','inventory_states','inventory_events',
    'order_records','price_trends','profit_trends','entity_change_events'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',table_name) into rows;
    result := result || jsonb_build_object(table_name,rows);
  end loop;
  return result;
end $h$;

create function pg_temp.option_reject(p_label text, p_sql text, p_code text, p_detail text)
returns void language plpgsql as $h$
declare before_state jsonb := pg_temp.option_snapshot(); actual_code text; actual_detail text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics actual_code=returned_sqlstate, actual_detail=pg_exception_detail;
  end;
  perform pg_temp.eq_t(p_label || ' SQLSTATE',actual_code,p_code);
  perform pg_temp.eq_t(p_label || ' detail',actual_detail,p_detail);
  perform pg_temp.ok(p_label || ' 모든 옵션·원장·이력 불변',pg_temp.option_snapshot()=before_state);
end $h$;

set local role authenticated;
do $test$
declare
  ingredient uuid; other_ingredient uuid; option_id uuid; brand uuid := gen_random_uuid();
  payload jsonb; detail jsonb; invalid jsonb; original jsonb; before_state jsonb;
  unit_name text; changes0 bigint; max_id uuid;
begin
  ingredient := save_ingredient(pg_temp.store(),jsonb_build_object('name','옵션 CAS 검사',
    'base_unit','g','per_volume',1000,'safety_stock',0,'min_order_qty',1));
  other_ingredient := save_ingredient(pg_temp.store(),jsonb_build_object('name','옵션 소속 검사',
    'base_unit','g','per_volume',1000,'safety_stock',0,'min_order_qty',1));
  -- Brand fixture only; the public editor does not have a brand creation control.
  set local role postgres;
  insert into brands(id,store_id,name) values(brand,pg_temp.store(),'CAS 보존 브랜드');
  set local role authenticated;

  payload := jsonb_build_object('ingredient_id',ingredient,'purchase_name','CAS 옵션',
    'base_unit','g','volume',1000,'amount',4000,'brand_id',brand,'url','https://example.invalid');
  before_state := pg_temp.option_snapshot();
  option_id := save_purchase_option(pg_temp.store(),payload);
  select o into detail from jsonb_array_elements(ingredient_detail(ingredient)->'options') o where o->>'id'=option_id::text;
  perform pg_temp.eq_t('판본 JSON 타입',jsonb_typeof(detail->'edit_revision'),'string');
  perform pg_temp.eq_t('신규 판본','1',detail->>'edit_revision');
  perform pg_temp.ok('생성은 재고·가격·주문 원장을 바꾸지 않음',
    (pg_temp.option_snapshot()-'purchase_options'-'entity_change_events')=(before_state-'purchase_options'-'entity_change_events'));
  payload := (payload-'brand_id') || jsonb_build_object('id',option_id,'expected_revision',detail->>'edit_revision');
  select to_jsonb(o) into original from purchase_options o where id=option_id;
  before_state := pg_temp.option_snapshot();
  perform save_purchase_option(pg_temp.store(),payload);
  perform pg_temp.ok('브랜드 생략·같은 값 저장은 전체 행과 이력 불변',pg_temp.option_snapshot()=before_state);

  perform pg_temp.option_reject('판본 누락',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),payload-'expected_revision'),
    '22000','OPTION_BASE_REQUIRED');
  for invalid in select value from jsonb_array_elements('[null,1,0,-1,"0","-1","01"," 1","1 ","1.0",{},[]]'::jsonb) loop
    perform pg_temp.option_reject('잘못된 판본 ' || invalid::text,
      format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),payload || jsonb_build_object('expected_revision',invalid)),
      '22000','OPTION_BASE_REQUIRED');
  end loop;
  perform pg_temp.option_reject('bigint 범위 초과',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),
    payload || jsonb_build_object('expected_revision','9223372036854775808')),'22000','OPTION_BASE_INVALID');
  perform pg_temp.option_reject('생성 요청의 판본 금지',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),payload-'id'),
    '22000','OPTION_CREATE_BASE_UNEXPECTED');
  perform pg_temp.option_reject('객체 아닌 payload',format('select save_purchase_option(%L,''[]''::jsonb)',pg_temp.store()),
    '22000','OPTION_PAYLOAD_INVALID');

  select count(*) into changes0 from entity_change_events where entity_id=ingredient;
  perform save_purchase_option(pg_temp.store(),payload || jsonb_build_object('amount',5000));
  perform pg_temp.ok('정상 수정은 판본 2·브랜드·생성 시각 보존',
    (select edit_revision=2 and brand_id=brand and created_at=(original->>'created_at')::timestamptz
      from purchase_options where id=option_id));
  perform pg_temp.eq('정상 수정 이력 한 건',(select count(*) from entity_change_events where entity_id=ingredient),changes0+1,0);
  perform pg_temp.option_reject('오래된 판본',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),payload),
    '45009','REVISION_CONFLICT');
  -- Even an otherwise identical replay must check the submitted revision first.
  perform pg_temp.option_reject('응답 유실 후 stale 동일값',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),
    payload || jsonb_build_object('amount',5000)),'45009','REVISION_CONFLICT');
  perform save_purchase_option(pg_temp.store(),payload || jsonb_build_object('expected_revision','2'));
  perform pg_temp.eq('ABA는 값이 돌아와도 판본 3',(select edit_revision from purchase_options where id=option_id),3,0);
  perform pg_temp.option_reject('ABA 이전 판본',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),payload),
    '45009','REVISION_CONFLICT');
  payload := payload || jsonb_build_object('expected_revision','3');
  perform pg_temp.option_reject('수정 단위 차원 불일치',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),
    payload || jsonb_build_object('base_unit','ml')),'22000','');
  perform pg_temp.option_reject('다른 식재료 옵션 수정',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),
    payload || jsonb_build_object('ingredient_id',other_ingredient)),'22000','');
  perform pg_temp.raises('다른 매장 수정 금지',format('select save_purchase_option(%L,%L::jsonb)',gen_random_uuid(),payload),'42501');
  before_state := pg_temp.option_snapshot();
  perform save_purchase_option(pg_temp.store(),payload-'base_unit');
  perform pg_temp.ok('기존 최소단위 호출은 base_unit 생략 허용',pg_temp.option_snapshot()=before_state);
  perform save_purchase_option(pg_temp.store(),payload || jsonb_build_object('brand_id',null));
  perform pg_temp.ok('명시적 브랜드 삭제만 반영하고 판본 증가',
    (select brand_id is null and edit_revision=4 from purchase_options where id=option_id));
  perform pg_temp.ok('성공 수정도 재고·가격·주문 원장 불변',
    (pg_temp.option_snapshot()-'purchase_options'-'entity_change_events')=(before_state-'purchase_options'-'entity_change_events'));

  foreach unit_name in array array['ml','ea'] loop
    other_ingredient := save_ingredient(pg_temp.store(),jsonb_build_object('name','옵션 단위 ' || unit_name,
      'base_unit',unit_name,'per_volume',1,'safety_stock',0,'min_order_qty',1));
    invalid := jsonb_build_object('ingredient_id',other_ingredient,'base_unit',unit_name,'volume',2,'amount',1000);
    max_id := save_purchase_option(pg_temp.store(),invalid);
    perform save_purchase_option(pg_temp.store(),invalid || jsonb_build_object('id',max_id,'expected_revision','1','volume',3));
    perform pg_temp.eq(unit_name || ' 최소단위 수정',(select volume from purchase_options where id=max_id),3,0);
    perform pg_temp.option_reject(unit_name || '의 무게 차원 거부',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),
      invalid || jsonb_build_object('base_unit','g')),'22000','');
  end loop;

  -- Admin-only synthetic boundary values; never manipulate an existing user's row.
  set local role postgres;
  update purchase_options set edit_revision=1 where id=option_id;
  perform pg_temp.eq('판본만 되감기 불가',(select edit_revision from purchase_options where id=option_id),4,0);
  update purchase_options set hidden=true where id=option_id;
  perform pg_temp.eq('숨김 변경도 판본 증가',(select edit_revision from purchase_options where id=option_id),5,0);
  max_id := gen_random_uuid();
  insert into purchase_options(id,store_id,ingredient_id,purchase_name,volume,amount,edit_revision)
    values(max_id,pg_temp.store(),ingredient,'판본 상한 fixture',1,1,9223372036854775807);
  set local role authenticated;
  perform pg_temp.ok('숨긴 옵션은 상세에서 제외',not exists(select 1 from jsonb_array_elements(ingredient_detail(ingredient)->'options') o where o->>'id'=option_id::text));
  select o into detail from jsonb_array_elements(ingredient_detail(ingredient)->'options') o where o->>'id'=max_id::text;
  perform pg_temp.eq_t('bigint 상한도 원문 문자열',detail->>'edit_revision','9223372036854775807');
  invalid := jsonb_build_object('id',max_id,'ingredient_id',ingredient,'volume',1,'amount',1,'expected_revision',detail->>'edit_revision');
  before_state := pg_temp.option_snapshot();
  perform save_purchase_option(pg_temp.store(),invalid);
  perform pg_temp.ok('상한에서도 무변경 저장 가능',pg_temp.option_snapshot()=before_state);
  perform pg_temp.option_reject('상한 실제 수정은 overflow로 거절',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),
    invalid || jsonb_build_object('amount',2)),'22003','');
  perform delete_purchase_option(max_id);
  perform pg_temp.option_reject('삭제된 옵션은 재생성하지 않음',format('select save_purchase_option(%L,%L::jsonb)',pg_temp.store(),invalid),
    'P0002','OPTION_NOT_FOUND');
end $test$;

-- Test actual app denial, plus the executor's effective positive privilege.
select pg_temp.ok('executor UPDATE 유지',has_table_privilege('margincook_rpc_executor','public.purchase_options','UPDATE'));
select pg_temp.ok('anon/authenticated 테이블·컬럼 UPDATE 모두 차단',not exists(
  select 1 from unnest(array['anon','authenticated']) r(role_name)
  where has_table_privilege(r.role_name,'public.purchase_options','UPDATE')
    or exists(select 1 from pg_attribute a where a.attrelid='public.purchase_options'::regclass
      and a.attnum>0 and not a.attisdropped and has_column_privilege(r.role_name,'public.purchase_options',a.attname,'UPDATE'))));
select pg_temp.ok('트리거 함수는 앱 실행면에 노출되지 않음',
  not has_function_privilege('authenticated','public.bump_purchase_option_edit_revision()','EXECUTE')
  and not has_function_privilege('anon','public.bump_purchase_option_edit_revision()','EXECUTE'));
select pg_temp.raises('authenticated 직접 UPDATE 금지','update purchase_options set amount=amount where false','42501');
set local role anon;
select pg_temp.raises('anon 직접 UPDATE 금지','update purchase_options set amount=amount where false','42501');
