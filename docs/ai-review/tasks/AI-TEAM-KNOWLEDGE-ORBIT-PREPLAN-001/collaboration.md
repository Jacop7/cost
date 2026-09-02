# AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN-001 공동 작업 장부

> 새 공식 기획안을 만들기 전에 `Knowledge Orbit Graph` 방향성 결정 패킷을 기존 다섯 기획안과
> 대조한다. 이후 턴은 `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- input_files_sha256: `r001 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: 27138bb0a34b78da964d5974edf2a3c2ae14327cd2d3c9c5d13c7739978260ac, change_type: ADDED }]`
- changed_artifact_paths: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- 충족해야 할 요구사항·불변식: 방향성 패킷은 검토 증거이고 기존 다섯 기획안이 계속 공식 책임을 소유한다. 단일 권위, 다중 채팅 연속성, 사람 승인, 독립 Quality, 토큰 절감과 증거 보존을 동시에 만족해야 한다.
- 이번에 바꾼 내용: 구·궤도·위성 모델을 typed graph로 번역하고, 채팅 공간 2개·조정 채팅 11개, 역할 경계, 현재 Task 활성 메모리, 컨텍스트 압력 상태 기계, HANDOFF schema, 기억 캡슐 L0~L4, 상태 전파, 최소 문서 제어면, 단계별 파일럿과 측정 지표를 하나의 결정 패킷으로 구체화했다.
- 집중 검토 질문: 이 패킷이 기존 다섯 문서와 모순되거나 여섯 번째 경쟁 공식본이 되는가? 채팅과 문서가 과도한가? 전환 상태 기계·기억 검색·권한 경계가 안전한가? 최소 구현 순서와 사람 결정 항목이 충분한가?
- 실행한 테스트·현재 증거: `git diff --check` 통과. 기존 문서 그래프 시뮬레이션을 증거로 제공하되, 새 방향은 아직 공식 기획안·코드·채팅에 반영하지 않았다.
- 사람 결정이 필요한 항목: 채팅 이름·개수, 상황실 쓰기 권한, 컨텍스트 임계값, 자동 생성 허용 시점, HANDOFF 위치, `_shared` 생성 방식, 기억 검색 범위, 첫 파일럿을 Fable 결과 뒤 확정해야 한다.
- next_review_request: `FABLE_REVIEW`


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

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `b587c7b325651334522a5e859c7726332611cf66f6b6d5d2f58fd46d619d0684`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- changed_artifact_paths: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- resulting_input_files_sha256: `r002 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: 8d1139312bf2ede3e2e08abb657890c5bef98d5f47edbb214b3903f36330eb86, change_type: ADDED }]`

### ORBIT-PREPLAN-DOCPLANE-001

- disposition: `APPLIED`
- 적용 위치: §10 제안하는 최소 문서 제어면
- 적용 내용: 팀 구성안 §11의 기존 `docs/team/` 권위 구조를 원문대로 먼저 적고, `_shared` 신규 권위 파일군을 제거했다. current/task·decision·release는 기존 작업큐·DECISIONS·RELEASE_GATE에서 다시 만드는 생성 view 후보로 한정했으며 최종 구조 소유자를 팀 구성안 §11과 디렉터리 기획안 개정 Task로 고정했다.
- 실행한 테스트: 문서 네트워크 시뮬레이션 59/59, `git diff --check`
- 필요한 재검수: 중복 권위와 역할별 추적 문서 신설 위험이 제거됐는지 확인

### ORBIT-PREPLAN-HANDOFF-002

- disposition: `APPLIED`
- 적용 위치: §7.1 체크포인트 필수 필드
- 적용 내용: 복원 필드 단일 권위를 팀 구성안 §11로 선언하고 초안 필드의 1:1 정규화 표를 추가했다. HANDOFF YAML을 §11 권위 이름으로 바꾸고 risk·edit owner/session/lease·request dispositions·stop conditions·agents blob·사용자 변경·경로 역할 필드를 모두 보존했다.
- 실행한 테스트: 기존 오케스트레이션 §4.3 YAML 수동 대조, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: 경쟁 복원 계약과 필수 필드 유실이 해소됐는지 확인

### ORBIT-PREPLAN-ONTOLOGY-003

- disposition: `APPLIED`
- 적용 위치: §8.1 노드 대응, §8.2 관계 대응
- 적용 내용: 패킷 어휘를 온톨로지 §3·§4와 동일·분해·신규 후보로 매핑했다. 포괄 ARTIFACT, BLOCKS, DECIDED_BY, OWNED_BY, ANNOUNCED_IN은 새 권위로 만들지 않고 기존 어휘를 사용하도록 했다. HANDOFF·역할 컨텍스트·Release·TOUCHES·HANDOFF_TO는 온톨로지 개정 전까지 후보로만 남겼다.
- 실행한 테스트: 온톨로지 권위 표 수동 대조, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: typed provenance 어휘가 온톨로지 단일 출처로 수렴했는지 확인

### ORBIT-PREPLAN-QUALITY-004

- disposition: `APPLIED`
- 적용 위치: §3.2 부서 그룹, §4.1 팀
- 적용 내용: Quality 소유를 출시 게이트 증거와 판정 보고로 한정하고 Go/No-Go·운영 승인은 사람 소유로 명시했다. 상설 Quality 채팅은 조정 전용이며 실제 Codex·Fable 검증은 회차별 전용·클린 컨텍스트에서 수행하도록 분리했다.
- 실행한 테스트: 팀 구성안 §1.1 권한 대조
- 필요한 재검수: 사람 승인 권위와 독립 검수 컨텍스트가 보존되는지 확인

### ORBIT-PREPLAN-STATE-005

- disposition: `APPLIED`
- 적용 위치: §6.2 초기 전환 신호, §6.3 전환 권한
- 적용 내용: 상태명을 `HANDOFF_READY 진입`으로 통일하고 `CONTEXT_ROLLOVER_REQUIRED`는 상태가 아니라 전이를 요청하는 신호로 정의했다. 기존 lease 오류 코드 `HANDOFF_REQUIRED`와 이름·의미를 공유하지 않도록 했다.
- 실행한 테스트: 문서·시뮬레이션 식별자 검색, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: 상태·신호·기존 오류 코드 의미 충돌이 제거됐는지 확인

### ORBIT-PREPLAN-ROLE-006

- disposition: `APPLIED`
- 적용 위치: §4.1.1 기존 역할표와 팀 그룹 대응, §4.3 Context & Token Steward
- 적용 내용: 5개 팀 그룹을 팀 구성안 §1.1 기존 역할·엔진과 매핑하고 각 독립성을 적었다. 공식 이름을 `Server · Supabase · Operations`로 통일했다. Steward는 신설 후보로 명시하고 AI 부 O의 상태 복원·컨텍스트 조립 소유와 분리했으며 Quality/Fable 표본 감사 대상으로 뒀다.
- 실행한 테스트: 팀 구성안 §1.1·§3과 오케스트레이션 §2 수동 대조
- 필요한 재검수: 새 그룹이 기존 역할 승인 체계를 대체하지 않는지 확인

### ORBIT-PREPLAN-METRIC-007

- disposition: `APPLIED`
- 적용 위치: §12 측정과 학습, §13 단계별 도입 후보, §16 사람 결정 후보
- 적용 내용: 지표마다 수집 위치·계산 방법·초기 실패 후보를 추가했다. §13 검사기 범위에 컨텍스트 압력 상태와 HANDOFF 필수 필드를 추가하고, 임계값은 파일럿 전 사람 결정으로 확정하도록 §16에 연결했다.
- 실행한 테스트: 평가 기획안 §5.3·§5.4 대조, 문서 네트워크 시뮬레이션 59/59
- 필요한 재검수: 파일럿 성공·실패가 측정 가능한 계약인지 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- verified_input_files_sha256: `r002 manifest에서 실행기가 봉인·검증 예정`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: 8d1139312bf2ede3e2e08abb657890c5bef98d5f47edbb214b3903f36330eb86, change_type: ADDED }]`
- finding_ids: `ORBIT-PREPLAN-DOCPLANE-001`, `ORBIT-PREPLAN-HANDOFF-002`, `ORBIT-PREPLAN-ONTOLOGY-003`, `ORBIT-PREPLAN-QUALITY-004`, `ORBIT-PREPLAN-STATE-005`, `ORBIT-PREPLAN-ROLE-006`, `ORBIT-PREPLAN-METRIC-007`
- 실행 명령: `git diff --check -- docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md docs/ai-review/tasks/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN-001`; `corepack pnpm ai:plans:simulate`; 기존 권위 절과 항목별 수동 대조
- 종료 코드·결과: 전부 0; AI 문서 네트워크 시뮬레이션 59/59 통과; artifact SHA-256 `8d1139312bf2ede3e2e08abb657890c5bef98d5f47edbb214b3903f36330eb86`
- 증거 파일·로그 위치: `docs/ai-review/tasks/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN-001/rounds/r001/review.json`; `scripts/ai-plan-network-simulation.test.mjs`; 수정된 방향성 결정 패킷
- 미실행 항목과 이유: HANDOFF·지표·생성 view의 실제 구현 시험은 방향성 승인 뒤 기존 다섯 기획안 개정과 검사기 구현 Task가 소유한다. 이번 단계에서는 공식 기획안·제품 코드·실제 채팅을 변경하지 않았다.
- next_review_request: `FABLE_RECHECK`

