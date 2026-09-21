# 팀서비스 자동흐름 구현계획 v0.8.1 · 읽기 전용 자문 재검수

> 작성: 2026-09-05 · 검수자: Claude (Cowork, 같은 세션 이어서 — v0.7 → v0.8 → v0.8.1)
> 성격: **자문 검수.** typed formal gate(Fable/Opus)를 대체하지 않으며 formal receipt를 작성하지 않았다.
> 이번 회차 수행 0건: 제품 파일 수정 · 시험 실행 · 팀 전송 · 정책/DB 변경 · 세션 로그(rollout) 열람 · 원시 대화/endpoint 읽기.
> 권위 루트 `C:/Users/jacop/프로젝트/식자재관리앱` · HEAD `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076` · v0.8.1은 HEAD 위 **미커밋 작업본**(commit v0.8.1 아님)

---

## (1) 판정

| 축 | 판정 |
|---|---|
| **자문 판정 (계획 문서 수준)** | **PLAN_ACCEPTABLE** — 계획 확정을 막는 결함 없음. 비차단 정정 권고 P2 5건(F-12~F-16) |
| **formal gate** | **NOT_PASSED / NOT_PERFORMED** — CURRENT `FORMAL_INDEPENDENT_REVIEW: NOT_PASSED`, `fable_opus_formal_review: NOT_PERFORMED` 그대로. 이 자문은 그 자리를 채우지 않는다 |
| **구현 착수 (LC-ADMISSION)** | **BLOCKED** — 계획 결함이 아닌 실행 조건 미충족 (아래 §4) |
| **운영/발송** | **CLOSED** — send gate 닫힘, 협력형 미채택, host 음성 유지 |

v0.7 차단 3건(F-1~F-3)과 v0.8 차단 1건(F-8)은 문서·기계 계약 양쪽에서 닫혔다. v0.8.1의 남은 것은 상태 정본의 표기 정합 4건과 schema 문서화 1건이며, 어느 것도 gate 값이나 경로 존재를 바꾸지 않는다. 따라서 이 판본은 **동결 후 formal 회차의 입력으로 쓸 수 있는 상태**라고 본다 — 단, 아래 P2를 같은 판본에서 고치면 formal 회차가 같은 지적을 반복하지 않는다.

---

## (2) 입력 무결성 — 실측

| 항목 | 결과 |
|---|---|
| `TEAM-SERVICE-FLOW-V081-CANDIDATE.json` SHA256 | `520a9528…6fb2c` **일치**. `previous_candidate_sha256 = e7eb610b…`(v0.8) 연결 |
| 목록 28개 입력 | **28/28 실측 일치**, 부재 0 |
| HEAD | `22036fb3` 유지. dirty 160 (v0.8 156 → +4: V081 manifest·LOCAL-CHECKS·PREFLIGHT·OBSERVATION 신규) |
| CURRENT.json 내부 pin | **45건 전부 실측 일치** (v0.8 34건 → 45건; scope003 선언·preflight·host_requirements_document·observation 추가) |
| `host-scope-003.json` `baseline[]` 5건 | **전부 일치** (acceptance는 v0.8.1 hash `5636be64…`로 갱신됨) |
| V081-LOCAL-CHECKS `inputs[]` 20건 | **manifest·실제 bytes와 전부 일치** → "36/36"은 이 동결본에서 실행된 기록. TAP `ok` 36 / `not ok` 0, exit 0, `head_unchanged: true`, `inputs_unchanged: true`, typescript 5.9.3 runtime hash 기록 |
| `TEAM-SERVICE-FLOW-V07-COWORK-001.md` | v0.7 검수 원본과 바이트 동일(`6e60ff7c…`) 재확인 |
| `V08-COWORK-OBSERVATION.json` | v0.8 응답의 구조화 관측. `model_attestation: false`, `NOT_VERBATIM_OR_TYPED_RECEIPT` — 제 v0.8 판정(CHANGES_REQUIRED, F-8 차단, F-9~11 P2, 24 hash 일치)과 내용 일치 |

---

## (3) F-1 ~ F-11 잔여 판정

