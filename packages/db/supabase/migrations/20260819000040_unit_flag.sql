-- ════════════════════════════════════════════════════════════════
-- 0040 · unit_normalized 를 "기준단위로 기록됨" 표식으로 확정
--
-- 발견 경위: packages/db/tests/04_ledger.sql (DB 회귀 스위트 첫 실행)
--
-- 무엇이 잘못됐나
--   0034 가 원장 단위를 기준단위(g/ml/개)로 통일하면서 `unit_normalized` 를 심었다.
--   E1·E2·E5 는 true 를 쓰는데, 판매 소진(reconcile_sales_consumption, 0028)은
--   0034 보다 먼저 쓰인 함수라 이 컬럼을 채우지 않는다 → 기본값 false 로 쌓였다.
--   시드 기준 consume 814건이 전부 false 다.
--
-- 값은 멀쩡하다. 04_ledger 의 "식재료 18종 전부 원장 합계 = 재고" 가 통과하므로
-- 이 814건은 이미 기준단위다. **표식만 거짓말을 하고 있다.**
--
-- 왜 고쳐야 하나
--   0034 는 `and not ev.unit_normalized` 로 재실행을 막는다. 같은 패턴의 보정
--   마이그레이션이 앞으로 하나만 더 들어와도 이 814건을 per_volume 으로 한 번 더
--   곱해 원장이 통째로 깨진다. 지금은 잠복이지만 터지면 복구가 어렵다.
--
-- 결정: 컬럼의 뜻을 "이 행의 count_delta 는 기준단위다"로 고정한다.
--   전 코드 경로가 기준단위로 쓰므로 기본값을 true 로 바꾼다 — 컬럼을 빠뜨린
--   미래의 writer 도 자동으로 옳은 값을 갖는다.
-- ════════════════════════════════════════════════════════════════

update inventory_events set unit_normalized = true where not unit_normalized;

alter table inventory_events alter column unit_normalized set default true;

comment on column inventory_events.unit_normalized is
  'count_delta 가 기준단위(g/ml/개)임을 뜻한다. 0034 이후 전 경로가 기준단위로 쓰므로 항상 true 다(0040).';
