# P0-4-OPS-MONITORING-COMMIT-003 공동 작업 장부

> 이 장부는 commit `53e6799ac3ad968b93d7b76c23551770db9b3186`의 Cron/RPC 운영 관측 경계를
> 독립적으로 다시 검수한다. 선행 Task의 실패·지적·수정 기록과 예산 종료 run은 삭제·덮어쓰지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `53e6799ac3ad968b93d7b76c23551770db9b3186`
- artifact_hashes: 실행기의 COMMIT manifest가 target commit의 파일별 Git blob·SHA-256을 봉인한다.
- changed_artifact_paths: `task.json`의 `artifact_paths` 전체
- 출발 상태: 선행 구현 Task r002의 다섯 Finding은 최종 commit에 반영됐다. 별도 commit 감사 Task `P0-4-OPS-MONITORING-COMMIT-002` r001은 결과 생성 전 `budget_exhausted`로 끝났고 verdict가 없다. 사용자가 승인한 별도 3.00 USD 상한으로 같은 최종 commit을 다시 검수한다.
- 충족해야 할 요구사항·불변식: `P0-4-OPS-1..7`, service-role 최소 권한, 오류 원문 비저장, 보고 상한 경합 안전, Edge 비밀 비노출, 장애를 성공으로 위장하지 않는 GitHub 작업, production 미적용.
- 선행 Finding 재검사: `P0-4-OPS-SEC-001` NOCODE/BADCODE CHECK 정렬, `002` 과도 Cron 상태, `003` 원문 detail 비전송, `004` 열린 이슈 최신순 조회, `005` Action commit SHA 고정.
- 집중 검토 질문: 다섯 수정이 행동 시험으로 실제 잡히는가? definer·ops ACL·사용자별 상한에 우회가 남았는가? Edge·workflow가 비밀값·내부 오류를 노출하거나 거짓 초록을 내는가? 정확한 RPC 오류율이라는 과장이 남았는가?
- 실행한 테스트·현재 증거: target commit에서 `corepack pnpm verify` 6/6 exit 0, DB 36/36, core 176, mobile 212, 업그레이드 12/12, migration 파일/장부 165/165, `fresh_*` 0개. 로컬 Edge는 무토큰 401·정상 200·Cron 3종 healthy를 확인했다.
- 사람 결정이 필요한 항목: production 배포는 범위 밖이다. 이 Task는 스테이징 배포 전 보안 게이트만 판정한다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=8ff65925d6bb7b6048ed84f7676143cd2c704997087612c5c79cb250a7559b41 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `8ff65925d6bb7b6048ed84f7676143cd2c704997087612c5c79cb250a7559b41`
- target_commit_sha: `53e6799ac3ad968b93d7b76c23551770db9b3186`
- input_files_sha256: `1114c3d7386452a2dfa8ffe14a00b5cbb1fca237b23609cc1370be60a1f60c0e`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P0-4-OPS-SEC-006, P0-4-OPS-SEC-007
- 선택 미종결 Finding: P0-4-OPS-SEC-008
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

