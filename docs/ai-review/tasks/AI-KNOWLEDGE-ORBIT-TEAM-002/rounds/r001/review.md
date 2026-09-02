# AI-KNOWLEDGE-ORBIT-TEAM-002 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `37659fb82f5b192d49e8753e7235df4fc4b527c9`

## 요약

팀 구성안 1.3의 §1.3·§1.4·§3.2.1을 기존 §1.1·§4·§5·§11 및 사전기획 §3·§4·§17과 전문 대조했다. (1) 다섯 팀 그룹(§1.3)은 사전기획 §4.1/§4.1.1 대응을 누락·과장 없이 반영하고, 팀 그룹이 새 승인 주체가 아니라 라우팅 경계이며 승인·독립성은 §1.1·§4를 따른다고 명시한다. Data · Backend의 계산 권위와 Server · Supabase · Operations의 호스팅·운영 책임 분리, 세금·손익·원장 공식 불변경, 자격증명·백업·과금 단독 결정 금지, `server-supabase-operations` slug와 `Platform` 금지(145~149행)가 사전기획 §4.1(117~120행)·§4.1.1(134~137행)과 일치한다. (2) 채팅 라우팅(§1.4)은 마스터 5개·부서 6개·임시 Task 채팅을 사전기획 §3.1·§3.2와 동일하게 정의하고, 채팅이 공식 기억·승인 장부가 아니며 상태 변경은 권위 파일·증거로만 효력이 생긴다는 경계(153~154행), 채팅별 경쟁 공식 문서·`_shared` 권위 금지(179~181행)를 유지한다. (3) `04 Quality · Review`는 조정 전용이고 실제 감사는 §5.4의 회차별 클린 컨텍스트로 분리되며(175~177행), Quality verdict와 사람 Go/No-Go 분리도 §1.1·§3.2.1 금지 목록에서 보존된다. (4) Steward(§3.2.1)는 관측·전환 신호 전용으로 사전기획 §4.3의 허용·금지를 보수적으로 반영(금지 항목을 오히려 확대)하고, 복원·전이 책임을 AI 부 오케스트레이터에, 예산 상향·배포를 사람에 남긴다. (5) 증거 시뮬레이션 파일에서 test 블록 정확히 59개를 확인해 장부의 59/59 주장과 정합함을 확인했다(직접 실행은 범위 밖). 다만 필수 Finding 2건이 남는다. [Minor] ORBIT-TEAM-STEWARD-REG-001: Steward가 §3.2.1에 확정 역할로 기술되면서도 §1.1 최종 역할 배정표·§1.2 조직도·§5.1 필수 컨텍스트 분리 목록에 등록되지 않았다. 사전기획 §4.3은 확정 시 팀 구성안 개정으로 소속 컨텍스트를 지정하라고 요구했는데 채팅 소속만 있고 실행 컨텍스트 ID가 없어, SOLAR-ORCH 겸용 시 부 오케스트레이터의 Steward 신호 검토가 자기 검토가 되고 `ROLE_CONTEXTS.md`에 등록할 ID도 없다. [Minor] ORBIT-TEAM-XREF-PACKET-002: §1.4(179행)가 Task Packet의 정의 절을 §5.2가 아닌 §11로 잘못 참조해, 발행 시점 스냅샷(§5.2)과 현재값 권위(§11 작업큐)의 경계를 문서 스스로 흐린다. [Improvement, 비차단] ORBIT-TEAM-SIM-COVERAGE-003: 59개 테스트 중 신설 §1.3/§1.4/§3.2.1 계약(역할 책임 중복 검사·Steward 과권한 시뮬레이션)을 다루는 항목이 없다. 사전기획 §13·§17.3상 검사기 단계 후속 작업이므로 차단 사유는 아니다. 세 건 모두 같은 공식 파일에 반영 가능한 proposed_edits를 제공했다. VERIFIED·PASS는 외부 게이트를 종결하지 않으며 gate_state는 OPEN으로 유지된다.

## Findings

### ORBIT-TEAM-STEWARD-REG-001 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: Steward가 SOLAR-ORCH 등 복원·제작 컨텍스트와 겸용 실행될 여지가 남아, AI 부 오케스트레이터의 Steward 신호 검토가 자기 검토로 퇴화하고 관측자·행위자 분리가 약해진다. §5.1·ROLE_CONTEXTS.md 기준의 컨텍스트 등록·감사 표본 추출 대상도 특정할 수 없다.
- 근거: docs/팀구성_상세기획안.md:318, docs/팀구성_상세기획안.md:69, docs/팀구성_상세기획안.md:1052, docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md:154
- 완료 조건: §5.1 컨텍스트 목록에 Steward 전용 컨텍스트 ID를 추가하고 제작·검수·복원 컨텍스트와 겸용하지 않음을 명시한다. / §1.1 역할표에 Steward 행(주 담당 컨텍스트, 독립 검증 주체, 승인 경계)을 추가하거나, Steward가 §1.1 승인 대상이 아닌 이유와 활성화 전 임시 취급을 한 문장으로 명시한다. / §3.2.1에서 해당 컨텍스트 ID를 참조해 채팅 소속과 실행 컨텍스트를 구분한다.
- 필요한 테스트: 문서 네트워크·역할 검사기 구현 단계에서 §3에 정의된 모든 활성 역할이 §1.1 표와 §5.1 컨텍스트 목록에 등록됐는지 대조 검사

