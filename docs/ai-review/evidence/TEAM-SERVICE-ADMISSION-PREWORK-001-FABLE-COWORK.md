# TEAM-SERVICE-ADMISSION-PREWORK-001 · AC-24 입장용 무발송 선작업 독립 검수 (Cowork 자문)

> 작성: 2026-09-05 · 검수자: Claude (Cowork, v0.7 → v0.8 → v0.8.1 → 본 회차 같은 세션)
> 성격: **읽기 전용 정적 자문.** typed formal receipt를 작성하지 않았고 어떤 gate도 통과시키지 않는다.
> 이번 회차 수행 0건: 시험 실행 · 기존 파일 수정 · 제품/정책/DB 변경 · 원시 세션/endpoint 열람 · 팀 전송 · 추가 모델 호출.
> 권위 루트 `C:/Users/jacop/프로젝트/식자재관리앱` · HEAD `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076` 유지 · 대상은 HEAD 위 **미커밋 작업본**

---

## (1) 판정

| 축 | 판정 |
|---|---|
| **자문 판정 (선작업)** | **PREWORK_ACCEPTABLE** — 번들·harness·시나리오·실행 기록·catalog/CURRENT 결속이 주장 범위 안에서 정합. 차단 결함 없음. **P1 1건(F-17)은 이 영수증을 LC-ADMISSION이 소비하기 전에** 닫아야 한다. P2 5건 |
| **formal gate** | **NOT_PERFORMED / NOT_PASSED** — CURRENT `FORMAL_INDEPENDENT_REVIEW: NOT_PASSED`, `admission_prework.formal_review: NOT_PERFORMED` 그대로 |
| **AC-24 실행 결과** | `PASS`는 **PLAN_TEST · ADMISSION 프로파일 1회**에 한정. FIX_BUNDLE/STORE_DRIVER 미실행 |
| **LC-ADMISSION** | **BLOCKED** — 정확한 로컬 모델 범위 · 새 full verify · 실패 3건 독립 처분 · local review 미충족. CURRENT `LOCAL_CORE_ADMISSION: AC24_EXECUTED_…_STILL_BLOCKED` 정확 |
| **full verify** | 이번 선작업에서 재실행 안 함 — 기록도 그렇게 적혀 있음(`full_verify_executed: false`) |

---

## (2) 입력 무결성 — 실측

| 항목 | 결과 |
|---|---|
| `TEAM-SERVICE-ADMISSION-PREWORK-001-CANDIDATE.json` | SHA `3a7e914a…cbc710` **일치**. `claims`(48 · attempts 0 · rejections 4 · provider 0 · admission false · service false · formal false) |
| 목록 27개 입력 | **27/27 실측 일치**, 부재 0 |
| HEAD / dirty | `22036fb3` 유지 · dirty 170. `scripts/team-service-workflow.mjs` · `team-routing-contract-audit.mjs` · `.codex/mission-relay/**` · `packages/**` · `apps/**` 중 이 선작업으로 바뀐 것 **없음** (tokens.ts·db/README dirty는 기존 타 트랙) |
| `service-flow-admission-bundle.json` | modules 4 + harness 3 pin **전부 실측 일치**. 파일 SHA `8a210ce3…` = 영수증 `allowlist_sha256` |
| `TEAM-SERVICE-AC24-ADMISSION-001.json` | inputs 8건 실측 일치 · `inputs_unchanged` · `head_unchanged` · exit 0 · TAP `ok` 12 / `not ok` 0 · stdout `AC24_OBSERVATION` JSON이 `observation` 필드와 동일(allowlist 필드 제외) · `kind: …_NOT_LC_ADMISSION_APPROVAL` |
| `…-PREWORK-001-CHECKS.json` | 6개 시험 파일 실행, `ok` 48 / `not ok` 0, exit 0, 입력 hash 일치 (명세 36 + AC-24/회귀 12) |
| catalog AC-24 `runs[0]` | 19개 `run_receipt_required_fields` 전부 존재. `evidence_sha256 == hash(evidence_ref)` ✓ · `allowlist_sha256 == hash(bundle)` ✓ · `test_sha256` = no-dispatch.test.mjs ✓ · `runner_sha256` = `verifier_sha256` = admission.mjs ✓ · `module_sha256` 4건 현재 파일과 일치 ✓ · `result: PASS`, `scope_limit` 명시 |
| CURRENT.json | pin **49건 전부 실측 일치**. `admission_prework` 블록이 bundle·execution hash 결속. `V081-COWORK-001.md`는 제 v0.8.1 보고서와 **바이트 동일**(`3f28b3f0…`) |
| v0.8.1 F-12~F-16 | **전부 반영 확인** — `document_status_note` v0.8.2 갱신(F-12) · v0.8 history 행이 V08-LOCAL-CHECKS 참조(F-13) · `local_checks.report_sha256`+`checked_version`(F-14) · `validateCase` 실제 hash 대조 + 계획 §7 `execution_evidence` 문서화 + PLAN-12 drift/ENOENT 음성(F-15) · `next_safe_action` "No … commit or unrelated-file staging"(F-16) |

