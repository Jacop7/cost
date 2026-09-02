# AI-PLANS-SIM-MODEL-TOKEN-OPUS-R1

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `CHANGES_REQUIRED` — Critical 2 / Major 7 / Minor 4, 후속 수정 적용·Opus 재검수 대기
> route: `OPUS_DIRECT_ADVISORY`
> Fable: 호출하지 않음 (`DEFERRED_NOT_WAIVED`)

## 1. 실행 계약

- 실행일: 2026-09-03 Asia/Seoul
- 기준 commit: `f3f79bc5e954f6bca81552eba6020d4464ecb4b3`
- Claude CLI: `2.1.250 (Claude Code)`
- 요청 모델·effort: `opus`, `high`
- 실제 canonical model: `claude-opus-5`
- 세션: `b5e6a13e-0b4e-41d8-a6b6-6202f1b8a3a6`
- 권한: 읽기 전용, restricted, safe mode, strict empty MCP, `Read,Glob,Grep`
- 회차 상한: USD 2.00
- terminal reason: `completed`
- stop reason: `end_turn`
- wall/API duration: 254,669 / 256,238 ms
- 보고 비용: USD 1.7365585
- Opus 사용량: input 16, cache creation input 103,724, cache read input 496,117,
  output 17,932(그중 thinking 9,998)
- CLI 보조 Haiku 사용량: input 2,675, output 41, 비용 USD 0.00288
- 전체 CLI 보고 비용: Opus USD 1.7336785 + 보조 Haiku USD 0.00288 = USD 1.7365585
- 장부 적용 비용: 센트 올림 USD 1.74
- permission denial: 없음
- subagent: 0

검수 입력 prompt는
`docs/ai-review/evidence/AI-MODEL-TOKEN-CONTRACT-OPUS-R1-PROMPT.md`에 보존했다. 최초 입력에는
Terra·Sol의 결론이나 자기변호를 넣지 않았다. Opus는 지정된 다섯 파일과 manifest 근거 한 곳만
읽었고 제품 파일을 수정하거나 명령을 실행하지 않았다.

## 2. 원 판정

`OVERALL_VERDICT: CHANGES_REQUIRED`

산술은 전부 일치했다. 12개 행 합계와 열 합계는 Terra 61, Sol 16, Opus 23, 총 100이며 누락 칸은
없다. Fable 경계의 기본 문구도 Opus가 `AGENTS.md`와 충돌하지 않는다고 판정했다. 다만 실행 차단과
기계 판독 필드가 부족해 Critical 2, Major 7, Minor 4를 열었다.

## 3. Finding과 disposition

| ID | 심각도 | Opus Finding 요지 | disposition |
|---|---|---|---|
| C-01 | Critical | 12단계 Opus 비용의 §8.2 귀속과 사전 사람 pin 부재 | §6.3에 모든 호출의 `OPUS_DIRECT_ADVISORY`·§8.2 귀속, 기존 누적 비초기화, 공식 장부의 `advisory_budget_usd_approved` 선행 pin, 잔액 부족 시 1단계 차단을 명시했다. |
| C-02 | Critical | Fable 보류 중 8~12단계 실행을 막지 못함 | 보류 중 1~7단계 `DRAFT_READY`까지만 허용하고 8단계 `ACTIVE`와 9~12 materialize·파일럿·역반영을 금지했다. |
| M-01 | Major | Task packet에 구조화된 `fable_budget_state` 없음 | `DEFERRED_NOT_WAIVED`와 근거 Decision ID를 추가하고 단계 증거 필수 필드에도 넣었다. |
| M-02 | Major | 새 사람 요청이 `request_dispositions[]`와 Decision ID에 없음 | `DEC-AI-TOKEN-MODEL-001`, `DEC-AI-FABLE-BUDGET-DEFER-001`을 붙인 seq 3·4 `ADD` 항목을 hash chain으로 append했다. |
| M-03 | Major | 새 세션 lease 인계 HANDOFF와 작업큐 배타 소유 증거 없음 | source commit의 SIM-1 YAML LF-normalized SHA-256을 가진 HANDOFF v1을 추가하고 완료된 PREWORK-1 lease를 `null`로 해제했다. |
| M-04 | Major | 바뀐 candidate manifest의 대상·계산법·이전 값 관계 없음 | `WORKING_TREE_HASHED`, 계산법, b4f79a6 predecessor hash와 근거 증거 경로를 구조화 필드로 추가했다. |
| M-05 | Major | Opus 무효 결과여도 다음 단계로 넘어갈 여지 | 유효 Opus 구조화 결과가 없으면 `REVIEW_PENDING`으로 차단하고 다음 단계로 전이하지 않게 했다. |
| M-06 | Major | `next_safe_action`이 Fable 보류와 충돌 | 현재 Finding 반영·재검증을 먼저 두고, 세 사람 Decision/pin 뒤에만 1단계 시작, Fable은 보류 해제 뒤 복원하도록 교체했다. |
| M-07 | Major | 실제 envelope `UNSET`이면 80/100/120 임계가 무발동 | `UNSET`을 실행 차단 상태로 정의했다. |
| m-01 | Minor | 표 머리글의 단위 모호 | 모든 수치 열에 `상대 점수`를 표시했다. |
| m-02 | Minor | Sol xhigh 선택 근거가 순환적 | xhigh 대상 판단 종류를 본문에 열거했다. |
| m-03 | Minor | 독립성을 사후 증명할 필드 없음 | 단계 증거에 `independence_attestation`을 추가했다. |
| m-04 | Minor | Fable 보류·Opus 대체 금지 stop condition 없음 | 두 조건과 미승인 12단계 실행 금지를 `stop_conditions`에 추가했다. |

