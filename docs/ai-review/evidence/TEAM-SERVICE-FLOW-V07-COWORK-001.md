# 팀서비스 자동흐름 구현계획 v0.7 · 읽기 전용 자문 검수

> 작성: 2026-09-05 · 검수자: Claude (Cowork, 저장소 직접 읽기)
> 성격: **자문 검수.** 공식 typed Fable/Opus 게이트를 대체하지 않으며 그렇게 표기하지 않는다. 파일 편집·구현·배포·다른 채팅 전송 0건.
> 경위: 채팅 세션에서 MCP 장애로 REVIEW_INCOMPLETE 2회 → Cowork로 이관, 연결된 폴더에서 대상 전부 정독.
> 대상 root: `C:\Users\jacop\프로젝트\식자재관리앱` · 대상 commit `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076`

---

## (1) 판정

**CHANGES_REQUIRED**

계획 본문(§4·§5·§9)의 엄격함은 유지되고, 지난 회차(R2 P0-1~P0-4, v0.6 권고)는 거의 전부 반영됐다. 남은 결함은 문장이 아니라 **구조 3건**이다. ① 제품 목표에 도달하는 경로가 어느 트랙에도 소유자·기한·기본값 없이 열려 있다. ② 수용 시험 catalog가 계획 §7이 선언한 2축(구현/실행)을 갖지 않고, 그 상태를 spec 검사(PLAN-02)가 정답으로 고정하고 있다. ③ LC-ADMISSION의 유일한 case인 AC-24가 아직 존재하지 않는 P3·P4 산출물을 전제해 입장 게이트가 자기 뒤 단계에 의존한다.

셋 다 "문서를 더 쓰는" 일이 아니라 결정 등록·필드 추가·gate 정의 수정으로 닫힌다.

---

## 확인 범위 — 실측

| 항목 | 결과 |
|---|---|
| HEAD | `22036fb3…8076` 정확히 일치. `git cat-file -t` = commit |
| 계획 v0.7 SHA256 | `e811e0b6…d0304` 실측 일치 |
| CURRENT.json이 pin한 hash **34건 전부** | 실측 일치 (plan, acceptance, state, R1~R4, V05/V06/V07 보고서, OPUS-001 3파일, HOST-SCOPE-001/002, MODEL-DISPOSITION, VERIFY-V07 2파일, 협력형 계약 2파일) |
| checkpoint `4ddcbc19` / baseline `bdebbebb` / `7f5aefd` | 전부 HEAD 조상 |
| `git status` dirty | 144건 (처분 미완, 계획 §6 규칙대로 일괄 commit 안 함 — 정상) |
| R2 P0-1 (미커밋) | **해소.** 계획·R1~R4·증거·workflow/audit 스크립트 전부 추적됨 |
| R2 P0-4 (Opus 게이트 흡수 여부) | **해소.** OPUS-001은 `route: OPUS_DIRECT_ADVISORY`, `RUN_FAILED/ETIMEDOUT`, verdict 없음. acceptance `formal_review.reject_routes`에 `OPUS_DIRECT_ADVISORY`·`TIMEOUT` 명시. 필수 게이트가 아니었고 대체되지도 않았다 |
| R1 SR1~SR6 원문 대조 | 읽음. v0.7에서 SR1→§5 Host 신뢰 경계+PH, SR2→PH-FEASIBILITY/LIVE-PROBE 분리, SR3→P2b intent_key를 P3 앞으로, SR4→effect_key·root epoch·DAG 상한, SR5→§9 epoch CAS, SR6→P2 (A)/(B) exit + P2_BLOCKED. 구조적으로 전부 대응됨 |
| 10개 AC 시험 파일 실재 | **1개만 존재**(`team-service-workflow.test.mjs`). 나머지 9개 부재 — 아래 F-2 |
| `.codex/team-router/` | **git 미추적(`??`)**, .gitignore 대상도 아님 — 아래 F-4 |
| HOST-REQUIREMENTS.md 현재 SHA | `16437554…0696`. 002 증거가 pin한 `933558d2…`와 다름(한국어 정리 후). CURRENT.json 주석에 사유는 있으나 **현재 판본 pin은 없음** — F-5 |
| VERIFY-V07 record `target_commit` | `34cf2b4` (v0.6). HEAD `22036fb`은 그 뒤 `scripts/team-service-cooperative-contract.test.mjs` 신설 + host-requirements test 수정 — F-6 |

