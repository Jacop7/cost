/*
 * 0160 · 시작·종료 문을 좁힌다 (검토 P1-2)
 *
 * 실측된 우회: 인증 사용자가 open_business_day(store, '2020-01-01') 을 직접 불러
 * **과거 날짜를 open 으로** 만들 수 있었다. 과거는 정정 RPC(amend)만 쓰라는 규칙
 * (§6.4)을 그대로 우회한다 — transition_business_state 는 날짜 인자가 없어 오늘만
 * 열 수 있는데, 몸통이 앱 롤에 열려 있으니 문이 둘이었다.
 *
 * 앱 공개문은 transition_business_state 와 save_sale(p_open_day)뿐이다.
 * open_business_day·close_business_day 는 내부 몸통으로 내린다 — definer 함수가
 * 부르는 데는 권한이 필요 없다(호출 시점 롤이 소유자다).
 */

revoke execute on function public.open_business_day(uuid, date) from public, anon, authenticated;
revoke execute on function public.close_business_day(uuid) from public, anon, authenticated;

comment on function public.open_business_day(uuid, date) is
'영업 시작 몸통(0160부터 내부 전용). 앱 문은 transition_business_state(''open'')와 save_sale(p_open_day) — 둘 다 날짜를 못 받아 오늘(판매 영업일)만 연다. 날짜 인자는 시드·시험(소유자)용이다.';
comment on function public.close_business_day(uuid) is
'영업 종료 몸통(0160부터 내부 전용). 앱 문은 transition_business_state(''end'') 다.';

-- ── 사후조건 ────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('authenticated', 'public.open_business_day(uuid, date)', 'execute')
     or has_function_privilege('anon', 'public.open_business_day(uuid, date)', 'execute') then
    raise exception '0160: 시작 몸통이 아직 앱 롤에 열려 있습니다';
  end if;
  if has_function_privilege('authenticated', 'public.close_business_day(uuid)', 'execute')
     or has_function_privilege('anon', 'public.close_business_day(uuid)', 'execute') then
    raise exception '0160: 종료 몸통이 아직 앱 롤에 열려 있습니다';
  end if;
  -- 앱 문 둘은 열려 있어야 한다 — 문을 좁히다 문 자체를 잠그면 장사를 못 연다.
  if not has_function_privilege('authenticated', 'public.transition_business_state(uuid, text)', 'execute') then
    raise exception '0160: 전이 문이 닫혀 있습니다';
  end if;
  if not has_function_privilege('authenticated',
       'public.save_sale(uuid, date, jsonb, jsonb, jsonb, integer, boolean)', 'execute') then
    raise exception '0160: 판매 저장 문이 닫혀 있습니다';
  end if;
end $$;
