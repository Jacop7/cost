-- ════════════════════════════════════════════════════════════════
-- 0001 · 멀티테넌시 기반 + 공통 헬퍼
-- 모든 도메인 행은 store_id 로 RLS 격리된다. (다점포 운영은 3차이나 스코프는 1차부터 둔다)
-- ════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── 도메인 열거형 (⑤ 2.1) ──────────────────────────────────────
create type base_unit             as enum ('g', 'ml', 'ea');
create type stock_badge           as enum ('ok', 'low', 'out');           -- 충분/부족/소진임박
create type inventory_event_type  as enum ('inbound','consume','discard','stocktake','adjust');
create type order_status          as enum ('ordered','partial','received','canceled');
create type order_source          as enum ('manual','ocr','option','recipe');
create type candidate_reason      as enum ('safety_stock','soon_out','recipe','manual');
create type candidate_status      as enum ('pending','ordered','excluded');
create type tax_mode              as enum ('included','separate','exempt');
create type trend_cause           as enum ('material','recipe','fixed');  -- 주황/파랑/회색
create type fixed_cost_mode       as enum ('total','detail');

-- ── 매장 (테넌트 루트) ─────────────────────────────────────────
create table stores (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index stores_owner_idx on stores (owner_id);

-- ── RLS 헬퍼: 현재 사용자가 소유한 매장 id 집합 ──────────────────
-- SECURITY DEFINER 로 stores 를 조회(정책 재귀 방지). 정책에서 store_id in (...) 로 사용.
create or replace function public.my_store_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.stores where owner_id = auth.uid();
$$;

-- stores 자체 RLS
alter table stores enable row level security;

create policy stores_select on stores for select using (owner_id = auth.uid());
create policy stores_insert on stores for insert with check (owner_id = auth.uid());
create policy stores_update on stores for update using (owner_id = auth.uid());
create policy stores_delete on stores for delete using (owner_id = auth.uid());

-- updated_at 자동 갱신 트리거 함수 (도메인 테이블에서 재사용)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