## SOLAR_RESPONSE · turn-s003 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-c001`
- reply_to_review_sha256: `b587c7b325651334522a5e859c7726332611cf66f6b6d5d2f58fd46d619d0684`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- changed_artifact_paths: `docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: 0582fe8df58b2d3b156970033472fa176a90f054254b6f8a54312d53f6ccd423, change_type: ADDED }]`
- 적용 내용: 사람 승인 뒤 다섯 공식 기획안에 반영할 변경 설계를 §17로 추가했다. 팀 역할, 온톨로지 후보, 오케스트레이션 전환·HANDOFF, 디렉터리 생성 view, 품질 지표가 각각 어느 공식 문서에 들어가는지와 공통 상호작용 계약·실패 폐쇄·실제 작업 순서를 고정했다. 이 절은 새 공식 정책이 아니라 개정 Task의 배분 설계이며 실제 정책 변경은 각 기획안 개정과 사람 승인 뒤에만 성립한다.
- 실행한 테스트: `git diff --check`; `corepack pnpm ai:plans:simulate` 59/59
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s003`
- target_commit_sha: `933262b1f193d1b4cacbb7c2fb08564592cdf419`
- artifact_hashes: `[{ path: docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md, sha256: 0582fe8df58b2d3b156970033472fa176a90f054254b6f8a54312d53f6ccd423, change_type: ADDED }]`
- finding_ids: `ORBIT-PREPLAN-DOCPLANE-001`, `ORBIT-PREPLAN-HANDOFF-002`, `ORBIT-PREPLAN-ONTOLOGY-003`, `ORBIT-PREPLAN-QUALITY-004`, `ORBIT-PREPLAN-STATE-005`, `ORBIT-PREPLAN-ROLE-006`, `ORBIT-PREPLAN-METRIC-007`
- 실행 명령: `git diff --check -- docs/ai-review/evidence/AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN.md`; `corepack pnpm ai:plans:simulate`
- 종료 코드·결과: 전부 0; 문서 네트워크·권위·Task·Finding·Learning·handoff 시뮬레이션 59/59 통과
- 검증 내용: §17의 문서별 소유 배분이 기존 다섯 공식 기획안을 대체하지 않으며, 같은 사실의 이중 소유·새 `_shared` 권위·Quality의 사람 승인 대체·Steward 과권한을 실패 폐쇄 조건으로 둔 것을 확인했다.
- 미실행 항목과 이유: 다섯 공식 기획안 개정과 실제 채팅·디렉터리·HANDOFF 구현은 Fable 재검수와 사람 방향 확정 뒤의 별도 Task다.
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN-001`
- predecessor_round: `r001`
- predecessor_task_sha256: `8cc35d0132dd81414570e776ce4a8d7e6b6a17fad2c635f7a62ce72587240e50`
- predecessor_manifest_sha256: `f7848a9612b9a0d9d80e4ec0edc26b0b685001925ce1b2e1f38650ca7dddd4b2`
- predecessor_review_sha256: `b587c7b325651334522a5e859c7726332611cf66f6b6d5d2f58fd46d619d0684`
- predecessor_run_sha256: `d1d0acc8a4916146890f39255729b5240b8a21e7b1475f4a66d86f58f6d9cf60`
- finding_registry_sha256: `3cf4d0c1d1d12980dfc01fec1a12c59457e79f55a0921f25891a9fb7f514943e`
- successor_task_id: `AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN-002`
- successor_target_commit_sha: `21a368b0da12acbb1c1534f8df8a2163a54ee98a`
- next_review_request: `FABLE_RECHECK`