| ID | v0.8.1 상태 | 근거 (파일:위치) |
|---|---|---|
| F-1 착지 경로 결정 미등록 | **해소** | CURRENT `pending_owner_decisions` 3건 유지(D-T2-ADOPT / D-CLOCK-ALT / D-FABLE-SOFTCAP: owner·inputs·default_action·grants_send:false), PLAN-14 기계 검사. 계획 §1 "미결정은 정지, 시간 경과로 승인되지 않는다". F-8 해소로 조건부 꼬리표 제거 |
| F-2 catalog 2축 | **해소** | 24 AC + 2 BF `implementation_status`/`execution_status`, `legacy_status_field: FORBIDDEN`. 전부 NOT_IMPLEMENTED(workflow.test.mjs에 AC 등록 0건 — 정직) |
| F-3 AC-24 순환 | **해소** | `parameterization.kind: EXACT_BUNDLE_PER_GATE`; ADMISSION = workflow.mjs + workflow.test.mjs, `requires_ac22:false`, `requires_driver_store:false`; LC-ADMISSION/BF-COMPLETE/P4 각각 `ac24_run_requirement`. PLAN-13 검사. 순환 없음 |
| F-4 `.codex/team-router` 미추적 | **계획 수준 해소 · 실행 OPEN(운영 조건)** | §3 "기존 계약 후보 · 파일 존재는 활성·복구 보장 아님"; CURRENT `router_preservation`(4파일 hash·owner·due P7/P8·완료 옵션 2종), gate `ROUTER_RECOVERY: BLOCKED`. 참고: dirty인 `docs/team/DECISIONS.md`(DEC-TEAM-ROUTER-ACTIVATE-NON-PROD-001)가 `.codex/team-router/activation-receipt.json`을 승인 영수증 위치로 가리키므로 보존 과제의 우선순위는 유지 |
| F-5 HOST-REQUIREMENTS pin | **해소** | CURRENT `host_requirements_document` = `16437554…` 실측 일치, PLAN-14 재계산 대조 |
| F-6 verify HEAD 결속 | **OPEN — 착수 조건, 계획 결함 아님** | 새 실행 없음, 승격 없음. CURRENT `F-6: OPEN_REQUIRES_NEW_HEAD_VERIFY_AFTER_SHELL_FIX` |
| F-7 §8 표기 | **해소** | "Cowork 검수는 독립 자문, P7 = Fable 기본 + D-FABLE-SOFTCAP 회차별 결속"; `formal_review.reject_routes`에 `COWORK_ADVISORY` |
| **F-8 scope003 선택자** | **해소** | `selector: PINNED_HISTORICAL_ROLLOUT_WITH_EXISTING_SEND_READ_WAIT_CALLS`, `preflight_record` 연결, `start_contract`에 "PREFLIGHT … BEFORE ANALYSIS" · "PINNED BEFORE ANALYTICAL READ". PREFLIGHT: `path_sha256`·`content_sha256`·`bytes 42,341,515`·send/read/wait outer pair 14/16/15·`scope_analysis_started:false`·`send_calls_in_preflight:0`·raw/endpoint export false. `kind: PREFLIGHT_SELECTION_NOT_SCOPE003_FEASIBILITY_OR_ACK`, limitations에 "method-level provenance·ACK·nonce·truncation UNVERIFIED", "PILOT-RESULT-001은 SIMULATED라 선택 안 함" 명시. PLAN-15가 selector·pair>0·analysis_started=false 검사. **성공 경로가 구조적으로 열렸고, preflight를 양성으로 과장하지 않는다** |
| F-9 spec 스냅샷 고정 | **해소** | PLAN-13 `runs=[]` 등호 → `runs[]` 영수증 필드 완비·profile 존재·hash 형식·`result∈{PASS,FAIL,SKIPPED,UNVERIFIED}`·PASS 시 `normal_dispatch_attempts=0`·`negative_fake_attempts>0`·`actual_provider_calls=0`·`evidence_sha256 == hash(evidence_ref)` 검사. HOST-SPEC-05·T2-SPEC-06 등호 → 열거 검사. 첫 실행 기록 시 spec 검사를 고칠 필요 없음 |
| F-10 문자열 includes | **해소** | `availability()`가 typescript AST로 `test(<test_name 리터럴>, …, callback)` 등록을 찾고 callback body 안의 문자열 리터럴에서 assertion_id 수집. PLAN-12 음성 케이스에 주석·TODO 문자열·빈 callback 추가. `test.skip`/PropertyAccess는 미매칭 → 보수적 |
| F-11 scope003 baseline | **해소** | `baseline[]` 5건, PLAN-15 재계산 대조 |

