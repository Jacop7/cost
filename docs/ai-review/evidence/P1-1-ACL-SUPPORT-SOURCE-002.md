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

| 사보타주 | exit | 핵심 실패 출력 |
| --- | ---: | --- |
| `close_business_day(uuid)`를 authenticated에 개방 | 1 | `blocked_internal_rpc 관측=1 기대=0` |
| 임의 public 함수를 anon에 개방 | 1 | `anon_rpc 관측=1 기대=0` |
| 임의 RPC를 authenticated에 개방 | 1 | `unapproved_authenticated_rpc 관측=88 기준선=87` |
| 임시 소스에 `supabase.rpc(rpcName)` 추가 | 1 | `리터럴이 아닌 .rpc 이름` 및 파일·줄 |
| 허용 목록에서 `business_day_state` 제거 | 1 | `미허용=[business_day_state]` |
| 허용 목록에 `assert_my_store(uuid)` 추가 | 1 | `미사용=[assert_my_store]` |
| `rls_disabled_app_tables` metric 제거 | 1 | `필수 metric 누락` |
| `probe_owner` metric 중복 | 1 | `metric 중복` |
| 마지막 `rollback` → `commit` | 1 | `rollback 뒤 프로브가 남았습니다` |
| 허용 목록 밖 비-mobile 예외 추가 | 1 | `비-mobile 예외가 허용 목록에 없습니다` |
| 빈 `supabase_migrations.schema_migrations` 표 생성 | 1 | `관측=0 장부=present 기대=2` |
| 임시 소스에 `client['rpc']('business_day_state')` 추가 | 1 | `리터럴이 아닌 .rpc 이름` 및 파일·줄 |
| 임시 소스에 `const callRpc = client.rpc` 추가 | 1 | RPC 별칭 생성 파일·줄 |
| `ledger_write_paths` 값을 빈 문자열로 변경 | 1 | `부채가 기준선을 넘었거나 정수가 아닙니다` |

복구 후 `admin-acl-audit.sql` SHA-256은
`c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4`였고,
`public._acl_probe_postgres`는 없었다.

## 최종 검증

`corepack pnpm verify` 종료 코드는 0이었다.

```text
ok  1 타입
ok  2 시험: DB 32/32, core 177 (2 skipped), mobile 189
ok  3 ACL 보안
ok  4 새 DB: migration 전체, audit 값, 2세션 경합, locale parity
ok  5 업그레이드 8/8
ok  6 웹 번들
전체 검증 통과
VERIFY_EXIT=0
```

종료 후 `fresh_%` DB는 0개였다. 보안 관측값은
`rls_disabled_app_tables=0`, `ledger_write_paths=32`, `unapproved_authenticated_rpc=87`이다.
