# P0-5 RPC 최소 권한 검증 증거

- 확인 시각: `2026-08-29T14:16:40+09:00`
- 구현 commit: `59077f01ec369a1683b5dbb1fba0dd717824d577`
- 기준 commit: `817b6b305352ad297289cd8270daba5e4b30d9ad`
- 원격 적용: 없음. 개발 DB와 일회용 로컬 DB만 사용했다.

## 변경 계약

- `authenticated`가 실행할 수 있는 `public` 함수는 모바일 RPC 62개와 온보딩·보존 정책 문 2개를
  합친 정확한 facade 64개다.
- 내부 함수는 로그인할 수 없고 RLS를 우회하지 않는 `sikjae_rpc_executor`만 실행한다.
- `authenticated`는 이 역할로 전환할 수 없고, 실행 역할만 `authenticated`의 RLS 권한을 상속한다.
- 원장·확정값 10개 표의 앱 롤 `INSERT`·`UPDATE`·`DELETE`·`TRUNCATE`는 모두 닫혀 있다.
- 공식 facade는 요청 JWT의 `auth.uid()`와 RLS 매장 경계를 유지한다.

## 재현 가능한 검증

`corepack pnpm verify` 한 실행에서 다음 6단계가 모두 종료 코드 `0`으로 통과했다.

1. 타입 검사
2. core `177`(2 skip) · DB `34/34` · mobile `199` 시험
3. CLI 계약·ACL 셸 보안
4. 새 DB 전체 마이그레이션·DB `34/34`·ACL metric `20`개·2세션 경합·locale parity
5. 업그레이드 경로 `9/9`
6. 웹 번들

같은 실행과 종료 뒤 `fresh_%` 임시 DB는 `0개`였다. 개발 DB의 마이그레이션 파일과 장부는
`163/163`, 최신 버전은 `20260829000174`다. 생성 타입은 재생성했으며 공개 시그니처 변화가 없어
Git 내용 hash는 기존과 같았다.

ACL 감사의 핵심 관측값은 다음과 같다.

```text
rls_disabled_app_tables=0
ledger_write_paths=0
unapproved_authenticated_rpc=0
facade_rpc_missing=0
rpc_executor_role=1
rpc_executor_facades_invalid=0
rls_policy_helper_calls=0
```

## 판별력 확인

개발 DB의 한 트랜잭션 안에서 권한을 고의로 망가뜨리고 매번 rollback한 뒤 기준 시험을 다시
통과시켰다.

| 사보타주 | 잡힌 단언 |
|---|---|
| `consume_stock`을 `authenticated`에 재개방 | 공식 facade 64개뿐이다 |
| `inventory_states UPDATE`를 재개방 | 원장 10개 × 쓰기 4종 권한 0개 |
| 실행 역할 상속 방향을 반대로 변경 | 실행 역할은 authenticated 권한을 상속한다 |

원복 뒤 `34_rpc_least_privilege.sql`은 다시 `1/1` 통과했다.

## 파일 SHA-256

| 파일 | SHA-256 |
|---|---|
| `20260829000174_rpc_least_privilege.sql` | `f3d4f111458ec9c2150fc15030d50039411e8b36ca1fe5f1176096018f5a4e34` |
| `34_rpc_least_privilege.sql` | `af926c5ba762a3140e5be3e42de063c24edf12be496934abd523ed013fea63a6` |
| `admin-acl-audit.sql` | `7f08747672d0791c4110c67a657efd6a8f032cd8fecc352583f11d34be08827d` |
| `admin-acl-audit.test.mjs` | `226f6ad240ad84d95f8e9d4ff9281c5a29892fd27210f762014cf2784026cbc6` |

이 문서는 실행 결과를 요약한 증거이며 운영·스테이징 적용 승인이나 원격 ACL 통과를 뜻하지 않는다.
