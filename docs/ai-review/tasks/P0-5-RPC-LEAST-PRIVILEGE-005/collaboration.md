# P0-5-RPC-LEAST-PRIVILEGE-005 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `87be0b81735bf15a475bdc229f08ad4f5633e992`
- predecessor: `P0-5-RPC-LEAST-PRIVILEGE-004/r001`

통합 0174와 판별력 있는 유지보수 권한 시험을 predecessor Finding ID 그대로 재검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `87be0b81735bf15a475bdc229f08ad4f5633e992`
- changed_artifact_paths: `0174 integrated executor narrowing`, `test 34 discriminating maintenance calls`, `packages/db/README.md`, `P0-5 evidence`, `predecessor response evidence`
- 충족해야 할 요구사항·불변식: predecessor 6개 Finding의 같은 ID 승계, 필수 3개 OPEN의 소스·행동·증거 재검수, 기존 VERIFIED 2개 유지, 스테이징 확인 1개 정직한 보류
- 이번에 바꾼 내용: 검수 범위 밖 0175를 제거하고 유지보수 definer·미래 기본 EXECUTE 회수와 사후조건을 0174에 통합했다. purge_archived_store의 자체 42501에 기대던 시험을 close_due_business_days·purge_entity_changes의 실제 권한 거부로 교체했다.
- 집중 검토 질문: 통합 0174가 기존 facade 호출 그래프를 보존하면서 유지보수·미래 함수만 닫는가? 행동 단언이 권한 재개방을 몸통 예외와 구별해 잡는가? 증거 문서의 새 commit·blob hash가 봉인 입력과 일치하는가?
- 실행한 테스트·현재 증거: 구현 commit 84c7c60에서 `corepack pnpm verify` 6/6, 개발·새 DB 34/34, ACL metric 21, 경합, locale parity, 업그레이드 9/9, 웹 번들. close_due_business_days 재개방 사보타주가 첫 행동 단언에서 실패하고 원복 뒤 통과했다.
- 사람 결정이 필요한 항목: 스테이징 원격 audit 전에는 P05-SEC-HOSTED-ADMIN-OPTION-NOTE와 P0-5-6을 통과로 표현하지 않는다.
- next_review_request: `FABLE_RECHECK`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[P05-SEC-EVIDENCE-HASH-MISMATCH, P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-FACADE-CROSS-STORE-TEST-GAP, P05-SEC-HOSTED-ADMIN-OPTION-NOTE, P05-SEC-0175-OUTSIDE-PACKET, P05-SEC-PURGE-42501-NONDISCRIMINATING]`
- decision_id: `P0-5-FABLE-INTEGRATED-CAP-20260829`
- task_budget_usd_approved: `8.00`
- 결정: predecessor의 새 지적을 반영한 통합 0174 확정 상태를 같은 Finding ID로 재검수한다.
- 허용 범위·기한: P0-5-RPC-LEAST-PRIVILEGE-005 읽기 전용 검수, 2026-08-29 현재 작업 완료까지.
- 근거: 사용자가 Fable 문제 제기를 함께 반영하며 전체 기획안 단계가 끝날 때까지 계속 진행하도록 승인했다.
- 승인자·시각: `USER · 2026-08-29T15:38:00+09:00`
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r001 sha256=58c1155330673863993e3acb34cc3884eabfab32a66f3153e0b6566c52e626e9 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `58c1155330673863993e3acb34cc3884eabfab32a66f3153e0b6566c52e626e9`
- target_commit_sha: `87be0b81735bf15a475bdc229f08ad4f5633e992`
- input_files_sha256: `52b75d7c088b5f0317095a76f9688a4233a54501c9eeed30a5ed6aa08a656821`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: P05-SEC-HOSTED-ADMIN-OPTION-NOTE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

predecessor Finding 6건을 같은 ID로 재검수했다. (1) P05-SEC-0175-OUTSIDE-PACKET → VERIFIED: 스냅샷 migration glob에 0175가 없고 README(163개, 최신 0174)·증거 문서(163/163)가 일치한다. 회수 로직은 봉인된 0174 안에 통합됐다 — executor 대상 기본 EXECUTE 회수(26–29행), 부트스트랩 일괄 grant 직후 앱에 닫힌 postgres definer를 executor에서 회수하는 루프(113–135행), 사후조건(288–311행: 카운트 0 + purge_archived_store·schedule_store_purge·purge_entity_changes·close_due_business_days 정확한 시그니처 4개), 실제 probe 함수로 미래 함수 executor 미공개 확인(316–330행). 회수는 정확한 시그니처 나열 대신 술어 루프지만 사후조건이 시그니처를 고정하고, assert_my_store(0173:163–178)는 my_store_ids()에 의존하지 않아 회수된 my_store_ids가 facade 호출 그래프를 깨지 않는다. 0174 blob bd026a9d…/SHA 9cb317a3…가 증거 문서 73행 및 봉인 input_files와 일치한다. (2) P05-SEC-EXECUTOR-BLANKET-EXECUTE → VERIFIED: 수용 기준 1(명시 회수 migration이 packet 안)·2(metric rpc_executor_privileged_maintenance=0 + 34번 동일 단언)·3(README 112–114행·0174 주석 23–25·113–115행 설계 근거) 모두 충족. (3) P05-SEC-PURGE-42501-NONDISCRIMINATING → VERIFIED: 34번 27–35행이 prelude의 sikjae_rpc_executor 역할에서 close_due_business_days()·purge_entity_changes() 호출 42501과 purge_archived_store has_function_privilege=false를 단언한다. purge_entity_changes 몸통(0135:27–43)은 자체 42501이 없고, 증거 61행은 close_due_business_days 재개방 사보타주가 '성공했다'로 실패했음을 기록해 몸통 예외가 아닌 권한 거부를 잰다는 것이 행동으로 증명된다. (4) P05-SEC-EVIDENCE-HASH-MISMATCH·P05-SEC-FACADE-CROSS-STORE-TEST-GAP은 새 검증 commit 84c7c60의 4개 파일 blob OID·SHA-256이 봉인 input_files와 정확히 일치하고 교차 매장 행동 단언(34번 103–109행)이 유지돼 VERIFIED를 유지한다. (5) P05-SEC-HOSTED-ADMIN-OPTION-NOTE는 인간 결정대로 스테이징 원격 audit 전 OPEN(Improvement) 유지. P0-5-6은 통과로 표현하지 않는다. 필수 미해결 Finding이 없어 PASS이나, 외부 게이트·스테이징 적용 승인을 뜻하지 않는다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
