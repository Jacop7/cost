# TEAM-SERVICE-PREWORK-20260906 · 전체 verify 처분·실패 영향 분리 최종 자문 검수 (Cowork)

> 작성: 2026-09-06 · 검수자: Claude (Cowork, 같은 세션) · **읽기 전용 자문 · formal receipt/P7/live/전체 서비스 승인 아님.**
> 수행 0건: 시험/DB/제품/정책/소스 변경 · 모델 호출 · 팀 메시지 · 세션 원문 열람 · verify 재실행.
> 권위 루트 `C:/Users/jacop/프로젝트/식자재관리앱` · HEAD `22036fb3f59f7ae66f7d3ce8b1a6eafb7bd18076` 유지.

## 판정: **PREWORK_ACCEPTABLE** (자문)

S-1~S-5 처분 적정, 실행 결과·cleanup·원본 보존 진술은 원본 JSON과 일치, C1/C2 로컬 범위와 남은 실패의 영향 분리는 **계획 §6이 요구하는 수준에서 충분**하다. 차단 결함 없음. 정정 권고 P1 1건(D-1), P2 3건. LC-ADMISSION을 막고 있는 것은 이제 처분의 결함이 아니라 **gate 소유자의 소비 결정과 formal 회차**이며, 이 문서가 그것을 대신하지 않는다.

## 입력 무결성 — 실측
`FINAL-CANDIDATE-001.json` SHA `ec45ad2c…fa76d` 일치 · **14/14 실측 일치** · canonical `model-plan.json` `60d7cb6a…` 무변경 · `.codex/team-router/activation-decision/receipt` 이번 manifest에 pin(무변경) · 후보001 `6d470009…`·AC24-002 `34db3467…`·직전 SOURCE 자문 보고서 `8761fae3…` 보존 · 후보002 sidecar `bd8575ac…` = 파일 실측 · 실행 원본 SHA `f63c0e11…` = DISPOSITION 인용값.

## (2) 실행 결과·cleanup·원본 보존 — 진술 대조

| 진술 | 원본 `TEAM-SERVICE-VERIFY-PREWORK-20260906-001.json` 실측 |
|---|---|
| 4/6, exit 1 | `stages` ①ok ②FAIL ③FAIL ④ok ⑤ok ⑥ok, `exit_code 1`, `signal null`, `error null` ✓ |
| 20:02:33Z~20:34:27Z, HEAD 동일 | `started/ended_at` 일치, `before.head == after.head == 22036fb3`, `head_stable true` ✓ |
| 591 입력 drift 0 | `before/after.files` 591/591, `changed_inputs []` ✓. verify.mjs·verify-shell.mjs·workflow.mjs·model-plan 전후 hash가 현재 트리와도 동일 ✓ |
| 출력 U+FFFD 0, stdout hash | `stdout` 재해시 = `stdout_sha256` ✓, 대체문자 0 ✓ |
| ② 개발 DB 43/50 | stdout `43/50 통과`, FAIL 4행(제육볶음 순이익 ×2 · 증감 · 전제) ✓ |
| ③ 색 대비 커밋 3개 조상 아님, 이후 미도달 | stderr에 `f351058f30aa`·`9ffba3176f11`·`0d9f437782d6` ✓; stdout ③은 `색 역할 대비 — 26쌍`에서 끊김, 이후 `--activation`·`docs-graph-check.test.mjs`·`admin-acl.test.sh` 출력 없음 ✓ |
| ④ fresh 50/50 · ⑤ 23/23 · 1761.3s | stdout에 각 1회 ✓ |
| cleanup: 일회용 DB 2개 부재, 개발 DB reset 없음 | LIMITATIONS `disposable_cleanup` 쿼리·`rows []`·`exit 0` 기록 ✓(DB 상태 자체는 이 검수가 조회하지 않음 — 기록 신뢰) |
| 원본 미수정 | 실행 원본 SHA가 DISPOSITION·LIMITATIONS·manifest 세 곳에서 동일 ✓; companion에 한계를 적고 원본은 그대로 둔 S-3 처리 방식 ✓ |
| 인벤토리 부분성 | LIMITATIONS `inventory_scope_partial: true`, 제외 = `docs/** except docs/team/chats`, `.codex/team-router/**`, env/DB 내용 ✓ |

**보충 관찰(D-2)**: `before.dirty` 181 → `after.dirty` 185. 새 4건은 `.codex/mission-relay/candidates/`, `PREWORK-20260906-CHECKS-001.json`, `SOURCE-CANDIDATE-001.json`, `SOURCE-FABLE-001.md` — 전부 병행 선작업의 증거·후보 산출물이고 verify 입력이 아니다. 진술을 훼손하지 않지만 DISPOSITION이 이 4건을 이름으로 밝히면 "drift 0"의 범위가 더 정확해진다.

