# AI-ORCH-PLANS-FINDING-LINEAGE-COMMIT-015 공동 작업 장부

> 과거 working-tree 검수에서 발견된 두 Finding을 고정 commit에서 재현해 정식 predecessor→successor 재검수 계보의 최초 고정점을 만든다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`
- source_context: 기존 working-tree 검수의 두 Finding을 고정 commit에서 동일 ID로 재현해 COMMIT 계보를 시작한다.
- finding_ids: `FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001`, `FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002`
- 집중 검토 질문: 두 원인이 target commit에 존재하는가? 존재하면 같은 ID·OPEN·previous_finding_id null로 반환하라.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001`, `FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002`
- decision_id: `DEC-AI-FABLE-FINDING-LINEAGE-PREDECESSOR-BUDGET-014`
- task_budget_usd_approved: `6.00`
- soft_budget_overrun_risk_accepted: `r001@6.00`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 고정 commit predecessor 검수의 soft cap을 USD 6.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 6.00을 넘을 수 있다.
- 허용 범위: target commit의 두 공식 문서에 대한 읽기 전용 Finding 재현 감사 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=0940f73a2c6ae481c63c5298c53fb177cb571c82057d18aaffb729e7b517b99a -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `0940f73a2c6ae481c63c5298c53fb177cb571c82057d18aaffb729e7b517b99a`
- target_commit_sha: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- input_files_sha256: `bc286b097dc825c5a61abda3f938031c02803340c18fe594120ebaf7126c10f9`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

고정 commit 6e99bd93b737bf291f14a8d3a6465a1d5110fa6c에서 두 기존 Finding의 원인 재현 여부를 감사했다.

[재현됨] FAB-ARCH-006-R0R1-DUPLICATE-COND-10-002: docs/팀구성_상세기획안.md §4.4의 "R0·R1 자동 종결 조건" 목록(1028행 시작)에서 1039행(anchor commit·decision commit 고정 조건)과 1040행(보호 원격 필수 체크·protected-gate 봉인 조건)이 원문에서 둘 다 "10."으로 번호가 중복돼 있고 문자 그대로의 "11." 항목이 없어 1~11 단일 오름차순 번호가 성립하지 않는다. 마크다운 렌더러는 자동 재번호로 10·11처럼 표시하므로 원문 결함이 은폐되고, "조건 10" 인용이 서로 다른 두 게이트 조건 사이에서 모호해진다. Task 지시대로 같은 ID·OPEN·previous_finding_id null로 등록했고, 1040행을 "11."로 재번호하는 단일 행 수정안을 proposed_edits로 제출했다.

[재현 안 됨] FAB-ARCH-006-MASTER-DEPUTY-BOUNDARY-001: 두 판정 기준을 모두 확인했으나 target commit에서는 원인이 존재하지 않는다. (1) "AI 마스터" 역할 미등록 — 두 문서 어디에도 AI 마스터 역할이 참조되지 않으며 "마스터"는 채팅 그룹·채팅 이름(MarginCook · 마스터 작업, 00 마스터 오케스트레이션)으로만 쓰이고, 해당 채팅은 "목표·우선순위·최종 사람 결정"으로 사람 소유로 명시된다(오케스트레이션안 89~90행, 팀구성안 160~162행). 오케스트레이션안이 사용하는 모든 역할 컨텍스트 ID(SOLAR-*, CODEX-*, FABLE-*, OPUS-FALLBACK, CONTEXT-STEWARD; 348~356행 등)는 팀구성안 §5.1(1062~1082행)에 등록돼 있다. (2) 요청 정규화·Task 라우팅·팀 배정 소유권 불일치 — 오케스트레이션안 §2(69~75행)는 요청 해석자·작업 그래프·실행 라우터의 소유자를 AI 부 오케스트레이터로 지정하고 채팅 01(91~92행)이 요청 정규화·Task 라우팅을 수행하며, 팀구성안도 §3.2(255~256행)에서 같은 책임을 솔라 AI 부 오케스트레이터에 부여하고 RACI(924행)에서 사람 A · AI 부 O R로 일치한다. 정식 이름·소속의 단일 소유는 팀구성안 §1.4로 명시적으로 위임돼 있다(오케스트레이션안 86행). 따라서 Task 요구사항의 조건부 지시("재현되면 등록")에 따라 이 ID는 등록하지 않았다.

판정: OPEN Major 1건(R0R1 번호 중복)으로 CHANGES_REQUIRED. 이 회차는 COMMIT 기반 predecessor→successor 계보의 최초 고정점이며, 후속 수정 commit에 대한 successor RECHECK에서 같은 ID로 재검수할 준비가 됐다. gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- EDIT-R0R1-COND-RENUMBER-001: REPLACE `docs/팀구성_상세기획안.md` · 10. decision commit의 정확한 SHA에서 보호 원격 필수 체크가 성공하고 보호 ref에 반영됐다. 외부 서명/attestation을 쓰더라도 같은 SHA의 `full-db-required`와 `protected-gate` 구성 job 성공 run ID·결론을 함께 봉인한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
