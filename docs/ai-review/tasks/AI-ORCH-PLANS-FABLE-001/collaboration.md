# AI-ORCH-PLANS-FABLE-001 공동 작업 장부

> 다섯 핵심 기획안의 현재 커밋을 공식 Fable 경로로 독립 재검수한다.
> 이전 Opus 직접 자문은 참고 증거이며 이 장부의 Fable 판정을 대체하지 않는다.
> Fable 턴은 공식 검수 실행기만 추가하고, 그 밖의 턴은
> `corepack pnpm fable:append -- --task AI-ORCH-PLANS-FABLE-001`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `5f6929095424b9fe53a2005ef5c4136ca2175f50`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`
- 충족해야 할 요구사항·불변식: 단일 공식 산출물, 저장소 권위, 다중 채팅 요청 유실 방지, 잠금 순서, append-only 증거, 실패 폐쇄, 검증 가능한 학습 전이
- 이번에 바꾼 내용: Stage 1~4 Opus 교차검수와 r3 후속 Finding을 같은 다섯 공식 기획안에 반영하고 증거를 고정했다.
- 집중 검토 질문: 기존 Finding 10건이 모두 해소됐고 다섯 기획안 사이에 잔여 Critical·Major·명세상 필수 모순이 없는가?
- 실행한 테스트·현재 증거: 대상 커밋 전 단계에서 `pnpm verify --no-db` 4/6 통과, 이전 exact SHA `006000b` protected gate 통과, r2·r3 증거와 승인 장부 포함
- 사람 결정이 필요한 항목: 없음
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `AI-ORCH-PLANS-FABLE-R2-20260902`
- 결정: 앞으로 외부 교차검수는 Opus가 아니라 공식 Fable 경로를 사용하며, 실패한 r001 원본을 보존한 채 r002를 실행한다.
- 허용 범위·기한: `AI-ORCH-PLANS-FABLE-001` 읽기 전용 r002 검수 1회, `max_budget_usd=4.00`, 2026-09-02 현재 작업 완료까지.
- 근거: 사용자가 “지금부터 페이블 사용하면돼”라고 명시했다.
- 승인자·시각: `USER · 2026-09-02 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-h001`
- finding_ids: `[]`
- decision_id: `AI-ORCH-PLANS-FABLE-R3-20260902`
- 결정: 동일한 고정 커밋의 공식 Fable 구조 감사를 계속 진행한다.
- 허용 범위·기한: `AI-ORCH-PLANS-FABLE-001` 읽기 전용 r003 검수 1회, `max_budget_usd=6.00`, 2026-09-02 현재 작업 완료까지.
- 근거: 사용자가 “페이블 진행해줘”라고 명시했다.
- 승인자·시각: `USER · 2026-09-02 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r003 sha256=b9717ada84e0acb95e3c731a5bf73c36425685541b9382bd7287fd87aa116337 -->
## FABLE_REVIEW · turn-f003 · r003

- role: `FABLE-ARCH`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `b9717ada84e0acb95e3c731a5bf73c36425685541b9382bd7287fd87aa116337`
- target_commit_sha: `5f6929095424b9fe53a2005ef5c4136ca2175f50`
- input_files_sha256: `9b8b01a6fb96e88a81d90ce6695c4105311bac469a2052b894fd12cbedba64c1`
- 원본 검수: [r003/review.md](./rounds/r003/review.md)
- 필수 미종결 Finding: PLAN-ROUTE-SWITCH-91, ROLECTX-SCOPE-92
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

