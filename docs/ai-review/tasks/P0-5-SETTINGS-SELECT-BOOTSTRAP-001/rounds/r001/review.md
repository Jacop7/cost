# P0-5-SETTINGS-SELECT-BOOTSTRAP-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `ff342e0890c4d05562d62ebfd14c6bd9246f4dd2`

## 요약

0164의 권한 부트스트랩 자체는 보안상 건전하다. `grant select` 뒤 `revoke insert, update, delete, truncate`를 anon·authenticated 모두에서 수행하고, 쓰기 정책 3개와 동기화 트리거를 제거하며, save_settings·save_store_tax는 SECURITY DEFINER + `set search_path` + 첫 줄 `assert_my_store`로 매장 경계를 유지한다. `has_table_privilege`는 PUBLIC 경유 권한까지 반영하므로 사후조건이 호스티드 역할 구성에서도 실질 권한을 판정한다. 직접 쓰기 문 재개방이나 RLS 우회는 발견되지 않았고, 스테이징 0163 상태·보정 미적용·운영 미접근 기록은 과장 없이 정직하다. 그러나 (1) 증거 문서는 verify 6/6·업그레이드 10/10을 `fb5b4b08`에 결속하고 있어 task target `ff342e08`과 다르며, 0164·upgrade-check.sh의 Git blob OID·SHA-256 결속도 없다 — 요구사항 6 "정확한 target commit의 verify 6/6 증거"가 문서상 충족되지 않는다(Major). (2) 0164 사후조건은 TRUNCATE를 검사하지 않아 요구사항 2의 네 종 폐쇄를 migration 스스로 증명하지 못한다(Minor). (3) SELECT 부여가 의존하는 settings RLS 활성·읽기 정책 존재를 사후조건이 단언하지 않는다(Minor). (4) 업그레이드 ⑩은 사전 상태를 SELECT=f만 확인하고 쓰기 4종 열림(f|t|t|t|t)을 단언하지 않아 회수 절반이 공허 통과할 여지가 있다(Minor). Major 1건으로 CHANGES_REQUIRED.

## Findings

### P0-5-SSB-001-SEC-001 — Major / OPEN

- 범주: OPERATIONS
- 영향: 요구사항 6 '정확한 target commit의 verify 6/6 증거'가 문서상 충족되지 않는다. target과 증거 commit 사이의 변경이 문서뿐인지 migration까지인지 검수자가 판별할 수 없고, 보호 CI·스테이징 계획이 참조할 판본 결속이 끊긴다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:333, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:373, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:294, COLLABORATION_LOG:0
- 완료 조건: 증거 문서 3차 절에 정확한 target commit `ff342e08…`(또는 그 후속 보정 commit)의 `corepack pnpm verify` 6/6, DB 34/34, 업그레이드 10/10, fresh_% 0개 재실행 결과를 commit SHA와 함께 기록한다. / 0164와 upgrade-check.sh의 해당 commit Git blob OID·SHA-256을 표로 고정하고, baseline `4454a79`→target의 `git diff --name-only -- packages/db/supabase/migrations` 결과가 0164 한 파일임을 명시한다. / fb5b4b08과 target 사이 변경 내용을 한 줄로 설명해 장부와 문서의 모순을 해소한다.
- 필요한 테스트: 정확한 target checkout에서 `corepack pnpm verify` 6/6 종료 코드 0 / 검증 종료 뒤 `fresh_%` 임시 DB 0개 확인

### P0-5-SSB-001-SEC-002 — Minor / OPEN

- 범주: SECURITY
- 영향: 요구사항 2(네 종 쓰기 폐쇄)를 0164가 호스티드 적용 시 스스로 증명하지 못한다. PUBLIC 경유 TRUNCATE 권한이 남아 있어도 0164가 통과하며, 0165가 나중에 `revoke all`로 덮지만 0164 단독 계약과 어긋난다.
- 근거: packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:21, packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:178, packages/db/scripts/upgrade-check.sh:454
- 완료 조건: 0164 사후조건에 `has_table_privilege('authenticated','public.settings','truncate')` 검사를 추가하고 실패 시 명확한 문구로 중단한다.
- 필요한 테스트: 0163 DB에서 `grant truncate on public.settings to public` 사보타주 후 0164가 사후조건에서 중단되는지 확인

### P0-5-SSB-001-SEC-003 — Minor / OPEN

- 범주: SECURITY
- 영향: SELECT 부여의 안전성은 RLS 활성과 읽기 정책에 전적으로 의존한다. 이번 사고처럼 호스티드 사전 상태가 로컬과 다를 때, RLS가 꺼져 있거나 읽기 정책이 없으면 교차 매장 설정 읽기(세금 항목·알림 설정) 또는 전면 읽기 불능이 조용히 통과한다.
- 근거: packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:19, packages/db/supabase/migrations/20260826000164_settings_lockdown.sql:183, packages/db/supabase/migrations/20260826000165_store_bootstrap_and_acl.sql:29
- 완료 조건: 0164 사후조건에 `pg_class.relrowsecurity` = true와 `pg_policy`에 polcmd='r'인 settings 정책 1개 이상 존재를 단언한다.
- 필요한 테스트: 0163 DB에서 `alter table settings disable row level security` 사보타주 후 0164가 중단되는지 확인

