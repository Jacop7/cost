# P0-5-RPC-LEAST-PRIVILEGE-004 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `6c30ebbb2ba3063d9107bdc50f923d8b031039c1`
- predecessor: `P0-5-RPC-LEAST-PRIVILEGE-003/r001`

predecessor의 Finding 4건을 같은 ID로 재검수하며, 과거 장부와 실패 기록을 수정하거나 삭제하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `6c30ebbb2ba3063d9107bdc50f923d8b031039c1`
- changed_artifact_paths: `0175 migration`, `test 34 cross-store behavior`, `admin ACL metric 21`, `tests 16·26·33`, `packages/db/README.md`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: predecessor Finding 4건의 같은 ID 승계, 필수 3건의 구현·행동·증거 재검수, 호스티드 관리자 옵션의 정직한 보류
- 이번에 바꾼 내용: executor의 유지보수 definer와 미래 함수 기본 EXECUTE를 회수했다. authenticated 실제 facade의 교차 매장 차단과 BYPASSRLS 사보타주를 행동 단언으로 추가했다. 정확한 검증 commit에서 전체 6/6을 재실행하고 Git blob bytes의 해시로 증거 문서를 다시 고정했다.
- 집중 검토 질문: 0175의 동적 회수가 승인 facade 호출에 필요한 권한까지 과도하게 닫지 않는가? 유지보수 함수와 미래 함수가 executor에 다시 열리지 않는가? 교차 매장 행동 시험이 실제 RLS 우회를 잡는가? 증거 문서의 모든 commit·OID·SHA가 target blob과 일치하는가?
- 실행한 테스트·현재 증거: target 구현 commit `e8e22db`에서 `corepack pnpm verify` 6/6, 개발·새 DB 34/34, ACL metric 21개, 경합, locale parity, 업그레이드 9/9, 웹 번들. 유지보수 함수 재개방과 executor BYPASSRLS 사보타주가 각각 실패했다.
- 사람 결정이 필요한 항목: 스테이징 원격 audit 전에는 P05-SEC-HOSTED-ADMIN-OPTION-NOTE와 P0-5-6을 통과로 표현하지 않는다.
- next_review_request: `FABLE_RECHECK`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[P05-SEC-EVIDENCE-HASH-MISMATCH, P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-FACADE-CROSS-STORE-TEST-GAP, P05-SEC-HOSTED-ADMIN-OPTION-NOTE]`
- decision_id: `P0-5-FABLE-SUCCESSOR-CAP-20260829`
- task_budget_usd_approved: `8.00`
- 결정: predecessor의 지적을 반영한 확정 commit을 새 SECURITY successor에서 같은 Finding ID로 재검수한다.
- 허용 범위·기한: P0-5-RPC-LEAST-PRIVILEGE-004 읽기 전용 검수, 2026-08-29 현재 작업 완료까지.
- 근거: 사용자가 후속 검수와 다음 단계를 계속 진행하도록 승인했다.
- 승인자·시각: `USER · 2026-08-29T15:10:00+09:00`
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r001 sha256=958d9356e5cda04a7f5d19362a5e3738113dc20151c687cdecf48fcc030c8dbb -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `958d9356e5cda04a7f5d19362a5e3738113dc20151c687cdecf48fcc030c8dbb`
- target_commit_sha: `6c30ebbb2ba3063d9107bdc50f923d8b031039c1`
- input_files_sha256: `1c32698e5b092abebf8eebd240d25911cf98769c19ba21335d118cc0ae50d35c`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-0175-OUTSIDE-PACKET, P05-SEC-PURGE-42501-NONDISCRIMINATING
- 선택 미종결 Finding: P05-SEC-HOSTED-ADMIN-OPTION-NOTE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

predecessor Finding 4건을 같은 ID로 재검수했다. (1) P05-SEC-EVIDENCE-HASH-MISMATCH → VERIFIED: 증거 문서가 검증 commit e8e22db의 Git blob OID·SHA-256을 기록했고, 0174(a0f7e51e/f3d4f111…)·34번(b61c514f/fb7c34b3…)·admin-acl-audit.sql(526abbd2/09fa1ece…)·admin-acl-audit.test.mjs(0b670ad8/dcaadd9a…)가 이번 봉인 input_files와 정확히 일치한다. metric 21개는 test.mjs EXPECTED_METRICS 21개와 같고, 사보타주 5종이 기록됐으며 P0-5-6은 인간 결정으로 보류를 명시했다. (2) P05-SEC-FACADE-CROSS-STORE-TEST-GAP → VERIFIED: 34번이 authenticated 실제 역할로 get_settings(foreign_store) null·save_category(foreign_store) 42501·ingredient_detail(foreign_ingredient) null을 행동으로 단언하고, 증거는 executor BYPASSRLS 사보타주가 get_settings 교차 매장 단언에서 실패했음을 기록한다. (3) P05-SEC-EXECUTOR-BLANKET-EXECUTE → OPEN 유지: 감사 metric rpc_executor_privileged_maintenance=0, 34번·16번의 executor 유지보수 definer 0개·새 함수 자동 미공개 단언, README 설계 근거는 확인됐다. 그러나 실제 회수를 수행한다는 20260829000175_rpc_executor_narrowing.sql이 artifact_paths·input_files에 없어 스냅샷에 존재하지 않고, 봉인된 0174는 여전히 일괄 grant(85행)와 executor 기본 EXECUTE(26–27행)를 담고 있다. 수용 기준 1(명시적 revoke)을 검수 대상에서 확인할 수 없다. (4) P05-SEC-HOSTED-ADMIN-OPTION-NOTE는 인간 결정대로 스테이징 전 보류(OPEN, Improvement).

새 Finding 2건: P05-SEC-0175-OUTSIDE-PACKET(Major) — R3 권한 변경 migration 0175가 SECURITY 경로 검수 집합 밖에 있어 과도 회수·사후조건·기본 권한 회수 방식을 독립 검수하지 못했다. 증거 문서의 blob OID 63347d89…를 봉인한 successor packet이 필요하다. P05-SEC-PURGE-42501-NONDISCRIMINATING(Minor) — 34번 38–39행의 purge_archived_store 직접 호출 42501 단언은 0173 함수 몸통 자체가 예약 없음에 42501(PURGE_NOT_SCHEDULED)을 던지므로 executor에 EXECUTE가 다시 열려도 통과한다. 권한 회귀는 카운트 단언이 잡지만 행동 단언은 판별력이 없다. 종합 판정 CHANGES_REQUIRED.

### 공동 편집 제안 색인

- P05-EDIT-TEST34-DISCRIMINATING-MAINT: ADD `packages/db/tests/34_rpc_least_privilege.sql` ·   format('select purge_archived_store(%L, %L)', pg_temp.store(), 'invalid-token'), '42501'); · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `958d9356e5cda04a7f5d19362a5e3738113dc20151c687cdecf48fcc030c8dbb`
- target_commit_sha: `585495d7b53e884bb415504fad2c52fb365149b0`
- implementation_commit_sha: `84c7c60f6eed2ccac964d356a97e3b0910a74a4c`
- changed_artifact_paths: `20260829000174_rpc_least_privilege.sql`, `34_rpc_least_privilege.sql`, `packages/db/README.md`, `P0-5 evidence`

### P05-SEC-EXECUTOR-BLANKET-EXECUTE

- disposition: `APPLIED`
- 적용 내용: 미래 기본 EXECUTE 회수와 postgres SECURITY DEFINER 유지보수 문 동적 회수·정확한 4개 함수 사후조건을 최초 감사 범위인 0174 안으로 통합했다. executor는 기존 facade 호출 그래프를 위해 현재 함수 권한을 받은 뒤 앱에 열리지 않은 유지보수 definer를 즉시 잃고, 미래 함수는 service_role만 자동 권한을 받는다.
- 검증: 새 DB와 개발 DB 34/34, ACL metric 21, 전체 verify 6/6.

### P05-SEC-0175-OUTSIDE-PACKET

- disposition: `APPLIED`
- 적용 내용: 스테이징·운영에 적용되지 않은 로컬 migration 0175를 제거하고 그 전 내용을 artifact_paths에 이미 봉인된 0174로 합쳤다. 개발 DB는 백업 뒤 reset하여 파일·장부 163/163, 최신 0174로 맞췄다.
- 검증: 통합 0174를 처음부터 적용한 fresh DB 34/34, 업그레이드 9/9, 공개 RPC 타입 변화 없음.

### P05-SEC-PURGE-42501-NONDISCRIMINATING

- disposition: `APPLIED`
- 적용 내용: 몸통 자체가 42501을 내는 purge_archived_store 행동 단언을 제거했다. 자체 42501이 없는 close_due_business_days와 purge_entity_changes를 executor로 호출해 권한 거부를 재고, purge_archived_store는 has_function_privilege로 별도 확인한다.
- 판별력: close_due_business_days EXECUTE를 executor에 고의 재부여하면 카운트보다 먼저 행동 단언이 “거부되어야 하는데 성공했다”로 실패했다. revoke 뒤 34번이 통과했다.

### P05-SEC-HOSTED-ADMIN-OPTION-NOTE

- disposition: `NEEDS_HUMAN_DECISION`
- 이유: 로컬에서 추측해 닫지 않는다. 동일 SHA 보호 CI 후 스테이징 배포·remote audit에서 rpc_executor_role=1과 migration 사후조건을 확인한다.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `585495d7b53e884bb415504fad2c52fb365149b0`
- implementation_commit_sha: `84c7c60f6eed2ccac964d356a97e3b0910a74a4c`
- 검증 명령: `corepack pnpm verify`
- 결과: 타입, DB 34/34, core 177(2 skip), mobile 199, CLI·ACL 보안, 새 DB·ACL metric 21·2세션 경합·locale parity, 업그레이드 9/9, 웹 번들까지 6/6 종료 코드 0.
- 장부: 개발 DB migration 파일·장부 163/163, 최신 `20260829000174`; `fresh_%` 잔여 0.
- 타입: `corepack pnpm db:types` 실행, 생성 타입 Git diff 0.
- 백업: `%LOCALAPPDATA%\Sikjae\db-backups\dev-before-0174-fold-20260829-151909.dump`, 1,400,656 bytes, SHA-256 `7141c98a0841a7571d18d8bb83c2e8f6182033047d0c33d9e0341347e27d7d02`.
- 사보타주: executor에 close_due_business_days EXECUTE를 재부여하면 34번의 첫 유지보수 행동 단언이 실패했다. revoke 뒤 baseline 통과.
- 원격 상태: 스테이징·운영 미적용. 원격 audit 미실행이며 로컬 통과로 대신하지 않음.
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `P0-5-RPC-LEAST-PRIVILEGE-004`
- predecessor_round: `r001`
- predecessor_task_sha256: `c982b3d1d38cdc962bf064993c93d02d62111465b5a5b97756f16956c9c63329`
- predecessor_manifest_sha256: `24cbd18ed8bd633e7d2dc120075bd2f08f3e288d33639ffa73e762614344951e`
- predecessor_review_sha256: `958d9356e5cda04a7f5d19362a5e3738113dc20151c687cdecf48fcc030c8dbb`
- predecessor_run_sha256: `4c64ff413dbe4d6e34fcbf51a5df92b13ab647fd97521f0c3058995549599214`
- finding_registry_sha256: `257814b8c3bdbbb2e8f3e8689e6928b5aad804f807afb91b3821f3f21280e6a4`
- successor_task_id: `P0-5-RPC-LEAST-PRIVILEGE-005`
- successor_target_commit_sha: `87be0b81735bf15a475bdc229f08ad4f5633e992`
- next_review_request: `FABLE_RECHECK`
