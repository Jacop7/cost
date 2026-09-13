-- 묶음 단위 facade도 다른 executor 소유 함수와 같은 고정 search_path를 사용한다.
-- 함수 본문·소유자·실행 권한은 바꾸지 않는다.

begin;

alter function public.get_bundle_units(uuid)
  set search_path = public, pg_temp;
alter function public.save_bundle_unit(uuid,uuid,text,integer,integer,text)
  set search_path = public, pg_temp;
alter function public.delete_bundle_unit(uuid,uuid,integer)
  set search_path = public, pg_temp;

do $assert_bundle_unit_search_path$
declare
  v_invalid integer;
begin
  select count(*) into v_invalid
    from pg_proc p
   where p.oid in (
     'public.get_bundle_units(uuid)'::regprocedure,
     'public.save_bundle_unit(uuid,uuid,text,integer,integer,text)'::regprocedure,
     'public.delete_bundle_unit(uuid,uuid,integer)'::regprocedure)
     and not coalesce(p.proconfig, '{}'::text[])
       @> array['search_path=public, pg_temp'];
  if v_invalid <> 0 then
    raise exception '0241: 묶음 단위 RPC search_path 고정에 실패했습니다';
  end if;
end;
$assert_bundle_unit_search_path$;

commit;
