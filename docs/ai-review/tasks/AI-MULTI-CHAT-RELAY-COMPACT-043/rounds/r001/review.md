# AI-MULTI-CHAT-RELAY-COMPACT-043 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `5e80adf311041bf0048eae31a182b996acac13ca`

## 요약

Stage 13 다중 채팅 Mission Relay·Project Orchestrator 동기화 계약의 compact RECHECK 결과 PASS. (1) Stage 13 분리: model-plan.json은 1~12단계를 모두 completed로, 13단계를 별도 active 단계로 봉인하고, validateModelExecutionPlan이 baseStages(1~12) 정확 집합·완료 상태·기본 하한 21회(Terra 12/Sol 4/Fable 5/Opus 0)·stageProfiles 불변과 Stage 13 추가 하한(terra-xhigh 4·sol-high 2·fable-high 1)을 별도 multiChatCalls로 분리 검증한다. 테스트는 dual-engine 허용·bytes PASS 유지·capacity 재시도 축소 3종 사보타주를 포함한다. (2) 미션 격리: 문서 §4.1.1(205~240행)이 독립 mission_id·비식별 session_id, 미션별 1.7 경제성(누적 토큰·채팅 수 배수 아님, 조건 미충족 시 rollover 아닌 보류), 상태 파일·상태별 lock, activate/deactivate의 지정 미션 한정, Stop 훅의 단일 미션 HANDOFF 차단, HANDOFF당 successor 1개를 명시한다. (3) 단일 봉인 계획: 저장소당 model-plan.json 하나·채팅별 사본 금지·정확한 SHA 읽기 전용 결속이 명시되고, model-plan.json.sha256의 기록값 593b657c5a34062fecc6ad802b924efba1aef11d1e2d3bc1cd5a7a80a5b28bee가 현재 model-plan.json bytes의 SHA-256과 정확히 일치한다(history 원본 2건은 HISTORICAL로 validator가 hash 검증). (4) 권한 비확대: §4.1.1이 12단계 증거 소급 변경과 사람 승인·운영 배포 권한 확대를 금지하고, 시뮬레이터 authorizeAction은 PRODUCTION_EXECUTION을 HUMAN_ONLY_ACTION으로 차단한다. 계보 처리: 042/r001은 verdict 없는 RUN_FAILED(budget_exhausted, 실측 8.62 USD) 원본으로 보존되었고 review.json이 없어 승계할 Finding registry가 없으므로 본 회차의 모든 Finding은 신규다. 본 Task의 soft cap 10.00은 자동 증액이 아니라 DEC-AI-MULTI-CHAT-RELAY-COMPACT-043의 정확한 사람 pin(r001@10.00)에 결속된 단일 compact 재시도로 정책과 정합한다. ai:plans:simulate 71/71과 model plan SHA verification PASS는 read-only single-pass 특성상 SOLAR 보고 증거로 수용했다. 비차단 Improvement 2건: 문서 §0의 낡은 "현재 DRAFT" 문단이 ACTIVE 메타데이터·상태줄과 모순(39~41행), 새 §4.1.1 계약 조항이 REQUIRED_CLAUSES.orchestration에 고정되지 않아 문서 회귀 방어 부재. 각각 proposed_edits 첨부. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

## Findings

### RELAY-043-STALE-DRAFT-PARAGRAPH-01 — Improvement / OPEN

- 범주: DATA_INTEGRITY
- 영향: 활성화 이전 전이 기간용 문단이 제거되지 않아 문서 권위에 대한 자기모순이 남는다. 새 채팅·역할이 이 문단을 근거로 §4.1.1 다중 채팅 계약을 비구속 후보 흐름으로 오독할 수 있다. parsePlanMetadata 상태 검사(상태줄 ACTIVE)와 AGENTS.md 책임 등재가 ACTIVE를 뒷받침하므로 실제 권위 판정은 유지되고, Stage 13 변경 범위 밖의 기존 텍스트라 PASS를 막지 않는다.
- 근거: docs/AI-오케스트레이션-상세기획안.md:4, docs/AI-오케스트레이션-상세기획안.md:17, docs/AI-오케스트레이션-상세기획안.md:39
- 완료 조건: §0의 '현재 DRAFT' 문단(39~41행)을 활성화 사실(DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027, AGENTS.md 등재)과 일치하는 서술로 교체하거나 삭제한다. / 수정 후 문서에 DRAFT 상태 주장 텍스트가 남지 않고 corepack pnpm ai:plans:simulate가 계속 통과한다.
- 필요한 테스트: corepack pnpm ai:plans:simulate

