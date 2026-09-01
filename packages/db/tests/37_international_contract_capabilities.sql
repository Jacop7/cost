-- ═══════════════════════════════════════════════════════════════
-- 37 · 국제 출시 capability 최종 제품 계약
--
-- 0189 제품 전환 뒤 클라이언트가 실제로 받는 최소 판본과 활성 상태를 잰다.
-- ═══════════════════════════════════════════════════════════════

do $t$
declare v jsonb := app_capabilities();
begin
  perform pg_temp.eq('capability 계약 판본', (v->>'contract_version')::numeric, 1, 0);
  perform pg_temp.eq_t('최소 지원 앱 버전', v->>'minimum_supported_app_version', '0.2.0');
  perform pg_temp.eq_t('국제 세금 계약 판본', v#>>'{international_tax,contract_version}', 'international_tax_v1');
  perform pg_temp.ok('국제 세금 읽기와 쓰기가 함께 열려 있다',
    (v#>>'{international_tax,read_enabled}')::boolean
    and (v#>>'{international_tax,write_enabled}')::boolean);
  perform pg_temp.eq_t('국제 세금 쓰기 최소 앱 판본',
    v#>>'{international_tax,minimum_write_app_version}','0.2.0');

  perform pg_temp.eq('현행 포함가 유효 세율 계산은 그대로다',
    tax_of(12000, 'included', '[{"name":"부가세","rate":9.0909090909}]'::jsonb),
    12000 * 10 / 110.0, 0.01);
end
$t$;

select pg_temp.ok('authenticated는 capability를 읽는다',
  has_function_privilege('authenticated', 'public.app_capabilities()', 'execute'));
select pg_temp.ok('service_role도 capability를 읽는다',
  has_function_privilege('service_role', 'public.app_capabilities()', 'execute'));
select pg_temp.ok('anon은 capability를 읽지 못한다', not
  has_function_privilege('anon', 'public.app_capabilities()', 'execute'));
