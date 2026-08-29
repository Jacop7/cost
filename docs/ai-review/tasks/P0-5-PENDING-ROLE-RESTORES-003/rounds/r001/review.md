# P0-5-PENDING-ROLE-RESTORES-003 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `515845aa9c382c41f456bd9cf3a04e30b63ef608`

## 요약

predecessor r001의 Finding 네 건을 같은 ID·severity·category로 재검수했고 모두 target `515845a`에서 충족돼 VERIFIED로 판정한다.

① SEC-001(0144 매장 의존): 사후 확인 DO 블록에서 authenticated 전환 → `current_user` 확인 → `business_day_revisions` insert 거부(sqlerrm에 표 이름 필수) → `set local role %I` 명시 복원 → 복원 사후조건 검사가 179~200행으로 옮겨져 `select id into v_store … if v_store is null then return`(202~203행)보다 앞에 놓였다. fresh DB·매장 0개 스테이징에서도 반드시 실행된다. 증거 문서 276~292행은 `0143`까지 올린 일회용 DB에서 `stores=0`을 확인하고 `LOGIN NOINHERIT` 역할 체인(`cli_p0144_probe → set role postgres`)으로 0144를 적용해 전후 `current_user=postgres` 관측값을 기록했으며, 183행의 자체 단언이 통과했으므로 전환 분기가 실제 실행됐음이 증명된다.

② SEC-002(판본 결속): 증거 문서 299~310행의 10개 migration blob OID·SHA-256 표를 이번 입력 manifest(target `515845a`)와 대조한 결과 10개 모두 정확히 일치한다. predecessor 검수 target `8466d12`의 blob과 비교하면 0137·0144·0145 세 파일만 바뀌었고(문서 314행 기술과 일치), 0138·0139·0150·0151·0158·0163·0165는 동일하다. `git diff --name-only 9e4f502..022b476 -- migrations`가 10개뿐이며 0001~0136이 포함되지 않음도 기록됐다. 구현 commit `022b476`과 target 사이의 차이는 blob 동일성으로 결속된다.

③ SEC-003(0137 분리자): 246~247행이 `pg_get_functiondef` 결과의 CRLF를 LF로 정규화한 뒤 `chr(10)`으로 분리하도록 바뀌어 checkout 줄끝과 무관하다.

④ SEC-004(0145 치환 무효): 229~232행이 `v_old || chr(10) || '       and v_status <> ''closed'''` 두 줄 결합 anchor의 존재를 먼저 확인하고 없으면 예외로 중단한다. 0139가 `concat_ws(chr(10), …)`로 같은 두 줄(267~268행, 7칸 들여쓰기)을 LF로 넣으므로 첫 적용은 일치하고, 226행의 조기 return으로 재적용 계약도 유지된다.

세 파일의 변경은 사후 확인·표식 검사에 국한돼 제품 계산·RPC·원장·판본 계약을 바꾸지 않는다. 증거 문서 316~329행은 정확한 구현 commit clean checkout에서 verify 6/6·업그레이드 9/9·`fresh_%` 0개를 기록했고, 스테이징은 `0136`까지·보정 미적용·운영 미접근이라는 실패 폐쇄 상태를 정직하게 적었다(264~265행, 328~329행).

PASS는 로컬 검수 통과일 뿐이며 스테이징 재적용·원격 ACL audit(P1-1:REMOTE-ACL-AUDIT)·보호 CI 게이트는 여전히 OPEN이다. 새 Finding은 없다.

## Findings

### P0-5-PRR-002-SEC-001 — Minor / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: 수용 기준 두 번째 항(검사를 매장 조건 앞으로 이동 + fresh DB 전체 migration·verify 6/6 재통과)과 첫 번째 항(매장 0개 역할 체인 관측값)이 모두 충족됐다. 0144의 183행 자체 단언이 통과했으므로 전환 분기가 실제로 실행됐음이 증명된다.
- 근거: packages/db/supabase/migrations/20260826000144_amend_foundation.sql:179, packages/db/supabase/migrations/20260826000144_amend_foundation.sql:202, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:276
- 완료 조건: 증거 문서에 0144 집중 시험 당시 `stores` 행이 존재해 `set local role authenticated` 분기가 실제 실행·복원됐음을 관측값(전환 전후 current_user)과 함께 기록한다. / 또는 0144 사후 확인에서 감사 기록 쓰기 거부·역할 복원 검사를 `if v_store is null then return` 앞으로 옮겨 매장 유무와 무관하게 실행되게 하고, 그 상태에서 fresh DB 전체 migration과 verify 6/6을 다시 통과시킨다.
- 필요한 테스트: NOINHERIT 로그인 역할 체인 + 매장 1개가 있는 일회용 DB에서 0144 단독 적용 뒤 current_user 복원 확인 / 매장이 없는 fresh DB에서 0144 적용 시 역할 전환 분기 실행 여부를 notice 또는 관측값으로 확인

### P0-5-PRR-002-SEC-002 — Minor / VERIFIED

- 범주: DATA_INTEGRITY
- 검증 엔진: FABLE
- 영향: 검수 target·구현 commit·baseline 사이의 migration 변경 범위가 blob OID·SHA-256으로 결속돼 문서만으로 '정확한 commit에서 verify 6/6'과 '스테이징 적용분 불변'을 판정할 수 있다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:294, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:312, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:316
- 완료 조건: 증거 문서에 10개 보정 migration의 Git blob OID·SHA-256 표를 추가하고, `e41a927`과 검수 target `8466d12`에서 blob이 동일함(target과의 차이는 docs·장부뿐)을 명시한다. / `git diff --name-only 9e4f502..<target> -- packages/db/supabase/migrations` 결과가 정확히 10개 파일이며 0001~0136이 포함되지 않음을 문서에 기록한다.
- 필요한 테스트: git ls-tree로 두 commit의 10개 migration blob OID 비교 / baseline↔target migration diff 파일 목록 확인

### P0-5-PRR-002-SEC-003 — Improvement / VERIFIED

- 범주: CODE
- 검증 엔진: FABLE
- 영향: 주석 제외 필터가 checkout 줄끝과 무관하게 동작한다. 검사 로직만 바뀌고 함수 정의·계약은 그대로다.
- 근거: packages/db/supabase/migrations/20260826000137_close_due_cron.sql:246
- 완료 조건: 분리자를 `chr(10)`으로 바꾸고 `pg_get_functiondef` 결과의 CRLF를 LF로 정규화한 뒤 분리한다.
- 필요한 테스트: LF·CRLF clean checkout에서 0137 첫 적용 통과

### P0-5-PRR-002-SEC-004 — Improvement / VERIFIED

- 범주: CODE
- 검증 엔진: FABLE
- 영향: 치환 무효가 조용히 통과하는 경로가 사라져 기한 검사의 역할 조건 제거가 보장되거나 migration이 중단된다.
- 근거: packages/db/supabase/migrations/20260826000145_amend_ended_business_day.sql:226, packages/db/supabase/migrations/20260826000139_close_method_and_deadline.sql:267
- 완료 조건: 두 줄 결합 anchor의 존재를 먼저 확인해 없으면 예외로 중단하거나, 치환 후 `current_user in` 줄이 save_sale 코드 줄에 남아 있지 않음을 사후 확인에 추가한다.
- 필요한 테스트: 0139→0145 순서 첫 적용과 0145 재적용 통과 / DB 스위트 26번(기한 경과 시 저장 거부) 통과

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
