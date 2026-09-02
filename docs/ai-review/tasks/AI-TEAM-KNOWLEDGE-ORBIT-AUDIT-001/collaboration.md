# AI-TEAM-KNOWLEDGE-ORBIT-AUDIT-001 공동 작업 장부

> 수정 commit의 Knowledge Orbit Graph 결정 패킷을 전체 문서 기준으로 새로 감사한다. 이전 r001
> Finding은 대조 증거이며 formal 승계·CLOSED로 위장하지 않는다. 이후 턴은 공식 실행기만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `21a368b0da12acbb1c1534f8df8a2163a54ee98a`
- changed_artifact_paths: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- 충족해야 할 요구사항·불변식: 기존 다섯 기획안 단일 권위, canonical HANDOFF, typed provenance, Steward 제한 권한, 독립 Quality, 사람 운영 승인, 측정 가능한 파일럿
- 이번에 바꾼 내용: 이전 7개 지적을 반영하고 §17에 다섯 공식 기획안별 변경 설계·상호작용·실패 폐쇄·실제 작업 순서를 추가했다.
- 집중 검토 질문: 수정 패킷이 방향성 승인에 충분한가? 이전 지적과 별개로 새 필수 모순·중복 권위·권한 우회·측정 공백이 있는가?
- 실행한 테스트·현재 증거: `git diff --check`, `corepack pnpm ai:plans:simulate` 59/59 통과
- 사람 결정이 필요한 항목: PASS 뒤 §16의 채팅 수·쓰기 권한·임계값·HANDOFF 위치·첫 파일럿을 확정한다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=d122899ccc1f931d115aa8554fdfbac3d48bcd605c7e411dccf91900ad6f6ac1 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `d122899ccc1f931d115aa8554fdfbac3d48bcd605c7e411dccf91900ad6f6ac1`
- target_commit_sha: `21a368b0da12acbb1c1534f8df8a2163a54ee98a`
- input_files_sha256: `c6c245c8027b7ecfe93112ba03be420e031b337116c48d772a2043938ea1957d`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: ORBIT-AUDIT-ENUM-001, ORBIT-AUDIT-METRIC-DUAL-002
- 선택 미종결 Finding: ORBIT-AUDIT-CAPSULE-003
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

수정 commit 21a368b0의 Knowledge Orbit Graph 결정 패킷을 여섯 요구사항 기준으로 전체 독립 감사했다. (1) 여섯 번째 공식본 여부: 패킷은 1~7행에서 스스로를 선행 결정 패킷으로 한정하고 docs/ai-review/evidence/에 위치하며(온톨로지 §3의 ADVISORY_REVIEW 위치), §17이 모든 정책 변경을 다섯 기획안 개정 Task와 사람 승인 뒤로 미룬다 — 경쟁 공식본 아님. (2) 권위 경계: §10은 팀구성 §11의 docs/team/ 구조(1709~1722행)를 원문 인용하고 _shared 권위군을 제거했으며 view는 생성 후보·손작성 금지로 한정. §7.1 HANDOFF는 팀구성 §11(1664~1670행)을 단일 권위로 선언하고 §11 전 필드(risk_level·risk_basis, edit_owner/owner_session_ref/lease_expires_at, request_dispositions, stop_conditions, agents_md_blob_sha 포함)를 보존. §8.1~8.2는 온톨로지 §3·§4 어휘와의 동일/분해/신규 후보 대응표를 갖추고 신규 어휘는 온톨로지 개정으로만 추가. (3) Quality 분리: §4.1이 Quality 소유를 '출시 게이트 증거·판정 보고'로 한정하고 Go/No-Go·운영 승인을 사람 소유로 명시(팀구성 §1.1 85~86행과 일치), §3.2가 상설 04 조정 채팅과 회차별 클린 검수 컨텍스트를 분리. (4) 명칭·권한: §6.1~6.3이 HANDOFF_READY 상태명을 통일하고 CONTEXT_ROLLOVER_REQUIRED를 전이 요청 신호로 정의하며 기존 lease 오류 코드 HANDOFF_REQUIRED(시뮬레이션 427·877행)와의 비공유를 명시. §4.1.1이 5팀 그룹↔팀구성 §1.1 역할 대응표를 제공하고 Server · Supabase · Operations로 명칭 통일, Steward는 신설 후보·관측 전용·Quality/Fable 표본 감사 대상으로 한정. (5) 지표·개정 순서: §12 표가 수집 위치·계산·초기 실패 후보 3열을 갖추고 §17.1~17.3이 상호작용 계약·실패 폐쇄·실제 개정 순서를 제공. (6) 이전 r001 7개 지적(DOCPLANE-001~METRIC-007)은 위 근거로 현재 commit에서 모두 실질 해소됐음을 대조 확인했다. formal 승계·CLOSED는 주장하지 않는다. 그러나 신규 필수 Finding 2건을 발견했다. [Major] 패킷 §4.2(141행)의 요청 판정 enum `ADD | REPLACE | NEW_TASK | QUESTION`이 온톨로지 §6.3(237~248행)이 "단일 정의"로 고정한 `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY` 및 팀구성 256~257행·오케스트레이션 §4.2와 충돌하고, `REPLACE`가 `SUPERSEDE_PROPOSAL`의 '사람 승인 전 적용 금지' 의미를 상실하며 §17에 교정 항목이 없어 개정 Task로 전파될 위험. [Minor] §12의 `handoff recovery success`가 평가 기획안 §5.3 기존 지표 `resume success`(230행)와 사실상 같은 계산인데 다른 이름을 쓰고, §5.1~§5.4 기존 지표와의 동일/개명/신규 대응표 없이 §17이 §12 지표 반영만 지시해 지표 어휘가 이원화될 위험. [Improvement] §8.3 기억 캡슐 L0~L4와 온톨로지 §6.4 새 채팅 재개 9단계의 통합 계약 명시 권고. 세 건 모두 artifact 내 문구 수정으로 해소 가능하며 proposed_edits를 제공했다. 판정: CHANGES_REQUIRED.

