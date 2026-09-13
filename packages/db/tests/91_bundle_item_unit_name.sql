set local role postgres;
do $test$
declare u uuid:=gen_random_uuid(); s uuid; id uuid:=gen_random_uuid(); b jsonb;
begin
  insert into auth.users(id) values(u); perform pg_temp.as_owner(u);
  s:=(public.create_store('낱개 단위 시험','Asia/Seoul')->>'store_id')::uuid;
  b:=public.save_bundle_unit(s,id,'판',30,0,' 모 ');
  perform pg_temp.ok('낱개 이름 저장·정규화',b->>'item_unit_name'='모' and public.get_bundle_units(s)->0->>'item_unit_name'='모');
  b:=public.save_bundle_unit(s,id,'판',30,0,'모');
  perform pg_temp.ok('생성 재시도 낱개 이름 포함',b->>'changed'='false');
  b:=public.save_bundle_unit(s,id,'판',30,1);
  perform pg_temp.ok('옛 클라이언트는 기존 낱개 이름 보존',b->>'item_unit_name'='모' and b->>'changed'='false');
  b:=public.save_bundle_unit(s,id,'판',30,1,'장');
  perform pg_temp.ok('이름만 바꿔도 판본 증가·수량 보존',b->>'revision'='2' and b->>'quantity'='30' and b->>'item_unit_name'='장');
  begin perform public.save_bundle_unit(s,id,'판',30,1,'병'); raise exception 'FAIL stale'; exception when sqlstate '45009' then null; end;
  begin perform public.save_bundle_unit(s,id,'판',30,2,' '); raise exception 'FAIL blank'; exception when sqlstate '22000' then null; end;
  begin perform public.save_bundle_unit(s,id,'판',30,2,repeat('모',21)); raise exception 'FAIL long'; exception when sqlstate '22000' then null; end;
  begin perform public.save_bundle_unit(s,id,'판',30,2,E'모\n'); raise exception 'FAIL control'; exception when sqlstate '22000' then null; end;
  perform pg_temp.ok('오래된 판본·잘못된 낱개명 차단',true);
  b:=public.save_bundle_unit(s,gen_random_uuid(),'박스',20,0);
  perform pg_temp.ok('옛 신규 호출 기본은 개',b->>'item_unit_name'='개');
  perform pg_temp.ok('단일 save facade 유지',(select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_bundle_unit'));
  perform pg_temp.ok('낱개명 facade 익명 접근 차단',not has_function_privilege('anon','public.save_bundle_unit(uuid,uuid,text,integer,integer,text)','execute'));
end $test$;
