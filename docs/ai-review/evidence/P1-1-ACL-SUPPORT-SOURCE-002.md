# P1-1 ACL 지원 시험 실행 증거

- 확인일: 2026-08-28 KST
- 권위 작업 루트: `C:\Users\jacop\프로젝트\식자재관리앱`
- 원격 자격증명·호스티드 DB 사용: 없음

## 원문 연결

Task 제어 파일은 검수 실행기가 입력에서 의도적으로 제외하므로, 원문의 commit 경로와
SHA-256을 이 독립 증거 파일에 고정한다.

| 원문 | SHA-256 |
| --- | --- |
| `docs/ai-review/tasks/P1-1-ACL-SUPPORT-SOURCE-001/rounds/r001/review.md` | `1ca606b3717a75e8f624b874a2179cf1f78f8fb160ca9440a5c6c0a34a657e5e` |
| `docs/ai-review/tasks/P1-1-ACL-SUPPORT-SOURCE-001/collaboration.md` | `109009f38072dbbfa9608d79a593a8bb01c110ddcc3cede4168694d937016476` |
| `docs/ai-review/tasks/P1-1-REMOTE-ACL-AUDIT-001/rounds/r003/review.md` | `54199a3ada19c5abf4c6f46af13de1ebf756176b46f5a99fc7de4fe942aa0798` |

r001의 필수 Finding은 보안 metric 값 미봉인, 동적 RPC 건너뜀, 실패 증거 미실체화였고,
선택 Finding은 비-mobile 예외·허용 목록 부분집합과 컨테이너 이름 검증이었다.

## 사보타주 결과

모든 사보타주는 일회용 fresh DB 또는 임시 소스 파일에서 실행했고 즉시 복구했다.

실행 판본은 다음 두 개이며, 아래 표의 `V1`·`V2`는 이 판본을 의미한다.

| 판본 | target commit | `admin-acl-audit.test.mjs` SHA-256 |
| --- | --- | --- |
| V1 | `d0051c17bb6f842e28b48813616114fefc50913c` | `0596e56a314e6078445524a64544e5a4030719097c817c30e3daca4042b4ee21` |
| V2 | `474d087fa341a70bb792cd10bd9f6907985e6617` | `380afade0352ace4165f52487b701bac037b4575400cc5843b2b6407cd0a6575` |

`실제 stderr`는 `admin-acl audit 회귀시험 실패:` 접두사부터 검수가 출력한 문자열을 그대로 적었다.
V1의 `부채가 기준선을 넘었습니다`는 V1 시험 원문이며, V2에서 정수 검사가 추가돼
`부채가 기준선을 넘었거나 정수가 아닙니다`로 바뀌었다.

| 판본 | 사보타주 | exit | 실제 stderr |
| --- | --- | ---: | --- |
| V1 | `close_business_day(uuid)`를 authenticated에 개방 | 1 | `admin-acl audit 회귀시험 실패: blocked_internal_rpc 사후조건 불일치: 관측=1 기대=0` |
| V1 | 임의 public 함수를 anon에 개방 | 1 | `admin-acl audit 회귀시험 실패: anon_rpc 사후조건 불일치: 관측=1 기대=0` |
| V1 | 임의 RPC를 authenticated에 개방 | 1 | `admin-acl audit 회귀시험 실패: unapproved_authenticated_rpc 부채가 기준선을 넘었습니다: 관측=88 기준선=87` |
| V1 | 임시 소스에 `supabase.rpc(rpcName)` 추가 | 1 | `admin-acl audit 회귀시험 실패: 리터럴이 아닌 .rpc 이름 — 허용 목록 대조 불가: C:\Users\jacop\프로젝트\식자재관리앱\apps\mobile\src\_aclRpcSabotage.ts:3` |
| V1 | 허용 목록에서 `business_day_state` 제거 | 1 | `admin-acl audit 회귀시험 실패: 모바일 RPC↔허용 목록 불일치 — 미허용=[business_day_state] 미사용=[]` |
| V1 | 허용 목록에 `assert_my_store(uuid)` 추가 | 1 | `admin-acl audit 회귀시험 실패: 모바일 RPC↔허용 목록 불일치 — 미허용=[] 미사용=[assert_my_store]` |
| V1 | `rls_disabled_app_tables` metric 제거 | 1 | `admin-acl audit 회귀시험 실패: 누락 metric: rls_disabled_app_tables` |
| V1 | `probe_owner` metric 중복 | 1 | `admin-acl audit 회귀시험 실패: 중복 metric: probe_owner` |
| V1 | 마지막 `rollback` → `commit` | 1 | `admin-acl audit 회귀시험 실패: rollback 뒤 프로브가 남았습니다: _acl_probe_postgres` |
| V1 | 허용 목록 밖 비-mobile 예외 `assert_my_store` 추가 | 1 | `admin-acl audit 회귀시험 실패: 비-mobile 예외가 허용 목록에 없습니다: assert_my_store` |
| V2 | 빈 `supabase_migrations.schema_migrations` 표 생성 | 1 | `admin-acl audit 회귀시험 실패: migrations 값이 하네스 계약 밖입니다: 관측=0 장부=present 기대=2` |
| V2 | 임시 소스에 `client['rpc']('business_day_state')` 추가 | 1 | `admin-acl audit 회귀시험 실패: 리터럴이 아닌 .rpc 이름 — 허용 목록 대조 불가: C:\Users\jacop\프로젝트\식자재관리앱\apps\mobile\src\_aclRpcSabotage.ts:3` |
| V2 | 임시 소스에 `const callRpc = client.rpc` 추가 | 1 | `admin-acl audit 회귀시험 실패: 리터럴이 아닌 .rpc 이름 — 허용 목록 대조 불가: C:\Users\jacop\프로젝트\식자재관리앱\apps\mobile\src\_aclRpcAliasSabotage.ts:3` |
| V2 | `ledger_write_paths` 값을 빈 문자열로 변경 | 1 | `admin-acl audit 회귀시험 실패: ledger_write_paths 부채가 기준선을 넘었거나 정수가 아닙니다: 관측= 기준선=32` |

