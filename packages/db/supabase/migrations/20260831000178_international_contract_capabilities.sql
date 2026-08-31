-- 0178 · 국제 출시의 계약·capability 기준선만 먼저 배포한다.
--
-- 현행 tax_of()/save_store_tax()/판매·손익 계산은 0090의 유효 세율 계약을 그대로 쓴다.
-- 국제 세금 읽기·쓰기는 둘 다 false이며, 이 migration은 시장/세금 프로필이나 금액 원장을 만들지 않는다.

begin;

create or replace function public.app_capabilities()
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'contract_version', 1,
    'minimum_supported_app_version', '0.1.0',
    'international_tax', jsonb_build_object(
      'contract_version', 'international_tax_v1',
      'read_enabled', false,
      'write_enabled', false,
      'minimum_write_app_version', null
    )
  )
$$;

revoke execute on function public.app_capabilities() from public, anon;
grant execute on function public.app_capabilities() to authenticated, service_role;

comment on function public.app_capabilities() is
  '앱 계약 기준선. 0178에서는 국제 세금 읽기·쓰기를 활성화하지 않고 최소 지원 앱 버전만 공개한다.';

do $verify$
declare v jsonb := public.app_capabilities();
begin
  if v is distinct from jsonb_build_object(
    'contract_version', 1,
    'minimum_supported_app_version', '0.1.0',
    'international_tax', jsonb_build_object(
      'contract_version', 'international_tax_v1',
      'read_enabled', false,
      'write_enabled', false,
      'minimum_write_app_version', null
    )
  ) then
    raise exception '0178: 앱 capability 응답 계약이 다릅니다';
  end if;

  if has_function_privilege('anon', 'public.app_capabilities()', 'execute')
     or not has_function_privilege('authenticated', 'public.app_capabilities()', 'execute')
     or not has_function_privilege('service_role', 'public.app_capabilities()', 'execute') then
    raise exception '0178: app_capabilities 실행 권한이 맞지 않습니다';
  end if;
end;
$verify$;

commit;
