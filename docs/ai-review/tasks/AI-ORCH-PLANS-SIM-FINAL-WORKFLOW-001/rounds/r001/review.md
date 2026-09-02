# AI-ORCH-PLANS-SIM-FINAL-WORKFLOW-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-FINAL`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `FINAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `c1b595f74f2fc7824b480bf8457e3026c0f1d6dc`

## 요약

FINAL 독립 감사 결과, 시뮬레이션 계약 자체는 건전하다. 적대 시험 파일에 test 케이스가 정확히 59개 존재해 59/59 주장과 일치하고, AI-PLANS-WORKFLOW-001과 시뮬레이터·시험 코드가 가상 protected gate를 VIRTUAL_SIMULATION/VIRTUAL_FIXTURE 경계로 봉인해 실제 배포 증거로 승격하지 않으며, 다섯 기획안 전체에 원 요청→정규화→Task 결속(request_dispositions hash chain), 단일 edit_owner·lease, append-only 감사, Finding·Decision·Learning·자율성 수명주기, 사람 전용 운영·비가역 결정 경계가 실재한다. 온톨로지·오케스트레이션·디렉터리·평가 기획안과 시뮬레이터·시험 파일의 SHA-256은 Codex 2차 증거의 고정값과 정확히 일치한다. 그러나 증거 결속에서 필수 결함 3건을 발견했다. (1) Major: Codex 2차 증거(AI-PLANS-SIM-CODEX-ULTRA-R2.md:42)는 팀구성_상세기획안.md를 FB695AC1…로 고정했으나 봉인된 target commit의 실제 파일은 4E8F33E0…이다. 2차 감사 후 문서가 변경됐고 재감사·변경 사유 기록이 스냅샷 어디에도 없어, 다섯 후보 문서 중 하나가 유효한 2차 Codex 증거 없이 최종 검수에 올라왔다. (2) Major: 패킷의 required_evidence인 "pnpm verify 6/6·DB 50/50·경합·업그레이드 23/23 통과 기록"은 이 Task가 아니라 INTL-1F(2026-09-01, SHA 5f67294/cd38b2b)의 기록이다. 본 Task의 작업큐 항목은 여전히 "구현 exact commit 생성 대기" 상태로 verify 기록이 없고, 선행 Task의 43a702a 실행은 명시적으로 5/6(개발 DB 44/50)이었다. target commit c1b595f에 결속된 전체 verify 증거가 스냅샷에 부재하므로 다른 Task의 통과 수치를 차용한 것으로 판정한다. (3) Minor: 작업큐가 참조하는 Codex 1차 증거 두 파일이 스냅샷에 없어 "Codex 2회의 서로 다른 scope·세션·증거 hash" 독립성 요건을 2차분만으로 교차 검증할 수 없다. 문서 활성화와 실제 디렉터리 생성은 승인하지 않으며, 가상 gate는 배포 증거가 아니라는 경계를 유지한다. 세 Finding 해소(팀구성안 최종본 재감사, target commit 결속 verify 기록, 1차 증거 포함) 전에는 PASS 불가.

## Findings

### FNL-EVIDENCE-BINDING-001 — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: 다섯 최종 후보 문서 중 팀구성_상세기획안.md가 Codex 2차 적대 감사가 실제로 본 판본과 다르다. 감사 후 무기록 변경이 허용되면 '후보 문서 SHA-256 고정' 요건이 무력화되고, 검수되지 않은 내용이 사람 최종 승인 입력으로 흘러갈 수 있다.
- 근거: docs/ai-review/evidence/AI-PLANS-SIM-CODEX-ULTRA-R2.md:40, COLLABORATION_LOG:0, docs/작업큐.md:217
- 완료 조건: target commit에 포함된 팀구성_상세기획안.md 판본(4e8f33e0…)에 대한 Codex 재감사 증거 또는 FB695AC1…→4e8f33e0… 변경 diff와 사유가 불변 증거 파일로 기록된다. / 재감사 증거가 target commit·tree·문서 SHA-256을 함께 고정하고 작업큐 항목에서 연결된다.
- 필요한 테스트: 재감사 후 corepack pnpm ai:plans:simulate 59/59 재실행 기록을 같은 판본에 결속한다.

### FNL-VERIFY-EVIDENCE-002 — Major / OPEN

- 범주: TEST_GAP
- 영향: 다른 Task의 통과 수치를 본 Task의 필수 증거로 차용한 형태다. AGENTS.md의 '건너뛴 단계가 있으면 전체 통과라고 표현하지 않는다' 원칙과 충돌하며, target commit이 전체 게이트를 통과했다는 거짓 신뢰를 만든다.
- 근거: docs/작업큐.md:598, docs/작업큐.md:228, docs/작업큐.md:210, COLLABORATION_LOG:0
- 완료 조건: target commit c1b595f(또는 그 후속 exact commit)에서 실행한 corepack pnpm verify 6/6 기록이 실행 시각·SHA·단계별 수치와 함께 작업큐 AI-ORCH-PLANS-SIM-1 항목 또는 불변 증거 파일에 기록된다. / required_evidence 문구가 실제 본 Task 기록만 인용하도록 정정된다.
- 필요한 테스트: corepack pnpm verify (target exact commit, 6/6 전체 범위)

### FNL-CODEX-ROUND1-003 — Minor / OPEN

- 범주: TEST_GAP
- 영향: Codex 1차 증거가 감사 입력에 없어 '같은 증거를 이름만 바꿔 재사용'하는 적대 시나리오를 실제 증거 수준에서 배제하지 못한다. 2회 독립 검수 요건의 절반만 검증 가능하다.
- 근거: docs/작업큐.md:318, docs/ai-review/simulations/AI-PLANS-WORKFLOW-001.md:47, COLLABORATION_LOG:0
- 완료 조건: Codex 1차 증거 파일(들)이 후속 검수 스냅샷의 evidence_paths에 포함되어 1차·2차의 scope·세션·증거 SHA-256 상이함이 확인된다.
- 필요한 테스트: 없음

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FNL-EVIDENCE-BINDING-001, FNL-VERIFY-EVIDENCE-002, FNL-CODEX-ROUND1-003

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
