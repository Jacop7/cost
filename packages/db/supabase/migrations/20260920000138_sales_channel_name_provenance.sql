-- APP-215-SURFACE-AUDIT · 과거 판매 채널명 출처 보존
--
-- 0128 이전 판매에는 채널명 이력이 없었다. 0128은 현재 sales_channels.name을
-- snapshot 열에 이관했으므로 그 값을 판매 당시 이름이라고 단정할 수 없다.
-- 이 migration 적용 전에 만들어진 행은 보수적으로 upgrade_current_name으로 표시하고,
-- 이후 판매에서 직접 봉인한 이름만 sale_snapshot으로 표시한다.

begin;

alter table public.daily_sales_item_channel_quantities
  add column channel_name_origin text not null default 'upgrade_current_name'
  check (channel_name_origin in ('sale_snapshot','upgrade_current_name'));
alter table public.daily_sales_item_channel_quantities
  alter column channel_name_origin set default 'sale_snapshot';

alter table public.daily_sales_etc_lines
  add column channel_name_origin text not null default 'upgrade_current_name'
  check (channel_name_origin in ('sale_snapshot','upgrade_current_name'));
alter table public.daily_sales_etc_lines
  alter column channel_name_origin set default 'sale_snapshot';

comment on column public.daily_sales_item_channel_quantities.channel_name_origin is
  'sale_snapshot=판매 저장 시 봉인, upgrade_current_name=과거 이름 이력 부재로 이관 당시 현재 이름 사용';
comment on column public.daily_sales_etc_lines.channel_name_origin is
  'sale_snapshot=판매 저장 시 봉인, upgrade_current_name=과거 이름 이력 부재로 이관 당시 현재 이름 사용';

-- 세금 상세은 채널명을 실제 판매 snapshot으로 단정하지 않고 출처를 함께 반환한다.
do $patch$
declare
  v_def text;
  v_new text;
begin
  v_def:=replace(pg_get_functiondef('public.sales_tax_app_detail(uuid,date,date)'::regprocedure),chr(13),'');
  v_new:=v_def;

  v_new:=replace(v_new,
    $old$'sales_channel_name',s.channel_name_snapshot,$old$,
    $new$'sales_channel_name',s.channel_name_snapshot,
            'sales_channel_name_origin',coalesce((select q.channel_name_origin
              from public.daily_sales_item_channel_quantities q
              where q.daily_sales_item_id=s.daily_sales_item_id
                and q.sales_channel_id=s.sales_channel_id),'upgrade_current_name'),$new$);

  v_new:=replace(v_new,
    $old$else s.sales_channel_code::text end),
            'country_code'$old$,
    $new$else s.sales_channel_code::text end),
            'sales_channel_name_origin','upgrade_current_name',
            'country_code'$new$);

  v_new:=replace(v_new,
    $old$'sales_channel_name',e.channel_name_snapshot,$old$,
    $new$'sales_channel_name',e.channel_name_snapshot,
            'sales_channel_name_origin',e.channel_name_origin,$new$);

  v_new:=replace(v_new,
    $old$else coalesce(x.line->>'channel','채널 미지정') end),
            'country_code'$old$,
    $new$else coalesce(x.line->>'channel','채널 미지정') end),
            'sales_channel_name_origin','upgrade_current_name',
            'country_code'$new$);

  if v_new=v_def
     or (length(v_new)-length(replace(v_new,'''sales_channel_name_origin''',''))) /
        length('''sales_channel_name_origin''') <> 4 then
    raise exception '0138: 채널명 출처 네 경로를 모두 반영하지 못했습니다';
  end if;
  execute v_new;
end
$patch$;

comment on function public.sales_tax_app_detail(uuid,date,date) is
  '판매 시점 국제 세금 상세. 채널명과 sale_snapshot/upgrade_current_name 출처를 함께 반환한다.';

commit;