---

## (3) 정적 검수 — 특히 요청된 경계

### closure 누락 · drift · 금지/dynamic import
`validateBundle`(admission.mjs:41-72)이 target+scenario에서 DFS로 전이 import를 따라가며 (a) 경로 정규식 `^scripts/[a-z0-9-]+\.mjs$`, (b) pin 부재 → `MISSING_IMPORT`, (c) bytes hash ≠ pin → `SOURCE_DRIFT`, (d) `node:` 4종 외 → `FORBIDDEN_IMPORT`, (e) 방문 집합 ≠ pin 집합 → `EXTRA_OR_MISSING_CLOSURE`, (f) harness 3파일 hash → `HARNESS_DRIFT`. `importsOf`는 TS AST로 static import/export-from만 허용, `import()` → `DYNAMIC_IMPORT_FORBIDDEN`, `require/eval/Function` 호출 → `DYNAMIC_CODE_FORBIDDEN`, 비리터럴 specifier → `NON_LITERAL_IMPORT`, parse 오류 → `INVALID_SYNTAX`. 실행 후 `validateBundle` **재실행**(:129)으로 "실행 중 무변경"을 확인한다.
음성시험(no-dispatch.test.mjs:30-41): 빈 target · 빈 scenario_ids · 모듈 누락 → MISSING_IMPORT · 여분 모듈 → EXTRA_OR_MISSING · drift · `import('node:http')` → DYNAMIC · target을 `node:http`/`node:child_process`/`./team-router-cli.mjs` import로 치환 → FORBIDDEN/MISSING. **요청한 네 경계가 전부 실제 assert.throws로 관측된다.** 실측 closure는 workflow.mjs → routing-contract-audit.mjs → docs-graph-check.mjs + scenario 4개로 bundle과 일치.

### 변조 관측
`verifyObservation`(:139-155)이 kind·profile·commit·targets·scenario_ids·module_sha256·closure·attempts 0·provider 0·negatives 4종 순서·`normal` 정확값·host_cases 5건 BLOCKED_HOST·service/admission false를 전부 등호 검사. 시험이 7종 변조(`normal_dispatch_attempts:1`, `actual_provider_calls:1`, negatives 비움, host_cases 비움, scenario_ids 비움, closure 비움, revision 0) 각각에 throw를 확인한다. ✓

### capability 제한의 실제 범위
`vm.createContext({}, {codeGeneration:{strings:false, wasm:false}})` + `SourceTextModule`. context에는 `attempts`/`deny`/`fixtureTransport`/`fetch`/`WebSocket` 스텁, 빈 frozen `process`, JSON 기반 `structuredClone`만 있다. `node:fs` 3함수는 **전부 deny 스텁** — closure에 포함된 `docs-graph-check.mjs`·`routing-contract-audit.mjs`가 실제로 `readFileSync/readdirSync/existsSync`를 import하므로 이 스텁은 장식이 아니라 import-time/호출-time 파일 읽기를 실제로 막는다. 정상 실행에서 `attempts.length === 0`(:117)을 **음성 시험 전에** 확인하고, 음성 4건 후 `attempts.length === 4`(:126). 순서가 옳다.
**한계(사용자 진술과 일치, 과장 없음)**: `createHash`·`path.*`·`fileURLToPath`는 host realm 함수를 그대로 노출하므로 반환 객체의 `constructor.constructor`로 host `Function`에 닿을 수 있다. 즉 이 VM은 **협력적 fixture의 우발적 capability 사용을 잡는 장치**이지 적대 코드 격리가 아니다. `limitation` 문자열과 계획 §6·bundle `scope`가 이미 그렇게 적고 있다(F-18은 문구 정밀화).

