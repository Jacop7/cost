# 휴대형 AI 팀 서비스 설계 최종 재검수 004

- 검수 방식: direct Fable Cowork 자문
- formal CLI receipt: 아님
- 대상 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 후보: `TEAM-SERVICE-PORTABLE-PACKAGE-RECHECK-CANDIDATE-004.json`
- 후보 SHA-256: `7948fb3da3012f359b9860a993518fe21467f69c0c8126bddc6cd0c2253d657d`
- 저장소 수정·시험 재실행: 없음

## 최종 판정

- `overall_verdict`: `DESIGN_ACCEPTABLE`
- `blocking_findings`: 없음
- `rebuild_blueprint_sufficient`: `YES`
- `ready_for_separate_implementation_admission`: `YES` — 별도 구현 입장 회차를 열 수 있다는 뜻이며 구현·설치·발송 승인이 아니다.

## 결속 실측

- HEAD `fe96c3c1…`와 `target_head`가 일치했다.
- 후보 SHA `7948fb3d…d657d`가 일치했고 inputs 12/12를 실측 일치시켰다.
- `scripts/portable-team-service-design.test.mjs`는 `node:test` 4건(PORTABLE-01~04), skip 없음, 외부 의존 0인 설계 검사임을 소스에서 확인했다.
- 시험은 재실행하지 않았고 golden 4벡터를 독립 재계산했다.
  - `CANONICAL-NFC-SORT-001`: `{"z":[1,2],"é":"café"}` / `5f65a471…` 일치
  - `CANONICAL-UTF16-ASTRAL-002`: `{"𝕒":1,"ｚ":2}` / `c55afa73…` 일치
  - `RECEIPT-CANONICAL-001`: `a44e5bef…` 일치
  - `INSTALL-RECEIPT-SCHEMA-001`: `8671ee5c…` 일치

## 요청 판정

1. `G1_UTF16_CANONICAL_GOLDEN_AND_ASTRAL_VECTOR_CLOSED`: **YES**
   - UTF-16 code-unit 기준 ECMAScript `<`/`>` 정렬, astral 주석, `workflow.mjs#canonicalJson` 참조가 명문화됐다.
   - PORTABLE-01은 참조 구현 실행 결과와 expected text/hash를 각각 대조한다.
2. `G2_AC24_NO_SEND_COUNTER_VOCABULARY_CLOSED`: **YES**
   - `normal_dispatch_attempts=0`, `negative_fake_attempts>0`, `actual_provider_calls=0`으로 AC-24 어휘와 일치한다.
3. `SCHEMA_VALID_RECEIPT_AND_DEPENDENCY_FREE_SEMANTIC_TEST_SUFFICIENT`: **YES**, 설계 단계 기준
   - receipt 필수 16필드, 추가필드 0, pattern/enum, 4개 dependency observation, generated file 항목을 수동 대조했다.
   - PORTABLE-03은 JSON Schema 전체 검증기가 아니므로 구현 입장 때 실제 검증기 실행이 필요하다.
4. `NONBLOCKING_FOLLOWUPS_CLOSED_OR_DEFERABLE`: **YES**
   - schema-valid receipt 벡터, 의존성 없는 의미 검사, 경로 패턴 거부, Mission Relay 경로 패턴, Quality 비권한 의미, `VERIFIED_STATUS` 비대칭 설명이 반영됐다.
   - `supported_version: EXACT_UNTIL_COMPATIBILITY_TESTED`는 AT-07 때 확정한다.
5. `FULL_LOSS_REBUILD_BLUEPRINT_SUFFICIENT`: **YES**
   - 정본 우선순위, 실체 파일, 소스 트리, 구성요소별 입력·출력·실패폐쇄, 재제작 순서, 유실 유형별 복구, AT-01~17, exact SHA 완료 증거가 갖춰졌다.
   - 원시 대화·스크린샷·PC 절대경로는 재제작 입력에서 제외된다.
6. `OVERALL_DESIGN_ACCEPTABLE`: **YES** — 차단 결함 0.
7. `READY_FOR_SEPARATE_IMPLEMENTATION_ADMISSION`: **YES** — 아래 N-1~N-4를 구현 입장 후보의 입력 조건으로 넘긴다.

## 구현 입장 이관 조건

- **N-1 — JSON Schema `$ref` 해석:** `generated-files.schema.json#/$defs/file` 상대 참조와 대상의 `urn:` `$id`를 실제 검증기가 해석할 수 있도록 `$id` 참조 또는 명시적 로더 계약을 사용한다.
- **N-2 — canonical 구현 단일화:** 시험 사본 대신 참조 모듈을 import하거나 symbol key를 `UNSUPPORTED`로 계약해 `getOwnPropertySymbols()` 동작 차이를 없앤다.
- **N-3 — rebuild input 수 일치:** contract 6개와 `REBUILD-BLUEPRINT.md` 7개 중 하나로 통일한다. 권고는 contract에 설계 시험 스크립트를 추가하는 것이다.
- **N-4 — 호환 범위·오류 대응:** AT-07에서 `supported_version` 범위를 확정하고 `REJECT_FORBIDDEN_GLOBAL_CALL`과 `NO_DISPATCH:fetch`의 대응표를 둔다.

## 범위 제한

`PLUGIN_IMPLEMENTED`, `PLUGIN_INSTALLED`, `SECOND_PC_VALIDATED`, `REAL_SEND_AUTHORIZED`, `HOST_AUTHENTICATED`, `SERVICE_READY`는 모두 여전히 `false`다. 이 자문은 CURRENT gate, P2b~P5, Router, 앱, DB, Supabase 또는 실제 전송을 승인하지 않는다.
