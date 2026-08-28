# AI-REVIEW-1-COMMIT-DOCS-008 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-FINAL`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `1f4d41f75321506da4c2331e44524f063e34835f`

## 요약

predecessor AI-REVIEW-1-COMMIT-DOCS-001 r001의 Finding 5건을 target COMMIT 1f4d41f7(tree 53bd16d8, AGENTS blob 35001543) 기준으로 같은 finding_id로 재확인했다. (1) FINAL-DOCS-001-STATE-001 — README §9 L306-307·L313-316·L330-333이 P0-2 전 Finding 상한 `VERIFIED`, `CLOSED` 허용 시점(decision commit 보호 원격 필수 체크 성공 뒤 최초 발견 역할의 재검수), VERIFIED 필수 Finding의 `remaining_required_finding_ids`·PASS 차단 집계 제외를 한 곳에 정의하고, §4 L147·§10 L338-339와 fixture L12-14·L21-22·L31-32의 '닫는다/CLOSED' 표현이 모두 같은 정의로 정렬돼 내부 모순이 해소됐다 → VERIFIED. (2) STRUCT-002 — README §2 트리 L57-58에 fixtures/shared-coauthoring-smoke.md와 역할이 추가됐다 → VERIFIED. (3) TEMPLATE-003 — collaboration 템플릿 헤더 L3-7이 역할 5종, Fable 턴은 실행기만, 그 밖은 `fable:append`로만, 직접 편집·과거 턴 수정 금지를 명시해 AGENTS L21·README L87-88·L113·CLAUDE.md L10-11과 일치한다 → VERIFIED. (4) CMD-004 — README L124-132가 pwsh 권장, 5.1 사용 시 `$OutputEncoding`/`[Console]::OutputEncoding` UTF-8 설정, `-Encoding utf8` 예시를 명시한다 → VERIFIED. (5) ATTR-005 — .gitattributes가 `docs/ai-review/tasks/** -text -whitespace`로 candidate-review.*까지 포괄하고 사유 주석을 남겼다 → VERIFIED. 교차 대조 결과 모순 없음: package.json fable:check/self-test/append/review ↔ README §3·§8·AGENTS L116; wrapper의 동일 실행기 pass-through(L3-5) ↔ README L282-286; AGENTS L120-124의 `verify --no-db` 4/6·Node 20.19.4/24 ↔ verify.yml L30·L47·verify.mjs L114-116; FINAL_INDEPENDENT 조합·independent_request/predecessor_review null 규칙 ↔ task.example.json; 장부 턴 유형 9종·AI_DEPUTY_SUCCESSOR_HANDOFF ↔ template L106-118; successor RECHECK·previous_finding_id=같은 finding_id 계약(README §11 L358-363) ↔ 본 실행 프롬프트. 실행기 내부 구현과 self-test 회귀 사례는 범위 밖(별도 실행기 Task)으로 두었다. 5건 모두 VERIFIED이므로 remaining_required는 비어 있고 verdict는 PASS이나, 이는 페이블의 로컬 판정일 뿐이며 공식 CLOSED는 선언하지 않고 gate_state는 OPEN으로 유지한다.

## Findings

### FINAL-DOCS-001-STATE-001 — Major / VERIFIED

