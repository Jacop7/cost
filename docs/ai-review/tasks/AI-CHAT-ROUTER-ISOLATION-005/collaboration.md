# AI-CHAT-ROUTER-ISOLATION-005 공동 작업 장부

> 비-Fable 턴은 `pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- changed_artifact_paths: activation receipt, 활성화 구현 증거 001, 실행 설계 v0.5
- 충족해야 할 요구사항·불변식: ISO004 required Finding 3건 해소와 previous review evidence 물질화
- 이번에 바꾼 내용: ACK 전 수신 scope lock, child prepare BLOCKED_POLICY event, 설계 v0.5, before/after SHA·판본·test 증거를 추가했다.
- 집중 검토 질문: ISO004 필수 3건이 모두 닫혔으며 재파일럿을 실행해도 되는가?
- 실행한 테스트·현재 증거: 신규 `test_active_no_child_scope_blocks_unrelated_allowed_route_until_ack`; Router 36/36; policy VALID; plugin validate/reinstall.
- 사람 결정이 필요한 항목: 없음.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT, ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT, ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE]`
- decision_id: `DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001`
- task_budget_usd_approved: `4.00`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 활성 승인은 유지하되 unrelated prior-context route는 기계적으로 차단한다.
- 허용 범위·기한: ISO004 closure Fable 검수 1회.
- 금지: envelope 밖 child route와 제품·DB·Supabase·git·배포 mutation.
- 승인자·시각: `HUMAN-CHIEF · 2026-09-04 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-h001`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- verified_input_files_sha256: `WORKING_TREE_HASHED runner 봉인`
- artifact_hashes: `receipt db69a0a3..., implementation e3fc837d..., design 221c666a...`
- finding_ids: `[ISO004-CHILD-ROUTE-MECHANICAL-ENFORCEMENT, ISO004-DESIGN-ENVELOPE-CONTRACT-DRIFT, ISO004-UPDATED-PLUGIN-BYTES-EVIDENCE]`
- 실행 명령: Router unittest, validate-policy, plugin validate, plugin reinstall
- 종료 코드·결과: 36/36 PASS, ACTIVE_DISPATCH valid, plugin 0.1.0+codex.20260903223631 installed.
- 미실행 항목과 이유: 실제 격리 재파일럿은 이 closure 검수 PASS 전 미실행.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=05c2b190fe8746deee15b5448edb35c3be9776d417d5ea1bc18ba870487f4e90 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `05c2b190fe8746deee15b5448edb35c3be9776d417d5ea1bc18ba870487f4e90`
- target_commit_sha: `6497666e655609a4f4bfe10bfaea6070dad01286`
- input_files_sha256: `6a0cbc1b4732034a8cffba39b40ae61e8ae879054ce04e50fb049d0aaf22e9d2`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: ISO005-ACK-REPILOT-EVIDENCE-PENDING, ISO005-DIRECT-REVIEW-EVIDENCE-UNMATERIALIZED, ISO005-DECISION-REBIND-AMENDMENT-TRACE, ISO005-DESIGN-STALE-V04-SELF-REFERENCE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

AI-CHAT-ROUTER-ISOLATION-005 초기 검수(FABLE-ARCH, 봉인 단일-pass) 판정 PASS. ISO004 필수 3건의 완료 조건이 sealed 입력으로 충족됨을 확인했다. (1) CHILD-ROUTE-MECHANICAL-ENFORCEMENT: 실행 설계 v0.5 §4가 child_routes_allowed=false 발송의 shared-runtime 수신 scope lock 선생성과, ACK receipt로 lock이 닫히기 전 수신 logical chat의 새 prepare-dispatch를 허용 edge라도 BLOCKED_POLICY event로 거부함을 규정하고(scope lock 경로·최소 필드 포함), 구현 증거에 신규 sabotage test `test_active_no_child_scope_blocks_unrelated_allowed_route_until_ack`와 35→36 테스트 개수 delta, Codex Router 36/36 PASS가 기록됐다. (2) DESIGN-ENVELOPE-CONTRACT-DRIFT: 설계가 v0.5로 전진 정정되어 §4 envelope schema에 scope_isolation(only_this_envelope·resume_prior_context·child_routes_allowed)과 expected_response=TEAM_ROUTER_ACK 의미가 추가됐고, 새 designSha256(221c666a…)이 현재 bytes sha256과 정확히 일치하며 policy.json:12·activation-decision.json:13·activation-receipt.json:7에 모두 재결속됐다(Codex validate-policy ACTIVE_DISPATCH valid). (3) UPDATED-PLUGIN-BYTES-EVIDENCE: 보강 전 script SHA 51845988…→보강 후 918e31fb…가 receipt implementationArtifacts와 일치하고, 재설치 판본 0.1.0+codex.20260903223631·설치 시각 2026-09-04T07:36:31+09:00(UTC 22:36:31, ISOLATION-004 검수 종료 22:34:44Z 이후)이 build stamp와 정합하며 Codex가 동일 판본 설치를 확인했다. (4) 이전 공식 검수 원본 물질화: ACTIVATION-003 r001 PASS review.md(b63f12da…)·run.json(b8f14027…)이 receipt reviewEvidence 해시와 byte-exact 일치하고, ISOLATION-004 r001 CHANGES_REQUIRED 원본·run.json도 물질화됐다. (5) 재파일럿 미실행이 정직하게 공개되어 required_evidence의 'no actual re-pilot before this review'와 일치한다. receipt의 decisionSha256(74be91fe…)·policySha256(21ecfdb3…)·구현 증거(e3fc837d…)도 현재 bytes와 모두 일치한다. 필수 Finding(Blocker~Minor)은 0건이다. 절차 주의: 본 작업은 predecessor_review가 null인 INITIAL이므로 ISO004 등록부의 공식 상태 전이는 ISOLATION-004 작업 절차에 속하며, 이 검수는 그 완료 조건 충족을 봉인 증거로 확인한 것이다. SOLAR 집중 질문에 대한 답: 예 — ISO004 필수 3건의 완료 조건은 모두 충족됐고, envelope 범위 내(child_routes_allowed=false·일반 REQUEST kind·비운영) ACK 재파일럿을 진행해도 된다. 신규 Improvement 4건만 남긴다: ① 재파일럿 실측 증거(ledger tail hash·추가 route 0건·ACK 외 발신 0건) 후속 첨부, ② receipt reviewEvidence의 직접 검수 R2(225ff42d…)·R5(14449cd2…) 문서가 이번에도 미물질화되어 교차검증 불가, ③ activation-decision.json이 approvedAt(07:02:35) 이후 v0.5 designSha256으로 재결속됐으나 파일 내 amendment 메타데이터가 없어 재결속 권위가 협업 장부 turn-h001에만 존재, ④ v0.5 설계 §12에 'v0.4' 자기참조 잔존(③과 다음 재결속 라운드에 일괄 전진 정정 권장, 단독 재봉인 불요). 이 PASS는 로컬 판정이며 외부 보호 게이트(gate_state)는 OPEN으로 남는다.

### 공동 편집 제안 색인

- ISO005-EDIT-DESIGN-V04-REF-FIX: REPLACE `docs/ai-review/evidence/AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` · 1. 이 v0.4와 Fable delta 재검수 Finding을 정리한다. · 원문은 review.md 참조
- ISO005-EDIT-REPILOT-EVIDENCE-SPEC: COMMENT `docs/ai-review/evidence/AI-CHAT-ROUTER-ACTIVATION-IMPLEMENTATION-001.md` · 다시 실행해 추가 route가 0건인지 확인한다. · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
