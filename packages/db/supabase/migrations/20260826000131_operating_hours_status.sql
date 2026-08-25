-- ════════════════════════════════════════════════════════════════
-- 0131 · 화면이 "언제부터 적용되는지" 말할 수 있게 (기획서 §6.3)
--
-- 0130 이 소급을 막았다. 좋은 일인데, **화면에서는 아무것도 안 달라 보인다** —
-- 영업 중에 시간을 바꾸고 저장하면 예전처럼 조용히 닫히고, 사장님은 오늘부터
-- 바뀐 줄 안다. 실제로는 내일부터다.
--
-- 서버가 맞게 도는데 화면이 다른 말을 하면, 그건 고친 게 아니라 옮긴 것이다.
-- 읽기 전용 RPC 하나로 지금 규칙과 **예약된 규칙**을 같이 준다.
-- ════════════════════════════════════════════════════════════════

create or replace function public.operating_hours_status(p_store uuid)
returns jsonb
language sql
stable
as $fn$
  select jsonb_build_object(
    'local_date', store_local_date(p_store),
    -- 오늘 실제로 적용 중인 시간. `settings` 가 아니라 **규칙**에서 온다.
    'today', store_hours_on(p_store, store_local_date(p_store)),
    /*
     * 아직 시작 안 한 규칙. 있으면 화면이 "○월 ○일부터 적용돼요" 라고 말할 수 있다.
     * ⚠ `effective_from > 오늘` 인 것만이다. 오늘부터인 규칙은 이미 `today` 다.
     */
    'pending', (
      select jsonb_build_object(
               'effective_from', p.effective_from,
               'hours', store_hours_on(p_store, p.effective_from))
        from public.operating_rules p
       where p.store_id = p_store
         and p.effective_from > store_local_date(p_store)
       order by p.effective_from
       limit 1));
$fn$;

comment on function public.operating_hours_status(uuid) is
  '지금 적용 중인 영업시간과 예약된 영업시간(0131). 화면이 "언제부터 적용되는지" 말하는 데 쓴다(기획서 §6.3).';

grant execute on function public.operating_hours_status(uuid) to authenticated;


-- ── 사후 확인 ────────────────────────────────────────────────────
do $v$
declare v_store uuid; v_res jsonb;
begin
  select id into v_store from public.stores limit 1;
  if v_store is null then return; end if;

  v_res := public.operating_hours_status(v_store);
  if v_res->>'local_date' is null then
    raise exception '0131: local_date 가 비었습니다';
  end if;
  if v_res->'today' is null or v_res->'today'->>'open_time' is null then
    raise exception '0131: 오늘 영업시간이 비었습니다';
  end if;
  -- 예약이 없으면 pending 은 null 이어야 한다. 빈 객체가 아니라 null 이다 —
  -- 앱이 `pending ? …` 로 판단하므로 빈 객체면 "예약이 있다"로 읽힌다.
  if jsonb_typeof(v_res->'pending') not in ('null', 'object') then
    raise exception '0131: pending 이 null 도 객체도 아닙니다 — %', jsonb_typeof(v_res->'pending');
  end if;
end $v$;

select public.assert_no_rpc_overloads();