### 시나리오 (admission-scenario.mjs)
Task 1: 6 leg × (TOOL_ACCEPTED → ACK → LEG_COMPLETED) = revision 18, `COMPLETED`, `leg 6` — 사람→CEO→총괄→팀→총괄→CEO→사람 6 leg와 정합. Task 2: 새 Task에 `HUMAN_STOP` → `nextServiceAction(...).status === 'STOPPED'`. 두 값이 서로 다른 Task라 "COMPLETED이면서 STOPPED" 모순이 아니다. `verifier = {verifyReceipt: () => true}`는 합성 receipt이며 주석·`evidencePointer: 'RECEIPT:SYNTHETIC'`으로 명시 — AC-13류 receipt 검증과 혼동될 여지 없음.

### 영수증 입력 결속
run 영수증의 hash 5종 + module 4종을 **현재 트리에서 재계산해 전부 일치**시켰다(위 표). `bundle_commit`은 HEAD이지만 admission.mjs·scenario·test·bundle은 미추적이므로 commit 단독으로는 재현 불가 — 재현성은 manifest+sha pin에 있다(F-22 표기 권고). `assertion_observations` 4건은 artifact_sha256(=bundle)·verifier_sha256·verification_result를 갖는다(F-20 참조).

### 게이트 순환
LC-ADMISSION의 `ac24_run_requirement`(ADMISSION)가 소비하는 입력은 실재 파일(workflow.mjs·workflow.test.mjs)과 PLAN_TEST 산출물(admission.mjs·scenario·bundle·test)뿐이다. P3(AC-22 runner)·P4(driver/store)를 참조하지 않는다. 순환 없음. `receipt_reuse: never satisfies` + `scope_limit` 문구로 ADMISSION PASS가 FIX/STORE_DRIVER로 번지지 않는다.

---

## (4) Findings

### F-17 · spec 층이 PASS run의 입력 pin을 재계산하지 않는다 — **P1 (영수증 소비 전 필수)**
파일: `scripts/team-service-plan-contract.test.mjs` PLAN-13 run 루프.
근거: PASS run에 대해 `evidence_sha256 == hash(evidence_ref)`만 재계산한다. `module_sha256[*]`, `allowlist_sha256`(bundle), `test_sha256`, `runner_sha256`, `verifier_sha256`는 **형식(64-hex)만** 검사한다. 지금은 전부 현재 트리와 일치하지만, 이후 workflow.mjs·bundle·harness가 바뀌어도 catalog의 `result: PASS`가 spec 36/36을 계속 통과한다. `pass_rule` "exact bundle hashes unchanged"와 `receipt_reuse` "identical tuple"이 기계 집행되지 않는 셈이며, 이는 v0.7 F-2/v0.8 F-9에서 지적한 "spec 검사가 현 상태를 그대로 승인" 패턴의 재발 지점이다.
최소 수정(5줄): PASS run에 대해 `for m of run.module_sha256: assert.equal(hash(m.path), m.sha256)`, `assert.equal(hash('docs/team/service-flow-admission-bundle.json'), run.allowlist_sha256)`(또는 bundle 경로를 run 필드로), `hash(case.file) == run.test_sha256`, `hash('scripts/team-service-admission.mjs') == run.runner_sha256 && == run.verifier_sha256`. drift 시 `execution_status`를 `UNVERIFIED`로 내리는 규칙을 `case_status_axes`에 한 줄 추가.

### F-18 · capability 한계 문구가 host-realm 노출을 명시하지 않는다 — P2
파일: admission.mjs:136 `limitation`, bundle `scope`, 계획 §6.
"not OS isolation, host authentication, or malicious-code sandbox"는 맞지만, **왜** 아닌지(`node:crypto/path/url` builtin이 host realm 객체를 반환 → prototype chain으로 host `Function` 도달 가능)를 적어 두면 나중에 누군가 이 VM을 격리 장치로 승격하는 것을 막는다. 부수: `importsOf`는 `new Function(...)`(NewExpression)을 정적으로 잡지 않는다 — 런타임 `codeGeneration.strings:false`가 막으므로 결함은 아니고 주석 한 줄 대상.

### F-19 · 음성 4건이 harness 호출이고 target-realm 내부 호출이 아니다 — P2
파일: admission.mjs:119-125, no-dispatch.test.mjs.
`fixtureTransport.send()`·`fetch`·`WebSocket`·`fs.readFileSync`는 `vm.runInContext`로 harness가 직접 호출한다. 스텁이 동작함은 증명되지만, "target 모듈 안에서 호출해도 같은 counter가 증가한다"는 별도로 관측되지 않았다(같은 realm이므로 동작할 것으로 보이나 시험은 없다). 최소 수정: 음성 전용 fixture 모듈 1개(예: `scripts/team-service-admission-negative-fixture.mjs`, 내부에서 `fetch()` 호출)를 별도 negative bundle로 pin해 `NORMAL_CAPABILITY_ATTEMPT`로 실패함을 assert. `HARNESS_DRIFT`·`NON_LITERAL_IMPORT` 경로도 음성시험 없음 — 같은 시험에 2줄.