공식 Fable 경로(FABLE-ARCH·INITIAL)로 다섯 핵심 기획안(target 5f69290, tree 49b3850)을 독립 재검수했다. ① Stage 4 r2 Finding 7건 반영 확인: QUEUE-LOST-UPDATE-80은 팀구성 §11 6·8항(seq·직전 hash·chain prefix 보존, lock 안 재읽기)과 평가 §4.2·§13, 디렉터리 §8.3 사보타주로 해소. AUTO-BASELINE-81은 평가 §8의 route baseline A0·ROLE_CONTEXTS 단일 현재값·A3 이상만 anchor/decision commit 허용으로 해소. PLAN-COUNT-82는 오케스트레이션 §8.2의 누적 집합 단일 소유 선언과 평가 §11·디렉터리 §8.3의 복제 금지로 해소(타 문서의 문서 수 복제 잔존 없음 확인). METRIC-ANCHOR-83은 평가 §3.1·§5.1의 저장소 앵커 없는 질문 분리(자기보고 하한·미확인)로 해소. LRN-VERIFIER-84는 평가 §6.1·§6.2와 팀구성 §5.6의 검증자 독립성·verifier_role·지정 Decision ID 의무로 해소. LOCK-NEST-86은 팀구성 §11 9항(Task lock 보유 중 queue ledger lock 획득 금지), OWNER-LOCK-ORDER-87은 §11 7항(최초 owner 지정의 queue ledger→Task lock 순서)으로 해소. ② r3 Finding 3건: ADVISORY-BUDGET-88은 이번 검수 입력에 승인 장부(turn-h001, advisory_budget_usd_approved=2.00)·t0001 run.json·r3 증거가 모두 포함됐고 entry hash 2d72ca5a…, append 후 hash 7d17c8e7…, 누적 $21.37≤$22.00이 상호 일치해 해소. A0-DELEGATE-89는 팀구성 §4.5의 A0 최소 권한과 평가안 §8 위임의 DELEGATED_PENDING 명시로, ONTO-REF-90은 팀구성 §3.2의 온톨로지 소유권 ACTIVE 승격 후 한정으로 해소. ③ 계약 상호 모순 점검: 요청 수신→request_dispositions[] append(seq·hash)→전역 queue ledger lock→Task lock 고정 순서→lease 획득·lock 안 재확인→만료 자동 인수 금지→실패 폐쇄(RUN_FAILED·환경 미검증)→exact SHA 증거 고정의 상태 전이가 팀구성 §11 단일 권위 아래 오케스트레이션 §4·온톨로지 §6·디렉터리 §7·평가 §4.2에서 폐쇄적으로 일관된다. OPUS_DIRECT_ADVISORY와 공식 Fable gate의 분리는 다섯 문서 모두에서 유지된다(오케 §6.1·§8.2, 평가 §10, 디렉터리 §10, 팀구성 §3.10.2). ④ 잔여 판정: 기존 r2·r3 Finding에서 잔여 Critical·Major·명세상 필수 0건. 다만 신규 Minor 2건을 등록한다. PLAN-ROUTE-SWITCH-91: 오케 §8.2·§13, 평가 §11·§15, 디렉터리 §11 단계6의 완료 조건이 여전히 '누적 Opus 2회' 유효 회차를 요구하나, 2026-09-02 사람 결정(AI-ORCH-PLANS-FABLE-R2/R3-20260902)이 외부 교차검수를 공식 Fable 경로로 전환했고 advisory envelope 잔액도 $0.63뿐이라 결정 ID를 인용한 문서 갱신 전까지 완료 조건이 최신 사람 결정과 모순된다. ROLECTX-SCOPE-92: 팀구성 §11은 ROLE_CONTEXTS.md에 '실제 활성 컨텍스트 식별자와 판본 hash만' 기록한다고 하나 평가 §8은 같은 파일에 route별 현재 A단계·승인 Decision ID·적용 시각·정책·컨텍스트 hash 기록을 요구해 기록 범위 계약이 충돌하며, 엄격 해석 시 AUTO-BASELINE-81 해소 장치(단일 현재값 레지스트리)가 구현 단계에서 무력화될 수 있다. 두 건 모두 proposed_edits로 구체 문구를 제안했다. 따라서 verdict는 CHANGES_REQUIRED이며, 두 Minor 반영 후 재검수에서 잔여 필수 0건 판정이 가능하다. 본 판정은 로컬 검수이며 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- EDIT-ROUTE-SWITCH-ORCH-82: ADD `docs/AI-오케스트레이션-상세기획안.md` · 앞으로 이 목록에 핵심 기획안을 추가하려면 사람 Decision으로 범위를 갱신하고, 추가 직후 전체 · 원문은 review.md 참조
- EDIT-ROUTE-SWITCH-ORCH-DONE: REPLACE `docs/AI-오케스트레이션-상세기획안.md` · - 핵심 기획안 추가마다 누적 Opus 2회 교차검수가 실행된다. · 원문은 review.md 참조
- EDIT-ROUTE-SWITCH-EVAL-11: ADD `docs/AI-품질-학습-자율성-평가기획안.md` · 이 문서가 추가되면 오케스트레이션 기획안 §8.2가 단일 소유하는 현재 누적 집합 전체를 Opus가 · 원문은 review.md 참조
- EDIT-ROUTE-SWITCH-EVAL-DONE: REPLACE `docs/AI-품질-학습-자율성-평가기획안.md` · - 오케스트레이션 기획안 §8.2가 정한 현재 누적 집합 전체의 Opus 2회에서 잔여 필수 Finding 0건을 확인한다. · 원문은 review.md 참조
- EDIT-ROUTE-SWITCH-DIR-STAGE6: REPLACE `docs/디렉터리-문서신경망-재설계-기획안.md` · - 누적 Opus 자문 2회와 공식 필요한 Fable route를 완료한다. · 원문은 review.md 참조
- EDIT-ROLECTX-SCOPE-TEAM-11: REPLACE `docs/팀구성_상세기획안.md` · `ROLE_CONTEXTS.md`는 역할 설명을 복사하지 않고 실제 활성 컨텍스트 식별자와 판본 hash만 기록한다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r003 -->

