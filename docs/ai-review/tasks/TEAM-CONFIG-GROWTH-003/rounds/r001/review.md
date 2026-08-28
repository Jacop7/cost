# TEAM-CONFIG-GROWTH-003 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `330df4d0f99d386133d4edec4c79fccc34bc4a5b`

## 요약

세 공식 문서는 소진 allowlist/denylist 경계, 동일 baseline·target 유지, predecessor 장부 bytes/hash·handoff turn/entry/run hash·handoff 전용 source commit 봉인, INITIAL/RECHECK의 registry 승계 의미, 원 reviewer role 기반 검증 권한과 verified_by_engine, TEAM_LEARNING 수명주기와 protocol 1.2 미구현 상태를 대체로 일관되게 기술한다. 실행기(scripts/fable-review.mjs)와 schema에 fallback_*·learning·engine 필드가 실제로 없고 문서도 이를 구현 전 계약으로 표기해 현재 지원 상태와 정책이 분리된 점, CLI allowlist 2.1.248/250이 실행기와 일치하는 점을 확인했다. 그러나 다음 모순·누락이 남아 CHANGES_REQUIRED다. (1) 팀구성 §4.4 규칙 11이 anchor commit 전에 필수 Finding CLOSED를 요구해 README §9의 CLOSED 순서(decision commit 보호 체크 성공 뒤)와 순환 모순. (2) 소진 successor 입력 범위(RECHECK=장부 전체, INITIAL=SOLAR_REQUEST까지)가 route를 구분하지 않아 FABLE-FINAL 클린룸(README §11)과 실행기의 FINAL_INDEPENDENT 장부 미전송 동작과 충돌. (3) 작업큐 AI-REVIEW-2·TEAM-LEARNING-1 완료 조건에 successor 입력 범위 자체시험, protocol 1.1의 AI_DEPUTY_FALLBACK_HANDOFF 거부/1.2 수용 시험, FABLE-FINAL SOLAR_REQUEST Learning ID 실패 폐쇄 시험이 빠짐. (4) SECURITY/FINAL route에 INITIAL·RECHECK를 회차 명칭으로 계속 사용하는 문구와 FABLE-SEC 첫 회차 입력 범위 서술 불일치. (5) Opus 불가·비승계 오류 결과를 BLOCKED로 표기하나 BLOCKED는 모델 verdict이고 run_state 값이 아님. (6) protocol 1.2·결과 schema 승격의 소유 Task와 두 작업 간 순서가 미정의. 모두 문서 수정으로 해소 가능하며 proposed_edits를 첨부한다.

## Findings

### TCG3-ARCH-001 — Major / OPEN

- 범주: POLICY
- 영향: P0-2 이후에도 anchor commit 전 CLOSED는 불가능하므로 규칙 11대로면 게이트가 영원히 열리지 않거나, 반대로 AI 부 O가 보호 체크 전에 CLOSED를 선언하는 우회를 유도한다. 세 문서 간 종결 권한 일치라는 필수 증거 항목을 충족하지 못한다.
- 근거: docs/팀구성_상세기획안.md:803, docs/ai-review/README.md:392
- 완료 조건: 팀구성 §4.4 규칙 11을 '필수 Finding 0건(OPEN·DISPUTED 없음, VERIFIED 허용)' 기준으로 고쳐 README §9의 anchor→decision→보호 체크→CLOSED 순서와 일치시킨다. / §4.4 상태 순환 그림과 규칙 5·13이 CLOSED는 보호 체크 성공 뒤 최초 발견 역할의 재검수에서만 전환됨을 동일 문구로 명시한다.
- 필요한 테스트: 문서 검토: 팀구성 §4.4·§4.5 항목 9~10과 README §9 순서 대조

### TCG3-ARCH-002 — Major / OPEN

- 범주: ARCHITECTURE
- 영향: FABLE-FINAL 소진 successor가 규칙대로 predecessor 장부(솔라 자기변호 포함)를 입력받으면 클린룸 독립성이 깨지고, 현재 실행기 동작(FINAL_INDEPENDENT 장부 미전송)과도 어긋나 AI-REVIEW-2 구현 시 어느 쪽을 따를지 모호하다.
- 근거: docs/ai-review/README.md:350, docs/ai-review/README.md:422, scripts/fable-review.mjs:2274, docs/팀구성_상세기획안.md:615
- 완료 조건: 세 문서의 successor 입력 범위 규칙에 route 조건을 추가한다: FINAL_INDEPENDENT route successor는 INITIAL·RECHECK 모두 predecessor 장부를 받지 않고 independent_request와 predecessor registry hash 블록만 받는다. / MANDATORY_MUTUAL·CONDITIONAL·SECURITY route에만 'RECHECK=장부 전체, INITIAL=SOLAR_REQUEST까지' 규칙을 적용함을 명시한다. / 작업큐 AI-REVIEW-2 완료 조건에 route별 입력 범위 자체시험을 추가한다.
- 필요한 테스트: fable:self-test: FINAL_INDEPENDENT successor 프롬프트에 shared_collaboration_log가 없음 / fable:self-test: SECURITY/MANDATORY INITIAL successor 프롬프트가 SOLAR_REQUEST 이후 턴을 포함하지 않음