최종 commit 53e6799의 운영 관측 경계를 보안 관점에서 다시 검수했다. 선행 r002의 다섯 지적은 모두 실제 코드와 행동 시험으로 제거됐다. SEC-001: 0176이 'NOCODE'/'BADCODE'로 정렬됐고(84·100행) 앱 기본값(rpcMonitoring.ts 26행)과 일치하며, 시험 36(35~49행)이 null·공백·형태 불일치 코드의 실제 저장 행을 확인하고 업그레이드 ⑫(559·567행)도 코드 없는 보고를 포함해 2건을 센다. SEC-002: 실패 집계가 status='failed'만 사용하고(186행) starting 행 양성 시험(98~122행)이 있다. SEC-003: 앱이 전송 전 code·details를 정규식으로 검사해 원문을 보내지 않으며(26~31행) 한글 사용자값 비전송·동기/비동기 실패 격리 시험이 있다. SEC-004: 열린 이슈를 updated 최신순으로 조회하고(28행) 계약 시험이 URL을 고정한다. SEC-005: checkout·setup-node가 전체 commit SHA로 고정되고 태그 회귀를 시험이 막는다. 그 밖의 경계도 견고하다: ops 스키마·표·ops_health_status는 service_role 전용이고 migration 자체 검증·시험 34/36·ACL 감사가 고정한다. Edge 함수는 토큰 미설정·불일치 401, 하위 실패는 모두 503 'unavailable'로 접어 secret/service 키와 내부 오류를 노출하지 않는다. 워크플로는 issues:write만 갖고 continue-on-error 뒤 별도 단계로 최종 실패시키며 production secret이 없다. 문서는 오류율이 아닌 client-reported 건수로 한정한다. 그러나 새 결함 하나가 PASS를 막는다. ops_health_status의 healthy 식은 last_success_at이 NULL이고 last_failure_at만 있을 때 SQL 3값 논리로 NULL이 되고, bool_and는 NULL을 무시하므로 다른 두 작업이 정상이면 cron.healthy=true·status=ok가 된다. 즉 배포 직후 유예 기간(1분 Cron 5분, 일 Cron 최대 30시간) 동안 매 실행 실패만 하는 작업이 초록으로 위장된다. 이는 P0-4-OPS-1·5의 '실패 판정·거짓 초록 금지'를 어기며 시험 36에는 실패만 있는 경로가 없다. 추가로 인증된 임의 계정(enable_signup=true)이 15분마다 직접 호출 한 번으로 status를 degraded에 고정해 GitHub 장애 이슈와 실패 run을 무한 유지할 수 있는 점을 Minor로, Edge 비밀 비노출 계약 시험 공백을 Improvement로 남긴다. Major·Minor 수정과 회귀시험 뒤 RECHECK가 필요하다. production 적용은 범위 밖이다.

### 공동 편집 제안 색인

- P0-4-OPS-SEC-E007: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·              and (last_failure_at is null or last_success_at >= last_failure_at) as healthy · 원문은 review.md 참조
- P0-4-OPS-SEC-E008: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·     select coalesce(bool_and(healthy), false), · 원문은 review.md 참조
- P0-4-OPS-SEC-E009: ADD `packages/db/tests/36_operations_monitoring.sql` · $grace$; · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

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

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- verified_commit_sha: `4a2cbe24ffce2c0d33ff0b194ae766cda6717634`
- finding_ids: `P0-4-OPS-SEC-006`, `P0-4-OPS-SEC-007`, `P0-4-OPS-SEC-008`
- focused_contracts: 실패-only Cron은 `healthy=false`·status degraded; client-reported RPC만 있으면 status ok·warning true; GitHub Cron 장애와 RPC 경고 이슈 분리; Edge 토큰·설정·하위 실패에서 secret·URL·내부 오류 비노출.
- full_gate: 정확한 구현 commit `4a2cbe24ffce2c0d33ff0b194ae766cda6717634`의 분리 checkout에서 `corepack pnpm verify` 6/6 exit 0. DB 36/36, core 176, mobile 212, CLI·ACL 보안, 새 DB 전체 migration·2세션 경합·locale parity, 업그레이드 13/13, 웹 번들 포함.
- migration_integrity: 개발 DB migration 파일/장부 166/166, 누락 0·초과 0, 최신 0177 일치. 검증 종료 뒤 `fresh_%` 임시 DB 0개.
- focused_test_results: `node scripts/ops-monitoring.test.mjs` 통과; DB 36과 업그레이드 ⑬ 통과; 응답 상태·boolean 형식 불일치는 Edge와 CLI에서 실패 폐쇄.
- audit_integrity: r001 CHANGES_REQUIRED 원본과 SEC-006~008 Finding은 수정·삭제하지 않았다. 수정은 새 0177 migration과 회귀시험으로 전진했고 응답·증거는 공식 append 경로로만 추가했다.
- remote_state: 이번 보정과 검증에서 스테이징·production은 접근·적용하지 않았다. 원격 배포는 successor PASS와 정확한 SHA 보호 CI 뒤 별도 승인 범위다.
- remaining_required_finding_ids: `P0-4-OPS-SEC-006`, `P0-4-OPS-SEC-007`
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`