### 공동 편집 제안 색인

- EDIT-AUDIT-ENUM-001: REPLACE `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · - 사용자 요청을 기존 Task의 `ADD | REPLACE | NEW_TASK | QUESTION`으로 판정 · 원문은 review.md 참조
- EDIT-AUDIT-METRIC-002: ADD `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · 아래 임계는 파일럿용 후보이며 §16의 사람 결정으로 확정한다. · 원문은 review.md 참조
- EDIT-AUDIT-CAPSULE-003: ADD `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md` · 새 Task는 전체 과거를 읽지 않고 다음 순서로 필요한 기억을 조립한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `d122899ccc1f931d115aa8554fdfbac3d48bcd605c7e411dccf91900ad6f6ac1`
- target_commit_sha: `21a368b0da12acbb1c1534f8df8a2163a54ee98a`
- changed_artifact_paths: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: d783fab9891a3df182a820ec74fc64819473c788aba4255891847d4bf339bebd, change_type: MODIFIED }]`

### ORBIT-AUDIT-ENUM-001

- disposition: `APPLIED`
- 적용 위치: §4.2, §17 오케스트레이션 반영 행
- 적용 내용: 요청 판정을 온톨로지 §6.3 단일 enum `ADD | SUPERSEDE_PROPOSAL | NEW_TASK | STATUS_ONLY`로 교체했다. `SUPERSEDE_PROPOSAL`은 사람 승인 전 적용 금지인 제안임을 보존하고 패킷·후속 개정의 재정의를 금지했다.

### ORBIT-AUDIT-METRIC-DUAL-002

- disposition: `APPLIED`
- 적용 위치: §12, §17 평가 기획안 반영 행
- 적용 내용: 지표 단일 권위를 평가 기획안 §5로 선언하고 기존 지표와 동일·개명·신규 대응을 명시했다. 신규 지표는 평가 기획안 개정으로만 추가하며 이름·계산 정의 유일성 검사를 연결했다.

### ORBIT-AUDIT-CAPSULE-003

- disposition: `APPLIED`
- 적용 위치: §8.3 기억 캡슐
- 적용 내용: 새 채팅 복원 절차의 단일 권위를 온톨로지 §6.4로 고정하고 L0~L4를 그 절차가 읽는 지식 조립 우선순위로 한정했다. lease·사용자 변경·증거 SHA 확인을 대체하지 않으며 개정 시 하나의 복원·조립 계약으로 합친다.

- 실행한 테스트: `git diff --check`; `corepack pnpm ai:plans:simulate` 59/59
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `21a368b0da12acbb1c1534f8df8a2163a54ee98a`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: d783fab9891a3df182a820ec74fc64819473c788aba4255891847d4bf339bebd, change_type: MODIFIED }]`
- finding_ids: `ORBIT-AUDIT-ENUM-001`, `ORBIT-AUDIT-METRIC-DUAL-002`, `ORBIT-AUDIT-CAPSULE-003`
- 실행 명령: `git diff --check -- docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md docs/ai-review/tasks/AI-TEAM-KNOWLEDGE-ORBIT-AUDIT-001`; `corepack pnpm ai:plans:simulate`
- 종료 코드·결과: 전부 0; 문서 네트워크 시뮬레이션 59/59 통과
- 검증 내용: 요청 판정 enum의 온톨로지 단일 소유, 평가 지표 registry 대조, L0~L4와 §6.4 복원 절차의 포함 관계가 문구와 §17 검증 연결에 함께 반영됐다.
- 미실행 항목과 이유: 실제 schema·지표 registry·HANDOFF 구현 시험은 방향 확정 뒤 다섯 기획안 개정과 검사기 Task가 소유한다.
- next_review_request: `FABLE_RECHECK`
