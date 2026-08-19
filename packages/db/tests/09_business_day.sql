-- ════════════════════════════════════════════════════════════════
-- 09 · 영업일 — 시작 / 브레이크 / 종료 / 자동 종료 (0048·0049)
--
-- 사장님 명세를 그대로 못 박는다.
--   시작   행 + 스냅샷이 **둘 다** 있어야 영업 중
--   브레이크 상태만 바뀌고 스냅샷·id 는 그대로
--   종료   실제 시각·방식 저장, 그날 집계 함께 남김
--   자동   예정 뒤 활동이 있으면 마지막 활동 + 1시간으로 미룸
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_open  jsonb;
  v_id    uuid;
  v_snap  jsonb;
  v_close jsonb;
  v_day   date := business_day();
begin
  -- ── 시작: 행과 스냅샷이 함께 만들어진다 ─────────────────────
  v_open := open_business_day(pg_temp.store());
  v_id := (v_open->>'business_day_id')::uuid;
  perform pg_temp.ok('영업 시작 → id 반환', v_id is not null);
  perform pg_temp.eq_t('상태가 영업 중', v_open->>'status', 'open');

  select snapshot into v_snap from business_days where id = v_id;
  perform pg_temp.ok('스냅샷이 비어 있지 않다', v_snap is not null and v_snap <> '{}'::jsonb);
  perform pg_temp.ok('스냅샷에 고정지출률이 있다', (v_snap->>'fixed_rate') is not null);
  perform pg_temp.eq('스냅샷 고정지출률 = 그때 값',
    (v_snap->>'fixed_rate')::numeric * 100, 31.30, 0.01);
  perform pg_temp.ok('스냅샷에 레시피가 담겼다',
    (select count(*) from jsonb_object_keys(v_snap->'recipes')) > 0);

  -- 재료 구성이 1인분량과 단가를 함께 갖는다 — 나중에 단가가 올라도 그날 원가는 그대로.
  declare j jsonb := v_snap#>'{recipes}'->(pg_temp.rcp('제육볶음')::text);
  begin
    perform pg_temp.eq('제육볶음 판매가 스냅샷', (j->>'price')::numeric, 12000, 0);
    perform pg_temp.eq('제육볶음 재료비 스냅샷', (j->>'material_cost')::numeric, 2806.40, 0.01);
    perform pg_temp.eq('재료 줄 4개', jsonb_array_length(j->'lines'), 4, 0);
    perform pg_temp.ok('재료 줄마다 1인분량과 단가가 있다',
      not exists (select 1 from jsonb_array_elements(j->'lines') l
                   where (l->>'per_serving') is null or (l->>'unit_price') is null));
    -- 부자재 내역까지 담아야 나중에 항목을 지워도 그날 상세에 남는다.
    perform pg_temp.eq('부자재 내역 1개', jsonb_array_length(j->'extras'), 1, 0);
  end;

  -- ── 두 번 눌러도 새로 만들지 않는다 (불변식 8) ──────────────
  perform pg_temp.ok('재시작은 같은 영업일을 돌려준다',
    (open_business_day(pg_temp.store())->>'already_open')::boolean is true);
  perform pg_temp.eq('영업일 행은 하나뿐',
    (select count(*) from business_days where store_id = pg_temp.store() and business_date = v_day), 1, 0);

  -- ── 브레이크: 상태만 바뀐다 ─────────────────────────────────
  perform pg_temp.eq_t('브레이크 전환', set_break(pg_temp.store(), true)->>'status', 'break');
  perform pg_temp.eq_t('브레이크 중에도 같은 영업일',
    (select id::text from business_days where store_id = pg_temp.store() and status = 'break'), v_id::text);
  perform pg_temp.ok('브레이크가 스냅샷을 바꾸지 않는다',
    (select snapshot from business_days where id = v_id) = v_snap);
  perform pg_temp.eq_t('영업 재개', set_break(pg_temp.store(), false)->>'status', 'open');

  -- ── 자동 종료: 예정 뒤 활동이 있으면 미룬다 ─────────────────
  update business_days
     set planned_close_at = (v_day + time '22:00') at time zone business_tz(),
         last_activity_at = (v_day + time '21:47') at time zone business_tz()
   where id = v_id;
  perform pg_temp.eq_t('활동 21:47 → 자동 종료 22:47',
    to_char((auto_close_due(pg_temp.store())->>'auto_close_at')::timestamptz at time zone business_tz(), 'HH24:MI'),
    '22:47');

  update business_days
     set last_activity_at = (v_day + time '22:35') at time zone business_tz() where id = v_id;
  perform pg_temp.eq_t('활동 22:35 → 자동 종료 23:35',
    to_char((auto_close_due(pg_temp.store())->>'auto_close_at')::timestamptz at time zone business_tz(), 'HH24:MI'),
    '23:35');

  -- 아직 안 됐으면 닫지 않는다.
  perform pg_temp.ok('아직 때가 아니면 안 닫는다',
    (close_if_due(pg_temp.store())->>'closed')::boolean is false);

  -- ── 종료: 시각·방식·집계가 남는다 ───────────────────────────
  v_close := close_business_day(pg_temp.store());
  perform pg_temp.eq_t('종료 방식이 수동', v_close->>'close_method', 'manual');
  perform pg_temp.ok('실제 종료 시각이 남는다', (v_close->>'closed_at') is not null);
  perform pg_temp.ok('그날 집계가 함께 남는다', (v_close->'summary') is not null);
  perform pg_temp.eq_t('상태가 종료',
    (select status::text from business_days where id = v_id), 'closed');
  perform pg_temp.ok('종료해도 스냅샷의 레시피는 그대로',
    (select snapshot->'recipes' from business_days where id = v_id) = v_snap->'recipes');

  -- ── 종료 뒤에는 영업 조작이 막힌다 ──────────────────────────
  perform pg_temp.raises('종료 후 브레이크 거부',
    format('select set_break(%L, true)', pg_temp.store()), '22000');
  perform pg_temp.raises('같은 날 재시작 거부',
    format('select open_business_day(%L, %L)', pg_temp.store(), v_day), '23505');

  -- ── 다시 열어 고칠 수 있다 ──────────────────────────────────
  perform pg_temp.eq_t('종료 되돌리기', reopen_business_day(pg_temp.store(), v_day)->>'status', 'open');
  perform pg_temp.ok('되돌려도 스냅샷은 그대로',
    (select snapshot->'recipes' from business_days where id = v_id) = v_snap->'recipes');

  -- ── 자동 종료 기록과 확인 ───────────────────────────────────
  perform close_business_day(pg_temp.store(), 'auto');
  declare u jsonb := unacked_auto_close(pg_temp.store());
  begin
    perform pg_temp.ok('자동 종료가 다음 실행 때 알려진다', u is not null);
    perform pg_temp.eq_t('알림이 그 날짜를 가리킨다', u->>'business_date', v_day::text);
    perform ack_auto_close((u->>'business_day_id')::uuid);
    perform pg_temp.ok('확인하면 다시 안 알린다', unacked_auto_close(pg_temp.store()) is null);
  end;

  -- 수동 종료는 알리지 않는다 — 사장님이 직접 눌렀으니 이미 안다.
  perform pg_temp.eq('수동 종료는 알림 대상이 아니다',
    (select count(*) from business_days
      where store_id = pg_temp.store() and close_method = 'manual' and not auto_close_ack), 0, 0);
end $t$;