## BACKLOG_DISPOSITION · turn-o002 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- item: `AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN-002 successor handoff`
- disposition: `REJECTED`
- reason: predecessor가 `WORKING_TREE_HASHED` snapshot이라 COMMIT successor의 동일 snapshot 검수 경로 조건을 만족하지 못했다. Fable 호출 전에 exit 75로 실패 폐쇄됐고 모델 실행·비용·review 산출물은 없었다.
- preservation: 이미 append된 turn-o001과 handoff-only source commit은 실패 시도 감사 이력으로 보존한다. successor Task 파일은 실행 이력 생성 전이므로 공식 Task로 물질화하지 않는다.
- next_review_request: `FABLE_RECHECK_SAME_TASK_R002`

## BACKLOG_DISPOSITION · turn-o003 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- item: `AI-TEAM-KNOWLEDGE-ORBIT-PREPLAN-001 r002 recheck`
- disposition: `REJECTED`
- reason: predecessor는 `WORKING_TREE_HASHED`이며 현재 HEAD가 불변 target commit과 달라 같은 Task r002도 모델 호출 전에 exit 75로 실패 폐쇄됐다. 비용·review 산출물은 없다.
- preservation: r001 Finding과 모든 응답·증거·실패한 successor handoff 기록은 그대로 보존한다. 수정 commit은 별도 독립 COMMIT 감사가 전체 패킷과 r001 지적 해소 여부를 새로 판정한다.
- next_review_request: `FABLE_INITIAL_INDEPENDENT_AUDIT`
