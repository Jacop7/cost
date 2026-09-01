# AI-ORCH-PLANS-FABLE-001 Fable 검수 — r003

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `5f6929095424b9fe53a2005ef5c4136ca2175f50`

## 요약

공식 Fable 경로(FABLE-ARCH·INITIAL)로 다섯 핵심 기획안(target 5f69290, tree 49b3850)을 독립 재검수했다. ① Stage 4 r2 Finding 7건 반영 확인: QUEUE-LOST-UPDATE-80은 팀구성 §11 6·8항(seq·직전 hash·chain prefix 보존, lock 안 재읽기)과 평가 §4.2·§13, 디렉터리 §8.3 사보타주로 해소. AUTO-BASELINE-81은 평가 §8의 route baseline A0·ROLE_CONTEXTS 단일 현재값·A3 이상만 anchor/decision commit 허용으로 해소. PLAN-COUNT-82는 오케스트레이션 §8.2의 누적 집합 단일 소유 선언과 평가 §11·디렉터리 §8.3의 복제 금지로 해소(타 문서의 문서 수 복제 잔존 없음 확인). METRIC-ANCHOR-83은 평가 §3.1·§5.1의 저장소 앵커 없는 질문 분리(자기보고 하한·미확인)로 해소. LRN-VERIFIER-84는 평가 §6.1·§6.2와 팀구성 §5.6의 검증자 독립성·verifier_role·지정 Decision ID 의무로 해소. LOCK-NEST-86은 팀구성 §11 9항(Task lock 보유 중 queue ledger lock 획득 금지), OWNER-LOCK-ORDER-87은 §11 7항(최초 owner 지정의 queue ledger→Task lock 순서)으로 해소. ② r3 Finding 3건: ADVISORY-BUDGET-88은 이번 검수 입력에 승인 장부(turn-h001, advisory_budget_usd_approved=2.00)·t0001 run.json·r3 증거가 모두 포함됐고 entry hash 2d72ca5a…, append 후 hash 7d17c8e7…, 누적 $21.37≤$22.00이 상호 일치해 해소. A0-DELEGATE-89는 팀구성 §4.5의 A0 최소 권한과 평가안 §8 위임의 DELEGATED_PENDING 명시로, ONTO-REF-90은 팀구성 §3.2의 온톨로지 소유권 ACTIVE 승격 후 한정으로 해소. ③ 계약 상호 모순 점검: 요청 수신→request_dispositions[] append(seq·hash)→전역 queue ledger lock→Task lock 고정 순서→lease 획득·lock 안 재확인→만료 자동 인수 금지→실패 폐쇄(RUN_FAILED·환경 미검증)→exact SHA 증거 고정의 상태 전이가 팀구성 §11 단일 권위 아래 오케스트레이션 §4·온톨로지 §6·디렉터리 §7·평가 §4.2에서 폐쇄적으로 일관된다. OPUS_DIRECT_ADVISORY와 공식 Fable gate의 분리는 다섯 문서 모두에서 유지된다(오케 §6.1·§8.2, 평가 §10, 디렉터리 §10, 팀구성 §3.10.2). ④ 잔여 판정: 기존 r2·r3 Finding에서 잔여 Critical·Major·명세상 필수 0건. 다만 신규 Minor 2건을 등록한다. PLAN-ROUTE-SWITCH-91: 오케 §8.2·§13, 평가 §11·§15, 디렉터리 §11 단계6의 완료 조건이 여전히 '누적 Opus 2회' 유효 회차를 요구하나, 2026-09-02 사람 결정(AI-ORCH-PLANS-FABLE-R2/R3-20260902)이 외부 교차검수를 공식 Fable 경로로 전환했고 advisory envelope 잔액도 $0.63뿐이라 결정 ID를 인용한 문서 갱신 전까지 완료 조건이 최신 사람 결정과 모순된다. ROLECTX-SCOPE-92: 팀구성 §11은 ROLE_CONTEXTS.md에 '실제 활성 컨텍스트 식별자와 판본 hash만' 기록한다고 하나 평가 §8은 같은 파일에 route별 현재 A단계·승인 Decision ID·적용 시각·정책·컨텍스트 hash 기록을 요구해 기록 범위 계약이 충돌하며, 엄격 해석 시 AUTO-BASELINE-81 해소 장치(단일 현재값 레지스트리)가 구현 단계에서 무력화될 수 있다. 두 건 모두 proposed_edits로 구체 문구를 제안했다. 따라서 verdict는 CHANGES_REQUIRED이며, 두 Minor 반영 후 재검수에서 잔여 필수 0건 판정이 가능하다. 본 판정은 로컬 검수이며 gate_state는 OPEN으로 유지된다.

