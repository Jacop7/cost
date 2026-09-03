# AI-PLANS-SIM-FABLE-SINGLE-PASS-READY

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `LOCAL_READY / EXTERNAL_REVIEW_NOT_RUN`

Fable의 반복 cache read를 줄이기 위한 `--single-pass` 실행 모드를 구현했다.

- 대상: `WORKING_TREE_HASHED` Task
- 입력: 실행기가 만든 전체 `input-snapshot.json` 원문과 SHA-256을 프롬프트에 직접 봉인
- 턴: `--max-turns 1`
- 도구: 빈 목록
- 프롬프트 사전 제한: 2 MiB
- 비용 안전: 기존 fail-closed와 정확한 `soft_budget_overrun_risk_accepted` pin 유지
- 외부 Fable·Opus 호출 및 추가 비용: 없음

검증 결과:

- `node --check scripts/fable-review.mjs`: PASS
- `corepack pnpm fable:review -- --self-test`: 52/52 묶음 PASS
- 새 회귀시험은 입력 원문·SHA 포함, 한 턴, 도구 비활성화, snapshot 없는 Task 사전 거부를 확인한다.

단일 턴은 비용 절감 경로이며 provider 결제 하드캡은 아니다. 새 외부 실행에는 별도 사람 승인이
필요하다.
