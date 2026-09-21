# TEAM-SERVICE-PREWORK-20260906 · 소스·후보 경계 정적 자문 검수 (Cowork)

> 작성: 2026-09-06 · 검수자: Claude (Cowork, 같은 세션) · **읽기 전용 정적 자문 · formal receipt/LC-ADMISSION/활성화 승인 아님.**
> 수행 0건: 시험 실행 · 저장소/제품/DB/정책/원본 수정 · 모델 호출 · 팀 전송 · 세션 원문 열람.
> 권위 루트 `C:/Users/jacop/프로젝트/식자재관리앱` · HEAD `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076` 유지.
> **full `corepack pnpm verify` 결과는 이번 입력·판정에 포함하지 않았다**(요청대로 별도 회차).

## 판정: **PREWORK_ACCEPTABLE** (소스·후보 경계, 자문)

차단 결함 없음. P2 모델 게이트 입력으로 쓰기 전에 정리할 P1 1건(S-1), P2 4건. AC24-002 원본(`34db3467…`)·002 보고서(`2482002a…`)·canonical `model-plan.json`(`60d7cb6a…`)·11역할 activation receipt 전부 **무변경** 확인.

## 입력 무결성

`SOURCE-CANDIDATE-001.json` SHA `66bd0dc3…7c8c8` 일치 · **11/11 실측 일치** · `.codex/mission-relay/candidates/team-service-local-core-001.json` sidecar `6d470009…` = 파일 실측 · `kind: …FULL_VERIFY_STILL_RUNNING`, `full_verify: RUNNING_NOT_A_REVIEW_INPUT_YET` 정직.
CHECKS-001: `local_tests` TAP `tests 55 / pass 55 / fail 0` 확인; supplemental 3건(docs-graph `--activation` PASS, admin-acl.test.sh mock, core 194/12skip · mobile 233) — 명시된 대로 출력 잘림·사후 hash 한계 기록; `fable:check` 로그인 확인만(`model_invocation: false`).

## 확인 결과

**verify-shell.mjs / test / verify.mjs 연결 — 결함 없음.** 근본 원인(`SHELL=powershell.exe`가 존재한다는 이유로 Bash로 채택 → `.sh` 파일 연결이 비동기 실행)이 정확히 막혔다: win32 후보는 절대경로 + basename `bash.exe`만, 모든 후보를 `--noprofile --norc -c` 프로브로 실행해 `BASH_VERSION` 존재·정확한 stdout marker·exit 37을 **동시에** 요구, `shell:false`. 시험은 PowerShell 경로 미실행, exit 0/marker 누락/signal/timeout 거부, 상대경로·wsl.exe 무시, POSIX도 프로브, 실제 Bash 자식의 nonzero exit·완료 대기(≥80ms), 그리고 `verify.mjs` 소스 계약(import 존재·로컬 `findBash` 삭제·③에서 회귀시험 호출)을 덮는다. `verify.mjs` ④⑤는 `run(BASH, [script.sh])` = `spawnSync` 동기 대기이므로 VERIFY-V07-SHELL의 "비동기 조기 성공"은 구조적으로 재발 불가.

**team-service-prework-verify.mjs — 결함 없음, 범위 한계 1건(S-3).** 기존 evidence 존재 시 throw + `flag:'wx'`(덮어쓰기 불가), 실행 전/후 입력 hash 인벤토리·`changed_inputs`·`head_stable`, stdout/stderr 전량+hash, 단계 파서 정규식이 `verify.mjs`의 출력 형식(`  ok     ①…` / `  FAIL   …` / `  건너뜀 …`)과 일치함을 소스에서 확인, `full_verify_passed`는 6단계 전부 `ok`·drift 0·HEAD 동일을 모두 요구(건너뜀은 PASS 아님 — fail-closed). win32는 `cmd.exe /d /s /c corepack pnpm verify`로 명시 호출, `shell:false`. `kind: …OBSERVATION_NOT_ADMISSION`, `independent_review:false`.

**후보 `team-service-local-core-001.json` — 경계 준수.** canonical 대비 diff는 `sealedAt`, `profiles`/`computedBudget.profiles`에 `astra-high-local` 추가, `stages[14]` 추가(astra `expectedCallsLowerBound 0` + fable-high "exact 회차 soft-cap 승인 필수·Cowork 자문 대체 불가"), `transitionComponents` astra 추가, `localScopeCandidate` 신설 — 그 외 stage 1~13·routingPolicy·reviewRequirements·budgetGuard 값 무변경(숫자형 `4.0→4` 표기만). `localScopeCandidate`: `status: CANDIDATE_NOT_ACTIVE`, `active_path_modified: false`, `predecessor_sha256` = canonical 실측, `economic_rollover_authorized: false`, scope `PLAN_REPAIR/PLAN_TEST/C1_C2_AFTER_LC_ADMISSION`, `excluded`에 P2b~P5 확장·실제 dispatch·Router/제품/DB/운영, `activation_dependencies`에 §9 전환·full verify·AC24·formal review. astra 가용성은 "turn_context projection, not provider attestation, raw transcript not copied", 가중치는 "기존 최대 보수 3/0.3/15, 실측 아님" — 진술과 파일이 일치하고 과장 없음.

