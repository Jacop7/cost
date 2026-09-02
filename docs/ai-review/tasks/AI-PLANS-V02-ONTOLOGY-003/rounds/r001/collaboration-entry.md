
<!-- fable-review:r001 sha256=1eba971346a5b2316de37c690a4a6f7b17b17f148e4d347cc77e6b1ed9e15753 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `1eba971346a5b2316de37c690a4a6f7b17b17f148e4d347cc77e6b1ed9e15753`
- target_commit_sha: `6cc6c654036cce8b5cb360a33db5ab0df81d6e12`
- input_files_sha256: `1608387247ed8557943e2608a13c6cad69f6a925dff6830045a261279866e078`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: ONT-003-HANDOFF-VERSION-GAP, ONT-003-LEASE-TAKEOVER-GAP, ONT-003-HANDOFF-MUTABLE-STORE
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

온톨로지 v0.2 원문을 AGENTS.md·축소 증거와 대조한 INITIAL 검수 결과, 요구된 반례 상한(최대 3건) 안에서 Major 3건을 보고한다. (1) §6.4-3·§11-14·§13은 HANDOFF의 "동일·낮은 판본" 복원을 거부하라고 요구하지만 §3 HANDOFF 최소 필드 목록에는 비교 대상인 단조 판본 필드가 없다. 생성 시각은 세션 간 시계 오차로 순서를 보증하지 못하고 직전 HANDOFF ID 체인은 같은 predecessor에서 분기한 두 HANDOFF를 판정하지 못해 AI-ONTOLOGY:handoff-monotonic을 기계적으로 집행할 수 없다. 축소 증거 fixture(53~54행 "동일·낮은 HANDOFF 판본 거부", 37행 "더 높은 HANDOFF 판본")가 전제하는 판본 개념이 문서 계약에 부재한다. (2) §6.4 복원 검사 2는 다른 소유자의 lease가 "유효"할 때만 중단을 요구하고, lease 만료·부재 시 successor의 edit_owner 인수 조건이 없다. §6.3의 팀 구성안 §11 위임은 "새 Task 최초 edit_owner 지정"만 다루므로, 축소 증거 56행이 단언하는 "유효 HANDOFF 복원+사람 인계 Decision 소비 뒤에만 lease 획득" 계약이 온톨로지 원문에 없어 신호·시간 경과만으로 권한을 얻는 lease 탈취 경로가 문서상 열려 있다. (3) HANDOFF 권위 위치가 가변 현재 상태 장부인 docs/작업큐.md의 Task snapshot이고 §14가 물리 저장 형식·보존 기간을 미결로 남겨, 일반 Task HANDOFF에 append-only 보존 계약이 없다. 이 경우 §6.4-3의 "더 최신 HANDOFF 존재" 거부가 변조 가능한 기록 위에서 수행되어 stale 복원 방어와 AI-ONTOLOGY:append-only-authority가 약화된다. 그 외 축(단일 권위 위임 §5, 판정 enum 단일 정의 §6.3, request_dispositions hash 체인, Finding 동일 ID 승계, Learning 충돌 배제 §7·§9, SUPERSEDES의 ACTIVE Decision 근거 §11-11, AGENTS 권위 목록 비추가 §14)은 AGENTS:single-canonical-artifact·AGENTS:fable-required-review와 모순이 없음을 확인했다. 세 건 모두에 대해 §3 handoff_version 정수 추가, §6.4 검사 2의 만료 lease 인수 조건 명시, HANDOFF 기록 append-only 보존 문장 추가를 proposed_edits로 제안한다. 판정: CHANGES_REQUIRED.

### 공동 편집 제안 색인

- EDIT-ONT-HANDOFF-VERSION: REPLACE `docs/AI-지식-온톨로지-기획안.md` · `handoff_id`, `task_id`, 비식별 predecessor/successor reference, 생성 시각, source commit SHA, · 원문은 review.md 참조
- EDIT-ONT-HANDOFF-IMMUTABLE: ADD `docs/AI-지식-온톨로지-기획안.md` · 확정하지 않으며, successor는 아래 §6.4 순서로 원 권위를 다시 확인한다. · 원문은 review.md 참조
- EDIT-ONT-LEASE-TAKEOVER: REPLACE `docs/AI-지식-온톨로지-기획안.md` ·    유효하면 상태·인계 요청만 남기고 `stop_conditions`를 발동한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
