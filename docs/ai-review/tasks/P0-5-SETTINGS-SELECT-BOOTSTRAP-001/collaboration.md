# P0-5-SETTINGS-SELECT-BOOTSTRAP-001 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `ff342e0890c4d05562d62ebfd14c6bd9246f4dd2`
- predecessor: `null`

스테이징 첫 전체 적용에서 로컬 기본 권한이 가렸던 `settings SELECT` 부재가 드러났다. 이미 적용된
`0001~0163`은 불변으로 두고 아직 미적용인 `0164`와 독립 업그레이드 회귀만 검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `ff342e0890c4d05562d62ebfd14c6bd9246f4dd2`
- changed_artifact_paths: `0164`, `upgrade-check.sh`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: 호스티드 사전 권한과 무관한 settings 읽기 부트스트랩, 직접 쓰기 네 종 폐쇄, 기존 RLS·판본 RPC 유지, 0001~0163 불변, 운영 미접근과 스테이징 실패 폐쇄 상태의 정직한 기록
- 이번에 바꾼 내용: `0164`가 `authenticated`에 settings SELECT를 명시적으로 부여한 뒤 INSERT·UPDATE·DELETE·TRUNCATE를 회수한다. 업그레이드 시나리오 ⑩은 0163 DB에서 SELECT를 먼저 회수해 호스티드 상태를 만든 뒤 최종 권한이 `t|f|f|f|f`인지 확인한다. 스테이징 중단과 재계획, 판별력, 전체 검증 결과를 기존 증거 문서에 추가했다.
- 집중 검토 질문: SELECT 부여가 RLS를 우회하거나 직접 쓰기를 여는가? 권한 회수 순서와 사후조건이 호스티드 역할 구성에서도 정확한가? 업그레이드 시험이 SELECT 부재와 쓰기 잔존을 실제로 구별하는가? 이미 적용된 migration 또는 운영 DB를 건드렸다고 과장하거나 누락한 기록이 있는가?
- 실행한 테스트·현재 증거: 0163 상태 집중 시험에서 `f|t|t|t|t → t|f|f|f|f`, 보정 전 0164 종료 코드 3과 호스티드 동일 오류, 정확한 target clean checkout의 `corepack pnpm verify` 6/6·DB 34/34·경합·업그레이드 10/10·웹 번들, `fresh_%` 0개.
- 사람 결정이 필요한 항목: 없음. 운영은 범위 밖이고 스테이징 재적용·원격 ACL audit은 검수와 보호 CI 뒤 별도 게이트다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=ca371309c71647464c619e9b9e3715d7d107bc2b345acf77e3ab3976b2e6ee0f -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `ca371309c71647464c619e9b9e3715d7d107bc2b345acf77e3ab3976b2e6ee0f`
- target_commit_sha: `ff342e0890c4d05562d62ebfd14c6bd9246f4dd2`
- input_files_sha256: `5f4438f72008f6fee2cc14b56c6a52aff4750beb63b9b06f1c49e00164f4ad34`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P0-5-SSB-001-SEC-001, P0-5-SSB-001-SEC-002, P0-5-SSB-001-SEC-003, P0-5-SSB-001-SEC-004
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

0164의 권한 부트스트랩 자체는 보안상 건전하다. `grant select` 뒤 `revoke insert, update, delete, truncate`를 anon·authenticated 모두에서 수행하고, 쓰기 정책 3개와 동기화 트리거를 제거하며, save_settings·save_store_tax는 SECURITY DEFINER + `set search_path` + 첫 줄 `assert_my_store`로 매장 경계를 유지한다. `has_table_privilege`는 PUBLIC 경유 권한까지 반영하므로 사후조건이 호스티드 역할 구성에서도 실질 권한을 판정한다. 직접 쓰기 문 재개방이나 RLS 우회는 발견되지 않았고, 스테이징 0163 상태·보정 미적용·운영 미접근 기록은 과장 없이 정직하다. 그러나 (1) 증거 문서는 verify 6/6·업그레이드 10/10을 `fb5b4b08`에 결속하고 있어 task target `ff342e08`과 다르며, 0164·upgrade-check.sh의 Git blob OID·SHA-256 결속도 없다 — 요구사항 6 "정확한 target commit의 verify 6/6 증거"가 문서상 충족되지 않는다(Major). (2) 0164 사후조건은 TRUNCATE를 검사하지 않아 요구사항 2의 네 종 폐쇄를 migration 스스로 증명하지 못한다(Minor). (3) SELECT 부여가 의존하는 settings RLS 활성·읽기 정책 존재를 사후조건이 단언하지 않는다(Minor). (4) 업그레이드 ⑩은 사전 상태를 SELECT=f만 확인하고 쓰기 4종 열림(f|t|t|t|t)을 단언하지 않아 회수 절반이 공허 통과할 여지가 있다(Minor). Major 1건으로 CHANGES_REQUIRED.

### 공동 편집 제안 색인

