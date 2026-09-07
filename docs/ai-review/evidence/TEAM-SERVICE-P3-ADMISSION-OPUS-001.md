# TEAM-SERVICE-P3-ADMISSION-OPUS-001

- 검수 엔진: Claude Opus 5 High, Cowork 직접 독립 자문
- 검수 대상: `TEAM-SERVICE-P3-ADMISSION-REVIEW-CANDIDATE-001.json`
- 후보 SHA-256: `f767ba98782a19703371aac8af88eb0827059c483636f56f8b417a161d9a71ea`
- 대상 commit: `d0d35ce5a6ec48abe15712632b5d500db93567a5`
- 대상 tree: `c46805466b588152f1fa8d94660d61431161e12e`
- 성격: direct Cowork advisory. formal CLI receipt나 provider attestation이 아니다.
- 저장소 변경 및 시험 재실행: 없음(검수자가 읽기 전용으로 수행)

## 판정

```yaml
overall_verdict: CHANGES_REQUIRED
implementation_may_begin: false
service_ready: false
real_send_authorized: false
formal_cli_receipt: false
```

## OPEN_BLOCKING

1. B-1 — P3 계약이 존재하지 않는 workflow export 세 개를 보존 대상으로 적었다. 실제 공개 API인
   `createServiceWorkflow`, `nextServiceAction`, `applyServiceEvent`를 고정하고 모듈과 직접 대조해야 한다.
2. B-2 — P3 전용 AC-24 입장 프로파일·정확한 번들·요구사항이 사전 선언되지 않았다. 구현 전 P3 프로파일과
   `phase_gates[P3].ac24_run_requirement`를 고정해야 한다.
3. B-3 — AC-06-A01의 비사람 10개 역할 보고 요구가 P3 계약에 없다.
4. B-4 — 모델 후보 007과 CURRENT의 계획 SHA가 실제 계획 바이트 `e906c698…`와 불일치한다.
5. B-5 — 후보 sidecar가 커밋 LF 바이트가 아닌 작업본 CRLF 바이트 SHA를 핀했다. 후보 sidecar에 LF 규칙이 필요하다.
6. B-6 — 현행 `effectKeyOf`가 전달 leg identity에서 키를 유도해 CEO·서비스 총괄의 동일 업무 배정이 서로 다른
   effect가 된다. 계획 정의 `SHA256(task_id, subtask_id, work_spec_revision, effect_kind)`에 맞추고 intent store와
   AC-10 재실행을 P3 범위에 편입해야 한다.

## OPEN_NONBLOCKING

1. N-1 — P3 완료 회차에는 raw TAP, stdout SHA, exit code가 필요하다.
2. N-2 — P3 계약시험은 자기 JSON 대조가 많다. 실제 workflow export와 live-isolation 소비자를 교차 검사해야 한다.
3. N-3 — Vitest live 제외는 실제 수집 경로 안의 음성 marker로 검증해야 한다.
4. N-4 — live launcher의 긍정 승인 조건을 P4 전에 명문화해야 한다.
5. N-5 — `phase_gates[P3].requires`를 채워야 한다.

## 범위 제한

이 판정은 P3 입장계획에만 적용한다. 실제 발송, Team Router runtime/endpoint, 앱 제품, DB/Supabase,
P4 이후, `service_ready`, full `pnpm verify` PASS를 승인하거나 주장하지 않는다.
