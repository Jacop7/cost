# TEAM-CONFIG-GROWTH-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `d6dcdfb04af4bc0c579e07edc36d6104755e2f3c`

## 요약

네 문서(AGENTS.md·팀구성_상세기획안 v1.1·ai-review/README §8·작업큐 AI-REVIEW-2/TEAM-LEARNING-1)는 "Opus 승계와 학습 루프는 정책이며 runner 구현은 AI-REVIEW-2·TEAM-LEARNING-1 완료 전 미지원"이라는 상태 구분을 일관되게 유지하고, 소진 allowlist·비승계 denylist·불변 실패 run·실제 엔진 기록·클린룸 예외 원칙도 서로 모순 없이 기술한다. 그러나 구현 계약으로 쓰기에는 네 가지 구조적 공백이 있다. (1) 현재 유일한 successor 계약인 `predecessor_review`는 README §6과 runner가 FABLE-FINAL/FINAL_INDEPENDENT·predecessor 최신 성공 회차·baseline=predecessor target으로 고정하는데, 소진 승계는 모든 역할·동일 target·실패 run 기반이어야 하므로 두 계약이 충돌하며 어느 문서도 이를 조정하지 않는다. (2) 소진 allowlist의 "회차 예산 소진"이 runner 자체의 `--max-budget-usd` 회차 상한(`budget_exhausted` 안전 종료)과 모델 제공자 한도를 구분하지 않고, "CLI에서 일시적으로 제공되지 않음"이라는 네 번째 사유가 3값 enum에 없다. (3) 결과 스키마·runner에 엔진/모델 필드가 없고, 역할 동일성(Opus가 같은 role ID로 페이블 Finding을 VERIFIED할 수 있는지, 복구된 페이블이 Opus Finding을 검증할 수 있는지)이 정의되지 않았다. (4) §5.2 작업 패킷의 Learning ID 필드는 protocol 1.1이 거부하는 미지 필드인데 TEAM-LEARNING-1의 touches에 runner·schema가 없고, INDEPENDENT-AUDIT 레인 학습의 반대 역할 검증자와 FABLE-SEC·RECHECK 회차에 대한 학습 주입 규칙이 비어 있다. 모두 문서 수준 수정으로 해결 가능하며 proposed_edits로 구체 문구를 제시한다.

## Findings

### TCG-001-SUCCESSOR-CONTRACT-GAP — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 현재 runner와 README §6 그대로면 FABLE-ARCH/SEC/STRATEGY 소진 승계는 STALE로 실패 폐쇄되고, FABLE-FINAL도 baseline≠target 조건 때문에 동일 target 승계를 표현할 수 없다. 구현자가 §6을 완화하면 기존 hash-chain·handoff 보호가 함께 약화될 수 있고, 1회차 소진 시 승계할 registry가 없는 상황이 미정의라 Finding 누락 또는 임의 INITIAL 재시작이 발생할 수 있다.
- 근거: docs/ai-review/README.md:229, scripts/fable-review.mjs:2006, docs/팀구성_상세기획안.md:590, docs/ai-review/README.md:311, docs/ai-review/README.md:223, docs/작업큐.md:139
- 완료 조건: README §6 또는 §8에 소진 승계용 handoff 턴(예: AI_DEPUTY_FALLBACK_HANDOFF 또는 AI_DEPUTY_SUCCESSOR_HANDOFF의 fallback_reason 확장)을 정의하고 기존 predecessor_review와의 차이(모든 reviewer_role 허용, successor baseline·target=predecessor baseline·target, 기점이 RUN_FAILED run)를 명시한다. / predecessor 최신 성공 회차가 없는 1회차 소진의 successor는 review_mode=INITIAL이며 inherited finding 0건임을 명시하고, 성공 회차가 있으면 그 registry hash를 승계해 RECHECK로 실행한다고 정의한다. / fallback_from_task_id·fallback_from_run_sha256·fallback_reason이 task.json protocol(1.2 등) 필드로 승격되기 전에는 문서에서 '봉인 대상'이 아니라 'AI-REVIEW-2 예정 필드'로 표기한다. / 작업큐 AI-REVIEW-2 완료 조건에 위 세 항목과 실패 run 실제 사용액의 작업 전체 상한 차감을 추가한다.
- 필요한 테스트: self-test: FABLE-ARCH predecessor RUN_FAILED(budget) → fallback successor 실행이 허용되고, 같은 조건의 FABLE-FINAL 비-fallback successor는 여전히 STALE로 실패한다. / self-test: successor target≠predecessor target 또는 artifact/input hash 불일치 시 실패 폐쇄한다. / self-test: 1회차 소진 successor가 INITIAL로 실행되고, 2회차 이후 소진 successor가 마지막 성공 회차 registry 전체를 같은 ID·심각도·범주로 반환하지 않으면 거부한다.

### TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY — Major / OPEN

- 범주: POLICY
- 영향: runner가 스스로 정한 $2 회차 상한 도달을 MODEL_BUDGET_EXHAUSTED로 해석하면 큰 입력을 가진 작업마다 페이블이 자동으로 Opus로 대체되어 '소진 때만'이라는 사용자 결정이 사실상 무력화되고, 감사 엔진이 정책 아닌 프롬프트 크기로 결정된다. 'CLI 미제공'을 소진으로 보면 CLI 버전 allowlist 위반이나 설정 오류를 Opus로 우회하는 경로가 열린다.
- 근거: docs/팀구성_상세기획안.md:579, docs/팀구성_상세기획안.md:927, scripts/fable-review.mjs:100, docs/ai-review/README.md:297, docs/ai-review/README.md:307
- 완료 조건: 기획안 §3.10.1과 README §8에서 MODEL_BUDGET_EXHAUSTED를 '모델 제공자·구독 한도의 구조화된 오류'로 한정하고, runner --max-budget-usd 회차 상한 도달(budget_exhausted)은 승계 사유가 아니라 재실행 또는 사람 승인 상한 조정 대상임을 명시한다. / '페이블 모델이 공식 CLI에서 일시적으로 제공되지 않음'을 allowlist에서 제거하거나 MODEL_CAPACITY_UNAVAILABLE의 구조화 오류 하위 사례로 한정하고, CLI 버전·설정 불일치는 BLOCKED denylist로 둔다. / 소진 판정은 CLI의 구조화된 terminal reason/오류 코드만 근거로 하고 자유 텍스트 매칭을 금지한다고 명시한다.
- 필요한 테스트: self-test: runner 회차 상한 도달(error_max_budget_usd/budget_exhausted) run은 fallback-eligible로 표시되지 않는다. / self-test: 인증 실패·exit≥64·STALE(75)·schema/의미 계약 거부 run에서 successor fallback을 시도하면 거부된다. / self-test: 구조화된 rate-limit/capacity 오류만 fallback_reason으로 기록되고 그 외 문자열은 RUN_FAILED로 남는다.

### TCG-001-ENGINE-IDENTITY-SCHEMA — Major / OPEN

- 범주: DATA_INTEGRITY
- 영향: 엔진 출처가 run.json에만 남고 review.json·status.json에 없으면 Finding 집계·장부·후속 입력에서 Opus 결과가 페이블 결과로 보이게 되어 TEAM-CONFIG-4를 위반한다. 역할 동일성이 미정이면 Opus가 페이블 Finding을 VERIFIED하거나 복구된 페이블이 Opus Finding을 VERIFIED할 때 '최초 지적 역할만 검증' 규칙 적용이 구현자 재량에 맡겨진다.
- 근거: scripts/fable-review/schema-v1.json:35, scripts/fable-review.mjs:2345, docs/팀구성_상세기획안.md:857, docs/팀구성_상세기획안.md:605, docs/ai-review/README.md:303
- 완료 조건: README §8 또는 §9에 결과 review.json(schema 1.x 승격)·run.json·status.json 각각에 primary_reviewer_engine, reviewer_engine, 정확한 model ID, CLI 판본·실행 파일 hash를 필수 필드로 두고 review.md 렌더링·장부 FABLE_REVIEW/FABLE_RECHECK 턴 헤더에도 엔진을 표기한다고 명시한다. / Finding 검증 권한은 reviewer_role 기준(엔진 무관)임을 명시하고, Opus가 VERIFIED한 Finding은 review.json에 verified_by_engine을 남기며 FABLE-SEC·FABLE-FINAL에서는 페이블 복구 후 표본 재감사 전까지 게이트 종결 요청에 쓰지 않는다고 정한다. / §5.1 OPUS-FALLBACK은 컨텍스트 ID이지 reviewer_role 값이 아니며 결과 reviewer_role은 승계한 원 역할 ID를 유지한다고 명시한다.
- 필요한 테스트: self-test: 엔진 필드가 없거나 primary와 다른 엔진을 primary로 기록한 결과는 VALIDATION_REJECTED로 격리된다. / self-test: status.json 재생 시 Opus 회차가 'fable' 엔진으로 요약되면 STALE.

