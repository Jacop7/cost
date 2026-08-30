# P0-4-OPS-MONITORING-COMMIT-004 공동 작업 장부

> 이 장부는 predecessor `P0-4-OPS-MONITORING-COMMIT-003` r001의 SEC-006~008을
> 보정한 commit `d3f25214ad43e06513b16570d223b6f6517e8c66`을 같은 보안 lane에서 재검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-o001`
- target_commit_sha: `d3f25214ad43e06513b16570d223b6f6517e8c66`
- predecessor_task_id: `P0-4-OPS-MONITORING-COMMIT-003`
- predecessor_review_sha256: `8ff65925d6bb7b6048ed84f7676143cd2c704997087612c5c79cb250a7559b41`
- inherited_finding_ids: `P0-4-OPS-SEC-006`, `P0-4-OPS-SEC-007`, `P0-4-OPS-SEC-008`
- artifact_hashes: 실행기의 COMMIT manifest가 target commit의 파일별 Git blob·SHA-256을 봉인한다.
- changed_artifact_paths: 0177 migration, DB 시험 36, 업그레이드 ⑬, Edge·CLI·GitHub 이슈 계약 시험, 운영 문서.
- 충족해야 할 요구사항·불변식: 실패-only Cron 거짓 초록 제거, Cron 장애와 비권위 RPC 경고 분리, Edge 비밀정보 비노출 회귀시험, 원장·계산 불변, production 미적용.
- 실행한 테스트·현재 증거: 정확한 구현 commit `4a2cbe2` 분리 checkout에서 `corepack pnpm verify` 6/6, DB 36/36, core 176, mobile 212, 새 DB·경합·업그레이드 13/13·웹 번들, migration 파일/장부 166/166, `fresh_%` 0개.
- 사람 결정이 필요한 항목: 없음. production 배포와 스테이징 장애 훈련은 이 검수와 정확한 SHA 보호 CI 뒤 별도 게이트다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r001 sha256=e925e37eebb6b65e996c2cf54ac7d250da05010432092f9cc7e4fdd8420fa65e -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `e925e37eebb6b65e996c2cf54ac7d250da05010432092f9cc7e4fdd8420fa65e`
- target_commit_sha: `d3f25214ad43e06513b16570d223b6f6517e8c66`
- input_files_sha256: `db7fa633f1108577a8f158865f9eb522fb18e35da36b4e0c1223aba36bfc48d8`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: P0-4-OPS-SEC-009
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

predecessor COMMIT-003의 SEC-006·007·008을 commit d3f2521의 봉인 입력으로 재검증했다. SEC-006(실패-only Cron 거짓 초록): 시험 36의 $failed_only$ 블록(133~164행)이 성공 이력 없이 failed 행만 넣고 purge 작업 healthy가 boolean false, cron.healthy=false, status=degraded임을 확인하고, $health$ 블록(97~103행)은 jobs 배열의 모든 healthy가 jsonb boolean임을 고정한다. 업그레이드 ⑬(577~649행)은 0176 상태에 실패-only 행과 앱 RPC 보고를 넣은 뒤 0177을 적용해 'false|degraded|true|t' → 실패 행 제거 후 'true|ok|true'를 요구하므로 NULL healthy 회귀가 마이그레이션 경로에서도 잡힌다. Edge(57~61행)와 CLI safeBody(11~16행)는 healthy·warning이 boolean이 아니거나 status와 cron 판정이 어긋나면 503 unavailable로 접어 fail-closed다. SEC-007(RPC 신호 분리): 시험 36(85~90행)이 버킷 20건에도 status는 Cron만 따르고 rpc.warning=true임을 확인하고, Edge는 warning=true에도 cron 정상이면 200, CLI ok=true, GitHub 동기화는 '[ops-health] staging rpc warning' 별도 제목·'Cron 장애나 정확한 오류율이 아닙니다' 본문으로 분리되며 workflow 실패는 health 단계(Cron)만 결정한다. 문서(cron-rpc-alerting.md 9~11·26·39~41행)가 판정 기준을 기술한다. 자가 가입 계정의 반복 보고는 이제 warning 이슈 갱신에 그치고 status·workflow를 바꾸지 못하므로 수용 기준을 충족한다. SEC-008: 계약 시험이 토큰 미설정 401(fetch 미호출), 설정 누락 503, 하위 500 본문에 sb_secret·eyJ가 있어도 503 {status:'unavailable'} deepEqual, throw 메시지에 secret이 있어도 동일 본문임을 고정한다. 세 Finding 모두 VERIFIED다. 한계: 실제 보정 SQL인 20260831000177_operations_health_signal_separation.sql은 artifact_paths·input_files에 없어 봉인 스냅샷에 존재하지 않는다. 판정은 봉인된 행동 시험·업그레이드 ⑬·Edge/CLI 방어와 장부의 4a2cbe2 실행 결과(verify 6/6, DB 36/36, 업그레이드 13/13)에 근거하며 0177 원문의 definer·search_path·grant 하이진은 직접 읽지 못했다(시험 36 7~16행이 ops_health_status의 service_role 전용 권한을 새 DB에서 고정한다). 현재 장부에는 SOLAR 턴만 있고 CODEX-FUNCTION-QA 턴이 없다. 이를 Improvement SEC-009로 남겨 다음 봉인 Task(스테이징 훈련 게이트)에 0177 원문을 포함하도록 요청한다. production 미접근·미적용 기록과 원장 불변(⑬ before/after 비교)은 범위 내 증거와 일치한다. PASS이나 외부 게이트는 열려 있다.

### 공동 편집 제안 색인

- P0-4-OPS-SEC-E010: ADD `packages/db/tests/36_operations_monitoring.sql` · select pg_temp.ok('청소 함수가 ops 버킷도 30일 뒤 지운다', · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
