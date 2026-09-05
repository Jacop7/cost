# v0.6 독립 재검수 반환 기록

호출 설정: gpt-5.6-sol / ultra. 병렬 검수자가 반환한 본문을 아래 보존한다.
출처: 이 작업의 독립 검수 subagent. 제공자 서명/CLI attestation 또는 Fable/Opus formal receipt가 아니다.

---

독립 재검수 판정: **CHANGES_REQUIRED(범위 한정)**.

v0.5.1의 SV05-01/02/04/05/06/07/08은 계획 수준에서 해소됐고, SV05-03은 의도대로 미해소·격리돼 있습니다. 다만 v0.6에는 신규 완료증거 공백 2건이 있습니다. 따라서 구현·서비스·P0·정식 검수 PASS로 올릴 수 없습니다.

정확한 입력:

```text
commit 34cf2b4733cee4da6058f97e529d13a9a0ca81d8
plan       1c316f966283334e21de0688aa6dc7eddd59307194030b9c0b96220f1ded8783
acceptance b97645d6b97e704e0cf74d5fbd738a96b4310f8126639c6b34eeaa96d030b4bd
state      fbac6828ba2c13d2c422dee8e4a2cfdae370644a36d9ccc26f05a4e4cf9da824
host-md    933558d2706d3428497f6770c945967fb3abc8b80b1f625cfda33fde4649fd5a
host-json  bcb128ee8946582de605a83beaa9a47984d3540886da45440b7bcdf5521bc597
scope-002  f342695578d3968072b1fd6c7a5a93805bc20f1dc7580e64b48c60516e8ea21c
evidence-001 2287c16899944032ff12c2310aae7f1a5ef423f3535b7710c8430f70ff5c5945
evidence-002 c9530bba64279353c378e2dadd573e9c7057b68606b801b8d7b048405d8513d9
SV05 source  c64f99ec00827a8ea8584a9f10d0d385ca01955da5830f3a4a169b9305fcaade
```

신규 Finding:

- **SV06-01 — 차단(tier 2 승격·완료):** `COOPERATIVE_11_ROLE_FLOW`는 위협·금지 주장·선행 요구만 있고 완료를 판정할 기계 gate, case 집합, OBSERVED receipt 의미가 없습니다. `host-requirements-contract.json:164-193`은 이를 미채택·발송 불가로 안전하게 닫지만, `service-flow-acceptance.json:595-783`의 phase graph에는 이 제품 수준의 별도 경로가 없습니다. 현재 LC/C1·C2 진행을 막지는 않지만 tier 2 채택·완료 주장은 차단해야 합니다.
- **SV06-02 — 차단(C1/C2 독립 완료 판정):** 진입 분리는 올바릅니다(`plan:362-367`, `acceptance:965-978`). 그러나 `bounded_bugfix`에 완료 case ID·assertion·target-commit evidence 결속이 없습니다. 관련 의미 검사는 AC-12(`acceptance:263-292`)에 있으나 P4 gate(`681-695`)에 묶여 있어 P2b를 기다리지 않는 독립 C1/C2 완료 증거가 될 수 없습니다. 별도 조기 gate/case를 두거나 정확한 기존 시험·검증기·독립검수 receipt를 결속해야 합니다.

SV05 재확인:

| ID | 계획 수준 판정 | 근거 |
|---|---|---|
| SV05-01 | 해소 | plan·catalog 모두 AC-16/17을 `scripts/team-service.live.test.mjs`로 지정(`plan:427-428`, `acceptance:363-413`). 24개 매핑 전수 대조 결과 불일치 0. 실행 PASS는 미확인. |
| SV05-02 | 해소 | effect PK/UNIQUE가 `(task_id,effect_key)`, generation은 claim metadata로 분리(`plan:125-132`, `state:78-96,171-175`). |
| SV05-03 | 미해소·정상 차단 | caller/receipt/fence/UTC가 MISSING(`evidence-001:75-114`), plan은 P6 host 통합을 차단(`plan:222-225`), evidence-002도 `host_binding_available:false`(`146-151`). |
| SV05-04 | 해소 | APP_QUEUED는 SENT_UNCONFIRMED, provenance 검증 TARGET_ACK만 scope close(`plan:227-234`, `state:310-323`, `acceptance:295-316`). |
| SV05-05 | 해소 | root command_seq, authority 전체 필드, STOP/RESUME/CAS/replay 전이 구조화(`state:186-226,227-307`, `acceptance:419-447`). |
| SV05-06 | 해소 | 실제 owner read와 타 비관리자 denial, 경로·SDDL·checker·principal 증거 결속 명시(`plan:306-312`, `acceptance:535-564`). 단 AC-23은 NOT_EXECUTED. |
| SV05-07 | 해소 | 새 scope·requirements bundle·tool catalog raw hash·query provenance·양성 증거 요구 및 001 재사용 금지(`plan:292-297`, `acceptance:872-884`). |
| SV05-08 | 해소 | spec/execution evidence 구분, `service_ready:false`, 실행·구현·evidence 축을 명시(`acceptance:2-4,960-963`, `plan:399-408`). 실제 case는 모두 NOT_EXECUTED이므로 서비스 PASS는 없음. |

특별 점검 결과:

- Local admission 순환은 계획상 제거됐습니다. LC-ADMISSION은 `depends_on:[]`이고 AC-24/fixture runner를 PLAN_TEST로 먼저 만들 수 있습니다(`plan:362-366`, `acceptance:622-636`). 다만 gate는 아직 NOT_EXECUTED입니다.
- C1/C2는 P2b와 분리됐고 full P3로 계산하지 않습니다. 진입은 적절하지만 SV06-02의 완료증거 공백은 남습니다.
- HOST-SCOPE-001 음성 판정과 SHA는 보존됐습니다(`HOST-REQUIREMENTS.md:74-75`, `host-requirements-contract.json:271-276`, `evidence-002:140-149`).
- evidence-002가 관측한 plan hash는 현재 plan hash보다 이전 판본입니다(`evidence-002:71-82`). 문서가 스스로 v0.6 별도 재검수를 요구하고 001을 승격하지 않으므로 소급 양성 근거로 사용하지 않았습니다.

범위 제한: `git show 34cf2b4:<path>`만 사용했습니다. v0.7 작업본, 과거 R1~R4 자기평가, 구현 소스·시험 실행·후속 verify 결과는 판정에 섞지 않았습니다. 파일/DB/플러그인/endpoint/실제 send 변경은 없었습니다. 본 결과는 Sol advisory이며 Fable/Opus formal receipt가 아닙니다.
