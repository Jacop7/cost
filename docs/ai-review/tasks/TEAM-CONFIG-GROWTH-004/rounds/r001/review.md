# TEAM-CONFIG-GROWTH-004 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`

## 요약

세 공식 문서(팀구성_상세기획안·ai-review/README·작업큐)와 AGENTS.md, schema-v1.json, runner 원본을 대조했다. 소진 사유 allowlist(MODEL_BUDGET_EXHAUSTED/RATE_LIMITED/CAPACITY_UNAVAILABLE)와 runner 회차 상한 budget_exhausted·인증·hash·계약 오류의 비승계 경계, RUN_FAILED+NOT_FALLBACK_ELIGIBLE/FALLBACK_UNAVAILABLE/TASK_CAP_APPROVAL_REQUIRED 구조화 사유, verdict BLOCKED 비합성, 원 reviewer_role 유지·verified_by_engine·SEC/FINAL 표본 재감사, FINAL_INDEPENDENT 클린룸(runner 2274-2276이 FINAL 경로에 장부를 전송하지 않음과 일치), AI_DEPUTY_FALLBACK_HANDOFF의 protocol 1.1 거부(runner 2975 heading 정규식에 없음), AI-REVIEW-2→TEAM-LEARNING-1 의존 순서, FABLE-FINAL 전 회차·FABLE-SEC r001 학습 주입 금지, 회차당 $2.00 상한(runner DEFAULT_MAX_BUDGET_USD)까지 세 문서와 현재 구현이 일치함을 확인했다. 앞선 16건 Finding은 predecessor_review가 null이라 개별 ID로는 대조하지 못했고 패킷 요구사항 11개 기준으로만 검토했다. 남은 문제는 (1) CLOSED 전환을 "decision commit 보호 체크 성공 뒤 최초 발견 역할의 재검수"로 정의했지만 FINAL 외 route에는 다른 commit으로 registry를 잇는 successor 계약이 없고(README §6은 FINAL_INDEPENDENT 전용, §8 소진 승계는 동일 target 전용, WORKING은 HEAD==target 강제) P0-2 완료 조건도 이를 소유하지 않아 CLOSED 경로가 실행 불가능한 정책으로 남는 점(Major), (2) README §4 루프 도식이 CLOSED를 AI 부 O 종결 결정·게이트 검증보다 앞에 두어 §9·기획안 §4.4 순서와 어긋나는 점(Minor), (3) MANDATORY_MUTUAL·CONDITIONAL 소진 successor의 task.review_mode 값이 미규정인 점(Minor), (4) TEAM-LEARNING-1의 CANDIDATE/RETIRED 거부와 AI-REVIEW-2의 미재감사 SEC/FINAL Opus 결과 게이트 사용 차단에 사보타주 시험이 없는 점(Minor)이다. 판정은 CHANGES_REQUIRED이며 gate_state는 OPEN을 유지한다.

## Findings

### TCG4-ARCH-001 — Major / OPEN

- 범주: ARCHITECTURE
- 영향: FABLE-ARCH·FABLE-SEC·FABLE-STRATEGY route에서는 decision commit(=target 이후 commit)을 대상으로 기존 registry를 승계한 재검수를 발행할 계약이 없어, 문서가 정의한 CLOSED 경로가 실행 불가능하거나 새 Task ID로 registry 없이 시작해 previous_finding_id 연속성이 끊긴다. 게이트 순환은 해소됐지만 종결 경로 자체가 미정의로 남는다.
- 근거: docs/ai-review/README.md:412, docs/ai-review/README.md:232, docs/ai-review/README.md:344, scripts/fable-review.mjs:950, scripts/fable-review.mjs:2007, docs/작업큐.md:324, docs/팀구성_상세기획안.md:792
- 완료 조건: README §9 또는 §6에 '보호 체크 성공 뒤 CLOSED 재검수'를 어떤 Task/successor 계약(모든 reviewer_role, target=decision commit 이상, predecessor registry hash 승계, COMMIT snapshot)으로 실행하는지 명시한다. / 해당 계약의 소유 작업(P0-2 또는 AI-REVIEW-2)을 작업큐 완료 조건에 추가하고 '구현 전에는 CLOSED 전환 불가'를 유지한다. / 팀구성_상세기획안 §4.4 5·11항이 같은 successor 계약을 참조한다.
- 필요한 테스트: 소유 작업의 자체시험: FINAL 외 route가 decision commit 대상 successor로 registry를 승계하고, 보호 체크 성공 기록 없이 CLOSED를 반환하면 거부됨을 검증

### TCG4-ARCH-002 — Minor / OPEN

