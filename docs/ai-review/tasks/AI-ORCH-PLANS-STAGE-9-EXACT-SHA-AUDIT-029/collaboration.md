# AI-ORCH-PLANS-STAGE-9-EXACT-SHA-AUDIT-029 공동 작업 장부

> 단계 9 물질화가 끝난 target commit을 읽기 전용으로 최종 감사한다. 비-Fable 턴은
> `corepack pnpm fable:append -- --task AI-ORCH-PLANS-STAGE-9-EXACT-SHA-AUDIT-029`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ORCH`
- reply_to_turn_id: `null`
- target_commit_sha: `84004577d060a8c4b8bcc1048dc1003a451410e3`
- baseline_commit_sha: `d14ce2a838e003a57983c3772fb8b3a5b730fc0a`
- historical_review_sha256: `d245477ada7561e49f4bc42de29c5b4ff832460fc82ba7102cf5138aceab2ff7`
- historical_improvement_ids: `ARCH-028-REGISTRY-HASH-TAMPER-TEST-GAP, ARCH-028-CONTEXT-BINDING-VALIDATION-LOOSE`
- 요청: 단계 9 최종 tree가 승인 범위, 원자 활성화, A0·Learning hash 결속, 운영 문서 최소권한, 외부 셸 비식별 기록, 세 플러그인 독립 경계, 사용자 파일 제외를 지키는지 감사한다.
- 실행 증거: activation graph PASS(29 files, 19 contexts), sabotage 12/12 PASS, network simulation 71/71 PASS, plugin test 10/10·29/29·9/9.
- 판정 계약: Task028의 두 Improvement는 역사적 점검표로만 대조한다. 현재 target의 문제만 새 OPEN Finding으로 기록하고 필수 OPEN Finding이 없으면 PASS를 반환한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE-9-EXACT-SHA-AUDIT-BUDGET-029`
- task_budget_usd_approved: `5.00`
- soft_budget_overrun_risk_accepted: `r001@5.00`
- 결정: 사용자의 순차 자동 진행, Fable 필수검수와 예산 재량 위임에 따라 단계 9 exact-SHA 독립 감사 1회를 실행한다.
- 위험 고지: provider soft cap은 결제 하드캡이 아니며 실제 사용액이 USD 5.00을 넘을 수 있다.
- 허용 범위: target commit 8400457의 단계 9 문서·검사기·비권위 manifest·운영 진입점과 기존 Fable 실패/PASS 계보의 읽기 전용 감사.
- 금지: 동일 목적 Opus 동시 호출, 같은 회차 자동 재호출, 제품·DB·배포·UI·프로토타입 변경, 단계 10 verify 연결.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY 예산 선택 · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`

## SOLAR_RESPONSE · turn-s002 · r002

- role: `SOLAR-ORCH`
- reply_to_turn_id: `turn-h001`
- failed_round: `r001`
- failed_run_sha256: `156f7b7015b5e0e3ffcc5ac9be81aed8f16e722e24b0c9c214cd044ec46c26f2`
- 진단: COMMIT snapshot에 허용되지 않는 `--single-pass`를 지정해 runner가 provider 실행 전에 exit 64로 거부했다.
- 비용·판정: claude_exit_code·total_cost_usd·verdict가 모두 null이므로 비용과 판정은 없고 실패 원본만 보존한다.
- 수정: target SHA·입력·역할·검토 요구·USD 5.00 Task cap은 유지하고 r002에서 `--single-pass`만 제거한다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h002 · r002

- role: `HUMAN`
- reply_to_turn_id: `turn-s002`
- finding_ids: `[]`
- decision_id: `DEC-AI-STAGE-9-EXACT-SHA-AUDIT-RUNNER-CORRECTION-030`
- soft_budget_overrun_risk_accepted: `r002@5.00`
- 결정: 사용자의 자동 진행·예산 재량 위임 범위에서 provider 미실행 r001의 단일 옵션 오류를 수정해 r002를 실행한다.
- 위험 고지: r002의 USD 5.00은 provider soft cap이며 결제 하드캡이 아니다.
- 불변: target commit, 입력 경로, Fable 역할, 금지 범위와 Task 전체 상한을 바꾸지 않는다.
- 금지: r001 삭제·판정 합성, 동일 목적 Opus 동시 호출, 추가 자동 재시도.
- 승인자·시각: `USER 위임에 따른 AI-DEPUTY runner correction · 2026-09-03 Asia/Seoul`
- next_review_request: `FABLE_REVIEW`