## (1) S-1~S-5 처분 적정성

| ID | 판정 | 근거 |
|---|---|---|
| S-1 VALID 의미 | **적정** | 후보002 `budget_interpretation`: `compute_budget` 소스 경로·함수·행·**SHA** 인용, `valid_means` = "validate_plan 통과 후 가중 합계 계산 가능; 상한≤잔여·지출·경제성 보증 아님", `transition_exceeds_remaining: true`를 **숨기지 않고 기록**, `economic_decision: NOT_AUTHORIZED`. 후보001 원본 보존(`predecessor_candidate` pin). 요구한 (a) 경로를 정확히 택했다 |
| S-2 우선순위 | **적정** | `approval_precedence`: stage 14·D-FABLE-SOFTCAP·`softBudgetExceptionRequiresExactHumanPin=true` 우선, 상속 budgetGuard 위임/봉투/잔액은 역사 |
| S-3 인벤토리 | **적정(허용 경로)** | 실행 중 capture 소스 불변, companion JSON + DISPOSITION에 부분성·제외 범위 명시. 이번 FINAL manifest가 `.codex/team-router` 2파일을 별도 pin해 그 시점 bytes는 고정됐다(실행 중 불변 증명은 아님 — 문서가 그렇게 적음) |
| S-4 input_refs | **적정** | 계획 `3a330d97…`·bundle `0a11db59…` 실측 일치 |
| S-5 커밋 분리 | **적정** | 일괄 stage 없음, 셸 변경만 선택적 commit 대상 명시, 디자인 실패는 디자인 트랙 귀속 |

## (3) C1/C2 local scope와 남은 실패의 영향 분리

계획 §6의 실제 요구는 "known failure는 PASS/면제가 아니고, **해당 로컬 변경과의 영향 분리·담당·재검증 조건을 독립 검토**하며, **동일 경계 실패·source drift·출력 누락으로 기준선을 검증할 수 없으면 차단**"이다. 이 기준으로 본다.

- **VERIFY-PREWORK-DB (②, 7건)** — 분리 **충분**. C1/C2의 실제 import closure(AC24 bundle 4모듈: workflow · routing-contract-audit · docs-graph-check · scenario)에 DB 접근이 없고, `node:fs`도 AC-24 VM에서 deny되어 fixture-only임이 실행으로 관측됐다. 처분의 원인 분석도 정확하다: 같은 `01_checksums`가 **fresh DB(④)에서는 4046.6909로 통과**하고 개발 DB에서만 4046.60이므로 "기대값이 낡았다"로 단정할 수 없고 DB 상태·국제 세금 활성 경계·fixture 차이 문제다. (제 v0.7 검수의 C14 단서는 "legacy 4046.69" 방향만 짚었는데, 이 원본이 보여주는 것은 상태 의존성이다 — 처분의 판단이 더 정확하다.) 담당·재검증·금지사항(reset·하향·일괄치환) 명시 ✓.
- **VERIFY-PREWORK-DESIGN (③ 색 대비)** — 분리 **충분**. `design-token-contrast.mjs`·tokens.ts는 closure 밖. 디자인 트랙 귀속·ancestry 검사 삭제 금지 ✓. 커밋 3개 stderr 실측 ✓.
- **③ 미도달 3항목** — 여기가 유일한 보강 지점(**D-1**). ③이 색 대비에서 끊겨 `docs-graph-check.mjs --activation`, `node --test scripts/docs-graph-check.test.mjs`, `admin-acl.test.sh`가 이 run에서 실행되지 않았다. 보충 CHECKS가 `--activation`(PASS)과 `admin-acl.test.sh`(mock)를 따로 돌렸지만 **`docs-graph-check.test.mjs`는 이번 회차 어디에서도 실행되지 않았다**(CHECKS 55의 subtest 목록에 없음). 그런데 `docs-graph-check.mjs`는 C1/C2 closure **안**의 모듈이다. 즉 "closure 안 모듈의 단위시험이 출력 누락 상태"라는, §6이 차단 사유로 든 형태와 겉보기가 같다.
  다만 실측으로 두 가지가 확인된다: (i) `TEAM-SERVICE-BASELINE-20260905-001.json`(Node 42, `bdebbebb`)이 pin한 `docs-graph-check.mjs` `3dcb6ee2…`·`docs-graph-check.test.mjs` `000cbb8f…`가 **현재 bytes와 동일**하고, (ii) 그 시험은 `mkdtempSync` fixture만 쓰고 실제 `docs/**`를 읽지 않는다(소스 3·99~195행). 따라서 결과가 바이트 동일 근거로 이전 가능하며 **실질 공백은 없다**. 하지만 DISPOSITION은 이 연결을 적지 않았다.
  **최소 선작업(둘 중 하나)**: (a) DISPOSITION/LIMITATIONS에 "③ 미도달 `docs-graph-check.test.mjs`는 BASELINE-20260905-001의 동일 bytes 결과(42/42)로 대체, fixture-only 확인"을 hash와 함께 한 줄 추가, 또는 (b) 같은 동결 트리에서 `node --test scripts/docs-graph-check.test.mjs` 1회를 보충 CHECKS에 추가. (b)가 더 단순하다. 이것이 닫히기 전까지는 "③ 미도달 항목 전부 보충 커버"라고 쓰면 안 된다 — 지금 문서는 그렇게 쓰지 않았으므로 과장은 아니고, 누락 연결의 문제다.
