begin;
-- Tax propagation already records the exact affected menus; storewide fallback
-- incorrectly marks explicit exemptions pending when their effective basis is unchanged.
do $patch$
declare d text; a text;
begin
  d:=pg_get_functiondef('public.last_entity_change(uuid,text,uuid)'::regprocedure);
  a:='c.kind=''tax'' or (c.kind=''fixed_cost''';
  if position(a in d)=0 then raise exception '0223 pending fallback anchor'; end if;
  execute replace(d,a,'(c.kind=''fixed_cost''');
end $patch$;
commit;
