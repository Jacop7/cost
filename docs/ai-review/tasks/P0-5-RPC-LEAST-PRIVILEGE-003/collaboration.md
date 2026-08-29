# P0-5-RPC-LEAST-PRIVILEGE-003 공동 작업 장부

> 001은 커밋 AGENTS blob 해시 사전 검사에서 차단됐다. 002의 두 회차는 같은 확정 커밋을
> 검수했지만 회차 실행 상한 2.00·1.39 USD에서 각각 RUN_FAILED로 종료됐다.
> 이 장부는 사용자가 승인한 새 총상한 8.00 USD와 같은 target commit으로 독립 보안 검수를 다시 시작한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `bebf4488306d0d6e4b3fe49169cde0298717e459`
- changed_artifact_paths: `0174 migration`, `admin-acl audit`, `seed`, `DB prelude·tests 07~34`, `packages/db/README.md`
- 충족해야 할 요구사항·불변식: authenticated 정확한 facade 64개, 내부 RPC 42501, 원장 쓰기 경로 0, auth.uid·RLS 매장 격리, 기존 원장·판본·경합 불변
- 이번에 바꾼 내용: 로그인·RLS 우회가 없는 `sikjae_rpc_executor`를 만들고 approved invoker facade만 이 역할의 SECURITY DEFINER로 전환했다. authenticated의 모든 함수 EXECUTE를 회수한 뒤 정확한 64개 facade만 다시 열었다. RLS 정책의 `my_store_ids()` 호출을 같은 매장 조건으로 인라인하고 원장 10개 표의 앱 쓰기 GRANT·정책을 전용 역할로 옮겼다. 백색상자 시험과 실제 앱 롤 공격면 시험을 분리했다.
- 집중 검토 질문: 실행 역할의 멤버십 방향과 RLS 보존이 안전한가? SECURITY DEFINER owner·search_path와 default privilege가 새 우회로를 만들지 않는가? facade·원장 허용 목록이 과소·과대 권한 없이 완결적인가? 기존 postgres definer와 service_role·cron 경로가 유지되는가?
- 실행한 테스트·현재 증거: `corepack pnpm verify` 6/6, 개발·새 DB 34/34, ACL metric 20개, 경합, locale parity, 업그레이드 9/9, 웹 번들. 내부 RPC·원장 UPDATE·역방향 멤버십 사보타주 3종이 잡혔고 원복 뒤 기준 시험이 통과했다.
- 사람 결정이 필요한 항목: 사용자는 R3 변경, FABLE-SEC 재검수, 새 Task 총상한 8.00 USD를 승인했다. 스테이징·운영 적용은 이 검수와 동일 SHA 보호 CI 전에는 하지 않는다.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `P0-5-FABLE-TASK-CAP-20260829`
- task_budget_usd_approved: `8.00`
- 결정: 기존 002의 회차 상한 실패 이력을 보존하고, 같은 확정 커밋을 대상으로 하는 새 FABLE-SEC 작업을 총상한 8.00 USD로 실행한다.
- 허용 범위·기한: P0-5-RPC-LEAST-PRIVILEGE-003 읽기 전용 검수, 2026-08-29 현재 작업 완료까지.
- 근거: 사용자가 전체 작업을 계속 진행하도록 명시적으로 승인했다.
- 승인자·시각: `USER · 2026-08-29T14:27:00+09:00`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=7838da4bf6cf538f94c0745a4a84d40c688ebcae928aa14c0472bad56bfb7924 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `7838da4bf6cf538f94c0745a4a84d40c688ebcae928aa14c0472bad56bfb7924`
- target_commit_sha: `bebf4488306d0d6e4b3fe49169cde0298717e459`
- input_files_sha256: `0dc06cd3b0fabcefbdd0ca8b3433dffd9c6bbc95b3749c23ce984aee1dddf363`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P05-SEC-EVIDENCE-HASH-MISMATCH, P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-FACADE-CROSS-STORE-TEST-GAP
- 선택 미종결 Finding: P05-SEC-HOSTED-ADMIN-OPTION-NOTE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

0174 설계 자체는 건전하다. sikjae_rpc_executor는 NOLOGIN·NOBYPASSRLS이고 authenticated→executor 멤버십이 없어 앱이 SET ROLE로 전환할 수 없으며, executor가 authenticated를 INHERIT하므로 `to authenticated` RLS 정책이 executor definer facade 안에서도 그대로 적용된다. 표 소유자는 postgres라 executor에 RLS가 강제되고, auth.uid()는 요청 GUC를 읽어 definer 전환 후에도 원 사용자를 식별한다. my_store_ids() 인라인은 0173의 정의(owner_id = auth.uid() and archived_at is null)와 동일 술어이며, 사후조건이 잔존 호출·소유 facade의 prosecdef/search_path·64개 정확 시그니처·미래 함수 기본 권한을 실제 객체로 검증한다. 함수 몸통에 동적 SQL(execute format)이 없어 definer 승격 후 주입 경로도 확인되지 않았다.

