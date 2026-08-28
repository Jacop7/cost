# TEAM-CONFIG-GROWTH-002 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `4a7b9fde198d944a9b0e9e593bc7a573a84cb52d`

## 요약

TEAM-CONFIG-GROWTH-001 r001의 필수 Finding 5건은 세 문서에 대체로 반영됐다. 소진 사유 allowlist(MODEL_BUDGET_EXHAUSTED·MODEL_RATE_LIMITED·MODEL_CAPACITY_UNAVAILABLE)와 runner `budget_exhausted`·인증·설정·hash·계약 오류의 비승계 구분, §6 `predecessor_review`와의 분리, 엔진 출처 기록·원 reviewer role 검증 권한, Learning ID의 protocol 1.2 예정 계약·VERIFIED-only·클린룸 거부, INDEPENDENT-AUDIT 검증자 제한, AI-REVIEW-2 미구현 상태 표기는 README·기획안·작업큐가 서로 모순 없이 일치하며 runner의 TASK_KEYS_V11·SAFE_CLAUDE_TERMINAL_REASONS·FINAL_INDEPENDENT 검사와도 부합한다. 다만 새로 확인한 문제 2건이 Major다. (1) 기획안 §5.2가 TEAM-LEARNING-1 전 Learning ID를 `SOLAR_REQUEST` 본문에 기록하도록 하는데, runner는 FINAL_INDEPENDENT 외 모든 route(SECURITY 포함)에 공동 장부를 전송하므로 FABLE-SEC 최초 회차 클린룸 규칙(§5.6, README §6)과 정면 충돌한다. (2) 소진 승계 successor가 `RECHECK`를 수행하려면 predecessor의 SOLAR_RESPONSE·CODEX_EVIDENCE 장부가 필요한데, 봉인 항목 목록에 predecessor 장부 hash·source commit이 없어 §6 successor 계약과 달리 RECHECK 완결성이 정의되지 않았다. Minor 3건: FABLE-SEC/FABLE-FINAL의 task.review_mode는 runner상 SECURITY/FINAL로 고정되므로 문서의 `INITIAL`/`RECHECK`가 review_mode 값인지 승계 의미인지 명시 필요, README §5·기획안 §5.3 턴 목록에 `AI_DEPUTY_FALLBACK_HANDOFF`(및 기획안의 `AI_DEPUTY_SUCCESSOR_HANDOFF`) 미등재와 기획안의 미정의 토큰 `FABLE_EXHAUSTED`, 작업큐 AI-REVIEW-2 완료 조건에 원 reviewer role 검증 권한·`verified_by_engine`·Opus model ID/작업 전체 기본 상한 사람 결정 항목 누락. PASS는 게이트 종결이 아니며 gate_state는 OPEN을 유지한다.

## Findings

### TCG-002-SEC-CLEANROOM-LEARNING-LEAK — Major / OPEN

- 범주: POLICY
- 영향: 현재 protocol 1.1에서 SOLAR_REQUEST 본문에 기록된 Learning ID·요약은 FABLE-SEC 최초 회차에 그대로 전달돼 클린룸 독립성을 깨뜨리고, CANDIDATE 항목이나 결론 요약이 자유 텍스트로 주입되는 경로를 문서가 스스로 허용한다.
- 근거: docs/팀구성_상세기획안.md:906, docs/팀구성_상세기획안.md:1010, scripts/fable-review.mjs:2274, docs/ai-review/README.md:249
- 완료 조건: 기획안 §5.2 과도기 규칙을 'FABLE-SEC 최초 회차(SECURITY route) 및 FABLE-FINAL Task의 SOLAR_REQUEST에는 Learning ID·학습 요약을 기록하지 않으며, 그 밖의 role에서도 VERIFIED ID만 본문에 기록한다'로 한정한다. / README §6에 protocol 1.1 과도기의 동일 제한과 1.2 구현 전에는 사람·AI 부 O의 수동 확인이 유일한 통제임을 명시한다. / 작업큐 TEAM-LEARNING-1 완료 조건에 SECURITY route 장부에서 학습 문구를 탐지·거부하는 자체시험 항목을 추가한다.
- 필요한 테스트: TEAM-LEARNING-1 구현 시 SECURITY route r001 장부에 Learning ID/요약이 있으면 실행기가 실패 폐쇄하는 self-test

