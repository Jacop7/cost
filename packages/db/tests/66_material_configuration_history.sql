set local role postgres;
do $test$
declare u uuid:=gen_random_uuid(); s uuid; m uuid; h jsonb; payload jsonb; n bigint; i integer; day_id uuid;
begin
  insert into auth.users(id) values(u);
  perform pg_temp.as_owner(u);
  s:=(public.create_store('부자재 수정 내역 시험','Asia/Seoul')->>'store_id')::uuid;
  payload:='{"name":"포장용기","unit_cost":300,"unit_label":"개","memo":"첫 메모"}';
  m:=public.save_material(s,payload);
  perform pg_temp.ok('등록을 가짜 수정 이력으로 만들지 않는다',public.store_configuration_history(s,'material')->>'count'='0');
  payload:=payload||jsonb_build_object('id',m,'unit_cost',450,'memo','새 메모');
  perform public.save_material(s,payload);
  h:=public.store_configuration_history(s,'material');
  perform pg_temp.ok('서버 시각과 부자재 단가·메모 전후 값을 보존한다',
    h->>'count'='1' and h#>>'{items,0,before_value,unit_cost}'='300'
    and h#>>'{items,0,after_value,unit_cost}'='450' and h#>>'{items,0,before_value,memo}'='첫 메모'
    and h#>>'{items,0,after_value,memo}'='새 메모' and h#>>'{items,0,application_mode}'='immediate'
    and h#>>'{items,0,occurred_at}' is not null);
  perform public.save_material(s,payload);
  perform pg_temp.ok('무변경 저장은 이력을 늘리지 않는다',public.store_configuration_history(s,'material')->>'count'='1');
  set local role postgres;
  insert into public.business_days(store_id,business_date,status,planned_close_at,snapshot)
    values(s,public.store_local_date(s),'open',clock_timestamp()+interval '1 hour','{}') returning id into day_id;
  perform pg_temp.as_owner(u);
  payload:=payload||'{"unit_cost":500}'; perform public.save_material(s,payload);
  perform pg_temp.ok('영업 중 단가 변경은 종료 후 적용으로 기록한다',public.store_configuration_history(s,'material')#>>'{items,0,application_mode}'='next_business');
  set local role postgres; update public.business_days set status='break' where id=day_id; perform pg_temp.as_owner(u);
  payload:=payload||'{"unit_cost":550}'; perform public.save_material(s,payload);
  perform pg_temp.ok('브레이크 중 단가 변경도 종료 후 적용으로 기록한다',public.store_configuration_history(s,'material')#>>'{items,0,application_mode}'='next_business');
  payload:=payload||'{"name":"새 용기"}'; perform public.save_material(s,payload);
  perform pg_temp.ok('이름만 수정하면 즉시 반영이며 이전 이름을 보존한다',
    public.store_configuration_history(s,'material')#>>'{items,0,application_mode}'='immediate'
    and public.store_configuration_history(s,'material')#>>'{items,0,before_value,name}'='포장용기');
  for i in 1..21 loop payload:=payload||jsonb_build_object('memo','메모 '||i); perform public.save_material(s,payload); end loop;
  h:=public.store_configuration_history(s,'material'); n:=(h->>'count')::bigint;
  perform pg_temp.ok('20건 페이지와 커서를 반환한다',jsonb_array_length(h->'items')=20 and h->>'next_cursor' is not null);
  h:=public.store_configuration_history(s,'material',null,h->>'next_cursor');
  perform pg_temp.ok('다음 페이지는 나머지를 중복 없이 반환한다',jsonb_array_length(h->'items')=n-20 and h->>'next_cursor' is null);
  perform public.deactivate_material(m);
  h:=public.store_configuration_history(s,'material');
  perform pg_temp.ok('삭제 후에도 이름과 사용 상태 전후를 보존한다',h#>>'{items,0,after_value,name}'='새 용기'
    and h#>>'{items,0,before_value,active}'='true' and h#>>'{items,0,after_value,active}'='false');
  perform pg_temp.as_owner(pg_temp.owner());
  perform pg_temp.raises('다른 매장 부자재 이력 조회를 차단한다',format('select public.store_configuration_history(%L::uuid,''material'')',s),'42501');
  perform pg_temp.ok('앱에서 이력과 트리거를 직접 조작할 수 없다',
    not has_table_privilege('authenticated','public.store_configuration_changes','INSERT')
    and not has_table_privilege('authenticated','public.store_configuration_changes','UPDATE')
    and not has_table_privilege('authenticated','public.store_configuration_changes','DELETE')
    and not has_function_privilege('authenticated','public.record_material_configuration_change()','EXECUTE'));
end $test$;
