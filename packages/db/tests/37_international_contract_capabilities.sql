-- ═══════════════════════════════════════════════════════════════
-- 37 · INTL-1A 국제 출시 계약과 비활성 capability 기준선
--
-- 이 단계는 다음 schema를 위한 문만 만든다. 현행 0090 세금 계산·저장은 바꾸지 않는다.
-- ═══════════════════════════════════════════════════════════════

do $t$
declare v jsonb := app_capabilities();
begin
  perform pg_temp.eq('capability 계약 판본', (v->>'contract_version')::numeric, 1, 0);
  perform pg_temp.eq_t('최소 지원 앱 버전', v->>'minimum_supported_app_version', '0.1.0');
  perform pg_temp.eq_t('국제 세금 계약 판본', v#>>'{international_tax,contract_version}', 'international_tax_v1');
  perform pg_temp.ok('국제 세금 읽기는 아직 꺼져 있다', (v#>>'{international_tax,read_enabled}')::boolean is false);
  perform pg_temp.ok('국제 세금 쓰기는 아직 꺼져 있다', (v#>>'{international_tax,write_enabled}')::boolean is false);
  perform pg_temp.ok('비활성 쓰기의 최소 앱 버전을 지어내지 않는다',
    jsonb_typeof(v#>'{international_tax,minimum_write_app_version}') = 'null');

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
