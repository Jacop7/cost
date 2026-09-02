# AI-ORCH-PLANS-SIM-FINAL-WORKFLOW-005 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-FINAL`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `FINAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `b4f79a6e9e3bfc830b4686a7b6ab861a37b26cf3`

## 요약

다섯 기획안을 처음부터 독립 감사했다. (1) 요청·정규화·Task·단일 소유자·lease 결속: 온톨로지 §6이 판정 enum 4종(ADD·SUPERSEDE_PROPOSAL·NEW_TASK·STATUS_ONLY)과 정규화 필드를 단일 소유하고, 팀 구성안 §11이 queue ledger lock→Task lock 고정 순서, request_dispositions[]의 Task별 seq·직전 hash chain, 만료 lease 자동 인수 금지, 최초 edit_owner 1회 지정을 완결한다. 오케스트레이션 §4와 디렉터리 §7은 이를 재정의 없이 참조하며 authority DAG(team→ontology→orchestration→directory→quality)는 다섯 문서 front matter와 디렉터리 §6 기계 판독 블록에서 일치한다. (2) 정상·오류·방치 흐름 폐쇄: 실패는 RUN_FAILED·환경 미검증으로만 남기고 PASS로 합성하지 않으며(오케스트레이션 §9.1, 평가안 §4.6), 검수 루프는 OPEN→FIXING→READY_FOR_REVIEW→VERIFIED와 보호 원격 체크+closure successor 뒤에만 CLOSED를 허용하고(팀 §4.4), 프로덕션·정책·위험 수용은 자율성 단계와 무관한 사람 전용이며(평가안 §8, 오케스트레이션 §10.2), Learning은 CANDIDATE→VERIFIED→RETIRED에 독립 검증자·사람 Decision을 요구하고 FINAL_INDEPENDENT 전 회차 주입을 금지한다(평가안 §6). (3) 증거 대조: R3의 c1b595f 파일 SHA-256 7개 중 다섯 기획안 해시는 이 스냅샷 해시와 정확히 일치하고, GitHub Actions 33582393050의 Node 20.19.4·24·full-db-required 성공이 R3 71~79행에 고정돼 있다. R4는 Fable 실패·거부 5회(총 $11.790167)를 유효 회차로 세지 않고 보존했으며 유효 회차는 WORKFLOW-001/r001 CHANGES_REQUIRED 1회뿐이라는 기록이 작업큐와 일치한다. R2의 CRLF 해시 오류는 덮어쓰지 않고 R3로 정정됐다. 과거 실패 회차는 증거 이력으로만 취급했고 가상 VIRTUAL_SIMULATION gate를 실배포 증거로 승격하지 않았으며 DRAFT 활성화를 승인하지 않는다. 새 Finding 2건: (Major) task packet이 필수 증거로 주장한 b4f79a6 exact-commit 격리 실행 59/59가 저장소 내 어떤 파일에도 기록돼 있지 않다. 줄끝 안정 manifest 구현은 시뮬레이터에 실재하지만 마지막 격리 실행 기록은 07fbbbe(시험 파일 5E5CEF71…)이고 이 스냅샷의 시험 파일(16b07928…)과 판본이 다르다. (Minor) b4f79a6에 commit된 작업큐가 R4를 여전히 untracked·worktree mixed로 선언하고 current_state도 07fbbbe까지만 기록해, §11 재개 계약의 Git 상태 대조와 어긋난다. 두 건 모두 evidence 경로 수정이 필요하므로 proposed_edits 없이 별도 후속 Task를 요청한다. 판정은 CHANGES_REQUIRED이고 gate_state는 OPEN으로 유지된다.

## Findings

### FW5-B4F79A6-RUN-EVIDENCE-002 — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: target commit b4f79a6의 시뮬레이터·시험 판본은 07fbbbe에서 59/59가 검증된 판본과 다르므로, 기록 없는 59/59 주장을 유효 증거로 받아들이면 검증되지 않은 실행 결과를 합성하는 것이 된다. 이는 R3·R4가 확립한 exact-SHA 증거 결속 관행(각 판본 변경마다 후속 증거 문서로 재고정)을 현재 target에서 끊는다.
- 근거: scripts/ai-plan-network-simulation.mjs:153, docs/ai-review/evidence/AI-PLANS-SIM-CODEX-ULTRA-R4.md:26, docs/작업큐.md:228
- 완료 조건: b4f79a6를 checkout한 격리 clone 또는 exact-SHA CI에서 node --test scripts/ai-plan-network-simulation.test.mjs 실행 결과(59/59 또는 실제 결과)를 새 불변 증거 문서(예: R5)에 시험 파일 SHA-256(16b07928…)·시뮬레이터 SHA-256(04b74ad2…)·commit·tree OID와 함께 고정한다. / 실행이 실패하면 실패 원본을 보존하고 PASS로 세지 않는다. / 후속 commit에서 작업큐 current_state가 b4f79a6 실행 결과를 참조하도록 갱신한다.
- 필요한 테스트: exact b4f79a6 격리 환경에서 node --test scripts/ai-plan-network-simulation.test.mjs 전체 실행 / candidate_manifest_sha256(35ad0825…)가 b4f79a6 commit bytes 기준으로 재계산 일치하는지 확인

### FW5-QUEUE-SNAPSHOT-001 — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: 팀 구성안 §11 재개 계약은 필수 복원 필드가 Git 상태와 다르면 환경 미검증으로 중단하도록 요구한다. b4f79a6에서 이 필드로 복원하는 새 채팅은 이미 추적된 R4를 미추적으로 오인하거나 불필요한 환경 미검증 중단을 겪는다. 판정을 위조하는 결함은 아니지만 단일 장부의 자기 일관성이 깨진 상태다.
- 근거: docs/작업큐.md:361, docs/작업큐.md:228
- 완료 조건: 후속 commit에서 worktree_state·untracked_in_scope_paths·current_state를 해당 commit 시점의 실제 Git 상태와 일치하게 갱신하되 request_dispositions[] chain과 기존 이력은 보존한다. / commit에 포함되는 작업큐 스냅샷 필드가 그 commit의 추적 상태와 모순되지 않는지 확인하는 검사(또는 검사 항목)를 시뮬레이터 live-task 검증에 추가한다.
- 필요한 테스트: 작업큐 Task 블록의 untracked_in_scope_paths가 실제 git 추적 상태와 모순되면 실패하는 사보타주 검사

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FW5-B4F79A6-RUN-EVIDENCE-002, FW5-QUEUE-SNAPSHOT-001

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
