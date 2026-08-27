/*
 * 0172 · 설정 판본 완결 — 무변경 저장은 자국을 남기지 않고 세금 설정도 같은 판본을 쓴다
 *
 * 0171 은 일반 설정에 판본을 붙였지만, 같은 값을 다시 저장해도 revision·updated_at 을
 * 올렸다. 또 save_store_tax 는 같은 settings 행의 tax_mode·tax_items 를 쓰면서 판본을
 * 검사하지 않아 두 기기의 세금 항목 배열이 서로를 조용히 덮을 수 있었다.
 *
 * 규칙:
 *   · 두 저장문 모두 p_base_revision 을 요구한다(null → 22000 BASE_REQUIRED).
 *   · 현재 판본과 다르면 45009 REVISION_CONFLICT 로 거부한다.
 *   · 실제 값이 같으면 UPDATE 자체를 하지 않고 changed=false, revision=현재값을 돌려준다.
 *     settings_touch 트리거가 UPDATE 만으로 updated_at 을 바꾸므로 WHERE 가드만으로는 부족하다.
 *   · 실제 값이 바뀐 경우에만 revision + 1, updated_at 갱신 및 세금 전파를 수행한다.
 */

-- ── ① 일반 설정 — 동일 값은 UPDATE 하지 않는다 ─────────────────
drop function if exists public.save_settings(uuid, jsonb);

create or replace function public.save_settings(
  p_store uuid,
  p_payload jsonb,
  p_base_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_unknown  text;
  v_key      text;
  v_num      numeric;
  v_locale   text;
  v_currency text;
  v_digits   int;
  v_rev      int;
begin
  perform assert_my_store(p_store);       -- ⚠ definer 문지기: 반드시 첫 줄
  perform lock_business_scope(p_store);   -- 다른 설정 저장과 잠금 순서 통일

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception '설정은 객체로 보내 주세요' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload = '{}'::jsonb then
    raise exception '저장할 설정 값이 없어요' using errcode = '22000', detail = 'EMPTY_PAYLOAD';
  end if;

  if p_payload ?| array['open_time', 'close_time', 'break_start', 'break_end'] then
    raise exception '영업시간은 영업시간 화면에서만 바꿀 수 있어요'
      using errcode = '22000', detail = 'HOURS_NOT_HERE';
  end if;

  select string_agg(k, ', ') into v_unknown
    from jsonb_object_keys(p_payload) k
   where k not in ('locale', 'currency', 'unit_system', 'cup_volume',
                   'unit_price_digits', 'quantity_digits', 'money_digits',
                   'default_target_profit_rate',
                   'alert_morning_summary', 'alert_inbound_delay', 'alert_price_spike', 'alert_target_miss');
  if v_unknown is not null then
    raise exception '저장할 수 없는 설정이에요: %', v_unknown using errcode = '22000', detail = 'UNKNOWN_KEY';
  end if;

  foreach v_key in array array['locale', 'currency', 'unit_system'] loop
    if p_payload ? v_key and jsonb_typeof(p_payload -> v_key) <> 'string' then
      raise exception '%는 문자열이어야 해요', v_key using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end loop;
  foreach v_key in array array['cup_volume', 'unit_price_digits', 'quantity_digits', 'money_digits', 'default_target_profit_rate'] loop
    if p_payload ? v_key and jsonb_typeof(p_payload -> v_key) <> 'number' then
      raise exception '%는 숫자여야 해요', v_key using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end loop;
  foreach v_key in array array['alert_morning_summary', 'alert_inbound_delay', 'alert_price_spike', 'alert_target_miss'] loop
    if p_payload ? v_key and jsonb_typeof(p_payload -> v_key) <> 'boolean' then
      raise exception '%는 참/거짓이어야 해요', v_key using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end loop;

  if p_payload ? 'unit_system' and p_payload->>'unit_system' is distinct from 'metric' then
    raise exception '1차는 미터법만 지원해요' using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'cup_volume' then
    v_num := (p_payload->>'cup_volume')::numeric;
    if v_num <= 0 or v_num > 5000 then
      raise exception '컵 용량은 0 보다 크고 5,000ml 이하여야 해요' using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end if;
  foreach v_key in array array['unit_price_digits', 'quantity_digits', 'money_digits'] loop
    if p_payload ? v_key then
      v_num := (p_payload->>v_key)::numeric;
      if v_num <> trunc(v_num) or v_num < 0 or v_num > 4 then
        raise exception '자릿수는 0~4 사이 정수여야 해요 (%)', v_key using errcode = '22000', detail = 'INVALID_VALUE';
      end if;
    end if;
  end loop;
  if p_payload ? 'default_target_profit_rate' then
    v_num := (p_payload->>'default_target_profit_rate')::numeric;
    if v_num < 0 or v_num > 100 then
      raise exception '목표 이익률은 0~100%% 사이여야 해요' using errcode = '22000', detail = 'INVALID_VALUE';
    end if;
  end if;

  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;

  select s.revision into v_rev from settings s where s.store_id = p_store for update;
  if p_base_revision is null then
    raise exception '설정 판본이 필요해요 — 설정을 다시 불러온 뒤 저장해 주세요'
      using errcode = '22000', detail = 'BASE_REQUIRED';
  end if;
  if p_base_revision <> v_rev then
    raise exception '다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요'
      using errcode = '45009', detail = 'REVISION_CONFLICT';
  end if;

  select coalesce(p_payload->>'locale', s.locale) into v_locale
    from settings s where s.store_id = p_store;
  select d.currency, d.money_digits into v_currency, v_digits from locale_defaults(v_locale) d;
  if v_currency is null then
    raise exception '지원하지 않는 언어예요: %', v_locale using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'currency' and p_payload->>'currency' is distinct from v_currency then
    raise exception '통화는 언어가 정해요 (% → %)', v_locale, v_currency using errcode = '22000', detail = 'INVALID_VALUE';
  end if;
  if p_payload ? 'money_digits' and (p_payload->>'money_digits')::int is distinct from v_digits then
    raise exception '금액 자릿수는 통화가 정해요 (% → %자리)', v_currency, v_digits using errcode = '22000', detail = 'INVALID_VALUE';
  end if;

  /*
   * target 값이 현재 행과 하나라도 다를 때만 UPDATE 한다. settings_touch 가 UPDATE 마다
   * updated_at 을 다시 쓰므로, UPDATE 후 changed 를 계산하면 이미 자국이 남는다.
   */
  update settings set
    locale             = v_locale,
    currency           = v_currency,
    money_digits       = v_digits,
    unit_system        = coalesce(p_payload->>'unit_system', unit_system),
    cup_volume         = coalesce((p_payload->>'cup_volume')::numeric, cup_volume),
    unit_price_digits  = coalesce((p_payload->>'unit_price_digits')::int, unit_price_digits),
    quantity_digits    = coalesce((p_payload->>'quantity_digits')::int, quantity_digits),
    default_target_profit_rate = coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate),
    alert_morning_summary = coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary),
    alert_inbound_delay   = coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay),
    alert_price_spike     = coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike),
    alert_target_miss     = coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss),
    revision           = revision + 1,
    updated_at         = now()
  where store_id = p_store
    and (locale is distinct from v_locale
      or currency is distinct from v_currency
      or money_digits is distinct from v_digits
      or unit_system is distinct from coalesce(p_payload->>'unit_system', unit_system)
      or cup_volume is distinct from coalesce((p_payload->>'cup_volume')::numeric, cup_volume)
      or unit_price_digits is distinct from coalesce((p_payload->>'unit_price_digits')::int, unit_price_digits)
      or quantity_digits is distinct from coalesce((p_payload->>'quantity_digits')::int, quantity_digits)
      or default_target_profit_rate is distinct from coalesce((p_payload->>'default_target_profit_rate')::numeric, default_target_profit_rate)
      or alert_morning_summary is distinct from coalesce((p_payload->>'alert_morning_summary')::boolean, alert_morning_summary)
      or alert_inbound_delay is distinct from coalesce((p_payload->>'alert_inbound_delay')::boolean, alert_inbound_delay)
      or alert_price_spike is distinct from coalesce((p_payload->>'alert_price_spike')::boolean, alert_price_spike)
      or alert_target_miss is distinct from coalesce((p_payload->>'alert_target_miss')::boolean, alert_target_miss))
  returning revision into v_rev;

  if not found then
    return jsonb_build_object('changed', false, 'revision', p_base_revision);
  end if;
  return jsonb_build_object('changed', true, 'revision', v_rev);