### TCG-001-LEARNING-PACKET-PROTOCOL — Major / OPEN

- 범주: ARCHITECTURE
- 영향: 현재 문서는 Learning ID 필드를 이미 유효한 패킷 규격처럼 제시하므로 TEAM-CONFIG-8(정책과 runner 지원 상태 구분)에 어긋나고, TEAM-LEARNING-1이 runner·schema 변경 없이 완료 보고될 수 있어 '주입 누락 0건' 지표를 기계적으로 측정할 수 없다.
- 근거: docs/팀구성_상세기획안.md:862, docs/ai-review/README.md:223, docs/ai-review/templates/task.example.json:1, docs/작업큐.md:159
- 완료 조건: §5.2의 Learning ID 두 필드에 'TEAM-LEARNING-1 완료 전에는 task.json 계약이 아니며 SOLAR_REQUEST 턴 본문에만 기록한다'는 주석을 붙인다. / 작업큐 TEAM-LEARNING-1 touches에 scripts/fable-review.mjs·scripts/fable-review/schema-v1.json(또는 task protocol 1.2)을 추가하고 완료 조건에 'RETIRED·미검증 Learning ID가 패킷에 있으면 runner가 거부'를 명시한다. / README §6에 protocol 1.2 필드(applied_learning_ids, excluded_learning_ids)의 도입 시점과 1.1 Task와의 호환 규칙을 예고한다.
- 필요한 테스트: self-test: applied_learning_ids에 CANDIDATE/RETIRED ID가 있으면 exit 65로 거부. / self-test: FABLE-FINAL INITIAL/FINAL_INDEPENDENT 첫 회차 패킷에 학습 필드가 비어 있지 않으면 거부.

### TCG-001-LEARNING-AUDIT-LANE-VERIFIER — Minor / OPEN

- 범주: POLICY
- 영향: 감사 레인 학습이 솔라 작성·솔라 검증으로 굳으면 독립 감사의 판단 기준이 제작 조직 요약으로 오염될 수 있고, FABLE-SEC 최초 감사에 팀 결론이 주입되는 것을 막는 규칙이 없다.
- 근거: docs/팀구성_상세기획안.md:949, docs/팀구성_상세기획안.md:976, docs/작업큐.md:175
- 완료 조건: INDEPENDENT-AUDIT 레인 CANDIDATE는 페이블 review.json의 Finding·proposed_edits를 원본으로 AI 부 O가 전사하고, 검증자는 Codex(실행 증거) 또는 사람으로 한정하며 솔라 단독 검증을 금지한다고 명시한다. / 클린룸 예외를 FABLE-SEC 최초 회차에도 적용하고, RECHECK 회차에는 VERIFIED Learning ID만 목록 형태로 주입하며 결론 요약문은 넣지 않는다고 명시한다.
- 필요한 테스트: TEAM-LEARNING-1 self-test: FABLE-SEC INITIAL 패킷에 학습 요약이 있으면 거부.

## 공동 편집 제안

### TCG-001-E1-README-FALLBACK-SUCCESSOR — ADD