- **VERIFY-PREWORK-INVENTORY** — `PARTIAL_INVENTORY_EXPLICIT_NOT_WAIVED` 처리 적정. 다음 소비 전 좁은 경계 재현 또는 확장 snapshot을 요구한 것도 §6 취지와 맞다.
- **VERIFY-V07-SHELL** — 이번 실행이 곧 재현 증거다: `Bash 검증:` 로그 1회, ⑤가 1761.3초 **동기** 실행 후 23/23, ④ fresh 50/50. "수정·재현 완료 후보" 표기 적정.

**결론**: 남은 실패 3종은 모두 C1/C2 closure 밖이거나(DB·디자인) 바이트 동일 기준선으로 커버되며(D-1), 처분은 어느 것도 PASS/면제로 승격하지 않는다. 분리는 충분하다.

## Findings

- **D-1 · ③ 미도달 `docs-graph-check.test.mjs`의 커버 근거가 처분에 연결되지 않음 — P1(문서 연결 또는 1회 보충 실행)**. 위 상세.
- **D-2 · 실행 중 dirty 181→185의 4건 신원 미기재 — P2.** 전부 evidence/candidate 산출물임을 DISPOSITION에 한 줄.
- **D-3 · 후보002 `createdAt`이 `…T23:13:55+00:00` → `…T08:13:55+09:00`로 표기 변경 — P2(정보).** 같은 순간의 타임존 재직렬화라 의미 변화는 없지만 legacy 필드 바이트가 바뀐 것이므로 CLI 재직렬화 때문임을 후보에 주석.
- **D-4 · astra 가용성 `verified`의 근거가 자기 관측 + 호스트 카탈로그 진술 — P2.** 후보가 이미 "not provider attestation"이라 적어 과장은 아니다. P2 모델 게이트가 이 후보를 소비할 때 호스트 카탈로그 스냅샷 hash를 함께 pin하면 `EXACT_LOCAL_MODEL_SCOPE`의 "모델 가용성 검증" 요구가 기계적으로 닫힌다.

## LC-ADMISSION에 실제로 남은 것 (계획 §6·catalog 기준, 새 gate 없음)

| 요구 | 상태 | 남은 행위 |
|---|---|---|
| AC-24 ADMISSION run | 002 PASS, active run pin·재계산 검사 있음 | 없음(소비 시 pin 재대조는 spec이 수행) |
| `VERIFY_RUN_PINNED_INPUTS` | 실제 실행·HEAD·591 hash·단계·처분 연결 완료, 부분성 명시 | D-1 |
| `FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED` | 처분 문서 완성, 본 자문이 독립 읽기로 대조 | 이 자문이 그 요구를 **충족하는지는 gate 소유자 판단**. §8상 Cowork는 자문이며 typed receipt가 아니다 |
| `EXACT_LOCAL_MODEL_SCOPE` | 후보002 SEALED·VERIFIED, canonical 무변경 | 후보002를 로컬 범위 모델로 **소비하는 결정**(D-4 권고 포함). canonical 전환은 §9 |
| `FIXTURE_ONLY_BOUNDARY` | AC-24 closure·deny 관측·negative fixture | 없음 |
| `LOCAL_SCOPE_REVIEW` | 미수행 | **Fable formal 회차**(D-FABLE-SOFTCAP exact pin 선행). 이 문서가 대체하지 않음 |

P7 typed formal·PH/host 양성·live·전체 서비스는 이 prework의 선행조건이 아니며 여기서도 새로 만들지 않았다.

## 검수 한계
시험·DB 조회를 하지 않았다. cleanup 부재는 LIMITATIONS의 쿼리 기록을 신뢰한 것이다. 세션 원문·저장소 밖 Orchestrator 소스(`compute_budget`)는 읽지 않았고 후보002의 SHA 인용을 그대로 기록했다. 이 문서는 자문이며 CURRENT의 어떤 gate 값도 바꾸지 않는다.
