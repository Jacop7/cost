# AI-TEAM-KNOWLEDGE-ORBIT-AUDIT-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `21a368b0da12acbb1c1534f8df8a2163a54ee98a`

## 요약

수정 commit 21a368b0의 Knowledge Orbit Graph 결정 패킷을 여섯 요구사항 기준으로 전체 독립 감사했다. (1) 여섯 번째 공식본 여부: 패킷은 1~7행에서 스스로를 선행 결정 패킷으로 한정하고 docs/ai-review/evidence/에 위치하며(온톨로지 §3의 ADVISORY_REVIEW 위치), §17이 모든 정책 변경을 다섯 기획안 개정 Task와 사람 승인 뒤로 미룬다 — 경쟁 공식본 아님. (2) 권위 경계: §10은 팀구성 §11의 docs/team/ 구조(1709~1722행)를 원문 인용하고 _shared 권위군을 제거했으며 view는 생성 후보·손작성 금지로 한정. §7.1 HANDOFF는 팀구성 §11(1664~1670행)을 단일 권위로 선언하고 §11 전 필드(risk_level·risk_basis, edit_owner/owner_session_ref/lease_expires_at, request_dispositions, stop_conditions, agents_md_blob_sha 포함)를 보존. §8.1~8.2는 온톨로지 §3·§4 어휘와의 동일/분해/신규 후보 대응표를 갖추고 신규 어휘는 온톨로지 개정으로만 추가. (3) Quality 분리: §4.1이 Quality 소유를 '출시 게이트 증거·판정 보고'로 한정하고 Go/No-Go·운영 승인을 사람 소유로 명시(팀구성 §1.1 85~86행과 일치), §3.2가 상설 04 조정 채팅과 회차별 클린 검수 컨텍스트를 분리. (4) 명칭·권한: §6.1~6.3이 HANDOFF_READY 상태명을 통일하고 CONTEXT_ROLLOVER_REQUIRED를 전이 요청 신호로 정의하며 기존 lease 오류 코드 HANDOFF_REQUIRED(시뮬레이션 427·877행)와의 비공유를 명시. §4.1.1이 5팀 그룹↔팀구성 §1.1 역할 대응표를 제공하고 Server · Supabase · Operations로 명칭 통일, Steward는 신설 후보·관측 전용·Quality/Fable 표본 감사 대상으로 한정. (5) 지표·개정 순서: §12 표가 수집 위치·계산·초기 실패 후보 3열을 갖추고 §17.1~17.3이 상호작용 계약·실패 폐쇄·실제 개정 순서를 제공. (6) 이전 r001 7개 지적(DOCPLANE-001~METRIC-007)은 위 근거로 현재 commit에서 모두 실질 해소됐음을 대조 확인했다. formal 승계·CLOSED는 주장하지 않는다. 그러나 신규 필수 Finding 2건을 발견했다. [Major] 패킷 §4.2(141행)의 요청 판정 enum `ADD | REPLACE | NEW_TASK | QUESTION`이 온톨로지 §6.3(237~248행)이 "단일 정의"로 고정한 `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY` 및 팀구성 256~257행·오케스트레이션 §4.2와 충돌하고, `REPLACE`가 `SUPERSEDE_PROPOSAL`의 '사람 승인 전 적용 금지' 의미를 상실하며 §17에 교정 항목이 없어 개정 Task로 전파될 위험. [Minor] §12의 `handoff recovery success`가 평가 기획안 §5.3 기존 지표 `resume success`(230행)와 사실상 같은 계산인데 다른 이름을 쓰고, §5.1~§5.4 기존 지표와의 동일/개명/신규 대응표 없이 §17이 §12 지표 반영만 지시해 지표 어휘가 이원화될 위험. [Improvement] §8.3 기억 캡슐 L0~L4와 온톨로지 §6.4 새 채팅 재개 9단계의 통합 계약 명시 권고. 세 건 모두 artifact 내 문구 수정으로 해소 가능하며 proposed_edits를 제공했다. 판정: CHANGES_REQUIRED.

## Findings

### ORBIT-AUDIT-ENUM-001 — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 패킷이 기존 세 문서가 단일 권위로 고정한 요청 판정 enum과 다른 어휘(REPLACE·QUESTION)를 제시해 온톨로지 §6.3의 단일 정의와 충돌한다. 특히 REPLACE는 SUPERSEDE_PROPOSAL의 '제안일 뿐 사람 승인 전 적용 금지' 의미를 잃어 사람 결정 불변식 약화 소지가 있고, §17 변경 설계에 이 교정 항목이 없어 팀구성·오케스트레이션 개정 Task에 잘못된 enum이 그대로 전파되면 같은 계약의 소유자가 둘이 되어 패킷 자신의 §17.2 실패 폐쇄 조건(같은 사실 이중 소유 시 개정 미시작)에 저촉된다.
- 근거: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md:141, docs/AI-지식-온톨로지-기획안.md:235, docs/팀구성_상세기획안.md:256, docs/AI-오케스트레이션-상세기획안.md:149
- 완료 조건: §4.2의 판정 어휘를 온톨로지 §6.3 단일 enum `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY`로 교체하고 enum 소유자가 온톨로지 §6.3임을 명시한다. / SUPERSEDE_PROPOSAL이 사람 승인 전 적용 금지 제안임을 같은 항목에서 보존한다. / §17의 오케스트레이션·팀구성 반영 행 또는 §17.2에 판정 enum을 새로 정의하지 않는다는 조건을 연결한다.
- 필요한 테스트: 스키마·검사기 구현 단계에서 request disposition enum 허용 값이 온톨로지 §6.3 단일 출처에서 생성되는지 검사