- 대상: `docs/ai-review/README.md`
- 위치: 이 절은 `AI-REVIEW-2`의 구현 계약이다. runner·schema·task template·사보타주 시험이 함께 반영되기
- 연결 Finding: TCG-001-SUCCESSOR-CONTRACT-GAP
- 이유: 기존 successor 계약(FABLE-FINAL 전용·baseline=predecessor target)과 소진 승계(모든 역할·동일 target·실패 run 기점)의 충돌과 1회차 소진 미정의를 해소한다.

    소진 승계는 §6의 `predecessor_review`와 다른 별도 계약이다. §6은 확정 commit을 바꿔 FABLE-FINAL Finding을 재검수하는 경로이고, 소진 승계는 모든 reviewer_role에서 **같은 baseline·같은 target commit**을 유지한 채 `RUN_FAILED(fallback_reason ∈ allowlist)` run을 기점으로 이어진다. 구현 시 predecessor 장부 끝에 `AI_DEPUTY_FALLBACK_HANDOFF` 턴을 `fable:append`로 추가하고 successor `task.json`(protocol 1.2 예정)에 `fallback_from_task_id`, `fallback_from_round`, `fallback_from_run_sha256`, `fallback_reason`을 봉인한다. predecessor에 성공 회차가 있으면 그 최신 성공 회차의 review/Finding registry hash를 함께 봉인하고 successor 첫 회차는 `RECHECK`다. 성공 회차가 없는 1회차 소진이면 inherited finding 0건으로 `INITIAL`을 실행한다. 실패 run의 실제 사용액은 작업 전체 상한에서 차감한 뒤 남은 상한을 봉인한다. 이 필드들은 AI-REVIEW-2 완료 전에는 task.json 계약이 아니다.

### TCG-001-E2-PLAN-EXHAUSTION-REASONS — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: - 페이블 모델의 회차 예산 소진
- 연결 Finding: TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY
- 이유: runner 회차 상한(budget_exhausted 안전 종료)과 모델 제공자 한도를 구분해 프롬프트 크기만으로 Opus 전환이 일어나는 것을 막는다.

    - 페이블 모델 제공자·구독 한도의 소진(`MODEL_BUDGET_EXHAUSTED`). 실행기가 스스로 정한 회차 `--max-budget-usd` 상한 도달은 소진이 아니라 재실행 또는 사람 승인 상한 조정 대상이다.

### TCG-001-E3-PLAN-CLI-UNAVAILABLE — REPLACE

- 대상: `docs/팀구성_상세기획안.md`
- 위치: - 페이블 모델이 공식 CLI에서 일시적으로 제공되지 않음
- 연결 Finding: TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY
- 이유: 3값 enum에 없는 네 번째 사유를 제거하고 CLI 설정·버전 문제가 승계로 우회되지 않게 한다.

    - 공식 CLI가 구조화된 오류로 페이블 모델의 일시적 용량 부족을 보고함(`MODEL_CAPACITY_UNAVAILABLE`). CLI 버전 allowlist 불일치, 모델 ID 설정 오류, 자유 텍스트 오류는 여기에 포함하지 않고 `BLOCKED`로 사람에게 보고한다.

### TCG-001-E4-README-ENGINE-FIELDS — ADD

- 대상: `docs/ai-review/README.md`
- 위치: `primary_reviewer_engine`, `reviewer_engine`, 정확한 model ID와 CLI·runner hash를 기록한다.
- 연결 Finding: TCG-001-ENGINE-IDENTITY-SCHEMA
- 이유: 엔진 출처가 결과·상태·장부 전부에 남게 하고 엔진 교체 시 Finding 검증 권한의 기준을 고정한다.

    이 값은 `review.json`(결과 schema 승격 시 필수 필드), `run.json`, `status.json`의 회차 요약과 장부 `FABLE_REVIEW`/`FABLE_RECHECK` 턴 헤더에 모두 기록한다. 결과의 `reviewer_role`은 승계한 원 역할 ID(`FABLE-ARCH` 등)를 유지하며 `OPUS-FALLBACK`은 컨텍스트 식별자일 뿐 role 값이 아니다. Finding의 `VERIFIED` 권한은 엔진이 아니라 reviewer_role 기준이지만, Opus가 `VERIFIED`한 `FABLE-SEC`·`FABLE-FINAL` Finding은 `verified_by_engine`을 남기고 페이블 복구 후 표본 재감사 전에는 게이트 종결 요청 근거로 쓰지 않는다.

### TCG-001-E5-QUEUE-AI-REVIEW-2-CRITERIA — ADD

