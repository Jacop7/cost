
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `8ff65925d6bb7b6048ed84f7676143cd2c704997087612c5c79cb250a7559b41`
- target_commit_sha: `4a2cbe24ffce2c0d33ff0b194ae766cda6717634`
- changed_artifact_paths: `20260831000177_operations_health_signal_separation.sql`, `36_operations_monitoring.sql`, `ops-health/index.mjs`, `check-ops-health.mjs`, `sync-ops-health-issue.mjs`, `ops-monitoring.test.mjs`, `upgrade-check.sh`, 운영 문서
- resulting_input_files_sha256: `successor r001 manifest에서 실행기가 봉인·검증 예정`

### P0-4-OPS-SEC-006
- disposition: `APPLIED`
- 적용 위치: 0177 `ops_health_status`, DB 시험 36, 업그레이드 시나리오 13, Edge·체크 응답 계약.
- 적용 내용: 성공 없이 실패만 있는 Cron은 `healthy=false`로 만들고 `bool_and(coalesce(..., false))`로 전체 판정을 닫았다. Cron 작업별 `healthy`와 전체 `cron.healthy`는 항상 boolean이며 응답 status와 Cron 판정이 어긋나면 Edge와 체크가 실패 폐쇄한다.
- 실행한 테스트: 실패-only Cron이 `degraded`, 작업별 healthy boolean, 업그레이드 0176→0177 시나리오, 새 DB 36/36.
- 필요한 재검수: SQL NULL 우회와 거짓 초록이 제거됐는지 확인.

### P0-4-OPS-SEC-007
- disposition: `APPLIED`
- 적용 위치: 0177 `ops_health_status`, `check-ops-health.mjs`, `sync-ops-health-issue.mjs`, 운영 문서.
- 적용 내용: 전체 status와 workflow 실패는 Cron 3종만 결정하고 client-reported RPC 신호는 `rpc.warning`으로 분리했다. GitHub 이슈도 `cron degraded`와 `rpc warning` 제목·본문·회복 흐름으로 나눴다.
- 실행한 테스트: RPC 보고만 있으면 HTTP 200·status ok·warning true, Cron 장애는 실패·별도 이슈, 두 이슈의 생성·갱신·회복 종료 계약.
- 필요한 재검수: 임의 인증 사용자의 RPC 보고가 Cron 장애 상태를 고정하지 못하는지 확인.

### P0-4-OPS-SEC-008
- disposition: `APPLIED`
- 적용 위치: `scripts/ops-monitoring.test.mjs`, Edge `ops-health/index.mjs`.
- 적용 내용: 토큰 미설정·불일치 401, URL·service key 미설정 503, 하위 non-OK·throw 503을 행동 시험으로 고정했다. 모든 실패 본문은 `{status:'unavailable'}` 또는 `{status:'unauthorized'}`만 반환하며 secret·URL·내부 오류를 노출하지 않는다.
- 실행한 테스트: `node scripts/ops-monitoring.test.mjs` 통과, 전체 verify ③의 `ops monitoring contract 통과`.
- 필요한 재검수: 비밀정보 비노출 부정 경로가 실제 테스트에 결속됐는지 확인.

- next_review_request: `CODEX_EVIDENCE`
