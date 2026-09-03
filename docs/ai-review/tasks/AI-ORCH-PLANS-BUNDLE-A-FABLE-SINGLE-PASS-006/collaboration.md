# AI-ORCH-PLANS-BUNDLE-A-FABLE-SINGLE-PASS-006 공동 작업 장부


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- changed_artifact_paths: 다섯 공식 기획안
- 집중 검토 질문: 1~5단계가 다음 단계로 넘어갈 준비가 됐는가? 필수 Finding과 verdict만 반환하라.
- 실행 방식: 전체 원문·SHA를 직접 봉인한 도구 없는 단일 턴
- 검수 예산: `DEC-AI-FABLE-SINGLE-PASS-BUDGET-006`, r001 soft cap USD 8.00
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-SINGLE-PASS-BUDGET-006`
- task_budget_usd_approved: `8.00`
- soft_budget_overrun_risk_accepted: `r001@8.00`
- 결정: 직전 USD 4.00 soft cap 실행이 실제 USD 6.064928까지 초과하고도 verdict 없이 실패했음을 고지받은 뒤, 이번 Task r001 한 회의 exact soft cap USD 8.00과 실제 청구가 이를 추가로 초과할 수 있는 위험을 승인한다.
- 허용 범위: 이 Task r001 한 회차, 읽기 전용.
- 금지: 자동 재시도·추가 증액·Opus 전환.
- 승인자·시각: `USER · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=b803dc22f4816dcadcbddf6d7049c0f171e1ec36bb764365c6596ee067844a59 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `b803dc22f4816dcadcbddf6d7049c0f171e1ec36bb764365c6596ee067844a59`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- input_files_sha256: `35053810f4916a224361494294cab7134a3a7bab0c8fb81b25e2d6e3654033c2`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001, FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

봉인 스냅샷의 다섯 공식 기획안을 도구 없는 단일 패스로 교차 검수했다. [충족 확인] (1) 권위 DAG: 디렉터리 기획안 §6 authority-dag 기계 판독 블록(team→ontology→orchestration→directory→quality)과 다섯 문서 front matter의 depends_on이 완전히 일치하며 비순환이다. 탐색 참조 순환 허용과 권위 DAG 분리도 온톨로지 §4와 디렉터리 §6이 모순 없이 기술한다. (2) 상태·물질화: 팀 구성안은 CONFIRMED, 나머지 네 후보는 모두 DRAFT를 유지하고, 사람 승인 전 docs/team/ 권위 장부·역할/팀 manifest·handoff 디렉터리 물질화 금지가 팀 §11·디렉터리 단계 2·오케스트레이션 단계 5에서 일관되게 선언된다. 부분 ACTIVE 거부·원자적 활성화 계약도 세 문서가 동일하게 참조한다. (3) 게이트: gate_state=OPEN 유지, P0-2 전 CLOSED 금지, Fable 기본·Opus 구조화 소진 successor, R2/R3·운영의 복구 표본/사람 exact-SHA 위험 수용 요구가 팀 §3.10.1·§4.4, 오케스트레이션 §6·§8.2·§10, 품질 §4.7·§11에서 정합적이다. 필수 증거(simulate 71/71, self-test 52/52, Sol high 재검수 PASS, 직전 soft cap 초과 실패 보존)도 evidence 파일과 일치한다. [필수 Finding 2건] (Major) `02 마스터 오케스트레이션`/`03 부 오케스트레이션` 경계 모순: 팀 §1.4는 '마스터 AI'가 전체 목표·순서·팀 배정을 통합하고 부 AI는 관측·보조만 한다고 서술하지만, 오케스트레이션 §2.1 트리는 03에 '요청 정규화·Task 라우팅'을 배정하고 §2 구성요소 표와 팀 §3.2는 같은 책임을 AI 부 오케스트레이터 소유로 둔다. 또한 '마스터 AI'는 팀 §1.1 역할표(주 오케스트레이션 주 담당=사람)·§5.1 필수 컨텍스트 목록·RACI 어디에도 역할 ID·권한 등급이 없는 미등록 행위자다. 요구 1·2(권위·역할 무모순, 02/03 경계) 위반. (Minor) 팀 §4.5 R0·R1 자동 종결 조건에 번호 10이 두 번 부여돼 조건 참조가 모호하다. [판정] 잔여 필수 Finding 2건으로 CHANGES_REQUIRED. 본 결과는 로컬 검수이며 gate_state는 OPEN으로 유지되고 외부 보호 게이트를 종결하지 않는다.