### TCG-002-FALLBACK-LEDGER-CONTINUITY — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 성공 회차 뒤 소진된 predecessor를 successor가 RECHECK할 때 SOLAR_RESPONSE·CODEX_EVIDENCE 턴을 어떤 봉인 판본으로 받는지 정의되지 않아 RECHECK의 Codex 증거 확인이 불가능하거나 검증되지 않은 장부 사본이 입력될 수 있다.
- 근거: docs/ai-review/README.md:323, docs/ai-review/README.md:229, docs/팀구성_상세기획안.md:605, scripts/fable-review.mjs:114
- 완료 조건: README §8과 기획안 §3.10.1·§5.5 봉인 목록에 predecessor `collaboration.md` hash·bytes, `AI_DEPUTY_FALLBACK_HANDOFF` turn/entry/run hash, handoff만 추가한 source commit SHA를 추가한다. / RECHECK successor는 predecessor 장부 전체를 읽기 전용 입력으로 받고, INITIAL successor(FABLE-SEC·FABLE-FINAL 제외 시에도)는 predecessor SOLAR_REQUEST까지만 받는 범위를 명시한다. / 작업큐 AI-REVIEW-2 완료 조건에 장부 hash 불일치·handoff 누락 시 실패 폐쇄 자체시험을 추가한다.
- 필요한 테스트: AI-REVIEW-2 self-test: predecessor 장부 변조·handoff 누락·다른 source commit에서 successor 실행 거부

### TCG-002-REVIEW-MODE-SEMANTICS — Minor / OPEN

- 범주: ARCHITECTURE
- 영향: protocol 1.2 구현자가 FABLE-SEC·FABLE-FINAL 소진 successor의 task.review_mode를 INITIAL/RECHECK로 발행하면 현행 route 검사와 충돌하고, 반대로 문서의 INITIAL/RECHECK 의미가 registry 승계 여부라는 점이 드러나지 않는다.
- 근거: docs/ai-review/README.md:336, scripts/fable-review.mjs:656, docs/ai-review/README.md:414
- 완료 조건: README §8·기획안 §3.10.1에 'INITIAL/RECHECK는 inherited registry 유무의 승계 의미이며, FABLE-SEC·FABLE-FINAL의 task.review_mode는 route가 정한 SECURITY/FINAL을 유지한다'를 명시한다.
- 필요한 테스트: AI-REVIEW-2 self-test: SECURITY/FINAL route successor에 review_mode INITIAL/RECHECK를 넣으면 거부

### TCG-002-HANDOFF-TURN-REGISTRY — Minor / OPEN

- 범주: POLICY
- 영향: 턴 유형 목록과 사유 토큰이 문서 간 불일치해 protocol 1.1에서 fallback 턴을 append 시도하거나 `FABLE_EXHAUSTED`를 새 사유 코드로 오인할 수 있다.
- 근거: docs/ai-review/README.md:174, docs/ai-review/README.md:335, docs/팀구성_상세기획안.md:917, docs/팀구성_상세기획안.md:589, scripts/fable-review.mjs:2975
- 완료 조건: README §5와 기획안 §5.3 턴 목록에 두 handoff 턴을 등재하고 `AI_DEPUTY_FALLBACK_HANDOFF`는 protocol 1.2 예약으로 표기한다. / 기획안 §3.10.1의 `FABLE_EXHAUSTED`를 allowlist 사유 표현으로 교체하거나 상위 분류명으로 정의한다.
- 필요한 테스트: 없음

### TCG-002-QUEUE-ENGINE-AUTHORITY-GAP — Minor / OPEN

- 범주: OPERATIONS
- 영향: 작업큐가 완료 조건의 단일 출처인데 schema 승격 항목과 미결 사람 결정이 빠져 구현 시 누락되거나 근거 없이 기본값이 고정될 수 있다.
- 근거: docs/작업큐.md:139, docs/ai-review/README.md:348, COLLABORATION_LOG:0
- 완료 조건: 작업큐 AI-REVIEW-2 완료 조건에 reviewer_role 불변·`verified_by_engine`·원 role 기반 VERIFIED 권한 검증 항목을 추가한다. / 사람 결정 대기 항목으로 Opus 정확한 model ID와 작업 전체 기본 사용 상한을 기록한다.
- 필요한 테스트: AI-REVIEW-2 self-test: reviewer_role을 OPUS-FALLBACK으로 반환하거나 verified_by_engine 누락 시 VALIDATION_REJECTED

## 공동 편집 제안

