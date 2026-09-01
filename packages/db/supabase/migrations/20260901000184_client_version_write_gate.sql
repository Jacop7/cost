-- 0184 · INTL-1F 클라이언트 판본 전달과 구 앱 쓰기 차단 기반
--
-- 이 migration은 헤더를 읽고 판본을 비교하는 내부 몸통만 추가한다.
-- minimum_write_app_version은 아직 null이고 capability도 false/false라 실제 쓰기 경로는 바뀌지 않는다.

begin;

create or replace function public.current_client_app_version()
returns text
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_headers jsonb;
  v_version text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;
  v_version := nullif(btrim(v_headers->>'x-margincook-app-version'), '');
  if v_version is null or v_version !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' then
    return null;
  end if;
  return v_version;
end
$$;

create or replace function public.app_version_at_least(p_actual text, p_minimum text)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = pg_catalog
as $$
declare
  v_actual text[];
  v_minimum text[];
begin
  if p_actual is null or p_minimum is null
     or p_actual !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
     or p_minimum !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' then
    return false;
  end if;
  v_actual := string_to_array(p_actual, '.');
  v_minimum := string_to_array(p_minimum, '.');
  return row(v_actual[1]::numeric, v_actual[2]::numeric, v_actual[3]::numeric)
      >= row(v_minimum[1]::numeric, v_minimum[2]::numeric, v_minimum[3]::numeric);
exception when numeric_value_out_of_range or invalid_text_representation then
  return false;
end
$$;

create or replace function public.assert_write_app_version()
returns void
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_minimum text := public.app_capabilities()#>>'{international_tax,minimum_write_app_version}';
  v_actual text;
begin
  if v_minimum is null then
    return;
  end if;
  v_actual := public.current_client_app_version();
  if not public.app_version_at_least(v_actual, v_minimum) then
    raise exception '최신 앱으로 업데이트한 뒤 다시 시도해 주세요'
      using errcode='45016', detail='CLIENT_UPGRADE_REQUIRED';
  end if;
end
$$;

revoke execute on function public.current_client_app_version() from public, anon, authenticated, service_role;
revoke execute on function public.app_version_at_least(text,text) from public, anon, authenticated, service_role;
revoke execute on function public.assert_write_app_version() from public, anon, authenticated, service_role;

comment on function public.current_client_app_version() is
  'PostgREST request.headers의 x-margincook-app-version을 읽는 내부 경계. 형식이 없거나 틀리면 null이다.';
comment on function public.app_version_at_least(text,text) is
  '세 자리 십진 semver의 major/minor/patch를 비교하는 내부 함수. 잘못된 입력은 false다.';
comment on function public.assert_write_app_version() is
  'app_capabilities의 국제 세금 최소 쓰기 판본이 설정된 뒤 구 앱 쓰기를 45016으로 실패 폐쇄하는 내부 문.';

do $verify$
declare v_cap jsonb:=public.app_capabilities();
begin
  if (v_cap#>>'{international_tax,read_enabled}')::boolean
     or (v_cap#>>'{international_tax,write_enabled}')::boolean
     or v_cap#>'{international_tax,minimum_write_app_version}' <> 'null'::jsonb then
    raise exception '0184: 판본 전달 기반 단계에서 capability나 최소 쓰기 판본을 바꿨습니다';
  end if;
  if not public.app_version_at_least('0.2.0','0.1.9')
     or public.app_version_at_least('0.1.9','0.2.0')
     or public.app_version_at_least('1.0','0.1.0') then
    raise exception '0184: 앱 판본 비교 계약이 맞지 않습니다';
  end if;
  if has_function_privilege('authenticated','public.current_client_app_version()','execute')
     or has_function_privilege('authenticated','public.app_version_at_least(text,text)','execute')
     or has_function_privilege('authenticated','public.assert_write_app_version()','execute')
     or has_function_privilege('service_role','public.assert_write_app_version()','execute') then
    raise exception '0184: 클라이언트 판본 내부 함수가 앱 역할에 열렸습니다';
  end if;
end
$verify$;

commit;