미확인: 저장소 밖 `C:/Codex-AI-Operations/Codex-Team-Router` 원본과 `~/.codex` 세션 로그는 연결 폴더 밖이라 읽지 않았다. HOST-SCOPE-001/002가 기록한 내용을 그대로 인용한다.

---

## (2) 차단 finding

### F-1 · 제품 목표에 도달하는 경로가 소유자 없이 열려 있다 (PRE-1·PRE-2 통합) — **차단**

**파일/절**: 계획 §1 마지막 문단, HOST-REQUIREMENTS §4, cooperative-flow-contract.json `candidate_phase_gates`, CURRENT.json `tracks.product`

**근거**
- §1은 "11개 방의 연결과 실제 업무 왕복이 제품 완료 기준"을 유지한다. 현재 그 기준에 도달할 수 있는 경로는 셋이다.
  - tier 1 LOCAL_CORE_ONLY — HOST-REQUIREMENTS §4가 스스로 "11개 방 서비스 완료는 주장하지 않는다".
  - tier 3 AUTHENTICATED — HOST-SCOPE-001 `caller_provenance`/`receipt_provenance`/`send_effect_fence` 3개 MISSING, 002 종료값 `HOST_REQUIREMENTS_SPECIFIED` = 외부 의존, ETA 없음.
  - tier 2 COOPERATIVE — `adopted: false`. T2-ADOPT는 `HUMAN_PRE_PILOT_REDUCED_TRUST_DECISION`을, T2-OBSERVATION-FEASIBILITY는 `NEW_DECLARED_SCOPE` + `ACTUAL_CAPTURE_LINK_PROVENANCE_EVIDENCE`를 요구한다.
- 그런데 **그 사람 결정은 어디에도 등록돼 있지 않다.** CURRENT.json에는 `next_safe_action`만 있고 pending owner decision 목록이 없다. 시계 대안(EXT-C1 `OWNER_DECISION_REQUIRED`)도 같다. 결정을 요구하는 문장은 있는데 결정을 기다리는 항목·입력·기본값이 없으므로 "채택 미정"이 무기한 기본 상태가 된다.
- **collector scope도 선언돼 있지 않다.** 001·002는 착수 선언 JSON(sources·timebox·outcomes·precedence)을 먼저 만들고 조사했다. T2-OBSERVATION-FEASIBILITY는 `NEW_DECLARED_SCOPE`를 요구하지만 `host-scope-003.json`류가 없다. `capture_implemented: false`, HOST-SCOPE-001 `receipt_provenance` MISSING 사유가 "record_delivery accepts evidence_id identifier only"이므로, 관측 수집기가 없으면 협력형의 도달 가능 상한은 UNVERIFIED이고 weakest-link 규칙에 따라 왕복 전체가 완료 불가다. 즉 tier 2도 지금은 계약서상의 경로다.