### RELAY-043-SIM-CLAUSE-PIN-GAP-01 — Improvement / OPEN

- 범주: TEST_GAP
- 영향: model-plan.json 쪽 Stage 13 경계는 validateModelExecutionPlan이 강제하지만, 문서 쪽 격리·단일 SHA·권한 비확대 조항은 회귀 방어가 없어 후속 편집에서 조용히 약화될 수 있다. 이 저장소의 기존 패턴(다른 절은 모두 clause-pin + 사보타주 시험)과 불일치한 커버리지 공백이다. 현재 스냅샷의 실제 내용은 요구사항을 모두 충족하므로 PASS를 막지 않는다.
- 근거: scripts/ai-plan-network-simulation.mjs:82, docs/AI-오케스트레이션-상세기획안.md:205
- 완료 조건: REQUIRED_CLAUSES.orchestration에 §4.1.1의 핵심 조항(독립 mission_id/session_id, 타 채팅 비전파, 단일 봉인 model-plan·사본 금지, HANDOFF당 successor 1개, 1.7 비배수·보류 조건, 사람 승인·운영 배포 권한 비확대)을 고정하는 패턴이 추가된다. / ai-plan-network-simulation.test.mjs에 §4.1.1 조항 하나를 약화시키면 검사가 실패하는 사보타주 케이스가 최소 1건 추가된다. / 확장 후 corepack pnpm ai:plans:simulate 전체가 통과한다.
- 필요한 테스트: corepack pnpm ai:plans:simulate

## 공동 편집 제안

### EDIT-043-PIN-MISSION-RELAY-CLAUSES — ADD

- 대상: `scripts/ai-plan-network-simulation.mjs`
- 위치:     /## 3\. 사용자 요청 수신/,
- 연결 Finding: RELAY-043-SIM-CLAUSE-PIN-GAP-01
- 이유: §4.1.1의 미션 격리·단일 봉인 계획 SHA·HANDOFF 단일 successor·1.7 비배수·권한 비확대 조항을 REQUIRED_CLAUSES.orchestration에 고정해, 문서 쪽 Stage 13 계약이 시뮬레이션 회귀 검사 없이 약화되는 경로를 차단한다.

        /### 4\.1\.1 다중 채팅 Mission Relay·공통 모델 계획 계약/,
        /각각 독립 `mission_id`와 비식별 `session_id`/,
        /다른 채팅의 판정·비용·계보에 합산하거나 전파하지 않는다/,
        /봉인된 `model-plan\.json` 하나를 소유한다\. 채팅별로 계획 파일을\s*복제하지 않는다/,
        /동일 HANDOFF에는 후속 채팅을\s*하나만 연결하며, successor가 채택되면 predecessor 감시만 종료한다/,
        /1\.7은 누적 토큰 수나 채팅 수의 배수가 아니다/,
        /`rollover`가 아니라 보류 상태다/,
        /다중 채팅 기능을 사람 승인·운영 배포 권한으로 확대하지\s*않는다/,

### EDIT-043-FIX-STALE-DRAFT-STATUS — REPLACE

- 대상: `docs/AI-오케스트레이션-상세기획안.md`
- 위치: 이 문서는 현재 `DRAFT`이며 사람 승인으로 `ACTIVE`가 되고 `AGENTS.md` 책임 목록에 등재되기 전에는
- 연결 Finding: RELAY-043-STALE-DRAFT-PARAGRAPH-01
- 이유: front matter status: ACTIVE 및 본문 상태줄과 모순되는 낡은 DRAFT 문단을 활성화 사실과 일치하는 서술로 교체한다. 반영 시 이 문단의 이어지는 두 줄('구속력 있는 실행 규칙이 아니다…구현 후보 흐름만 설명한다', 40~41행)도 함께 제거해 하나의 문단으로 정리해야 한다.

    이 문서는 `DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027` 승인과 `AGENTS.md` 책임 목록 등재로 `ACTIVE`가 된 구속력 있는 실행 규칙이다. 활성화 이전 전이 기간에 요청 해석·승인·게이트 규칙을 `팀구성_상세기획안.md`가 소유했다는 서술은 역사 기록이며 현재 실행 규칙이 아니다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