## 4. HANDOFF·manifest 재현값

- HANDOFF source commit: `f3f79bc5e954f6bca81552eba6020d4464ecb4b3`
- source commit의 SIM-1 fenced YAML UTF-8·LF SHA-256:
  `57230b9a93d5d240116e40064ad583c0097f4fd0bc1dc5ced87563f2dc70381f`
- 이전 b4f79a6 후보 manifest:
  `35ad0825091c367de12e6d1d019e23ba19493f2ee07debebd1c04ef511a5dd39`
- Finding 반영과 검사기 강제 뒤 working-tree 후보 manifest:
  `300e778f25ebfd23c59f4b2877eaff67343ab65f9c54dde91fcc949199a47e33`
- candidate manifest 계산 규칙: `artifact_paths`에서 `docs/작업큐.md`를 제외하고 경로 정렬 후 각 파일을
  CRLF→LF 정규화해 SHA-256을 만들고 `path:hash` JSON 배열 전체를 다시 SHA-256한다.

## 5. 남은 상태

- Opus r1 원 판정은 PASS로 바꾸지 않는다. 위 수정은 Codex가 반영했으며 재검수 전 상태는
  `CHANGES_APPLIED_REVIEW_PENDING`이다.
- 이번 회차에서 Fable은 호출하지 않았고 Fable 완료·`VERIFIED`·`CLOSED`를 주장하지 않는다.
- 12단계 실행용 외부 비용 envelope는 `UNSET_FOR_12_STAGE_EXECUTION`이다. 공식 공동 장부 사람 pin 전에는
  1단계도 시작하지 않는다.
- 기존 장부의 승인 잔액 USD 0.63에 이번 회차 센트 올림 USD 1.74를 그대로 합치면 보수 누적은
  USD 23.11, 종전 승인 USD 22.00 대비 USD 1.11 초과다. 사용자의 이번 Opus 검수 지시는 route 실행
  요청이지만 공식 공동 장부의 `advisory_budget_usd_approved` 금액 pin은 아니므로
  `ADVISORY-BUDGET-PIN-MISSING-001`을 열고 추가 Opus 회차를 실행하지 않는다.
- 기존 `DEC-AI-LEASE-002`, `DEC-AI-ONTOLOGY-003`도 여전히 선행 사람 Decision이다.

## 6. 수정 후 Codex 검증

- `git diff --check`: PASS. Windows LF→CRLF 예정 경고만 있고 whitespace error는 없다.
- `corepack pnpm ai:plans:simulate`: 70/70 PASS.
- `corepack pnpm verify --no-db`: 선택 범위 4/6 PASS.
  - 타입: PASS
  - core 시험: 194 PASS, 12 skip
  - mobile 시험: 233 PASS
  - CLI·ACL·보호 gate 계약: PASS
  - 웹 Metro export: PASS
  - 새 DB·업그레이드: 의도적 skip이므로 전체 6/6 PASS가 아니다.

수정 후 SHA-256은 다음과 같다. 이 값은 Opus r1이 읽은 최초 snapshot hash와 구분한다.

- `docs/AI-오케스트레이션-상세기획안.md`:
  `eb63e4988253edb175e7b8948f3104184af351b64736053b50368c18110c2258`
- `docs/AI-품질-학습-자율성-평가기획안.md`:
  `34a259755902bc0974b73219f5a95494e83149c6e891829343494882001360ec`
- `docs/작업큐.md` 검증 직전 snapshot:
  `a0669f9879f589a457b9f1956c772949043ef6a6703c4040f0329d4d144ca2a3`
- `scripts/ai-plan-network-simulation.mjs`:
  `d82d4b2a6354617fbf6b01c9c70a93923d33061772fdc041eb607e0b1b944715`
- `scripts/ai-plan-network-simulation.test.mjs`:
  `1a5a228da0837f92a6a115978195172ccd47fdf3689d62f684142cfd3399ca0b`
