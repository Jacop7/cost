
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