### ORBIT-TEAM-XREF-PACKET-002 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: 확정 거버넌스 문서의 잘못된 절 참조가 §5.2 발행 시점 스냅샷 계약과 §11 현재값 권위(lease·복원 필드)를 혼동하게 만들어, 채팅이 §11 작업큐 항목을 Task Packet 스키마로 오독하거나 스냅샷 값을 현재값 권위로 오용할 여지를 만든다.
- 근거: docs/팀구성_상세기획안.md:179, docs/팀구성_상세기획안.md:1074, docs/팀구성_상세기획안.md:1742
- 완료 조건: §1.4의 해당 문장을 §5.2 Task Packet 참조로 수정하고, §11은 작업큐 필수 필드·복원 권위로 구분해 참조한다.
- 필요한 테스트: 문서 네트워크 검사기 구현 단계에서 절 번호 상호 참조의 실제 절 제목 대조 검사

### ORBIT-TEAM-SIM-COVERAGE-003 — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 59/59 통과는 기존 문서 네트워크·작업큐·Learning 계약만 검증하므로 v1.3 신설 계약의 회귀 방어가 아직 없다. 사전기획 §13·§17.3상 검사기·파일럿 단계 후속 작업이므로 차단 사유는 아니나, 구현 위치를 명시하지 않으면 검증 연결이 유실될 수 있다.
- 근거: scripts/ai-plan-network-simulation.test.mjs:268, docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md:570, docs/팀구성_상세기획안.md:339
- 완료 조건: 팀 그룹 라우팅 비권위·역할 책임 중복·Steward 과권한 검사를 문서 네트워크 시뮬레이션 또는 후속 검사기의 검증 항목으로 추가하는 작업을 개정·검사기 Task에 명시적으로 연결한다.
- 필요한 테스트: §1.3 팀 그룹이 승인·판정 주체로 오용되는 시나리오 거부 테스트 / Steward가 verdict 변경·필수 증거 제외·예산 상향을 시도하는 과권한 시뮬레이션 거부 테스트 / §1.1 역할과 §1.3 팀 그룹 대응의 책임 중복·누락 대조 검사

## 공동 편집 제안

### EDIT-TEAM-STEWARD-CONTEXT-A — ADD

- 대상: `docs/팀구성_상세기획안.md`
- 위치: OPUS-ADVISORY       사람이 승인한 문서 묶음을 파일·셸 권한 없이 검토하는 비게이트 자문 컨텍스트
- 연결 Finding: ORBIT-TEAM-STEWARD-REG-001
- 이유: §3.2.1의 확정 Steward 역할에 §5.1 필수 컨텍스트 분리 목록의 전용 ID를 부여해 SOLAR-ORCH 겸용과 자기 검토 여지를 제거하고 ROLE_CONTEXTS.md 등록 대상을 특정한다.

    CONTEXT-STEWARD     컨텍스트 압력·외부 검수 예산 관측과 전환 신호 전용 컨텍스트. §3.2.1의 허용·금지를 따르며 제작·검수·복원 컨텍스트와 겸용하지 않는다

### EDIT-TEAM-STEWARD-ROLE-ROW-B — ADD

- 대상: `docs/팀구성_상세기획안.md`
- 위치: | 부 오케스트레이션·문서 관리 | 솔라 울트라 전용 컨텍스트 | 페이블 정기 운영 감사 | AI 부 오케스트레이터, 정책 변경만 사람 |
- 연결 Finding: ORBIT-TEAM-STEWARD-REG-001
- 이유: §1.1 최종 역할 배정표에 Steward의 주 담당·독립 검증·승인 경계를 등록해 §3.2.1과 역할표의 내부 정합성을 복원한다.

    | 컨텍스트·토큰 관측(Steward) | `CONTEXT-STEWARD` 전용 컨텍스트(§3.2.1) | `Quality · Review` 또는 독립 감사 표본 검증 | 신호 발행까지만 AI, 전이·복원은 AI 부 오케스트레이터, 예산 상향·정책은 사람 |

### EDIT-TEAM-XREF-PACKET-C — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: 마스터·부서·Task 채팅 모두 §11의 같은 Task Packet과 `docs/team/ROLE_CONTEXTS.md`를 참조한다.
- 연결 Finding: ORBIT-TEAM-XREF-PACKET-002
- 이유: Task Packet의 정의 소유 절은 §5.2이므로 잘못된 절 참조를 바로잡고, §11은 작업큐 필수 필드·복원 권위로 구분해 스냅샷과 현재값 권위의 경계 혼동을 제거한다.

    마스터·부서·Task 채팅 모두 §5.2의 같은 Task Packet과 §11의 작업큐 필수 필드, `docs/team/ROLE_CONTEXTS.md`를 참조한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: ORBIT-TEAM-STEWARD-REG-001, ORBIT-TEAM-XREF-PACKET-002

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
