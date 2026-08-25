-- ════════════════════════════════════════════════════════════════
-- 0111 · 안전재고는 늘 기준단위다 — 새 행도 그렇게 태어나야 한다
--
-- 0073 이 안전재고를 구매단위(개수)에서 **기준단위**(g/ml/개)로 옮겼다. 그런데
-- 옮기기만 하고 **새로 생기는 행의 기본값은 `false` 로 뒀다.**
--
--     alter table ingredients add column ... safety_stock_is_base boolean not null default false;
--     update ... set safety_stock_is_base = true where not safety_stock_is_base;   ← 있던 행만
--
-- 그래서 지금 있는 19개는 전부 `true` 인데, 오늘 식재료를 새로 만들면 `false` 다.
-- 같은 컬럼이 행마다 다른 뜻을 갖는다 — 화면은 `safety_stock_is_base` 를 보고
-- `× per_volume` 을 할지 말지 정하므로, 안전재고가 1,000배 어긋난다.
--
-- ⚠ 별도 DB 에 마이그레이션 101개 + 시드를 새로 깔아 보고서야 드러났다.
--   개발 DB 가 멀쩡했던 건 0073 이 **이미 있던 행을 옮겨 적었기** 때문이고,
--   새 DB 에서는 마이그레이션이 시드보다 먼저 도니 옮길 행이 없다.
--   실측(새 DB): 대파 안전재고가 `2000` 이 아니라 `2` 로 남았다.
--   그 상태면 재고 1,900g 을 `안전재고 2g` 과 견주게 되어 **소진 임박이 영영 안 뜬다.**
--
-- 0073 이후로 이 값은 **항상** 기준단위다. 기본값을 그렇게 바꾼다.
-- (seed.sql 도 함께 고쳤다 — 이제 구매단위 개수가 아니라 기준단위로 적는다.)
-- ════════════════════════════════════════════════════════════════

alter table ingredients alter column safety_stock_is_base set default true;

-- 혹시 남아 있는 `false` 가 있으면 0073 과 같은 규칙으로 옮긴다.
-- 지금 개발 DB 에는 없지만, 0073 과 이 파일 사이에 만들어진 행이 있을 수 있다.
update ingredients
   set safety_stock = safety_stock * coalesce(nullif(per_volume, 0), 1),
       safety_stock_is_base = true
 where not safety_stock_is_base;

comment on column ingredients.safety_stock is
  '안전재고. **항상 기준단위**(g/ml/개)다(0073·0111). 구매단위 개수가 아니다 — '
  '팩 용량만 고쳐도 기준이 따라 움직이면 안 되기 때문이다. '
  '재고 상태 판정은 packages/core 의 stockStateOf 한 곳이며 경계는 `이하`(<=)다.';

comment on column ingredients.safety_stock_is_base is
  '0073 이전 값(구매단위)과 이후 값(기준단위)을 가르던 표식. 0111 부터 기본값이 true 이고 '
  'false 인 행은 없다. 새 코드에서 이 값을 보고 분기할 필요는 없다 — 남겨 둔 건 이력 때문이다.';

do $chk$
declare v_bad int;
begin
  select count(*) into v_bad from ingredients where not safety_stock_is_base;
  if v_bad > 0 then
    raise exception '0111: 구매단위 안전재고가 % 개 남았습니다', v_bad using errcode = '45003';
  end if;
  -- 검산: 대파 안전재고는 2,000g 이다(2망 × 1,000g).
  if (select safety_stock from ingredients
       where name = '대파' and store_id = '00000000-0000-0000-0000-0000000000b1') is distinct from 2000 then
    raise notice '0111: 대파 안전재고가 2000 이 아닙니다 (데모 매장이 아니면 정상)';
  end if;
end
$chk$;
