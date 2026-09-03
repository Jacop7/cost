# AI-ORCH-PLANS-STAGE-7-ONTOLOGY-FABLE-019 공동 작업 장부

> 단계 7의 온톨로지 공식 문서 현재 bytes를 노드·관계·권위·HANDOFF 축으로 감사한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`
- changed_artifact_paths: 온톨로지 공식 기획안
- 검토 범위: 지식 노드·관계 방향·권위 DAG·요청/Task/Decision/Finding/HANDOFF·rollover 권한 경계
- 집중 검토 질문: 단계 8 사람 승인 패킷으로 넘어가기 전에 온톨로지 문서에 남은 필수 구조 결함이 있는가?
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-FABLE-STAGE-7-ONTOLOGY-BUDGET-018`
- soft_budget_overrun_risk_accepted: `r001@4.00`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 온톨로지 단일 문서 감사의 soft cap을 USD 4.00으로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 4.00을 넘을 수 있다.
- 허용 범위: 온톨로지 공식 문서와 두 검증 증거의 읽기 전용 구조 감사 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=c46e0306817a1343e8da7b13d07ef2393d867a1bd10035a505189bdab91fbd5c -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `c46e0306817a1343e8da7b13d07ef2393d867a1bd10035a505189bdab91fbd5c`
- target_commit_sha: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`
- input_files_sha256: `07389047f2eae332711ff76c0de4fad21adc239b9dc83c50bb21c587fcfde633`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: FAB-ARCH-019-HANDOFF-LOCATION-001
- 선택 미종결 Finding: FAB-ARCH-019-AUTHORITY-VOCAB-002, FAB-ARCH-019-LIFECYCLE-DIAGRAM-003
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

단계 7 온톨로지 문서(sha256 d6b82bef…, 551줄)를 노드·관계·권위·HANDOFF 축으로 감사했다. (1) 권위 계층: §5(169–173행)가 우선순위 재정의 없이 팀 구성안 §0에 위임하고, §11 항목 12(482–483행)가 verify 6단계 분모와 보호 원격 게이트 계약을 보존하며, ADVISORY_REVIEW(92행)가 공식 Fable 게이트 종결 불가로 명시돼 AGENTS 계약과 모순이 없다. (2) NORMALIZES(정규화→원시 입력)·ROUTES_TO(정규화→Task)·HANDOFF_TO의 방향과 REQUEST_INPUT·NORMALIZED_REQUEST·TASK·DECISION·FINDING의 단일 소유 위치는 명확하다. 다만 HANDOFF는 §3 표(96행)가 docs/작업큐.md의 Task snapshot을 권위 위치로 적는 반면, 본문(118–122행)은 물질화 뒤 봉인 원본의 단일 위치를 docs/team/handoffs/<TASK-ID>/*.md로 규정하고 작업큐를 pointer 전용 가변 장부로 정의해 이중 서술이며, 물질화 전 append-only 봉인 원본의 보존 위치가 미지정이라 §11 항목 14·15의 content hash·계보 검사 대상이 결정되지 않는다(Minor FAB-ARCH-019-HANDOFF-LOCATION-001, OPEN). (3) 162–165행이 탐색 참조의 순환 허용과 OWNS·DEPENDS_ON 권위 DAG 비순환을 서로 다른 단언으로 분리해 혼동이 없다. (4) 112–116행이 같은 predecessor 분기의 발행 거부와 사람 Decision 계보 선택 뒤 상위 판본 재발행을, §6.4 복원 검사 2·3단계(319–326행)가 rollover 신호·경과 시간만의 소유권 획득 거부와 동일·낮은 handoff_version 실행 거부(Task별 정수 비교, 생성 시각 배제)를 명시한다. (5) front matter DRAFT(4행), 권위 미위임 선언(23–24행), ACTIVE 이후에만 물질화(124–126행), 승인 전 AGENTS 권위 목록 등재 금지(550–551행)로 사람 단계 8 승인 전 DRAFT·물질화 금지 경계가 보존된다. 비차단 개선 2건: authority 허용 값 목록 미정의와 자체 front matter(5행)·§8.2 예시(391행)의 형식 불일치, §10 수명주기 다이어그램(449–453행)의 CONFIRMED 진입 경로 부재와 '승인 전 DRAFT' 문구(455행)·REVIEWED 상태(392행)의 긴장. Minor 1건이 미해결이므로 verdict는 CHANGES_REQUIRED이며 표 정정·물질화 전 보존 위치 규정·§14 등재의 proposed_edits를 제공했다. 이 판정은 로컬 검수이며 외부 게이트 종결이 아니다.

### 공동 편집 제안 색인

- EDIT-019-001: REPLACE `docs/AI-지식-온톨로지-기획안.md` · | `HANDOFF` | `docs/작업큐.md`의 Task snapshot 또는 검수 `collaboration.md`의 전용 인계 턴 | 새 채팅·역할·검수 successor가 같은 Task를 복원하도록 기존 권위 상태를 봉인한 비권위 snapshot | · 원문은 review.md 참조
- EDIT-019-002: ADD `docs/AI-지식-온톨로지-기획안.md` · `collaboration.md`의 전용 append 명령을 사용한다. · 원문은 review.md 참조
- EDIT-019-003: ADD `docs/AI-지식-온톨로지-기획안.md` · - `docs-graph-check`가 관리할 문서 ID 형식과 §3·§4 어휘를 코드로 생성하는 형식 · 원문은 review.md 참조
- EDIT-019-004: REPLACE `docs/AI-지식-온톨로지-기획안.md` · - 기획안은 사람 승인 전 `DRAFT`다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `c46e0306817a1343e8da7b13d07ef2393d867a1bd10035a505189bdab91fbd5c`
- target_commit_sha: `4e1d23cf31b34483f5f66ee3d7dfeaea5d315019`
- changed_artifact_paths: `docs/AI-지식-온톨로지-기획안.md`
- resulting_input_files_sha256: `PENDING_NEXT_REVIEW_MANIFEST`
- artifact_hashes: `[{"path":"docs/AI-지식-온톨로지-기획안.md","sha256":"ffe8be3a3cd65aeb7ab6cb3d66055165905b676f0381a2e736d2e196cef4e799","change_type":"MODIFIED"}]`

### FAB-ARCH-019-HANDOFF-LOCATION-001

- disposition: `APPLIED`
- 적용 위치: §3 HANDOFF 표·본문, §14
- 적용 내용: 물질화 뒤 일반 Task HANDOFF 봉인 원본의 단일 위치와 작업큐 pointer-only 역할을 표·본문에서 일치시켰다. 물질화 전 임시 위치는 §14 미결 결정으로 등록하고, 결정 전 일반 HANDOFF 파일 발행과 작업큐의 원본 사용을 금지했다. 검수 successor collaboration 계약은 유지했다.

### FAB-ARCH-019-AUTHORITY-VOCAB-002

- disposition: `APPLIED`
- 적용 위치: §8.2
- 적용 내용: authority를 lower_snake_case 단일 주제 키로 정의하고 현재 다섯 허용 값, 새 값 추가의 사람 Decision·중앙 권위 표 동시 변경 조건을 명시했다. 예시는 같은 형식으로 교정했다.

### FAB-ARCH-019-LIFECYCLE-DIAGRAM-003

- disposition: `APPLIED`
- 적용 위치: §10
- 적용 내용: REVIEWED에서 사람 확정으로만 CONFIRMED에 진입하는 경로와 승인 전 REVIEWED 가능성을 다이어그램·문장에 명시했다.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `FAB-ARCH-019-HANDOFF-LOCATION-001`, `FAB-ARCH-019-AUTHORITY-VOCAB-002`, `FAB-ARCH-019-LIFECYCLE-DIAGRAM-003`
- verified_artifact_hash: `docs/AI-지식-온톨로지-기획안.md=ffe8be3a3cd65aeb7ab6cb3d66055165905b676f0381a2e736d2e196cef4e799`
- command: `node --test --test-name-pattern="온톨로지 node|새 채팅 복원|문서 관계 방향" scripts/ai-plan-network-simulation.test.mjs`
- result: `3/3 PASS`
- checker_sha256: `4798fb1c82f7794ab6b82a30c3c42ae48d20d9a49b82758ea59afad0ab71c7cb`
- full_suite_note: 전체 71개 시뮬레이션의 작업큐·모델계획 manifest 동기화는 구조 재검수 뒤 별도 수행한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-c001`
- finding_ids: `FAB-ARCH-019-HANDOFF-LOCATION-001`, `FAB-ARCH-019-AUTHORITY-VOCAB-002`, `FAB-ARCH-019-LIFECYCLE-DIAGRAM-003`
- decision_id: `DEC-AI-FABLE-STAGE-7-ONTOLOGY-RECHECK-BUDGET-020`
- soft_budget_overrun_risk_accepted: `r002@1.25`
- 결정: 사용자의 상시 예산 재량 위임에 따라 AI 부 오케스트레이터가 같은 Task의 남은 상한 안에서 도구 기반 축소 재검수 soft cap을 USD 1.25로 선택한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 1.25를 넘을 수 있다.
- 허용 범위: 세 Finding과 변경된 온톨로지 현재 bytes의 읽기 전용 재검수 1회.
- 금지: 동일 회차 중복 호출과 동시 Opus 호출.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