**최소 수정**
1. CURRENT.json에 `pending_owner_decisions` 배열 신설. 최소 3건: `D-T2-ADOPT`(협력형 채택/불채택/조건부, 입력 = cooperative-flow-contract SHA + T2-OBSERVATION-FEASIBILITY 결과, **미결정 기본값 = 진행 정지 유지**), `D-CLOCK-ALT`(EXT-C1, 기본값 = strict 유지), `D-FABLE-SOFTCAP`(P7 formal receipt 선행 비용 승인). 각각 요청일·입력·기본값·결정 시 다음 gate만 적는다.
2. `docs/team/host-scope-003.json`을 002와 같은 형식으로 선언: 목적 = "실제 send/read/wait 도구 호출과 응답을 모델 편집 없이 연결하는 수집 경로가 host에 존재하는가". 조사 후보 출처에 **Codex 세션 rollout JSONL**(09-04 Opus 스터디가 이미 "도구 152회" 계수에 사용한 host 기록 파일)을 넣을 것을 권한다 — 앱 runtime이 쓰는 파일이므로 모델 사후 작성 JSON이 아니고, 협력형의 신뢰 가정(같은 사용자/관리자는 방어 범위 밖)과도 맞는다. 종료값은 `CAPTURE_LINK_AVAILABLE_IN_SCOPE / CAPTURE_LINK_UNAVAILABLE_IN_SCOPE / DISCOVERY_INCOMPLETE` 셋으로 고정.
3. §1의 "11개 방 실제 왕복" 문장 뒤에 한 줄: "현재 이 기준에 도달하는 경로는 D-T2-ADOPT 결정 또는 외부 host 의존 해소 중 하나이며, 둘 다 미결이다." 목표를 낮추는 것이 아니라 상태를 정직하게 적는 것이다.

### F-2 · 수용 catalog가 §7이 선언한 2축을 갖지 않고, spec 검사가 그 상태를 고정한다 — **차단**

**파일/절**: 계획 §7 첫 문단, `service-flow-acceptance.json` `cases[*]`, `scripts/team-service-plan-contract.test.mjs` PLAN-02

**근거**
- §7: "구현 가용성(implementation_status)과 실행 결과(execution_status)는 독립 축이다. 현재 없는 파일/케이스는 NOT_IMPLEMENTED".
- 실측: 24개 case 전부 단일 `status: "NOT_EXECUTED"`. `implementation_status`는 case 레벨에 **0건**(파일 전체 grep 3건은 `case_status_axes` 설명문과 `local_core_track` 1곳). 10개 시험 파일 중 9개가 부재인데 catalog는 이를 표현할 필드가 없다.
- PLAN-02(`plan-contract.test.mjs:21`)가 `assert.equal(c.status, 'NOT_EXECUTED')`를 24개 전부에 요구한다. 파일 실재 여부는 검사하지 않는다. 즉 "명세 검사 32/32"는 §7 규칙 위반 상태를 통과시키고 있고, 누가 `NOT_IMPLEMENTED`를 적으면 오히려 실패한다.
- 이것이 09-04 페이블 판정이 지목한 "판정기 자체가 먼저 무너진다"의 문서판이다. spec 검사가 계획을 검증하는 게 아니라 catalog의 현 상태를 재확인한다.

**최소 수정**
1. 각 case에 `implementation_status: NOT_IMPLEMENTED | AVAILABLE` 추가. 현재 값은 workflow.test.mjs 4건(AC-03/04/07/08)만 AVAILABLE 후보, 나머지 20건 NOT_IMPLEMENTED. `status` → `execution_status`로 개명.
2. PLAN-02에 `fs.existsSync(c.file) === (c.implementation_status === 'AVAILABLE')` 검사 추가. 파일이 생기면 catalog를 갱신하지 않으면 검사가 실패하도록.
3. AC-03/04/07/08은 파일이 있어도 해당 `test_name`(`AC-0N service contract`)과 assertion_id가 파일 안에 존재하는지는 별개다. AVAILABLE의 정의를 "파일 존재 + case_id 문자열 존재"로 둔다.

### F-3 · LC-ADMISSION의 유일한 case AC-24가 P3·P4 산출물을 전제한다 (순환) — **차단(구현 착수)**

**파일/절**: acceptance `phase_gates[LC-ADMISSION].case_ids = [AC-24]`, `cases[AC-24].required_assertions`, 계획 §6 LC-ADMISSION 문단, `local_core_track.bounded_bugfix.completion_contract`

