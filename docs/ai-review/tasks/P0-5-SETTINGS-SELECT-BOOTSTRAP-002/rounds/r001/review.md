# P0-5-SETTINGS-SELECT-BOOTSTRAP-002 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`

## 요약

predecessor Finding 4건을 같은 ID로 재검증했고 모두 VERIFIED다. (SEC-001) 증거 문서 389~451행이 최종 보정 commit `710176c`의 verify 6/6·DB 34/34·업그레이드 10/10·fresh_% 0개를 commit SHA와 함께 기록하고, 0164·upgrade-check.sh의 Git blob OID·SHA-256 표를 고정했으며, 그 값(`3f0cb476…`/`f9151ab0…`, `1754c179…`/`3c82982f…`)이 이번 target `e1da2a5c`의 검수 입력 manifest와 정확히 일치한다 — 즉 검증된 blob과 검수 대상 blob이 동일함을 검수자가 독립 확인할 수 있다. baseline diff가 0164 한 파일임과 fb5b4b08↔ff342e08 차이가 문서뿐임도 명시돼 장부·문서 모순이 해소됐다. 이전 실패 기록(331~387행)은 덮어쓰지 않고 보존됐다. (SEC-002) 0164 사후조건 178~183행이 insert·update·delete·truncate 네 종을 `has_table_privilege`로 검사하고, PUBLIC TRUNCATE 사보타주 시 종료 코드 3으로 중단한 기록이 있다. (SEC-003) 187~196행이 `relrowsecurity`=true와 polcmd='r' 정책 존재를 단언하고, RLS 비활성 사보타주 중단 기록이 있다. 197행은 polcmd<>'r'로 ALL('*') 정책까지 쓰기로 취급해 빈틈이 없다. (SEC-004) upgrade-check.sh ⑩ 446~455행이 사전 5튜플을 정확히 `f|t|t|t|f|`가 아닌 `f|t|t|t|t`로 요구하고 불일치 시 '전제가 안 섰다' FAIL 처리하며, 쓰기 선회수 상태(f|f|f|f|f)가 전제 실패로 구분됨을 문서가 기록한다. 보안 관점의 신규 결함은 없다: SELECT 부여는 RLS·읽기 정책 단언에 결속되고, save_settings·save_store_tax는 definer + search_path + 첫 줄 assert_my_store를 유지하며, 스테이징 0163·운영 미접근 기록은 정직하다. 사소한 보완으로 710176c→e1da2a5c 사이 변경이 문서뿐임을 한 줄 명시하는 proposed_edit을 제안한다(비차단). Blocker~Minor 미해결 없음 → PASS. 외부 게이트(보호 CI·스테이징 적용)는 여전히 OPEN이다.

## Findings

### P0-5-SSB-001-SEC-001 — Major / VERIFIED

- 범주: OPERATIONS
- 검증 엔진: FABLE
- 영향: 정확한 보정 commit의 verify 결과와 artifact blob·SHA가 검수 입력 manifest와 일치해 판본 결속이 복원됐다. 장부와 문서의 모순이 해소돼 보호 CI·스테이징 계획이 참조할 판본이 명확하다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:389, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:407, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:438, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:331
- 완료 조건: 증거 문서 3차 절에 정확한 target commit `ff342e08…`(또는 그 후속 보정 commit)의 `corepack pnpm verify` 6/6, DB 34/34, 업그레이드 10/10, fresh_% 0개 재실행 결과를 commit SHA와 함께 기록한다. / 0164와 upgrade-check.sh의 해당 commit Git blob OID·SHA-256을 표로 고정하고, baseline `4454a79`→target의 `git diff --name-only -- packages/db/supabase/migrations` 결과가 0164 한 파일임을 명시한다. / fb5b4b08과 target 사이 변경 내용을 한 줄로 설명해 장부와 문서의 모순을 해소한다.
- 필요한 테스트: 정확한 target checkout에서 `corepack pnpm verify` 6/6 종료 코드 0 / 검증 종료 뒤 `fresh_%` 임시 DB 0개 확인

### P0-5-SSB-001-SEC-002 — Minor / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: 0164가 호스티드 적용 시 네 종 쓰기 폐쇄를 스스로 증명한다. PUBLIC 경유 TRUNCATE 잔존도 실패 폐쇄된다.
- 근거: packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:178, packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:21, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:429
- 완료 조건: 0164 사후조건에 `has_table_privilege('authenticated','public.settings','truncate')` 검사를 추가하고 실패 시 명확한 문구로 중단한다.
- 필요한 테스트: 0163 DB에서 `grant truncate on public.settings to public` 사보타주 후 0164가 사후조건에서 중단되는지 확인

### P0-5-SSB-001-SEC-003 — Minor / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: SELECT 부여가 RLS 활성·읽기 정책 존재에 결속돼, 호스티드 사전 상태가 로컬과 달라 RLS가 꺼져 있거나 읽기 정책이 없으면 교차 매장 읽기나 전면 읽기 불능이 조용히 통과하지 않는다.
- 근거: packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:187, packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:197, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:431
- 완료 조건: 0164 사후조건에 `pg_class.relrowsecurity` = true와 `pg_policy`에 polcmd='r'인 settings 정책 1개 이상 존재를 단언한다.
- 필요한 테스트: 0163 DB에서 `alter table settings disable row level security` 사보타주 후 0164가 중단되는지 확인

### P0-5-SSB-001-SEC-004 — Minor / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: fresh-db.sh 기본 ACL이 바뀌어 0163 상태에서 쓰기가 이미 닫혀 있으면 ⑩이 전제 FAIL로 드러내며, SELECT 부재와 쓰기 잔존을 스크립트 자체가 구별한다.
- 근거: packages/db/scripts/upgrade-check.sh:445, packages/db/scripts/upgrade-check.sh:459, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:433, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:447
- 완료 조건: ⑩ 사전 상태를 select·insert·update·delete·truncate 5튜플로 읽어 정확히 `f|t|t|t|t`인지 단언하고, 아니면 '전제가 안 섰다'로 FAIL 처리한다.
- 필요한 테스트: upgrade-check.sh 10/10 재통과 / 0163 DB에서 쓰기를 미리 회수한 상태로 ⑩ 전제 FAIL이 나는지 확인

## 공동 편집 제안

### P0-5-SSB-002-EDIT-001 — ADD

- 대상: `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`
- 위치: 아래 값은 워킹트리가 아니라 `710176c267a9874e58152880ade135970738f76a`의 Git blob bytes를
- 연결 Finding: P0-5-SSB-001-SEC-001
- 이유: 710176c(전체 검증 commit)와 e1da2a5c(재검수 target) 사이 변경이 문서뿐임을 한 줄로 못 박아, 다음 라운드에서 같은 판본 결속 질문이 반복되지 않게 한다. 비차단 보완이며 SEC-001 VERIFIED 판정에는 영향이 없다.

    재검수 target commit은 `e1da2a5c7402a082d4ed374844da9d4d7d7e85f5`이며, `710176c`와의 차이는 이 증거 문서 한 파일뿐이다. 아래 blob OID·SHA-256은 두 commit에서 동일하다(재검수 입력 manifest와 일치 확인).

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