그러나 세 가지를 요구한다. (1) Major: 증거 문서가 구현 커밋 59077f01을 가리키고, admin-acl-audit.sql·.test.mjs의 SHA-256(7f08…, 226f…)이 이번 봉인 대상 blob(069ea4…, 198ff1…)과 다르다. 즉 34/34·metric 20개·사보타주 3종은 검수 대상과 다른 감사 스크립트로 얻은 결과이며, 원격 적용도 없어 P0-5-6은 증거상 판정 불가다. 같은 target commit에서 증거를 재생성해야 한다. (2) Minor: `grant execute on all functions … to sikjae_rpc_executor`와 기본 권한이 purge_archived_store·schedule_store_purge·purge_entity_changes·close_due_business_days 같은 postgres definer 유지보수 함수까지 실행 역할에 열어 최소 권한 원칙에 어긋난다. 현재 facade 몸통이 이를 부르지 않아 즉시 우회로는 아니지만, 60여 facade의 실행 컨텍스트가 매장 파괴 함수 실행권을 가질 이유가 없다. (3) Minor: 34번은 authenticated로 facade를 통과한 교차 매장 거부(P0-5-4의 핵심 성질)를 재지 않고 stores 직접 SELECT만 확인한다. 사보타주도 플래그 검사에 그쳐 executor에 bypassrls가 붙었을 때 행동 단언이 잡는지 증거가 없다. 운영 참고: PG16+ 호스티드에서 `grant authenticated to sikjae_rpc_executor`는 postgres의 ADMIN OPTION에 의존하므로 스테이징 적용 시 rpc_executor_role=1을 먼저 확인해야 한다.

### 공동 편집 제안 색인

- P05-EDIT-EXECUTOR-REVOKE-MAINT: ADD `packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql` ·   grant execute on all functions in schema public to sikjae_rpc_executor, service_role; · 원문은 review.md 참조
- P05-EDIT-TEST34-CROSS-STORE: ADD `packages/db/tests/34_rpc_least_privilege.sql` · -- ── 3. 내부 몸통은 PostgREST에서 직접 호출할 수 없다 ─────────────────────── · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `7838da4bf6cf538f94c0745a4a84d40c688ebcae928aa14c0472bad56bfb7924`
- target_commit_sha: `e8e22dbce1b778a74061d5c1fb801eec2402d906`
- changed_artifact_paths: `packages/db/supabase/migrations/20260829000175_rpc_executor_narrowing.sql`, `packages/db/tests/34_rpc_least_privilege.sql`, `packages/db/scripts/admin-acl-audit.sql`, `packages/db/scripts/admin-acl-audit.test.mjs`, `packages/db/tests/16_change_retention.sql`, `packages/db/tests/26_auto_close_sweep.sql`, `packages/db/tests/33_account_retention.sql`, `packages/db/README.md`, `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`

### P05-SEC-EVIDENCE-HASH-MISMATCH

- disposition: `APPLIED`
- 적용 내용: 검증 commit을 `e8e22db`로 고정해 전체 `pnpm verify` 6/6을 다시 실행했다. 증거 문서는 이 commit의 Git blob bytes에서 계산한 OID와 SHA-256을 기록하며 ACL metric은 현재 21개다.
- 원격 범위: P0-5-6은 통과로 위장하지 않는다. 동일 SHA 보호 CI와 FABLE-SEC 재검수 뒤 스테이징에 적용하고 원격 audit을 별도 판정한다는 사람 결정으로 보류 상태를 명시했다.
- 필요한 재검수: successor COMMIT snapshot에서 증거 문서 해시와 봉인 artifact blob을 대조한다.

### P05-SEC-EXECUTOR-BLANKET-EXECUTE

- disposition: `APPLIED`
- 적용 내용: 0175에서 executor의 미래 함수 기본 EXECUTE를 회수하고, 앱에 열리지 않은 postgres SECURITY DEFINER 전부를 executor에서 회수했다. 매장 파괴·전역 스위프 4개 시그니처의 명시적 사후조건도 추가했다.
- 테스트: ACL metric `rpc_executor_privileged_maintenance=0`, 34번의 동일 단언과 `purge_archived_store` 직접 42501, 미래 함수의 executor 자동 공개 금지를 추가했다.
- 판별력: 유지보수 함수 EXECUTE를 재개방하면 ACL 감사와 34번이 실패하고 원복 뒤 통과한다.

