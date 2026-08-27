/*
 * 0169 · 언어·통화·금액 자릿수 **조합**을 표가 지킨다
 *
 * 0168 의 CHECK 는 컬럼마다 허용값만 봤다. 그래서 service_role(UPDATE 권한 있음)이나 소유자가
 * `locale='en-US', currency='KRW', money_digits=0` 을 직접 넣으면 그대로 저장됐다(검토 실측) —
 * RPC 는 언어에서 파생하지만 표는 조합을 몰랐다. 세 컬럼의 허용 조합을 하나의 CHECK 로 못박는다.
 *
 * 표(locale_defaults)는 그대로 하나다 — 조합 검사는 그 표를 IMMUTABLE 함수로 감싸 CHECK 에 쓴다.
 * (CHECK 는 서브쿼리를 못 쓰지만 불변 함수는 부를 수 있다. FK 로 두면 표가 둘이 된다.)
 */

create or replace function public.locale_combo_ok(p_locale text, p_currency text, p_money_digits int)
returns boolean
language sql
immutable
as $$
  select exists (select 1 from public.locale_defaults(p_locale) d
                  where d.currency = p_currency and d.money_digits = p_money_digits)
$$;
comment on function public.locale_combo_ok(text, text, int) is
'언어·통화·금액 자릿수 조합이 locale_defaults 표에 있는가(0169). settings 의 CHECK 가 쓴다 — RPC 밖 직접 갱신도 조합을 못 깬다.';
revoke execute on function public.locale_combo_ok(text, text, int) from public, anon;
grant  execute on function public.locale_combo_ok(text, text, int) to authenticated, service_role;

-- 이미 어긋난 행이 있으면 여기서 멈춘다 — 조용히 고치지 않는다(0168 이 이미 맞췄어야 한다).
do $$
declare v_n int;
begin
  select count(*) into v_n from public.settings s
   where not public.locale_combo_ok(s.locale, s.currency, s.money_digits);
  if v_n > 0 then
    raise exception '0169: 언어·통화·자릿수 조합이 어긋난 행이 %개 있습니다 — 정리 후 다시 적용하세요', v_n;
  end if;
end $$;

alter table public.settings drop constraint if exists settings_locale_combo_ck;
alter table public.settings add constraint settings_locale_combo_ck
  check (public.locale_combo_ok(locale, currency, money_digits));
comment on constraint settings_locale_combo_ck on public.settings is
'언어가 통화·금액 자릿수를 정한다(0168·0169). 세 값은 locale_defaults 의 한 행이어야 한다 — service_role·소유자 직접 갱신도 예외가 아니다.';

-- ── 사후조건 ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_locale_combo_ck'
                    and conrelid = 'public.settings'::regclass and convalidated) then
    raise exception '0169: 조합 CHECK 가 없거나 검증되지 않았습니다';
  end if;
  if public.locale_combo_ok('en-US', 'KRW', 0) or not public.locale_combo_ok('en-US', 'USD', 2)
     or not public.locale_combo_ok('ko', 'KRW', 0) or public.locale_combo_ok('xx-XX', 'KRW', 0) then
    raise exception '0169: locale_combo_ok 가 조합을 잘못 판단합니다';
  end if;
end $$;