### TCG3-ARCH-003 — Major / OPEN

- 범주: TEST_GAP
- 영향: 완료 조건이 구현 범위를 빠짐없이 봉인해야 한다는 요구(REQ-09)를 충족하지 못해 구현 시 입력 범위 분리·예약 턴 차단·FABLE-FINAL 학습 누출 차단이 사보타주 시험 없이 누락될 수 있다.
- 근거: docs/작업큐.md:139, docs/ai-review/README.md:183, scripts/fable-review.mjs:2975, docs/작업큐.md:193
- 완료 조건: AI-REVIEW-2 완료 조건에 route별 successor 입력 범위 자체시험, protocol 1.1 append의 AI_DEPUTY_FALLBACK_HANDOFF 명시적 거부와 1.2 successor 전용 수용 자체시험을 추가한다. / TEAM-LEARNING-1 완료 조건에 FABLE-FINAL Task SOLAR_REQUEST(모든 회차)에 Learning ID·학습 요약이 있으면 실패 폐쇄하는 자체시험을 추가한다.
- 필요한 테스트: fable:self-test 사보타주 3종: 1.1 장부 fallback handoff append, FINAL Task SOLAR_REQUEST Learning ID, successor 입력 범위 초과

### TCG3-ARCH-004 — Minor / OPEN

- 범주: POLICY
- 영향: INITIAL/RECHECK가 registry 승계 의미라는 새 규칙과 회차 명칭 사용이 섞여 구현자가 review_mode 검사 조건을 잘못 잡을 수 있고, FABLE-SEC 첫 회차 입력 범위가 두 문서에서 다르게 읽힌다.
- 근거: docs/ai-review/README.md:253, docs/작업큐.md:193, docs/팀구성_상세기획안.md:1030
- 완료 조건: SECURITY·FINAL route의 첫 회차는 'r001(첫 회차)', 이후는 '후속 회차'로 표기하고 INITIAL·RECHECK는 registry 승계 의미로만 남긴다. / 팀구성 §5.6의 FABLE-SEC 클린룸 예외를 '학습 요약·Learning ID 미주입'으로 한정하고 공동 장부 입력 여부는 README §6과 같게 명시한다.
- 필요한 테스트: 없음

### TCG3-ARCH-005 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: 모델 결과가 없는 상황(인증 실패·Opus 불가)에 실행기가 verdict BLOCKED를 합성하면 review.json 위조와 구분되지 않고, 상태 필드 의미 분리 원칙(§9)과 충돌한다.
- 근거: docs/ai-review/README.md:355, docs/팀구성_상세기획안.md:589, docs/ai-review/README.md:375, scripts/fable-review.mjs:42
- 완료 조건: Opus 불가·비승계 오류는 run_state=RUN_FAILED에 구조화된 사유(예: FALLBACK_UNAVAILABLE, NOT_FALLBACK_ELIGIBLE)를 기록하고 status.json 요약으로 사람에게 보고한다고 세 문서에서 통일한다. / verdict BLOCKED는 모델이 반환한 결과에만 쓴다고 명시한다.
- 필요한 테스트: fable:self-test: 모델 결과 없는 run이 review.json을 만들지 않고 RUN_FAILED 사유만 남김

### TCG3-ARCH-006 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: 두 작업이 독립적으로 protocol 1.2·schema 승격을 시도하면 r001 뒤 task/schema/runner 변경 금지 규칙과 충돌하는 중간 판본이 생기고 자체시험 묶음이 이중 정의될 수 있다.
- 근거: docs/작업큐.md:121, docs/작업큐.md:168, docs/ai-review/README.md:248
- 완료 조건: 작업큐에서 protocol 1.2 버전 승격과 결과 schema 승격의 소유 Task를 하나로 지정하고(권장: AI-REVIEW-2), TEAM-LEARNING-1 depends_on에 그 Task를 추가한다. / README §6에 protocol 1.2 필드 도입 순서를 같은 내용으로 기록한다.
- 필요한 테스트: 없음