## Findings

### PLAN-ROUTE-SWITCH-91 — Minor / OPEN

- 범주: POLICY
- 영향: 다섯 기획안의 완료·활성화 조건이 최신 사람 결정과 모순된 상태로 남아, 이후 채팅이 문서 문면대로 소진된 Opus advisory 회차를 재시도하거나 기획안 묶음을 영구 미완료로 판정하는 실행 혼선이 생길 수 있다. 사람 결정은 문서보다 상위 권위이므로 AGENTS.md 규칙상 같은 공식 파일에 반영돼야 현재 기준이 된다.
- 근거: docs/AI-오케스트레이션-상세기획안.md:352, docs/AI-오케스트레이션-상세기획안.md:507, docs/AI-품질-학습-자율성-평가기획안.md:388, docs/AI-품질-학습-자율성-평가기획안.md:477, docs/디렉터리-문서신경망-재설계-기획안.md:350, docs/ai-review/evidence/AI-PLANS-STAGE4-OPUS-R3.md:10, COLLABORATION_LOG:0
- 완료 조건: 오케스트레이션 §8.2에 사람 결정 ID(AI-ORCH-PLANS-FABLE-R2-20260902)를 인용해 외부 교차검수 경로가 공식 Fable 경로로 전환됐음을 기록한다. / 오케스트레이션 §13, 평가안 §11·§15, 디렉터리안 §11 단계 6의 'Opus 2회' 요건을 '결정 이후에는 같은 누적 범위의 공식 Fable 유효 회차로 충족'하도록 갱신하되, 기존 Opus 증거·비용·실패 보존 규칙은 기록된 회차에 그대로 적용한다. / 갱신 후에도 누적 집합의 문서 수·파일 목록 단일 소유(오케 §8.2)와 advisory-비게이트 원칙이 유지된다.
- 필요한 테스트: 후속 Fable RECHECK에서 네 문서의 갱신 위치와 결정 ID 인용을 확인 / docs-graph-check 도입 시 누적 검수 경로 표기의 문서 간 중복·모순 검사 fixture 추가

### ROLECTX-SCOPE-92 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: 두 문서가 ROLE_CONTEXTS.md의 기록 범위를 서로 다르게 계약해, 평가안 ACTIVE 승격 시 구현자가 상위 승인 문서(팀구성)의 '만' 문구를 따라 A단계·승인 Decision ID·적용 시각을 누락하면 route별 자율성 현재값의 단일 권위(AUTO-BASELINE-81 해소 장치)가 무력화된다.
- 근거: docs/팀구성_상세기획안.md:1724, docs/AI-품질-학습-자율성-평가기획안.md:325, docs/ai-review/evidence/AI-PLANS-STAGE4-OPUS-R2.md:30
- 완료 조건: 팀구성 §11의 ROLE_CONTEXTS.md 기록 범위 문구를 평가안 §8이 정의한 필드(route·현재 A단계·승인 Decision ID·적용 시각·정책·컨텍스트 hash)를 배제하지 않게 수정하거나, 해당 필드 소유를 평가안 §8에 위임함을 명시한다. / 역할 설명 복사 금지 원칙은 유지한다.
- 필요한 테스트: docs-graph-check 도입 시 같은 파일 기록 범위에 대한 문서 간 계약 충돌 검사 / 후속 Fable RECHECK에서 수정 문구 확인

## 공동 편집 제안

### EDIT-ROUTE-SWITCH-ORCH-82 — ADD

- 대상: `docs/AI-오케스트레이션-상세기획안.md`
- 위치: 앞으로 이 목록에 핵심 기획안을 추가하려면 사람 Decision으로 범위를 갱신하고, 추가 직후 전체
- 연결 Finding: PLAN-ROUTE-SWITCH-91
- 이유: 사람 결정으로 전환된 외부 교차검수 경로를 누적 집합 단일 소유 절에 반영해 완료 조건 모순을 제거한다.

    2026-09-02 사람 결정 `AI-ORCH-PLANS-FABLE-R2-20260902`에 따라 이 누적 집합의 외부 교차검수는 직접 Opus advisory 대신 공식 Fable 경로의 읽기 전용 검수 Task(예: `AI-ORCH-PLANS-FABLE-001`)로 실행한다. 본 절과 관계 문서의 'Opus 2회' 유효 재검수 요건은 결정 이후 같은 누적 범위를 검수하는 공식 Fable 유효 회차로 충족하며, 직접 advisory의 비용·실패 보존·비게이트 표기 규칙은 이미 기록된 advisory 회차에 그대로 적용한다.

