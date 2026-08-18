-- ════════════════════════════════════════════════════════════════
-- 0036 · 레시피 카테고리 · 부자재 마스터
--
-- 화면에는 세 종류의 분류가 있는데(식재료 · 레시피 · 부자재) DB 에는 식재료 것만 있었다.
-- 레시피 카테고리는 화면 지역 상태였고, 부자재는 마스터가 아예 없어
-- 레시피마다 이름·금액을 손으로 다시 적어야 했다 — 같은 포장용기의 단가가 메뉴마다 달라진다.
--
-- 분류는 종류(kind)만 다를 뿐 구조가 같으므로 `categories` 를 확장한다.
-- 부자재는 마스터 테이블을 두고, 레시피의 부가 원가가 그것을 참조하게 한다.
-- ════════════════════════════════════════════════════════════════

do $$ begin
  create type category_kind as enum ('ingredient', 'recipe', 'material');
exception when duplicate_object then null;
end $$;

alter table categories
  add column if not exists kind category_kind not null default 'ingredient';

-- 이름 중복은 **종류 안에서만** 막는다. '소스·양념'이 부자재에도 레시피에도 있을 수 있다.
drop index if exists categories_store_name_uk;
create unique index if not exists categories_store_kind_name_uk
  on categories (store_id, kind, lower(btrim(name)));

alter table recipes
  add column if not exists category_id uuid references categories(id) on delete set null;

