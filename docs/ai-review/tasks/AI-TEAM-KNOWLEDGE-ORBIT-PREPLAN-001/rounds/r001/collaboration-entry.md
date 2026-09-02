
<!-- fable-review:r001 sha256=b587c7b325651334522a5e859c7726332611cf66f6b6d5d2f58fd46d619d0684 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `b587c7b325651334522a5e859c7726332611cf66f6b6d5d2f58fd46d619d0684`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- input_files_sha256: `64eb546a971f3e4fe000d3c135851456d2683a427dd51b5119cac6107ae830fc`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: ORBIT-PREPLAN-DOCPLANE-001, ORBIT-PREPLAN-HANDOFF-002, ORBIT-PREPLAN-ONTOLOGY-003, ORBIT-PREPLAN-QUALITY-004, ORBIT-PREPLAN-STATE-005, ORBIT-PREPLAN-ROLE-006, ORBIT-PREPLAN-METRIC-007
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

Knowledge Orbit Graph 방향성 패킷의 전체 구조는 건전하다. 채팅은 권위가 아니라는 전제(25행), 마스터·부서·Task 채팅의 쓰기 책임·금지 구분(§3.3), Steward의 허용·금지선과 사람 승인 경계(§4.3·§6.3), HANDOFF 사후조건의 증거 보존과 채팅 원문 비승격(§7.2), 기억 캡슐 L0~L4의 exact-match 우선·출처·SHA 표시(§8.3), 개발·스테이징과 운영 승인 분리(§11), 검사기·파일럿 우선 도입 순서(§13), 사람 결정 후보(§16)는 요구사항 2~6·8~10과 불변식을 충족한다. 그러나 기존 다섯 기획안의 이미 확정된 권위와의 항목별 대조가 4곳에서 빠져 있어, 패킷이 선언한 "여섯 번째 공식본이 아니다"라는 전제를 스스로 위협한다. (1) §10 문서 제어면이 팀구성 §11이 이미 소유한 docs/team/ 구조(DECISIONS.md·RELEASE_GATE.md·ROLE_CONTEXTS.md·roles/)와 "역할별 추적 문서 신설 금지" 규칙을 언급하지 않은 채 _shared 5개 파일을 제안해 task-index·decision-index·release-state가 작업큐·DECISIONS·RELEASE_GATE의 중복 장부가 될 위험. (2) §7.1 HANDOFF 스키마가 새 채팅 복원 필드의 단일 권위인 팀구성 §11 및 오케스트레이션 §4.3 재개 패킷과 필드 대응 없이 다른 이름(goal↔objective, head_sha↔last_verified_sha)을 쓰고 risk_level·edit_owner/lease·request_dispositions·stop_conditions·agents_md_blob_sha를 누락. (3) §8.1~8.2 노드·관계 어휘가 온톨로지 §3·§4와 불일치하면서 신규·개명·기존 매핑 표가 없어 typed-provenance 어휘가 이원화될 위험. (4) §4.1이 Quality·Review 팀 소유에 "출시 판정"을 포함해 팀구성 §1.1의 사람 Go/No-Go·릴리스 소유와 충돌하고, 단일 04 Quality·Review 조정 채팅과 클린 독립 컨텍스트의 분리 방식이 미명시. 추가로 Minor 3건: 상태 기계 명칭 불일치(HANDOFF_READY vs HANDOFF_REQUIRED — 후자는 기존 lease 계약의 오류 코드로 이미 사용 중이라 의미 충돌), Steward 신설 역할·5팀 그룹의 팀구성 §1.1 역할표 매핑 부재와 Platform/Server·Supabase·Operations 명칭 혼용, §12 지표의 수집 위치·계산 방법·실패 임계 부재. 7건 모두 artifact 내 문구 수정으로 해소 가능하며 proposed_edits로 구체안을 제공했다. 판정: CHANGES_REQUIRED.

### 공동 편집 제안 색인

- EDIT-DOCPLANE-001: ADD `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · - `_shared`는 기존 `docs/작업큐.md`, Architecture, 배포 기획안을 대체하지 않는다. · 원문은 review.md 참조
- EDIT-HANDOFF-002: ADD `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · ### 7.1 체크포인트 필수 필드 · 원문은 review.md 참조
- EDIT-ONTOLOGY-003: REPLACE `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · 관계의 단일 의미는 온톨로지 기획안이 소유한다. 다른 문서는 관계를 사용만 한다. · 원문은 review.md 참조
- EDIT-QUALITY-004: REPLACE `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · | Quality · Review | 독립 시험·경합·회귀·보안·Fable·출시 판정 | · 원문은 review.md 참조
- EDIT-QUALITY-CONTEXT-005: ADD `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · 6. `05 Knowledge · Orchestration` · 원문은 review.md 참조
- EDIT-STATE-006: REPLACE `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · | HANDOFF_REQUIRED | 추정 85% 이상 | 자동 compaction·명백한 맥락 손실·새 대형 범위 등장 | · 원문은 review.md 참조
- EDIT-ROLE-007: ADD `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · ### 4.3 Context & Token Steward · 원문은 review.md 참조
- EDIT-METRIC-008: ADD `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · | retrieval provenance failure | 출처·상태 없는 기억 사용 | · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
