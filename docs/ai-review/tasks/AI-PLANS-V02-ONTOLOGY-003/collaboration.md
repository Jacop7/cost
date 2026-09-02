# AI-PLANS-V02-ONTOLOGY-003 공동 작업 장부

> 묶음 검수의 예산 실패를 반복하지 않고 온톨로지 원문 하나를 Fable이 집중 검수하는 장부다.
> 비-Fable 턴은 전용 append 명령으로만 추가한다.


## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `6cc6c654036cce8b5cb360a33db5ab0df81d6e12`
- changed_artifact_paths: `docs/AI-지식-온톨로지-기획안.md`
- 충족해야 할 요구사항·불변식: 단일 권위, append-only 감사, 단조 HANDOFF, source SHA·snapshot 결속, lease 인계 전 복원
- 집중 검토 질문: stale HANDOFF·경쟁 권위·판본 역행·신호만으로 권한 획득하는 Critical/Major 반례가 있는가? 최대 3개로 합치고 재서술 없이 구조화 결과를 반환한다.
- 실행한 테스트·현재 증거: `corepack pnpm ai:plans:simulate` 68/68. 타 문서의 교차 축은 compact evidence에 결속했다.
- 사람 결정이 필요한 항목: 유효 PASS 뒤에도 다른 세 DRAFT와 최종 네트워크 Fable 검수를 완료해야 한다.
- next_review_request: `FABLE_REVIEW`

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

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- 판정 수용: `ONT-003-HANDOFF-VERSION-GAP`, `ONT-003-LEASE-TAKEOVER-GAP`, `ONT-003-HANDOFF-MUTABLE-STORE` 세 Major를 모두 수용했다.
- 반영: 온톨로지 §3에 Task별 단조 `handoff_version`, lock 기반 +1 발행, 동일 predecessor 분기 거부, append-only 원본과 `docs/team/handoffs/<TASK-ID>/*.md` 단일 위치를 명시했다.
- 반영: §6.4에 만료·부재 lease도 신호만으로 인수할 수 없고 최신 HANDOFF 복원·사람 Decision·queue/Task lock 뒤에만 인수하도록 명시했다.
- 검증: 문서 필수 조항 사보타주와 같은 predecessor 분기·기존 HANDOFF 변조 fixture를 추가했고 `corepack pnpm ai:plans:simulate` 69/69 통과했다.
- 상태: 수정은 아직 새 exact commit으로 봉인하기 전이다. 봉인 후 동일 Finding ID를 승계하는 successor closure Task를 발행한다.
- next_review_request: `SUCCESSOR_CLOSURE_TASK`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `b91ce56d0e41319e48bd45644cec4bd972deaff3`
- artifact_hashes: `[{ path: docs/AI-지식-온톨로지-기획안.md, sha256: 217a3d308bdad63940f8473318b992cc07df63664a27c26823bf10cf3f13f995, change_type: MODIFIED }]`
- finding_ids: `ONT-003-HANDOFF-VERSION-GAP, ONT-003-LEASE-TAKEOVER-GAP, ONT-003-HANDOFF-MUTABLE-STORE`
- 실행 명령: `corepack pnpm ai:plans:simulate`; `git diff --check`
- 종료 코드·결과: 전부 0; 문서 계약·업무 상태 전이·적대 fixture 69/69 통과
- 검증 내용: 단조 정수 판본·동일 predecessor 분기 거부·append-only 원본 경로·만료 lease 인계 전제와 각 사보타주가 같은 exact commit에 결속됐다.
- 미실행 항목과 이유: 전체 `pnpm verify`는 네 DRAFT별 Fable 검수와 최종 네트워크 결속 뒤 최종 게이트에서 실행한다.
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-PLANS-V02-ONTOLOGY-003`
- predecessor_round: `r001`
- predecessor_task_sha256: `2124c5bfb5afb528559f4b052ceb383336edf335457048531aead749916a9ae1`
- predecessor_manifest_sha256: `cebcffe547fe99fe8141fdcfae6aae287ec3a6723636ed5aadc53fcdd2242e29`
- predecessor_review_sha256: `1eba971346a5b2316de37c690a4a6f7b17b17f148e4d347cc77e6b1ed9e15753`
- predecessor_run_sha256: `05f647761352edabcf2c6ac7e10fc15d75598d7fd62c27f9ef89c6e86aeaad32`
- finding_registry_sha256: `4f8747ec44684c125f2cf78e7f992908ae8576583b56df14108fe75e5e7c1faf`
- successor_task_id: `AI-PLANS-V02-ONTOLOGY-004`
- successor_target_commit_sha: `b91ce56d0e41319e48bd45644cec4bd972deaff3`
- next_review_request: `FABLE_RECHECK`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o002 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `AI-PLANS-V02-ONTOLOGY-003`
- predecessor_round: `r001`
- predecessor_task_sha256: `2124c5bfb5afb528559f4b052ceb383336edf335457048531aead749916a9ae1`
- predecessor_manifest_sha256: `cebcffe547fe99fe8141fdcfae6aae287ec3a6723636ed5aadc53fcdd2242e29`
- predecessor_review_sha256: `1eba971346a5b2316de37c690a4a6f7b17b17f148e4d347cc77e6b1ed9e15753`
- predecessor_run_sha256: `05f647761352edabcf2c6ac7e10fc15d75598d7fd62c27f9ef89c6e86aeaad32`
- finding_registry_sha256: `4f8747ec44684c125f2cf78e7f992908ae8576583b56df14108fe75e5e7c1faf`
- successor_task_id: `AI-PLANS-V02-ONTOLOGY-005`
- successor_target_commit_sha: `7ff8b73707afe03bee5cb2f54b42ee7445ee6f94`
- next_review_request: `FABLE_RECHECK`
