-- Real RPC/ledger tests; run.mjs wraps in a rollback transaction.
do $test$
declare
  i uuid:=pg_temp.ing('대파'); a uuid; b uuid; w uuid; inbound uuid;
  before_stock numeric; n bigint; r jsonb;
begin
  perform e5_stock_adjusted(i,10000,false,'fixture');
  perform e5_stock_adjusted(i,9900,false,'first deduction');
  select id into a from inventory_events where ingredient_id=i order by seq desc limit 1;
  perform e5_stock_adjusted(i,9800,false,'latest deduction');
  select id into b from inventory_events where ingredient_id=i order by seq desc limit 1;
  perform pg_temp.raises('older same-type denied',format('select revert_latest_stock_event(%L)',a),'22000');
  perform e2_discard(i,9700);
  select id into w from inventory_events where ingredient_id=i order by seq desc limit 1;
  perform pg_temp.ok('different type does not block deduction',exists(select 1 from stock_revert_candidates(i) where event_id=b and eligible));
  perform revert_latest_stock_event(b);
  perform pg_temp.eq('delta restored after later discard',stock_total_base(i),9800);
  select count(*) into n from inventory_events where ingredient_id=i;
  perform revert_latest_stock_event(b);
  perform pg_temp.eq('retry creates no second event',(select count(*) from inventory_events where ingredient_id=i),n);
  perform pg_temp.ok('older deduction never promoted',not exists(select 1 from stock_revert_candidates(i) where action='차감' and eligible));
  perform pg_temp.raises('older remains rejected',format('select revert_latest_stock_event(%L)',a),'22000');
  perform revert_latest_stock_event(w);
  perform pg_temp.eq('discard restores its own delta',stock_total_base(i),9900);
  perform pg_temp.ok('older discard never promoted',not exists(select 1 from stock_revert_candidates(i) where action='폐기' and eligible));
  r:=quick_inbound(pg_temp.store(),i,100,400,1,null,pg_temp.today(),'T51-inbound');
  select id into inbound from inventory_events where order_record_id=(r->>'order_id')::uuid and type='inbound' order by seq desc limit 1;
  perform pg_temp.ok('latest inbound eligible',exists(select 1 from stock_revert_candidates(i) where event_id=inbound and eligible));
  perform revert_latest_stock_event(inbound);
  perform pg_temp.eq('inbound exact reversal',stock_total_base(i),9900);
  perform pg_temp.ok('inbound receipt persisted',exists(select 1 from stock_event_reversal_receipts where event_id=inbound));
  perform pg_temp.eq('ledger equals server state',(select sum(count_delta) from inventory_events where ingredient_id=i),stock_total_base(i));
  perform e5_stock_adjusted(i,9800,false,'expired',pg_temp.today()-7);
  select id into a from inventory_events where ingredient_id=i order by seq desc limit 1;
  perform pg_temp.raises('7 dates boundary rejected',format('select revert_latest_stock_event(%L)',a),'22000');
  perform e5_stock_adjusted(i,9700,false,'boundary allowed',pg_temp.today()-6);
  select id into a from inventory_events where ingredient_id=i order by seq desc limit 1;
  perform pg_temp.ok('six days ago included',exists(select 1 from stock_revert_candidates(i) where event_id=a and eligible));
  perform pg_temp.as_owner(gen_random_uuid());
  perform pg_temp.ok('foreign store candidates hidden',not exists(select 1 from stock_revert_candidates(i)));
  perform pg_temp.raises('foreign event denied',format('select revert_latest_stock_event(%L)',a),'P0002');
  perform pg_temp.as_owner(pg_temp.owner());
end;
$test$;