-- ── 부자재 마스터 ─────────────────────────────────────────────
create table if not exists materials (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references stores(id) on delete cascade,
  name        text not null,
  category_id uuid references categories(id) on delete set null,
  -- 개당 단가(원). 박스로 사도 화면이 낱개로 환산해 넣는다(절대원칙 1).
  unit_cost   numeric not null default 0 check (unit_cost >= 0),
  unit_label  text not null default '개',
  memo        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists materials_store_name_uk
  on materials (store_id, lower(btrim(name))) where active;

alter table materials enable row level security;

drop policy if exists materials_select on materials;
create policy materials_select on materials for select using (store_id in (select my_store_ids()));
drop policy if exists materials_insert on materials;
create policy materials_insert on materials for insert with check (store_id in (select my_store_ids()));
drop policy if exists materials_update on materials;
create policy materials_update on materials for update using (store_id in (select my_store_ids()));
drop policy if exists materials_delete on materials;
create policy materials_delete on materials for delete using (store_id in (select my_store_ids()));

-- 레시피의 부가 원가가 마스터를 가리킬 수 있게 한다.
-- 마스터를 지워도 과거 레시피의 이름·금액은 남아야 하므로 set null 이다.
alter table recipe_extra_costs
  add column if not exists material_id uuid references materials(id) on delete set null,
  add column if not exists qty numeric not null default 1 check (qty >= 0);

-- ── 저장 API ──────────────────────────────────────────────────
create or replace function public.save_category(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare
  v_id   uuid := nullif(p_payload->>'id','')::uuid;
  v_name text := btrim(p_payload->>'name');
  v_kind category_kind := coalesce((p_payload->>'kind')::category_kind, 'ingredient');
begin
  perform assert_my_store(p_store);
  if v_name is null or v_name = '' then
    raise exception '카테고리 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if exists (select 1 from categories
              where store_id = p_store and kind = v_kind and lower(btrim(name)) = lower(v_name)
                and (v_id is null or id <> v_id)) then
    raise exception '이미 같은 이름의 카테고리가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into categories (store_id, name, kind, sort_order, default_loss_rate)
    values (p_store, v_name, v_kind,
            coalesce((p_payload->>'sort_order')::int,
                     (select coalesce(max(sort_order), 0) + 1 from categories where store_id = p_store and kind = v_kind)),
            coalesce((p_payload->>'default_loss_rate')::numeric, 0))
    returning id into v_id;
  else
    update categories set
      name = v_name,
      sort_order = coalesce((p_payload->>'sort_order')::int, sort_order),
      default_loss_rate = coalesce((p_payload->>'default_loss_rate')::numeric, default_loss_rate)
    where id = v_id and store_id = p_store;
    if not found then
      raise exception '카테고리를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$fn$;

-- 쓰이는 곳이 있으면 못 지운다. 종류마다 참조하는 테이블이 다르다.
create or replace function public.delete_category(p_id uuid)
returns void language plpgsql security invoker as $fn$
declare v_kind category_kind; v_used int;
begin
  select kind into v_kind from categories where id = p_id;
  if v_kind is null then return; end if;

  if v_kind = 'ingredient' then
    select count(*) into v_used from ingredients where category_id = p_id and active;
    if v_used > 0 then
      raise exception '이 카테고리를 쓰는 식재료가 %개 있어요', v_used using errcode = '23503';
    end if;
  elsif v_kind = 'recipe' then
    select count(*) into v_used from recipes where category_id = p_id and active;
    if v_used > 0 then
      raise exception '이 카테고리를 쓰는 메뉴가 %개 있어요', v_used using errcode = '23503';
    end if;
  else
    select count(*) into v_used from materials where category_id = p_id and active;
    if v_used > 0 then
      raise exception '이 카테고리를 쓰는 부자재가 %개 있어요', v_used using errcode = '23503';
    end if;
  end if;

  delete from categories where id = p_id;
end;
$fn$;

create or replace function public.save_material(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare v_id uuid := nullif(p_payload->>'id','')::uuid; v_name text := btrim(p_payload->>'name');
begin
  perform assert_my_store(p_store);
  if v_name is null or v_name = '' then
    raise exception '부자재 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if coalesce((p_payload->>'unit_cost')::numeric, -1) < 0 then
    raise exception '개당 단가는 0 이상이어야 합니다' using errcode = '22000';
  end if;
  if exists (select 1 from materials where store_id = p_store and active
               and lower(btrim(name)) = lower(v_name) and (v_id is null or id <> v_id)) then
    raise exception '이미 같은 이름의 부자재가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into materials (store_id, name, category_id, unit_cost, unit_label, memo)
    values (p_store, v_name, nullif(p_payload->>'category_id','')::uuid,
            coalesce((p_payload->>'unit_cost')::numeric, 0),
            coalesce(nullif(p_payload->>'unit_label',''), '개'),
            nullif(p_payload->>'memo',''))
    returning id into v_id;
  else
    update materials set
      name = v_name,
      category_id = nullif(p_payload->>'category_id','')::uuid,
      unit_cost = coalesce((p_payload->>'unit_cost')::numeric, unit_cost),
      unit_label = coalesce(nullif(p_payload->>'unit_label',''), unit_label),
      memo = nullif(p_payload->>'memo',''),
      updated_at = now()
    where id = v_id and store_id = p_store;
    if not found then
      raise exception '부자재를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;

  -- 부자재 단가가 바뀌면 그걸 쓰는 **모든 메뉴의 원가**가 움직인다.
  update recipe_extra_costs ec
     set amount_per_serving = m.unit_cost * ec.qty
    from materials m
   where m.id = v_id and ec.material_id = v_id;

  perform recompute_recipe(r.id, 'recipe', null)
     from recipes r
    where r.store_id = p_store and r.active
      and exists (select 1 from recipe_extra_costs ec where ec.recipe_id = r.id and ec.material_id = v_id);

  return v_id;
end;
$fn$;

create or replace function public.deactivate_material(p_id uuid)
returns void language sql security invoker as $fn$
  update materials set active = false, updated_at = now() where id = p_id;
$fn$;

-- ── 조회 API 갱신 ─────────────────────────────────────────────
create or replace function public.settings_lists(p_store uuid)
returns jsonb language sql stable security invoker as $fn$
  select jsonb_build_object(
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'default_loss_rate', c.default_loss_rate,
               'used_count', (select count(*) from ingredients i where i.category_id = c.id and i.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'ingredient'),
    'recipe_categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'default_loss_rate', 0,
               'used_count', (select count(*) from recipes r where r.category_id = c.id and r.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'recipe'),
    'material_categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'name', c.name, 'kind', c.kind, 'sort_order', c.sort_order,
               'default_loss_rate', 0,
               'used_count', (select count(*) from materials m where m.category_id = c.id and m.active))
             order by c.sort_order), '[]'::jsonb)
      from categories c where c.store_id = p_store and c.kind = 'material'),
    'materials', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id, 'name', m.name, 'category_id', m.category_id,
               'category_name', mc.name, 'unit_cost', m.unit_cost, 'unit_label', m.unit_label,
               'memo', m.memo,
               'used_count', (select count(*) from recipe_extra_costs ec where ec.material_id = m.id))
             order by m.name), '[]'::jsonb)
      from materials m left join categories mc on mc.id = m.category_id
      where m.store_id = p_store and m.active),
    'vendors', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name,
               'used_count', (select count(*) from order_records o where o.vendor_id = v.id))
             order by v.name), '[]'::jsonb)
      from vendors v where v.store_id = p_store and not v.hidden),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', ch.id, 'code', ch.code, 'name', ch.name,
               'fee_rate', ch.fee_rate, 'fee_note', ch.fee_note, 'active', ch.active)
             order by ch.sort_order), '[]'::jsonb)
      from sales_channels ch where ch.store_id = p_store)
  );
