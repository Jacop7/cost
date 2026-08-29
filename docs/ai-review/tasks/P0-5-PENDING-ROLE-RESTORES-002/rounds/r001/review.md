# P0-5-PENDING-ROLE-RESTORES-002 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `8466d12f20572c4590c5678f96130d080cd717ef`

## 요약

보안 핵심은 통과다. 0137·0138·0139·0144 네 파일 모두 0135와 같은 모양으로 (1) DO 블록 진입 시 `current_user`를 `v_original_role`에 보존하고, (2) `set local role authenticated`와 `current_user` 확인을 대상 호출의 예외 블록 **밖**에서 끝내며, (3) 예외 블록은 `insufficient_privilege`만 잡고 `sqlerrm`에 정확한 대상 이름(`close_due_business_days`·`close_business_day_row`·`business_day_revisions`)이 있어야 성공으로 세고, (4) `set local role %I`로 시작 역할을 명시 복원한 뒤 사후조건까지 확인한다. 전환 실패·스키마 USAGE 거부·무관한 42501은 모두 migration 중단으로 흐르며, 0144는 권한이 열렸더라도 트리거 42501 메시지에 표 이름이 없어 fail-closed다. 복원은 `set local`이라 트랜잭션 밖 세션 역할을 바꾸지 않고, 자기 자신·멤버 역할로의 SET ROLE 규칙상 NOINHERIT 로그인 체인에서도 성립한다. 0139 적용 표식은 4칸·7칸 들여쓰기의 두 코드 줄을 LF로 이어 확인하므로 주석·부분 문자열로는 통과하지 않고, 즉시 재적용 계약도 유지된다. 0145·0150·0151·0158·0163·0165의 CRLF 정규화는 비교용 문자열과 `pg_get_functiondef` 결과에만 적용되고 anchor 범위·치환 내용은 그대로라 계산·RPC·원장·판본 계약을 바꾸지 않는다. 증거 문서는 스테이징 재적용·원격 audit 미완료를 정직하게 적었다.

남은 것은 증거 결속 두 건(Minor)이다. ① 0144의 역할 전환·복원 검사는 `stores` 행이 없으면 통째로 건너뛰므로(179~180행) fresh DB에서는 실행되지 않고, "0137~0144 복원 확인" 집중 시험이 0144에 대해 공허했을 수 있다 — 매장 존재를 증거에 명시하거나 검사를 매장 의존 구간 앞으로 옮겨야 한다. ② 최종 검증 섹션은 `e41a927`에 결속돼 있고 검수 대상은 `8466d12`인데, 두 commit 간 migration blob 동일성과 "baseline 이후 변경 10개뿐" 주장이 앞 절들과 달리 blob OID·diff 없이 산문으로만 남아 있다. 개선 2건(0137의 raw 개행 분리자, 0145 §②-b 치환 무효 미검출)은 PASS를 막지 않는다.

## Findings

### P0-5-PRR-002-SEC-001 — Minor / OPEN

- 범주: TEST_GAP
- 영향: fresh DB(migration은 seed보다 먼저 돈다)와 매장이 없는 스테이징에서는 0144의 역할 전환·복원 경로가 한 번도 실행되지 않으므로, 집중 시험의 '0144 복원 확인'이 공허하게 통과했을 수 있다. 스테이징에 매장이 생긴 뒤 처음 실행되는 경로를 증거 없이 적용하게 된다.
- 근거: packages/db/supabase/migrations/20260826000144_amend_foundation.sql:179, packages/db/supabase/migrations/20260826000144_amend_foundation.sql:199, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:233
- 완료 조건: 증거 문서에 0144 집중 시험 당시 `stores` 행이 존재해 `set local role authenticated` 분기가 실제 실행·복원됐음을 관측값(전환 전후 current_user)과 함께 기록한다. / 또는 0144 사후 확인에서 감사 기록 쓰기 거부·역할 복원 검사를 `if v_store is null then return` 앞으로 옮겨 매장 유무와 무관하게 실행되게 하고, 그 상태에서 fresh DB 전체 migration과 verify 6/6을 다시 통과시킨다.
- 필요한 테스트: NOINHERIT 로그인 역할 체인 + 매장 1개가 있는 일회용 DB에서 0144 단독 적용 뒤 current_user 복원 확인 / 매장이 없는 fresh DB에서 0144 적용 시 역할 전환 분기 실행 여부를 notice 또는 관측값으로 확인

### P0-5-PRR-002-SEC-002 — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: 검수·보호 CI·스테이징 계획이 각각 다른 SHA를 보게 되면 '정확한 최종 구현 commit에서 verify 6/6'과 '스테이징 적용분 불변' 요구를 문서만으로 판정할 수 없다. 앞 절의 blob 결속 관행과도 어긋난다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:189, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:217, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:243
- 완료 조건: 증거 문서에 10개 보정 migration의 Git blob OID·SHA-256 표를 추가하고, `e41a927`과 검수 target `8466d12`에서 blob이 동일함(target과의 차이는 docs·장부뿐)을 명시한다. / `git diff --name-only 9e4f502..<target> -- packages/db/supabase/migrations` 결과가 정확히 10개 파일이며 0001~0136이 포함되지 않음을 문서에 기록한다.
- 필요한 테스트: git ls-tree로 두 commit의 10개 migration blob OID 비교 / baseline↔target migration diff 파일 목록 확인