**근거**
- AC-24-A1 "Local module/import and capability allowlist rejects … dispatch reachability" — allowlist를 소유하는 `team-service-local-tests.mjs`는 AC-22(P3) 산출물.
- AC-24-A3 "Normal local scenarios execute with dispatch_attempts=0" — "정상 로컬 시나리오"를 실행하는 driver/store는 P4 산출물.
- LC-ADMISSION → P2 → P2b → P3 → P4 순서에서 입장 gate가 P3·P4를 전제하면 gate는 (a) 존재하는 `workflow.mjs` reducer만으로 공허하게 통과하거나 (b) 영원히 미실행이다. 계획 §6은 "입장용 fixture runner/AC-24의 작성·시험은 PLAN_TEST 범위에서 먼저 수행할 수 있다"고 하고 BF-COMPLETE는 `AC24_NO_DISPATCH_REVALIDATED_FOR_FIX_BUNDLE`을 요구하므로 **의도는 "번들마다 재실행되는 매개변수화된 gate"**다. 그런데 catalog는 AC-24를 phase 하나에 고정된 단일 case로 둔다.

**최소 수정**
1. AC-24를 **bundle-parameterized**로 재정의: 입력 = `target_modules[]` + `allowlist_sha256` + `bundle_commit`. 입장 회차의 target은 "현재 존재하는 `scripts/team-service-*.mjs` + 해당 번들이 추가하는 모듈"로 명시.
2. AC-24-A3의 "정상 시나리오"를 회차별로 정의: 입장 회차 = `team-service-workflow.mjs` reducer 시나리오(현 42개 시험이 이미 dispatch 없는 순수 시험이므로 그 실행 자체를 관측), P4 이후 = driver/store 시나리오.
3. acceptance에 `AC-24.runs[]`(bundle_commit, target_modules, dispatch_attempts, result) 기록 구조를 두고 LC-ADMISSION·BF-COMPLETE·P4가 각각 자기 회차를 참조하게 한다.

### F-4 · §3·§9가 보존·정렬 대상으로 삼는 "활성 계약" `.codex/team-router/`가 git 밖에 있다 — **P1**

**파일/절**: 계획 §3 표 마지막 행("활성 계약 | .codex/team-router 및 docs/team/chats | 존재·옛 활성 계약"), §9 전체

**근거**: `.codex/team-router/{activation-decision.json, activation-receipt.json, pilot-request.json, policy.json}` 4파일이 `??`(미추적). `.gitignore` 대상도 아니다. `.codex/mission-relay/`는 추적되고 있어 정책 의도가 "`.codex`는 제외"도 아니다. §9는 "기존 운영 원본과 충돌하지 않는 전환 창", "이전 계약으로 복구할 때 저장된 정확한 bytes"를 요구하는데 그 bytes가 버전 관리 밖이면 복구 기준이 없다. 이 저장소에서 미추적 파일은 이미 세 번 소실됐다(R2 P0-1 기록).

**최소 수정**: 둘 중 하나를 명시. (a) `.codex/team-router/`를 추적하고 CURRENT.json에 4파일 SHA pin, 또는 (b) "런타임 소유, git 밖" 원칙이면 그렇게 적고 §9 복구 규칙에 외부 bytes 보존 위치·hash 기록 절차를 넣는다. 더불어 `docs/team/README.md`·`DECISIONS.md`·`ROLE_CONTEXTS.md`가 `M` 상태다 — 이 계획이 참조하는 팀 문서이므로 dirty 144 처분 시 별도 분류.

### F-5 · 현재 HOST-REQUIREMENTS.md에 hash pin이 없다 — **P2**

CURRENT.json은 `host_requirements`(json)만 pin하고 `.md`는 없다. 002 증거의 pin(`933558d2`)은 한국어 정리 전 판본이고 현재 파일은 `16437554…`. §1이 이 문서를 축소 계약 정본으로 링크하므로 `host_requirements_document` 항목을 추가한다. 002 증거는 그대로 둔다(불변 원칙).

### F-6 · verify 기록이 HEAD 이전 commit에 묶여 있다 — **P2**

VERIFY-V07-001 `target_commit = 34cf2b4`. HEAD `22036fb`는 `scripts/team-service-cooperative-contract.test.mjs`(83행 신규)와 `team-service-host-requirements.test.mjs` 수정을 포함한다. 계획 §6 "입장 전 … HEAD·작업본 입력 hash"와 어긋난다. VERIFY-V07-SHELL 처분이 이미 "전체 재실행"을 요구하므로 **그 재실행을 HEAD에 결속**하면 함께 닫힌다. 별도 작업 아님.