$fn$;

-- 레시피 저장에 카테고리·부자재 연결 추가
create or replace function public.save_recipe(p_store uuid, p_payload jsonb)
returns uuid language plpgsql security invoker as $fn$
declare
  v_id       uuid := nullif(p_payload->>'id','')::uuid;
  v_name     text := btrim(p_payload->>'name');
  v_servings int  := coalesce((p_payload->>'base_servings')::int, 1);
  v_line     jsonb;
begin
  perform assert_my_store(p_store);

  if v_name is null or v_name = '' then
    raise exception '메뉴 이름을 입력해 주세요' using errcode = '22000';
  end if;
  if v_servings <= 0 then
    raise exception '기준 인분은 1 이상이어야 합니다' using errcode = '22000';
  end if;
  if coalesce((p_payload->>'price')::numeric, -1) < 0 then
    raise exception '판매가는 0 이상이어야 합니다' using errcode = '22000';
  end if;
  if exists (
    select 1 from recipes
     where store_id = p_store and active and lower(btrim(name)) = lower(v_name)
       and (v_id is null or id <> v_id)
  ) then
    raise exception '이미 같은 이름의 메뉴가 있어요' using errcode = '23505';
  end if;

  if v_id is null then
    insert into recipes (store_id, name, price, tax_mode, tax_items, base_servings,
                         target_profit_rate, avg_monthly_sales, category_id, active)
    values (p_store, v_name,
            (p_payload->>'price')::numeric,
            coalesce((p_payload->>'tax_mode')::tax_mode, 'included'),
            '{}', v_servings,
            coalesce((p_payload->>'target_profit_rate')::numeric, 30),
            nullif(p_payload->>'avg_monthly_sales','')::numeric,
            nullif(p_payload->>'category_id','')::uuid,
            true)
    returning id into v_id;
  else
    update recipes set
      name               = v_name,
      price              = (p_payload->>'price')::numeric,
      tax_mode           = coalesce((p_payload->>'tax_mode')::tax_mode, tax_mode),
      base_servings      = v_servings,
      target_profit_rate = coalesce((p_payload->>'target_profit_rate')::numeric, target_profit_rate),
      avg_monthly_sales  = coalesce(nullif(p_payload->>'avg_monthly_sales','')::numeric, avg_monthly_sales),
      category_id        = case when p_payload ? 'category_id'
                                then nullif(p_payload->>'category_id','')::uuid else category_id end,
      active             = coalesce((p_payload->>'active')::boolean, active),
      updated_at         = now()
    where id = v_id and store_id = p_store;
    if not found then
      raise exception '메뉴를 찾을 수 없습니다' using errcode = 'P0002';
    end if;
  end if;

  if p_payload ? 'lines' then
    delete from recipe_lines where recipe_id = v_id;
    for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
      if coalesce((v_line->>'input_qty')::numeric, 0) > 0 then
        if nullif(v_line->>'sub_recipe_id','')::uuid = v_id then
          raise exception '메뉴가 자기 자신을 재료로 쓸 수 없어요' using errcode = '22000';
        end if;
        insert into recipe_lines (store_id, recipe_id, ingredient_id, sub_recipe_id, input_qty)
        values (p_store, v_id,
                nullif(v_line->>'ingredient_id','')::uuid,
                nullif(v_line->>'sub_recipe_id','')::uuid,
                (v_line->>'input_qty')::numeric);
      end if;
    end loop;
  end if;

  if p_payload ? 'extras' then
    delete from recipe_extra_costs where recipe_id = v_id;
    -- 부자재 마스터를 가리키면 금액은 **마스터 단가 × 수량**이다.
    -- 화면이 보낸 금액을 그대로 믿으면 마스터를 고쳐도 레시피가 옛 값을 붙들고 있게 된다.
    insert into recipe_extra_costs (store_id, recipe_id, material_id, name, qty, amount_per_serving)
    select p_store, v_id,
           nullif(x->>'material_id','')::uuid,
           coalesce(m.name, nullif(btrim(x->>'name'),''), '기타'),
           coalesce((x->>'qty')::numeric, 1),
           case when m.id is not null
                then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                else coalesce((x->>'amount')::numeric, 0) end
      from jsonb_array_elements(p_payload->'extras') x
      left join materials m on m.id = nullif(x->>'material_id','')::uuid
     where coalesce(
             case when m.id is not null then m.unit_cost * coalesce((x->>'qty')::numeric, 1)
                  else (x->>'amount')::numeric end, 0) <> 0;
  end if;

  perform e3_recipe_saved(v_id, nullif(p_payload->>'occurred_at','')::date);
  return v_id;