### P0-5-PRR-002-SEC-003 — Improvement / OPEN

- 범주: CODE
- 영향: 현재는 자기 파일 안에서 일관돼 동작하나, 다른 줄끝으로 재정의된 함수를 검사하게 되면 주석 제외 필터가 무력화될 수 있다. 보안 영향은 없고 일관성 문제다.
- 근거: packages/db/supabase/migrations/20260826000137_close_due_cron.sql:246
- 완료 조건: 분리자를 `chr(10)`으로 바꾸고 `pg_get_functiondef` 결과의 CRLF를 LF로 정규화한 뒤 분리한다.
- 필요한 테스트: LF·CRLF clean checkout에서 0137 첫 적용 통과

### P0-5-PRR-002-SEC-004 — Improvement / OPEN

- 범주: CODE
- 영향: 현재는 0139가 LF로 넣은 두 줄과 정확히 맞아 문제가 없고 DB 시험 26번이 행동을 고정하지만, migration 자체는 치환 무효를 감지하지 못한다.
- 근거: packages/db/supabase/migrations/20260826000145_amend_ended_business_day.sql:220, packages/db/supabase/migrations/20260826000145_amend_ended_business_day.sql:210
- 완료 조건: 두 줄 결합 anchor의 존재를 먼저 확인해 없으면 예외로 중단하거나, 치환 후 `current_user in` 줄이 save_sale 코드 줄에 남아 있지 않음을 사후 확인에 추가한다.
- 필요한 테스트: 0139→0145 순서 첫 적용과 0145 재적용 통과 / DB 스위트 26번(기한 경과 시 저장 거부) 통과

## 공동 편집 제안

### P0-5-PRR-002-EDIT-001 — REPLACE

- 대상: `packages/db/supabase/migrations/20260826000144_amend_foundation.sql`
- 위치:   select id into v_store from public.stores limit 1;
- 연결 Finding: P0-5-PRR-002-SEC-001
- 이유: 역할 전환·거부 확인·복원 검사를 매장 존재 조건 앞으로 옮겨 fresh DB·빈 스테이징에서도 실제로 실행되게 한다. 이 편집을 적용하면 아래 199~219행의 기존 블록은 제거해야 한다.

      -- 감사 기록을 앱 롤이 직접 못 쓴다. 권한 값이 아니라 **실제로** 확인한다.
      -- ⚠ 매장 유무와 무관한 검사라 매장 의존 구간보다 **앞**에 둔다 — fresh DB 에서도 돈다.
      v_ok := false;
      set local role authenticated;
      if current_user <> 'authenticated' then
        raise exception '0144: authenticated 역할로 전환하지 못했습니다';
      end if;
      begin
        insert into public.business_day_revisions
          (business_day_id, revision_no, before_summary, after_summary)
        values (gen_random_uuid(), 1, '{}'::jsonb, '{}'::jsonb);
      exception when insufficient_privilege then
        if position('business_day_revisions' in sqlerrm) = 0 then
          raise exception '0144: 인증 권한 거부가 감사 기록 표가 아닌 곳에서 났습니다: %', sqlerrm;
        end if;
        v_ok := true;
      end;
      execute format('set local role %I', v_original_role);
      if current_user <> v_original_role then
        raise exception '0144: 감사 기록 검사 뒤 원래 역할을 복원하지 못했습니다';
      end if;
      if not v_ok then raise exception '0144: 앱 롤이 감사 기록을 직접 씁니다'; end if;
    
      select id into v_store from public.stores limit 1;

### P0-5-PRR-002-EDIT-002 — DELETE

- 대상: `packages/db/supabase/migrations/20260826000144_amend_foundation.sql`
- 위치:   -- 감사 기록을 앱 롤이 직접 못 쓴다. 권한 값이 아니라 **실제로** 확인한다.
- 연결 Finding: P0-5-PRR-002-SEC-001
- 이유: EDIT-001 로 앞당긴 검사와 중복되는 블록을 지운다.

    EDIT-001 적용 시 이 주석 줄부터 `if not v_ok then raise exception '0144: 앱 롤이 감사 기록을 직접 씁니다'; end if;` 까지의 기존 블록(199~219행)을 제거한다.

### P0-5-PRR-002-EDIT-003 — ADD

