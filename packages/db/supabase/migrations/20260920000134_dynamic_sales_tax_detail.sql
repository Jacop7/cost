-- APP-215-SURFACE-AUDIT · 사용자 추가 판매 채널의 세금 상세 누락 보정
--
-- channel_storage_version=2 판매는 UUID 채널별 snapshot을 권위로 읽고,
-- 기존 판매는 legacy snapshot을 그대로 유지한다. 현재 채널 이름으로 과거를
-- 다시 쓰지 않도록 v2는 저장 당시 code/name snapshot을 반환한다.

begin;

-- 0130에서 이 trigger 함수를 비로그인 실행 역할 소유로 바꾸면서, 앱에 의도적으로
-- 닫힌 순수 계산 몸통을 호출할 수 없게 됐다. trigger 함수만 postgres definer로
-- 되돌리고 외부 EXECUTE 권한은 계속 costkeep_rpc_executor 한 역할에만 둔다.
alter function public.refresh_dynamic_sales_item_tax() owner to postgres;

create or replace function public.sales_tax_app_detail(p_store uuid,p_from date,p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $fn$
begin
  perform public.assert_my_store(p_store);
  if p_from is null or p_to is null or p_from>p_to then
    raise exception using errcode='22000',message='판매 세금 조회 기간이 올바르지 않아요',detail='INVALID_DATE_RANGE';
  end if;

  return jsonb_build_object(
    'capabilities',public.app_capabilities(),'from',p_from,'to',p_to,
    'lines',coalesce((
      with docs as (
        select d.sale_date,i.menu_name,s.channel_code_snapshot channel_code,
          jsonb_build_object(
            'daily_sales_item_id',s.daily_sales_item_id,'recipe_id',i.recipe_id,
            'menu_name',i.menu_name,'sale_date',d.sale_date,
            'unit_price',(s.input_snapshot->>'unit_price')::numeric,
            'sales_channel_id',s.sales_channel_id,
            'sales_channel_code',s.channel_code_snapshot,
            'sales_channel_name',s.channel_name_snapshot,
            'country_code',m.country_code,'region_code',m.region_code,
            'currency_code',m.currency_code,
            'minor_unit',public.international_currency_minor_unit(m.currency_code),
            'price_basis',m.price_basis,
            'treatment',s.input_snapshot->>'treatment',
            'tax_category',nullif(s.input_snapshot->>'tax_category',''),
            'market_profile_id',m.id,'market_profile_revision',m.revision,
            'tax_profile_id',t.id,'tax_profile_revision',t.revision,
            'calculation_version','international_tax_v1',
            'final_quantity',s.final_quantity,'listed_total',s.listed_total,
            'net_sales',s.net_sales,'customer_total',s.customer_total,
            'tax_total',s.tax_total,
            'merchant_tax_liability',s.merchant_tax_liability,
            'marketplace_tax_liability',s.marketplace_tax_liability,
            'components',coalesce(s.amount_snapshot->'components','[]'::jsonb)) doc
        from public.daily_sales_item_channel_tax_snapshots_v2 s
        join public.daily_sales_items i on i.id=s.daily_sales_item_id
        join public.daily_sales d on d.id=i.daily_sales_id and d.store_id=i.store_id
        join public.store_tax_profiles t
          on t.id=(s.input_snapshot->>'tax_profile_id')::uuid and t.store_id=d.store_id
        join public.store_market_profiles m on m.id=t.market_profile_id and m.store_id=t.store_id
        where d.store_id=p_store and d.sale_date between p_from and p_to
          and d.channel_storage_version=2
          and nullif(s.input_snapshot->>'tax_profile_id','') is not null

        union all

        select d.sale_date,i.menu_name,s.sales_channel_code::text,
          jsonb_build_object(
            'daily_sales_item_id',s.daily_sales_item_id,'recipe_id',i.recipe_id,
            'menu_name',i.menu_name,'sale_date',d.sale_date,'unit_price',s.unit_price,
            'sales_channel_id',c.id,'sales_channel_code',s.sales_channel_code,
            'sales_channel_name',coalesce(c.name,case s.sales_channel_code::text
              when 'hall' then '매장' when 'delivery' then '배달' when 'takeout' then '포장'
              else s.sales_channel_code::text end),
            'country_code',s.country_code,'region_code',s.region_code,
            'currency_code',s.currency_code,'minor_unit',s.minor_unit,
            'price_basis',s.price_basis,'treatment',s.treatment,
            'tax_category',s.tax_category,'market_profile_id',s.market_profile_id,
            'market_profile_revision',s.market_profile_revision,
            'tax_profile_id',s.tax_profile_id,'tax_profile_revision',s.tax_profile_revision,
            'calculation_version',s.calculation_version,
            'final_quantity',s.final_quantity,'listed_total',s.listed_total,
            'net_sales',s.net_sales,'customer_total',s.customer_total,
            'tax_total',s.tax_total,'merchant_tax_liability',s.merchant_tax_liability,
            'marketplace_tax_liability',s.marketplace_tax_liability,
            'components',coalesce((select jsonb_agg(jsonb_build_object(
              'component_id',x.component_id_snapshot,'kind',x.kind,'name',x.name,
              'rate_pct',x.rate_pct,'jurisdiction_level',x.jurisdiction_level,
              'calculation_basis',x.calculation_basis,
              'applies_to_treatments',x.applies_to_treatments,
              'remittance_owner',x.remittance_owner,
              'unrounded_amount',x.unrounded_amount,'rounded_amount',x.rounded_amount)
              order by x.id)
              from public.daily_sales_item_tax_component_snapshots x
              where x.sales_tax_snapshot_id=s.id),'[]'::jsonb)) doc
        from public.daily_sales_item_tax_snapshots s
        join public.daily_sales_items i on i.id=s.daily_sales_item_id and i.store_id=s.store_id
        join public.daily_sales d on d.id=i.daily_sales_id and d.store_id=i.store_id
        left join public.sales_channels c
          on c.store_id=s.store_id and c.code=s.sales_channel_code::text
        where s.store_id=p_store and d.sale_date between p_from and p_to
          and not exists (
            select 1 from public.daily_sales_item_channel_tax_snapshots_v2 v2
            where v2.daily_sales_item_id=s.daily_sales_item_id
              and nullif(v2.input_snapshot->>'tax_profile_id','') is not null)
      )
      select jsonb_agg(doc order by sale_date,menu_name,channel_code) from docs
    ),'[]'::jsonb),
    'etc_lines',coalesce((
      with docs as (
        select d.sale_date,d.id daily_sales_id,e.created_at,e.id::text line_id,
          jsonb_build_object(
            'daily_sales_id',d.id,'sale_date',d.sale_date,'name',e.name_snapshot,
            'sales_channel_id',e.sales_channel_id,
            'sales_channel_code',e.channel_code_snapshot,
            'sales_channel_name',e.channel_name_snapshot,
            'country_code',m.country_code,'region_code',m.region_code,
            'currency_code',m.currency_code,
            'minor_unit',public.international_currency_minor_unit(m.currency_code),
            'price_basis',m.price_basis,'treatment',d.etc_tax_snapshot->>'treatment',
            'market_profile_revision',m.revision,'tax_profile_revision',t.revision,
            'calculation_version','international_tax_v1',
            'listed_total',(e.tax_snapshot->>'listed_total')::numeric,
            'net_sales',(e.tax_snapshot->>'net_sales')::numeric,
            'customer_total',(e.tax_snapshot->>'customer_total')::numeric,
            'tax_total',(e.tax_snapshot->>'tax_total')::numeric,
            'merchant_tax_liability',coalesce((e.tax_snapshot->>'merchant_tax_liability')::numeric,0),
            'marketplace_tax_liability',coalesce((e.tax_snapshot->>'marketplace_tax_liability')::numeric,0),
            'components',coalesce(e.tax_snapshot->'components','[]'::jsonb)) doc
        from public.daily_sales d
        join public.daily_sales_etc_lines e on e.daily_sales_id=d.id and e.store_id=d.store_id
        join public.store_tax_profiles t
          on t.id=(d.etc_tax_snapshot->>'tax_profile_id')::uuid and t.store_id=d.store_id
        join public.store_market_profiles m on m.id=t.market_profile_id and m.store_id=t.store_id
        where d.store_id=p_store and d.sale_date between p_from and p_to
          and d.channel_storage_version=2 and e.tax_snapshot is not null
          and nullif(d.etc_tax_snapshot->>'tax_profile_id','') is not null

        union all

        select d.sale_date,d.id,d.created_at,(x.ord::text||'-'||d.id::text) line_id,
          jsonb_build_object(
            'daily_sales_id',d.id,'sale_date',d.sale_date,
            'name',coalesce(x.line->>'name','기타 매출'),
            'sales_channel_id',c.id,'sales_channel_code',x.line->>'channel',
            'sales_channel_name',coalesce(c.name,case x.line->>'channel'
              when 'hall' then '매장' when 'delivery' then '배달' when 'takeout' then '포장'
              else coalesce(x.line->>'channel','채널 미지정') end),
            'country_code',d.etc_tax_snapshot->>'country_code',
            'region_code',d.etc_tax_snapshot->>'region_code',
            'currency_code',d.etc_tax_snapshot->>'currency_code',
            'minor_unit',(d.etc_tax_snapshot->>'minor_unit')::integer,
            'price_basis',d.etc_tax_snapshot->>'price_basis',
            'treatment',d.etc_tax_snapshot->>'treatment',
            'market_profile_revision',(d.etc_tax_snapshot->>'market_profile_revision')::integer,
            'tax_profile_revision',(d.etc_tax_snapshot->>'tax_profile_revision')::integer,
            'calculation_version',d.etc_tax_snapshot->>'calculation_version',
            'listed_total',(x.line#>>'{quote,listed_total}')::numeric,
            'net_sales',(x.line#>>'{quote,net_sales}')::numeric,
            'customer_total',(x.line#>>'{quote,customer_total}')::numeric,
            'tax_total',(x.line#>>'{quote,tax_total}')::numeric,
            'merchant_tax_liability',(x.line#>>'{quote,merchant_tax_liability}')::numeric,
            'marketplace_tax_liability',(x.line#>>'{quote,marketplace_tax_liability}')::numeric,
            'components',coalesce(x.line#>'{quote,components}','[]'::jsonb)) doc
        from public.daily_sales d
        cross join lateral jsonb_array_elements(coalesce(d.etc_tax_snapshot->'lines','[]'::jsonb))
          with ordinality as x(line,ord)
        left join public.sales_channels c
          on c.store_id=d.store_id and c.code=x.line->>'channel'
        where d.store_id=p_store and d.sale_date between p_from and p_to
          and d.etc_tax_calculation_version='international_tax_v1'
          and not exists (
            select 1 from public.daily_sales_etc_lines e2
            where e2.daily_sales_id=d.id and e2.tax_snapshot is not null)
      )
      select jsonb_agg(doc order by sale_date,daily_sales_id,created_at,line_id) from docs
    ),'[]'::jsonb));
end
$fn$;

revoke execute on function public.sales_tax_app_detail(uuid,date,date) from public,anon;
grant execute on function public.sales_tax_app_detail(uuid,date,date) to authenticated,service_role;

comment on function public.sales_tax_app_detail(uuid,date,date) is
  '판매 시점 국제 세금 상세. v2는 UUID 채널 code/name snapshot, legacy는 기존 고정 채널 snapshot을 반환한다.';

do $verify$
begin
  if position('daily_sales_item_channel_tax_snapshots_v2' in lower(pg_get_functiondef(
       'public.sales_tax_app_detail(uuid,date,date)'::regprocedure)))=0
     or position('daily_sales_etc_lines' in lower(pg_get_functiondef(
       'public.sales_tax_app_detail(uuid,date,date)'::regprocedure)))=0 then
    raise exception '0134: 동적 채널 세금 상세 읽기 계약이 없습니다';
  end if;
end
$verify$;

commit;
