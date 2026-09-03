# AI-ORCH-STAGE9-COMPACT-RECOVERY-032 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `84004577d060a8c4b8bcc1048dc1003a451410e3`

## 요약

축소 복구 감사(target 8400457) 결과 CHANGES_REQUIRED. 범위 준수: Task028 PASS 영역은 재감사하지 않았고, Task030 실패 원본(budget_exhausted·verdict null·USD 7.502960)과 Task031의 provider 이전 중단 staging은 계보 보존 확인에만 사용했으며 PASS나 Finding 판정 근거로 재사용하지 않았다. (1) checker 보강: Task028 Improvement 2건이 반영되어 INVALID_CONTEXT_BINDING(route 비어있지 않은 문자열·policy_hash 64hex), CONTEXT_HASH_MISMATCH 직접 변조 사보타주, RETIRED Learning 폐기 Decision 결속(INVALID_RETIRED_MIGRATION)이 실패 폐쇄로 구현됐고 사보타주 시험은 정확히 12건으로 증거 주장 12/12와 정합한다. activation 모드 검사 파일 수(기획안 5+중앙 6+역할 5+팀 6+운영 7=29)와 레지스트리 19개 A0 컨텍스트도 코드·문서와 일치한다. (2) 운영 진입점 7개는 OPERATIONS_PATHS와 1:1이고 activation 모드에서 부재와 조기 POSTMORTEMS를 실패 폐쇄하며, 문서들은 정책·자격증명 복제 없이 링크만 소유하고 운영 적용·위험 수용·사고 종결은 사람 게이트를 유지한다. (3) RISKS.md는 소유 미수렴으로 부재하며 UNOWNED_RISKS/MISSING_RISKS 양방향 검사와 사보타주가 있다. (4) 역할/팀 manifest의 context_refs가 레지스트리 hash와 문자열 단위로 일치하고, chat_is_approval_authority false·통합 플러그인·공용 hook·모델 selector 권한 부재를 확인했으며, 외부 상태 증거는 두 section·11개 제목·개수만 기록하고 thread ID·대화 원문·계정 식별자를 저장하지 않는다. (5) 유일한 필수 Finding(Minor): 디렉터리 기획안이 frontmatter(status: ACTIVE)와 헤더(활성 권위·DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027)에서 활성을 선언하면서 §0 본문은 '이 문서는 DRAFT다… 현재 권위 경로는 AGENTS.md와 팀 구성안 §0이 소유한다'를 유지해, activation commit 이후 자기 상태 모순이 남았다. checker는 frontmatter만 읽으므로 기계 검사가 잡지 못하는 원자 활성화의 내용 수준 부분 활성화이며, reference 경로이므로 별도 정정 Task를 요청한다. Improvement 1건: 증거 문서 §5 누적 실비 USD 9.015106이 Task030 실패 비용을 반영하지 않아 계보가 실제 누적 USD 16.518066보다 적다(제안 편집 첨부; 실패 재판정이 아니라 계보 완결성 문제). 실행 수치(graph PASS 29/19·사보타주 12/12·network 71/71)는 SOLAR 실행 주장으로 정적 정합만 확인했고 재현은 CODEX-FUNCTION-QA가 담당한다. 본 결과는 외부 게이트를 닫지 않으며 단계 10 연결·운영 실행·배포를 승인하지 않는다.

## Findings

### ARCH-032-DIR-ACTIVE-SELF-DRAFT — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: 활성 권위 문서가 본문에서 자기 권위를 부정해, 새 채팅·역할이 디렉터리 규칙(§9 이동 계약, §14 금지 패턴 등)을 비활성으로 오독하고 다른 권위 경로를 탐색할 수 있다. checker는 frontmatter status만 검사하므로 이 내용 모순을 잡지 못하며, 원자 활성화 불변식의 내용 수준 부분 활성화가 activation 증거에 남는다.
- 근거: docs/디렉터리-문서신경망-재설계-기획안.md:1, docs/디렉터리-문서신경망-재설계-기획안.md:33, docs/team/DECISIONS.md:6
- 완료 조건: 별도 정정 Task에서 §0 두 번째 문단을 ACTIVE 상태·DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027 기준의 현재형 서술로 갱신한다 / 문서 전체에서 현재 상태를 부정하는 잔여 DRAFT 자기선언이 0건임을 확인한다 / (선택) status: ACTIVE 문서 본문의 DRAFT 자기선언을 실패 폐쇄하는 checker 보강을 검토한다
- 필요한 테스트: (checker 보강 시) frontmatter ACTIVE와 본문 '이 문서는 DRAFT다' 공존 fixture의 부정 시험 1건

### ARCH-032-EVIDENCE-COST-LINEAGE-STALE — Improvement / OPEN

- 범주: DATA_INTEGRITY
- 영향: 단계 9 공식 증거 문서만으로는 실패 비용 계보를 복원할 수 없다. 실제 누적 Fable 실비는 6.338000+2.677106+7.502960=USD 16.518066으로 문서 기록보다 USD 7.502960 많다. 원본 run.json·공동 장부가 진실을 보존하므로 차단성은 아니다.
- 근거: docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE.md:98, docs/ai-review/tasks/AI-ORCH-PLANS-STAGE-9-EXACT-SHA-SUCCESSOR-030/rounds/r001/run.json:7
- 완료 조건: 증거 문서 §5에 Task030 실패 원본과 Task031 provider 이전 중단 staging을 추가하고 누적 실비를 USD 16.518066으로 갱신한다 / 본 Task032 실비는 run 종료 후 같은 계보 형식으로 추가한다
- 필요한 테스트: 없음

## 공동 편집 제안

### EDIT-032-COST-LINEAGE-UPDATE — REPLACE

- 대상: `docs/ai-review/evidence/AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE.md`
- 위치: - 단계 9 현재 누적 Fable 실비: USD `9.015106`
- 연결 Finding: ARCH-032-EVIDENCE-COST-LINEAGE-STALE
- 이유: 같은 tree에 보존된 Task030 실패와 Task031 중단 staging을 공식 비용 계보에 반영해 증거 문서 단독으로 실패 비용 계보를 복원할 수 있게 한다.

    - `AI-ORCH-PLANS-STAGE-9-EXACT-SHA-SUCCESSOR-030/r001`: `budget_exhausted`, 판정 없음, 실제 USD
      `7.502960`; 실패 원본 보존
    - `AI-ORCH-STAGE9-COMPACT-FINAL-031`: provider 호출·run.json·비용 기록 전 중단된 staging으로 보존
    - 단계 9 현재 누적 Fable 실비: USD `16.518066` (Task032 축소 복구 감사 실비는 run 종료 후 추가)

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: ARCH-032-DIR-ACTIVE-SELF-DRAFT

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
