# P0-5 RPC 최소 권한 검증 증거

- 확인 시각: `2026-08-29T15:36:00+09:00`
- 최초 구현 commit: `59077f01ec369a1683b5dbb1fba0dd717824d577`
- Fable 지적 보완·검증 commit: `84c7c60f6eed2ccac964d356a97e3b0910a74a4c`
- 기준 commit: `817b6b305352ad297289cd8270daba5e4b30d9ad`
- 원격 적용: 없음. 개발 DB와 일회용 로컬 DB만 사용했다.
- 원격 감사 결정: P0-5-6은 이 문서에서 통과로 간주하지 않는다. 동일 SHA 보호 CI와
  FABLE-SEC 재검수가 끝난 뒤 스테이징에 적용하고 `admin-acl.sh --remote audit`으로 별도 판정한다.

## 변경 계약

- `authenticated`가 실행할 수 있는 `public` 함수는 모바일 RPC 62개와 온보딩·보존 정책 문 2개를
  합친 정확한 facade 64개다.
- 내부 함수는 로그인할 수 없고 RLS를 우회하지 않는 `sikjae_rpc_executor`만 실행한다.
- `authenticated`는 이 역할로 전환할 수 없고, 실행 역할만 `authenticated`의 RLS 권한을 상속한다.
- 실행 역할에는 앱에 열리지 않은 `postgres` 소유 SECURITY DEFINER 유지보수 함수가 0개다.
  미래 함수도 실행 역할에 자동 공개하지 않으며, facade가 필요한 내부 도우미만 검토한 migration에서
  정확한 시그니처로 연다.
- 원장·확정값 10개 표의 앱 롤 `INSERT`·`UPDATE`·`DELETE`·`TRUNCATE`는 모두 닫혀 있다.
- 공식 facade는 요청 JWT의 `auth.uid()`와 RLS 매장 경계를 유지한다.

## 정확한 commit에서 재현한 검증

`84c7c60f6eed2ccac964d356a97e3b0910a74a4c`에서 `corepack pnpm verify` 한 실행으로 다음
6단계가 모두 종료 코드 `0`으로 통과했다.

1. 타입 검사
2. core `177`(2 skip) · DB `34/34` · mobile `199` 시험
3. CLI 계약·ACL 셸 보안
4. 새 DB 전체 마이그레이션·DB `34/34`·ACL metric `21`개·2세션 경합·locale parity
5. 업그레이드 경로 `9/9`
6. 웹 번들

같은 실행과 종료 뒤 `fresh_%` 임시 DB는 `0개`였다. 개발 DB의 마이그레이션 파일과 장부는
`163/163`, 최신 버전은 `20260829000174`다. 생성 타입은 재생성했으며 공개 시그니처 변화가 없어
Git 변경은 생기지 않았다.

ACL 감사의 핵심 관측값은 다음과 같다.

```text
rls_disabled_app_tables=0
ledger_write_paths=0
unapproved_authenticated_rpc=0
facade_rpc_missing=0
rpc_executor_role=1
rpc_executor_facades_invalid=0
rpc_executor_privileged_maintenance=0
rls_policy_helper_calls=0
```

## 판별력 확인

개발 DB에서 권한을 고의로 망가뜨리고 매번 원복한 뒤 기준 시험을 다시 통과시켰다.

| 사보타주 | 잡힌 단언 |
|---|---|
| `consume_stock`을 `authenticated`에 재개방 | 공식 facade 64개뿐이다 |
| `inventory_states UPDATE`를 재개방 | 원장 10개 × 쓰기 4종 권한 0개 |
| 실행 역할 상속 방향을 반대로 변경 | 실행 역할은 authenticated 권한을 상속한다 |
| `close_due_business_days`를 실행 역할에 재개방 | 전 매장 자동 마감 행동 단언이 “성공했다”로 실패 |
| 실행 역할에 `BYPASSRLS` 부여 | 실제 `get_settings(foreign_store)` 교차 매장 행동 단언 실패 |

마지막 두 사보타주는 유지보수 회수를 0174에 통합한 뒤 새로 실행했다. 각 원복 후
`34_rpc_least_privilege.sql`과 ACL 감사는 다시 통과했고 실행 역할의 `rolbypassrls=false`를 확인했다.

## Git blob·SHA-256 결속

아래 값은 워킹트리 파일이 아니라 검증 commit `84c7c60`의 Git blob bytes를 직접 읽어 계산했다.

| 파일 | Git blob OID | SHA-256 |
|---|---|---|
| `20260829000174_rpc_least_privilege.sql` | `bd026a9d013da09580b2fe331ae51c173a8c2661` | `9cb317a3fb4d695752e24efe5c1a0d015cae711fa61ea8094f0db473a0db6591` |
| `34_rpc_least_privilege.sql` | `c398c1b25e5a874ebb02801f3e3e368181916a94` | `9b7202bac68fe433b0025dc6c7f71be1f6a777009578f6cf8a7592ea61ba8a6d` |
| `admin-acl-audit.sql` | `526abbd27b3bb6ff4c53f117e85b71f428e8b194` | `09fa1ece52d7e2ff6cc06355fd23c5b0b6ca57343623fba7cb33348b90cc827f` |
| `admin-acl-audit.test.mjs` | `0b670ad863698bba40944550771f77ca5f467bbd` | `dcaadd9a993b3f9cab0b92abd95b827efa883ca6c156cacf5b863ae696bd1e29` |

