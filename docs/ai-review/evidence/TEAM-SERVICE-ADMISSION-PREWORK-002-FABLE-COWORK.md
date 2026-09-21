# TEAM-SERVICE-ADMISSION-PREWORK-002 · F-17~F-22 보완분 재확인 (Cowork 자문)

> 작성: 2026-09-05 · 검수자: Claude (Cowork, PREWORK-001과 같은 세션)
> 성격: **읽기 전용 정적 자문 · formal receipt 아님 · gate 통과 표시 없음.** 시험 실행·기존 파일 수정·제품/DB/정책 변경·팀 전송·원시 세션 열람 0건.
> 권위 루트 `C:/Users/jacop/프로젝트/식자재관리앱` · HEAD `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076` 유지 · 대상은 HEAD 위 미커밋 작업본

## 판정: **PREWORK_ACCEPTABLE** (자문)

F-17~F-22 **6건 전부 해소.** 새 차단 결함 없음. 비차단 관찰 3건(O-1~O-3).
formal review NOT_PERFORMED · LC-ADMISSION BLOCKED(모델 범위·full verify·실패 처분·local review) · full verify 미재실행 · send CLOSED — 전부 그대로이고 CURRENT도 그렇게 적혀 있다(`LOCAL_CORE_ADMISSION: AC24_EXECUTED_MODEL_SCOPE_VERIFY_AND_REVIEW_STILL_BLOCKED`).

## 입력 무결성 — 실측

| 항목 | 결과 |
|---|---|
| `PREWORK-002-CANDIDATE.json` | SHA `7179428b…4431f` 일치. `previous_candidate_sha256 = 3a7e914a…`(001) 연결 |
| 목록 31개 입력 | **31/31 실측 일치**, 부재 0 |
| 001 원문 보존 | 001 manifest `3a7e914a…`, `AC24-ADMISSION-001.json` `21e646ac…`, 제 001 보고서 `45bef064…` — 세 파일 바이트 그대로 |
| reducer·라우터·model-plan | `workflow.mjs`·`routing-contract-audit.mjs`·`.codex/mission-relay` HEAD 대비 변경 없음 |
| `AC24-ADMISSION-002.json` | inputs 10건 일치 · `snapshot: WORKING_TREE_HASHED` · `snapshot_manifest_ref/sha256` = bundle `0a11db59…`(실행 전 pin) · `run_environment.AC24_RUN_ID = AC24-ADMISSION-002` · exit 0 · TAP `ok` 13 / `not ok` 0 · stdout `AC24_OBSERVATION` == `observation` |
| `PREWORK-002-CHECKS.json` | 6개 시험 파일, `ok` 49 / `not ok` 0, 입력 hash 일치 |
| CURRENT.json | pin **50건 전부 일치**. `admission_prework.previous_review`가 001 보고서·`required_before_consumption: [F-17]`을 기록 |
| hash 순환 | CURRENT는 002 candidate를 pin하지 **않고**, 002 candidate가 CURRENT를 pin — 순환 없음 ✓ |

## F-17 ~ F-22

