# TEAM-CONFIG-GROWTH-004 Fable 검수 — r002

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 모드: `RECHECK`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `ad3a7bb926da0dbb0fc1217d5af461f8c8dc6b77`

## 요약

r001의 필수 Finding 4건을 r002 수정판(README b3176…, 기획안 16267…, 작업큐 6127b…)에서 재검수했다. (1) TCG4-ARCH-001: README §6 248-255가 모든 reviewer_role용 closure successor 계약(원 route·역할·범위 유지, predecessor 최신 성공 회차 registry hash 승계, target=보호 체크 성공 decision commit 이상의 COMMIT snapshot, 보호 체크 SHA·check context·보호 ref 증거 봉인 없으면 CLOSED 거부)을 FABLE-FINAL commit 변경 successor·§8 소진 successor와 분리해 정의하고, schema/runner는 AI-REVIEW-2(작업큐 176-178), validator·ruleset 결합과 부정 자체시험은 P0-2(작업큐 352-355, depends_on AI-REVIEW-2)가 소유하며 구현 전 CLOSED 금지를 명시한다. 기획안 §4.4 5항·11항(804·810)이 같은 계약을 참조한다 → VERIFIED. (2) TCG4-ARCH-002: README §4 두 도식(147-150·161-164)이 반복 종료를 VERIFIED로 고정하고 anchor·decision → 보호 게이트 → closure successor CLOSED 순서로 §9 428-429·기획안 795와 일치 → VERIFIED. (3) TCG4-ARCH-003: README §8 369-371·기획안 619-621이 MANDATORY_MUTUAL·CONDITIONAL successor의 task.review_mode를 route 기본값 INITIAL로 고정하고 RECHECK는 inherited registry에서 실행기가 파생, 직접 선언은 거부로 규정하며 작업큐 158-159에 자체시험을 추가했다. task.example.json 4·10과 본 Task 자체(MANDATORY_MUTUAL·INITIAL·파생 RECHECK)가 현재 계약과 일치한다 → VERIFIED. (4) TCG4-ARCH-004: 작업큐 TEAM-LEARNING-1 210-211에 CANDIDATE/RETIRED 주입·protocol 1.1 학습 필드 추가의 실패 폐쇄 자체시험, AI-REVIEW-2 179-180에 표본 재감사 기록 없는 SEC/FINAL Opus 결과를 참조한 AI_DEPUTY_GATE_DECISION 거부 자체시험이 추가됐다 → VERIFIED. Codex 증거(git diff --check, fable:self-test 31묶음, SHA-256 재계산)는 문서 전용 변경에 충분하다. 새 필수 Finding은 없고, README §9가 closure successor 계약을 이름으로 참조하지 않는 점만 Improvement(TCG4-ARCH-005)로 남긴다. 판정 PASS이나 gate_state는 OPEN을 유지하며 CLOSED 전환·closed_finding_ids는 P0-2 보호 체크 전이라 요청하지 않는다.

## Findings

### TCG4-ARCH-001 — Major / VERIFIED

- 범주: ARCHITECTURE
- 영향: FINAL 외 route의 CLOSED 경로가 실행 가능한 successor 계약으로 정의되고 소유 작업·자체시험이 고정돼 previous_finding_id 연속성 단절 위험이 해소됐다.
- 근거: docs/ai-review/README.md:248, docs/작업큐.md:176, docs/작업큐.md:352, docs/팀구성_상세기획안.md:804, docs/팀구성_상세기획안.md:810
- 완료 조건: README §9 또는 §6에 '보호 체크 성공 뒤 CLOSED 재검수'를 어떤 Task/successor 계약(모든 reviewer_role, target=decision commit 이상, predecessor registry hash 승계, COMMIT snapshot)으로 실행하는지 명시한다. / 해당 계약의 소유 작업(P0-2 또는 AI-REVIEW-2)을 작업큐 완료 조건에 추가하고 '구현 전에는 CLOSED 전환 불가'를 유지한다. / 팀구성_상세기획안 §4.4 5·11항이 같은 successor 계약을 참조한다.
- 필요한 테스트: 소유 작업의 자체시험: FINAL 외 route가 decision commit 대상 successor로 registry를 승계하고, 보호 체크 성공 기록 없이 CLOSED를 반환하면 거부됨을 검증