---

## (4) 신규 finding — 전부 P2, 비차단

**F-12 · CURRENT `document_status_note`가 v0.8에 멈춰 있다** — `docs/ai-review/evidence/TEAM-SERVICE-FLOW-CURRENT.json`
"v0.8 is a new repaired candidate pending full recheck"인데 `current_verdict`는 `V081_…`, `candidate_review.version`은 `0.8.1`. CURRENT가 "유일한 정본"이므로 서술 필드도 맞춰야 한다. 한 줄 수정.

**F-13 · `review_history[v0.8].local_checks`가 V081 보고서를 가리킨다** — 같은 파일
v0.8 행의 `local_checks.report = TEAM-SERVICE-FLOW-V081-LOCAL-CHECKS.json`. v0.8 회차의 spec 실행 기록은 `V08-LOCAL-CHECKS.json`(별도 존재)이다. 판본 provenance 오표기. 참조를 V08로 되돌리고 V081은 top-level `local_checks`(이미 그렇게 됨)에만 둔다.

**F-14 · `local_checks.report`에만 sha256 pin이 없다** — 같은 파일
CURRENT의 45개 pin 중 유일하게 `local_checks.report`가 경로만 있다. LOCAL-CHECKS가 CURRENT hash를 입력으로 잡기 때문에 양방향 pin은 순환이 되므로 의도는 이해한다. 대안: `local_checks.stdout_sha256` 또는 `run_started_at`을 적어 "36"이라는 숫자를 그 실행에 결속. 지금은 CURRENT의 36이 hash 없는 자기 진술이다.

**F-15 · `execution_evidence {path, sha256}` 필드가 검사에는 있고 schema 문서에는 없다** — `plan-contract.test.mjs validateCase` ↔ `acceptance.case_status_axes` · 계획 §7
`validateCase`는 `execution_status ≠ NOT_EXECUTED`이면 `execution_evidence.path` + 64-hex sha를 요구하지만 `case_status_axes`·계획 §7 어디에도 그 필드 이름이 없다. 또 case-level `execution_evidence.sha256`은 형식만 검사하고 `hash(path)` 대조는 하지 않는다(PLAN-13의 run-level은 대조함). 첫 PASS 기록 전에 (a) `case_status_axes.execution_evidence` 한 줄 추가, (b) `validateCase`에 `hash(row.execution_evidence.path)` 대조 추가.

**F-16 · candidate manifest가 다른 트랙의 dirty 변경(`package.json`·`pnpm-lock.yaml` playwright 1.62.1 추가)을 동결 입력에 포함한다** — `TEAM-SERVICE-FLOW-V081-CANDIDATE.json`
spec 실행 환경(typescript devDependency)을 고정하려는 의도로 읽히고 그 자체는 무해하다. 다만 이 두 파일의 실제 diff는 `prototype:audit` 스크립트와 playwright 의존성으로 **프로토타입 트랙**의 변경이다. v0.8.1을 커밋할 때 이 변경이 team-service 커밋에 함께 실리면 계획 §6 "다른 작업의 미커밋 파일을 무차별 commit하지 않는다"와 충돌한다. manifest에는 두되, 커밋 분리 지침을 CURRENT `next_safe_action`이나 manifest `policy`에 한 줄 적으면 된다.

---

## (5) 전체 계획 모순 · 입장 게이트 순환 · 근거 과장

**절 간 모순**: 새로 발견하지 못했다. §1(도달 경로·CURRENT 소유) ↔ CURRENT `pending_owner_decisions` / `host_scope_003`, §3(기존 계약 후보) ↔ `router_preservation`, §6(AC-24 번들형) ↔ acceptance `parameterization` + 3개 `ac24_run_requirement`, §7(AST 등록·2축·legacy 금지) ↔ `case_status_axes` + `validateCase`, §8(Cowork 자문 ≠ P7) ↔ `formal_review.reject_routes` — 다섯 쌍이 같은 방향이다. 협력형 계약·HOST-REQUIREMENTS·state-contract는 v0.8과 바이트 동일.