### TCG-002-E1 — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: 미지 필드로 거부한다. 그 전까지는 `SOLAR_REQUEST` 턴 본문에만 기록한다.
- 연결 Finding: TCG-002-SEC-CLEANROOM-LEARNING-LEAK
- 이유: runner는 FINAL_INDEPENDENT 외 route에 장부를 전송하므로 FABLE-SEC 클린룸을 과도기 규칙이 깨뜨린다.

    미지 필드로 거부한다. 그 전까지는 `VERIFIED` Learning ID만 `SOLAR_REQUEST` 턴 본문에 기록하되, 실행기가 공동 장부를 전송하는 `FABLE-SEC` 최초 회차(SECURITY route)와 `FABLE-FINAL` Task의 `SOLAR_REQUEST`에는 Learning ID·학습 요약을 넣지 않는다. protocol 1.2 전에는 이 제한을 AI 부 오케스트레이터가 수동으로 확인한다.

### TCG-002-E2 — ADD

- 대상: `docs/ai-review/README.md`
- 위치: - 고위험 `FABLE-SEC`·`FABLE-FINAL` 결과의 페이블 복구 후 표본 재감사 조건
- 연결 Finding: TCG-002-FALLBACK-LEDGER-CONTINUITY
- 이유: RECHECK 완결성을 위해 §6 successor와 같은 수준으로 장부 승계를 봉인한다.

    - predecessor `collaboration.md`의 append 후 bytes/hash, `AI_DEPUTY_FALLBACK_HANDOFF` turn/entry/run hash, handoff만 추가한 source commit SHA. `RECHECK` successor는 이 장부 전체를 읽기 전용 입력으로 받고, `INITIAL` successor는 predecessor `SOLAR_REQUEST`까지만 받는다.

### TCG-002-E3 — ADD

- 대상: `docs/ai-review/README.md`
- 위치: 소진되어 성공 회차가 없으면 inherited Finding 0건인 `INITIAL`로 실행한다. 실패 run의 실제 사용액은
- 연결 Finding: TCG-002-REVIEW-MODE-SEMANTICS
- 이유: runner의 route 검사(review_mode SECURITY/FINAL 강제)와 문서 용어를 일치시킨다.

    여기서 `INITIAL`/`RECHECK`는 inherited registry 유무의 승계 의미이며, `FABLE-SEC`·`FABLE-FINAL` successor의 `task.review_mode`는 route가 정한 `SECURITY`·`FINAL`을 그대로 유지한다.

### TCG-002-E4 — ADD

- 대상: `docs/ai-review/README.md`
- 위치: - `AI_DEPUTY_SUCCESSOR_HANDOFF` — 새 COMMIT Task가 이전 Finding을 재검수하도록 승인하는 기계 판독 턴
- 연결 Finding: TCG-002-HANDOFF-TURN-REGISTRY
- 이유: §5 턴 목록과 §8 승계 절차의 불일치를 없애고 현재 미지원임을 명시한다.

    - `AI_DEPUTY_FALLBACK_HANDOFF` — protocol 1.2 예약. 페이블 소진 successor에 predecessor run·사유·registry를 잇는 기계 판독 턴이며 `AI-REVIEW-2` 완료 전 protocol 1.1 append는 거부된다

### TCG-002-E5 — ADD

- 대상: `docs/작업큐.md`
- 위치: - 실패 run의 실제 사용액을 작업 전체 상한에서 차감하고, 초과 승계는 사람 승인 없이는 `BLOCKED`다.
- 연결 Finding: TCG-002-QUEUE-ENGINE-AUTHORITY-GAP
- 이유: README §8의 엔진·권한 계약과 SOLAR_REQUEST의 미결 사람 결정을 완료 조건 단일 출처에 반영한다.

    - 결과 `reviewer_role`은 원 역할을 유지하고 `OPUS-FALLBACK`은 role 값이 될 수 없으며, Finding `VERIFIED` 권한은 원 reviewer role을 따르고 Opus 검증에는 `verified_by_engine`이 필수임을 schema·자체시험이 검증한다.
    - 사람 결정 대기: Opus의 정확한 CLI model ID와 작업 전체 기본 사용 상한은 구현 시 공식 CLI에서 확인해 `HUMAN_DECISION`으로 고정한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: TCG-002-SEC-CLEANROOM-LEARNING-LEAK, TCG-002-FALLBACK-LEDGER-CONTINUITY, TCG-002-REVIEW-MODE-SEMANTICS, TCG-002-HANDOFF-TURN-REGISTRY, TCG-002-QUEUE-ENGINE-AUTHORITY-GAP

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
