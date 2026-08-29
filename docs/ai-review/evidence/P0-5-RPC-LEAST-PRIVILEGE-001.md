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

#### 후속 보정 판본 결속과 판별력

- 증거 재확인 시각: `2026-08-29T17:25:53+09:00`
- 기준 commit: `9559b3bd7b7205663b067edfc5367bbfd5623d21`
- 첫 역할 분리 commit: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`
- 최종 구현 commit: `bb1ecc5a483cec263f0ce0b4dce84ea73739c5d2`
- 대상 파일: `packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql`
- Git blob OID: `034a47fb0af9c9f0820dcb08a76205f1e4a74a87`
- SHA-256: `009190fa5825ed7f7a33155178209e8bf7ffc6f2c6af5d8426f6b5138d9dc733`

기준 commit과 최종 구현 commit 사이 migration 변경은 위 `0135` 한 파일뿐이다. 최종 구현
commit에서 `corepack pnpm verify`를 다시 실행해 6단계 전체가 종료 코드 `0`으로 통과했다.
세부 결과는 타입, core·DB·mobile 시험, CLI·ACL 보안, 새 DB `34/34`·2세션 경합·locale parity,
업그레이드 `9/9`, 웹 번들이며 종료 뒤 `fresh_%` DB는 `0개`였다.

정상 역할 체인의 실제 관측값은 다음과 같다.

```text
session=cli_role_chain_probe,current=cli_role_chain_probe
set-postgres=cli_role_chain_probe,current=postgres
set-anon=cli_role_chain_probe,current=anon
restore=cli_role_chain_probe,current=postgres
```

전환 권한이 없는 별도 역할은 함수 호출 전에 다음 오류로 중단됐다.

```text
ERROR:  42501: permission denied to set role "anon"
```

또한 익명 역할의 `public` 스키마 사용 권한만 제거해 다른 `42501`을 먼저 만들면 최종 구현은 이를
청소 함수 실행 거부로 세지 않고 다음 자체 오류로 실패했다.

```text
0135: anon 권한 거부가 청소 함수가 아닌 곳에서 났습니다:
permission denied for schema public
```

권한을 원복한 같은 일회용 DB에서는 `0135` 전체가 다시 통과했다. 따라서 행동 단언은
`anon` 전환 성공과 `purge_entity_changes()` 실행 거부를 각각 증명하며, 다른 권한 오류를 성공으로
오인하지 않는다. 이 절의 정확한 대상은 최종 구현 commit이며, 위쪽 최초 검증 commit의 증거를
소급해 바꾼 것이 아니다.

## 스테이징 2차 적용 중단과 미적용 migration 전진 보정

- 확인 시각: `2026-08-29T19:07:22+09:00`
- 스테이징에 승인·적용을 시도한 SHA: `9e4f502506c11c359beae2bd42cec1dc1dac4293`
- 스테이징 project ref: `cvfvmpzcldyqurcrappu`
- 운영 project ref: `smxaozdgoxbafjldoayb` — 이 작업에서 계획·적용하지 않았다.
- 최종 구현 commit: `e41a927efec49a195f528881f9f8dadc5767244a`

첫 중단 뒤 계획은 `0135~0174` 정확히 `40개`였다. 같은 SHA를 다시 적용하기 전에 호스티드
스테이징을 읽기 전용으로 확인한 결과는 다음과 같았다.

```text
session_user=postgres
current_user=postgres
session_can_anon=true
session_can_postgres=true
anon_public_usage=true
```

2차 적용에서 보정된 `0135`와 기존 `0136`은 성공했고, `0137` 마지막 사후 확인이 다시
`permission denied for function assert_no_rpc_overloads (SQLSTATE 42501)`로 중단됐다. 원인은
`0135`와 같았다. migration이 `NOINHERIT` 로그인 역할에서 `postgres`로 전환된 세션으로 실행되는데,
검사 뒤 `reset role`이 migration 시작 역할인 `postgres`가 아니라 로그인 역할로 돌아갔다. 성공
배포 증거는 생성되지 않았으며 스테이징 장부는 `0136`까지다. 다음 원격 계획은 실행 전에 새로
산출해야 하며 예상값은 `0137~0174` 정확히 `38개`다.

아직 스테이징에 적용되지 않은 파일만 전진 보정했다.

- `0137`·`0138`·`0139`·`0144`: 시작 `current_user`를 보존하고, 역할 전환과 거부 대상 행동을
  분리하고, 거부가 정확한 함수·테이블에서 났는지 확인한 뒤 보존한 역할로 명시 복원한다.
- `0139`: 코드 적용 표식을 연속된 실제 코드 줄로 고정하고 CRLF/LF와 무관하게 검사한다.
- `0145`·`0150`·`0151`·`0158`·`0163`·`0165`: Windows clean checkout의 CRLF에서도
  `pg_get_functiondef()` 조각 치환·사후 확인이 같은 코드를 인식하도록 비교 문자열을 LF로 정규화한다.

위 변경은 제품 계산·RPC 계약을 바꾸지 않는다. 스테이징에 이미 적용된 `0001~0136`은 수정하지
않았고, 변경 범위는 아직 미적용인 migration 10개뿐이다. commit 연속은 다음과 같다.

```text
c809491  역할 복원·전환/행동 분리 (0137·0138·0139·0144)
7aef3e6  0139 적용 표식 1차 보정
289d2b1  0139 실제 코드 연속 표식 고정
e084fb7  0139 CRLF/LF 안전 검사
b95f9df  0145 함수 정의 검사 정규화
e878536  0150 치환 anchor 정규화
f38ff86  0151 치환 anchor 정규화
c7ab314  0158 응답 치환 정규화
0460461  0163 DST 치환 anchor 정규화
e41a927  0165 설정 저장 치환 anchor 정규화
```

NOINHERIT 로그인 역할을 사용한 일회용 역할 체인에서 `0137~0144`를 실행해 각 migration이
`current_user=postgres`로 복원된 뒤 다음 파일로 진행하는 것을 확인했다. 전환 권한이나 복원 코드를
제거하면 해당 migration에서 즉시 실패했다. 일회용 역할과 DB는 확인 뒤 제거했다.

Windows clean checkout에서는 이전에 로컬 LF 작업본과 이미 만들어진 개발 DB가 가렸던 CRLF 의존
검사를 실제로 재현했다. 각 보정 파일은 바로 전 migration까지만 적용한 새 DB에서 첫 적용을
통과시켰다. 원래부터 재적용을 지원하는 `0139`·`0145`·`0150`·`0151`은 두 번째 적용도 통과했고,
나머지는 최초 적용 경로로 검증했다. 같은 clean checkout에서 `0001~0174` 전체 migration과 seed도
성공했다.

최종 구현 commit `e41a927efec49a195f528881f9f8dadc5767244a`의 깨끗한 checkout에서
`corepack pnpm verify` 한 실행을 완료했다.

1. 타입 검사 통과
2. core·DB·mobile 시험 통과
3. CLI 계약·ACL 셸 보안 통과
4. 새 DB 전체 migration·DB 스위트·2세션 경합·locale parity 통과
5. 업그레이드 경로 `9/9` 통과
6. 웹 번들 통과

실행 종료 코드는 `0`이며 결과는 `전체 검증 통과`였다. 종료 뒤 `fresh_%` 임시 DB는 `0개`다.
이 결과는 스테이징 재적용 성공이나 원격 ACL 감사 완료를 뜻하지 않는다. 다음 단계는 이 정확한
commit의 FABLE-SEC 재검수와 보호 CI 성공을 고정한 뒤, 새 스테이징 계획에서 `38개`를 확인하고
스테이징에만 적용하는 것이다.

## FABLE-SEC r001 지적 보정과 최종 재검증

- 확인 시각: `2026-08-29T20:08:00+09:00`
- Fable 검수 Task: `P0-5-PENDING-ROLE-RESTORES-002/r001`
- 검수 target: `8466d12f20572c4590c5678f96130d080cd717ef`
- 보정 구현 commit: `022b476fc332c312bd79461f006190eeb7e8331e`
- 스테이징 상태: `0136`까지 적용. 이 절의 보정은 아직 원격에 적용하지 않았다.
- 운영 상태: 계획·적용·변경 없음.

Fable이 반환한 Finding 네 건을 모두 반영했다.

| Finding | 판정 | 반영 |
|---|---|---|
| `P0-5-PRR-002-SEC-001` | 필수 | `0144`의 역할 전환·감사 표 쓰기 거부·원래 역할 복원을 매장 조회보다 앞으로 옮겨 매장 0개에서도 실행되게 했다. |
| `P0-5-PRR-002-SEC-002` | 필수 | 아래에 정확한 보정 migration 10개의 Git blob OID·SHA-256과 baseline diff를 고정했다. |
| `P0-5-PRR-002-SEC-003` | 개선 | `0137`의 함수 정의를 LF로 정규화하고 `chr(10)`으로 줄을 분리한다. |
| `P0-5-PRR-002-SEC-004` | 개선 | `0145`가 두 줄 결합 anchor를 못 찾으면 조용히 재실행하지 않고 예외로 중단한다. |

### 매장 0개 역할 체인 집중 시험

`0143`까지만 적용한 일회용 DB에서 매장 행을 모두 지우고 `stores=0`을 먼저 확인했다. 별도
`LOGIN NOINHERIT` 역할 `cli_p0144_probe`를 만들고 `supabase_admin`으로 접속한 뒤
`session authorization`을 그 로그인 역할로 바꾸고 `set role postgres`를 수행했다. 그 세션에서
보정된 `0144`를 적용한 실제 관측값은 다음과 같다.

```text
before|cli_p0144_probe|postgres|stores=0
after|cli_p0144_probe|postgres|stores=0
```

즉 매장이 하나도 없는 migration 시점에도 `authenticated` 전환과
`business_day_revisions` 직접 쓰기 거부 검사가 실행되고, 종료 시 `current_user=postgres`로
복원됐다. 이어서 `0145`를 두 번 적용해 첫 적용과 재적용이 모두 성공하는 것도 확인했다.
일회용 DB와 역할은 확인 직후 제거했다. 처음 시도한 잘못된 역할 체인과 peer 인증 실패는 증거로
세지 않았고, 위 관측값이 나온 정식 역할 체인만 수용했다.

### 보정 migration 판본 결속

아래 값은 워킹트리가 아니라 구현 commit `022b476fc332c312bd79461f006190eeb7e8331e`의
Git blob bytes를 직접 읽어 계산했다.

| 파일 | Git blob OID | SHA-256 |
|---|---|---|
| `20260826000137_close_due_cron.sql` | `8f99fe4b38bb1dd02233ef1ca58c8f894327930c` | `ffd9d5d2537bb44e29577cfd8fda5b80e67f32cb8448fe8f4d60742aca891185` |
| `20260826000138_close_hardening.sql` | `ce3f5db76ccd49fbfa42fe316df6a0703b19760a` | `f95ce332334b9ff39c6c3e8aa079e7a9a47a4c6c52bbf2c5b3765d008967b642` |
| `20260826000139_close_method_and_deadline.sql` | `cfc94578b3ee426048964ae95935938412b8e1cd` | `18da749f154e574ae65fba77e989542b4fda75dcb31dfae39d736115e04b4ac4` |
| `20260826000144_amend_foundation.sql` | `194d50173417da56ee11a80616996b6de09d3925` | `aac3d4c49c9f4415484c8f1e8842bb6a3ca7def76b96e6706da9a3032d0f7488` |
| `20260826000145_amend_ended_business_day.sql` | `a94f3d7c830a173acef9c09b82f9e7266dcce583` | `e59b5e118e447f412efb33bd534b845288985aab724bb3e7bf35d4e371f966dc` |
| `20260826000150_amend_boundaries.sql` | `60020cd6c3218711636d945784b4a1162774fcb7` | `66ae3dfe5ec388846d439bc7d51a3afb0095c7b3606424365bbff6a4ea4ba95b` |
| `20260826000151_basis_backfill_and_guard.sql` | `67aaaf62ec29f1684135bbd73d562d94c8f62446` | `5a88536378982d0cf242052fc54f0daee2b343a3dc246904184616a524605e83` |
| `20260826000158_retire_activity_tracking.sql` | `184e070fce44bd019f6d29cdbdd899ee4fc6be4e` | `3f3de1f261a822e3bc9b02111fecb23a18ea52fff8a46c4e36a2905149272c32` |
| `20260826000163_rule_token_required_and_dst.sql` | `2d0ec6b5cb82b922181a744e18511f5d3acb22c0` | `f3aaaa9edaedd0753957f00d6a9e9a65d115949835fde3c68e814a38bc1af139` |
| `20260826000165_store_bootstrap_and_acl.sql` | `9f2934ef1c833540c9626c8ddde9ea7a9eccbad5` | `b388ade2c245a5b2f2814c1d1dc9e13f2873bd0adba12967300684ac45614660` |

`git diff --name-only 9e4f502506c11c359beae2bd42cec1dc1dac4293..022b476fc332c312bd79461f006190eeb7e8331e -- packages/db/supabase/migrations`
결과는 위 10개와 정확히 같고, 스테이징에 적용된 `0001~0136`은 포함되지 않는다. Fable 검수
target `8466d12` 이후 migration 변경은 Finding 보정 대상인 `0137`·`0144`·`0145` 세 파일뿐이다.

### 보정 구현 commit 전체 검증

깨끗한 별도 checkout에서 정확한 구현 commit `022b476fc332c312bd79461f006190eeb7e8331e`을
checkout하고 `corepack pnpm verify`를 한 번 실행했다.

1. 타입 검사 통과
2. DB `34/34` · core `177`(2 skip) · mobile `199` 통과
3. CLI 계약·ACL 셸 보안 통과
4. 새 DB 전체 migration·seed·DB `34/34`·2세션 경합·locale parity 통과
5. 업그레이드 경로 `9/9` 통과
6. 웹 번들 통과

종료 코드는 `0`, 최종 출력은 `전체 검증 통과`, 종료 뒤 `fresh_%` DB는 `0개`였다. 이 결과도
스테이징 재적용이나 원격 ACL 감사 완료를 뜻하지 않는다.

## 스테이징 3차 적용 중단과 settings 읽기 권한 부트스트랩

- 확인 시각: `2026-08-29T20:39:48+09:00`
- 직전 승인·병합 SHA: `4454a7988a8bfd60982a7b787b2a1f0943691cb3`
- 보정 구현 commit: `fb5b4b08cb8f2ce4b323520ea0c87297759b491e`
- 스테이징 project ref: `cvfvmpzcldyqurcrappu`
- 운영 project ref: `smxaozdgoxbafjldoayb` — 계획·적용·변경 없음.

직전 구현은 feature CI run `33249054394`와 main CI run `33249371530`에서 Node 20.19.4,
Node 24, full DB, `protected-gate`가 모두 성공한 뒤 main에 fast-forward됐다. 깨끗한 스테이징 전용
checkout에서 산출한 계획은 `0137~0174` 정확히 `38개`였다. 배포 가드로 스테이징에만 적용한 결과
`0137~0163`은 성공했고, `0164`가 다음 사후조건에서 실패 폐쇄됐다.

```text
0164: settings 읽기까지 막혔습니다 — 표시 폼을 못 읽습니다
```

성공 배포 증거는 생성되지 않았다. 중단 뒤 새 계획은 `0164~0174` 정확히 `11개`이며,
스테이징 장부는 `0163`까지다. 호스티드 스테이징에는 로컬 fresh DB가 우연히 갖고 있던
`authenticated`의 `settings SELECT` 권한이 없었다. 따라서 쓰기 권한만 회수한 뒤 SELECT 존재를
가정한 옛 `0164` 사후조건이 정확히 중단한 것이다.

보정은 아직 스테이징에 적용되지 않은 `0164` 한 파일에서 읽기 계약을 명시적으로 부트스트랩한다.

1. `authenticated`에 `public.settings SELECT`를 명시적으로 부여한다.
2. `INSERT`·`UPDATE`·`DELETE`·`TRUNCATE`는 명시적으로 회수한다.
3. 기존 RLS 읽기 정책과 쓰기 RPC 경계는 바꾸지 않는다.

### 판별력과 업그레이드 회귀

`0163`까지만 올린 일회용 DB에서 `authenticated`의 `settings` 권한을 모두 회수해 호스티드 상태를
재현했다. 보정 전 권한은 `f|t|t|t|t`(SELECT 없음, 쓰기 네 종 열림)였고, 보정된 `0164` 뒤에는
`t|f|f|f|f`(SELECT만 열림)였다. 같은 상태에서 보정 전 `0164`를 적용하면 위 호스티드 오류와 같은
문구로 종료 코드 `3`을 반환했다.

`packages/db/scripts/upgrade-check.sh`에는 이 경로를 독립 시나리오 ⑩으로 추가했다. 따라서 다음
회귀를 한 번에 잡는다.

- SELECT 부여 누락
- 쓰기 권한 하나라도 잔존
- `0164`가 호스티드와 같은 사전 권한 상태에서 적용되지 않음

### 정확한 commit 전체 검증

깨끗한 별도 checkout에서 정확한 구현 commit `fb5b4b08cb8f2ce4b323520ea0c87297759b491e`을
checkout하고 `corepack pnpm verify`를 한 번 실행했다.

1. 타입 검사 통과
2. DB `34/34` · core `177`(2 skip) · mobile `199` 통과
3. CLI 계약·ACL 셸 보안 통과
4. 새 DB 전체 migration·seed·DB `34/34`·2세션 경합·locale parity 통과
5. 업그레이드 경로 `10/10` 통과
6. 웹 번들 통과

종료 코드는 `0`, 최종 출력은 `전체 검증 통과`, 종료 뒤 `fresh_%` DB는 `0개`였다. 현재 스테이징은
여전히 `0163`까지이며 이 보정은 아직 원격에 적용하지 않았다. 다음 단계는 이 정확한 변경의
FABLE-SEC 재검수와 보호 CI 성공을 고정한 뒤, 새 계획에서 `0164~0174` 11개를 다시 확인하는 것이다.