**게이트 순환**: phase DAG(P0∥PH∥LC → P2 → P2b → P3 → P4 → P5 → P6(+PH) → P7(+P0) → P8 → LIVE-PROBE → P9)는 비순환, PLAN-03이 `depends_on` 고정. 협력형 6단계 비순환. **LC-ADMISSION 입장 경로**: AC-24 ADMISSION 프로파일이 기존 `workflow.mjs`·`workflow.test.mjs`(실재)와 PLAN_TEST 산출물인 admission fixture/allowlist만 요구 → P3/P4 산출물 미참조. `no-dispatch.test.mjs` 자체는 NOT_IMPLEMENTED지만 계획 §6이 PLAN_TEST 범위에서 선행 작성을 허용하므로 순환 아님. 공허 통과 방지: `coverage`("omitted module, empty bundle/scenarios, wildcard expansion or source drift rejects") + `pass_rule`(`negative_fake_attempts>0`) + PLAN-13 PASS 조건. 단 이 규칙을 집행하는 검증기는 `assertion_evidence_contract.implemented: false` — 착수 조건.

**근거 과장 검사**: PREFLIGHT는 `NOT_SCOPE003_FEASIBILITY_OR_ACK`, `preflight_counts_are_capture_feasibility: false`, nested/outer 구분(direct 0 · nested_outer 14/16/15)을 그대로 적고 method-level provenance를 UNVERIFIED로 남겼다 — 과장 없음. LOCAL-CHECKS `kind: SPECIFICATION_EXECUTION_NOT_SERVICE_OR_FORMAL_REVIEW`, `scope003_preflight_only: true`. CURRENT `host_scope_003.outcome: null`, `analysis_started: false`. OBSERVATION은 제 응답을 "structured observation, not verbatim/typed receipt"로 표기. 유일한 표기 결함은 F-12/F-13(판본 라벨)이며 gate 값 과장은 아니다.

---

## (6) 남은 조건 — 축 분리

### 계획 확정(formal 입력으로 동결)까지
1. F-12~F-16 정정(전부 한두 줄) → 새 candidate manifest로 재동결(정책 "no same-SHA reuse").
2. 그 SHA에 대한 **formal 회차**: D-FABLE-SOFTCAP 승인 후 Fable typed receipt(또는 정책상 자격 증거가 있는 Opus 승계). Sol·Cowork 자문은 `reject_routes`대로 receipt가 될 수 없다.
3. CURRENT `findings_for_v05[*].review_closure: PENDING` 7건 · `current_findings` `RUNTIME_UNVERIFIED` 10건 · `candidate_review.findings[F-1..F-11].response: APPLIED_PENDING_RECHECK`를 formal 회차 결과로 종결. (이 자문 결과로는 "COWORK_RECHECKED_RESOLVED" 정도까지만 적을 수 있고 formal 종결이 아니다.)

### 구현 착수(LC-ADMISSION)까지 — 계획 결함 아님
AC-24 ADMISSION fixture·allowlist 작성(PLAN_TEST) → 실행 영수증 첫 `runs[]` 기록 → `EXACT_LOCAL_MODEL_SCOPE`(MODEL-DISPOSITION `local_core_scope_gate: NOT_PASSED`) → SHELL 수정 후 HEAD에서 `corepack pnpm verify` 재실행(F-6) → VERIFY-V07 3건 독립 처분 검토(DB 건은 프로토타입 스터디 C14 단서 첨부) → `LOCAL_SCOPE_REVIEW` → `assertion_evidence_contract` 검증기 구현(F-15 (b) 포함).

### 운영·발송 조건
scope003 본조사(PREFLIGHT 뒤, timebox 30분, 종료값 3종) → D-T2-ADOPT(003 결과 선행, 기본 = 미채택) · D-CLOCK-ALT(기본 strict) · D-FABLE-SOFTCAP(P7 전) · router bytes 보존(F-4, P7/P8 전) · `formal_review`/`live_isolation` 구현 · dirty 160 처분(F-16 커밋 분리 포함).

---

## 검수 한계
세션 rollout·저장소 밖 Router 원본은 요청대로 읽지 않았다(PREFLIGHT의 hash·집계만 인용). 시험은 실행하지 않았고 "36/36"은 V081-LOCAL-CHECKS의 stdout·입력 hash·동일성 플래그와 spec 소스 대조로만 확인했다. 이 문서는 자문이며 CURRENT의 어떤 gate 값도 바꾸지 않는다. v0.7 원본(`…-v0.7-검수-Cowork-20260905.md`)은 덮어쓰지 않았다.
