# P0-5-0135-ANON-SWITCH-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`

## 요약

0135 사후 확인 블록의 anon 전환 판별력 보정은 보안 관점에서 올바르다. `set local role anon`(l.141)이 예외 서브블록 밖으로 나왔으므로 전환 자체의 42501은 더 이상 `v_ok`를 세우지 못하고 migration을 즉시 중단시키며, `current_user <> 'anon'` 사후조건(l.142-144)이 남은 틈을 막는다. `v_ok`를 true로 바꿀 수 있는 유일한 경로는 서브블록 안의 `perform public.purge_entity_changes()`(l.145-149)뿐이라 공허한 통과는 제거됐다. 서브트랜잭션 의미론도 맞다 — role GUC를 서브블록 이전에 바꿨으므로 42501 롤백이 role을 되돌리지 않고, `set local role %I` 명시 복원과 복원 사후조건(l.153-156)이 `session_user`가 아닌 시작 역할로 돌아간다. SET ROLE 멤버십은 session_user 기준으로 검사되므로 login(NOINHERIT)→postgres→anon→postgres 체인은 login이 postgres의, postgres가 anon의 멤버이면 성립한다. 파괴 경로 분석: l.146이 실제로 행을 지우려면 anon에 EXECUTE가 있어야 하는데 l.127-129 정적 검사가 그 전에 중단시키고, 설령 도달해도 `v_ok=false`로 l.157에서 예외가 나 migration 트랜잭션 전체가 롤백된다. anon·PUBLIC 회수(l.74-75, 82-85, 108-109)와 authenticated·service_role 실행 계약(l.77, 110, 133-135, 168-175)은 약화되지 않았다. 0136(참조)의 기본권한 보정과도 충돌하지 않는다.

한계와 남은 항목: (1) 참조 경로 `P0-5-RPC-LEAST-PRIVILEGE-006/r002/candidate-review.json`은 스냅샷에 실체화되지 않아 읽지 못했고, 스냅샷에는 0135·0136만 있어 0001~0134 불변은 코드로 확인할 수 없고 증거 문서 진술에 의존한다. (2) 그 증거 문서의 새 절(l.112-138)은 verify 6/6, "0135 한 파일뿐" diff, 역할 체인 관측을 기술하지만 같은 문서의 앞 절(l.4-6, 67-76, 100)과 달리 commit SHA·blob OID·관측값을 전혀 결속하지 않았고 l.6의 "기준 commit"은 이 과제의 baseline과 다른 `817b6b3`이다 — Minor 1건으로 등록하고 결속 문안을 proposed_edits로 제안했다. (3) 개선 2건: 호스티드 세션 역할 체인 사전 관측(스테이징 재적용 전), 잡은 42501을 `sqlerrm`으로 청소 함수에 고정. Minor 1건이 남아 CHANGES_REQUIRED이며, 코드 자체의 보안 속성은 충족됐다.

## Findings

### P05-0135-EVIDENCE-SHA-BINDING-001 — Minor / OPEN

- 범주: POLICY
- 영향: 이 과제의 보안 판정 근거(정상 체인 통과·사보타주 42501·0134 DB 전체 실행·verify 6/6·0001~0134 불변)가 어느 commit·blob에 대한 것인지 재현·감사할 수 없다. 스테이징 재적용과 P0-5-6 원격 audit가 이 문서를 근거로 진행되므로, 결속이 없으면 이후 수정본과 증거가 뒤섞여도 구분되지 않는다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:112, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:3, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:67, AGENTS.md:24, COLLABORATION_LOG:0
- 완료 조건: 후속 보정 절에 baseline 9559b3bd7b7205663b067edfc5367bbfd5623d21, target 03cd3634f18e1d2314c204fcfd7a33bb0c385ccc, 0135 blob OID 8eb9f577adcf21e7a86c7d66146ae75e708dd340과 SHA-256을 명시한다. / 정상 체인의 관측된 (session_user, current_user) 4단계와 사보타주 역할의 정확한 오류 문구·SQLSTATE를 실제 출력 그대로 적는다. / '기준 commit 이후 migration 변경 파일이 0135 하나뿐' 주장을 비교한 두 SHA와 함께 적고, 후속 보정 상태 verify 6/6의 확인 시각을 기록한다. / 문서 머리(l.3-6)의 확인 시각·검증 commit이 최신 절과 일치하거나 절별 SHA로 구분된다.
- 필요한 테스트: Codex: 결속된 target SHA에서 0135 blob OID가 8eb9f577adcf21e7a86c7d66146ae75e708dd340인지 확인 / Codex: baseline↔target 사이 packages/db/supabase/migrations 변경 파일 목록이 0135 하나인지 확인 / Codex: 결속된 SHA에서 corepack pnpm verify 6/6과 fresh_% 잔여 0개 재실행

### P05-0135-HOSTED-ROLE-CHAIN-PRECHECK-001 — Improvement / OPEN

