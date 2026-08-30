# P0-4-OPS-SEC-009-STAGING-SEAL-001 공동 작업 장부

> 선행 `P0-4-OPS-MONITORING-COMMIT-004` r001이 남긴 선택 Finding
> `P0-4-OPS-SEC-009`를 스테이징 훈련 전에 봉인한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-o001`
- target_commit_sha: `43cd98a88e91d441cc9acf8d3898ae9716874422`
- predecessor_task_id: `P0-4-OPS-MONITORING-COMMIT-004`
- predecessor_review_sha256: `e925e37eebb6b65e996c2cf54ac7d250da05010432092f9cc7e4fdd8420fa65e`
- inherited_finding_ids: `P0-4-OPS-SEC-009`
- artifact_hashes: 실행기의 COMMIT manifest가 target commit의 파일별 Git blob·SHA-256을 봉인한다.
- changed_artifact_paths: `packages/db/tests/36_operations_monitoring.sql` 한 파일. 0177 원문은 변경하지 않고 이번 봉인 입력에 처음 직접 포함한다.
- 충족해야 할 요구사항·불변식: 두 운영 관측 definer 함수의 `prosecdef=true`, 정확한 고정 `search_path`, 앱 롤 권한 회수, `service_role` 경계, 제품 원장·계산 불변, staging·production 미적용.
- 실행한 테스트·현재 증거: 새 단언 baseline 통과, `SECURITY INVOKER`·잘못된 `search_path` 사보타주 각각 적중, 권위 작업 루트 `corepack pnpm verify` 6/6 통과. 정확한 target commit 분리 checkout 검증은 CODEX 턴으로 연결한다.
- 사람 결정이 필요한 항목: 없음. staging 비밀값·migration·Edge·GitHub secret 적용과 실패→회복 훈련은 이 검수 및 보호 CI 뒤 별도 단계다.
- next_review_request: `FABLE_RECHECK`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `43cd98a88e91d441cc9acf8d3898ae9716874422`
- finding_ids: `P0-4-OPS-SEC-009`
- 실행 명령: 정확한 target commit 분리 checkout에서 `corepack pnpm install --frozen-lockfile --config.confirmModulesPurge=false`와 `corepack pnpm verify`; 권위 작업 루트에서 시험 36 단독 실행, `SECURITY INVOKER`·잘못된 `search_path` 트랜잭션 사보타주, `corepack pnpm fable:check`; migration 장부·`fresh_%` 대조.
- 종료 코드·결과: exact target verify 6/6 exit 0, DB 36/36, core 178, mobile 212, CLI·ACL 보안, 새 DB·2세션 경합·locale parity, 업그레이드 13/13, 웹 번들 통과. 사보타주 2종 모두 새 `운영 관측 definer 함수 둘은 고정 search_path를 쓴다` 단언에서 FAIL로 적중했다.
- 함수 카탈로그 실측: `ops_health_status()`와 `report_client_rpc_error(text,text,text)` 모두 `prosecdef=t`, `proconfig={"search_path=pg_catalog, public, ops"}`다.
- 봉인 입력: 이번 Task의 `artifact_paths`에 0176·0177 migration 원문과 시험 34·36을 포함했다. 특히 선행 검수에서 빠졌던 `20260831000177_operations_health_signal_separation.sql`을 직접 읽을 수 있다.
- 장부 상태: migration 파일·개발 DB 장부 166/166, 최신 0177, 누락·초과 0, `fresh_%` 0개.
- 변경 경계: target은 시험 36 한 파일에 단언 1개만 추가했다. 제품 원장·계산·migration·Edge 동작 변경은 0개다.
- remote_state: staging과 production은 접근·적용하지 않았다.
- next_review_request: `FABLE_RECHECK`