## 공동 편집 제안

### TCG3-EDIT-001 — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: 11. AI 부 O는 모든 필수 finding의 `CLOSED`, 정확한 판본의 실행 검증 통과와 미해결 제안의 분리를 확인한 뒤, 마지막 review/run/장부/공식 산출물을 anchor commit에 고정하고 이를 참조하는 `AI_DEPUTY_GATE_DECISION` 턴을 별도 decision commit으로 발행한다.
- 연결 Finding: TCG3-ARCH-001
- 이유: README §9의 anchor→decision→보호 체크→CLOSED 순서와 규칙 13에 맞춘다.

    11. AI 부 O는 필수 finding에 `OPEN`·`DISPUTED`가 없고(`VERIFIED` 허용), 정확한 판본의 실행 검증 통과와 미해결 제안의 분리를 확인한 뒤, 마지막 review/run/장부/공식 산출물을 anchor commit에 고정하고 이를 참조하는 `AI_DEPUTY_GATE_DECISION` 턴을 별도 decision commit으로 발행한다. `CLOSED` 전환은 decision commit의 보호 원격 필수 체크 성공 기록 뒤 최초 발견 역할의 재검수에서만 이뤄지므로 anchor commit의 선행 조건이 아니다.

### TCG3-EDIT-002 — REPLACE

- 대상: `docs/ai-review/README.md`
- 위치: `RECHECK` successor는 봉인된 predecessor 장부 전체를 읽기 전용 입력으로 받고, 성공 회차가 없는
- 연결 Finding: TCG3-ARCH-002
- 이유: FABLE-FINAL 클린룸과 실행기의 FINAL_INDEPENDENT 장부 미전송 동작에 맞춰 입력 범위를 route별로 분리한다.

    `FINAL_INDEPENDENT` route successor는 `INITIAL`·`RECHECK` 모두 predecessor 장부를 받지 않고 `independent_request`와 predecessor registry hash 블록만 받는다(§11 클린룸 유지, 실행기도 이 route에는 장부를 전송하지 않는다). 그 밖의 route에서 `RECHECK` successor는 봉인된 predecessor 장부 전체를 읽기 전용 입력으로 받고, 성공 회차가 없는

### TCG3-EDIT-003 — ADD

- 대상: `docs/작업큐.md`
- 위치:   reviewer role·동일 target·첫 회차 소진 `INITIAL`·성공 회차 뒤 `RECHECK`를 자체시험이 검증한다.
- 연결 Finding: TCG3-ARCH-003, TCG3-ARCH-005, TCG3-ARCH-006
- 이유: AI-REVIEW-2 완료 조건에 빠진 입력 범위·예약 턴·상태 필드·protocol 소유 항목을 봉인한다.

    - successor 입력 범위를 route별로 자체시험한다: `FINAL_INDEPENDENT`는 `INITIAL`·`RECHECK` 모두 predecessor 장부 미전송, 그 밖의 route는 `RECHECK`만 장부 전체·`INITIAL`은 `SOLAR_REQUEST`까지.
    - protocol 1.1 장부에 `AI_DEPUTY_FALLBACK_HANDOFF`를 append하면 명시적으로 거부되고 protocol 1.2 successor에서만 수용됨을 자체시험이 검증한다.
    - Opus 불가·비승계 오류는 verdict `BLOCKED`를 합성하지 않고 `run_state=RUN_FAILED`와 구조화된 사유로만 남김을 자체시험이 검증한다.
    - protocol 1.2 버전 승격과 결과 schema 승격은 이 작업이 소유하며 `TEAM-LEARNING-1`은 이 작업에 의존한다.

### TCG3-EDIT-004 — ADD

- 대상: `docs/작업큐.md`
- 위치:   실패 폐쇄함을 자체시험이 검증한다.
- 연결 Finding: TCG3-ARCH-003
- 이유: README §6이 함께 금지한 FABLE-FINAL SOLAR_REQUEST 학습 누출의 사보타주 시험을 추가한다.

    - `FABLE-FINAL` Task의 모든 회차 `SOLAR_REQUEST`에 Learning ID·학습 요약이 있으면 실행기가 실패 폐쇄함을 자체시험이 검증한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: TCG3-ARCH-001, TCG3-ARCH-002, TCG3-ARCH-003, TCG3-ARCH-004, TCG3-ARCH-005, TCG3-ARCH-006

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