### EDIT-ROUTE-SWITCH-ORCH-DONE — REPLACE

- 대상: `docs/AI-오케스트레이션-상세기획안.md`
- 위치: - 핵심 기획안 추가마다 누적 Opus 2회 교차검수가 실행된다.
- 연결 Finding: PLAN-ROUTE-SWITCH-91
- 이유: 완료 조건을 사람 결정과 일치시킨다.

    - 핵심 기획안 추가마다 현재 누적 집합 전체의 외부 교차검수 2회가 실행된다. 2026-09-02 사람 결정 이후 이 교차검수는 공식 Fable 경로의 유효 회차로 수행한다.

### EDIT-ROUTE-SWITCH-EVAL-11 — ADD

- 대상: `docs/AI-품질-학습-자율성-평가기획안.md`
- 위치: 이 문서가 추가되면 오케스트레이션 기획안 §8.2가 단일 소유하는 현재 누적 집합 전체를 Opus가
- 연결 Finding: PLAN-ROUTE-SWITCH-91
- 이유: 평가안의 누적 검수 요건이 경로 전환 결정과 모순되지 않도록 §8.2 단일 소유에 위임한다.

    검수 엔진·경로는 오케스트레이션 §8.2에 기록된 현재 사람 결정을 따른다. 2026-09-02 결정 `AI-ORCH-PLANS-FABLE-R2-20260902` 이후 외부 교차검수는 공식 Fable 경로로 실행하며, 본 절의 'Opus' 표기는 그 결정 전에 실행된 advisory 회차 기록에만 적용한다.

### EDIT-ROUTE-SWITCH-EVAL-DONE — REPLACE

- 대상: `docs/AI-품질-학습-자율성-평가기획안.md`
- 위치: - 오케스트레이션 기획안 §8.2가 정한 현재 누적 집합 전체의 Opus 2회에서 잔여 필수 Finding 0건을 확인한다.
- 연결 Finding: PLAN-ROUTE-SWITCH-91
- 이유: 완료 조건을 사람 결정과 일치시킨다.

    - 오케스트레이션 기획안 §8.2가 정한 현재 누적 집합 전체의 외부 교차검수 유효 2회(2026-09-02 사람 결정 이후 공식 Fable 경로)에서 잔여 필수 Finding 0건을 확인한다.

### EDIT-ROUTE-SWITCH-DIR-STAGE6 — REPLACE

- 대상: `docs/디렉터리-문서신경망-재설계-기획안.md`
- 위치: - 누적 Opus 자문 2회와 공식 필요한 Fable route를 완료한다.
- 연결 Finding: PLAN-ROUTE-SWITCH-91
- 이유: 활성화 조건을 사람 결정과 일치시키고 검수 경로 정의를 §8.2 단일 소유에 위임한다.

    - 오케스트레이션 §8.2의 현재 사람 결정이 정한 외부 교차검수 유효 회차(2026-09-02 결정 이후 공식 Fable 경로)와 공식 필요한 Fable route를 완료한다.

### EDIT-ROLECTX-SCOPE-TEAM-11 — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: `ROLE_CONTEXTS.md`는 역할 설명을 복사하지 않고 실제 활성 컨텍스트 식별자와 판본 hash만 기록한다.
- 연결 Finding: ROLECTX-SCOPE-92
- 이유: ROLE_CONTEXTS.md 기록 범위를 평가안 §8의 단일 현재값 계약과 정합시켜 AUTO-BASELINE-81 해소 장치가 구현 단계에서 무력화되지 않게 한다.

    `ROLE_CONTEXTS.md`는 역할 설명을 복사하지 않고 실제 활성 컨텍스트 식별자·판본 hash와, 평가 기획안 §8이 정의하는 route별 현재 자율성 단계·승인 Decision ID·적용 시각·정책·컨텍스트 hash만 기록한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: PLAN-ROUTE-SWITCH-91, ROLECTX-SCOPE-92

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