- 범주: POLICY
- 영향: P0-2 이전 Finding 상태 상한과 PASS·remaining_required 판정 기준이 README §4/§9/§10과 fixture에서 동일하게 정의돼, 실행기가 재검증하는 Finding 상태 전이의 기준 문서 모순이 해소됐다. 실행기 self-test의 CLOSED 거부 사례 확인은 별도 실행기 Task 범위로 남긴다.
- 근거: docs/ai-review/README.md:306, docs/ai-review/README.md:313, docs/ai-review/README.md:330, docs/ai-review/README.md:147, docs/ai-review/README.md:338, docs/ai-review/README.md:319, docs/ai-review/fixtures/shared-coauthoring-smoke.md:12, docs/ai-review/fixtures/shared-coauthoring-smoke.md:31
- 완료 조건: README §9에 P0-2 전 Finding 상태 상한(VERIFIED)과 CLOSED 허용 시점(보호 원격 필수 체크 성공 후 최초 발견 역할의 재검수)을 한 곳에서 정의한다. / PASS·remaining_required_finding_ids 판정에서 VERIFIED 필수 Finding이 '해결됨'으로 취급되는지 명시한다. / README §4 L140, §9 L286·L292, §10 L309와 fixture L13-14·L30의 '닫는다/CLOSED' 표현을 위 정의와 일치시킨다(예: 'VERIFIED 또는 P0-2 이후 CLOSED'). / fixture 내부에서 L13-14와 L20-21이 서로 모순되지 않는다.
- 필요한 테스트: fable:self-test에 'P0-2 전 RECHECK가 Finding을 CLOSED로 반환하면 거부/경고' 사례가 있는지 별도 실행기 Task에서 확인한다. / WORKING r003 PASS 결과의 remaining_required 집계가 VERIFIED 정의와 일치하는지 Codex 증거로 남긴다.

### FINAL-DOCS-001-STRUCT-002 — Minor / VERIFIED

- 범주: ARCHITECTURE
- 영향: 공식 artifact인 fixture가 README §1의 경쟁 사본 금지 규칙과 충돌하지 않게 분류됐다.
- 근거: docs/ai-review/README.md:55, docs/ai-review/fixtures/shared-coauthoring-smoke.md:1
- 완료 조건: README §2 트리에 fixtures/shared-coauthoring-smoke.md와 그 역할(공동 작성 왕복 smoke 검증 고정 입력)을 추가한다.
- 필요한 테스트: 없음

### FINAL-DOCS-001-TEMPLATE-003 — Minor / VERIFIED

- 범주: POLICY
- 영향: 각 Task로 복사되는 템플릿 헤더가 AGENTS·README·CLAUDE.md의 append 규칙과 역할 목록을 동일하게 안내해 직접 편집 유도 위험이 제거됐다.
- 근거: docs/ai-review/templates/collaboration.md:3, AGENTS.md:21, docs/ai-review/README.md:113, CLAUDE.md:10
- 완료 조건: 템플릿 헤더에 '비-Fable 턴은 pnpm fable:append로만 추가, Fable 턴은 실행기만 추가, 직접 편집 금지'를 명시한다. / 헤더 역할 목록을 솔라·페이블·Codex·사람·AI 부 오케스트레이터로 맞춘다.
- 필요한 테스트: 없음

### FINAL-DOCS-001-CMD-004 — Minor / VERIFIED

- 범주: OPERATIONS
- 영향: 문서가 약속한 UTF-8 표준입력 전달을 예시 명령이 지원 셸 모두에서 보장한다. 한글 turn.md의 append hash 동일성은 Codex 실행 증거로 남기는 것을 권장하나 문서 계약 자체는 충족됐다.
- 근거: docs/ai-review/README.md:124, docs/ai-review/README.md:128, package.json:24
- 완료 조건: 예시에 `-Encoding utf8`을 추가하고, Windows PowerShell 5.1 사용 시 `$OutputEncoding`/`[Console]::OutputEncoding`을 UTF-8로 설정하거나 PowerShell 7(pwsh) 사용을 요구한다고 명시한다.
- 필요한 테스트: 한글 포함 turn.md를 pwsh 7과 Windows PowerShell 5.1에서 각각 append하여 entry.md hash가 원문 UTF-8 hash와 같은지 Codex 증거로 남긴다.

### FINAL-DOCS-001-ATTR-005 — Improvement / VERIFIED

- 범주: OPERATIONS
- 영향: 불변 모델 출력과 감사 기록의 whitespace/eol 처리가 파일 종류에 관계없이 동일해졌다.
- 근거: .gitattributes:1, docs/ai-review/README.md:46
- 완료 조건: .gitattributes에 docs/ai-review/tasks/**/candidate-review.md -whitespace를 추가하거나 제외 이유를 주석으로 남긴다.
- 필요한 테스트: 없음

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
