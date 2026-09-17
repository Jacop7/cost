-- 구매처 생성도 서버 반영 뒤 응답이 유실된 동일 제출을 기존 ID로 복구한다.
-- 매장별 잠금은 빈 목록에서 동시에 들어온 같은 이름 생성까지 직렬화한다.
begin;

do $patch$
declare
  d text;
  anchor text;
  replacement text;
  before_owner oid;
  before_acl aclitem[];
  before_config text[];
  before_definer boolean;
begin
  select proowner, proacl, proconfig, prosecdef
    into before_owner, before_acl, before_config, before_definer
    from pg_proc where oid = 'public.save_vendor(uuid,jsonb)'::regprocedure;
  d := replace(pg_get_functiondef('public.save_vendor(uuid,jsonb)'::regprocedure), chr(13), '');
  anchor := $anchor$  if exists (
    select 1
      from vendors$anchor$;
  replacement := $body$  if v_id is null then
    perform pg_advisory_xact_lock(hashtextextended(p_store::text || ':vendor-create', 0));
    select v.id into v_id
      from public.vendors v
     where v.store_id = p_store
       and not v.hidden
       and v.name = v_name
     order by v.id
     limit 1;
    if found then
      return v_id;
    end if;
  end if;

  if exists (
    select 1
      from vendors$body$;
  if (length(d) - length(replace(d, anchor, ''))) / length(anchor) <> 1 then
    raise exception '0014 save_vendor retry anchor must occur exactly once';
  end if;
  execute replace(d, anchor, replacement);
  if exists (
    select 1 from pg_proc where oid = 'public.save_vendor(uuid,jsonb)'::regprocedure
      and (proowner is distinct from before_owner or proacl is distinct from before_acl
        or proconfig is distinct from before_config or prosecdef is distinct from before_definer)
  ) then
    raise exception '0014 changed save_vendor ownership/config/ACL';
  end if;
end;
$patch$;

comment on function public.save_vendor(uuid,jsonb) is
  '구매처 생성·수정. 같은 이름·표기의 생성 재시도는 매장 잠금 뒤 기존 ID를 반환하고 수정 대상이 없으면 P0002다(0012·0014).';

commit;