- 대상: `docs/작업큐.md`
- 위치: - `corepack pnpm fable:check`, `fable:self-test`, `corepack pnpm verify`가 모두 통과한다.
- 연결 Finding: TCG-001-SUCCESSOR-CONTRACT-GAP, TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY, TCG-001-ENGINE-IDENTITY-SCHEMA
- 이유: AI-REVIEW-2 완료 조건에 successor 계약 조정·소진 판정 경계·엔진 기록·상한 차감의 사보타주 시험을 추가한다.

    - 소진 승계 handoff 계약이 기존 `predecessor_review`(FABLE-FINAL·commit 변경 경로)와 분리 정의되고, 모든 reviewer_role·동일 target·1회차 소진(INITIAL)·성공 회차 승계(RECHECK)를 자체시험이 검증한다.
    - runner 회차 상한 도달(`budget_exhausted`)·인증 실패·STALE·schema/의미 계약 거부 run은 fallback-eligible로 표시되지 않음을 자체시험이 검증한다.
    - `review.json`·`run.json`·`status.json`·장부 턴 헤더에 primary/fallback 엔진·정확한 model ID가 기록되고, 엔진 누락·위장 결과는 `VALIDATION_REJECTED`로 격리된다.
    - 실패 run의 실제 사용액이 작업 전체 상한에서 차감되고 상한 초과 승계는 사람 승인 없이는 `BLOCKED`다.

### TCG-001-E6-PLAN-LEARNING-FIELDS-NOTE — ADD

- 대상: `docs/팀구성_상세기획안.md`
- 위치: - Excluded / RETIRED Learning IDs and reason:
- 연결 Finding: TCG-001-LEARNING-PACKET-PROTOCOL
- 이유: 문서 정책과 실제 runner 지원 상태를 구분한다(TEAM-CONFIG-8).

      (위 두 Learning 필드는 `TEAM-LEARNING-1` 완료 전에는 protocol 1.1 `task.json`의 계약 필드가 아니며 실행기가 미지 필드로 거부한다. 그 전까지는 `SOLAR_REQUEST` 턴 본문에만 기록한다.)

### TCG-001-E7-QUEUE-TEAM-LEARNING-TOUCHES — REPLACE

- 대상: `docs/작업큐.md`
- 위치: touches: [docs/team/TEAM_LEARNING.md, docs/team/ROLE_CONTEXTS.md, docs/작업큐.md, docs/ai-review/templates/, docs/팀구성_상세기획안.md]
- 연결 Finding: TCG-001-LEARNING-PACKET-PROTOCOL
- 이유: 패킷 Learning ID 필드와 주입 차단은 task protocol·runner 변경 없이는 구현할 수 없다.

    touches: [docs/team/TEAM_LEARNING.md, docs/team/ROLE_CONTEXTS.md, docs/작업큐.md, docs/ai-review/templates/, docs/ai-review/README.md, docs/팀구성_상세기획안.md, scripts/fable-review.mjs, scripts/fable-review/schema-v1.json]

### TCG-001-E8-QUEUE-TEAM-LEARNING-CRITERIA — REPLACE

- 대상: `docs/작업큐.md`
- 위치: - 독립 종합 감사 최초 회차에는 팀 결론 요약을 넣지 않아 클린룸 독립성을 유지한다.
- 연결 Finding: TCG-001-LEARNING-AUDIT-LANE-VERIFIER, TCG-001-LEARNING-PACKET-PROTOCOL
- 이유: 감사 레인 학습의 검증자 편향과 FABLE-SEC·RECHECK 회차 주입 공백을 메운다.

    - 독립 종합 감사와 보안 감사의 최초 회차에는 팀 결론 요약을 넣지 않고, RECHECK 회차에는 VERIFIED Learning ID 목록만 주입해 클린룸 독립성을 유지한다.
    - INDEPENDENT-AUDIT 레인 CANDIDATE는 페이블 `review.json` 원본을 근거로 AI 부 O가 전사하고 Codex 실행 증거 또는 사람이 검증한다. 솔라 단독 검증은 허용하지 않는다.
    - 적용·제외 Learning ID는 task protocol 필드로 봉인되며 CANDIDATE·RETIRED ID가 포함된 패킷은 실행기가 거부한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: TCG-001-SUCCESSOR-CONTRACT-GAP, TCG-001-EXHAUSTION-ALLOWLIST-AMBIGUITY, TCG-001-ENGINE-IDENTITY-SCHEMA, TCG-001-LEARNING-PACKET-PROTOCOL, TCG-001-LEARNING-AUDIT-LANE-VERIFIER

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