- 범주: POLICY
- 영향: 같은 문서 안에서 종결 순서가 두 갈래로 읽혀 AI 부 O가 CLOSED를 anchor 선행 조건으로 오해할 수 있다.
- 근거: docs/ai-review/README.md:147, docs/ai-review/README.md:412, docs/팀구성_상세기획안.md:807
- 완료 조건: README §4 두 도식의 반복 종료 조건을 'VERIFIED'로만 두고 CLOSED는 게이트 검증 뒤 단계로 옮긴다.
- 필요한 테스트: 없음

### TCG4-ARCH-003 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: AI-REVIEW-2 구현자가 successor task.review_mode를 RECHECK로 발행할지 INITIAL+파생으로 할지 갈려 registry 승계 의미와 task 필드가 다시 혼동될 수 있다.
- 근거: docs/ai-review/README.md:349, docs/팀구성_상세기획안.md:609, docs/작업큐.md:149, scripts/fable-review.mjs:41, scripts/fable-review.mjs:1504
- 완료 조건: README §8·기획안 §3.10.1에 MANDATORY_MUTUAL·CONDITIONAL successor의 task.review_mode 값(권장: route 기본값 INITIAL 유지, RECHECK는 inherited registry에서 파생)을 명시한다. / 작업큐 AI-REVIEW-2 완료 조건에 해당 자체시험을 추가한다.
- 필요한 테스트: successor task.review_mode를 RECHECK로 직접 발행한 경우의 수용/거부 결과가 문서와 같음을 자체시험으로 검증

### TCG4-ARCH-004 — Minor / OPEN

- 범주: TEST_GAP
- 영향: 정책은 있으나 사보타주 시험이 없어 구현 회귀 시 문서와 실행기가 조용히 어긋날 수 있다.
- 근거: docs/작업큐.md:200, docs/작업큐.md:146, docs/ai-review/README.md:372
- 완료 조건: TEAM-LEARNING-1 완료 조건에 CANDIDATE/RETIRED ID 주입과 protocol 1.1 Task 학습 필드 추가가 실패 폐쇄됨을 자체시험으로 검증하는 항목을 추가한다. / AI-REVIEW-2 또는 P0-2 완료 조건에 표본 재감사 기록 없는 SEC/FINAL Opus 결과를 참조한 AI_DEPUTY_GATE_DECISION이 거부됨을 검증하는 항목을 추가한다.
- 필요한 테스트: fable:self-test 사보타주 묶음 2종 추가

## 공동 편집 제안

### TCG4-EDIT-001 — ADD

- 대상: `docs/작업큐.md`
- 위치: - `--no-db` 결과를 전체 6단계 통과로 표시하지 않는다.
- 연결 Finding: TCG4-ARCH-001
- 이유: CLOSED 경로를 실행 가능한 successor 계약으로 소유·검증한다.

    - 보호 체크 성공 뒤 `CLOSED` 재검수 계약을 고정한다. 모든 `reviewer_role`이 decision commit 이상을 target으로 하는 `COMMIT` successor Task에서 predecessor 최신 성공 회차의 Finding registry hash를 승계하고, 동일 SHA 보호 체크 성공 기록이 없으면 `CLOSED` 반환을 거부함을 자체시험이 검증한다. 이 계약 구현 전에는 어떤 route도 `CLOSED`로 전환하지 않는다.

### TCG4-EDIT-002 — REPLACE

- 대상: `docs/ai-review/README.md`
- 위치: ↺ 필수 Finding이 `VERIFIED` 또는 P0-2 구축 뒤 `CLOSED`가 될 때까지 반복
- 연결 Finding: TCG4-ARCH-002
- 이유: §9·기획안 §4.4와 같은 순서로 CLOSED를 게이트 뒤에 둔다.

    ↺ 필수 Finding이 모두 `VERIFIED`가 될 때까지 반복
    → AI 부 오케스트레이터 종결 결정(anchor·decision commit) → 보호 원격/외부 attestation 게이트 검증
    → P0-2 구축 뒤 최초 발견 역할 재검수에서만 `CLOSED`

### TCG4-EDIT-003 — COMMENT

- 대상: `docs/ai-review/README.md`
- 위치: 여기서 `INITIAL`·`RECHECK`는 inherited registry 유무에 따른 승계 의미다. `FABLE-SEC`·
- 연결 Finding: TCG4-ARCH-003
- 이유: registry 승계 의미와 task 필드 값을 route 전체에서 분리한다.

    이 문단 끝에 추가 제안: `MANDATORY_MUTUAL`·`CONDITIONAL` successor의 `task.review_mode`는 route 기본값 `INITIAL`을 유지하고, 결과·manifest의 `RECHECK`는 inherited registry에서 실행기가 파생한다. `task.review_mode`에 `RECHECK`를 직접 발행한 successor는 거부한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: TCG4-ARCH-001, TCG4-ARCH-002, TCG4-ARCH-003, TCG4-ARCH-004

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