이 문서는 로컬 검증 결과를 요약한 증거다. 운영·스테이징 적용 승인, 원격 ACL 통과 또는
P0-5-6 완료를 뜻하지 않는다.

## 스테이징 첫 적용과 0135 역할 복원 보정

- 대상: 스테이징 `cvfvmpzcldyqurcrappu` (운영 `smxaozdgoxbafjldoayb`에는 접근·적용하지 않음)
- 최초 승인 SHA: `630f2d1421b5fe65349493fa1f865f3a48f41990`
- 최초 계획: 원격 장부가 비어 있어 migration `163개`가 적용 예정이었다.
- 실제 결과: `0001~0134`는 적용·기록됐고, `0135` 마지막 사후 확인에서
  `permission denied for function assert_no_rpc_overloads (SQLSTATE 42501)`로 중단됐다.
- 중단 뒤 재계획: 원격 장부는 `0134`까지이며 `0135~0174` 정확히 `40개`가 남았다.
- 실패 폐쇄: 배포 가드는 성공 증거를 만들지 않았고 운영 DB에는 아무 변경도 없었다.

원인은 Supabase CLI가 별도 `NOINHERIT` 로그인 역할로 접속한 뒤 `postgres`로 전환해 migration을
실행하는데, `0135`의 `reset role`이 migration 시작 역할이 아니라 로그인 역할로 돌아간 것이었다.
로컬에서 같은 역할 구조를 만들어 다음을 재현했다.

1. `cli_login_probe LOGIN NOINHERIT`를 만들고 `postgres` 멤버십을 부여한다.
2. 로그인 역할에서 `set role postgres` 후 `set local role anon`을 실행한다.
3. 옛 `reset role` 뒤에는 `current_user=cli_login_probe`가 되어 마지막 사후 확인이 `42501`로 실패한다.
4. 시작 시점의 `current_user`를 보존하고 그 역할로 명시적으로 복원하면 전체 `0135`가 통과한다.

보정 commit `36761e3`은 `0135` 안에서 시작 역할을 `v_original_role`로 보존하고 익명 실행 검사가
끝난 뒤 정확히 그 역할로 복원하며, 복원 실패 자체도 예외로 중단한다. 이미 스테이징에 적용된
`0001~0134`는 수정하지 않았다. 보정 상태에서 다음을 확인했다.

- 위 `NOINHERIT` 역할 재현: 옛 코드 실패, 보정 코드 통과
- 로컬 DB 전체 reset과 seed 성공
- `corepack pnpm verify` 6/6: DB `34/34`, ACL metric `21`, 업그레이드 `9/9`, 웹 번들 포함
- 검증 종료 뒤 `fresh_%` 임시 DB `0개`

이 절도 스테이징 재적용 성공이나 P0-5-6 원격 audit 통과를 뜻하지 않는다. 보정 commit의 FABLE-SEC
재검수와 동일 SHA 보호 CI가 끝난 뒤 스테이징의 남은 `40개`를 다시 계획·적용한다.

### anon 전환과 실행 거부를 분리한 후속 보정

Fable 후보 검수에서 첫 보정의 행동 검사가 `set local role anon` 실패와
`purge_entity_changes()` 실행 거부를 같은 `insufficient_privilege`로 셀 수 있음을 지적했다.
보안 속성은 정적 권한 검사도 별도로 고정하지만, 행동 증거가 공허하게 통과하지 않도록 다음처럼
분리했다.

1. `set local role anon`을 함수 호출의 예외 블록 밖에서 실행한다.
2. 즉시 `current_user = 'anon'`을 확인한다.
3. 그 뒤 함수 호출에서 발생한 `insufficient_privilege`만 익명 실행 거부 성공으로 센다.
4. 시작 역할 명시 복원과 복원 사후조건은 그대로 유지한다.

로컬 PG 역할 체인에서 두 갈래를 별도로 확인했다.

- 정상 구조: `cli_role_chain_probe LOGIN NOINHERIT`에 `postgres` 역할을 부여한 뒤
  `session_user=cli_role_chain_probe` 상태에서 `postgres → anon → postgres` 전환이 모두 성공했다.
  `0134`까지만 올린 일회용 DB에서 수정된 `0135` 전체 파일을 같은 세션 구조로 실행했고,
  `current_user=postgres`로 복원된 상태에서 마지막 `assert_no_rpc_overloads()`까지 통과했다.
- 전환 권한 제거 사보타주: `postgres` 역할을 받지 않은 `cli_anon_switch_probe`로 실행하면
  `set local role anon`에서 `permission denied to set role "anon"`으로 즉시 중단됐다. 함수 실행
  거부 성공으로 잘못 세지 않았다.

기준 commit과 후속 보정 target 사이 DB 변경은 아직 스테이징에 적용되지 않은 `0135` 한 파일뿐이며,
스테이징에 이미 적용된 `0001~0134`의 blob은 바뀌지 않았다. 일회용 역할과 DB는 확인 직후 제거했고
`fresh_%` 잔여 DB는 `0개`다. 이 후속 보정 상태에서도 `corepack pnpm verify`를 다시 실행해 타입,
core·DB·mobile 시험, CLI·ACL 보안, 새 DB `34/34`·2세션 경합·locale parity, 업그레이드 `9/9`,
웹 번들까지 6/6으로 통과했다.