### P05-SEC-FACADE-CROSS-STORE-TEST-GAP

- disposition: `APPLIED`
- 적용 내용: 실제 authenticated 역할로 다른 사장님의 매장·식재료를 만든 뒤 `get_settings`·`save_category`·`ingredient_detail` facade의 빈 결과 또는 42501을 행동으로 확인한다.
- 판별력: executor에 BYPASSRLS를 부여하면 단순 역할 플래그보다 앞의 실제 `get_settings(foreign_store)` 행동 단언이 실패한다. 원복 뒤 `rolbypassrls=false`와 34번 통과를 확인했다.

### P05-SEC-HOSTED-ADMIN-OPTION-NOTE

- disposition: `NEEDS_HUMAN_DECISION`
- 결정: 스테이징 적용 전에는 완료로 표시하지 않는다. 정확한 SHA의 보호 CI와 FABLE-SEC 재검수 후 스테이징 적용에서 `rpc_executor_role=1`과 원격 audit을 기록한다.
- 재검토 조건: 스테이징 배포 계획·적용 시점.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P05-SEC-EVIDENCE-HASH-MISMATCH`, `P05-SEC-EXECUTOR-BLANKET-EXECUTE`, `P05-SEC-FACADE-CROSS-STORE-TEST-GAP`, `P05-SEC-HOSTED-ADMIN-OPTION-NOTE`
- verified_commit_sha: `e8e22dbce1b778a74061d5c1fb801eec2402d906`
- 전체 게이트: `corepack pnpm verify` 종료 코드 0, 6/6 통과. 타입, DB 34/34, core 177(2 skipped), mobile 199, CLI·ACL 보안, 새 DB 전체 migration·ACL metric 21·2세션 경합·locale parity, 업그레이드 9/9, 웹 번들을 포함한다.
- 대상 시험: 개발 DB의 DB 34/34와 `admin-acl-audit.test.mjs postgres`가 통과했다. 관측값은 `rls_disabled_app_tables=0`, `ledger_write_paths=0`, `unapproved_authenticated_rpc=0`, `facade_rpc_missing=0`, `rpc_executor_privileged_maintenance=0`이다.
- 판별력: 유지보수 함수 EXECUTE 재개방과 executor BYPASSRLS 부여가 각각 새 metric·실제 authenticated 교차 매장 facade 행동 단언을 실패시켰다. 각 원복 뒤 34번과 감사가 재통과했고 `rolbypassrls=false`를 확인했다.
- 판본 결속: 증거 문서에 검증 commit Git blob OID와 SHA-256을 기록했다. 0174=`a0f7e51e…/f3d4f111…`, 0175=`63347d89…/13a42e1e…`, test34=`b61c514f…/fb7c34b3…`, audit SQL=`526abbd2…/09fa1ece…`, audit test=`0b670ad8…/dcaadd9a…`다.
- 환경 정리: 전체 검증 종료 뒤 `fresh_%` 임시 DB 0개다.
- 미실행 항목: 스테이징 원격 적용·`admin-acl.sh --remote audit`은 정확한 SHA 보호 CI와 FABLE-SEC 재검수 뒤 실행한다. 현재 P0-5-6 또는 원격 ACL 통과로 판정하지 않는다.
- 증거 파일: `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `P0-5-RPC-LEAST-PRIVILEGE-003`
- predecessor_round: `r001`
- predecessor_task_sha256: `1308954d4164b8e9900f8d58dcbbb7abcd7eae544c8d39277c5d093a6ddd8433`
- predecessor_manifest_sha256: `aaaaa9f2a0b8e702b682d7eae14b8fd34dd2a0e72a958cadcc25176f6b382fae`
- predecessor_review_sha256: `7838da4bf6cf538f94c0745a4a84d40c688ebcae928aa14c0472bad56bfb7924`
- predecessor_run_sha256: `df9cce67982e02ff5c2159af0c55d40c3f1a4a0d783fab3646d1d5aa7e72de0e`
- finding_registry_sha256: `39464c847b8521d16468330c99ac49de8b4dcc4e81e848f1b8d7fb5c902b5f49`
- successor_task_id: `P0-5-RPC-LEAST-PRIVILEGE-004`
- successor_target_commit_sha: `6c30ebbb2ba3063d9107bdc50f923d8b031039c1`
- next_review_request: `FABLE_RECHECK`
