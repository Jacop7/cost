-- ════════════════════════════════════════════════════════════════
-- 0087 · 세금은 **매장이 정한다** — 레시피마다 고치지 않는다
--
-- 사장님: "세금 기능을 이렇게 만들라는 게 아니었어. 기능 삭제해줘.
--          세금 관리에서 수정될 때 레시피 손익 변동 있으니 이 부분 반영해달라는 거였어."
--
-- 0052 는 세금을 **레시피마다** 고치게 만들었다. 잘못 읽었다.
-- 부가세 모드도 카드 수수료도 매장 하나에 하나다. 메뉴 50개면 50번 고쳐야 했고,
-- 한 개를 빠뜨리면 그 메뉴만 다른 세금으로 손익이 계산된다.
--
-- 실측: tax_items 를 채운 레시피 0 / 7, tax_mode 는 전부 'included'.
--       아무도 안 쓰는 기능이었다.
--
-- 이제 고정지출과 **같은 모양**이다.
--   MY > 고정 지출  → 저장 → 전 레시피 재계산 → 손익 변동에 '고정지출 반영'
--   MY > 세금       → 저장 → 전 레시피 재계산 → 손익 변동에 '세금 반영'
--
-- ⚠ recipes.tax_mode / tax_items 는 **남긴다.** 지우면 계산 함수 15개와
--   영업일 스냅샷이 전부 무너진다. 대신 성격이 바뀐다 —
--   사장님이 고치는 값이 아니라 **매장 설정이 전파된 결과**다.
--   그래서 save_recipe 는 이제 세금을 받지 않는다(절대원칙 2 와 같은 이유:
--   값이 바뀌는 길은 하나여야 한다).
-- ════════════════════════════════════════════════════════════════

-- ── 1. 매장 세금 설정 ─────────────────────────────────────────
alter table settings
  add column if not exists tax_mode  tax_mode not null default 'included',
  add column if not exists tax_items jsonb    not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_tax_items_is_array') then
    alter table settings add constraint settings_tax_items_is_array
      check (jsonb_typeof(tax_items) = 'array');
  end if;
end $$;

comment on column settings.tax_mode is
  '부가세 처리. 매장 하나에 하나다 — 레시피마다 다르지 않다(0087).';
comment on column settings.tax_items is
  '부가세 외 세금·수수료(판매가 대비 %). ⚠ 배달 중개 수수료는 여기가 아니라 고정 지출이다(0043).';

-- 이미 쓰던 값이 있으면 그걸 매장 값으로 올린다. 없으면 기본값 그대로.
update settings s
   set tax_mode  = coalesce(x.tax_mode, s.tax_mode),
       tax_items = coalesce(x.tax_items, s.tax_items)
  from (
    select r.store_id, min(r.tax_mode::text)::tax_mode as tax_mode,
           (array_agg(r.tax_items order by jsonb_array_length(r.tax_items) desc))[1] as tax_items
      from recipes r group by r.store_id
  ) x
 where x.store_id = s.store_id;


-- ── 2. 손익 변동의 새 원인 ────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                  where t.typname = 'trend_cause' and e.enumlabel = 'tax') then
    alter type trend_cause add value 'tax';
  end if;
end $$;
