# AI-REVIEW-1-COMMIT-DOCS-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-FINAL`
- 모드: `FINAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `3637a36b43ddf31d8b991254e36b6f2c4440f142`

## 요약

AI-REVIEW-1 공식 문서·명령 계약을 COMMIT 3637a36b 기준으로 독립 대조했다. 일치 확인: package.json의 fable:check/self-test/append/review 스크립트와 README §3·§8 명령, PowerShell wrapper의 동일 실행기 pass-through, AGENTS §검사 실행의 fable:review 명령과 `pnpm verify --no-db` 4/6 범위·Node 20.19.4/24 매트릭스(verify.yml·verify.mjs), FINAL_INDEPENDENT 조합·independent_request null 규칙(task.example.json), 장부 턴 유형·Codex 증거 항목(template·fixture·README §5), PASS≠gate CLOSED·gate_state OPEN 유지(README §9·fixture·template)는 서로 모순 없다. 실제 불일치 4건과 개선 1건: (1) Major — P0-2 이전 `VERIFIED` 상한이 README §9 L304·fixture L20-21에 있는데, README §4 L140·§9 L286/L292·§10 L309와 fixture L13-14/L30은 페이블이 Finding을 `CLOSED`로 전환하는 것을 정상 종결 경로로 서술해 상한과 충돌하고, PASS의 '필수 Finding 없음'에 VERIFIED 필수 Finding이 포함되는지도 정의되지 않았다. (2) Minor — README §2 저장 구조가 공식 artifact인 `fixtures/shared-coauthoring-smoke.md`를 분류하지 않는다. (3) Minor — collaboration 템플릿 헤더가 `pnpm fable:append` 전용 append 규칙을 빠뜨리고 역할을 솔라·페이블·Codex로만 적어 AGENTS L21·README L84-85·L110과 어긋난다. (4) Minor — README L121-125의 `Get-Content -Raw | fable:append` 예시는 Windows PowerShell 5.1에서 UTF-8 전달을 보장하지 않는다. (5) Improvement — .gitattributes가 `candidate-review.md`를 다루지 않는다. 실행기 내부 구현은 범위 밖으로 두었다. WORKING r003 PASS, FINAL-SMOKE-002-IMP-001 VERIFIED, gate OPEN 상태는 그대로이며 이 감사는 공식 CLOSED를 선언하지 않는다.

## Findings

### FINAL-DOCS-001-STATE-001 — Major / OPEN

- 범주: POLICY
- 영향: P0-2 이전에 페이블/실행기가 Finding을 CLOSED로 전환해도 문서상 정당화되고, 반대로 VERIFIED에 멈춘 필수 Finding이 PASS·remaining_required 판정에서 어떻게 취급되는지 정의가 없어 같은 상태를 두 역할이 다르게 해석할 수 있다. 실행기가 재검증하는 'Finding 상태 전이'(L183-184)의 기준 문서 자체가 모순이므로 PASS≠gate CLOSED 불변식의 문서 계약이 완결되지 않는다.
- 근거: docs/ai-review/README.md:303, docs/ai-review/README.md:286, docs/ai-review/README.md:140, docs/ai-review/README.md:309, docs/ai-review/fixtures/shared-coauthoring-smoke.md:12, docs/ai-review/fixtures/shared-coauthoring-smoke.md:20, docs/ai-review/fixtures/shared-coauthoring-smoke.md:30, docs/ai-review/README.md:270, COLLABORATION_LOG:0
- 완료 조건: README §9에 P0-2 전 Finding 상태 상한(VERIFIED)과 CLOSED 허용 시점(보호 원격 필수 체크 성공 후 최초 발견 역할의 재검수)을 한 곳에서 정의한다. / PASS·remaining_required_finding_ids 판정에서 VERIFIED 필수 Finding이 '해결됨'으로 취급되는지 명시한다. / README §4 L140, §9 L286·L292, §10 L309와 fixture L13-14·L30의 '닫는다/CLOSED' 표현을 위 정의와 일치시킨다(예: 'VERIFIED 또는 P0-2 이후 CLOSED'). / fixture 내부에서 L13-14와 L20-21이 서로 모순되지 않는다.
- 필요한 테스트: fable:self-test에 'P0-2 전 RECHECK가 Finding을 CLOSED로 반환하면 거부/경고' 사례가 있는지 별도 실행기 Task에서 확인한다. / WORKING r003 PASS 결과의 remaining_required 집계가 VERIFIED 정의와 일치하는지 Codex 증거로 남긴다.

### FINAL-DOCS-001-STRUCT-002 — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: 공식 artifact로 관리되는 fixture의 존재·역할이 README 저장 구조에 없어, 독자가 README만으로는 이 파일이 공식 산출물인지 감사 기록인지 알 수 없다.
- 근거: docs/ai-review/README.md:53, docs/ai-review/README.md:48, docs/ai-review/fixtures/shared-coauthoring-smoke.md:1
- 완료 조건: README §2 트리에 fixtures/shared-coauthoring-smoke.md와 그 역할(공동 작성 왕복 smoke 검증 고정 입력)을 추가한다.
- 필요한 테스트: 없음

### FINAL-DOCS-001-TEMPLATE-003 — Minor / OPEN

- 범주: POLICY
- 영향: 각 Task의 collaboration.md에 복사되는 헤더가 '맨 아래에 추가'만 안내해 직접 편집을 유도할 수 있고, 이는 AGENTS·README·CLAUDE.md가 공통으로 금지하는 행위다.
- 근거: docs/ai-review/templates/collaboration.md:3, AGENTS.md:21, docs/ai-review/README.md:84, docs/ai-review/README.md:110, CLAUDE.md:10
- 완료 조건: 템플릿 헤더에 '비-Fable 턴은 pnpm fable:append로만 추가, Fable 턴은 실행기만 추가, 직접 편집 금지'를 명시한다. / 헤더 역할 목록을 솔라·페이블·Codex·사람·AI 부 오케스트레이터로 맞춘다.
- 필요한 테스트: 없음

### FINAL-DOCS-001-CMD-004 — Minor / OPEN

- 범주: OPERATIONS
- 영향: 문서가 약속한 'UTF-8 본문 전달'을 예시 명령이 모든 지원 셸에서 만족하지 못해, 한글 턴이 깨지거나 실행기 검증에서 거부되는 원인을 문서로는 알 수 없다.
- 근거: docs/ai-review/README.md:121, package.json:24
- 완료 조건: 예시에 `-Encoding utf8`을 추가하고, Windows PowerShell 5.1 사용 시 `$OutputEncoding`/`[Console]::OutputEncoding`을 UTF-8로 설정하거나 PowerShell 7(pwsh) 사용을 요구한다고 명시한다.
- 필요한 테스트: 한글 포함 turn.md를 pwsh 7과 Windows PowerShell 5.1에서 각각 append하여 entry.md hash가 원문 UTF-8 hash와 같은지 Codex 증거로 남긴다.

### FINAL-DOCS-001-ATTR-005 — Improvement / OPEN

- 범주: OPERATIONS
- 영향: candidate-review.md는 같은 불변 모델 출력이지만 glob에 걸리지 않아 whitespace 경고 처리가 review.md와 다르다. 내용 무결성에는 영향 없다.
- 근거: .gitattributes:1, docs/ai-review/README.md:46
- 완료 조건: .gitattributes에 docs/ai-review/tasks/**/candidate-review.md -whitespace를 추가하거나 제외 이유를 주석으로 남긴다.
- 필요한 테스트: 없음

## 공동 편집 제안

### FINAL-DOCS-001-E001 — REPLACE

- 대상: `docs/ai-review/README.md`
- 위치: 필수 체크가 구축되기 전에는 `VERIFIED`까지만 가능하고 공식 gate `CLOSED`를 선언하지 않는다.
- 연결 Finding: FINAL-DOCS-001-STATE-001
- 이유: README §4/§9/§10과 fixture 사이의 Finding CLOSED vs VERIFIED 상한 모순을 한 곳에서 해소하고 PASS 판정 기준을 정의한다.

    필수 체크가 구축되기 전에는 Finding `review_state`를 `VERIFIED`까지만 올리고 `CLOSED`로 전환하지 않으며, 공식 gate `CLOSED`도 선언하지 않는다. 이 기간에는 최초 발견 역할이 완료 조건 충족을 확인한 `VERIFIED` 필수 Finding을 '해결됨'으로 취급해 `PASS` 판정과 `remaining_required_finding_ids` 집계에서 제외한다. §4의 '닫힐 때까지'와 §10의 '같은 ID를 닫거나'는 P0-2 전에는 `VERIFIED` 전환을 뜻하며, `CLOSED` 전환은 decision commit에 대한 보호 원격 필수 체크 성공 기록이 있는 뒤 최초 발견 역할의 재검수 회차에서만 한다.

### FINAL-DOCS-001-E002 — REPLACE

- 대상: `docs/ai-review/fixtures/shared-coauthoring-smoke.md`
- 위치: Finding을 `CLOSED`로 전환한다.
- 연결 Finding: FINAL-DOCS-001-STATE-001
- 이유: fixture L13-14가 같은 파일의 L20-21(P0-2 전 VERIFIED 상한)과 모순되지 않게 한다. L30의 '닫는다'도 같은 표현으로 맞춘다.

    Finding을 `VERIFIED`로 전환하며, `CLOSED` 전환은 `P0-2` 보호 원격 필수 체크가 구축·성공한 뒤의 재검수 회차에서만 한다.

### FINAL-DOCS-001-E003 — ADD

- 대상: `docs/ai-review/README.md`
- 위치: │  └─ collaboration.md
- 연결 Finding: FINAL-DOCS-001-STRUCT-002
- 이유: 공식 artifact인 fixture를 저장 구조에 분류해 경쟁 사본 금지 규칙(§1)과 충돌하지 않게 한다.

    ├─ fixtures/
    │  └─ shared-coauthoring-smoke.md 공동 작성 왕복 smoke 검증용 고정 입력(공식 artifact, 역할별 사본 아님)

### FINAL-DOCS-001-E004 — REPLACE

- 대상: `docs/ai-review/templates/collaboration.md`
- 위치: > 이 파일은 솔라·페이블·Codex가 `task.json`의 `artifact_paths`에 지정된 같은 공식 산출물을
- 연결 Finding: FINAL-DOCS-001-TEMPLATE-003
- 이유: AGENTS L21·README L84-85·L110·CLAUDE.md L10-11의 fable:append 전용 규칙과 역할 목록을 템플릿 헤더에 반영한다(기존 L3-5 블록 전체를 대체).

    > 이 파일은 솔라·페이블·Codex·사람·AI 부 오케스트레이터가 `task.json`의 `artifact_paths`에 지정된 같은 공식 산출물을
    > 개선하는 append-only 상호작용 장부다. Fable 턴은 검수 실행기만 추가하고, 그 밖의 모든 턴은
    > `corepack pnpm fable:append -- --task <TASK-ID>`로만 맨 아래에 추가한다. 이 파일을 직접 편집하거나
    > 과거 턴을 고치거나 지우지 않는다. `reference_paths`와 `evidence_paths`는 읽기 전용이다.

### FINAL-DOCS-001-E005 — REPLACE

- 대상: `docs/ai-review/README.md`
- 위치: Get-Content -Raw .\turn.md | corepack pnpm fable:append -- --task TASK-ID
- 연결 Finding: FINAL-DOCS-001-CMD-004
- 이유: 문서가 약속한 UTF-8 표준입력 전달을 예시 명령이 실제로 보장하게 한다.

    # PowerShell 7(pwsh) 권장. Windows PowerShell 5.1은 먼저 $OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) 를 설정한다.
    Get-Content -Raw -Encoding utf8 .\turn.md | corepack pnpm fable:append -- --task TASK-ID

### FINAL-DOCS-001-E006 — ADD

- 대상: `.gitattributes`
- 위치: docs/ai-review/tasks/**/review.md -whitespace
- 연결 Finding: FINAL-DOCS-001-ATTR-005
- 이유: candidate-review.md도 동일한 불변 모델 출력이므로 같은 whitespace 규칙을 적용한다.

    docs/ai-review/tasks/**/candidate-review.md -whitespace

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: FINAL-DOCS-001-STATE-001, FINAL-DOCS-001-STRUCT-002, FINAL-DOCS-001-TEMPLATE-003, FINAL-DOCS-001-CMD-004

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