- 범주: SECURITY
- 영향: 스테이징 재적용이 0135 l.141에서 42501로 중단될지 여부가 실제 적용 시점에야 드러난다. 안전 방향(fail-closed)이라 보안 위험은 아니지만 배포 계획 가시성이 낮다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:91, packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql:141, docs/브랜치-DB-운영-기획안.md:284
- 완료 조건: 스테이징 재적용 계획 단계에서 같은 접속 경로로 session_user, current_user, pg_has_role(session_user,'anon','member'), pg_has_role(session_user,'postgres','member')를 읽기 전용으로 관측해 기록한다. / 관측 결과 anon 전환이 불가능하면 0135를 적용하기 전에 별도 결정으로 회부한다.
- 필요한 테스트: 스테이징 읽기 전용 세션에서 위 4개 값 조회(변경 없음)

### P05-0135-DENIAL-SOURCE-PIN-001 — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 행동 증거가 '청소 함수 실행 거부'가 아니라 '어떤 권한 거부'를 증명하는 수준에 머문다. 정적 검사와 결합하면 보안 결론은 유지되므로 차단 사유는 아니다.
- 근거: packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql:145
- 완료 조건: insufficient_privilege 처리에서 sqlerrm에 'purge_entity_changes'가 포함될 때만 v_ok를 세우고, 그렇지 않으면 원문 메시지를 포함해 예외로 중단한다. / 로컬 fresh DB와 업그레이드 경로에서 0135가 그대로 통과한다.
- 필요한 테스트: anon의 public 스키마 USAGE를 일시 회수한 사보타주에서 0135가 '청소 함수가 아닌 곳'으로 실패하는지 확인 후 원복

## 공동 편집 제안

### P05-0135-EVIDENCE-BIND-EDIT-001 — ADD

- 대상: `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`
- 위치: ### anon 전환과 실행 거부를 분리한 후속 보정
- 연결 Finding: P05-0135-EVIDENCE-SHA-BINDING-001
- 이유: required_evidence 1·5와 AGENTS.md l.24-25의 판본 연결 요구를 충족하도록 SHA·blob·관측값을 결속한다. SHA·blob 값은 과제 패킷의 확정값이며, 표의 관측값은 문서 l.126-132 진술을 옮긴 것이므로 작성자가 실제 출력과 다르면 실제 값으로 교체해야 한다.

    
    - 기준 commit: `9559b3bd7b7205663b067edfc5367bbfd5623d21`
    - 후속 보정 target commit: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`
    - `20260826000135_purge_and_anon_grants.sql` Git blob OID: `8eb9f577adcf21e7a86c7d66146ae75e708dd340`, SHA-256: `c9a12f03b7a16431479eb8fa26c37cbd40c999257174f1f689df1299836a0865`
    - 기준↔target 사이 `packages/db/supabase/migrations` 변경 파일: `20260826000135_purge_and_anon_grants.sql` 1개 (`git diff --name-only 9559b3b..03cd363 -- packages/db/supabase/migrations` 결과)
    - 후속 보정 상태 `corepack pnpm verify` 6/6 확인 시각: `<작성자가 실제 실행 시각으로 채움>`
    
    정상 체인 관측값(`select session_user, current_user` 실제 출력):
    
    | 단계 | session_user | current_user |
    |---|---|---|
    | 접속 직후 | `cli_role_chain_probe` | `cli_role_chain_probe` |
    | `set role postgres` | `cli_role_chain_probe` | `postgres` |
    | `set local role anon` | `cli_role_chain_probe` | `anon` |
    | `set local role postgres` (0135 복원) | `cli_role_chain_probe` | `postgres` |
    
    사보타주 관측값: `cli_anon_switch_probe`(postgres 미부여)에서 `set local role anon` → `ERROR: permission denied to set role "anon"` (SQLSTATE `42501`), 0135는 l.141에서 중단되고 `v_ok`는 설정되지 않음.
    

### P05-0135-DENIAL-PIN-EDIT-001 — REPLACE

- 대상: `packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql`
- 위치:   exception when insufficient_privilege then
- 연결 Finding: P05-0135-DENIAL-SOURCE-PIN-001
- 이유: 잡은 42501이 purge_entity_changes EXECUTE 거부임을 메시지로 고정해 행동 증거의 특이성을 높인다. 다음 줄 `v_ok := true;`는 그대로 둔다. 0135는 스테이징 미적용이라 제자리 수정 가능(브랜치-DB-운영-기획안 §4.2 l.215-217).

      exception when insufficient_privilege then
        -- 스키마 USAGE 거부 같은 다른 42501과 구분해, 청소 함수의 실행 거부만 센다.
        if position('purge_entity_changes' in sqlerrm) = 0 then
          raise exception '0135: anon 권한 거부가 청소 함수가 아닌 곳에서 났습니다: %', sqlerrm;
        end if;

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P05-0135-EVIDENCE-SHA-BINDING-001

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
