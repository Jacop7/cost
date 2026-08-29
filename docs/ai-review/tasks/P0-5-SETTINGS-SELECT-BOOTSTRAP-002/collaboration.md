# P0-5-SETTINGS-SELECT-BOOTSTRAP-002 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`
- predecessor: `P0-5-SETTINGS-SELECT-BOOTSTRAP-001/r001`

이전 보안 검수의 필수 Finding 4건을 같은 ID로 재검수한다. 수정 전 검수와 실패 기록은 그대로
보존하며, 정확한 보정 구현 commit과 증거 commit을 대상으로만 판정한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`
- changed_artifact_paths: `20260826000164_settings_lockdown.sql`, `upgrade-check.sh`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: 정확한 commit·blob·시험 결속, 직접 쓰기 네 종 폐쇄, RLS·읽기 정책 전제, 업그레이드 사전 상태 비공허성, 0001~0163 불변, 운영 미접근
- Finding별 답변: `P0-5-SSB-001-SEC-001`은 710176c의 verify 6/6·blob OID·SHA-256·baseline migration diff로 결속했다. `P0-5-SSB-001-SEC-002`는 TRUNCATE까지 사후조건에 포함하고 PUBLIC 경유 사보타주로 확인했다. `P0-5-SSB-001-SEC-003`은 RLS 활성과 읽기 정책 존재를 단언하고 RLS 비활성으로 판별력을 확인했다. `P0-5-SSB-001-SEC-004`는 사전 권한을 정확히 f|t|t|t|t로 못 박고 쓰기 선회수 상태를 전제 실패로 구분했다.
- 실행한 테스트·현재 증거: 710176c clean checkout `corepack pnpm verify` 6/6, DB 34/34, 업그레이드 10/10, fresh 0. 정상 f|t|t|t|t→t|f|f|f|f, PUBLIC TRUNCATE와 RLS 비활성 각각 0164 중단, 쓰기 선회수는 전제 불일치.
- 사람 결정이 필요한 항목: 없음. 운영은 범위 밖이며 스테이징 적용은 재검수와 보호 CI 뒤 별도 게이트다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r001 sha256=c535575e84447af3329a36698ac0f21eaeb3a5d775dc3a090cad1e0c6a2851f2 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `c535575e84447af3329a36698ac0f21eaeb3a5d775dc3a090cad1e0c6a2851f2`
- target_commit_sha: `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`
- input_files_sha256: `fbb172193155bdaf8e6734a1e45713bed3b04be7f0868c0b13c642f61862034b`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

predecessor Finding 4건을 같은 ID로 재검증했고 모두 VERIFIED다. (SEC-001) 증거 문서 389~451행이 최종 보정 commit `710176c`의 verify 6/6·DB 34/34·업그레이드 10/10·fresh_% 0개를 commit SHA와 함께 기록하고, 0164·upgrade-check.sh의 Git blob OID·SHA-256 표를 고정했으며, 그 값(`3f0cb476…`/`f9151ab0…`, `1754c179…`/`3c82982f…`)이 이번 target `e1da2a5c`의 검수 입력 manifest와 정확히 일치한다 — 즉 검증된 blob과 검수 대상 blob이 동일함을 검수자가 독립 확인할 수 있다. baseline diff가 0164 한 파일임과 fb5b4b08↔ff342e08 차이가 문서뿐임도 명시돼 장부·문서 모순이 해소됐다. 이전 실패 기록(331~387행)은 덮어쓰지 않고 보존됐다. (SEC-002) 0164 사후조건 178~183행이 insert·update·delete·truncate 네 종을 `has_table_privilege`로 검사하고, PUBLIC TRUNCATE 사보타주 시 종료 코드 3으로 중단한 기록이 있다. (SEC-003) 187~196행이 `relrowsecurity`=true와 polcmd='r' 정책 존재를 단언하고, RLS 비활성 사보타주 중단 기록이 있다. 197행은 polcmd<>'r'로 ALL('*') 정책까지 쓰기로 취급해 빈틈이 없다. (SEC-004) upgrade-check.sh ⑩ 446~455행이 사전 5튜플을 정확히 `f|t|t|t|f|`가 아닌 `f|t|t|t|t`로 요구하고 불일치 시 '전제가 안 섰다' FAIL 처리하며, 쓰기 선회수 상태(f|f|f|f|f)가 전제 실패로 구분됨을 문서가 기록한다. 보안 관점의 신규 결함은 없다: SELECT 부여는 RLS·읽기 정책 단언에 결속되고, save_settings·save_store_tax는 definer + search_path + 첫 줄 assert_my_store를 유지하며, 스테이징 0163·운영 미접근 기록은 정직하다. 사소한 보완으로 710176c→e1da2a5c 사이 변경이 문서뿐임을 한 줄 명시하는 proposed_edit을 제안한다(비차단). Blocker~Minor 미해결 없음 → PASS. 외부 게이트(보호 CI·스테이징 적용)는 여전히 OPEN이다.

### 공동 편집 제안 색인

- P0-5-SSB-002-EDIT-001: ADD `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md` · 아래 값은 워킹트리가 아니라 `710176c267a9874e58152880ade135970738f76a`의 Git blob bytes를 · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- verified_commit_sha: `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`
- finding_ids: `P0-5-SSB-001-SEC-001`, `P0-5-SSB-001-SEC-002`, `P0-5-SSB-001-SEC-003`, `P0-5-SSB-001-SEC-004`
- focused_contracts: 710176c 구현의 clean checkout verify 6/6(DB 34/34, 업그레이드 10/10, fresh 0), 0164·upgrade-check blob/SHA 결속, PUBLIC TRUNCATE·RLS 비활성 사보타주, 정확한 사전·사후 권한 5튜플.
- result: FABLE-SEC r001 PASS이며 네 predecessor Finding 모두 같은 ID와 previous_finding_id로 VERIFIED. 필수 미종결 Finding 0개.
- reviewer_usage: 이번 회차 1.148754달러 상당, predecessor 1.96737달러 상당과 합계 3.116124달러 상당으로 Task 상한 4.00 이내.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`

## AI_DEPUTY_GATE_DECISION · turn-o001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-c001`
- verified_review_sha256: `c535575e84447af3329a36698ac0f21eaeb3a5d775dc3a090cad1e0c6a2851f2`
- verified_run_sha256: `cf767cba2b1591fe88eaf594625a72741a95175c010f3ec61a9cea2def6fb454`
- verified_input_files_sha256: `fbb172193155bdaf8e6734a1e45713bed3b04be7f0868c0b13c642f61862034b`
- artifact_hashes: `target manifest의 artifact_paths·input_files_sha256로 봉인됨; 0164 blob 3f0cb476…/SHA f9151ab0…, upgrade-check blob 1754c179…/SHA 3c82982f…`
- gate_anchor_commit_sha: `d778bbc2e29a1170ca2c068cf1b5915c30992952`
- required_external_gate: `동일 decision commit SHA의 protected-gate 성공, 이후 main fast-forward와 main 동일 SHA protected-gate 성공`
- open_required_finding_ids: `[]`
- optional_finding_backlog_ids: `[]`
- Codex 실행 증거: `turn-c001`; 전체 verify 6/6·DB 34/34·업그레이드 10/10·fresh DB 0개
- requested_outcome: `MERGE_CANDIDATE`
- 종결 요청 또는 사람 이관 근거: 로컬 구현과 Fable 후속 재검수는 PASS이고 predecessor 필수 Finding 4건이 모두 VERIFIED다. exact-SHA 보호 CI를 통과하면 main fast-forward 및 스테이징 적용 후보로 승인한다.