복구 후 `admin-acl-audit.sql` SHA-256은
`c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4`였고,
`public._acl_probe_postgres`는 없었다.

## 최종 검증

최종 검증은 V2(target commit `474d087fa341a70bb792cd10bd9f6907985e6617`,
`admin-acl-audit.test.mjs` SHA-256 `380afade0352ace4165f52487b701bac037b4575400cc5843b2b6407cd0a6575`)
작업 트리에서 모든 사보타주를 복구한 뒤 실행했다. 아래 `fresh_%` DB 개수와 보안 관측값도
같은 V2 실행의 값이다. `corepack pnpm verify` 종료 코드는 0이었다.

```text
ok     ① 타입 (pnpm -r typecheck)
ok     ② 시험 (pnpm -r test)
ok     ③ ACL 보안 (비밀번호 · argv · 환경 격리)
ok     ④ 새 DB (마이그레이션 전체 + 시험)
ok     ⑤ 업그레이드 경로
ok     ⑥ 웹 번들 (Metro export)
전체 검증 통과
VERIFY_EXIT=0
```

종료 후 `fresh_%` DB는 0개였다. 보안 관측값은
`rls_disabled_app_tables=0`, `ledger_write_paths=32`, `unapproved_authenticated_rpc=87`이다.

## P2-6 후속 보강 — 2026-08-30 KST

Fable 후속 지적 네 건을 반영했다. 모바일 RPC 소스 검사는 별도 모듈로 분리해 구조 분해
별칭(`const { rpc } = client`, `const { rpc: call } = client`)과 비리터럴 계산 키
(`client[key](...)`)를 실패로 처리한다. 필수 소스 루트가 하나라도 없으면 누락 경로를 명시하고,
일반 객체의 계산 키 호출은 RPC로 오인하지 않는다. Docker 없는 회귀시험 6개를 verify ③에 연결했다.

SQL 허용 목록은 더 이상 SQL 문자열을 정규식으로 읽지 않는다. 감사 SQL이 만든 임시 표를 같은
트랜잭션의 PostgreSQL이 직접 읽어 서명과 비-mobile 소비자를 내보내며, 마지막에 rollback한다.
`admin-acl-audit.sql`의 주석 안 `comment_only_rpc(uuid)` 표식이 허용 목록에 들어오지 않는 것도
명시적으로 단언한다.

### 판본 고정

파일 SHA-256만으로는 어떤 Git 판본을 검수했는지 되짚기 어려우므로, 기존 V1·V2와 P2-6 판본의
Git blob OID를 함께 고정한다.

| 판본 | target commit | `admin-acl-audit.test.mjs` Git blob OID |
| --- | --- | --- |
| V1 | `d0051c17bb6f842e28b48813616114fefc50913c` | `43f2ae0e01f93cebf115b8294acdd20e13c05f55` |
| V2 | `474d087fa341a70bb792cd10bd9f6907985e6617` | `9da5001f312deb7a6a291a1e334059f0e22fca26` |
| P2-6 | `af0940c3e63a4ba663e055e0752ee470b9adc09b` | `38a74b1ef1e2dcf48b046e1250bf112bb915039a` |

P2-6 작업 트리의 SHA-256은 다음과 같다. Git blob OID는 줄 끝 정규화 이후 저장소 객체를 가리키고,
SHA-256은 Windows 작업 트리에서 실제 실행한 바이트를 가리킨다.

| 파일 | SHA-256 |
| --- | --- |
| `packages/db/scripts/admin-acl-audit.test.mjs` | `69e81135c842a16bb126d08afb7fe7a2a15dda1891265f7ad06ab646a2548910` |
| `packages/db/scripts/admin-acl-source-scan.mjs` | `71d6edfe664669419b7bebbc43167808df27107e7049a4f9db87d19a9cb208f2` |
| `packages/db/scripts/admin-acl-source-scan.test.mjs` | `300bfc242e047bb71bdca7d64520fb400adb3af9607d4f61cf275830230863ba` |
| `packages/db/scripts/admin-acl-audit.sql` | `b66f7a474d958c73753b7f72537dc2bd75cdbe9399387562e4ba33058b1802ff` |

### 실제 실행 출력

`node packages/db/scripts/admin-acl-audit.test.mjs postgres`의 stdout 마지막 두 줄을 가공하지 않고
그대로 보존한다.

```text
admin-acl audit 실제 DB 계약 통과 — metric 21개 · 모바일 RPC 62개 · 비-mobile 예외 2개
  관측값: rls_disabled_app_tables=0 ledger_write_paths=0 unapproved_authenticated_rpc=0
```

같은 P2-6 판본에서 `corepack pnpm verify`를 실행해 ① 타입, ② 시험, ③ CLI 계약·ACL 보안,
④ 새 DB 전체 migration·DB 34/34·2세션 경합·locale parity, ⑤ 업그레이드 경로 10/10,
⑥ 웹 번들을 모두 통과했다. 종료 코드는 0이고 `fresh_%` 일회용 DB는 남지 않았다.
