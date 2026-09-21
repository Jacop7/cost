-- APP-215-SURFACE-AUDIT · 매장 purge cascade와 계산 기준 trigger 충돌 보정
--
-- stores 삭제가 settings 등 자식 행을 cascade 삭제할 때 부모 행은 이미 현재 명령에서
-- 보이지 않는다. 자식의 계산 기준 trigger가 이 시점에 store 잠금 행이나 새 기준 판본을
-- 만들면 삭제 중인 부모를 참조해 FK 오류가 난다. 직접 자식 변경은 부모가 존재하므로
-- 기존 잠금·동결·발행 계약을 그대로 거친다.

begin;

do $patch$
declare
  v_def text;
  v_new text;
begin
  v_def:=replace(pg_get_functiondef('public.sales_lifecycle_guard_basis_write()'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    $old$if v_store is null then return case when tg_op='DELETE' then old else new end; end if;$old$,
    $new$if v_store is null or not exists(select 1 from public.stores where id=v_store) then
    return case when tg_op='DELETE' then old else new end;
  end if;$new$);
  if v_new=v_def then
    raise exception '0139: 계산 기준 쓰기 가드의 매장 존재 확인 위치를 찾지 못했습니다';
  end if;
  execute v_new;

  v_def:=replace(pg_get_functiondef('public.sales_lifecycle_publish_basis_after_write()'::regprocedure),chr(13),'');
  v_new:=replace(v_def,
    $old$if v_store is null or not exists(select 1 from public.sales_lifecycle_cutover_state
    where store_id=v_store and phase='active') then$old$,
    $new$if v_store is null or not exists(select 1 from public.stores where id=v_store)
    or not exists(select 1 from public.sales_lifecycle_cutover_state
    where store_id=v_store and phase='active') then$new$);
  if v_new=v_def then
    raise exception '0139: 계산 기준 발행 가드의 매장 존재 확인 위치를 찾지 못했습니다';
  end if;
  execute v_new;
end
$patch$;

comment on function public.sales_lifecycle_guard_basis_write() is
  '계산 기준 변경을 매장 쓰기 잠금과 전환 상태로 보호한다. 부모 매장 purge cascade는 잠금 행을 재생성하지 않는다.';
comment on function public.sales_lifecycle_publish_basis_after_write() is
  '활성 매장의 계산 기준 변경 뒤 다음 미개점일 판본을 발행한다. 부모 매장 purge cascade는 발행하지 않는다.';

commit;