### F-7 · §8 "이번 계획은 Fable/Opus를 호출하지 않는다" vs P7 `TYPED_FORMAL_RECEIPT_VALIDATED`(`default_engine: FABLE`) — **P2(표기)**

모순은 아니고 범위 표기다. "이번 계획 작성·Sol 자문 회차에서는 호출하지 않는다. P7 formal gate는 Fable이 기본이며 `D-FABLE-SOFTCAP` 승인이 선행조건"으로 고치면 CURRENT의 `fable: NOT_STARTED_EXACT_ROUND_SOFT_CAP_APPROVAL_MISSING`과 한 줄로 이어진다.

---

## 지난 회차 PRE 항목 처분

| ID | v0.7 상태 | 남는 것 |
|---|---|---|
| PRE-1 착지 경로 | 협력형 계약·T2 gate 신설로 **구조는 생김**. 결정 등록 없음 | → F-1 |
| PRE-2 OBSERVED 도달성 | 계약이 스스로 "collector 미검증"을 적음(정직). scope 선언 없음 | → F-1 (scope-003) |
| PRE-3 verify 3건 소유 트랙 | **해소.** DISPOSITION에 owner·`local_core_impact`·next 있음. LC-ADMISSION `FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED`가 의존관계를 명시 | 독립 검토 실행만 남음. 단서 하나: DB `01_checksums` 기대 4046.69 / 실제 4046.60은 09-04 프로토타입 스터디 C14("현재 서버 계약 4,046.60 · 33.72%, 4,046.69는 구 단순 계산기 legacy")와 정확히 일치한다. **시험 기대값이 낡았을 가능성**이 높으니 Data 트랙에 그 문서를 함께 넘길 것 |
| PRE-4 판정 불가 단계 목록 | `accepted_evidence.limitations`·`stage5: UNVERIFIED_ASYNC_SHELL_EXECUTION`으로 **부분 해소** | "이 환경에서 verify로 판정 가능한 단계 = ①⑥"을 명시적 목록으로 admission 기준에 결속. SHELL 수정 후 재실행(F-6)이 선행 |
| PRE-5 판본이 검수보다 빠름 | **미해소.** CURRENT: `full_independent_review: NOT_PERFORMED`, SV05-01~08은 Sol v0.6 재확인으로만 종결, v0.7은 delta 2건 | 계획 확정 조건 1번 |

---

## 계획 전체 모순·순환 게이트 검토 결과

- **절 간 모순**: F-2(§7 ↔ catalog), F-7(§8 ↔ P7) 외에 발견하지 못했다. §4 권한 교집합·§5 fence·§9 epoch CAS·협력형 §4 assurance는 서로 정합하고, "협력형 OBSERVED_ACK를 strict ACK/Router DELIVERED에 매핑하지 않는다"가 §9·HOST-REQUIREMENTS §4·contract.json `observed_is_strict_ack: false` 세 곳에서 같은 방향이다.
- **순환 게이트**: F-3 하나. phase DAG 자체(P0∥PH∥LC → P2 → P2b → P3 → P4 → P5 → P6(+PH) → P7(+P0) → P8 → LIVE-PROBE → P9)는 비순환이고 PLAN-03이 `depends_on`을 고정한다. 협력형 6단계도 비순환. 순환은 phase 그래프가 아니라 **case의 assertion이 뒤 phase 산출물을 참조하는 데서** 생긴다.
- **착수 순서**: LC-ADMISSION이 P0·PH와 독립인 설계는 옳다(판정 압력 완화). 단 F-3이 닫히기 전에는 LC-ADMISSION을 실행할 방법이 없으므로 순서상 F-3이 가장 먼저다.
- **관측 수집 가능성**: 현재 증거로는 **미정**이다. 001은 "Host tool responses … are available to the assistant"라고 적었다 — 모델에게 보이는 것과 모델 밖에서 수집되는 것은 다르다. rollout JSONL이 후자에 해당할 가능성이 있으나 이 검수에서 확인하지 않았다(연결 폴더 밖). scope-003의 첫 조사 대상으로 권한다.
- **원래 흐름(사람→CEO→총괄→팀→사람) 착지 가능성**: 계획은 이 흐름의 상태 기계·권한·STOP·crash 처리를 정밀하게 정의했다. 하지만 **그 흐름이 실제로 흐를 수 있는 전송 경로는 현재 어느 트랙에도 없다.** 로컬 코어는 결정론적으로 완성될 수 있으나 발송하지 않고, 인증형은 플랫폼에 달려 있고, 협력형은 결정과 수집기를 기다린다. 이건 계획의 결함이 아니라 계획이 정직하게 드러낸 현실이고, 그래서 F-1의 결정 등록이 문서 확장이 아니라 필수다.

