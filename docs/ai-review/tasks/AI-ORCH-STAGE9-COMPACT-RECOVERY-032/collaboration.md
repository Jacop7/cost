# AI-ORCH-STAGE9-COMPACT-RECOVERY-032 공동 작업 장부

> Task031의 provider 이전 중단 staging은 원본으로 보존한다. 이 Task는 같은 target을 읽기 전용으로 한 번만 감사한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `84004577d060a8c4b8bcc1048dc1003a451410e3`
- predecessor_failure: `Task030/r001 budget_exhausted, verdict null, actual USD 7.502960`
- interrupted_attempt: `Task031은 provider 호출·run.json·비용 기록 전 중단된 staging만 보존한다.`
- historical_pass: `Task028/r001 d245477ada7561e49f4bc42de29c5b4ff832460fc82ba7102cf5138aceab2ff7`
- 요청: Task028 이후 checker 보강, 운영 진입점, activation·외부 상태·plugin 증거만 축소 감사한다. 이미 PASS한 preflight 전체 설명을 반복하지 않는다.
- 집중 검토: hash·Learning 실패 폐쇄, A0·사람 게이트, 통합 plugin/selector 권한 부재, 비식별 외부 상태, 실패 비용 계보.
- 판정 계약: 필수 OPEN Finding이 없으면 요약을 간결히 하고 PASS를 반환한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE9-COMPACT-RECOVERY-BUDGET-032`
- task_budget_usd_approved: `6.00`
- soft_budget_overrun_risk_accepted: `r001@6.00`
- 결정: 사용자의 자동 진행·Fable 필수검수·예산 재량 위임과 재부팅 뒤 재개 지시에 따라, Task031의 provider 이전 중단 staging을 보존하고 같은 target의 축소 final audit을 1회 실행한다.
- 위험 고지: USD 6.00은 soft cap이며 실제 결제 하드캡이 아니다.
- 허용 범위: target 8400457의 Task028 이후 변경분과 최소 권위 참조의 읽기 전용 감사.
- 금지: 동일 목적 Opus, 추가 자동 재시도, 제품·DB·배포·UI 변경, 단계 10 연결.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=791798d4f6ac2a268030ce888d0966f6b06d2bccf262de5619043c870ee697ce -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `791798d4f6ac2a268030ce888d0966f6b06d2bccf262de5619043c870ee697ce`
- target_commit_sha: `84004577d060a8c4b8bcc1048dc1003a451410e3`
- input_files_sha256: `727f9b9b0900b49caf3052019736877cd2f337c96e8549bee759d74d5b901d06`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: ARCH-032-DIR-ACTIVE-SELF-DRAFT
- 선택 미종결 Finding: ARCH-032-EVIDENCE-COST-LINEAGE-STALE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

축소 복구 감사(target 8400457) 결과 CHANGES_REQUIRED. 범위 준수: Task028 PASS 영역은 재감사하지 않았고, Task030 실패 원본(budget_exhausted·verdict null·USD 7.502960)과 Task031의 provider 이전 중단 staging은 계보 보존 확인에만 사용했으며 PASS나 Finding 판정 근거로 재사용하지 않았다. (1) checker 보강: Task028 Improvement 2건이 반영되어 INVALID_CONTEXT_BINDING(route 비어있지 않은 문자열·policy_hash 64hex), CONTEXT_HASH_MISMATCH 직접 변조 사보타주, RETIRED Learning 폐기 Decision 결속(INVALID_RETIRED_MIGRATION)이 실패 폐쇄로 구현됐고 사보타주 시험은 정확히 12건으로 증거 주장 12/12와 정합한다. activation 모드 검사 파일 수(기획안 5+중앙 6+역할 5+팀 6+운영 7=29)와 레지스트리 19개 A0 컨텍스트도 코드·문서와 일치한다. (2) 운영 진입점 7개는 OPERATIONS_PATHS와 1:1이고 activation 모드에서 부재와 조기 POSTMORTEMS를 실패 폐쇄하며, 문서들은 정책·자격증명 복제 없이 링크만 소유하고 운영 적용·위험 수용·사고 종결은 사람 게이트를 유지한다. (3) RISKS.md는 소유 미수렴으로 부재하며 UNOWNED_RISKS/MISSING_RISKS 양방향 검사와 사보타주가 있다. (4) 역할/팀 manifest의 context_refs가 레지스트리 hash와 문자열 단위로 일치하고, chat_is_approval_authority false·통합 플러그인·공용 hook·모델 selector 권한 부재를 확인했으며, 외부 상태 증거는 두 section·11개 제목·개수만 기록하고 thread ID·대화 원문·계정 식별자를 저장하지 않는다. (5) 유일한 필수 Finding(Minor): 디렉터리 기획안이 frontmatter(status: ACTIVE)와 헤더(활성 권위·DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027)에서 활성을 선언하면서 §0 본문은 '이 문서는 DRAFT다… 현재 권위 경로는 AGENTS.md와 팀 구성안 §0이 소유한다'를 유지해, activation commit 이후 자기 상태 모순이 남았다. checker는 frontmatter만 읽으므로 기계 검사가 잡지 못하는 원자 활성화의 내용 수준 부분 활성화이며, reference 경로이므로 별도 정정 Task를 요청한다. Improvement 1건: 증거 문서 §5 누적 실비 USD 9.015106이 Task030 실패 비용을 반영하지 않아 계보가 실제 누적 USD 16.518066보다 적다(제안 편집 첨부; 실패 재판정이 아니라 계보 완결성 문제). 실행 수치(graph PASS 29/19·사보타주 12/12·network 71/71)는 SOLAR 실행 주장으로 정적 정합만 확인했고 재현은 CODEX-FUNCTION-QA가 담당한다. 본 결과는 외부 게이트를 닫지 않으며 단계 10 연결·운영 실행·배포를 승인하지 않는다.

### 공동 편집 제안 색인

- EDIT-032-COST-LINEAGE-UPDATE: REPLACE `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE.md` · - 단계 9 현재 누적 Fable 실비: USD `9.015106` · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `791798d4f6ac2a268030ce888d0966f6b06d2bccf262de5619043c870ee697ce`
- target_commit_sha: `84004577d060a8c4b8bcc1048dc1003a451410e3`
- changed_artifact_paths: `docs/디렉터리-문서신경망-재설계-기획안.md, docs/AI-품질-학습-자율성-평가기획안.md, docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE.md, docs/작업큐.md, scripts/docs-graph-check.mjs, scripts/docs-graph-check.test.mjs, .gitattributes`

### ARCH-032-DIR-ACTIVE-SELF-DRAFT

- disposition: `APPLIED`
- 적용 내용: 디렉터리·품질 기획안 §0의 현재형 DRAFT 자기선언을 ACTIVE·activation Decision 기준의 단일 권위 서술로 교체했다. graph checker가 ACTIVE 본문의 `이 문서는 DRAFT다.`를 실패 폐쇄하도록 추가하고 부정 fixture를 보강했다.

### ARCH-032-EVIDENCE-COST-LINEAGE-STALE

- disposition: `APPLIED`
- 적용 내용: Task030 실패 USD 7.502960, Task031 provider 이전 중단, Task032 r001 실비 USD 3.568507을 증거 계보에 추가해 누적 USD 20.086573으로 정정했다.

- CODEX_EVIDENCE: `node scripts/docs-graph-check.mjs --activation` PASS 29/19; `node --test scripts/docs-graph-check.test.mjs` 13/13 PASS; `corepack pnpm ai:plans:simulate` 71/71 PASS; Project Orchestrator model plan VERIFIED.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-s002`
- finding_ids: `ARCH-032-DIR-ACTIVE-SELF-DRAFT`, `ARCH-032-EVIDENCE-COST-LINEAGE-STALE`
- decision_id: `DEC-AI-STAGE9-COMPACT-RECOVERY-RECHECK-BUDGET-033`
- soft_budget_overrun_risk_accepted: `r002@2.40`
- 결정: 사용자의 자동 진행·Fable 필수검수·예산 재량 위임에 따라 Task032 r001 실비 USD 3.568507 뒤 task cap USD 6.00의 남은 범위 안에서 Finding 두 건과 변경 diff만 r002로 재검수한다.
- 위험 고지: USD 2.40은 soft cap이며 실제 결제 하드캡이 아니다.
- 허용 범위: 두 Finding, 변경된 현재 bytes, 실행 증거의 읽기 전용 재검수 1회.
- 금지: 동일 회차 중복 호출, 추가 자동 재시도·증액, 동일 목적 Opus, 제품·DB·배포·UI 변경.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_RECHECK`
