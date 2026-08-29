
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `ca371309c71647464c619e9b9e3715d7d107bc2b345acf77e3ab3976b2e6ee0f`
- target_commit_sha: `710176c267a9874e58152880ade135970738f76a`
- changed_artifact_paths: `20260826000164_settings_lockdown.sql`, `upgrade-check.sh`, `P0-5 evidence`
- resulting_input_files_sha256: `successor r001 manifest에서 실행기가 봉인·검증 예정`

### P0-5-SSB-001-SEC-001
- disposition: `APPLIED`
- 적용 위치: P0-5 evidence의 `FABLE-SEC r001 지적 보정과 판본 결속`
- 적용 내용: 정확한 보정 구현 commit `710176c`에서 verify 6/6을 다시 실행하고 0164·upgrade-check Git blob OID·SHA-256, baseline migration diff, 최초 target과 이전 검증 commit 차이를 기록했다.
- 실행한 테스트: clean checkout `corepack pnpm verify` 6/6, DB 34/34, 업그레이드 10/10, fresh 0.
- 필요한 재검수: commit·blob·diff 결속 확인.

### P0-5-SSB-001-SEC-002
- disposition: `APPLIED`
- 적용 위치: 0164 사후조건
- 적용 내용: authenticated의 INSERT·UPDATE·DELETE와 함께 TRUNCATE 유효 권한도 검사한다.
- 실행한 테스트: PUBLIC TRUNCATE 부여 뒤 0164가 종료 코드 3과 정확한 직접 쓰기 오류로 중단.
- 필요한 재검수: PUBLIC 경유 TRUNCATE 탐지 확인.

### P0-5-SSB-001-SEC-003
- disposition: `APPLIED`
- 적용 위치: 0164 사후조건
- 적용 내용: settings의 `relrowsecurity=true`와 읽기 정책 `polcmd='r'` 존재를 단언한다.
- 실행한 테스트: RLS 비활성 뒤 0164가 종료 코드 3과 정확한 RLS 오류로 중단.
- 필요한 재검수: SELECT 부여의 RLS 전제 확인.

### P0-5-SSB-001-SEC-004
- disposition: `APPLIED`
- 적용 위치: upgrade-check.sh 시나리오 ⑩
- 적용 내용: 사전 권한 5튜플이 정확히 `f|t|t|t|t`인지 확인하고 아니면 전제 실패로 중단한다.
- 실행한 테스트: 업그레이드 10/10, 쓰기까지 미리 회수하면 `f|f|f|f|f`라 전제 불일치 확인.
- 필요한 재검수: 회수 경로의 비공허성 확인.

- next_review_request: `CODEX_EVIDENCE`