### ORBIT-AUDIT-METRIC-DUAL-002 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: handoff recovery success는 평가 기획안 §5.3의 기존 지표 resume success와 사실상 같은 계산(재설명 없이 next_safe_action 복원 비율)인데 다른 이름을 쓰고, duplicate work·handoff loss는 동일 이름이며 stale fact reuse·repeated discovery는 신규다. 대응표 없이 §17대로 개정하면 같은 측정 사실에 두 이름 또는 두 정의가 생겨 지표 권위가 이원화되고, 파일럿 판정과 자율성 승격 근거 지표가 서로 다른 정의를 참조할 수 있다. r001 ONTOLOGY-003과 같은 유형의 어휘 이원화 위험이 지표 영역에 남아 있다.
- 근거: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md:477, docs/AI-품질-학습-자율성-평가기획안.md:226, docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md:560
- 완료 조건: §12에 지표 이름의 단일 권위가 평가 기획안 §5임을 명시하고 각 지표를 §5.1~§5.4 기존 지표와 동일·개명·신규로 대응시킨다(예: handoff recovery success는 resume success의 개명 후보, duplicate work·handoff loss는 동일). / 신규 지표는 평가 기획안 개정으로만 추가하며 이 패킷 표는 지표 권위가 아님을 명시한다. / §17 평가 기획안 반영 행 또는 검증 연결에 기존 지표 registry 대조를 포함한다.
- 필요한 테스트: 평가 기획안 개정 시 지표 이름·계산 정의의 유일성(동일 계산에 복수 이름 금지) 대조 검사

### ORBIT-AUDIT-CAPSULE-003 — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: L0~L4(지식 조립)와 온톨로지 §6.4(상태 복원)는 목적이 겹치는 병렬 순서 계약이다. 개정 시 통합 관계를 명시하지 않으면 새 채팅이 따라야 할 순서 계약이 한 문서 안에서 두 벌이 될 수 있다. 같은 문서(온톨로지) 개정에서 자연히 조정 가능하므로 차단 사유는 아니다.
- 근거: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md:375, docs/AI-지식-온톨로지-기획안.md:260, docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md:557
- 완료 조건: §8.3 또는 §17 온톨로지 행에 L0~L4가 온톨로지 §6.4 재개 절차를 대체하지 않으며 개정 시 하나의 복원·조립 계약으로 통합됨을 한 문장으로 명시한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### EDIT-AUDIT-ENUM-001 — REPLACE

- 대상: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- 위치: - 사용자 요청을 기존 Task의 `ADD | REPLACE | NEW_TASK | QUESTION`으로 판정
- 연결 Finding: ORBIT-AUDIT-ENUM-001
- 이유: 패킷 §4.2의 REPLACE·QUESTION이 온톨로지 §6.3·팀구성·오케스트레이션이 고정한 단일 enum과 충돌하고 SUPERSEDE_PROPOSAL의 사람 승인 의미를 잃는 문제를 교정한다.

    - 사용자 요청을 온톨로지 §6.3의 단일 enum `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY`로 판정. `SUPERSEDE_PROPOSAL`은 제안일 뿐 사람 승인 전에는 적용하지 않으며, 이 패킷과 후속 개정은 판정 enum에 새 값이나 다른 이름을 정의하지 않는다

### EDIT-AUDIT-METRIC-002 — ADD

- 대상: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- 위치: 아래 임계는 파일럿용 후보이며 §16의 사람 결정으로 확정한다.
- 연결 Finding: ORBIT-AUDIT-METRIC-DUAL-002
- 이유: §12 지표 이름이 평가 기획안 §5.3 기존 지표와 대응 없이 도입되어 지표 어휘가 이원화되는 위험을 봉합한다.

    지표 이름·계산 정의의 단일 권위는 평가 기획안 §5다. `handoff recovery success`는 §5.3 `resume success`의 개명 후보이고 `duplicate work`·`handoff loss`는 §5.3 동일 지표이며, `repeated discovery`·`stale fact reuse`·`retrieval provenance failure`·`context relevance ratio`·`token per completed task unit` 등 신규 지표는 평가 기획안 개정으로만 추가한다. 개정 Task는 아래 표와 §5.1~§5.4 기존 지표의 동일·개명·신규 대응표를 포함하고, 이 표를 별도 지표 권위로 사용하지 않는다.

### EDIT-AUDIT-CAPSULE-003 — ADD

- 대상: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- 위치: 새 Task는 전체 과거를 읽지 않고 다음 순서로 필요한 기억을 조립한다.
- 연결 Finding: ORBIT-AUDIT-CAPSULE-003
- 이유: L0~L4와 온톨로지 §6.4 재개 절차가 병렬 순서 계약으로 남지 않도록 통합 관계를 명시한다.

    새 채팅 상태 복원 절차의 단일 권위는 온톨로지 §6.4다. 아래 L0~L4는 그 절차 안에서 읽을 지식의 조립 우선순위이며 §6.4의 lease·사용자 변경·증거 SHA 확인 단계를 대체하지 않는다. 온톨로지 개정 시 두 순서를 하나의 복원·조립 계약으로 통합한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: ORBIT-AUDIT-ENUM-001, ORBIT-AUDIT-METRIC-DUAL-002

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
