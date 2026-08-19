-- ════════════════════════════════════════════════════════════════
-- 11 · 재고는 기준단위 총량 하나만 저장한다
-- ════════════════════════════════════════════════════════════════

do $t$
declare
  v_ing    uuid := pg_temp.ing('대파');
  v_before numeric;
  v_result jsonb;
begin
  perform pg_temp.eq('분할 재고 컬럼이 없다', (
    select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'inventory_states'
       and column_name in ('sealed_count', 'opened_count', 'opened_remain')
  ), 0, 0);

  perform pg_temp.ok('총 재고 컬럼이 있다', exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'inventory_states'
       and column_name = 'stock_total'
  ));

  v_before := stock_total_base(v_ing);
  v_result := e5_stock_adjusted(v_ing, 1234, false, '단일 총량 검증');

  perform pg_temp.eq('E5가 총량을 그대로 저장한다', stock_total_base(v_ing), 1234, 0);
  perform pg_temp.eq('E5 반환값도 총량과 같다', (v_result ->> 'after')::numeric, 1234, 0);
  perform pg_temp.eq('E5 원장에 실제 증감량이 남는다', (
    select count_delta from inventory_events
     where ingredient_id = v_ing and type = 'stocktake'
     order by seq desc limit 1
  ), 1234 - v_before, 0);

  perform restore_stock(v_ing, 66);
  perform pg_temp.eq('복구는 총량에 바로 더한다', stock_total_base(v_ing), 1300, 0);

  perform consume_stock(v_ing, 250);
  perform pg_temp.eq('소진은 총량에서 바로 뺀다', stock_total_base(v_ing), 1050, 0);
end;
$t$;