### F-20 · `assertion_observations`가 runner 출력이 아니라 catalog에 수기 작성됐다 — P2
파일: acceptance `AC-24.runs[0].assertion_observations`, no-dispatch.test.mjs:27.
runner의 `AC24_OBSERVATION` JSON에는 per-assertion 레코드가 없고, catalog의 4건은 prose(`"Exact 4-module transitive closure; …"`)다. artifact_sha256·verifier_sha256은 맞지만 계획 §7 "각 assertion_id의 실제 관측 artifact … 같은 run에 결속"의 취지상 runner가 `assertion_observations[]`를 직접 emit하고 catalog는 그것을 옮겨 적는 편이 맞다. 그러면 F-17의 재계산 대상에도 자연히 포함된다.

### F-21 · allowlist == bundle 파일 — P2 (표기)
`allowlist_sha256`이 bundle 파일 자체의 hash다. 계획 §6 "입장 전용 독립 allowlist"와 acceptance `entry_allowlist_owner: PLAN_TEST_ADMISSION_FIXTURE_NOT_AC22`에 부합하지만, bundle에 `"allowlist_role": "BUNDLE_MODULES_ARE_THE_ADMISSION_ALLOWLIST"` 한 줄을 넣어 두 개념이 같은 파일이라는 것을 명시하라. 나중에 P3 AC-22 allowlist가 생길 때 혼동을 막는다.

### F-22 · 영수증의 `bundle_commit`이 재현 단위로 오독될 수 있다 — P2 (표기)
admission.mjs·scenario·test·bundle 4파일은 HEAD에 없다(미추적). `bundle_commit: 22036fb3`만 보면 "그 commit에서 재현 가능"으로 읽힌다. run 영수증과 AC24 기록에 manifest들과 같은 `snapshot: WORKING_TREE_HASHED` 필드와 candidate manifest SHA(`3a7e914a…`) 참조를 추가하면 된다.

---

## (5) 남은 admission 조건 — 축 분리

### LC-ADMISSION 통과까지 (계획 결함 아님, 실행 조건)
1. **F-17** — PASS run pin 재계산을 spec 층에 추가 (이 영수증을 gate 입력으로 쓰기 전).
2. `EXACT_LOCAL_MODEL_SCOPE` — MODEL-DISPOSITION-002 `local_core_scope_gate: NOT_PASSED`. 로컬 코어 범위의 정확한 모델/추론 프로파일을 model-plan 후속 판본으로 봉인(재봉인은 별도 승인).
3. `VERIFY_RUN_PINNED_INPUTS` — SHELL 수정 후 `corepack pnpm verify`를 **HEAD + 현재 작업본 hash**에 결속해 재실행(v0.7 F-6). 이번 선작업은 재실행하지 않았고 그렇게 기록돼 있다.
4. `FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED` — VERIFY-V07-DB/DESIGN/SHELL 3건의 로컬 코어 경계 분리 여부 독립 검토(DB 건은 프로토타입 스터디 C14 단서 첨부).
5. `LOCAL_SCOPE_REVIEW` — 이 선작업 bundle에 대한 **formal** 회차(Fable typed receipt, D-FABLE-SOFTCAP 선행). 본 자문은 그 자리를 대신하지 않는다.

### 다음 AC-24 회차
FIX_BUNDLE(BF-C1/C2, `scripts/team-service-bugfix.test.mjs` NOT_IMPLEMENTED) · STORE_DRIVER(P4, driver/store 부재) — 각각 새 bundle·새 run_id·새 영수증. ADMISSION PASS 재사용 금지는 catalog·계획·영수증 세 곳에 이미 있다.

### 운영/발송 — 변화 없음
send CLOSED · 협력형 미채택 · scope003 PREFLIGHT만 · router bytes 보존 OPEN · pending owner decisions 3건 PENDING.

---

## 검수 한계
시험을 실행하지 않았다. "48/48"·"12/12"·"attempts 0 / rejections 4"는 CHECKS·AC24 기록의 stdout TAP·입력 hash·동일성 플래그와 소스 정적 대조로만 확인했다. 세션 로그·저장소 밖 Router 원본·원시 endpoint는 읽지 않았다. 이 문서는 Cowork 자문이며 CURRENT의 어떤 gate 값도 바꾸지 않고 formal receipt가 아니다.