| ID | 판정 | 근거 |
|---|---|---|
| **F-17** spec 층 pin 재계산 | **해소** | `verifyCurrentAc24Run`(plan-contract.test.mjs:44-53)이 `active_run_id` run에 대해 module 4·`allowlist_ref`·`runner_ref`·`verifier_ref`·`ac.file`·`evidence_ref` **전부 현재 bytes로 재계산**(`CURRENT_*_DRIFT`). PLAN-13:24 "execution_status PASS ⇒ active PASS run 정확히 1개". PLAN-13:42-44가 **6개 입력 각각**을 `'0'×64`로 치환한 음성으로 `/DRIFT/` throw 확인. `assertion_observations`는 evidence 파일의 값과 deepEqual(`ASSERTION_OUTPUT_MISMATCH`). 제가 실측: active run 002의 6종 hash 모두 현재 트리와 일치. **001 run은 필드·hash 무변경**(현재 test/runner bytes와 불일치 = 역사로 남음), `run_receipt_required_fields`를 확장하지 않아 001을 소급 수정하지 않았다. `execution_status` 열거 미확장, `case_status_axes.current_run_consumption`에 "drift → gate UNVERIFIED, 과거 PASS는 history" 계약 명시 ✓ |
| **F-18** host-realm 한계 문구 | **해소** | admission.mjs:136 `limitation`에 "crypto/path/url expose host-realm objects and prototype chains; no adversarial containment; `new Function` is rejected by runtime codeGeneration, not the static call check". bundle 2종 `scope` 동일 취지 ✓ |
| **F-19** target-realm 내부 음성 | **해소** | `team-service-admission-negative-fixture.mjs`(workflow import 후 `fetch()` 호출)를 별도 `service-flow-admission-negative-bundle.json`에 pin. no-dispatch.test.mjs:53-60이 `validateBundle(negative)` 후 자식 프로세스에서 `assert.rejects(runAdmission(negative), /NO_DISPATCH:fetch/)`. `validateBundle`이 scenario 2종만 허용(:47). `HARNESS_DRIFT`(:43)·비리터럴/잘못된 import(:44) 음성 추가 ✓ |
| **F-20** assertion_observations runner 출력 | **해소** | 시험이 4 assertion의 관측값(closure·rejections·normal·host_cases)을 직접 emit(:29-34), evidence 파일 `observation.assertion_observations`에 그대로 저장, catalog 002 run 값과 **deepEqual 실측 일치**, PLAN-13이 대조 ✓ |
| **F-21** allowlist=bundle 표기 | **해소** | bundle `allowlist_role: BUNDLE_MODULES_ARE_THE_ADMISSION_ALLOWLIST`, run `allowlist_ref` = bundle 경로 ✓ |
| **F-22** 재현 단위 표기 | **해소** | bundle·run·evidence·emit 모두 `snapshot: WORKING_TREE_HASHED`; evidence에 실행 전 `snapshot_manifest_ref/sha256`; 002 `scope_limit` "Snapshot pins, not bundle_commit alone, reproduce this run" ✓ |

## 신규 차단 결함: 없음

비차단 관찰:
- **O-1** 음성 fixture 시험의 `TARGET_NEGATIVE_DENIED`는 자식 stdout에서 부모가 assert하고 끝나, evidence 파일의 TAP에는 `ok 3` 한 줄만 남는다. 정확성 문제는 아니고 가시성 문제 — 부모가 자식 marker를 한 줄 echo하면 evidence만 보고도 확인된다.
- **O-2** negative bundle이 positive와 같은 `kind`·`scenario_ids`를 쓰고 `negative_only: true`로만 구분되는데 `validateBundle`은 그 필드를 읽지 않는다. 지금은 scenario 파일 자체가 throw하므로 안전하게 실패하지만, `scenario ↔ negative_only` 일치를 `validateBundle`에 한 줄 넣으면 두 bundle이 뒤바뀌는 경우를 정적으로 막는다.
- **O-3** `verifyCurrentAc24Run`은 spec 시험 파일 안에만 있다. LC-ADMISSION을 실제로 평가하는 소비자(추후 `assertion_evidence_contract` 구현, 현재 `implemented: false`)가 같은 규칙을 import해 쓰도록 하는 것이 맞다 — 착수 조건 목록에 이미 포함된 항목.

## 남은 admission 조건 (변화 없음)
`EXACT_LOCAL_MODEL_SCOPE` 봉인 → SHELL 수정 후 HEAD 결속 `corepack pnpm verify` 재실행 → VERIFY-V07 3건 독립 처분 → 이 bundle·002 영수증에 대한 **Fable formal 회차**(D-FABLE-SOFTCAP 선행). 본 자문은 그 회차를 대신하지 않으며 CURRENT의 어떤 gate 값도 바꾸지 않는다.

## 검수 한계
시험 미실행 — "49/49·13/13·denied"는 CHECKS/AC24-002 기록의 TAP·입력 hash·동일성 플래그와 소스 정적 대조로 확인. 세션 로그·저장소 밖 Router 원본 미열람.
