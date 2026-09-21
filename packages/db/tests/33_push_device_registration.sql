-- 33 · 푸시 기기 등록 수명주기와 token 비노출 계약

do $t$
declare
  v_install uuid := gen_random_uuid();
  v_token text := 'ExponentPushToken[abcdefghijklmnopqrstuvwxyz123456]';
  v_other_token text := 'ExpoPushToken[ABCDEFGHIJKLMNOPQRSTUVWXYZ987654]';
  v_res jsonb;
  v_other uuid;
  v_other_store uuid;
  v_second_install uuid := gen_random_uuid();
begin
  v_res := push_device_registration_status(pg_temp.store(), v_install);
  perform pg_temp.ok('등록 전 상태는 false', not (v_res ->> 'registered')::boolean);

  v_res := register_push_device(pg_temp.store(), v_install, 'android', v_token, '0.2.0');
  perform pg_temp.ok('등록 결과는 활성이고 token 원문을 반환하지 않는다',
    (v_res ->> 'registered')::boolean and (v_res ->> 'active')::boolean
    and not (v_res ? 'expo_push_token') and length(v_res ->> 'fingerprint_suffix') = 12);
  set local role postgres;
  perform pg_temp.ok('서버 행은 현재 사용자·매장·설치에 결속된다', exists (
    select 1 from push_device_registrations d
     where d.installation_id = v_install and d.user_id = pg_temp.owner()
       and d.store_id = pg_temp.store() and d.active and d.expo_push_token = v_token
  ));
  set local role costkeep_rpc_executor;

  v_res := register_push_device(pg_temp.store(), v_install, 'android', v_other_token, '0.2.1');
  set local role postgres;
  perform pg_temp.ok('같은 설치의 token 교체는 행 추가 없이 갱신한다',
    (select count(*) = 1 and bool_and(expo_push_token = v_other_token and app_version = '0.2.1' and active)
       from push_device_registrations where installation_id = v_install));
  set local role costkeep_rpc_executor;

  v_res := register_push_device(pg_temp.store(), v_second_install, 'ios', v_other_token, '0.2.1');
  set local role postgres;
  perform pg_temp.ok('같은 token의 새 설치 등록은 이전 설치를 끄고 하나만 활성화한다',
    exists (select 1 from push_device_registrations where installation_id = v_install and not active)
    and exists (select 1 from push_device_registrations where installation_id = v_second_install and active)
    and (select count(*) from push_device_registrations where expo_push_token = v_other_token and active) = 1);
  set local role costkeep_rpc_executor;

  v_res := deactivate_push_device(pg_temp.store(), v_second_install);
  set local role postgres;
  perform pg_temp.ok('로그아웃 폐기는 활성 행을 끈다',
    (v_res ->> 'changed')::boolean and not (v_res ->> 'active')::boolean
    and exists (select 1 from push_device_registrations where installation_id = v_second_install and not active and revoked_at is not null));
  set local role costkeep_rpc_executor;
  v_res := deactivate_push_device(pg_temp.store(), v_second_install);
  perform pg_temp.ok('폐기는 멱등이다', not (v_res ->> 'changed')::boolean);

  v_other := pg_temp.new_owner();
  perform pg_temp.as_owner(v_other);
  v_other_store := (create_store('푸시 계정 전환 시험', 'Asia/Seoul')->>'store_id')::uuid;
  v_res := register_push_device(v_other_store, v_install, 'android', v_token, '0.2.2');
  perform pg_temp.ok('다른 계정이 같은 설치 ID를 등록하면 그 계정의 현재 설치가 된다',
    (v_res ->> 'registered')::boolean);
  perform pg_temp.raises('남의 매장에는 등록할 수 없다',
    format('select register_push_device(%L,%L,%L,%L,%L)', pg_temp.store(), v_install, 'ios', v_token, '0.2.0'), '42501');
  perform pg_temp.as_owner(pg_temp.owner());

  v_res := push_device_registration_status(pg_temp.store(), v_install);
  perform pg_temp.ok('계정 전환 뒤 이전 사용자의 상태 조회에는 등록되지 않은 설치다',
    not (v_res ->> 'registered')::boolean);
  v_res := deactivate_push_device(pg_temp.store(), v_install);
  set local role postgres;
  perform pg_temp.ok('보류 로그아웃 재시도는 새 계정에서도 같은 물리 설치를 폐기한다',
    (v_res ->> 'changed')::boolean
    and exists (select 1 from push_device_registrations where installation_id = v_install and not active));
  set local role costkeep_rpc_executor;

  perform pg_temp.raises('지원하지 않는 플랫폼을 거부한다',
    format('select register_push_device(%L,%L,%L,%L,%L)', pg_temp.store(), gen_random_uuid(), 'web', v_token, '0.2.0'), '22000');
  perform pg_temp.raises('잘못된 token을 거부한다',
    format('select register_push_device(%L,%L,%L,%L,%L)', pg_temp.store(), gen_random_uuid(), 'ios', 'not-a-token', '0.2.0'), '22000');
end $t$;

set local role authenticated;
do $t$
begin
  perform pg_temp.raises('authenticated는 token 테이블을 직접 읽을 수 없다',
    'select expo_push_token from public.push_device_registrations', '42501');
end $t$;
set local role costkeep_rpc_executor;

do $t$
begin
  perform pg_temp.ok('기기 RPC는 authenticated만 실행하고 token 테이블은 service 전용이다',
    has_function_privilege('authenticated', 'public.register_push_device(uuid,uuid,text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.push_device_registration_status(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.deactivate_push_device(uuid,uuid)', 'EXECUTE')
    and not has_table_privilege('authenticated', 'public.push_device_registrations', 'SELECT')
    and has_table_privilege('service_role', 'public.push_device_registrations', 'SELECT'));
end $t$;