end;
$fn$;

-- 반환 컬럼(카테고리)이 늘어나므로 create or replace 로는 못 바꾼다.
drop function if exists public.recipe_list(uuid);

create or replace function public.recipe_list(p_store uuid)
returns table (
  id uuid, name text, price numeric, tax_mode tax_mode, base_servings int,
  target_profit_rate numeric, avg_monthly_sales numeric, active boolean,
  category_id uuid, category_name text,
  material_cost numeric, extra_cost numeric, tax numeric, fixed_cost numeric,
  profit numeric, profit_rate numeric, material_rate numeric
) language sql stable security invoker as $fn$
  with base as (
    select r.*,
           c.name as cat_name,
           recipe_material_cost(r.id) as mat,
           coalesce((select sum(amount_per_serving) from recipe_extra_costs ec where ec.recipe_id = r.id), 0) as ext,
           case when r.tax_mode = 'included' then r.price * 10 / 110 else 0 end as tx,
           coalesce(fixed_cost_rate(r.store_id, business_month()), 0) as rate
      from recipes r
      left join categories c on c.id = r.category_id
     where r.store_id = p_store
  )
  select b.id, b.name, b.price, b.tax_mode, b.base_servings,
         b.target_profit_rate, b.avg_monthly_sales, coalesce(b.active, true),
         b.category_id, b.cat_name,
         b.mat, b.ext, b.tx, b.rate * b.price,
         b.price - b.tx - b.mat - b.ext - (b.rate * b.price),
         case when b.price > 0 then (b.price - b.tx - b.mat - b.ext - (b.rate * b.price)) / b.price else 0 end,
         case when b.price > 0 then b.mat / b.price else 0 end
    from base b
   order by coalesce(b.active, true) desc, b.name;
$fn$;

select public.assert_no_rpc_overloads();
