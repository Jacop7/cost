# AI-CHAT-ROUTER-ACTIVATION-003 공동 작업 장부

> 이 장부의 비-Fable 턴은 `pnpm fable:append`로만 추가한다. Fable은 최소 봉인 snapshot을
> 읽기 전용으로 검수하며 제품·정책 파일을 직접 수정하지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: activation Decision·receipt·policy, DECISIONS 장부, 활성화 구현 증거 001
- 충족해야 할 요구사항·불변식: exact SHA 결속, exact edge/source generation, delivery 증명, runtime ACL, non-production-only
- 이번에 바꾼 내용: 비운영 active dispatch 봉인과 초기 endpoint/prepare/receipt 실행 경계를 구현했다.
- 집중 검토 질문: 변조·endpoint 노출·가짜 delivery·권한 상승이 남아 있는가?
- 실행한 테스트·현재 증거: Router 34/34, wrapper 52, policy/manifests valid, ACL protected, 11 endpoints bound.
- 사람 결정이 필요한 항목: 없음.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: `실제 자동 라우팅 활성화를 승인합니다`.
- 허용 범위·기한: 11개 작업의 allowlist 비운영 메시지 운반과 Fable 검수 1회.
- 금지: human relay, 자동 새 작업, 제품·DB·Supabase·git·staging·production·비밀·배포 mutation.
- 승인자·시각: `HUMAN-CHIEF · 2026-09-04T07:02:35+09:00`
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- verified_input_files_sha256: `WORKING_TREE_HASHED runner 봉인`
- artifact_hashes: `activation-receipt와 구현 증거 001에 결속`
- finding_ids: `[]`
- 실행 명령: Router unittest, wrapper self-test, validate-policy, validate-manifests, Get-Acl
- 종료 코드·결과: 34/34, 52 bundles, active valid, 11/21 valid, ACL protected, endpoint 11개 generation 1.
- 미실행 항목과 이유: 실제 dispatch는 이 검수 통과 전 의도적으로 미실행.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=b8c4bd66e73a4d259f157c97825de9c96dd76ba9da50f3632f51a1b71a36702f -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `b8c4bd66e73a4d259f157c97825de9c96dd76ba9da50f3632f51a1b71a36702f`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- input_files_sha256: `d40439d6519171fe7d27d9de96ce0f305d10eace4d6201e6c3955487254fd334`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: ACT003-GATE-EDGE-KIND-SCOPE, ACT003-DECISIONS-MIXED-EOL
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

AI-CHAT-ROUTER-ACTIVATION-003 초기 검수(FABLE-ARCH, 봉인 단일-pass) 결과 PASS다. (1) SHA 결속: activation-decision.json의 designSha256(83baffef…)·modelPlanSha256(60d7cb6a…)과 activation-receipt.json의 decisionSha256(c8efb3a8…)·policySha256(92dc3a05…)·designSha256·modelPlanSha256·구현 증거(c6052e41…)·R2(225ff42d…)·R5(14449cd2…) SHA-256이 모두 봉인 입력의 현재 bytes sha256과 정확히 일치하고, model-plan.json.sha256 sidecar도 일치한다. 승인 원문 '실제 자동 라우팅 활성화를 승인합니다'·승인 시각 2026-09-04T07:02:35+09:00·DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001이 decision JSON, DECISIONS.md, 협업 장부에서 동일하다. (2) exact edge: 11개 manifest의 route_edges 합계 21개(01:1, 02:5, 03:6, 04:2, 05:2, 부서01~05:5, 부서00:0)와 edge별 kind가 설계 v0.4 §3 표와 정확히 일치하며 policy.json의 12개 allowedMessageKinds·expectedChatCount=11도 일치한다. (3) 전달 의미론: SENT_UNCONFIRMED는 도구 수락일 뿐이고 receipt/target ACK 뒤에만 DELIVERED를 append함이 증거 문서와 설계 §6에 결속되고 로컬 시험으로 확인됐다. (4) 비밀 격리: 원시 provider endpoint·HMAC key는 Git 밖 사용자 전용 ACL runtime에만 두고 ledger에는 HMAC ref만 남기며 route JSONL 비노출 시험이 있다. (5) 금지 유지: humanRelayEnabled=false, productionRoutesEnabled/databaseMutationEnabled/deploymentMutationEnabled=false, DECISIONS.md의 human relay·자동 새 작업·제품·DB·Supabase·git·staging·production·비밀·배포 mutation 금지가 유지된다. (6) Mission Relay가 1.7·successor 생성을 소유하고 Router는 복원·Study Gate 뒤 generation CAS만 수행함이 설계 §8과 활성화 허용 범위에 결속된다. Codex 증거(Router 34/34, wrapper 52 bundles, policy/manifest valid, Get-Acl 사용자+SYSTEM, endpoint 11개 generation 1)와 '검수 통과 전 실제 dispatch 미실행'이 required_evidence를 충족한다. 필수 Finding(Blocker~Minor)은 없고 Improvement 2건만 기록한다: ① policy.json allowlist가 STAGING/PRODUCTION 게이트 kind를 전역 포함하는 반면 activation-decision은 productionRoutesEnabled=false이고 설계 §12-9는 운영·배포 edge를 별도 사람 게이트 파일럿 전까지 닫도록 하므로, 첫 비운영 파일럿의 게이트 edge 제외와 §10 fail-closed 조건을 증거 문서에 명시할 것(proposed_edits 제공). ② DECISIONS.md의 CRLF/LF 혼합 개행을 단일 규약으로 전진 정정할 것. 이 PASS는 로컬 판정이며 외부 보호 게이트(gate_state)는 OPEN으로 남는다.

### 공동 편집 제안 색인

- EDIT-ACT003-GATE-EDGE-NOTE: ADD `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md` · - `humanRelayEnabled=false`를 유지하고 자동 새 작업 생성·백그라운드 서비스는 포함하지 않는다. · 원문은 review.md 참조
- EDIT-ACT003-DECISIONS-EOL-COMMENT: COMMENT `docs/team/DECISIONS.md` · # 사람 Decision 장부 · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
