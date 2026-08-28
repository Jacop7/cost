# 팀 학습 장부

이 파일은 업무 원본·결정·Finding·시험을 복제하지 않는다. 반복 작업에 재사용할 수 있는 교훈의
식별자와 근거 링크만 소유한다. 제품 정책과 도메인 명세의 권위는 `AGENTS.md`와 주제별 단일 출처
문서에 있으며, 이 장부만으로 정책을 바꿀 수 없다.

상태는 `CANDIDATE → VERIFIED → RETIRED`만 허용한다. `VERIFIED`만 신규 protocol 1.2 Task에
주입할 수 있고, `review_by`가 지난 항목·서로 충돌하는 항목·`CANDIDATE`·`RETIRED`는 실행기가
거부한다. 독립 종합 감사와 최초 보안 감사에는 학습 컨텍스트를 주입하지 않는다.

## 기계 계약

아래 JSON 블록은 `scripts/fable-review.mjs`가 대상 commit에서 직접 읽는 계약이다. 필드 이름이나
표식을 손으로 느슨하게 바꾸지 않는다.

<!-- team-learning-registry:v1 -->
```json
{
  "schema_version": "1.0",
  "learnings": [
    {
      "learning_id": "LRN-ORCH-CI-001",
      "team_lane": "ORCHESTRATION",
      "status": "VERIFIED",
      "source_evidence": [
        "docs/브랜치-DB-운영-기획안.md §8.2",
        "docs/작업큐.md AI-REVIEW-2 완료 결과",
        "commit b196cda2f2363f5bb8e49ea8abbb1c9a0e9141fe"
      ],
      "context_trigger": "짧은 작업 브랜치를 main으로 옮기기 직전",
      "previous_approach": "원격 CI가 queued 또는 in_progress인데도 로컬 통과 보고만으로 main을 움직일 수 있었다.",
      "reusable_rule": "정확한 feature HEAD의 원격 CI가 completed/success인지 확인한 뒤에만 main을 fast-forward하고, 같은 SHA의 main CI도 기록한다.",
      "scope": "GitHub Actions를 사용하는 저장소 브랜치 통합과 감사 기록",
      "forbidden_reuse": "로컬 전체 verify를 생략하거나 운영 배포 승인을 대신하는 근거로 사용하지 않는다.",
      "validation_evidence": [
        "feature run 33200096885 success",
        "main run 33200297124 success",
        "main=origin/main=b196cda 실측"
      ],
      "independent_verifier": "CODEX",
      "promotion_targets": ["task_packet", "runbook"],
      "owner": "AI-DEPUTY-ORCHESTRATOR",
      "reviewed_on": "2026-08-29",
      "review_by": "2027-02-28",
      "invalidation_condition": "보호 ruleset이 main 반영과 exact-SHA 필수 체크를 원자적으로 강제하거나 CI 제공자가 바뀔 때",
      "conflicts_with": [],
      "reuse_count": 1,
      "outcomes": ["AI-REVIEW-2에서 feature·main 동일 SHA CI 성공 뒤 선형 통합"],
      "regressions": []
    },
    {
      "learning_id": "LRN-CODEX-TIME-001",
      "team_lane": "CODEX",
      "status": "VERIFIED",
      "source_evidence": [
        "docs/작업큐.md TEST-1 완료 결과",
        "packages/db/tests/_prelude.sql",
        "packages/db/tests/30_state_transitions.sql",
        "commit 3a9f2d1"
      ],
      "context_trigger": "영업시간·현지 날짜·자동 마감 시험이 현재 벽시각에 따라 실패할 때",
      "previous_approach": "제품의 늦은 개점 오류를 시험에서 무시하거나 사람이 영업일을 되열어 초록을 만들었다.",
      "reusable_rule": "시간 경계를 fixture로 강제하고 제품과 같은 정식 상태 전이 경로를 사용하며, 준비 헬퍼의 사후조건과 사보타주로 판별력을 확인한다.",
      "scope": "DB 상태 전이·시간대·영업일 회귀시험의 fixture 준비",
      "forbidden_reuse": "제품의 45015 LATE_OPEN 계약을 약화하거나 운영 함수에 시험 전용 우회를 추가하지 않는다.",
      "validation_evidence": [
        "DB 32/32 야간 재실행",
        "45015 폴백 제거·다른 날 종료 제거·옛 예외 구조 사보타주 적중",
        "corepack pnpm verify 6/6"
      ],
      "independent_verifier": "ORCHESTRATION",
      "promotion_targets": ["test", "task_packet"],
      "owner": "CODEX-FUNCTION-QA",
      "reviewed_on": "2026-08-28",
      "review_by": "2027-02-28",
      "invalidation_condition": "영업일 상태 전이 API 또는 late-open 계약이 바뀔 때",
      "conflicts_with": [],
      "reuse_count": 1,
      "outcomes": ["실행 시각과 무관한 DB 준비 경로와 전체 검증 통과"],
      "regressions": []
    },
    {
      "learning_id": "LRN-OPS-BACKUP-001",
      "team_lane": "OPERATIONS",
      "status": "VERIFIED",
      "source_evidence": [
        "docs/작업큐.md P1-2 로컬 개발 DB 장부 정상화 결과",
        "commit 2062772"
      ],
      "context_trigger": "개발 DB 재구축처럼 되돌리기 어려운 로컬 데이터 작업 전",
      "previous_approach": "MSIX 가상화 경로의 백업을 일반 LOCALAPPDATA 경로로 오인해 복구 파일을 찾지 못했다.",
      "reusable_rule": "백업은 일반 셸에서도 보이는 물리 경로로 이동하고 크기·SHA-256·PGDMP 헤더·pg_restore TOC를 대조한 뒤 원본 가상화 사본을 정리한다.",
      "scope": "로컬 개발 DB의 파괴적 재구축 전 백업 검증",
      "forbidden_reuse": "운영 백업·PITR·복구 훈련이 완료됐다는 증거로 사용하지 않는다.",
      "validation_evidence": [
        "dump 1,026,360 bytes",
        "SHA-256 84C3…00A6 대조",
        "PGDMP header와 pg_restore TOC 987 확인"
      ],
      "independent_verifier": "CODEX",
      "promotion_targets": ["runbook"],
      "owner": "SOLAR-OPS",
      "reviewed_on": "2026-08-28",
      "review_by": "2026-11-30",
      "invalidation_condition": "Codex 설치 방식·Windows 파일 가상화·백업 형식이 바뀔 때",
      "conflicts_with": [],
      "reuse_count": 0,
      "outcomes": ["개발 DB migration 장부 161/161 정상화 전에 복구 가능한 dump 확보"],
      "regressions": []
    },
    {
      "learning_id": "LRN-AUDIT-PIN-001",
      "team_lane": "INDEPENDENT-AUDIT",
      "status": "CANDIDATE",
      "source_evidence": [
        "docs/ai-review/tasks/AI-REVIEW-2-FALLBACK-CONTINUITY-SECURITY-005/rounds/r001/review.json",
        "finding SEC-FB-SEC005-FIXTURE-SET-AND-PIN-RESIDUAL",
        "commit 44275a9"
      ],
      "context_trigger": "fallback successor fixture가 predecessor 증거와 모든 handoff 변조를 실제로 재는지 검토할 때",
      "previous_approach": "핵심 pin은 검사했지만 fixture 증거 집합과 from_task_id·handoff 뒤 추가 수동 턴 변조가 남았다.",
      "reusable_rule": "감사 fixture가 읽는 모든 제어 파일을 evidence 집합에 포함하고, 승계 pin마다 단독 변조와 handoff 이후 append 변조를 부정 시험으로 둔다.",
      "scope": "fable-review fallback successor와 감사 fixture 내구성",
      "forbidden_reuse": "현재 AI-REVIEW-2 PASS를 뒤집거나 제품 보안 결함으로 확대 해석하지 않는다.",
      "validation_evidence": [],
      "independent_verifier": "CODEX",
      "promotion_targets": ["test", "template"],
      "owner": "AI-DEPUTY-ORCHESTRATOR",
      "reviewed_on": "2026-08-29",
      "review_by": "2026-10-31",
      "invalidation_condition": "fallback successor 계약이나 fixture 구성이 바뀔 때",
      "conflicts_with": [],
      "reuse_count": 0,
      "outcomes": [],
      "regressions": []
    }
  ]
}
```
<!-- /team-learning-registry:v1 -->

## 운영 규칙

- 새 항목은 원본 증거를 링크하고 `CANDIDATE`로 시작한다.
- 반대 팀 레인이 재현성과 과잉 일반화를 검토하고, 두 번째 작업 또는 회귀시험에서 효과가 확인돼야
  `VERIFIED`로 승격한다.
- 정책을 바꾸는 항목은 사람 결정과 권위 문서 반영 전까지 `VERIFIED`여도 정책이 아니다.
- 매 5개 완료 Task 또는 주요 게이트마다 `review_by`, 충돌, 재사용 결과와 회귀를 검토한다.
- 환경·정책 변경으로 조건이 깨진 항목은 즉시 `RETIRED`로 바꾸고 적용 Task에서 제외 사유를 남긴다.