## Findings (소스·후보 경계만)

**S-1 · `computedBudget.status: MODEL_BUDGET_VALID`가 유지된 채 transition 상한이 예산을 넘는다 — P1 (P2 모델 게이트 입력 전 정리)**
canonical: `remainingPlannedUnits 292,280` · `transitionUpperWeightedUnits 185,280`(상한 < 잔여). 후보: 잔여 292,280 **그대로** · 상한 **869,280**(astra 4회 × 32,000 in / 5,000 out × 3/15 가중) → 상한이 잔여의 약 3배인데 `status`는 그대로 `MODEL_BUDGET_VALID`. 둘 중 하나다: (a) VALID 판정 규칙이 상한↔잔여를 비교하지 않는다 → 그 규칙과 CLI verify 출력을 후보나 CHECKS에 인용해 "VALID의 뜻"을 고정, (b) 비교한다 → 상태가 낡았고 CLI `MODEL_PLAN_VERIFIED`가 이 필드를 검사하지 않는 것이므로 P2 gate `WEIGHT_BASIS` 입력으로 쓰기 전에 재계산. rollover가 금지돼 있어 예산 집행 위험은 없지만, 계획 §6 P2 (B)가 "가중치 근거 검증된 SEALED 후속 계획"을 요구하므로 이 필드가 무엇을 보증하는지 밝혀야 한다.

**S-2 · 상속된 `budgetGuard` 위임 문구와 후보의 exact-pin 요구가 한 파일에서 충돌한다 — P2**
`budgetGuard.externalReviewResumeCondition`·`technicalBudgetExhaustedPolicy`("사용자가 … 초과 진행을 AI에 위임", "AI가 실측 기반 soft cap을 선택") vs 같은 블록 `softBudgetExceptionRequiresExactHumanPin: true`, stage 14 fable-high "exact 회차 soft-cap 승인 필수", CURRENT `D-FABLE-SOFTCAP default: NO_NEW_PAID_FORMAL_CLI_CALL`. budgetGuard는 canonical에서 그대로 온 legacy(`legacy_fields` 주석 있음)라 이번 변경의 결함은 아니지만, 이 후보를 소비하는 쪽이 어느 문장을 따르는지 한 줄로 우선순위를 못 박아야 한다(권고: stage 14·D-FABLE-SOFTCAP 우선, legacy는 history).

**S-3 · capture 스크립트의 입력 인벤토리 범위가 verify가 읽는 범위보다 좁다 — P2**
`snapshot()`은 `apps packages scripts .github` + root 설정 + `docs/team/chats` + model-plan만 hash한다. `verify.mjs` ③의 `docs-graph-check.mjs --activation`은 `docs/**`(그리고 activation 모드에서 `.codex/team-router/policy.json`·chat manifest)를 읽는다. 그 파일이 실행 중 바뀌어도 `changed_inputs`에 잡히지 않는다. 최소 수정: `docs`와 `.codex/team-router`를 인벤토리에 추가, 또는 record에 `inventory_scope_partial: true`와 제외 경로를 명시. 결과 자체를 무효화하는 결함은 아니다(`limitations` 문장이 이미 부분성을 인정).

**S-4 · `localScopeCandidate.input_refs`에 hash가 없다 — P2**
계획 v0.8.2와 `service-flow-admission-bundle.json` 경로만 있고 SHA가 없다. bundle은 AC-24 회차마다 바뀌는 파일이므로 후보가 "어느 bundle"을 범위로 봉인했는지가 열려 있다. `predecessor_sha256`처럼 두 ref에 sha256을 붙이면 P2 gate `MODEL_SHA_CONSUMERS` 대조가 기계적으로 된다.

**S-5 · `verify.mjs` 작업본 diff에 다른 트랙 변경이 함께 실려 있다 — P2 (커밋 분리, F-16 패턴)**
이번 범위의 변경은 `findBash` import·`console.log`·③의 `verify-shell.test.mjs` 호출 3곳이다. 같은 파일의 `setup-doctor`·`design-token-contrast.mjs` 추가와 ③ 제목 변경은 기존 dirty(디자인 토큰·setup 트랙)다. 동결 manifest가 파일 단위라 함께 hash됐을 뿐이고 정당하지만, 커밋 시 분리해야 하고, 현재 돌고 있는 full verify가 ③에서 `design-token-contrast.mjs`(VERIFY-V07-DESIGN의 원인 단계)를 만나 실패하면 그 처분은 **디자인 토큰 트랙**으로 귀속시켜야 한다.

## 자문 판정과 gate의 분리
이 문서는 소스·후보의 경계가 진술과 일치함을 확인한 자문이다. `FORMAL_INDEPENDENT_REVIEW: NOT_PASSED`, `LOCAL_CORE_ADMISSION` BLOCKED, `P2` 모델 게이트 미통과, 활성 model-plan·receipt 무변경, send CLOSED — 어느 것도 이 문서로 바뀌지 않는다. full verify 실행·실패 처분 증거는 도착 후 별도로 본다.