- 대상: `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`
- 위치: 이 결과는 스테이징 재적용 성공이나 원격 ACL 감사 완료를 뜻하지 않는다. 다음 단계는 이 정확한
- 연결 Finding: P0-5-PRR-002-SEC-002, P0-5-PRR-002-SEC-001
- 이유: 앞 절의 blob 결속 관행에 맞춰 검수 target·검증 commit·10개 변경 범위·0144 시험 조건을 검증 가능한 형태로 고정한다.

    #### 전진 보정 판본 결속
    
    - 검수 target commit: `8466d12f20572c4590c5678f96130d080cd717ef` — `e41a927`과의 차이는 docs·검수 장부뿐이며 아래 migration blob은 두 commit에서 동일하다(`git ls-tree`로 확인).
    - `git diff --name-only 9e4f502..8466d12 -- packages/db/supabase/migrations` 결과: 아래 10개 파일뿐이며 `0001~0136`은 포함되지 않는다.
    - 0144 집중 시험은 `stores` 행이 있는 일회용 DB에서 실행해 `set local role authenticated` 분기가 실제로 돌고 `current_user=postgres`로 복원됨을 관측했다. (관측값을 여기에 기록)
    
    | 파일 | Git blob OID (target) | SHA-256 |
    |---|---|---|
    | `20260826000137_close_due_cron.sql` | `c7225d32b353552ad7f4dddeb3ced68592898b7b` | `e9ea5db941b9531ddbceeb29d1eb74bc1a7e38f5029e40761327b67bca6f980c` |
    | `20260826000138_close_hardening.sql` | `ce3f5db76ccd49fbfa42fe316df6a0703b19760a` | `f95ce332334b9ff39c6c3e8aa079e7a9a47a4c6c52bbf2c5b3765d008967b642` |
    | `20260826000139_close_method_and_deadline.sql` | `cfc94578b3ee426048964ae95935938412b8e1cd` | `18da749f154e574ae65fba77e989542b4fda75dcb31dfae39d736115e04b4ac4` |
    | `20260826000144_amend_foundation.sql` | `d3c84062ac8dd61b2b7998e5a54df2a94b513045` | `6b3833aa0b47c0579a9165ea21039db79b5155ace5078994347f937b682da137` |
    | `20260826000145_amend_ended_business_day.sql` | `38216ca431f530e5f4c7b17903d4dc4c67781476` | `576445302906c7ad5f506dd1f21ff30eaf29368ea19cc3169ea67a9c6684a44e` |
    | `20260826000150_amend_boundaries.sql` | `60020cd6c3218711636d945784b4a1162774fcb7` | `66ae3dfe5ec388846d439bc7d51a3afb0095c7b3606424365bbff6a4ea4ba95b` |
    | `20260826000151_basis_backfill_and_guard.sql` | `67aaaf62ec29f1684135bbd73d562d94c8f62446` | `5a88536378982d0cf242052fc54f0daee2b343a3dc246904184616a524605e83` |
    | `20260826000158_retire_activity_tracking.sql` | `184e070fce44bd019f6d29cdbdd899ee4fc6be4e` | `3f3de1f261a822e3bc9b02111fecb23a18ea52fff8a46c4e36a2905149272c32` |
    | `20260826000163_rule_token_required_and_dst.sql` | `2d0ec6b5cb82b922181a744e18511f5d3acb22c0` | `f3aaaa9edaedd0753957f00d6a9e9a65d115949835fde3c68e814a38bc1af139` |
    | `20260826000165_store_bootstrap_and_acl.sql` | `9f2934ef1c833540c9626c8ddde9ea7a9eccbad5` | `b388ade2c245a5b2f2814c1d1dc9e13f2873bd0adba12967300684ac45614660` |
    
    위 OID·SHA-256 은 검수 입력 manifest 의 target 값이다. `e41a927` 의 같은 파일 blob 과 일치함을 확인한 뒤 이 표를 확정한다. 0144 를 EDIT-001 로 고치면 해당 행의 값은 새 commit 기준으로 갱신한다.
    

### P0-5-PRR-002-EDIT-004 — REPLACE

- 대상: `packages/db/supabase/migrations/20260826000137_close_due_cron.sql`
- 위치:       cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E'
- 연결 Finding: P0-5-PRR-002-SEC-003
- 이유: raw 개행 분리자를 chr(10) 으로 바꿔 checkout 줄끝과 무관하게 만든다. 바로 다음 줄 `') as line` 은 제거한다.

          cross join lateral regexp_split_to_table(
            replace(pg_get_functiondef(p.oid), chr(13) || chr(10), chr(10)), chr(10)) as line

### P0-5-PRR-002-EDIT-005 — REPLACE

- 대상: `packages/db/supabase/migrations/20260826000145_amend_ended_business_day.sql`
- 위치:   -- 조건 첫 줄을 통째로 바꾼다. 뒤의 `and v_status <> 'closed'` 부터는 그대로다.
- 연결 Finding: P0-5-PRR-002-SEC-004
- 이유: 치환 대상 두 줄이 정확히 존재할 때만 진행해 무효 치환을 감지한다. 기존 execute replace 문은 그대로 둔다.

      -- 조건 첫 줄을 통째로 바꾼다. 뒤의 `and v_status <> 'closed'` 부터는 그대로다.
      -- ⚠ 두 줄 결합 anchor 가 없으면 치환이 조용히 무효가 되고 기한 검사가 죽는다 — 중단한다.
      if position(v_old || chr(10) || '       and v_status <> ''closed''' in v_def) = 0 then
        raise exception '0145: 기한 검사의 역할 조건 두 줄을 못 찾았습니다';
      end if;

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P0-5-PRR-002-SEC-001, P0-5-PRR-002-SEC-002

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
