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