### 공동 편집 제안 색인

- EDIT-006-MASTER-DEPUTY-TEAM-14: COMMENT `docs/팀구성_상세기획안.md` · `02 마스터 오케스트레이션`과 `03 부 오케스트레이션 · 토큰/컨텍스트 관리`는 AI 컨텍스트이며, · 원문은 review.md 참조
- EDIT-006-MASTER-DEPUTY-ORCH-21: COMMENT `docs/AI-오케스트레이션-상세기획안.md` · ├─ 03 부 오케스트레이션 · 토큰/컨텍스트 관리 · 원문은 review.md 참조
- EDIT-006-R0R1-COND-RENUMBER: REPLACE `docs/팀구성_상세기획안.md` · 10. decision commit의 정확한 SHA에서 보호 원격 필수 체크가 성공하고 보호 ref에 반영됐다. 외부 서명/attestation을 쓰더라도 같은 SHA의 `full-db-required`와 `protected-gate` 구성 job 성공 run ID·결론을 함께 봉인한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `b803dc22f4816dcadcbddf6d7049c0f171e1ec36bb764365c6596ee067844a59`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`
- resulting_input_files_sha256: `PENDING_NEXT_REVIEW_MANIFEST`
- artifact_hashes: `[{"path":"docs/팀구성_상세기획안.md","sha256":"8b6d94c5ec52fb040f5c527c6d22384ffa1e7b1acf3858f65ee79b31bf604d73","change_type":"MODIFIED"},{"path":"docs/AI-오케스트레이션-상세기획안.md","sha256":"794fab2d3842fa3d74a6f09f2485d19b69f21fc62b12cd371d8cb00b2f02b5da","change_type":"MODIFIED"}]`

### FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001

- disposition: `APPLIED`
- 적용 위치: 팀 구성안 §1.1·§1.2·§1.4·§3.2·§4.3·§5.1, 오케스트레이션 §2·§2.1
- 적용 내용: `AI-MASTER-ORCHESTRATOR`/`SOLAR-MASTER-ORCH`와 `AI-DEPUTY-ORCHESTRATOR`/`SOLAR-ORCH`를 각각 등록하고, 마스터의 작업 분해·순서·담당 배정·라우팅 계획 확정과 부 역할의 요청 정규화·예비 판정·확정 경로 실행·상태/토큰/HANDOFF 책임을 분리했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: `corepack pnpm ai:plans:simulate` — `71/71 PASS`
- 필요한 재검수: 변경된 두 문서 bytes에 대한 `FABLE-ARCH` diff 재검수

### FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002

- disposition: `APPLIED`
- 적용 위치: 팀 구성안 §4.5
- 적용 내용: 두 번째 조건 10을 11로 재부여했다.
- 반박 또는 부분 적용 근거: 없음
- 실행한 테스트: `corepack pnpm ai:plans:simulate` — `71/71 PASS`
- 필요한 재검수: 변경된 팀 구성안 bytes에 대한 `FABLE-ARCH` diff 재검수

- 비용 상태: r001 실제 USD 5.729455, 승인 USD 8.00 이내. 단일 호출 승인은 소비됐으며 추가 외부 호출은 새 사람 승인 전 금지.
- next_review_request: `FABLE_RECHECK`

## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-s002`
- finding_ids: `FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001`, `FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002`
- decision_id: `DEC-AI-FABLE-DIFF-RECHECK-BUDGET-007`
- soft_budget_overrun_risk_accepted: `r002@2.00`
- 결정: 사용자는 반복 외부 검수 비용을 항상 권장액과 최소액 사이에서 AI가 선택해 신속히 진행하도록 위임했다. 현재 Task 잔여 상한 USD 2.27 안에서 최소 실행액 USD 2.00을 r002 한 회 soft cap으로 결속하고 실제 청구 초과 가능성을 수용한다.
- 허용 범위: 변경된 문서와 r001 Finding 두 건의 읽기 전용 재검수 1회.
- 금지: 자동 재시도·추가 증액·Opus 전환.
- 승인자·시각: `USER · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
