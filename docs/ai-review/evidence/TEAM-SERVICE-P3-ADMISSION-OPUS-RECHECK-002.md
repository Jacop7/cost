# TEAM-SERVICE P3 admission Opus recheck 002

- 대상: `TEAM-SERVICE-P3-ADMISSION-RECHECK-CANDIDATE-002.json`
- 엔진/경로: Claude Opus 5 high, 기존 Cowork 독립검수 대화의 변경분 재검수
- 판정: `CHANGES_REQUIRED`
- 형식: 직접 채팅 자문 검수이며 formal CLI receipt가 아니다.

## 종결된 이전 차단

- B-1: 실제 workflow export 계약과 교차검사가 일치한다.
- B-2: P3 전용 AC-24 profile과 exact bundle이 존재한다.
- B-3: 비사람 역할 10개 보고 및 비권위 보고 경계가 고정됐다.
- B-5: candidate sidecar LF 규칙이 추가됐다.
- B-6: `effect_key`가 `task_id/subtask_id/work_spec_revision/effect_kind`로 교정됐다.

## 재검수 차단

1. R-1: CURRENT가 계획의 실제 SHA를 잘못 기록했다. 실제 값은 `e906c698b4850beb3ee444dc251e4947ec36ddc879e044c62b16febb9ab7118f`다.
2. R-2: AC-24 P3 TAP은 실행기의 원시 `node --test --test-reporter=tap` stdout가 아니므로 원시 출력과 exit code에 결속해야 한다.
3. R-3: 26개 집중시험 주장도 같은 방식의 원시 TAP/영수증이 필요하다.

## 비차단 후속

- 과거 P2b bundle과 현재 intent-store 바이트의 승계 관계를 주석으로 남긴다.
- P3 실행 영수증에 `module_sha256`을 직접 포함한다.
- 완료 전 effect-key 자기비교 2건을 route/leg 변화 음성 시험으로 강화한다.
- 완료 시 verify 3단계 비회귀와 계획상 14개 target 전체를 다시 묶는다.
- VM의 JSON `structuredClone` 대체 구현은 완료본에서 강화한다.

R-1~R-3를 해소한 뒤 동일 대화에서 변경분 재검수를 받아야 하며, 그 전에는 P3 구현 착수를 승인하지 않는다. `service_ready=false`, `real_send_authorized=false`를 유지한다.