end;
$$;

comment on function public.save_settings(uuid, jsonb, integer) is
'설정 저장(0172). p_base_revision 필수(null=22000 BASE_REQUIRED, 불일치=45009 REVISION_CONFLICT). 실제 값이 바뀔 때만 settings 를 UPDATE 하고 revision+1·updated_at 갱신. 무변경은 changed=false 와 현재 revision, 변경은 changed=true 와 새 revision을 돌려준다. 통화·금액 자릿수는 locale_defaults 에서 파생한다.';
revoke execute on function public.save_settings(uuid, jsonb, integer) from public, anon;
grant  execute on function public.save_settings(uuid, jsonb, integer) to authenticated, service_role;

-- ── ② 세금 설정 — 같은 settings.revision 으로 보호한다 ──────────
drop function if exists public.save_store_tax(uuid, tax_mode, jsonb);

create or replace function public.save_store_tax(
  p_store uuid,
  p_mode tax_mode,
  p_items jsonb,
  p_base_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_mode0  tax_mode;
  v_items0 jsonb;
  v_items  jsonb;
  v_day    date;
  v_month  text;
  v_rate   numeric;
  v_corr   uuid := gen_random_uuid();
  v_ext    numeric;
  v_t0     numeric;
  v_t1     numeric;
  v_rev    integer;
  rec      record;
  v_n      int := 0;
begin
  perform assert_my_store(p_store);       -- ⚠ definer 문지기: 반드시 첫 줄
  perform lock_business_scope(p_store);   -- save_settings 와 같은 잠금 순서

  v_day   := store_local_date(p_store);
  v_month := to_char(v_day, 'YYYY-MM');
  v_items := assert_tax_items(coalesce(p_items, '[]'::jsonb));

  insert into settings (store_id) values (p_store) on conflict (store_id) do nothing;

  select tax_mode, tax_items, revision into v_mode0, v_items0, v_rev
    from settings where store_id = p_store for update;
  if not found then
    raise exception '매장 설정을 찾지 못했어요' using errcode = '22000';
  end if;
  if p_base_revision is null then
    raise exception '설정 판본이 필요해요 — 설정을 다시 불러온 뒤 저장해 주세요'
      using errcode = '22000', detail = 'BASE_REQUIRED';
  end if;
  if p_base_revision <> v_rev then
    raise exception '다른 기기에서 설정이 변경됐어요. 새로고침 후 다시 저장해 주세요'
      using errcode = '45009', detail = 'REVISION_CONFLICT';
  end if;

  -- 같으면 UPDATE·전파·감사 기록을 모두 건너뛴다.
  if v_mode0 is not distinct from p_mode and coalesce(v_items0, '[]'::jsonb) = v_items then
    return jsonb_build_object('changed', false, 'recipes', 0, 'revision', v_rev);
  end if;

  update settings
     set tax_mode = p_mode,
         tax_items = v_items,
         revision = revision + 1,
         updated_at = now()
   where store_id = p_store
   returning revision into v_rev;
  if not found then
    raise exception '매장 설정을 찾지 못했어요' using errcode = '22000';
  end if;

  v_rate := coalesce(fixed_cost_rate(p_store, v_month), 0);
  for rec in select id, price from recipes where store_id = p_store and coalesce(active, true) loop
    v_t0 := tax_of(rec.price, v_mode0, coalesce(v_items0, '[]'::jsonb));
    v_t1 := tax_of(rec.price, p_mode, v_items);

    update recipes set updated_at = now() where id = rec.id;
    perform recompute_recipe(rec.id, 'tax', v_day);
    v_n := v_n + 1;

    v_ext := coalesce((select sum(ec.amount_per_serving)
                         from recipe_extra_costs ec where ec.recipe_id = rec.id), 0);
    perform record_entity_change(
      p_store, 'recipe', rec.id, 'fixed_cost', '세금 반영',
      change_line('tax', '세금', round(v_t0, 2), round(v_t1, 2), '원', 'derived')
      || change_line('profit', '순이익',
           round(rec.price - recipe_material_cost(rec.id) - v_ext - v_t0 - v_rate * rec.price, 2),
           round(rec.price - recipe_material_cost(rec.id) - v_ext - v_t1 - v_rate * rec.price, 2),
           '원', 'derived'),
      true, null, v_corr, '세금 설정 변경');
  end loop;

  return jsonb_build_object('changed', true, 'recipes', v_n,
                            'mode', p_mode, 'items', v_items, 'revision', v_rev);
end;
$$;

comment on function public.save_store_tax(uuid, tax_mode, jsonb, integer) is
'매장 세금 설정 저장(0172). p_base_revision 필수(null=22000 BASE_REQUIRED, 불일치=45009 REVISION_CONFLICT). 실제 세금 값이 바뀔 때만 settings.revision+1·updated_at 갱신 후 활성 레시피에 전파하고, 무변경은 자국 없이 changed=false 와 현재 revision을 돌려준다.';
revoke execute on function public.save_store_tax(uuid, tax_mode, jsonb, integer) from public, anon;
grant  execute on function public.save_store_tax(uuid, tax_mode, jsonb, integer) to authenticated, service_role;

-- ── ③ 사후조건 ─────────────────────────────────────────────────
do $$
declare
  v_def text;
begin
  if exists (
    select 1 from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and ((p.proname = 'save_settings' and p.pronargs <> 3)
         or (p.proname = 'save_store_tax' and p.pronargs <> 4))
  ) then
    raise exception '0172: 설정 저장 RPC 의 옛 시그니처가 남아 있습니다';
  end if;

  select pg_get_functiondef('public.save_settings(uuid,jsonb,integer)'::regprocedure) into v_def;
  if position('''changed'', false' in v_def) = 0
     or position('revision + 1' in v_def) = 0
     or position('REVISION_CONFLICT' in v_def) = 0 then
    raise exception '0172: save_settings 무변경·판본 계약이 덜 됐습니다';
  end if;

  select pg_get_functiondef('public.save_store_tax(uuid,tax_mode,jsonb,integer)'::regprocedure) into v_def;
  if position('''changed'', false' in v_def) = 0
     or position('revision = revision + 1' in v_def) = 0
     or position('REVISION_CONFLICT' in v_def) = 0 then
    raise exception '0172: save_store_tax 무변경·판본 계약이 덜 됐습니다';
  end if;
end $$;
