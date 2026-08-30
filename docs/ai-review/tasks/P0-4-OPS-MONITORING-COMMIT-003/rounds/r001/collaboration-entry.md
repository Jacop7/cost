
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
