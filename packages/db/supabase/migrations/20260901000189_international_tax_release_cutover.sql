-- 0189 · INTL-1F 국제 세금 제품 활성화
--
-- 계산·프로필·활성 경계를 모두 준비한 뒤 마지막으로 capability를 연다. 구 앱은
-- 판매·정정과 옛 세금 설정을 쓰지 못하고, 현재 앱만 새 프로필과 판매 snapshot을 쓴다.

begin;

create or replace function public.app_capabilities()
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'contract_version',1,
    'minimum_supported_app_version','0.2.0',
    'international_tax',jsonb_build_object(
      'contract_version','international_tax_v1',
      'read_enabled',true,
      'write_enabled',true,
      'minimum_write_app_version','0.2.0'))
$$;

-- 마이그레이션·시드·소유자 회귀시험은 HTTP 클라이언트가 아니다. request.headers가
-- 없는 postgres 세션만 예외로 두고, PostgREST(authenticator 세션)는 definer RPC 안에서도
-- 원래 session_user와 헤더를 보존하므로 같은 문에서 구 앱을 차단한다.
create or replace function public.assert_write_app_version()
returns void
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_minimum text:=public.app_capabilities()#>>'{international_tax,minimum_write_app_version}';
  v_actual text;
begin
  if session_user='postgres' and nullif(current_setting('request.headers',true),'') is null then
    return;
  end if;
  if v_minimum is null then return; end if;
  v_actual:=public.current_client_app_version();
  if not public.app_version_at_least(v_actual,v_minimum) then
    raise exception '최신 앱으로 업데이트한 뒤 다시 시도해 주세요'
      using errcode='45016',detail='CLIENT_UPGRADE_REQUIRED';
  end if;
end
$$;

-- 공개 판매 문 둘을 같은 판본 게이트로 묶는다. 함수 전체를 복사하지 않고 첫 매장
-- 경계 바로 뒤에 삽입하되, 기대 조각이 없으면 배포를 중단한다.
do $gate_sales$
declare v_def text;v_new text;
begin
  -- 과거 Windows 환경에서 적용된 함수는 본문 줄끝이 CRLF로 저장돼 있다. 치환 전에
  -- LF로 정규화해 새 DB와 기존 원격 DB가 같은 전진 경로를 타게 한다.
  v_def:=replace(pg_get_functiondef('public.save_sale(uuid,date,jsonb,jsonb,jsonb,integer,boolean,time without time zone)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    '  perform assert_my_store(p_store);'||chr(10)||chr(10)||'  v_ctx',
    '  perform assert_my_store(p_store);'||chr(10)||
    '  perform assert_write_app_version();'||chr(10)||chr(10)||'  v_ctx');
  if v_new=v_def then raise exception '0189: save_sale 판본 문 삽입 위치를 찾지 못했습니다'; end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.amend_ended_business_day(uuid,date,integer,jsonb,jsonb,jsonb,text)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    '  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄'||chr(10)||chr(10)||'  -- 보낸 것이',
    '  perform assert_my_store(p_store);   -- ⚠ 반드시 첫 줄'||chr(10)||
    '  perform assert_write_app_version();'||chr(10)||chr(10)||'  -- 보낸 것이');
  if v_new=v_def then raise exception '0189: amend_ended_business_day 판본 문 삽입 위치를 찾지 못했습니다'; end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.save_store_tax(uuid,tax_mode,jsonb,integer)'::regprocedure),chr(13),'');
  v_new:=replace(v_def,$old$  perform assert_my_store(p_store);$old$,$new$  perform assert_my_store(p_store);
  perform assert_write_app_version();
  raise exception '새 세금 설정 화면에서 저장해 주세요'
    using errcode='45017',detail='LEGACY_TAX_WRITE_DISABLED';$new$);
  if v_new=v_def then raise exception '0189: save_store_tax 폐쇄 위치를 찾지 못했습니다'; end if;
  execute v_new;
end
$gate_sales$;

-- capability를 열기 전에 준비된 프로필은 실제 제품 활성일을 아직 갖지 않는다.
-- 앞으로 생성되는 프로필은 0187 trigger가 같은 최소 앱 판본으로 경계를 만든다.
insert into public.international_tax_activation_boundaries(
  store_id,activation_date,minimum_app_version,reason)
select m.store_id,
       greatest(public.next_unopened_business_date(m.store_id),m.effective_from,t.effective_from),
       '0.2.0','release_cutover'
  from public.store_market_profiles m
  join public.store_tax_profiles t on t.store_id=m.store_id and t.market_profile_id=m.id
 where m.effective_to is null and t.effective_to is null
   and not exists(select 1 from public.international_tax_activation_boundaries b where b.store_id=m.store_id);

