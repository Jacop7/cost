begin;

-- 레시피 판매 상태는 save_recipe의 active 패치가 유일한 앱 쓰기 문이다.
-- 별도 deactivate_recipe facade는 모바일 호출부가 없어 앱 실행 권한을 회수한다.
revoke execute on function public.deactivate_recipe(uuid) from authenticated;

commit;
