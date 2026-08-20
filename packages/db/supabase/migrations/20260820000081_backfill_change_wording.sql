-- ════════════════════════════════════════════════════════════════
-- 0081 · 이미 쌓인 내역도 새 용어로
--
-- 사장님: "자동 반영·자동 전파·연관 변경 이게 다 자동 갱신에 해당돼서"
--
-- 0079 가 **앞으로 쓰는** 제목을 바꿨다. 그런데 이미 커밋된 행이 남아 있고,
-- 보관이 30일이라 그동안 화면에 옛 표현이 그대로 뜬다.
--   `고춧가루 기준 단가 자동 반영`  ← 바로 그 금지 표현
--
-- 소급해서 고친다. 원장은 append-only 지만 **표기를 고치는 건 값을 고치는 게 아니다** —
-- 전후값·시각·출처는 그대로다.
--
-- ⚠ change_kind 도 함께 채운다. 없으면 앱이 'direct' 로 읽어서
--   재료비·순이익이 '직접 수정' 묶음에 들어간다 — "내가 순이익을 고쳤나?" 가 된다.
-- ════════════════════════════════════════════════════════════════

-- ── 제목 ──────────────────────────────────────────────────────
update entity_change_events set title = '레시피 수정'      where title = '메뉴 수정';
update entity_change_events set title = '레시피 등록'      where title = '메뉴 등록';
update entity_change_events set title = '고정지출 반영'    where title = '고정 지출 자동 반영';

update entity_change_events
   set title = '입고 단가 반영',
       summary = coalesce(summary, '입고 확정으로 기준 단가 변경')
 where title = '기준 단가 변경';

update entity_change_events
   set title = '입고 취소 반영',
       summary = coalesce(summary, '취소된 입고를 제외해 기준 단가 변경')
 where title = '입고 취소로 기준 단가 변경';

-- `OO 기준 단가 자동 반영` — 원본 이름은 요약으로 옮긴다. 제목에서 잃지 않는다.
update entity_change_events e
   set title = '식재료 단가 반영',
       summary = coalesce(
         e.summary,
         (select i.name from ingredients i where i.id = e.source_entity_id) || ' 기준 단가 변경',
         '식재료 기준 단가 변경')
 where e.title like '%기준 단가 자동 반영';

-- ── 빠진 요약 ─────────────────────────────────────────────────
-- 요약이 없으면 화면이 제목을 두 번 보여 준다. 직접 수정한 줄로 만든다.
update entity_change_events e
   set summary = x.s
  from (
    select e2.id,
           case when cnt > 1 then lbl || ' 외 ' || (cnt - 1) || '개 항목 변경'
                else lbl || ' 변경' end as s
      from entity_change_events e2
      cross join lateral (
        select (c->>'label') as lbl, jsonb_array_length(e2.changes) as cnt
          from jsonb_array_elements(e2.changes) c limit 1) f
     where e2.summary is null and jsonb_array_length(e2.changes) > 0
  ) x
 where e.id = x.id;

-- ── 갈래 ──────────────────────────────────────────────────────
-- ⚠ 계산 결과로 나오는 키는 정해져 있다. 그 외는 사장님이 친 값이다.
update entity_change_events
   set changes = (
     select jsonb_agg(
       case when c ? 'change_kind' then c
            else c || jsonb_build_object('change_kind',
              case when c->>'key' in ('material_cost', 'tax', 'profit',
                                      'fixed_rate', 'fixed_cost', 'unit_price')
                   then 'derived' else 'direct' end)
       end)
       from jsonb_array_elements(changes) c)
 where jsonb_array_length(changes) > 0
   and exists (select 1 from jsonb_array_elements(changes) c where not (c ? 'change_kind'));


-- ── 옛 메모 줄 ────────────────────────────────────────────────
-- 0077 이전에 쌓인 행에는 메모가 들어 있다. 지금 계약은 "메모는 수정 내역에
-- 나타나지 않는다"이므로, 그 줄을 빼고 남는 게 없으면 사건도 지운다.
-- ⚠ 값을 고치는 게 아니다 — 애초에 있으면 안 되는 줄을 걷어내는 것이다.
update entity_change_events
   set changes = coalesce((
     select jsonb_agg(c) from jsonb_array_elements(changes) c
      where c->>'key' <> 'memo'), '[]'::jsonb)
 where exists (select 1 from jsonb_array_elements(changes) c where c->>'key' = 'memo');

delete from entity_change_events where jsonb_array_length(changes) = 0;

-- 메모를 걷어내며 요약이 어긋난 행은 다시 만든다.
update entity_change_events e
   set summary = x.s
  from (
    select e2.id,
           case when cnt > 1 then lbl || ' 외 ' || (cnt - 1) || '개 항목 변경'
                else lbl || ' 변경' end as s
      from entity_change_events e2
      cross join lateral (
        select (c->>'label') as lbl, jsonb_array_length(e2.changes) as cnt
          from jsonb_array_elements(e2.changes) c
         where coalesce(c->>'change_kind', 'direct') = 'direct' limit 1) f
     where jsonb_array_length(e2.changes) > 0
       and (e2.summary is null or e2.summary like '메모%')
  ) x
 where e.id = x.id;

select public.assert_no_rpc_overloads();
