# 휴대형 AI 팀 서비스 구현 후보 001 — Opus 독립 검수

- 검수 방식: direct Opus Cowork 자문
- formal CLI receipt: 아님
- 후보: `TEAM-SERVICE-PORTABLE-IMPLEMENTATION-OPUS-CANDIDATE-001.json`
- 후보 SHA-256: `2385d473d9090d2b8bf27f61e1a7cfaa76e10a90dca37fa116ef908bac4c7a47`
- 대상 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 전체 판정: `CHANGES_REQUIRED`

## 결속 실측

- HEAD `fe96c3c1…` = `target_head` 일치. 후보 SHA `2385d473…c4c7a47` 일치. **inputs 17/17 실측 일치**, design baseline `c06c4b74…`도 일치.
- 배포본 독립 검증: `release-inventory.json`의 28개 파일 **전부 hash 일치·누락 0·미등재 0**, `dist/…/plugins/…` 트리가 `tools/codex-team-service-bootstrap`와 **바이트 동일**, zip 29개 엔트리가 디렉터리와 **내용 동일**. export 경로는 실측으로 재현된다.
- 골든 4벡터를 플러그인 자체 `canonicalJson`으로 독립 재계산: `{"z":[1,2],"é":"café"}`·`{"𝕒":1,"ｚ":2}`·receipt 2건 전부 MATCH. urn `$ref` 교차 해석과 `../escape.json`의 `SCHEMA_PATTERN_FAILED` 거부도 확인.
- 시험 수 대조: `ai:starter-kit:check` = 3+4+11+4 = **22**, 플러그인 단독 = 11+4 = **15**. 시험 suite 자체는 검수자가 재실행하지 않았다.

## requested_decisions

| 결정 | 판정 | 요약 |
| --- | --- | --- |
| `N1_TO_N4_IMPLEMENTATION_ADMISSION_CONDITIONS_CLOSED` | `PARTIAL` | N-1·N-3 닫힘. N-2는 canonical 사본·오류코드·패키지 밖 참조, N-4는 AT-07 미구현 때문에 부분. |
| `EIGHT_COMPONENT_PACKAGE_IMPLEMENTATION_COHERENT` | `NO` | 6/8 정합. 실제 무발송 계층과 일부 프로젝트 산출물·coverage 대조가 없음. |
| `SCHEMA_VALIDATOR_AND_CANONICALIZATION_FAIL_CLOSED` | `PARTIAL` | canonical 합격. validator가 미지원 키워드를 조용히 무시. |
| `INSTALL_UPDATE_EXPORT_PATHS_SAFE_AND_PORTABLE` | `PARTIAL` | 경로 안전성은 양호하나 의존 경로가 PC 고정 절대경로. |
| `TEST_CLAIMS_MATCH_EVIDENCE_WITHOUT_SECOND_PC_OVERCLAIM` | `PARTIAL` | 2차 PC 미검증 표기는 정직하나 AT ID·PASS 주장·claim 간 불일치. |
| `CURRENT_ROUTER_TIER_INCONSISTENCY_HANDLED_SAFELY` | `PARTIAL` | `verify-install`은 거부하지만 exit 0이고 `dry-run`은 교차검사 없음. |
| `READY_FOR_NEXT_LOCAL_IMPLEMENTATION_ITERATION` | `YES_CONDITIONAL` | O-5를 먼저 닫고 O-1~O-4를 다음 회차에서 수정. |

## blocking_findings

### O-1 — 실제 무발송 harness 부재

`team-service.mjs`가 세 계수와 `NO_DISPATCH:fetch`를 상수로 반환한다. closure pin, builtin allowlist, fs stub, dynamic import 거부, 음성 fixture를 실제로 실행하는 `scripts/no-send-harness.mjs`가 필요하다.

### O-2 — 임의 host evidence로 tier 승격 가능

임의 JSON의 네 문자열이 `ATTESTED`이면 `AUTHENTICATED`를 봉인할 수 있다. 증거 schema, 계약에 pin된 HOST-SCOPE 결과 SHA, 저장소의 음성 결과와 모순 검사가 필요하며 불일치·음성은 `LOCAL_CORE_ONLY`로 고정해야 한다.

### O-3 — 실패 상태 exit 0

`TIER_POLICY_INCONSISTENT`, `RUNTIME_RESTORE_REQUIRED`, `DRIFTED_OR_INCOMPLETE`, `INIT_REFUSED_CONFLICT`, `MIGRATION_REFUSED_*`가 성공 종료코드로 끝난다. 허용 성공 상태 외에는 non-zero로 종료해야 한다.

### O-4 — 의존 경로 하드코딩·호환 실패폐쇄 부재

네 의존성 루트가 `C:\Codex-AI-Operations\…`로 고정되어 다른 PC에서 모두 unavailable이어도 doctor·runtime 봉인이 진행된다. 탐색 가능한 설정/환경 계약과 `INCOMPATIBLE_DEPENDENCY` 중단, AT-07 실제 시험이 필요하다.

### O-5 — 구현 산출물 미추적

`tools/codex-team-service-bootstrap/`, `.codex/team-service/`가 Git 미추적이고 `dist/`는 ignore다. 추적되어야 하는 source/project 계층을 먼저 정확한 파일 집합으로 커밋해야 한다. 배포 ZIP은 해시 증거로 관리하되 source/project 정본과 혼동하지 않는다.

## nonblocking_followups

- F-a: `dry-run`에도 Router 교차검사 추가.
- F-b: `prepare-activation`에서 capability policy schema 검증.
- F-c: `67`이 메시지-kind 삼중항 수인지 중복 병합 논리 edge `64`인지 명확히 분리.
- F-d: acceptance matrix와 portable contract의 `plugin_implemented`·status 정합화.
- F-e: contract/matrix/test의 AT ID를 1:1로 연결하고 AT-06·AT-07·AT-15 의미 복구.
- F-f: `applyInit` set 단위 롤백 또는 계약 수정.
- F-g: 프로젝트 계층의 `compatibility.json`, `acceptance.json`, `CURRENT.json`, `known-open.json` 생성.
- F-h: 미지원 schema keyword를 `UNSUPPORTED_SCHEMA_KEYWORD`로 거부.
- F-i: runtime 루트 계약과 구현 일치, LocalAppData 검증, tracked root 내부 runtime 파일 0 검사.
- F-j: `init-runtime` 재실행 CAS·이력 보존.
- F-k: 설치 cachebuster는 runtime 증거로만 두고 정본 버전과 혼동하지 않도록 pin 규칙 마련.
- F-l: 다음 후보에 22/22를 재현하는 설계 시험·schema·golden·profile을 모두 pin.

## 최종 결론

- `overall_verdict`: `CHANGES_REQUIRED`
- `ready_for_next_local_iteration`: `YES`, 단 O-5 선행
- 승인하지 않은 범위: `PHYSICAL_SECOND_PC_VALIDATED`, `AT-16`, `REAL_SEND_AUTHORIZED`, `HOST_AUTHENTICATED`, `SERVICE_READY`, `FORMAL_CLI_REVIEW_RECEIPT`
- 이 자문은 `CURRENT`의 어떤 단계 gate도 변경하지 않는다.
