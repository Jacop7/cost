# TEAM-SERVICE-PORTABLE-IMPLEMENTATION-OPUS-RECHECK-003

- engine: Claude Opus 5 high (Cowork)
- review_kind: direct independent advisory; formal CLI receipt 아님
- reviewed_at: 2026-09-07 Asia/Seoul
- candidate: `TEAM-SERVICE-PORTABLE-IMPLEMENTATION-OPUS-CANDIDATE-003.json`
- candidate_sha256: `3be3c25402c72582892f8c55738eeec2a5171bd122291b1e0b74485a8d4c6650`
- candidate_commit: `c2600cc904ba6b7b7433af05c8b4118289f3be95`
- candidate_tree: `93c5f2d0`
- repository_mutation_by_reviewer: 0
- tests_reexecuted_by_reviewer: 0
- overall_verdict: **PASS**

## 결속 확인

Opus는 `git archive`로 추출한 지정 커밋 트리와 raw blob 바이트만 판정에 사용했다. 후보 SHA, 커밋, 트리, scoped tree 3개(plugin `0d11c983…`, starter kit `b40d3415…`, project contract `073c7a38…`) 및 pinned input 6/6이 모두 일치함을 확인했다. 커밋된 `core.mjs`로 canonical golden 4개, 설치 영수증 schema, 라우팅 67개 requirement/64개 unique route를 독립 재계산해 일치를 확인했다.

## 기존 finding 재판정

| ID | 판정 | 핵심 근거 |
| --- | --- | --- |
| O-1 | CLOSED | `scripts/no-send-harness.mjs` VM/SourceTextModule 기반 실행 관측과 forbidden/dynamic-import 음성 fixture |
| O-2 | CLOSED | host evidence admission schema·경로·SHA·scope·outcome·maximum tier 검증으로 임의 승격 거부 |
| O-3 | CLOSED | 성공 status allowlist 외 종결은 exit 1 |
| O-4 | CLOSED | 절대경로 하드코딩 제거, 이식형 탐색/오버라이드 검증, `INCOMPATIBLE_DEPENDENCY` fail-closed |
| O-5 | CLOSED | plugin 31개와 `.codex/team-service` 21개가 커밋 `c2600cc` 트리에 추적됨 |
| F-a | CLOSED | `verify-install`과 `dry-run` 모두 Router 교차 검증 |
| F-b | CLOSED | `prepare-activation` capability schema 검증 |
| F-c | CLOSED | 67 requirement/64 unique route 의미를 분리해 계약·시험·구현에 일관 반영 |
| F-d | CLOSED | contract와 matrix의 plugin implementation 주장 일치 |
| F-e | CLOSED | AT ID 정렬, AT-15는 rebuild drill blocked로 유지, AT-06/07 실제 시험 존재 |
| F-f | CLOSED | init set 단위 rollback |
| F-g | CLOSED | 프로젝트 계층 산출물과 profile/manifest/Router 3자 coverage 대조 |
| F-h | CLOSED | 미지원 schema keyword fail-closed 및 지원 keyword 실제 집행 |
| F-i | CLOSED | portable runtime 경로와 `TRACKED_RUNTIME_LEAK` 검사 |
| F-j | CLOSED | runtime generation CAS, history 보존, epoch 증가 |
| F-k | CLOSED | 영수증에 cachebuster 포함 plugin version과 manifest SHA 필수 결속 |
| F-l | CLOSED | commit/tree/scoped tree로 재현 표면 전체 결속, portable 30/30과 verify-shell 6/6 수치 추적 가능 |

`OPEN_BLOCKING`: 없음.

## 비차단 후속 finding

1. R-1: 루트 `.gitattributes`에 `.codex/team-service/** text eol=lf` 규칙이 없다. Windows `core.autocrlf=true` 2차 PC drill 전에 적용한다.
2. R-2: `normal_dispatch_attempts`는 0으로 초기화되지만 증가 경로가 없어 반증 불가능하다. transport stub 또는 정확한 파생 명칭으로 보완한다.
3. R-3: `closure_pinned: true`는 리터럴이며 현재 closure는 fixture 3개다. 계약을 fixture closure로 한정하거나 대상 전이 import closure를 결속한다.
4. R-4: `PROBE_ONLY` 단계와 Router consistency 규칙이 충돌해 현재 도달 불가능하다. probe 착수 전 해소한다.
5. R-5: `admission.decision_sha256`은 기록만 되고 실제 Decision과 대조되지 않는다. 동일 principal/관리자는 방어 범위 밖이라는 가정을 계약에 명시한다.
6. R-6: `coverage_evidence_sha256`가 감사 결과가 아닌 edge set SHA를 가리킨다. 감사 outcome을 영수증에 결속한다.
7. R-7: 4개 의존성의 `supported_version` 정책이 아직 `EXACT_UNTIL_COMPATIBILITY_TESTED`다.
8. R-8: `dist/`는 Git 제외이므로 release inventory/zip SHA는 트리 밖 주장이다. export script와 시험으로 재생성 가능해 차단은 아니다.
9. R-9: `exported_plugin_suite: PASS_19_OF_19`는 export 23파일 전체가 아닌 설치 스크립트 자체시험 19개라 라벨이 모호하다.
10. R-10: Router consistency가 현재는 policy/receipt 필드를 추측해 읽는다. 나중에는 Team Router 자체 활성화 검증기와 exact file SHA를 소비해야 한다.

## 판정 범위

이 PASS는 `c2600cc` 커밋의 휴대형 **로컬 구현 후보**만 승인한다. `PHYSICAL_SECOND_PC_VALIDATED`, AT-15, AT-16, `REAL_SEND_AUTHORIZED`, `HOST_AUTHENTICATED`, `SERVICE_READY`, `FORMAL_CLI_REVIEW_RECEIPT`를 승인하지 않는다. 현재 프로젝트의 `RUNTIME_RESTORE_REQUIRED`와 Router `TIER_POLICY_INCONSISTENT` fail-closed 상태를 변경하지 않는다.