### P0-5-SSB-001-SEC-004 — Minor / OPEN

- 범주: TEST_GAP
- 영향: fresh-db.sh의 기본 ACL이 바뀌어 0163 상태에서 이미 쓰기가 닫혀 있으면 ⑩의 회수 검증이 공허하게 통과한다. '업그레이드 시험이 SELECT 부재와 쓰기 잔존을 실제로 구별하는가'라는 검토 질문에 스크립트 자체로는 답하지 못한다.
- 근거: packages/db/scripts/upgrade-check.sh:445, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:361
- 완료 조건: ⑩ 사전 상태를 select·insert·update·delete·truncate 5튜플로 읽어 정확히 `f|t|t|t|t`인지 단언하고, 아니면 '전제가 안 섰다'로 FAIL 처리한다.
- 필요한 테스트: upgrade-check.sh 10/10 재통과 / 0163 DB에서 쓰기를 미리 회수한 상태로 ⑩ 전제 FAIL이 나는지 확인

## 공동 편집 제안

### P0-5-SSB-001-EDIT-001 — ADD

- 대상: `packages/db/supabase/migrations/20260826000164_settings_lockdown.sql`
- 위치:   if not has_table_privilege('authenticated', 'public.settings', 'select') then
- 연결 Finding: P0-5-SSB-001-SEC-002, P0-5-SSB-001-SEC-003
- 이유: 요구사항 2의 TRUNCATE 폐쇄와 SELECT 부여가 의존하는 RLS 전제를 migration 자체가 호스티드에서 단언한다(SEC-002·SEC-003).

      if has_table_privilege('authenticated', 'public.settings', 'truncate') then
        raise exception '0164: settings TRUNCATE 가 아직 열려 있습니다';
      end if;
      if not (select relrowsecurity from pg_class where oid = 'public.settings'::regclass) then
        raise exception '0164: settings 에 RLS 가 꺼져 있습니다 — SELECT 부여가 매장 경계를 넘습니다';
      end if;
      if not exists (select 1 from pg_policy where polrelid = 'public.settings'::regclass and polcmd = 'r') then
        raise exception '0164: settings 읽기 정책이 없습니다 — 표시 폼을 못 읽습니다';
      end if;

### P0-5-SSB-001-EDIT-002 — REPLACE

- 대상: `packages/db/scripts/upgrade-check.sh`
- 위치:   "select has_table_privilege('authenticated','public.settings','select');")
- 연결 Finding: P0-5-SSB-001-SEC-004
- 이유: 사전 상태를 5튜플로 단언해 쓰기 회수 검증이 공허 통과하지 않게 한다. 이어지는 기존 `if [ "$before" != "f" ]` 줄은 이 REPLACE에 맞춰 제거해야 한다(SEC-004).

      "select concat_ws('|',
         has_table_privilege('authenticated','public.settings','select'),
         has_table_privilege('authenticated','public.settings','insert'),
         has_table_privilege('authenticated','public.settings','update'),
         has_table_privilege('authenticated','public.settings','delete'),
         has_table_privilege('authenticated','public.settings','truncate'));")
    if [ "$before" != "f|t|t|t|t" ]; then
      say "   FAIL 전제가 안 섰다 — 호스티드 사전 상태(f|t|t|t|t)가 아니다: $before"

### P0-5-SSB-001-EDIT-003 — ADD

- 대상: `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`
- 위치: ### 정확한 commit 전체 검증
- 연결 Finding: P0-5-SSB-001-SEC-001
- 이유: 증거를 정확한 target commit에 결속하고 blob·SHA 표를 고정한다. blob OID·SHA-256은 검수 입력 manifest 값이며, 실제 diff 요약과 재실행 결과는 SOLAR가 채워야 한다(SEC-001).

    ### target commit 판본 결속
    
    - 검수 target commit: `ff342e0890c4d05562d62ebfd14c6bd9246f4dd2`
    - `fb5b4b08…` 이후 변경: (여기에 실제 diff 요약을 적는다 — 문서만인지 migration 포함인지)
    - `git diff --name-only 4454a7988a8bfd60982a7b787b2a1f0943691cb3..ff342e0890c4d05562d62ebfd14c6bd9246f4dd2 -- packages/db/supabase/migrations` 결과: `20260826000164_settings_lockdown.sql` 1개
    
    | 파일 | Git blob OID | SHA-256 |
    |---|---|---|
    | `20260826000164_settings_lockdown.sql` | `78e48031ed3a4e44c7ae967dbabe53ee5eebfba9` | `a5dbb315bbafee7fb87a218496ec8d22d902911a57435d055d46649a68b3447c` |
    | `upgrade-check.sh` | `9a1d9ae082d1f97823bf51d235aef5574f79851b` | `495e46e4314e1d59c3a174c8bbcb4016ee46b970fbc2bb024664cb44d177531b` |
    
    위 target commit의 깨끗한 checkout에서 `corepack pnpm verify`를 재실행한 결과를 아래 절에 commit SHA와 함께 기록한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P0-5-SSB-001-SEC-001, P0-5-SSB-001-SEC-002, P0-5-SSB-001-SEC-003, P0-5-SSB-001-SEC-004

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
