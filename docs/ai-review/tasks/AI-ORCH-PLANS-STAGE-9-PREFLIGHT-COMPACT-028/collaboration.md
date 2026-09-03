# AI-ORCH-PLANS-STAGE-9-PREFLIGHT-COMPACT-028 공동 작업 장부

> Task027 budget_exhausted 원본을 보존하고 대형 권위 참조를 제거한 축소 입력으로 같은 planned tree를
> 독립 감사한다. 비-Fable 턴은 append 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `d5aa2617966ed246b92c1e67e201c1804bca9b97`
- snapshot_mode: `WORKING_TREE_HASHED`
- predecessor_failure: `AI-ORCH-PLANS-STAGE-9-PREFLIGHT-AUDIT-027/r001 budget_exhausted, verdict null, actual USD 6.338`
- changed_artifact_paths: `scripts/docs-graph-check.mjs`, `scripts/docs-graph-check.test.mjs`, `docs/team/**`
- 요청: 19개 A0 context, Learning 4:4 이관, 역할 5개·팀 6개 비권위 manifest, RISKS 조건부 부재와 checker 판별력만 간결히 감사한다.
- 실행 증거: planned-tree PASS(contextCount 19), sabotage 8/8 PASS.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE-9-PREFLIGHT-COMPACT-BUDGET-028`
- task_budget_usd_approved: `6.00`
- soft_budget_overrun_risk_accepted: `r001@6.00`
- 결정: 사용자의 자동 진행·Fable 필수검수·예산 재량 위임에 따라 Task027 실패 원본을 보존하고 축소 입력의 단일 successor 감사를 진행한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 6.00을 넘을 수 있다.
- 허용 범위: 후보 19개, AGENTS, 승인된 9단계 계획, Task027 실패 run의 읽기 전용 검수.
- 금지: 같은 입력 재사용, 동시 Opus, activation·외부 채팅·배포 실행.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=d245477ada7561e49f4bc42de29c5b4ff832460fc82ba7102cf5138aceab2ff7 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `d245477ada7561e49f4bc42de29c5b4ff832460fc82ba7102cf5138aceab2ff7`
- target_commit_sha: `d5aa2617966ed246b92c1e67e201c1804bca9b97`
- input_files_sha256: `e5be09e880a71cea760065b603b617fd78a78f855e2279234d9ec649df07752d`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: ARCH-028-REGISTRY-HASH-TAMPER-TEST-GAP, ARCH-028-CONTEXT-BINDING-VALIDATION-LOOSE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

봉인 입력 정적 감사 결과 PASS. (1) Task027 실패 보존: run.json이 run_state RUN_FAILED·terminal_reason budget_exhausted·review_sha256/candidate null로 판정 없이 원본 보존됐고, 이번 Task는 이를 PASS나 Finding으로 재사용하지 않았다. (2) 19개 A0 등록: ROLE_CONTEXTS 레지스트리에 정확히 19개 context가 모두 autonomy_stage A0, decision_id DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027, 품질 기획안 policy_hash(66883bb4…), version 1·64hex context_hash로 결속됐으며, 역할 5개 manifest의 context_refs 19개가 레지스트리 hash와 문자열 단위로 1:1 일치한다. 기존 레인 표·Task Packet·재사용 측정 원문과 TEAM_LEARNING v1 장부 4개 항목의 ID·상태·본문은 보존됐다. (3) Learning 4:4 이관: VERIFIED 3건은 LEGACY_READ_ONLY+verifier_decision_id null로 사람 Decision을 소급 생성하지 않았고 CANDIDATE 1건은 CANDIDATE_UNASSIGNED이며, checker가 1:1 대응·중복·VERIFIED/CANDIDATE 계약을 실패 폐쇄로 강제한다. (4) 비권위 manifest: 역할 5·팀 6 manifest 모두 chat_is_approval_authority false이고 FORBIDDEN_MANIFEST_FIELDS 검사로 현재 Task·플러그인 상태·토큰 임계값 복제를 차단하며 정책 본문 복제가 없다. (5) checker 판별력: planned DRAFT tree와 ACTIVE tree 통과, manifest 누락, authority 중복, 미등록 context 참조(hash 불일치 경로), 채팅 권한 위조, 무권위 RISKS 생성, 플러그인 상태 복제의 8개 시험이 존재하고 CLI는 오류 시 exit 1로 실패 폐쇄한다. (6) RISKS.md는 부재하며 README가 권위 미수렴을 명시하고 checker가 UNOWNED_RISKS/MISSING_RISKS 양방향을 강제한다. package/verify 연결·제품·DB·배포·통합 플러그인 변경은 artifact에 없다. (7) 차단성 Finding 없음 → PASS. Improvement 2건만 기록: 레지스트리 내부 context_hash 재계산 실패 경로(CONTEXT_HASH_MISMATCH)의 직접 사보타주 시험 부재, parseRegistry의 route/policy_hash 형식 미검증 및 Learning 이관의 RETIRED/CANDIDATE decision 필드 미제약. 유의: planned-tree PASS(contextCount 19)·사보타주 8/8의 실행 증거는 공동 장부의 SOLAR 주장으로, 코드 정합성은 정적으로 확인했으나 실행 재현은 CODEX-FUNCTION-QA 검증 단계가 확인해야 한다. 본 PASS는 외부 게이트를 닫지 않으며 activation commit·채팅 생성·배포를 승인하지 않는다.

### 공동 편집 제안 색인

- EDIT-028-HASH-TAMPER-SABOTAGE-TEST: ADD `scripts/docs-graph-check.test.mjs` · test('소유권 미수렴 RISKS 파일 생성을 잡는다', () => withFixture((root) => { · 원문은 review.md 참조
- EDIT-028-REGISTRY-BINDING-VALIDATION: ADD `scripts/docs-graph-check.mjs` ·     if (context.autonomy_stage !== 'A0') fail('UNAPPROVED_AUTONOMY', `승인 없는 route는 A0이어야 합니다: ${context.context_id}`); · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `d245477ada7561e49f4bc42de29c5b4ff832460fc82ba7102cf5138aceab2ff7`
- target_commit_sha: `d5aa2617966ed246b92c1e67e201c1804bca9b97`
- changed_artifact_paths: `scripts/docs-graph-check.mjs`, `scripts/docs-graph-check.test.mjs`
- ARCH-028-REGISTRY-HASH-TAMPER-TEST-GAP: context_hash 자체 변조 사보타주를 추가했다.
- ARCH-028-CONTEXT-BINDING-VALIDATION-LOOSE: route·policy_hash 형식과 CANDIDATE/RETIRED Decision 결속을 실패 폐쇄로 보강했다.
- 검증: `node --test scripts/docs-graph-check.test.mjs` 11/11 PASS; `node scripts/docs-graph-check.mjs --planned-tree` PASS, contextCount 19.
- 처리: 두 Improvement는 최종 activation exact-SHA 감사에서 재확인한다. 현재 Fable PASS의 필수 OPEN Finding은 0건이다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`
