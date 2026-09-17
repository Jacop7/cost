-- Operation is independent from source and from direct/derived field changes.
set local role postgres;
select set_config('costkeep.international_tax_force','owner_test',true);
do $test$
declare u uuid:=gen_random_uuid(); s uuid; i uuid; r uuid; option_id uuid; e jsonb; h jsonb;
  body jsonb; option_body jsonb; n bigint; rev text; old_event uuid; old_row jsonb;
  m jsonb; t jsonb; v jsonb; fixed_month text; archived uuid:=gen_random_uuid(); c_id bigint;
begin
  insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(create_store('변경 종류 계약','Asia/Seoul')->>'store_id')::uuid;
  i:=save_ingredient(s,'{"contract_version":3,"name":"종류 시험 재료","base_unit":"g"}');
  perform pg_temp.eq('재료 최초 등록은 수정 내역에서 제외',
    (entity_change_history(s,'ingredient',i)#>>'{summary,count}')::bigint,0);
  set local role postgres;
  select public.entity_change_operation_json(x) || jsonb_build_object('source_type',x.source_type)
    into e from public.entity_change_events x
   where x.store_id=s and x.entity_type='ingredient' and x.entity_id=i
   order by x.occurred_at desc,x.id desc limit 1;
  perform pg_temp.ok('재료 최초 등록은 감사 원장에 종류와 실제 대상을 보존',e->>'operation'='create' and e->>'source_type'='direct'
    and e->>'operation_subject_type'='ingredient' and e->>'operation_subject_id'=i::text);
  perform pg_temp.as_owner(u);
  perform pg_temp.eq_t('최근 변경도 등록 종류 전달',last_entity_change(s,'ingredient',i)->>'operation','create');
  option_body:=jsonb_build_object('ingredient_id',i,'purchase_name','시험 링크','volume',1000,'amount',4000);
  option_id:=save_purchase_option(s,option_body);
  e:=entity_change_history(s,'ingredient',i)#>'{items,0}';
  perform pg_temp.ok('구매 링크는 재료 등록과 다른 대상',e->>'operation'='create'
    and e->>'operation_subject_type'='purchase_option' and e->>'operation_subject_id'=option_id::text);
  option_body:=option_body||jsonb_build_object('id',option_id,'expected_revision',
    (select edit_revision::text from purchase_options where id=option_id));
  n:=(entity_change_history(s,'ingredient',i)#>>'{summary,count}')::bigint;
  perform save_purchase_option(s,option_body);
  perform pg_temp.eq('구매 링크 무변경 기록 없음',(entity_change_history(s,'ingredient',i)#>>'{summary,count}')::bigint,n);
  perform save_purchase_option(s,option_body||'{"amount":4500}'::jsonb);
  perform pg_temp.eq_t('구매 링크 수정 종류',entity_change_history(s,'ingredient',i)#>>'{items,0,operation}','update');
  perform delete_purchase_option(option_id);
  e:=entity_change_history(s,'ingredient',i)#>'{items,0}';
  perform pg_temp.ok('구매 링크 삭제는 재료 삭제가 아님',e->>'operation'='delete'
    and e->>'operation_subject_type'='purchase_option' and e->>'operation_subject_id'=option_id::text);
  n:=(entity_change_history(s,'ingredient',i)#>>'{summary,count}')::bigint;
  perform delete_purchase_option(option_id);
  perform pg_temp.eq('구매 링크 반복 삭제 사건 없음',(entity_change_history(s,'ingredient',i)#>>'{summary,count}')::bigint,n);
  body:=jsonb_build_object('contract_version',2,'patch','create','request_id',gen_random_uuid()::text,
    'name','종류 시험 메뉴','price',12000,'base_servings',1,'target_profit_rate',30,
    'lines',jsonb_build_array(jsonb_build_object('ingredient_id',i,'input_qty',10)),'extras','[]'::jsonb);
  r:=save_recipe(s,body);
  perform pg_temp.eq('메뉴 최초 등록은 수정 내역에서 제외',
    (entity_change_history(s,'recipe',r)#>>'{summary,count}')::bigint,0);
  perform quick_inbound(s,i,1000,4000,1,null,store_local_date(s),gen_random_uuid()::text);
  e:=entity_change_history(s,'ingredient',i)#>'{items,0}';
  perform pg_temp.ok('입고 자동 출처와 재료 갱신 대상 유지',e->>'source_type'='inbound' and e->>'operation'='update'
    and e->>'operation_subject_type'='ingredient' and e->>'operation_subject_id'=i::text);
  e:=entity_change_history(s,'recipe',r)#>'{items,0}';
  perform pg_temp.ok('연계 메뉴 자동 갱신의 출처와 대상 유지',e->>'source_type'='ingredient' and e->>'operation'='update'
    and e->>'operation_subject_type'='recipe' and e->>'operation_subject_id'=r::text);
  body:=body||jsonb_build_object('patch','full','id',r,'expected_revision',recipe_detail(r)->'edit_revision',
    'request_id',gen_random_uuid()::text,'lines','[]'::jsonb);
  perform save_recipe(s,body);
  e:=entity_change_history(s,'recipe',r)#>'{items,0}';
  perform pg_temp.ok('메뉴의 재료 제거는 메뉴 수정',e->>'operation'='update' and e->>'operation_subject_type'='recipe'
    and e->>'operation_subject_id'=r::text);
  n:=(entity_change_history(s,'recipe',r)#>>'{summary,count}')::bigint;
  perform save_recipe(s,body);
  perform pg_temp.eq('동일 메뉴 요청은 사건 중복 없음',(entity_change_history(s,'recipe',r)#>>'{summary,count}')::bigint,n);
  rev:=recipe_detail(r)->>'edit_revision'; perform delete_recipe(s,r,rev); perform delete_recipe(s,r,rev);
  e:=entity_change_history(s,'recipe',r)#>'{items,0}';
  perform pg_temp.ok('메뉴 실제 삭제 한 번만 기록',e->>'operation'='delete' and e->>'operation_subject_type'='recipe'
    and (entity_change_history(s,'recipe',r)#>>'{summary,count}')::bigint=n+1);
  perform pg_temp.eq_t('삭제 최근 변경 종류',last_entity_change(s,'recipe',r)->>'operation','delete');
  n:=(entity_change_history(s,'ingredient',i)#>>'{summary,count}')::bigint;
  perform deactivate_ingredient(i); perform deactivate_ingredient(i);
  e:=entity_change_history(s,'ingredient',i)#>'{items,0}';
  perform pg_temp.ok('재료 실제 삭제 한 번만 기록',e->>'operation'='delete' and e->>'operation_subject_type'='ingredient'
    and (entity_change_history(s,'ingredient',i)#>>'{summary,count}')::bigint=n+1);
  h:=entity_change_history(s,'ingredient',i);
  perform pg_temp.ok('종류 분리 뒤 출처 합계 유지',(h#>>'{summary,count}')::bigint=
    (h#>>'{summary,direct_count}')::bigint+(h#>>'{summary,auto_count}')::bigint);

  fixed_month:='2034-02';
  perform save_fixed_costs(s,fixed_month,10000,'[{"key":"labor","mode":"detail","total":1000,"lines":[{"name":"직원1","amount":400},{"name":"직원2","amount":600}]}]');
  e:=store_configuration_history(s,'fixed_cost',fixed_month)#>'{items,0}';
  perform pg_temp.ok('월 고정 지출 첫 저장 대상',e->>'operation'='create' and e->>'source_type'='direct'
    and e->>'operation_subject_type'='fixed_cost' and e->>'operation_subject_id'=fixed_month);
  perform save_fixed_costs(s,fixed_month,10000,'[{"key":"labor","mode":"detail","total":600,"lines":[{"name":"직원2","amount":600}]}]');
  e:=store_configuration_history(s,'fixed_cost',fixed_month)#>'{items,0}';
  perform pg_temp.ok('월 지출 하위 행 삭제는 설정 수정',e->>'operation'='update' and e->>'operation_subject_type'='fixed_cost');
  n:=(store_configuration_history(s,'fixed_cost',fixed_month)->>'count')::bigint;
  perform save_fixed_costs(s,fixed_month,10000,'[{"key":"labor","mode":"detail","total":600,"lines":[{"name":"직원2","amount":600}]}]');
  perform pg_temp.eq('월 설정 무변경 중복 없음',(store_configuration_history(s,'fixed_cost',fixed_month)->>'count')::bigint,n);

  m:='{"country_code":"KR","region_code":null,"currency_code":"KRW","business_locale_code":"ko-KR","price_basis":"tax_inclusive"}';
  t:='{"default_treatment":"taxable","components":[{"key":"primary","kind":"primary","name":"부가세","rate_pct":10,"jurisdiction_level":"national","calculation_basis":"primary_tax_exclusive","applies_to_treatments":["taxable"],"sort_order":0,"remittance":{"hall":"merchant","delivery":"merchant","takeout":"merchant"}}],"categories":[]}';
  v:=save_tax_configuration(s,m,t,null,null,null,null);
  m:=jsonb_set(m,'{price_basis}','"tax_exclusive"');
  v:=save_tax_configuration(s,m,t,(v->>'market_profile_id')::uuid,(v->>'market_revision')::integer,(v->>'profile_id')::uuid,(v->>'revision')::integer);
  h:=store_configuration_history(s,'tax'); e:=h#>'{items,0}';
  perform pg_temp.ok('기존 세금의 새 프로필을 최초등록으로 추정하지 않음',e->>'operation' in ('unknown','update')
    and e->>'operation_subject_type'='tax' and e->>'source_type'='direct');

  -- Simulate old rows by inserting only the original schema fields, without metadata.
  set local role postgres;
  insert into entity_change_events(store_id,entity_type,entity_id,source_type,title,changes,occurred_at)
    values(s,'ingredient',i,'direct','제목으로 삭제 추정 금지','[{"key":"name","label":"이름","before":"A","after":"B"}]',clock_timestamp()) returning id into old_event;
  select to_jsonb(x) into old_row from entity_change_events x where id=old_event;
  perform pg_temp.as_owner(u);
  select x into e from jsonb_array_elements(entity_change_history(s,'ingredient',i)->'items') x
   where x->>'title'='제목으로 삭제 추정 금지';
  perform pg_temp.eq_t('과거 근거 없는 사건은 unknown',e->>'operation','unknown');
  perform pg_temp.ok('조회는 원본 사건을 덮어쓰지 않음',old_row=(select to_jsonb(x) from entity_change_events x where id=old_event));
  set local role postgres;
  insert into entity_change_events(store_id,entity_type,entity_id,source_type,title,changes,occurred_at)
    values(s,'ingredient',i,'direct','원래 제목','[{"key":"created","label":"등록","before":null,"after":"과거 등록","unit":null}]',clock_timestamp());
  insert into material_retirement_archive(id,store_id,source_material,source_extras,ingredient_id,disposition)
    values(archived,s,'{}','[]',i,'migrated');
  insert into store_configuration_changes(store_id,kind,source,before_value,after_value)
    values(s,'material','material',jsonb_build_object('material_id',archived,'name','옛 용기','active',true),
      jsonb_build_object('material_id',archived,'name','옛 용기','active',false)) returning id into c_id;
  perform pg_temp.as_owner(u);
  h:=entity_change_history(s,'ingredient',i);
  perform pg_temp.ok('과거 created 사건도 수정 내역에서 제외',not exists(
    select 1 from jsonb_array_elements(h->'items') x where x->>'title'='원래 제목'));
  e:=ingredient_legacy_material_history(s,i)#>'{items,0}';
  perform pg_temp.ok('통합 전 명시 비활성 전환은 원본 대상 삭제',e->>'operation'='delete'
    and e->>'operation_subject_type'='material' and e->>'operation_subject_id'=archived::text and e->>'source_type'='direct');
  perform pg_temp.ok('통합 전 최근 사건도 원본 대상 전달',last_entity_change(s,'ingredient',i)->>'operation_subject_id'=archived::text);
  perform pg_temp.ok('원본 설정 값과 ID 유지',e->>'id'=c_id::text and e#>>'{before_value,active}'='true' and e#>>'{after_value,active}'='false');
  set local role authenticated;
  h:=entity_change_history(s,'ingredient',i);
  perform pg_temp.ok('앱 역할 공개 조회도 최초 등록을 제외하고 종류를 보존',not exists(
    select 1 from jsonb_array_elements(h->'items') x where x->>'title'='원래 제목') and exists(
    select 1 from jsonb_array_elements(h->'items') x where x->>'title'='제목으로 삭제 추정 금지' and x->>'operation'='unknown'));
  perform pg_temp.raises('다른 매장 이력 차단',format('select entity_change_history(%L,''ingredient'',%L)',gen_random_uuid(),i),'42501');
  perform pg_temp.ok('앱의 원장 수정 차단',not has_table_privilege('authenticated','public.entity_change_events','UPDATE')
    and not has_table_privilege('authenticated','public.store_configuration_changes','UPDATE'));
  perform pg_temp.ok('새 기록 helper는 앱 직접 호출 불가',not has_function_privilege('authenticated',
    'public.record_entity_change_operation(uuid,text,uuid,public.change_source,text,text,text,text,jsonb,boolean,uuid,uuid,text)','EXECUTE'));
  perform pg_temp.ok('새 읽기 helper도 공개 RPC가 아님',not has_function_privilege('authenticated',
    'public.entity_change_operation_json(public.entity_change_events)','EXECUTE') and not has_function_privilege('authenticated',
    'public.configuration_change_operation_json(public.store_configuration_changes)','EXECUTE'));
end $test$;