-- 기타매출도 메뉴 snapshot과 함께 조회한다. 과거 legacy 행은 구성 항목을 추정하지
-- 않고 etc_lines에서 빠지며 기존 합계 열은 그대로 보존된다.
create or replace function public.sales_tax_app_detail(p_store uuid,p_from date,p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.assert_my_store(p_store);
  if p_from is null or p_to is null or p_from>p_to then
    raise exception using errcode='22000',message='판매 세금 조회 기간이 올바르지 않아요',detail='INVALID_DATE_RANGE';
  end if;
  return jsonb_build_object(
    'capabilities',public.app_capabilities(),'from',p_from,'to',p_to,
    'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'daily_sales_item_id',s.daily_sales_item_id,'recipe_id',i.recipe_id,'menu_name',i.menu_name,
      'sale_date',d.sale_date,'unit_price',s.unit_price,'sales_channel_code',s.sales_channel_code,
      'country_code',s.country_code,'region_code',s.region_code,'currency_code',s.currency_code,
      'minor_unit',s.minor_unit,'price_basis',s.price_basis,'treatment',s.treatment,
      'tax_category',s.tax_category,'market_profile_id',s.market_profile_id,
      'market_profile_revision',s.market_profile_revision,'tax_profile_id',s.tax_profile_id,
      'tax_profile_revision',s.tax_profile_revision,'calculation_version',s.calculation_version,
      'final_quantity',s.final_quantity,'listed_total',s.listed_total,'net_sales',s.net_sales,
      'customer_total',s.customer_total,'tax_total',s.tax_total,
      'merchant_tax_liability',s.merchant_tax_liability,
      'marketplace_tax_liability',s.marketplace_tax_liability,
      'components',coalesce((select jsonb_agg(jsonb_build_object(
        'component_id',c.component_id_snapshot,'kind',c.kind,'name',c.name,
        'rate_pct',c.rate_pct,'jurisdiction_level',c.jurisdiction_level,
        'calculation_basis',c.calculation_basis,'applies_to_treatments',c.applies_to_treatments,
        'remittance_owner',c.remittance_owner,'unrounded_amount',c.unrounded_amount,
        'rounded_amount',c.rounded_amount) order by c.id)
        from public.daily_sales_item_tax_component_snapshots c
        where c.sales_tax_snapshot_id=s.id),'[]'::jsonb))
      order by d.sale_date,i.menu_name,s.sales_channel_code)
      from public.daily_sales_item_tax_snapshots s
      join public.daily_sales_items i on i.id=s.daily_sales_item_id and i.store_id=s.store_id
      join public.daily_sales d on d.id=i.daily_sales_id and d.store_id=i.store_id
      where s.store_id=p_store and d.sale_date between p_from and p_to),'[]'::jsonb),
    'etc_lines',coalesce((select jsonb_agg(jsonb_build_object(
      'daily_sales_id',d.id,'sale_date',d.sale_date,'name',coalesce(x.line->>'name','기타 매출'),
      'sales_channel_code',x.line->>'channel','country_code',d.etc_tax_snapshot->>'country_code',
      'region_code',d.etc_tax_snapshot->>'region_code','currency_code',d.etc_tax_snapshot->>'currency_code',
      'minor_unit',(d.etc_tax_snapshot->>'minor_unit')::integer,
      'price_basis',d.etc_tax_snapshot->>'price_basis','treatment',d.etc_tax_snapshot->>'treatment',
      'market_profile_revision',(d.etc_tax_snapshot->>'market_profile_revision')::integer,
      'tax_profile_revision',(d.etc_tax_snapshot->>'tax_profile_revision')::integer,
      'calculation_version',d.etc_tax_snapshot->>'calculation_version',
      'listed_total',(x.line#>>'{quote,listed_total}')::numeric,
      'net_sales',(x.line#>>'{quote,net_sales}')::numeric,
      'customer_total',(x.line#>>'{quote,customer_total}')::numeric,
      'tax_total',(x.line#>>'{quote,tax_total}')::numeric,
      'merchant_tax_liability',(x.line#>>'{quote,merchant_tax_liability}')::numeric,
      'marketplace_tax_liability',(x.line#>>'{quote,marketplace_tax_liability}')::numeric,
      'components',coalesce(x.line#>'{quote,components}','[]'::jsonb))
      order by d.sale_date,d.id,x.ord)
      from public.daily_sales d
      cross join lateral jsonb_array_elements(coalesce(d.etc_tax_snapshot->'lines','[]'::jsonb))
        with ordinality as x(line,ord)
      where d.store_id=p_store and d.sale_date between p_from and p_to
        and d.etc_tax_calculation_version='international_tax_v1'),'[]'::jsonb));
end
$$;

comment on function public.app_capabilities() is
  'INTL-1F 제품 활성 capability. 0.2.0부터 국제 세금 읽기·쓰기와 판매 snapshot을 사용한다.';
comment on function public.sales_tax_app_detail(uuid,date,date) is
  'INTL-1F 메뉴와 기타매출의 판매 시점 국제 세금 snapshot을 추정 없이 함께 반환한다.';

do $verify$
declare v_cap jsonb:=public.app_capabilities();v_fn text;
begin
  if v_cap#>>'{minimum_supported_app_version}'<>'0.2.0'
     or not (v_cap#>>'{international_tax,read_enabled}')::boolean
     or not (v_cap#>>'{international_tax,write_enabled}')::boolean
     or v_cap#>>'{international_tax,minimum_write_app_version}'<>'0.2.0' then
    raise exception '0189: 국제 세금 capability가 완전히 열리지 않았습니다';
  end if;
  foreach v_fn in array array['save_sale','amend_ended_business_day','save_store_tax'] loop
    if position('assert_write_app_version' in lower((select pg_get_functiondef(p.oid)
      from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=v_fn limit 1)))=0 then
      raise exception '0189: %에 앱 판본 문이 없습니다',v_fn;
    end if;
  end loop;
  if position('etc_lines' in lower(pg_get_functiondef(
       'public.sales_tax_app_detail(uuid,date,date)'::regprocedure)))=0 then
    raise exception '0189: 기타매출 세금 상세 계약이 없습니다';
  end if;
end
$verify$;

commit;
