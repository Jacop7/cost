# P0-4-OPS-SEC-009-STAGING-SEAL-002 공동 작업 장부

> 이전 실행의 의미 검증 거부 후보는 공식 입력으로 승격하지 않는다.
> migration 원문과 수정된 시험을 대상으로 독립 보안 검수를 새로 수행한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `379dd6cb0ce09814cfdb2671205e22ce1d965fd1`
- predecessor_task_id: `null`
- inherited_finding_ids: 없음
- artifact_hashes: 실행기의 COMMIT manifest가 target commit의 파일별 Git blob·SHA-256을 봉인한다.
- changed_artifact_paths: `packages/db/tests/36_operations_monitoring.sql` 한 파일. 0176·0177 migration 원문과 제품 코드는 변경하지 않았다.
- 충족해야 할 요구사항·불변식: 두 운영 관측 definer 함수의 `prosecdef=true`, 정확한 고정 `search_path`, 앱 롤 권한 회수, `service_role` 경계, NULL을 포함한 사보타주 판별력, 제품 원장·계산 불변, staging·production 미적용.
- 실행한 테스트·현재 증거: 한 함수 NULL·두 함수 NULL·invoker·잘못된 경로 네 사보타주 적중, 정확한 코드 commit 분리 checkout `corepack pnpm verify` 6/6 통과, target은 그 뒤 실패 실행 원본만 append-only로 보존했다.
- 사람 결정이 필요한 항목: 새 Fable 호출 비용 상한 승인. 승인 전에는 실행하지 않는다.
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s001`
- target_commit_sha: `379dd6cb0ce09814cfdb2671205e22ce1d965fd1`
- finding_ids: 없음 — 공식 predecessor가 없는 새 보안 검수이며 새 문제만 보고한다.
- 실행 명령: 정확한 코드 commit `ecdcd33f539e3172b6e0a593f63f38bead2b5020` 분리 checkout에서 `corepack pnpm install --frozen-lockfile --config.confirmModulesPurge=false`와 `corepack pnpm verify`; 개발 DB에서 시험 36 baseline과 한 함수 `RESET search_path`·두 함수 `RESET search_path`·`SECURITY INVOKER`·잘못된 `search_path` 네 사보타주; `corepack pnpm fable:check`.
- 종료 코드·결과: exact code commit verify 6/6 exit 0, DB 36/36, core 178, mobile 212, CLI·ACL 보안, 새 DB·2세션 경합·locale parity, 업그레이드 13/13, 웹 번들 통과. 네 사보타주는 모두 새 단언에서 FAIL로 적중했고 복구 뒤 baseline이 다시 통과했다.
- 함수 카탈로그 실측: `ops_health_status()`와 `report_client_rpc_error(text,text,text)` 모두 `prosecdef=t`, `proconfig={"search_path=pg_catalog, public, ops"}`다.
- NULL 구멍 보강: `bool_and(p.proconfig @> ...)`는 한 함수의 `proconfig=NULL`을 건너뛰므로 `bool_and(coalesce(p.proconfig, '{}'::text[]) @> ...)`로 보강했다.
- target 경계: target은 exact code commit 뒤 검증 실패 run·candidate 원본만 append-only로 추가했다. 후보는 공식 review·Finding·후속 입력으로 승격하지 않았고 제품 코드 diff는 0개다.
- 장부 상태: migration 파일·개발 DB 장부 166/166, 최신 0177, `fresh_%` 0개.
- remote_state: staging과 production은 접근·적용하지 않았다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=01730cc0bdd65817b31926543865040e59dbeed8f3c895002669500af2a25421 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `01730cc0bdd65817b31926543865040e59dbeed8f3c895002669500af2a25421`
- target_commit_sha: `379dd6cb0ce09814cfdb2671205e22ce1d965fd1`
- input_files_sha256: `b56f603ca097d7b9e8401ed956428aaa21037784f98d3c098a8b1832d2b9f851`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

독립 보안 검수 결과 PASS, 신규 Finding 없음. (1) 고정 search_path·definer 확인: 0176의 report_client_rpc_error(70–78행)와 ops_health_status(146–150행), 0177의 재정의(9–13행) 모두 security definer이고 set search_path = pg_catalog, public, ops를 원문에서 직접 확인했다. pg_catalog가 선두라 카탈로그 함수 가장(shadowing)이 불가능하고, 두 함수 본문의 모든 릴레이션 참조는 ops.·cron.으로 스키마 한정되어 있으며 비한정 이름은 CTE·별칭뿐이라 암묵적 pg_temp 릴레이션 탐색도 악용 경로가 없다. auth.uid()도 스키마 한정 호출이다. (2) 시험 36의 사보타주 판별력: 36_operations_monitoring.sql 18–27행 단언이 count(*)=2, bool_and(prosecdef), bool_and(coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, ops'])를 요구한다. coalesce 보강으로 한 함수 proconfig NULL이 bool_and에서 건너뛰어지지 않고 false가 되므로, 한 함수 NULL·두 함수 NULL·SECURITY INVOKER·잘못된 search_path 네 사보타주가 모두 실패로 적중한다. 이는 Codex의 네 사보타주 FAIL·복구 후 baseline 재통과 증거와 일치한다. (3) 권한 경계: ops 스키마·두 테이블은 public/anon/authenticated/margincook_rpc_executor에서 회수되고 service_role만 접근하며, ops_health_status·purge_entity_changes는 service_role 전용이고 0176(281–301행)·0177(132–149행) 자체 검증 블록과 시험 36 13–16행·34의 definer 전수 검사(37–46행)가 이를 고정한다. report_client_rpc_error는 authenticated에 열리지만 auth.uid() 필수, 서버 재판정(is_expected_rpc_error), advisory lock 직렬화, 15분 20건 상한, 형태 제약된 code/detail/platform만 저장해 원문·PII가 남지 않고, 0177은 client-reported 신호를 status 결정에서 분리해 비권위 warning으로만 노출한다. (4) 경계 준수: 변경 파일은 시험 36 하나뿐이고 run.mjs가 36을 포함해 종료코드로 실패를 판정하며, upgrade-check.sh 565–567·629–638행의 ops_health_status 단언과 정합한다. staging·production 접근 흔적 없음. PASS는 외부 gate를 닫지 않으며 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `379dd6cb0ce09814cfdb2671205e22ce1d965fd1`
- verdict: `PASS`
- finding_ids: 없음
- disposition: `ACCEPTED`
- 검수 결과: 0176·0177의 두 `SECURITY DEFINER` 함수는 고정 `search_path=pg_catalog, public, ops`, 스키마 한정 참조, 앱 롤 권한 회수와 service_role 경계를 만족한다.
- 회귀시험 결과: `coalesce(p.proconfig, '{}'::text[])` 보강이 한 함수 NULL·두 함수 NULL·invoker·잘못된 경로 네 사보타주를 모두 차단한다.
- 로컬 게이트: exact code commit `ecdcd33f539e3172b6e0a593f63f38bead2b5020`에서 `corepack pnpm verify` 6/6, DB 36/36, core 178, mobile 212, 업그레이드 13/13, `fresh_%` 0개.
- 원격 경계: staging·production은 미접근·미적용이다. 이 PASS는 외부 gate를 자동으로 닫지 않으며, 현재 branch의 정확한 decision commit 보호 CI 성공 뒤에만 main 병합과 스테이징 훈련으로 진행한다.
- next_review_request: 없음