## SOLAR_RESPONSE · turn-s002 · r003

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f003`
- target_commit_sha: `PENDING_SUCCESSOR_COMMIT`
- changed_artifact_paths: `docs/팀구성_상세기획안.md`, `docs/AI-지식-온톨로지-기획안.md`, `docs/AI-오케스트레이션-상세기획안.md`, `docs/디렉터리-문서신경망-재설계-기획안.md`, `docs/AI-품질-학습-자율성-평가기획안.md`

### PLAN-ROUTE-SWITCH-91

- disposition: `APPLIED`
- 적용 위치: 오케스트레이션 §8.2·§13, 평가 §11·§15·§16, 디렉터리 §11·§15, 온톨로지 §13
- 적용 내용: 사람 결정 `AI-ORCH-PLANS-FABLE-R2-20260902` 이후 누적 외부 교차검수는 공식 Fable 유효 회차로 센다는 단일 경로를 기록하고, 기존 Opus 직접 자문은 역사적 비게이트 증거로만 보존했다.
- 추가 정리: Fable 제안 위치 밖에 남아 있던 온톨로지·디렉터리·평가 완료 문구도 같은 §8.2 단일 소유 표현으로 맞췄다.
- 필요한 재검수: successor Fable RECHECK

### ROLECTX-SCOPE-92

- disposition: `APPLIED`
- 적용 위치: 팀 구성안 §11
- 적용 내용: `ROLE_CONTEXTS.md`가 활성 컨텍스트 식별자·판본 hash뿐 아니라 평가안 §8의 route별 현재 자율성 단계·승인 Decision ID·적용 시각·정책·컨텍스트 hash를 기록하도록 범위를 통일했다. 역할 설명 복사 금지는 유지했다.
- 필요한 재검수: successor Fable RECHECK

- 검증: `git diff --check` 통과, 낡은 완료 조건 표현을 다섯 문서 전체에서 재검색
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r003

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-ORCH-PLANS-FABLE-001`
- predecessor_round: `r003`
- predecessor_task_sha256: `8c70517060ef733ae0eba0b6cda6bc83c29424677d59dcd7bb3ce030c45959fb`
- predecessor_manifest_sha256: `178c884d9384e64a99a9006dee18de54f57edb4d4bca12c1a872ed4889f6c6e5`
- predecessor_review_sha256: `b9717ada84e0acb95e3c731a5bf73c36425685541b9382bd7287fd87aa116337`
- predecessor_run_sha256: `54be4ef4d4ec1d8b9a9dc36a84f656e8047e6568dd840f5f7f46d5ef25ca4218`
- finding_registry_sha256: `365929859bb50a72abbd01561a19ba3db60d0911790ccc86a5151e7659ba9db4`
- successor_task_id: `AI-ORCH-PLANS-FABLE-002`
- successor_target_commit_sha: `399cd39ab5d312c31055b9bdc101ea0300447b51`
- next_review_request: `FABLE_RECHECK`
