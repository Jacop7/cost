
<!-- fable-review:r002 sha256=54a76aceb59d13981136f0d898916b1776612f83bc820b4d3f5152ee65819d04 -->
## FABLE_REVIEW · turn-f002 · r002

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `54a76aceb59d13981136f0d898916b1776612f83bc820b4d3f5152ee65819d04`
- target_commit_sha: `95e521eb33eb9297801df3f724f80394315f6cb0`
- input_files_sha256: `75bfca6033ca2cc2ef8ca8fc9711367e6e99badd2d1f05a5a73e979cb0dc911b`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: P0-4-OPS-SEC-001, P0-4-OPS-SEC-002, P0-4-OPS-SEC-003, P0-4-OPS-SEC-004
- 선택 미종결 Finding: P0-4-OPS-SEC-005
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

보안 경계는 대체로 견고하다. ops 스키마·테이블·ops_health_status는 service_role 전용으로 잠겨 있고 migration 자체 검증과 시험 36·ACL 감사가 이를 고정한다. Edge 함수는 토큰 미설정·불일치 시 401, 하위 오류는 모두 503 'unavailable'로 접어 service/secret 키나 내부 오류를 노출하지 않으며, 워크플로는 continue-on-error 뒤 별도 단계로 최종 실패시켜 장애를 성공으로 위장하지 않는다. 문서도 오류율이 아닌 client-reported 건수로 한정한다. 그러나 차단급 결함 1건이 있다. report_client_rpc_error는 코드가 비어 있는 오류를 'NO_CODE'→'BAD_CODE'로 정규화하는데 두 값 모두 밑줄을 포함해 error_code 체크 제약 '^[A-Z0-9]{3,10}$'을 위반한다. 따라서 네트워크·전송 계층 실패처럼 SQLSTATE가 없는 예상 밖 오류(앱이 'NO_CODE'로 보내는 바로 그 부류)는 서버에서 23514 예외로 끝나 한 건도 기록되지 않고, fire-and-forget이라 앱에서도 조용히 사라진다. 시험 36·앱 시험 모두 코드 없는 보고의 서버 반영을 검증하지 않아 놓쳤다. 그 밖에 pg_cron의 과도 상태(starting/sending/connecting)를 실패로 세어 거짓 degraded 이슈가 열릴 수 있는 점, 앱이 원문 details를 형태 검사 없이 전송하는 점, GitHub 이슈 조회가 최근 100건으로 한정돼 장기적으로 회복 종료가 실패할 수 있는 점을 Minor로 남긴다. Major 수정과 시험 추가 뒤 RECHECK가 필요하다.

### 공동 편집 제안 색인

- P0-4-OPS-SEC-E001: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·   v_code text := upper(coalesce(nullif(btrim(p_code), ''), 'NO_CODE')); · 원문은 review.md 참조
- P0-4-OPS-SEC-E002: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·     v_code := 'BAD_CODE'; · 원문은 review.md 참조
- P0-4-OPS-SEC-E003: REPLACE `apps/mobile/src/lib/rpcMonitoring.ts` ·       p_code: error.code ?? 'NO_CODE', · 원문은 review.md 참조
- P0-4-OPS-SEC-E004: ADD `packages/db/tests/36_operations_monitoring.sql` · select pg_temp.eq_t('같은 오류는 같은 버킷에 합친다', · 원문은 review.md 참조
- P0-4-OPS-SEC-E005: REPLACE `packages/db/supabase/migrations/20260830000176_operations_monitoring.sql` ·                    (where d.status not in ('succeeded', 'running')) last_failure_at, · 원문은 review.md 참조
- P0-4-OPS-SEC-E006: REPLACE `scripts/sync-ops-health-issue.mjs` ·   const issues = await api('/issues?state=all&per_page=100'); · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->
