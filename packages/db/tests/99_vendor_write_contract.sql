-- 구매처 저장 공개 계약. 수정 대상은 반드시 요청 매장에 실제로 존재해야 하며,
-- 다른 매장의 ID나 이미 사라진 ID를 성공한 것처럼 되돌려주면 안 된다.
do $test$
declare
  v_store uuid := pg_temp.store();
  v_foreign_owner uuid := pg_temp.new_owner();
  v_foreign_store uuid;
  v_foreign_vendor uuid;
  v_foreign_name text;
  v_missing uuid := gen_random_uuid();
  v_created uuid;
  v_updated uuid;
  v_replayed uuid;
  v_count bigint;
begin
  set local role postgres;
  insert into public.stores (owner_id, name)
  values (v_foreign_owner, '구매처 경계 시험 매장')
  returning id into v_foreign_store;

  insert into public.vendors (store_id, name)
  values (v_foreign_store, '남의 구매처')
  returning id into v_foreign_vendor;
  set local role costkeep_rpc_executor;

  perform pg_temp.raises(
    '존재하지 않는 구매처 ID 수정은 성공으로 위장하지 않음',
    format(
      'select public.save_vendor(%L,%L::jsonb)',
      v_store,
      jsonb_build_object('id', v_missing, 'name', '없는 구매처 수정')
    ),
    'P0002'
  );

  perform pg_temp.raises(
    '다른 매장의 구매처 ID 수정은 성공으로 위장하지 않음',
    format(
      'select public.save_vendor(%L,%L::jsonb)',
      v_store,
      jsonb_build_object('id', v_foreign_vendor, 'name', '경계 침범')
    ),
    'P0002'
  );

  set local role postgres;
  select name into v_foreign_name from public.vendors where id = v_foreign_vendor;
  set local role costkeep_rpc_executor;
  perform pg_temp.eq_t(
    '다른 매장의 구매처 이름은 바뀌지 않음',
    v_foreign_name,
    '남의 구매처'
  );

  v_created := public.save_vendor(v_store, jsonb_build_object('name', 'Vendor Retry'));
  select count(*) into v_count from public.vendors where store_id = v_store and name = 'Vendor Retry';
  v_replayed := public.save_vendor(v_store, jsonb_build_object('name', 'Vendor Retry'));
  perform pg_temp.eq_t('같은 구매처 등록 재시도는 기존 ID 반환', v_replayed::text, v_created::text);
  perform pg_temp.eq(
    '같은 구매처 등록 재시도는 행을 늘리지 않음',
    (select count(*) from public.vendors where store_id = v_store and name = 'Vendor Retry'),
    v_count
  );
  perform pg_temp.raises(
    '대소문자만 다른 구매처 등록은 기존 중복 규칙으로 거절',
    format('select public.save_vendor(%L,%L::jsonb)', v_store, jsonb_build_object('name', 'vendor retry')),
    '23505'
  );
  perform pg_temp.eq_t(
    '정상 생성은 요청 매장에 저장됨',
    (select name from public.vendors where id = v_created and store_id = v_store),
    'Vendor Retry'
  );

  v_updated := public.save_vendor(
    v_store,
    jsonb_build_object('id', v_created, 'name', '수정 구매처')
  );
  perform pg_temp.eq_t(
    '정상 수정은 같은 ID를 반환하고 이름을 변경함',
    v_updated::text || ':' || (select name from public.vendors where id = v_created),
    v_created::text || ':수정 구매처'
  );

  perform public.delete_vendor(v_created);
  perform pg_temp.ok(
    '내 매장의 미사용 구매처는 삭제됨',
    not exists (select 1 from public.vendors where id = v_created)
  );
end $test$;
