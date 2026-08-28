# SETUP-COLLAB-001 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 모드: `SMOKE`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `77c9148ca30d9a5423fd48a7056e5c58ccdc62ae`

## 요약

SMOKE r001 판정: PASS. 허용 경로 2개(AGENTS.md, docs/ai-review/README.md)만 읽었고 쓰기·셸·네트워크는 사용하지 않았다.

COLLAB-1(단일 공동 산출물): README.md 3-6행이 "같은 공식 산출물을 차례로 개선"과 tasks/ 디렉터리가 복제 장소가 아님을, 10-11행이 역할별 사본 금지와 allowed_paths 파일이 유일한 공동 산출물임을, 24-25행과 55행이 최종 문서 하나·순차 편집을 명시한다. 충족.

COLLAB-2(회차별 원본 보존): 16-17행이 review.json·review.md 영구 보존과 원본 미편집·다음 회차 정정을, 42-44행이 rounds/rNNN 내 원본 불변을, 59행이 직접 편집·삭제 금지를, 143-146행이 append-only와 틀린 검수도 삭제하지 않음을 명시한다. 충족.

COLLAB-3(대화 장부 합류): 14-15행이 collaboration.md 시간순 추가·과거 턴 수정 금지를, 18-20행이 proposed_edits의 자동 합류와 솔라/부오케스트레이터의 반영 책임을, 68행·78-79행·147행이 원본 보존과 장부 자동 합류·직전 review.json 자동 전달을 명시한다. 충족.

두 조건을 뒤집거나 서로 모순되는 문구는 없다. 비차단 Improvement 2건만 남긴다: (1) README.md 144행의 `REOPENED`가 133행 review_state 열거와 실행기 응답 규약(reopened_finding_ids 목록)에 없어 용어가 어긋남 — 대체 문구를 proposed_edits로 제안. (2) AGENTS.md 9-15행 문서 책임 목록에 검수 규격 문서 항목이 없어 148행의 "AGENTS.md 우선" 규칙이 양방향으로 연결되지 않음 — AGENTS.md는 기준 commit 고정이므로 별도 사람 승인 변경으로 처리할 것을 권고.

## Findings

### COLLAB-001-REOPENED-STATE-TERM — Improvement / OPEN

- 범주: OTHER
- 영향: 보존·정정 규칙 자체는 유지되지만, 상태 어휘가 6절 열거와 어긋나 자동 처리(status.json 갱신, 회차 간 finding 추적)에서 해석이 갈릴 수 있다. 공동 작성 원칙·보존 원칙과는 무관하므로 PASS를 막지 않는다.
- 근거: docs/ai-review/README.md:133, docs/ai-review/README.md:144, COLLABORATION_LOG:0
- 완료 조건: 7절 정정 규칙의 상태 어휘가 6절 review_state 열거 또는 응답 규약의 reopened_finding_ids 중 하나로 일관되게 표현된다. / REOPENED를 상태로 유지하려면 133행 열거에 추가하고 전이 위치(CLOSED 또는 VERIFIED에서 OPEN으로 복귀)를 명시한다.
- 필요한 테스트: 없음

### COLLAB-001-AGENTS-DOC-INDEX — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: 권위 문서가 검수 규격 문서의 존재를 가리키지 않아, 새 작업자가 AGENTS.md만 읽으면 공동 작성·보존 규칙을 찾지 못할 수 있다. 정책 충돌은 아니며 단일 산출물 원칙을 훼손하지 않는다.
- 근거: AGENTS.md:9, docs/ai-review/README.md:148, docs/ai-review/README.md:89
- 완료 조건: AGENTS.md 문서 책임 목록에 'AI 공동 작성·독립 검수 규격: docs/ai-review/README.md' 한 줄이 사람 승인 변경으로 추가되거나, 추가하지 않기로 한 결정이 collaboration.md에 기록된다.
- 필요한 테스트: 없음

## 공동 편집 제안

### COLLAB-001-E1-REOPENED-WORDING — REPLACE

- 대상: `docs/ai-review/README.md`
- 위치: ## 7. 보존·정정 규칙 — '틀린 검수도 삭제하지 않는다.' 항목(144-145행)
- 연결 Finding: COLLAB-001-REOPENED-STATE-TERM
- 이유: 6절 review_state 열거(133행)에 없는 REOPENED 대신 기존 상태값과 실행기 응답 규약의 reopened_finding_ids 목록으로 표현해 상태 어휘를 일치시킨다.

    - 틀린 검수도 삭제하지 않는다. 다음 회차가 같은 finding ID를 `CLOSED` 또는 `DISPUTED`로 정정하거나,
      `reopened_finding_ids`에 올려 `OPEN`으로 되돌린다.

### COLLAB-001-E2-AGENTS-INDEX-NOTE — COMMENT

- 대상: `AGENTS.md`
- 위치: ## 프로젝트와 권위 — 문서 책임 목록(11-15행)
- 연결 Finding: COLLAB-001-AGENTS-DOC-INDEX
- 이유: README 148행이 AGENTS.md 우선을 선언하는데 AGENTS.md 쪽에는 역참조가 없어 권위 문서에서 검수 규격을 찾을 수 없다.

    AGENTS.md는 기준 commit 고정 파일이므로 이번 회차에서 편집하지 않는다. 별도 사람 승인 변경 시 다음 한 줄을 목록 끝에 추가할 것을 제안한다:
    - AI 공동 작성·독립 검수 규격: `docs/ai-review/README.md`

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