- P0-5-SSB-001-EDIT-001: ADD `packages/db/supabase/migrations/20260826000164_settings_lockdown.sql` ·   if not has_table_privilege('authenticated', 'public.settings', 'select') then · 원문은 review.md 참조
- P0-5-SSB-001-EDIT-002: REPLACE `packages/db/scripts/upgrade-check.sh` ·   "select has_table_privilege('authenticated','public.settings','select');") · 원문은 review.md 참조
- P0-5-SSB-001-EDIT-003: ADD `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md` · ### 정확한 commit 전체 검증 · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `ca371309c71647464c619e9b9e3715d7d107bc2b345acf77e3ab3976b2e6ee0f`
- target_commit_sha: `710176c267a9874e58152880ade135970738f76a`
- changed_artifact_paths: `20260826000164_settings_lockdown.sql`, `upgrade-check.sh`, `P0-5 evidence`
- resulting_input_files_sha256: `successor r001 manifest에서 실행기가 봉인·검증 예정`

### P0-5-SSB-001-SEC-001
- disposition: `APPLIED`
- 적용 위치: P0-5 evidence의 `FABLE-SEC r001 지적 보정과 판본 결속`
- 적용 내용: 정확한 보정 구현 commit `710176c`에서 verify 6/6을 다시 실행하고 0164·upgrade-check Git blob OID·SHA-256, baseline migration diff, 최초 target과 이전 검증 commit 차이를 기록했다.
- 실행한 테스트: clean checkout `corepack pnpm verify` 6/6, DB 34/34, 업그레이드 10/10, fresh 0.
- 필요한 재검수: commit·blob·diff 결속 확인.

### P0-5-SSB-001-SEC-002
- disposition: `APPLIED`
- 적용 위치: 0164 사후조건
- 적용 내용: authenticated의 INSERT·UPDATE·DELETE와 함께 TRUNCATE 유효 권한도 검사한다.
- 실행한 테스트: PUBLIC TRUNCATE 부여 뒤 0164가 종료 코드 3과 정확한 직접 쓰기 오류로 중단.
- 필요한 재검수: PUBLIC 경유 TRUNCATE 탐지 확인.

### P0-5-SSB-001-SEC-003
- disposition: `APPLIED`
- 적용 위치: 0164 사후조건
- 적용 내용: settings의 `relrowsecurity=true`와 읽기 정책 `polcmd='r'` 존재를 단언한다.
- 실행한 테스트: RLS 비활성 뒤 0164가 종료 코드 3과 정확한 RLS 오류로 중단.
- 필요한 재검수: SELECT 부여의 RLS 전제 확인.

### P0-5-SSB-001-SEC-004
- disposition: `APPLIED`
- 적용 위치: upgrade-check.sh 시나리오 ⑩
- 적용 내용: 사전 권한 5튜플이 정확히 `f|t|t|t|t`인지 확인하고 아니면 전제 실패로 중단한다.
- 실행한 테스트: 업그레이드 10/10, 쓰기까지 미리 회수하면 `f|f|f|f|f`라 전제 불일치 확인.
- 필요한 재검수: 회수 경로의 비공허성 확인.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- verified_commit_sha: `710176c267a9874e58152880ade135970738f76a`
- finding_ids: `P0-5-SSB-001-SEC-001`, `P0-5-SSB-001-SEC-002`, `P0-5-SSB-001-SEC-003`, `P0-5-SSB-001-SEC-004`
- focused_contracts: 정상 권한 `f|t|t|t|t → t|f|f|f|f`; PUBLIC TRUNCATE와 RLS 비활성은 각각 정확한 0164 사후조건에서 종료 코드 3; 쓰기 선회수는 시나리오 ⑩ 전제와 불일치.
- full_gate: 정확한 구현 commit clean checkout에서 `corepack pnpm verify` 6/6 exit 0. DB 34/34, core 177(2 skip), mobile 199, ACL 보안, 새 DB·2세션 경합·locale parity, 업그레이드 10/10, 웹 번들 포함.
- audit_integrity: r001 CHANGES_REQUIRED 원본은 수정·삭제하지 않았고, 수정·검증·Git blob 결속은 기존 증거 문서에 append했다.
- remote_state: 운영 미접근·미변경. 스테이징은 0163까지이며 보정은 아직 미적용.
- remaining_required_finding_ids: `P0-5-SSB-001-SEC-001`, `P0-5-SSB-001-SEC-002`, `P0-5-SSB-001-SEC-003`, `P0-5-SSB-001-SEC-004`
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `P0-5-SETTINGS-SELECT-BOOTSTRAP-001`
- predecessor_round: `r001`
- predecessor_task_sha256: `61086ce68706df8c45fad3c12b53f5e4f2865ab885f5c4b2cd21ba4c3b94ba24`
- predecessor_manifest_sha256: `4fd0a8e7dea8d2bfedbce27c7fc88ed77d24c846f0e9714ac7d44013b25a8e4b`
- predecessor_review_sha256: `ca371309c71647464c619e9b9e3715d7d107bc2b345acf77e3ab3976b2e6ee0f`
- predecessor_run_sha256: `d84cbced89253a11f0ad6881121365d830173f236180900da83fda3bce617699`
- finding_registry_sha256: `b00966ae46cd122584580c8ba24c110df127745c269ed579359e8934aa16a638`
- successor_task_id: `P0-5-SETTINGS-SELECT-BOOTSTRAP-002`
- successor_target_commit_sha: `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`
- next_review_request: `FABLE_RECHECK`