### TCG4-ARCH-002 — Minor / VERIFIED

- 범주: POLICY
- 영향: 같은 문서 안의 종결 순서가 하나로 통일돼 CLOSED를 anchor 선행 조건으로 오해할 여지가 없어졌다.
- 근거: docs/ai-review/README.md:147, docs/ai-review/README.md:161, docs/ai-review/README.md:428, docs/팀구성_상세기획안.md:795
- 완료 조건: README §4 두 도식의 반복 종료 조건을 'VERIFIED'로만 두고 CLOSED는 게이트 검증 뒤 단계로 옮긴다.
- 필요한 테스트: 없음

### TCG4-ARCH-003 — Minor / VERIFIED

- 범주: ARCHITECTURE
- 영향: successor task 필드 값과 registry 승계 의미가 route 전체에서 분리돼 구현자 해석 분기가 사라졌다.
- 근거: docs/ai-review/README.md:367, docs/팀구성_상세기획안.md:617, docs/작업큐.md:158, docs/ai-review/templates/task.example.json:4
- 완료 조건: README §8·기획안 §3.10.1에 MANDATORY_MUTUAL·CONDITIONAL successor의 task.review_mode 값(권장: route 기본값 INITIAL 유지, RECHECK는 inherited registry에서 파생)을 명시한다. / 작업큐 AI-REVIEW-2 완료 조건에 해당 자체시험을 추가한다.
- 필요한 테스트: successor task.review_mode를 RECHECK로 직접 발행한 경우의 수용/거부 결과가 문서와 같음을 자체시험으로 검증

### TCG4-ARCH-004 — Minor / VERIFIED

- 범주: TEST_GAP
- 영향: 정책과 실행기의 조용한 괴리를 막는 사보타주 시험이 소유 작업 완료 조건에 고정됐다.
- 근거: docs/작업큐.md:210, docs/작업큐.md:179, docs/ai-review/README.md:387
- 완료 조건: TEAM-LEARNING-1 완료 조건에 CANDIDATE/RETIRED ID 주입과 protocol 1.1 Task 학습 필드 추가가 실패 폐쇄됨을 자체시험으로 검증하는 항목을 추가한다. / AI-REVIEW-2 또는 P0-2 완료 조건에 표본 재감사 기록 없는 SEC/FINAL Opus 결과를 참조한 AI_DEPUTY_GATE_DECISION이 거부됨을 검증하는 항목을 추가한다.
- 필요한 테스트: fable:self-test 사보타주 묶음 2종 추가

### TCG4-ARCH-005 — Improvement / OPEN

- 범주: POLICY
- 영향: §9만 읽는 AI 부 O가 CLOSED 재검수를 기존 Task의 다음 회차로 오해할 수 있다. 의미 모순은 없어 PASS를 막지 않는다.
- 근거: docs/ai-review/README.md:428, docs/ai-review/README.md:399, docs/ai-review/README.md:150
- 완료 조건: README §9의 CLOSED 조건 문장이 §6 closure successor 계약을 명시적으로 참조한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### TCG4-EDIT-004 — REPLACE

- 대상: `docs/ai-review/README.md`
- 위치: 체크 성공 기록이 있는 뒤 최초 발견 역할의 재검수에서만 허용한다.
- 연결 Finding: TCG4-ARCH-005
- 이유: §9가 §4·§6·기획안 §4.4와 같은 closure successor 용어를 쓰도록 교차 참조한다.

    체크 성공 기록이 있는 뒤 최초 발견 역할이 §6의 closure successor(`COMMIT`, registry hash 승계)로 재검수할 때만 허용한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
