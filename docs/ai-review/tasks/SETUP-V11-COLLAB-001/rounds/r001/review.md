# SETUP-V11-COLLAB-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 모드: `SMOKE`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`

## 요약

SMOKE 최초 검수(r001). 공식 산출물 `docs/ai-review/fixtures/shared-coauthoring-smoke.md`의 "현재 종결 규칙"(9행)은 페이블이 필수 Finding을 남겨도 솔라 반영·Codex 실행 증거·페이블 재검수 없이 "즉시 완료 처리"한다고 명시한다. 이는 (1) 필수 Finding을 최초 검수 역할의 재검수로만 닫는 폐쇄형 왕복 규칙(README §1 26–33행, §4 90–97행, §9 222–228행; SMOKE-COAUTHOR-1, AI-REVIEW:closed-loop-recheck)과 (2) 페이블 PASS와 AI 부 오케스트레이터의 task/gate 종결을 분리하는 규칙(README §9 227–237행; SMOKE-COAUTHOR-3, AI-REVIEW:pass-is-not-gate-closure)을 동시에 위반한다. 같은 파일 13–17행의 "통과 조건"은 올바른 절차를 서술하고 있어 문서 내부에서도 자기모순이 있다. 단일 공식 산출물 원칙(SMOKE-COAUTHOR-2)은 위반 없이 충족된다(역할별 사본 없음, artifact 경로 1개). 필수 Finding 2건(Major)을 OPEN으로 남기며, 9행을 통과 조건과 정합하는 종결 규칙으로 교체하는 proposed_edit을 첨부한다. 솔라가 같은 파일에 반영하고 Codex가 새 판본 hash를 검증한 뒤 r002에서 같은 Finding ID로 재검수한다. PASS가 나더라도 gate_state는 AI 부 오케스트레이터의 별도 결정 전까지 OPEN이어야 한다.

## Findings

### SMOKE-COAUTHOR-CLOSE-RULE-001 — Major / OPEN

- 범주: POLICY
- 영향: 필수 Finding이 반영·검증·재검수 없이 소멸돼 검수 결과가 실제 산출물 상태와 분리된다. 폐쇄형 왕복이 성립하지 않아 상호검수 게이트가 형식화되고, 실행기의 Finding 상태 전이 재검증(README 137–140행)과도 충돌한다.
- 근거: docs/ai-review/fixtures/shared-coauthoring-smoke.md:7, docs/ai-review/fixtures/shared-coauthoring-smoke.md:14, docs/ai-review/README.md:26, docs/ai-review/README.md:90, docs/ai-review/README.md:222
- 완료 조건: 9행의 종결 규칙이 '필수 Finding은 솔라가 같은 공식본에 반영하고 Finding별 응답을 장부에 남기며, Codex가 수정 판본 hash와 검증 결과를 남긴 뒤, 최초 검수 역할(페이블)이 같은 finding_id로 재검수해 완료 조건이 충족된 때만 CLOSED로 전환한다'는 내용으로 교체된다. / '즉시 완료 처리' 또는 이에 상응하는 자동 종결 문구가 산출물에서 제거된다. / 종결 규칙 절과 통과 조건 절(13–17행)이 서로 모순되지 않는다. / 역할별 사본을 만들지 않고 같은 경로 docs/ai-review/fixtures/shared-coauthoring-smoke.md에서 수정된다.
- 필요한 테스트: Codex가 수정 산출물의 SHA-256과 input_files hash를 CODEX_EVIDENCE 턴으로 공동 장부에 기록 / r002 FABLE_RECHECK에서 SMOKE-COAUTHOR-CLOSE-RULE-001을 같은 ID로 재검수해 CLOSED 전환 여부 확인

### SMOKE-COAUTHOR-PASS-GATE-002 — Major / OPEN

- 범주: POLICY
- 영향: 페이블 판정이 곧 작업 종결로 해석되면 gate anchor commit, Codex 증거, 사람 승인(AWAITING_HUMAN) 경로가 건너뛰어져 README §9의 종결 권한 분리가 무력화된다.
- 근거: docs/ai-review/fixtures/shared-coauthoring-smoke.md:9, docs/ai-review/fixtures/shared-coauthoring-smoke.md:17, docs/ai-review/README.md:227, docs/ai-review/README.md:232
- 완료 조건: 산출물의 종결 규칙이 페이블 PASS(필수 Finding 0건)와 AI 부 오케스트레이터의 task/gate 종결(AI_DEPUTY_GATE_DECISION)을 별도 상태로 명시한다. / 페이블이 PASS를 반환해도 gate_state가 자동으로 CLOSED가 되지 않으며, 게이트 종결 주체가 AI 부 오케스트레이터임을 문서에 적는다. / 종결 규칙 절과 17행 통과 조건이 정합한다.
- 필요한 테스트: r002 재검수에서 PASS가 나더라도 status.json의 gate_state가 OPEN으로 유지되는지 Codex 또는 실행기 증거로 확인

## 공동 편집 제안

### SMOKE-EDIT-CLOSE-RULE-001 — REPLACE

- 대상: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- 위치: ## 현재 종결 규칙
- 연결 Finding: SMOKE-COAUTHOR-CLOSE-RULE-001, SMOKE-COAUTHOR-PASS-GATE-002
- 이유: 9행의 즉시 완료 규칙을 README §1·§4·§9 및 같은 파일 13–17행 통과 조건과 정합하는 폐쇄형 재검수·PASS/gate 분리 규칙으로 교체한다.

    ## 현재 종결 규칙
    
    페이블이 필수 Finding(Blocker·Critical·Major·Minor)을 남기면 즉시 완료 처리하지 않는다. 솔라가 같은
    공식 산출물에 수정을 반영하고 공동 장부에 Finding별 응답(`APPLIED | PARTIAL | REJECTED |
    NEEDS_HUMAN_DECISION`)을 남긴 뒤, Codex가 수정 판본의 SHA-256과 검증 결과를 `CODEX_EVIDENCE`로
    기록하고, 최초 검수 역할인 페이블이 같은 `finding_id`로 재검수해 완료 조건이 충족된 때만 해당
    Finding을 `CLOSED`로 전환한다.
    
    페이블 `PASS`는 필수 Finding이 0건이라는 검수 판정일 뿐이며 task/gate의 자동 종결이 아니다.
    `gate_state`는 AI 부 오케스트레이터가 `AI_DEPUTY_GATE_DECISION` 턴에 검증 hash·Codex 증거·종결
    근거를 기록할 때만 `CLOSED`로 바뀌고, 그 전까지 `OPEN`으로 유지한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: SMOKE-COAUTHOR-CLOSE-RULE-001, SMOKE-COAUTHOR-PASS-GATE-002

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