---

## (3) 남은 조건

### 계획 확정(PLAN_ACCEPTABLE)까지

1. **판본 동결.** `e811e0b6…d0304`(또는 F-1~F-3 반영 후 v0.8 한 판본)에서 문서 수정을 멈추고, 그 SHA에 대해 **delta가 아닌 전체** 독립 검수 1회. Sol 전체 재독이면 SV05-01~08·SV06-01/02를 그 회차에서 다시 종결. Fable formal이면 `D-FABLE-SOFTCAP` 선행.
2. F-1 — `pending_owner_decisions` 등록 + `host-scope-003.json` 선언.
3. F-2 — catalog 2축 + PLAN-02 파일 실재 검사.
4. F-7 — §8 범위 표기 한 줄.
5. CURRENT.json `findings_for_v05[*].review_closure: PENDING` 7건과 `current_findings` `RUNTIME_UNVERIFIED` 10건의 지위를 1번 회차 결과로 갱신.

### 구현 착수(LC-ADMISSION 통과)까지

1. F-3 — AC-24 bundle-parameterized 재정의. 이것 없이는 gate를 실행할 수 없다.
2. `EXACT_LOCAL_MODEL_SCOPE` — MODEL-DISPOSITION-002 `local_core_scope_gate: NOT_PASSED`. 로컬 코어 범위의 정확한 모델/추론 프로파일을 model-plan 후속 판본으로 봉인.
3. `VERIFY_RUN_PINNED_INPUTS` — SHELL 수정 후 `corepack pnpm verify`를 **HEAD**에서 재실행(F-6), 판정 가능 단계 목록 명시(PRE-4).
4. `FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED` — VERIFY-V07-DB/DESIGN/SHELL 3건의 로컬 코어 경계 분리 여부를 독립 검토. DB 건은 C14 단서 첨부.
5. F-4 — `.codex/team-router/` 처분 결정(추적 또는 외부 bytes 보존 규칙).
6. AC-24 입장 회차 실제 실행 + 관측 기록.

### 이 회차에서 확인만 하고 조건에서 뺀 것

- R2 P0-1(미커밋)·P0-2(기준선 재현 — §0 표와 `team-service-baseline.mjs --capture/--verify`로 해소)·P0-3(P1a 종료 조건 — HOST-SCOPE-001 선언·3값 종료로 해소)·P0-4(Opus 게이트 — advisory였음 확인) 전부 닫힘.
- v0.6 권고(P1/P2/P3 분리, degradation matrix, 002 종료값, send/local 트랙 분리, C1/C2 이관, BLOCKED_HOST 분모 유지, tier 2 위협 모델, ATTESTED/OBSERVED 분리, 오염 회수) 전부 반영 확인.

---

## 검수 한계

- 저장소 밖 Team Router 플러그인 원본·Codex 세션 로그는 읽지 않았다. 001/002 증거 인용에 의존.
- 시험을 실행하지 않았다(읽기 전용 요청). "명세 검사 32/32"는 CURRENT.json 기록과 test 파일 소스 대조로만 확인.
- 이 문서는 자문이며 CURRENT.json의 `candidate_review.fable_opus_formal_review: NOT_PERFORMED`를 바꾸지 않는다.
