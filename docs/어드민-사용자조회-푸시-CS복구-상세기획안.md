# 코스트킵 내부 어드민 사용자 조회·푸시·CS 데이터 복구 상세 기획안

- 문서 상태: 구현 전 공식 설계 후보
- 작성일: 2026-09-20
- 적용 범위: 코스트킵 본사 CS·운영·보안 담당자만 사용하는 내부 어드민
- 제품 앱과의 관계: 고객인 점주·매장 직원이 사용하는 Expo 앱과 배포·권한·화면을 완전히 분리한다.
- 권위 계약: `ARCHITECTURE.md`의 원장·판본·전파 규칙과 실제 DB RPC가 최종 권위다.
- 검수 기준: Astra Ultra와 Claude 독립 검수의 공통 결론인 `APPROVE_WITH_CHANGES`를 반영한다.

## 1. 결정 요약

이 문서에서 `어드민`은 매장 관리자나 점주를 뜻하지 않는다. **코스트킵 내부 관리자**만을 뜻한다.
매장 소유자에게 어드민 권한을 제공하지 않으며, 매장 직원 관리 기능과도 연결하지 않는다.

코스트킵 내부 어드민의 1차 범위는 다음 세 가지다.

1. 내부 사용자·매장 조회
2. 개별 매장 대상 운영 푸시
3. CS 항목별 데이터 복구

복구를 위해 매일 모든 업무 데이터를 통째로 복사하지 않는다. 현재 시스템은 재고 원장, 매출 판본,
영업일 정정, 설정 이력을 이미 보존한다. 전체 복사본은 이 데이터를 중복 저장하고, 어느 복사본을
권위로 삼을지 모호하게 만든다.

1차 복구 구조는 다음처럼 고정한다.

```text
불변 업무 원장·판본
  inventory_events
  sales_day_versions / sales_day_heads
  business_day_revisions
  store_configuration_changes
        │
        ├─ 그대로 보존하고 기존 정정·반대 이벤트 RPC 사용
        │
변경 가능한 마스터 데이터
  식재료·구매 옵션·메뉴·레시피 구성·판매 채널
        │
        └─ master_data_payloads에 중복 없는 내용 저장
           master_data_versions는 매 저장 revision을 기록
           master_data_history는 판본 사이의 변경 사건을 기록

어드민 복구
  대상 검색 → 복구 가능 시점 조회 → diff 미리보기
  → 최신 revision 재검증 → 권위 RPC로 새 revision/정정 원장 생성
  → admin_actions 영수증 기록
```

다음 설계는 채택하지 않는다.

- 앱을 처음 연 시점에 전날 전체 상태를 복사하는 방식
- 가장 최근 복사본 한 개만 남기고 이전 복사본을 즉시 삭제하는 방식
- `inventory_states`, 기존 `sales_day_versions`, 과거 계산 스냅샷을 직접 덮어쓰는 방식
- 인증 토큰·비밀번호·작성 중 초안을 복구 데이터에 포함하는 방식
- 어드민 브라우저 또는 점주용 앱에 service role을 넣는 방식

## 2. 목표와 비목표

### 2.1 목표

- CS 담당자가 내부 사용자 ID로 계정과 매장을 정확하게 찾는다.
- 로그인 방식과 가린 이메일을 확인하되 인증 비밀값은 조회하지 않는다.
- 어떤 데이터가 언제, 누구에 의해, 어떻게 바뀌었는지 확인한다.
- 잘못 변경된 특정 항목만 현재 규칙을 통과시켜 복구한다.
- 판매·입고·폐기·실사 같은 원장 사건은 기존 취소·정정 경로를 사용한다.
- 복구 전후, 실패, 충돌, 재시도까지 감사 영수증을 남긴다.
- 푸시는 동의한 사용자에게만 보내고 발송·실패·무효 토큰 결과를 추적한다.
- 전체 프로젝트 장애와 개별 사용자 실수 복구를 분리한다.

### 2.2 비목표

- 한 번의 버튼으로 매장 전체를 임의 시점으로 되감는 기능
- Supabase 프로젝트 전체 장애를 어드민 화면에서 복원하는 기능
- Auth 사용자의 비밀번호·OAuth 토큰·세션 토큰 복원
- 진행 중인 매출 초안이나 기기 로컬 임시 입력 복원
- 과거 원장 행 삭제 또는 기존 판본 수정
- 세무 신고·법정 영수증 원장 복구
- 1차에서 전체 사용자 대상 마케팅 캠페인 운영
- 1차에서 상담원이 DB 테이블과 JSON을 직접 편집하는 기능

## 3. 운영자와 권한

어드민은 고객 계정과 분리된 코스트킵 내부 운영자 계정을 사용한다. 점주가 내부 운영자를 초대하거나
권한을 부여할 수 없다. 권한은 코스트킵 보안 관리자가 관리하고 서버에서 검사하며 화면 숨김만으로
보호하지 않는다.

| 역할                         | 사용자·매장 조회 | 복구 미리보기 | 복구 실행        | 푸시 작성 | 푸시 발송 | 권한 관리 |
| ---------------------------- | ---------------- | ------------- | ---------------- | --------- | --------- | --------- |
| `costkeep_support_viewer`    | 가능             | 가능          | 불가             | 불가      | 불가      | 불가      |
| `costkeep_recovery_operator` | 가능             | 가능          | 지원 범위만 가능 | 불가      | 불가      | 불가      |
| `costkeep_push_operator`     | 가능             | 불가          | 불가             | 가능      | 가능      | 불가      |
| `costkeep_security_admin`    | 가능             | 가능          | 가능             | 가능      | 가능      | 가능      |

공통 보안 조건:

- 코스트킵 내부 운영자 계정은 고객 계정과 구분되는 내부 allowlist에 있어야 한다.
- 모든 코스트킵 내부 운영자 계정은 MFA `aal2`를 충족해야 한다.
- 어드민 요청은 Edge Function 또는 코스트킵 내부 서버를 통과한다.
- 서버는 코스트킵 운영자 allowlist, 역할, MFA, CS 티켓과 요청 대상 매장을 매 요청마다 검사한다.
- 매장 소유자·매장 직원·일반 고객 JWT는 내부 어드민 역할을 가질 수 없다.
- 운영자 퇴사·직무 변경 시 내부 접근과 활성 세션을 즉시 회수한다.
- 브라우저에는 service role, DB 비밀번호, Expo 서버 자격을 저장하지 않는다.
- 복구 RPC와 관리자 조회 RPC는 `anon`·`authenticated`에 직접 공개하지 않는다.
- 광범위 작업은 1차 범위에서 제공하지 않는다. 이후 도입하면 2인 승인을 요구한다.

## 4. 어드민 애플리케이션 경계

점주용 Expo 앱 안에 코스트킵 어드민 메뉴를 넣지 않는다. 내부 웹 화면과 서버 권한을 별도 패키지로
분리하고 공개 고객 화면에서 어드민 경로를 노출하지 않는다.

권장 구조:

```text
apps/admin                 코스트킵 내부 정적 웹 UI
  React + TypeScript
  Supabase Auth 로그인
  service role 미포함

packages/db/supabase/functions/admin-api
  운영자 JWT·MFA·역할 검사
  가린 사용자 정보 조회
  복구 미리보기·실행 RPC 호출
  푸시 작업 등록·발송 결과 조회

Postgres
  기존 권위 원장·RPC
  master_data_payloads / master_data_versions / master_data_history
  admin_actions
  push_devices / push_campaigns / push_deliveries
```

새 웹 프레임워크의 장기 서버를 만들 필요는 없다. 코스트킵 내부 어드민 UI는 고객 앱과 다른 URL·배포
대상으로 정적 배포하고 비밀값이 필요한 짧은 작업만 Edge Function이 수행한다. 재고·손익·세금 공식은
Edge Function에 구현하지 않는다.

## 5. 사용자·매장 조회

### 5.1 검색 입력

1차 검색 키:

- 내부 사용자 UUID 완전 일치
- 매장 UUID 완전 일치
- 가린 이메일과 별도의 정확 이메일 검색

이메일 검색은 서버에서만 수행한다. 클라이언트가 `auth.users`를 직접 읽지 않는다. 결과 목록에는
완전한 이메일을 기본 노출하지 않는다.

### 5.2 결과 항목

| 구분   | 표시 값                                                      |
| ------ | ------------------------------------------------------------ |
| 사용자 | 내부 사용자 UUID, 가입일, 마지막 로그인 시각, 상태           |
| 로그인 | Google·Apple 등 provider 목록, 마지막 사용 provider          |
| 이메일 | 가린 이메일. 권한이 있어도 별도 사유 없이 원문 표시하지 않음 |
| 매장   | 매장 UUID, 매장명, 국가·통화·시간대, 생성일, archive 상태    |
| 영업   | 서버 매장 날짜, 현재 영업 상태, 마지막 완료 영업일           |
| 데이터 | 식재료·메뉴·발주·완료 매출·미해결 재고 정정 건수             |
| 복구   | 복구 가능 항목 수, 마지막 마스터 변경, 마지막 관리자 작업    |
| 푸시   | 등록 기기 수, 알림 동의 상태, 마지막 발송 결과               |

### 5.3 개인정보 규칙

- 비밀번호, OAuth access/refresh token, Supabase JWT, OTP, 원본 푸시 토큰은 화면에 표시하지 않는다.
- 이메일 원문 조회가 필요해지면 별도 권한·사유·감사 기록을 추가한다.
- 사용자 검색 결과를 로컬 저장소나 브라우저 캐시에 영구 저장하지 않는다.
- 사용자 ID와 매장 ID는 지원 티켓 연결에 사용하되 공개 고객 메모에는 넣지 않는다.

## 6. 복구 데이터의 책임 분리

| 데이터 종류         | 현재 또는 신규 권위                    | 복구 방식                                                           |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| 재고 사건           | `inventory_events`                     | 기존 반대 이벤트 또는 E5 실사 정정                                  |
| 현재 재고           | 원장 합계와 `inventory_states`         | 직접 덮어쓰지 않고 권위 RPC로 재계산·검산                           |
| 확정 매출           | `sales_day_versions`·`sales_day_heads` | 수정 초안과 완료 RPC로 새 판본 생성                                 |
| 종료 영업일         | `business_day_revisions`               | 종료일 정정 RPC로 새 정정 기록 생성                                 |
| 설정·세금·고정 지출 | `store_configuration_changes`          | 당시 값으로 새 revision 저장. 신규 마스터 이력에 중복 기록하지 않음 |
| 식재료·구매 옵션    | 신규 마스터 판본·이력                  | 항목별 diff 후 `save_ingredient` 계열 RPC 호출                      |
| 메뉴·레시피 구성    | 신규 마스터 판본·이력                  | 항목별 diff 후 `save_recipe` 계열 RPC 호출                          |
| 판매 채널           | 채널 이력 + 판매 당시 이름 snapshot    | 참조 여부에 따라 복구·재활성화, 과거 이름 덮어쓰기 금지             |
| 발주                | 발주·입고·취소 원장                    | 상태 전이와 E11/E12 계약을 통과하는 정정                            |
| 계산 스냅샷         | 영업일·판매 기준 snapshot              | 계산 재현용. 복구 원본으로 직접 쓰지 않음                           |
| 인증·권한           | Supabase Auth와 내부 권한              | 업무 데이터 복구 대상 제외                                          |
| 작성 중 초안        | 초안 수명주기                          | 복구 대상 제외. 기준 변경 후 stale 검사                             |
| 전체 DB·스키마      | Supabase backup/PITR                   | 재해 복구 절차로만 복원                                             |
| Storage 객체        | 별도 객체 보존 정책                    | DB 복구와 분리된 객체 복구 절차 사용                                |

## 7. 신규 데이터 계약

이 절의 이름은 구현 전 migration에서 다시 충돌 검사하되, 의미와 제약은 유지한다.

### 7.1 `master_data_payloads`·`master_data_versions`·`master_data_history`

변경 가능한 업무 기준정보는 payload를 사건마다 두 번 저장하지 않는다. 내용, 서버 판본, 변경 사건을
분리한다. 과거와 같은 값으로 복구해도 새 revision은 생성하되 실제 JSON payload는 재사용할 수 있다.

`master_data_payloads` 필수 필드:

| 필드                             | 의미                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `id uuid`                        | 내용 ID                                                                          |
| `store_id uuid`                  | 매장 범위                                                                        |
| `entity_type text`               | `ingredient`, `purchase_option`, `recipe`, `recipe_composition`, `sales_channel` |
| `entity_id uuid`                 | 대상 ID                                                                          |
| `payload_schema_version integer` | payload 변환 판본                                                                |
| `payload jsonb`                  | 정규화된 의미 단위 데이터                                                        |
| `payload_hash text`              | 정규화 payload의 SHA-256                                                         |
| `created_at timestamptz`         | 최초 기록 시각                                                                   |

`master_data_versions` 필수 필드:

| 필드                     | 의미                             |
| ------------------------ | -------------------------------- |
| `id uuid`                | 판본 ID                          |
| `store_id uuid`          | 매장 범위                        |
| `entity_type text`       | payload와 같은 엔터티 종류       |
| `entity_id uuid`         | 대상 ID                          |
| `revision bigint`        | 해당 엔터티의 서버 판본          |
| `payload_id uuid`        | `master_data_payloads.id` 참조   |
| `created_at timestamptz` | 해당 revision이 확정된 서버 시각 |

`master_data_history` 필수 필드:

| 필드                          | 의미                                                             |
| ----------------------------- | ---------------------------------------------------------------- |
| `id uuid`                     | 변경 사건 ID                                                     |
| `store_id uuid`               | 매장 범위                                                        |
| `entity_type text`            | 판본과 같은 엔터티 종류                                          |
| `entity_id uuid`              | 대상 ID                                                          |
| `parent_entity_id uuid null`  | 구매 옵션·레시피 구성의 부모 ID                                  |
| `operation text`              | `create`, `update`, `deactivate`, `reactivate`, `delete_request` |
| `before_version_id uuid null` | 변경 전 `master_data_versions.id`                                |
| `after_version_id uuid null`  | 변경 후 `master_data_versions.id`                                |
| `actor_user_id uuid null`     | 앱 사용자                                                        |
| `source text`                 | `app`, `admin_restore`, `migration`                              |
| `correlation_id uuid`         | 한 요청으로 묶인 변경                                            |
| `occurred_at timestamptz`     | 서버 기록 시각                                                   |

제약:

- 세 테이블 모두 UPDATE·DELETE·TRUNCATE를 금지하는 append-only 테이블이다.
- 같은 엔터티·schema version·`payload_hash`의 payload는 다시 저장하지 않는다.
- 저장으로 revision이 실제 증가할 때마다 `master_data_versions`는 한 행을 만든다.
- 과거 내용으로 복구하면 새 판본 행을 만들고 기존 `payload_id`를 재사용한다.
- 무변경 저장은 payload·판본·이력 행을 모두 만들지 않는다.
- 다음 변경의 `before_version_id`는 앞 변경의 `after_version_id`를 재사용한다.
- `store_id`, `entity_type`, `entity_id`, `occurred_at` 조회 인덱스를 둔다.
- 앱 역할의 직접 INSERT를 허용하지 않는다.
- 권위 저장 RPC 내부 변경만 보안 실행자 또는 내부 트리거가 기록한다.
- payload에는 인증 정보·토큰·대용량 파일 본문을 넣지 않는다.
- 레시피는 헤더와 구성 행을 하나의 정규화 payload로 묶거나 같은 `correlation_id`의 판본으로 기록한다.
- schema version별 정규화 함수와 읽기 변환 시험을 둔다.
- 이미 `store_configuration_changes`처럼 장기 before/after를 보존하는 도메인은 중복 기록하지 않는다.
- 기존 이력이 복구 원본으로 충분한지는 단계 A의 필드·보존기간 감사로 확정한다.
- payload 목표는 p50 2KB 이하, p95 16KB 이하이며 단일 payload 상한을 64KB로 둔다.
- 64KB를 넘는 레시피는 무조건 자르지 않고 별도 구성 판본으로 분리한 뒤 해시로 연결한다.

### 7.2 `admin_actions`

모든 관리자 조회 예외·복구·푸시 발송의 실행 영수증이다.

`admin_actions`는 한 요청의 현재 상태를 덮어쓰는 표가 아니라 이벤트를 append하는 감사 원장이다.
읽기 뷰가 같은 `action_id`의 최신 이벤트를 접어 현재 상태를 보여준다.

필수 필드:

- `id uuid`: 이벤트 ID
- `action_id uuid`: 한 관리자 요청의 공통 ID
- `idempotency_key text null`: 요청 이벤트에만 저장
- `admin_user_id uuid`
- `admin_role text`
- `ticket_ref text`
- `reason text`
- `store_id uuid null`
- `action_type text`
- `target_type text null`
- `target_id uuid null`
- `source_history_id uuid null`
- `preview_hash text null`
- `before_revision bigint null`
- `after_revision bigint null`
- `requested_payload jsonb null`
- `result_payload jsonb null`
- `event_type text`: `requested`, `validated`, `executing`, `succeeded`, `blocked`, `failed`
- `error_code text null`
- `requested_at`, `completed_at`

제약:

- 성공 영수증뿐 아니라 차단·실패도 새 이벤트로 기록한다.
- 요청 payload에는 마스킹된 값과 식별자만 기록하고 토큰을 넣지 않는다.
- 기존 이벤트의 UPDATE·DELETE·TRUNCATE를 금지한다.
- 요청 이벤트의 `idempotency_key`에 부분 유니크 인덱스를 두고 후속 이벤트는 `action_id`로 연결한다.
- 같은 멱등키 재호출은 기존 결과를 반환한다.

### 7.3 복구 미리보기 영수증

미리보기는 DB에 영구 복구점을 만들지 않는다. 다음 내용을 가진 짧은 수명의 서명된 preview를 반환한다.

- 대상 매장·도메인·항목
- 선택한 이력 ID
- 현재 revision
- 복구 후 예상 revision
- 필드별 before/current/restore 값
- 참조 중인 메뉴·판매·발주 수
- 생성될 정정 사건과 무효화 범위
- 차단 사유
- `preview_hash`
- 만료 시각: 기본 10분

실행 요청은 이 hash와 현재 revision을 다시 제출해야 한다.

### 7.4 푸시 데이터

`push_devices`:

- 사용자·매장·기기·플랫폼·앱 버전
- 원본 Expo push token은 service-only 범위에 저장
- 화면과 로그에는 token fingerprint만 표시
- 알림 동의 종류와 마지막 확인 시각
- 마지막 성공·실패, 무효화 시각

`push_campaigns`:

- 작성자, 대상 매장 또는 사용자, 알림 종류
- 제목·본문·딥링크의 검증된 식별자
- `draft`, `scheduled`, `sending`, `completed`, `cancelled`
- 예약 시각과 매장 시간대
- 멱등키

`push_deliveries`:

- 캠페인·기기별 발송 시도
- 공급자 receipt ID, 시도 횟수, 결과 코드, 다음 재시도 시각
- 원본 토큰과 공급자 응답의 개인정보·비밀값은 기록하지 않음

### 7.5 사용자 이탈 시간과 복구점

앱 종료·로그아웃·백그라운드 전환 시점마다 매장 전체 데이터를 저장하지 않는다. 모바일 운영체제는
강제 종료·배터리 종료·프로세스 정리 때 종료 이벤트 전달을 보장하지 않고, 같은 사용자가 여러 기기를
동시에 사용할 수 있기 때문이다. 이탈 시점 snapshot을 복구 권위로 사용하면 마지막 변경을 놓치거나
다른 기기의 정상 변경을 덮어쓸 수 있다.

복구점은 다음 기준으로 생성한다.

- 식재료·메뉴·설정 저장 RPC가 성공한 같은 트랜잭션에서 변경 이력을 기록한다.
- 판매·입고·폐기·실사·발주는 원장 사건이나 불변 판본이 생성된 시각 자체가 복구점이다.
- 저장되지 않은 입력값과 기기 로컬 임시 상태는 CS 데이터 복구 대상이 아니다.
- 작성 중 매출 초안은 기존 서버 초안 수명주기로 재개하며 마스터·원장 복구에 포함하지 않는다.
- 사용자의 기기 시각 대신 DB 서버의 `occurred_at`·revision·원장 순서를 사용한다.

운영자가 변경 흐름을 이해할 수 있도록 선택적으로 `app_session_id`를 기록한다.

- 앱이 인증된 업무 세션을 시작할 때 서버가 임의 UUID를 발급한다.
- 각 저장 요청은 `app_session_id`, `device_id_hash`, `server_received_at`을 감사 메타데이터로 전달한다.
- 종료 이벤트가 없으면 마지막 서버 활동 뒤 30분을 세션 종료로 추정해 화면에만 표시한다.
- 추정 종료 시각은 데이터 복구점이나 삭제 기준으로 사용하지 않는다.
- 세션 ID는 여러 변경을 화면에서 묶기 위한 값이며 인증 토큰을 대체하지 않는다.

어드민 복구 화면은 다음처럼 표시한다.

```text
9월 20일 앱 세션 · 18:40~19:10 추정
  18:42 식재료 대파 단가 수정
  18:47 제육볶음 레시피 수정
  18:53 판매 채널 설정 변경
```

운영자는 `18:42 변경 이전 값`처럼 실제 저장 사건을 선택한다. `19:10 이탈 시점 전체 복원` 버튼은
제공하지 않는다. 여러 항목을 함께 복구해야 하면 각 항목의 diff와 현재 참조를 검증해 하나의 승인된
복구 묶음으로 실행한다.

### 7.6 이력이 실제로 쌓이는 예시

기능을 처음 적용할 때 현재 식재료·메뉴를 기준 판본으로 한 번 백필한다.

도입 이전의 과거 상태를 현재 데이터에서 추정해 만들지 않는다. 최초 기준 판본보다 앞선 마스터 데이터는
기존에 신뢰할 수 있는 before/after 이력이 있는 범위만 복구할 수 있다.

```text
현재 대파 revision 7, 단가 4원/g
  payload P1 = { 이름: 대파, 단가: 4원/g, ... }
  version V1 = revision 7 → P1
  history H0 = null → V1, source: baseline
```

사용자가 단가를 5원/g으로 저장하면 권위 `save_ingredient` 트랜잭션 안에서 다음이 함께 확정된다.

```text
payload P2 = { 이름: 대파, 단가: 5원/g, ... }
version V2 = revision 8 → P2
history H1 = V1 → V2, source: app, occurred_at: 서버 시각
```

코스트킵 내부 관리자가 이전 값으로 복구하면 V1을 현재 행으로 덮어쓰지 않는다. 현재 revision 8을
검사한 뒤 같은 저장 RPC로 revision 9를 만든다. 내용은 P1과 같으므로 payload는 재사용한다.

```text
version V3 = revision 9 → 기존 payload P1 재사용
history H2 = V2 → V3, source: admin_restore
admin_actions = 요청 → 검증 → 성공 영수증
```

따라서 화면에는 `4원 → 5원 → 4원 복구`가 모두 남지만 4원 payload JSON은 한 번만 저장된다.

매출·재고는 이 마스터 판본 표에 복제하지 않는다.

- 완료 매출 수정: 기존 `sales_day_versions`에 새 판본을 만들고 head를 새 판본으로 이동
- 판매 취소·감소: E9 사건 추가
- 입고 취소: E11 사건 추가
- 폐기 취소: 기존 폐기 반전 사건 추가
- 재고 실사: E5 사건 추가

어드민의 통합 타임라인은 이 데이터들을 복사해서 한 표에 넣지 않는다. 마스터 변경 이력,
`sales_day_versions`, `business_day_revisions`, `inventory_events`, `store_configuration_changes`를 읽어
시간순으로 정규화해 보여준다.

## 8. 복구 흐름

### 8.1 공통 흐름

```text
1. CS 티켓 번호와 사유 입력
2. 사용자 UUID 또는 매장 UUID 검색
3. 대상 도메인과 항목 선택
4. 변경 이력·원장·판본 조회
5. 복구 후보 시점 선택
6. dry-run diff와 영향 범위 확인
7. 실행 요청
8. 매장 쓰기 잠금 획득
9. revision·preview_hash·참조 상태 재검증
10. 기존 권위 RPC로 새 revision·정정 사건 생성
11. 원장·현재 상태·합계 검산
12. admin_actions 영수증 확정
13. 관련 조회 키 무효화와 CS 결과 표시
```

미리보기와 실행 사이에 값이 바뀌면 실행하지 않고 `ADMIN_RESTORE_STALE_PREVIEW`를 반환한다.

### 8.2 식재료·구매 옵션 복구

- 식재료 UUID를 유지한다.
- 과거 행을 INSERT로 복제해 새로운 식재료로 만들지 않는다.
- 현재 메뉴가 참조하는 식재료는 물리 삭제 상태로 되돌리지 않는다.
- 단가·단위·카테고리·메모·활성 상태를 필드별로 보여준다.
- 재고 수량은 같은 복구에 섞지 않는다.
- 저장은 최신 `save_ingredient` 계열 계약과 expected revision을 사용한다.
- 구매 옵션 자식 변경도 부모 식재료와 같은 correlation으로 검산한다.

### 8.3 메뉴·레시피 복구

- 메뉴 UUID와 판매 시점 snapshot을 유지한다.
- 당시 레시피 구성·부자재·판매가를 의미 단위 payload로 비교한다.
- 현재 존재하지 않는 식재료가 포함되면 자동 생성하지 않고 복구를 차단한다.
- 삭제된 식재료가 필요하면 식재료 복구를 먼저 안내한다.
- 저장은 `save_recipe`와 현재 판매 중지·반제품 금지·단위 검증을 그대로 통과한다.
- 복구 때문에 과거 매출 원가 snapshot을 다시 계산하지 않는다.

### 8.4 설정·세금·고정 지출 복구

- `store_configuration_changes`의 before/after와 적용 기준을 사용한다.
- 당시 값을 현재 시점의 새 revision으로 저장한다.
- 과거 영업일 손익 snapshot을 다시 쓰지 않는다.
- 세금 프로필·고정 지출 적용일이 이미 봉인된 과거 판매에는 소급하지 않는다.
- 현재 작성 중 매출 초안이 있으면 기존 설정 잠금과 stale 계약을 따른다.

### 8.5 재고 복구

재고 수치는 snapshot으로 되돌리지 않는다.

- 잘못된 단순 재고 수정: 기존 최신 사건 취소가 허용되는지 검사한다.
- 폐기 취소: `e2_discard_reverted` 계약을 사용한다.
- 입고 취소: E11과 입고 회차·멱등 영수증을 사용한다.
- 판매 수량 감소: E9를 만드는 매출 정정 경로를 사용한다.
- 실사 컷오프에 흡수된 사건: 현재 실측 재고를 과거로 되돌리지 않고 금액 전진 정정 또는
  `pending_inventory_resolution` 계약을 따른다.
- 명확한 원사건을 선택할 수 없는 경우: 사유와 확인 재고를 요구하는 E5 전체 실사 후보로 분리한다.

### 8.6 매출 복구

- 복구 대상 날짜의 현재 `sales_day_head`와 판본을 조회한다.
- 당시 판본으로 head 포인터를 직접 되돌리지 않는다.
- 수정 초안을 만들고 현재 편집 가능 기간·영업일 상태·재고 컷오프를 검사한다.
- 완료 시 `finalize_sales_draft`가 새 불변 판본, E8/E9 차이 사건, 세금·손익 snapshot을 확정한다.
- 과거 날짜의 당시 채널 이름·메뉴 이름 snapshot을 현재 이름으로 치환하지 않는다.
- 복구 뒤 `business_day_revisions`와 관리자 영수증을 함께 조회할 수 있어야 한다.

### 8.7 발주·입고 복구

- E7 발주는 재고를 움직이지 않는다.
- 잘못된 미입고 발주는 E12 계약으로 상태를 정정한다.
- 입고 완료 건은 E1과 입고 회차를 기준으로 E11 가능 여부를 판단한다.
- 부분 입고·취소·재입고가 있으면 주문 ID만으로 일괄 취소하지 않는다.
- 실사 컷오프에 포함된 입고는 현재 재고 직접 반전을 금지한다.
- 지연 재시도는 같은 idempotency key의 기존 영수증을 먼저 반환한다.

### 8.8 1차 지원 범위

| 도메인                | 1차 상태       | 자동 실행 조건                                 | 자동 실행하지 않는 경우           |
| --------------------- | -------------- | ---------------------------------------------- | --------------------------------- |
| 설정·고정 지출        | 지원           | 기존 이력·최신 revision·적용일 검증 성공       | 진행 중 매출 기준과 충돌          |
| 식재료 기본정보       | 지원           | 참조·단위·revision 검증 성공                   | 삭제 복구가 현재 참조와 충돌      |
| 구매 옵션             | 지원           | 부모 식재료 존재, 단가·단위 검증 성공          | 부모 삭제·단위 변환 불가          |
| 메뉴·레시피           | 지원           | 모든 구성 식재료 존재, `save_recipe` 검증 성공 | 삭제 재료·반제품·판매 중지 충돌   |
| 완료 매출             | 기존 정정 연결 | 편집 기간·판본·재고 컷오프 검증 성공           | 종료일 정정 불가·미해결 재고      |
| 단순 폐기 취소        | 기존 정정 연결 | 원사건과 취소 가능 기간 확인                   | 실사에 이미 흡수됨                |
| 단순 입고 취소        | 기존 정정 연결 | 정확한 입고 회차·E11 대상 확인                 | 부분 입고·재입고·실사 흡수 불명확 |
| 재고 전체 되감기      | 미지원         | 없음                                           | E5 실사 또는 수동 조사로 전환     |
| 매장 전체 시점 복원   | 미지원         | 없음                                           | Supabase 재해 복구와 혼동 금지    |
| Auth·로그인 정보 복원 | 미지원         | 없음                                           | Supabase Auth 운영 절차 사용      |

## 9. 동시성·트랜잭션

- 복구 실행은 기존 `lock_store_write_scope(store_id)` 잠금 순서를 사용한다.
- 별도 잠금 순서를 추가해 매출·재고 RPC와 교착시키지 않는다.
- 대상 행과 현재 revision을 잠금 안에서 다시 읽는다.
- 미리보기 이후 변경된 데이터가 하나라도 있으면 전체 실행을 중단한다.
- 복수 항목 복구는 모두 성공하거나 모두 실패하는 한 트랜잭션으로 제한한다.
- 대규모 복구는 1차에서 지원하지 않는다.
- 동일 멱등키 동시 실행은 하나만 처리되고 나머지는 같은 영수증을 받는다.
- 관리자 실행 중 해당 매장의 일반 앱 쓰기는 잠금에서 직렬화된다.
- 긴 네트워크 호출인 푸시 발송은 DB 트랜잭션 안에서 수행하지 않는다.

권장 오류 코드:

- `ADMIN_FORBIDDEN`
- `ADMIN_MFA_REQUIRED`
- `ADMIN_TICKET_REQUIRED`
- `ADMIN_TARGET_NOT_FOUND`
- `ADMIN_RESTORE_UNSUPPORTED`
- `ADMIN_RESTORE_STALE_PREVIEW`
- `ADMIN_RESTORE_REVISION_CONFLICT`
- `ADMIN_RESTORE_REFERENCE_BLOCKED`
- `ADMIN_RESTORE_LEDGER_CUTOFF`
- `ADMIN_RESTORE_PENDING_RESOLUTION`
- `ADMIN_RESTORE_INVARIANT_FAILED`
- `ADMIN_PUSH_CONSENT_REQUIRED`
- `ADMIN_PUSH_TOKEN_INVALID`

## 10. 어드민 화면

### 10.1 화면 목록

| ID       | 화면             | 핵심 기능                         |
| -------- | ---------------- | --------------------------------- |
| `ADM-01` | 로그인           | 내부 계정 로그인, MFA 확인        |
| `ADM-02` | 사용자 검색      | 사용자·매장 UUID와 이메일 검색    |
| `ADM-03` | 사용자·매장 요약 | 계정·매장·영업·데이터 상태 조회   |
| `ADM-04` | 복구 이력        | 도메인별 변경·원장·판본 타임라인  |
| `ADM-05` | 복구 미리보기    | 필드 diff, 영향 범위, 차단 사유   |
| `ADM-06` | 복구 실행 결과   | 전후 revision, 생성 사건, 영수증  |
| `ADM-07` | 푸시 작성        | 대상·종류·제목·본문·딥링크·예약   |
| `ADM-08` | 푸시 결과        | 기기별 성공·실패·재시도·무효 토큰 |
| `ADM-09` | 관리자 감사      | 관리자 작업 검색과 결과 조회      |

### 10.2 사용자·매장 요약 배치

상단에는 내부 사용자 UUID, 가린 이메일, 로그인 provider, 계정 상태와 매장 ID를 표시한다. 본문은
`현재 상태`, `복구`, `푸시`, `관리자 기록` 탭으로 나눈다. 현재 상태에는 업무 값을 수정하는 입력을
두지 않는다.

### 10.3 복구 미리보기

복구 버튼보다 먼저 다음 정보를 보여준다.

- 선택한 과거 시점과 실제 기록 시각
- 현재 값과 복구 예정 값
- 생성될 새 revision 또는 반대 이벤트
- 영향을 받는 메뉴·매출·재고·설정
- 복구하지 않는 항목
- 차단 사유와 필요한 선행 복구
- CS 티켓, 사유, 실행 운영자

버튼 문구는 `복구`가 아니라 대상이 드러나도록 `식재료 설정 복구`, `매출 정정 생성`처럼 표시한다.

### 10.4 푸시 작성

1차에는 사용자 또는 매장 한 곳만 대상으로 한다.

- 수신 동의와 유효 기기가 없으면 발송 버튼을 비활성화한다.
- 알림 종류는 `운영 안내`, `CS 답변`, `복구 완료`로 제한한다.
- 임의 URL 대신 허용된 앱 딥링크 ID와 파라미터만 선택한다.
- 미리보기에서 대상, 현지 시각, 제목, 본문, 이동 화면을 확인한다.
- 예약과 즉시 발송 모두 멱등키를 사용한다.
- 재전송은 기존 캠페인을 덮어쓰지 않고 새 시도를 만든다.

## 11. 푸시 발송 구조

푸시는 외부 I/O이므로 DB 원장 트랜잭션과 분리한다.

```text
어드민 UI
  → admin-api: 캠페인 검증·등록
  → push_outbox/Queue
  → service-only Edge consumer
  → Expo Push Service
  → receipt 조회
  → push_deliveries 결과·토큰 상태 갱신
```

- 발송 실패는 업무 DB 트랜잭션을 롤백하지 않는다.
- 일시 실패만 지수 백오프로 제한 재시도한다.
- `DeviceNotRegistered`는 해당 토큰을 비활성화한다.
- 같은 캠페인·기기에 중복 발송하지 않도록 유니크 키를 둔다.
- 운영 알림과 홍보 알림 동의를 분리한다.
- 푸시 본문에 재고 금액·매출 금액·개인정보를 직접 넣지 않는다.
- 상세 데이터는 인증 후 앱 화면에서 조회한다.

## 12. 보존 정책

법적 보존 기간은 출시 국가별 법무 확인을 별도 수행한다. 개인정보는 목적 달성 뒤 무조건 오래 보관하지
않고, `서비스 제공에 필요한 기간`, `해당 국가의 법적 의무`, `분쟁·조사 보존 명령` 중 실제 근거가 있는
기간만 적용한다. 매장 업무 데이터는 사용자가 서비스를 이용하는 동안 보존하되 계정 종료 뒤에는 아래
복구 유예기간이 끝나면 삭제한다. 사용자가 자기 장부를 보관해야 하는 기간과 코스트킵이 그 장부를 계속
보관할 수 있는 기간은 같은 개념이 아니므로, 종료 전에 export를 제공한다.

| 데이터                                   | 코스트킵 기본 보존                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| 로그인 이메일·provider subject·프로필    | 계정 활성 중. 최종 탈퇴 확정 뒤 30일 복구 격리 후 삭제·익명화                                |
| OAuth·로그인 session·refresh token       | 로그아웃·탈퇴·권한 회수 즉시 폐기 또는 회수                                                  |
| 매장 소유·직원 관계                      | 관계 활성 중. 종료 뒤 30일 격리 후 직접 식별자를 제거하고 필요한 원장에는 내부 UUID만 유지   |
| 원본 IP·기기·접속 상세                   | 보안 조사 목적 90일                                                                          |
| 비식별 보안 사건·접근 감사               | 1년. 조사·법적 보존 명령이 있으면 해당 종료 시점까지                                         |
| 약관·개인정보 동의 판본과 동의 영수증    | 동의 철회·계약 종료 뒤 5년. 원문 개인정보 대신 최소 증명값만 유지                            |
| 코스트킵 구독·결제·환불 기록             | 국가별 법정 기간. 한국 기본 5년                                                              |
| CS 문의·불만·분쟁 기록                   | 종료 뒤 3년. 단순 문의 첨부파일은 90일 뒤 제거                                               |
| 재고·판매·입고·폐기·발주·정정 원장       | 매장 활성 중. 최종 종료 뒤 30일 복구 격리 후 삭제                                            |
| 매출 판본·영업일 정정·세금·손익 snapshot | 관련 매장 원장과 동일                                                                        |
| `admin_actions`·복구 감사                | 매장 활성 중 + 최종 종료 뒤 1년. 직접 식별자는 30일 뒤 가명화                                |
| `deletion_outbox`·외부 삭제 원장         | 되살릴 수 있는 가장 오래된 backup 만료 뒤 35일까지. 직접 식별자는 넣지 않고 HMAC 참조만 유지 |
| 마스터 판본·변경 이력                    | 매장 활성 중 온라인 1년. 매장 종료 뒤 30일 복구 격리 후 삭제                                 |
| 기존 `entity_change_events`              | 30일. 사용자 화면의 최근 변경 이력                                                           |
| dry-run preview                          | 10분 뒤 만료, 실행되지 않은 payload는 24시간 안에 정리                                       |
| 푸시 발송 상세·receipt                   | 90일                                                                                         |
| 푸시 캠페인 요약                         | 1년                                                                                          |
| 유효 푸시 토큰                           | 수신 동의와 유효 기기 등록이 유지되는 동안                                                   |
| 무효·동의 철회 푸시 토큰                 | 즉시 발송 차단, 원본 token은 30일 안에 삭제                                                  |
| 매장 논리 export                         | 사용자가 직접 내려받거나 성장 단계 임시 export를 만들면 35일                                 |
| Supabase 일일 backup                     | 운영 프로젝트 기본 7일을 목표로 하며 실제 Dashboard 상태를 매일 검증                         |
| PITR                                     | 실제 사용자 데이터 시작 전 활성화 여부 확정. 활성화 시 최소 7일을 기본값                     |
| 독립 재해복구 DB dump                    | 보호된 외부 runner가 일관 snapshot으로 일 1회 암호화 저장, 최근 35일                         |
| 월간 독립 DB archive                     | 전체 DB dump의 장기 승격은 금지. 승인된 매장별 암호화 export만 최대 12개월                   |
| Storage 객체 재해복구 사본               | 객체 기능 도입 시 별도 계정에 일 1회, 최근 35일                                              |
| backup 안의 탈퇴 데이터                  | 일반 조회·개별 복구 금지, 삭제표를 재적용하고 backup 만료와 함께 최대 35일 안에 소멸         |

### 12.1 계정 탈퇴와 매장 폐점

- 탈퇴 요청 즉시 로그인 세션과 푸시 발송을 차단한다.
- 사용자가 30일 복구 유예를 선택한 경우 계정과 매장을 일반 서비스에서 보이지 않는 암호화 격리 상태로
  둔다. 즉시 최종 삭제를 명시적으로 요청하면 법적 보존 대상만 분리하고 유예 없이 삭제 큐로 보낸다.
- 유예기간 중 본인 확인을 거친 철회만 허용하고, 30일이 지나면 자동 복구를 제공하지 않는다.
- 이메일·provider 식별자처럼 서비스 제공에 더 필요하지 않은 개인정보는 삭제·익명화 큐로 보낸다.
- 사용자가 종료 전에 자기 매장 장부를 내려받을 수 있게 export를 제공한다.
- 법적 보존이 필요한 코스트킵 결제·분쟁 자료는 일반 업무 DB와 분리하고 목적 외 조회를 막는다.
- 업무 원장 보존에 별도 법적 근거·고객 계약·`legal_hold`가 있으면 이메일 대신 내부 UUID 또는 삭제
  사용자용 비식별 참조만 남긴다.
- 분쟁·세무 조사·복구 작업이 열려 있으면 적용 대상과 종료일을 가진 `legal_hold`로 해당 데이터만 자동
  삭제에서 제외한다.
- 보존 종료 뒤 물리 삭제는 service role 전용 예약, 2인 승인, 백업 근거, 삭제 영수증을 요구한다.

무료 계정이 24개월 동안 로그인·쓰기·유효 구독이 모두 없으면 60일 전과 30일 전에 삭제 예고를 보내고
계정 종료 절차로 전환한다. 유료 구독·미해결 분쟁·legal hold가 있으면 비활성 자동 삭제를 하지 않는다.
탈퇴·자동 삭제로 만들어진 삭제표는 backup 복원 때 반드시 다시 적용해 이미 삭제된 사용자가 되살아나지
않게 한다.

### 12.2 정리 작업

- 보존 종료 계산은 기기 날짜가 아니라 서버 시각과 매장 시간대를 사용한다.
- 정리 작업은 `eligible_at`을 먼저 계산하고 바로 삭제하지 않는다.
- 첫 실행은 대상 수·용량·참조·legal hold를 보여주는 dry-run이다.
- 다음 실행에서 승인된 범위만 삭제하고 행 수·범위·checksum을 `admin_actions`에 기록한다.
- 새 보관본·export가 필요한 경우 새 파일의 검증이 끝난 뒤 오래된 파일을 지운다.
- 정리 실패는 기존 데이터를 남기는 방향으로 실패하고 자동으로 보존 기간을 단축하지 않는다.

마스터 판본·변경 이력과 `entity_change_events`는 역할이 다르다. 전자는 복구 원본이고 후자는 사용자가
읽는 최근 변경 내역이다. UI 이력을 정리해도 복구 원본을 함께 삭제하지 않는다. 판본 행은 보존 중인
이력·관리자 영수증이 참조하는 동안 삭제하지 않으며 `ON DELETE RESTRICT`로 보호한다.

### 12.3 식재료·메뉴·발주·입고·재고·매출 상세 보존

이 데이터는 하나의 큰 사용자 snapshot으로 저장하지 않는다. **현재값**, **변경 판본**, **불변 업무
원장**, **당시 계산 snapshot**, **재생성 가능한 조회 모델**을 분리한다. 매장이 활성 상태인 동안 업무
원장과 당시 snapshot은 나이만으로 삭제하지 않는다.

| 영역             | 보존 권위                                    | 수정·삭제 계약                                                              | 활성 매장 보존                                 |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| 식재료·구매 옵션 | 현재 master + `master_data_versions`         | 수정·복구는 새 revision. 사용 이력이 있으면 비활성화하고 참조 ID 보존       | 현재값 전체, 자동 복구 판본 최근 1년           |
| 메뉴·레시피 구성 | 현재 menu/recipe + 구성 판본                 | 수정·복구는 새 revision. 삭제 메뉴는 비활성화하고 과거 판매 snapshot 유지   | 현재값 전체, 자동 복구 판본 최근 1년           |
| 발주             | E7 `order_records`와 요청 영수증             | 발주는 재고를 바꾸지 않음. 취소는 E12 상태 사건이며 원본 행을 삭제하지 않음 | 전체 기간                                      |
| 입고             | E1 원본과 발주·부분 입고 회차                | 취소는 E11 반대 부호 사건. 이미 반전한 회차를 다시 취소하지 않음            | 전체 기간                                      |
| 재고             | append-only `inventory_events`               | 직접 UPDATE·DELETE 금지. 폐기 E2, 실사 E5, 판매 E8, 판매 취소 E9로만 변경   | 전체 기간                                      |
| 현재 재고        | `inventory_states.stock_total`               | 원장 합계에서 검산·재구축 가능한 현재 상태                                  | 현재값 + 재구축 검사                           |
| 매출 초안        | `sales_day_drafts`                           | 사용자가 작성하기를 명시한 뒤 생성. 임시저장은 재고·손익 원장을 바꾸지 않음 | 작성 완료·초기화까지, 방치 초안 정리 정책 별도 |
| 확정 매출        | `sales_day_versions` + 현재 head             | 완료·정정마다 불변 새 판본. 수량 차이만 E8/E9와 같은 트랜잭션으로 반영      | 전체 기간                                      |
| 판매 당시 기준   | 메뉴명·가격·원가·세금·고정지출·채널 snapshot | 현재 설정 변경으로 과거 판매를 다시 계산하거나 덮어쓰지 않음                | 관련 매출과 동일                               |
| 가격·손익 추이   | `price_trends`·`profit_trends`               | 원인이 있는 시점 snapshot만 append                                          | 전체 기간                                      |
| 분석·합계 화면   | 원장·판본에서 파생된 조회 모델               | 캐시는 삭제 가능하나 권위 데이터처럼 복구 원본으로 사용하지 않음            | 필요 시 재생성                                 |

#### 연결 보존 규칙

- 사용자·매장·식재료·메뉴를 삭제해도 관련 원장으로 `CASCADE DELETE`하지 않는다. 보존 중에는
  `ON DELETE RESTRICT`와 비활성 상태를 사용한다.
- 식재료를 삭제해도 과거 입고·폐기·실사·판매 소진 사건의 식재료 ID와 당시 이름·단위·단가는 남는다.
- 메뉴를 삭제해도 과거 판매의 메뉴 ID, 당시 메뉴명·판매가·재료비·세금·채널은 남는다. 현재 목록에서만
  `삭제 메뉴` 상태로 구분한다.
- 발주를 취소해도 발주 원본과 취소 E12를 모두 남긴다. 입고된 발주는 발주 삭제로 되돌리지 않고 E11만
  사용한다.
- `inventory_events` 합계는 항상 `inventory_states.stock_total`과 같아야 하며 음수 재고도 그대로
  보존한다.
- 매출 정정은 기존 판본을 수정하지 않고 새 판본과 차이 E8/E9를 남긴다. 같은 멱등키 재호출은 판본이나
  원장을 늘리지 않는다.
- 과거 판매는 당시 snapshot을 읽는다. 현재 식재료 단가·메뉴 구성·세금·고정 지출을 과거에 소급하지
  않는다.

#### 기간과 저장 계층

1. **매장 활성 중:** 전체 업무 원장과 확정 매출 판본을 계속 보존한다. 1년·3년이 됐다는 이유로
   삭제하지 않는다.
2. **최근 변경 자동 복구:** 식재료·메뉴 같은 마스터 변경 판본은 최근 1년을 온라인 자동 복구 대상으로
   둔다. 그 이전 판본을 정리해도 과거 거래에 봉인된 snapshot과 원장은 삭제하지 않는다.
3. **매출 초안:** 현재 구현의 미완료 초안 정리 권위는 `expire_sales_drafts`의
   `business_date < sales_editable_from(store)` 조건이다. `sales_draft_expires_at`은 대상 월에서 두 달 뒤
   첫 영업 시작 시각을 계산하지만 현재 정리 RPC가 이 값을 사용하지 않는다. 90일 보존과 60일·83일 알림은
   구현된 기능으로 표시하지 않는다. 보존기간을 바꾸려면 두 함수를 하나의 계약으로 맞춘 새 migration과
   경계 시험을 먼저 배포한다. 미작성 날짜에는 초안 행을 만들지 않는다.
4. **규모 증가:** 오래된 원장은 월 단위 partition이나 암호화 cold storage로 옮길 수 있지만 논리적
   보존기간과 조회 결과는 바꾸지 않는다. 이동 전후 row count와 checksum을 검증한다.
5. **매장 종료:** 사용자가 30일 복구 유예를 선택하면 전체 업무 데이터를 격리한다. 그 기간에는 읽기·
   쓰기와 일반 어드민 조회를 막고 복구 담당 경로만 허용한다.
6. **최종 삭제:** 30일 뒤 또는 즉시 최종 삭제 요청 시 legal hold와 별도 고객 보관 계약이 없는 매장
   업무 데이터를 참조 역순으로 삭제한다. 사용자가 세무상 보관해야 할 자료는 삭제 전에 export한다.
7. **backup 잔존:** 삭제된 데이터가 재해복구 backup에 최대 35일 남을 수 있으나 일반 조회·개별 복구에
   사용하지 않는다. 복원 시 삭제표를 재적용하고 만료 뒤 물리 소멸시킨다.

#### 복구 방식

- 식재료·메뉴의 잘못된 수정·삭제는 과거 판본을 현재값에 덮어쓰지 않고 새 revision으로 복구한다.
- 잘못된 입고·판매·폐기·실사는 원장 삭제가 아니라 정의된 취소·정정 사건으로 상쇄한다.
- 파생 분석·현재 재고 캐시만 손상되면 권위 원장과 판본에서 재생성한다.
- 한 매장의 원장까지 전부 사라지면 backup/PITR를 새 격리 프로젝트에 복원한 뒤 해당 `store_id`만
  검산하여 전용 복구 RPC로 가져온다. 운영 DB 전체를 과거로 되돌리지 않는다.
- 운영 DB 전체가 사라지면 13.1의 재해복구 절차를 사용한다.

#### 사용자 export

매장 소유자는 서비스 이용 중과 종료 전에 전체 업무 데이터를 요청할 수 있다. export는 최소한 식재료,
구매 옵션, 메뉴·구성, 발주·입고, 폐기·실사, 재고 원장, 매출 판본, 채널, 설정과 파일 manifest를
포함하고 `store_id`, `schema_version`, 기간, row count, 생성 시각과 checksum을 함께 기록한다. 화면용
CSV와 관계·복구 검산용 JSON manifest를 함께 제공하며, 생성된 다운로드 파일은 35일 뒤 자동 삭제한다.

## 13. 선택적 논리 export

1차 MVP의 필수 기능은 아니다. 복구 원본이 아니라 장애 조사와 고객 소명용 대조 자료다.

- pg_cron 또는 운영 스케줄러가 매장 현지 날짜 경계를 지난 뒤 실행한다.
- 사용자 첫 로그인과 연결하지 않는다.
- 앱이 며칠 열리지 않아도 생성 여부가 앱 동작에 좌우되지 않는다.
- 불변 원장 전체 본문을 반복 복제하지 않고 현재 마스터 상태, 판본 manifest, 원장 head와 checksum을 담는다.
- `schema_version`, `captured_at`, 매장 날짜, row count, checksum을 기록한다.
- 먼저 새 객체를 쓰고 검증한 뒤 보존 기간이 지난 객체를 정리한다.
- 진행 중인 조사나 복구가 참조한 객체는 정리 대상에서 제외한다.
- Storage 객체 본문은 DB backup과 별도 복구 정책을 가진다.

### 13.1 전체 데이터 소실 재해 복구

사용자별 마스터 판본, 업무 원장과 `admin_actions`는 운영 DB 안의 데이터이므로 운영 DB 전체가
소실되면 자체적으로 복구할 수 없다. 이 경우는 CS 선택 복구가 아니라 **재해 복구(Disaster Recovery)**로
분리한다. 사용자의 앱 실행·로그인·이탈 시각은 재해복구 시점을 만들지 않는다.

보호 계층은 다음과 같다.

1. 운영 Supabase의 관리형 일일 backup 또는 PITR를 1차 복구 원본으로 사용한다. PITR를 사용하면 같은
   프로젝트의 일일 backup과 별도로 두 개가 생성된다고 가정하지 않는다.
2. 프로젝트 삭제·공급자 계정 장애에도 남도록 운영 Supabase 프로젝트와 다른 보안 주체의 객체 저장소에
   암호화한 논리 DB dump를 일 1회 보관한다. dump는 필요한 DB schema, 역할, Auth 데이터의 포함 범위를
   복구 훈련으로 확인하며 기본 명령의 포함 범위를 추정하지 않는다.
3. Storage API 객체 본문은 DB backup에 포함되지 않으므로 객체 기능을 도입하는 즉시 별도 사본과
   versioning을 적용한다. DB에 남은 객체 metadata만으로 복구 완료를 판정하지 않는다.
4. migration과 Edge Function 소스는 보호된 Git 원격을 권위로 사용한다. Auth 설정, API key, Realtime
   설정, DB 확장과 외부 webhook은 환경별 manifest와 비밀관리 시스템으로 다시 구성한다.
5. 암호화 key는 데이터 dump와 같은 저장소에 평문으로 넣지 않는다. 복구 담당자 2인이 접근할 수 있는
   별도 key escrow와 회수 절차를 둔다.
6. 탈퇴·최종 삭제 요청은 운영 DB의 append-only `deletion_outbox`에 계정·매장 상태 변경과 같은
   트랜잭션으로 먼저 기록한다. 외부 삭제 원장은 outbox의 연속 사본이며, 운영 DB와 다른 보안 주체에
   append-only로 보존한다.

독립 dump는 앱의 `pg_cron`이나 `pg_net`이 아니라 보호된 외부 backup runner가 만든다. runner는 임의
SQL 쓰기·함수 실행 권한이 없는 전용 전체 읽기 역할을 사용한다. RLS 우회를 포함한 전체 읽기가
불가피하면 이 자격증명을 service role과 같은 최고 민감도로 취급하고 IP 허용목록, 실행 시 단기 발급,
90일 이내 회전, 2인 접근과 사용 감사를 적용한다. dump는 소유권·ACL을 이식하지 않도록 `--no-owner`와
`--no-acl`을 사용하고, 병렬 조각 사이에 시점이 달라지지 않는 단일 일관 snapshot으로 만든다. runner의
coordinator가 `REPEATABLE READ READ ONLY` transaction에서 `pg_export_snapshot()`을 실행하고 그
transaction을 끝까지 유지한다. `pg_dump --snapshot=<snapshot_id>`와 별도 manifest 검산 연결도 각각
같은 snapshot을 import한다. `--serializable-deferrable`만 사용한 dump와 별도 시점의 검산 쿼리를 같은
snapshot이라고 간주하지 않는다.

각 dump manifest에는 `captured_at`, snapshot/LSN, migration SHA, schema version, table별 row count,
dump SHA-256, 암호화 key ID, runner 판본과 다음 불변식 결과를 넣는다.

- `inventory_events` 합계 = `inventory_states.stock_total`
- 매출 판본 수·현재 `sales_day_heads` 포인터와 판본 checksum
- `deletion_outbox`의 마지막 연속 sequence와 hash-chain head

검산은 dump와 같은 snapshot에서 실행하고, 주 1회 무작위 dump를 빈 격리 프로젝트에 실제 복원해
manifest와 다시 대조한다. dump 생성·암호화·업로드·manifest 검산 중 하나라도 실패하면 그 날짜의
복구본을 성공으로 표시하지 않고 운영 경보를 낸다.

`deletion_outbox` 최소 필드는 `sequence`, `event_id`, `external_intent_id`, `external_sequence`,
`lifecycle_revision`, `lifecycle_event`, `deletion_kind(account|store|partial)`, `subject_ref_hmac`,
`store_ref_hmac`, 삭제 범위, `requested_at`, `eligible_at`, `effective_at`, `policy_version`, `hmac_key_id`,
`legal_hold_ref`, `previous_checksum`, `event_checksum`이다. 직접 식별자와 업무 payload는 넣지 않는다.
HMAC key를 회전할 때는 되살릴 수 있는 backup의 최장 수명 동안 구·신 key의 검증 겹침을 유지하고 key
파기 영수증을 남긴다.

현재 `retire_my_account`처럼 상태 변경과 Auth 삭제를 한 호출에서 끝내는 경로는 외부 원장 ACK와 30일
유예 철회를 원자적으로 보장하지 못한다. backup 복구를 운영하기 전에 다음 append-only lifecycle로
migration한다. 외부 원장은 상태 행을 덮어쓰지 않고 같은 주체·원본 intent를 참조하는 증가
`lifecycle_revision` 사건을 쌓는다.

1. 삭제 API가 외부 원장에 payload 없는 서명된 `DELETE_REQUESTED` intent를 먼저 기록하고
   `external_intent_id`·`external_sequence`·`lifecycle_revision`을 받는다. 외부 원장을 쓸 수 없으면
   삭제 절차를 시작하지 않고 사용자가 다시 시도할 수 있게 한다.
2. 사용자 접근·세션·발송을 즉시 차단하고 archive 상태, `eligible_at`과 같은 intent를 참조하는 outbox
   사건을 한 DB transaction으로 commit한다. 30일 유예를 선택했으면 Auth identity와 복구에 필요한 직접
   식별자는 일반 조회가 불가능한 암호화 격리에 두고 아직 물리 삭제하지 않는다.
3. 외부 writer가 outbox hash-chain을 연속 수신하면 새 `ACCESS_BLOCKED` ACK 사건을 append한다. DB
   commit 전후에 장애가 나서 `DELETE_REQUESTED`만 남아도 복원 게이트는 해당 주체의 로그인을 열지 않고
   운영자 대조 뒤 다음 사건을 확정한다.
4. 유예기간 안에 본인 확인을 거친 철회가 들어오면 외부 원장에 원본 intent를 참조하는
   `REACTIVATION_REQUESTED` 사건을 먼저 append하고, DB의 archive 해제와 outbox 새 revision을 같은
   transaction으로 commit한다. 외부 writer가 `REACTIVATED` ACK 사건을 append한 뒤에만 로그인과 일반
   조회를 다시 연다.
5. 최종 삭제 worker는 실행 직전에 DB와 외부 원장의 최신 연속 `lifecycle_revision`, `eligible_at`,
   legal hold와 철회 부재를 다시 검사한다. 새 `FINAL_DELETE_REQUESTED`→outbox commit→외부
   `FINAL_DELETE_COMMITTED` ACK를 완료한 뒤에만 Auth·직접 식별자와 원문을 물리 삭제한다. revision이
   하나라도 다르거나 최신 상태가 `REACTIVATED`면 지연 job을 취소한다.

복원 게이트는 과거 삭제 사건을 무조건 재적용하지 않는다. 주체별 hash-chain과
`lifecycle_revision`을 끝까지 접어 **최신 유효 상태**를 계산한다. 최신 상태가 `ACCESS_BLOCKED` 또는
`FINAL_DELETE_COMMITTED`면 차단·삭제를 적용하고, `REACTIVATED`면 이전 삭제 사건으로 계정을 다시
차단하거나 삭제하지 않는다.

물리 `Restore to new project`는 복원된 `pg_cron`·`pg_net` 작업이 완료 직후 실행될 수 있고 복원 전에
제외·일시정지할 수 없으므로 기본 복구 경로로 사용하지 않는다. 외부 부작용이 없는 schema라는 사전
증거가 있을 때만 물리 복원을 허용한다. 그 밖의 경우에는 네트워크·외부 비밀·발송 권한이 없는 격리
프로젝트를 먼저 만들고 논리 복원을 사용한다. 논리 dump/restore에는 `cron.job`,
`cron.job_run_details`, `supabase_functions.hooks`, `net.*` queue와 `vault.secrets` 값을 넣지 않는다.
`sikjae-close-due`, `sikjae-apply-breaks`, `sikjae-purge-changes` 등록문도 endpoint 전환 승인 전까지
실행하지 않는다. Auth·Vault·암호화 열은 key escrow와 환경별 manifest로 별도 이관·검증한다.

Supabase 관리형 backup과 논리 dump가 사용자 정의 로그인 역할의 비밀번호를 복구한다고 가정하지
않는다. custom role의 LOGIN/NOLOGIN·membership·owner 계약을 migration에서 재생하고 필요한 비밀번호와
비밀을 새로 발급한 뒤 RLS/ACL을 검산한다. 이 자격증명 재구성과 외부 작업 비활성 검사가 끝나기 전에는
데이터 검산용 읽기 외의 접근을 열지 않는다.

전체 소실 복구 절차는 다음 순서를 고정한다.

```text
사고 선언·모든 쓰기 중지
→ 사고 직전의 검증된 복구 시점 T 선택
→ 외부 연결·비밀·발송 권한이 없는 새 격리 프로젝트 생성
→ 물리 복원 안전 조건 충족 여부에 따라 물리 또는 논리 복원 분기
→ cron·net queue·Function hook·Vault secret 미적재와 외부 발송 불가 검사
→ custom role·owner·membership 재생과 자격증명 회전
→ 복원된 deletion_outbox와 외부 삭제 원장의 연속 sequence·hash-chain 상호 검증
→ 외부 원장에만 있는 복원 시점 이후 lifecycle 사건을 revision 순서로 결합해 주체별 최신 유효 상태 계산
→ 차단·최종 삭제·재활성화 상태를 최신 유효 상태대로 적용
→ row count·checksum·원장 합계·매출 판본·Auth·RLS/ACL 검산
→ Storage 객체 별도 복원
→ Edge Function·환경 설정 재배포와 key 회전
→ 로그인·식재료→메뉴→발주·매출 핵심 흐름 smoke test
→ 승인 뒤 앱 endpoint 전환
→ 손상 프로젝트를 읽기 전용 보존하고 사고 영수증 기록
```

원본 프로젝트가 남아 있고 일부 행만 삭제된 사고는 관리형 backup/PITR를 새 격리 프로젝트에 복원한 뒤
필요한 행을 비교한다. 운영 DB를 과거 시점으로 통째로 되감지 않고, 도메인 RPC가 새 revision·정정
판본·반대 이벤트를 생성하도록 복구한다.

RPO는 복구 수단별로 명시한다. 일일 backup이나 독립 일일 dump만 있으면 최악의 경우 다음 backup 전
변경분까지 잃을 수 있으므로 목표 RPO는 24시간이다. 실제 사용자 데이터를 받기 전에 더 짧은 RPO가
필요하면 PITR를 켜고 허용 보존 기간을 최소 7일로 정한다. RTO는 DB 크기와 객체 수에 따라 달라지므로
시간을 약속하지 않고 분기별 스테이징 전체 복구 훈련의 실측값으로 관리한다.

운영 프로젝트 삭제는 관리형 backup까지 함께 잃을 수 있는 독립 위험으로 취급한다. 따라서 별도 계정의
암호화 dump와 Storage 사본이 준비되지 않으면 실제 사용자 데이터를 받지 않는다. OneDrive와 개발자 PC는
재해복구 저장소로 사용하지 않는다.

복원된 outbox chain이 외부 원장의 같은 sequence에서 다른 checksum을 갖거나 중간 sequence가 빠졌거나,
외부 원장이 복원본보다 최신인 사건을 재적용하지 못하거나, 최신 외부 sequence·서명을 증명하지 못하면
복원 프로젝트의 로그인, 일반 조회, 예약 작업과 외부 발송을 열지 않는다. 삭제 원장은 되살릴 수 있는
가장 오래된 backup의 만료일까지 유지하고, 모든 관련 backup 만료를 확인한 뒤 35일의 검증 유예기간을
더해 파기한다. 승인된 매장별 장기 export가 있으면 해당 매장의 삭제 증명도 같은 기간 유지한다.

### 13.2 특정 사용자·매장 데이터 전체 소실

운영 DB는 정상인데 한 사용자 또는 한 매장의 업무 데이터만 전부 사라진 사고는 **매장 단위 재해
복구**로 처리한다. 이메일을 기준으로 새 빈 매장을 만들거나, 화면에서 식재료·메뉴를 하나씩 다시
입력하지 않는다. 내부 `user_id`, `store_id`, Auth provider identity와 매장 소유·소속 관계를 먼저
확정한다.

1. 해당 매장의 앱 쓰기와 예약 작업을 즉시 잠그고 빈 상태의 신규 입력이 사고 데이터와 섞이지 않게 한다.
2. 현재 DB에 원장·판본·마스터 변경 이력이 남아 있으면 그 권위 이력으로 현재 시점의 새 revision·정정
   사건을 만든다.
3. 매장 행과 이력까지 삭제됐다면 사고 직전 backup/PITR를 **새 격리 프로젝트**에 복원한다.
4. 격리 프로젝트에서 대상 `store_id`의 사용자 관계, 설정, 식재료, 구매 옵션, 메뉴·구성, 발주·입고,
   재고 원장·현재 상태, 매출·영업일 판본과 감사 관계를 하나의 manifest로 추출한다.
5. 운영 DB에 같은 ID나 후속 입력이 있는지 충돌 검사한 뒤 전용 매장 복구 RPC가 참조 순서대로 한
   트랜잭션에서 복구한다. 원장과 snapshot의 원래 식별자·시각·revision 관계를 보존하고 일반 앱 저장
   API를 반복 호출하지 않는다.
6. Auth 계정만 사라졌다면 업무 원장을 새 빈 계정에 귀속하지 않는다. 본인 확인 뒤 새 provider identity를
   기존 내부 사용자·매장 관계에 다시 연결하고 그 과정을 `admin_actions`에 기록한다.
7. 대상 매장의 Storage 객체가 있으면 별도 객체 사본에서 복구하고 DB metadata와 checksum을 맞춘다.
8. 행 수·관계 checksum, `inventory_events` 합계와 `inventory_states.stock_total`, 판매 판본·영업일
   상태, 타 매장 혼입 0건, 중복 복구 0건을 확인한 뒤 쓰기 잠금을 해제한다.

전용 복구 경로는 일반 변경 RPC와 다른 **원장 import**이며 다음 조건을 모두 만족해야 한다.

- `service_role`도 테이블에 직접 DML하지 않는다. 외부에 노출되지 않은 `admin_import_store_ledger`
  경계와 NOLOGIN function owner `costkeep_ledger_importer`를 둔다. 보호된 복구 runner만 임시 LOGIN 역할
  `costkeep_restore_runner`로 접속하며, 이 역할은 테이블 DML 없이 해당 함수 EXECUTE만 가진다. 접속은
  IP 허용목록·단기 자격증명·2인 승인으로 제한하고 대상 `store_id` 잠금과 manifest checksum을 입력으로
  요구한다.
- 사용자 정의 GUC는 권한 경계로 사용하지 않는다. import 함수가 보호 테이블
  `ledger_import_sessions`에 `txid_current()`·backend PID·대상 store·manifest checksum·일회성 token을
  기록하고, `SET LOCAL costkeep.ledger_import_token`은 그 token 운반에만 쓴다. 이력·basis
  publish·guard trigger는 `session_user = 'costkeep_restore_runner'`이고 현재 transaction·backend·store·
  token이 보호 행과 모두 일치할 때만 새 사건 생성을 억제한다. 그 밖의 세션에서 GUC가 설정돼 있으면
  억제하지 않고 예외로 거절한다. 성공·rollback 뒤 보호 행과 GUC는 같은 transaction에서 소멸한다.
- UUID·업무 revision·발생 시각처럼 참조되는 원본 식별자는 보존한다. 전역 identity sequence가 현재
  운영 행과 충돌하면 덮어쓰지 않는다. 복구가 동일 sequence 보존을 요구하면 전체 transaction을
  실패시키고, 순서 보존에 영향이 없는 전역 surrogate만 재할당할 수 있는 경우에는 source→target
  mapping과 checksum을 `admin_actions`에 남긴다.
- 같은 UUID·멱등키·revision이 다른 payload를 가리키거나 매장 경계가 다르면 전체 rollback한다. 같은
  payload의 재실행은 행을 추가하지 않고 이미 적용된 같은 manifest 영수증을 돌려준다.
- commit 직전에 `inventory_events` 합계, `sales_day_heads` 포인터, 판본 hash, 외래 키, 타 매장 혼입과
  trigger 무발화를 같은 transaction에서 검산한다. 성공 뒤 `admin_actions`에 source snapshot,
  manifest checksum, row count, sequence mapping과 검산 결과를 기록한다.

이 경계와 trigger 예외가 migration·DB 시험으로 구현되기 전에는 매장 단위 원장 import를 운영 기능으로
열지 않는다.

매장 단위 복구는 현재 운영 DB 전체를 과거 시점으로 되돌리지 않는다. 복구 시점 뒤에 다른 매장이 만든
정상 데이터가 함께 사라지기 때문이다. 사고 뒤 해당 매장에서 새 데이터가 생겼다면 자동 병합하지 않고
복구본과 현재본의 diff를 만든 뒤 도메인별 정정 사건으로 합친다.

재발 방지를 위해 사용자 탈퇴와 매장 폐점은 업무 데이터의 물리 삭제로 연결하지 않는다. `stores`, 사용자
소속, 원장·판본·복구 이력 사이 외래 키는 보존 기간 중 `ON DELETE RESTRICT`를 사용하며 archive와
개인정보 익명화를 분리한다. 매장 전체 물리 삭제는 보존 기간 만료, legal hold 없음, 독립 backup 검증,
대상 row count preview와 2인 승인을 모두 요구한다.

### 13.3 일별·말일 복구시점 운영

업무 원장 보존과 backup 복구시점은 별도다. 활성 매장의 식재료·메뉴·발주·입고·재고·확정 매출 원장은
운영 DB에 전체 기간 남아 있으므로, 과거 월 데이터를 보존하기 위해 매일 같은 전체 데이터를 복제하지
않는다. backup은 장애·오삭제·손상 이전 시점으로 돌아가기 위한 수단이다.

권장 복구 구간은 다음과 같다.

| 구간                    | 복구 단위                                     | 목적                                         |
| ----------------------- | --------------------------------------------- | -------------------------------------------- |
| 최근 1~35일             | 하루 1개, 단독 복원이 검증된 독립 암호화 dump | 프로젝트 삭제·공급자 장애를 포함한 기본 복구 |
| 활성화·검증된 PITR 범위 | PITR가 실제 제공하는 세밀한 시점              | 최근 오삭제·오수정의 RPO 단축                |
| 35일 이전               | 전체 DB 장기본 없음                           | 승인 시 매장별 암호화 export만 최대 12개월   |

PITR를 사용하지 않으면 공급자가 보존하는 관리형 일일 backup도 최근 7일의 복구 후보가 된다. 다만
프로젝트 삭제·공급자 계정 장애에는 독립 원본이 아니므로 그 사고 유형의 RPO는 독립 일일 dump 기준 최대
24시간이다. PITR를 사용해도 프로젝트 삭제에 대비한 독립 일일 dump는 1일부터 35일까지 중첩 보존한다.
각 일일 dump는 다른 날짜의 증분이나 관리형 WAL 없이 단독 복원할 수 있어야 한다.

월말 checkpoint가 필요하다고 결정해도 전날 전체본과 말일 전체본을 중복해서 장기 보관하지 않는다.
각 매장의 월말 후보는 그 매장의 서버 `sales_recommended_date`가 다음 달로 넘어간 뒤 처음 성공한 일별
dump로 지정한다. 하나의 프로젝트 dump가 시간대가 다른 모든 매장의 같은 월말 후보일 필요는 없으며,
dump manifest가 매장별 후보 월과 `business_date` 경계를 연결한다. 후보는 해당 월의 최종 업무 사실이
아니라 `captured_at` 당시 상태다. 휴무·미작성·작성 중 날짜와 다음 달에 이루어진 전월 정정은 후보를
덮어쓰지 않고 이후 운영 원장과 새 일별 dump에 기록한다. 월말 후보도 다른 일별 dump와 같이 35일 뒤
만료하며, 전체 DB dump를 장기본으로 승격하지 않는다.

장기 월말 원문본은 기본 비활성이다. 승인하더라도 전체 프로젝트 dump를 승격하지 않고 §13의 **매장별
암호화 논리 export**로만 만든다. 보존 목적·대상 매장·법적 근거 또는 고객 계약·legal hold·만료일을
명시하고 최대 12개월을 넘기지 않는다. 이 export는 전체 재해복구 원본이 아니다. 매장 최종 삭제 때
해당 객체와 매장별 key를 파기하고 영수증을 남길 수 있어야 한다. 여러 매장이 섞인 공용 월말본을 장기
보관하면서 일부 매장 원문만 35일 안에 물리 소멸시킬 수 있다고 가정하지 않는다. 삭제표 재적용은
재노출을 막는 게이트이지 원문의 물리 삭제를 대신하지 않는다.

예를 들어 8월 31일이 말일이면 다음과 같이 처리한다.

```text
8월 30일 종료 상태
  └─ 일반 일별 checkpoint로 35일 범위 안에서 보존

8월 31일 영업 중
  └─ 새 입고·판매·정정은 운영 원장과 PITR에 계속 기록

8월 31일 정기 backup 시점
  └─ 일반 일별본. 8월 31일 영업이 진행 중이면 아직 월말 후보로 지정하지 않음

9월 1일, 서버 sales_recommended_date가 9월로 넘어간 뒤 첫 성공 dump
  ├─ 8월 월말 후보 태그와 미작성·초안·확정 head를 manifest에 기록
  ├─ 후보는 35일 일별 보존 안에서만 유지
  └─ 8월 귀속 정정도 9월의 새 원장·판본·일별 dump에 포함
```

월말 후보는 구형 영업 시작·종료 상태나 모든 날짜의 작성 완료를 기다리지 않는다. `sales_recommended_date`
전환만 사용하며 서울·뉴욕처럼 시간대가 다른 매장은 서로 다른 일별 dump가 같은 월의 후보가 될 수 있다.
인프라 DB dump는 전체 프로젝트의 UTC `captured_at`과 가능한 WAL/LSN을 기록한다. 매장 논리 manifest는
서버 매장 시간대로 해석한 `business_date`, 미작성·작성 중·작성 완료 상태, 현재 판본 head, 원장 head,
row count와 checksum을 연결한다. 기기 시각 23:59나 사용자 첫 로그인은 기준으로 사용하지 않는다.

1차 구현은 날짜별 단독 복원 가능한 dump와 그 dump의 매장별 월말 후보 태그만 지원한다. 장기 월말
전체본과 `월말 기준점 + 다음 달 증분` 방식은 현재 보장하지 않는다. 증분 backup은 기준 snapshot,
insert/update/delete와 commit 순서, schema 변화, 누락 탐지, 참조 객체와 GC 계약을 정의하고 독립 복원
시험을 통과하는 별도 후속 기능으로만 도입한다. content hash와 원장 head만으로 본문이나 삭제 사건을
복원할 수 있다고 간주하지 않는다.

## 14. 검증 계획

### 14.1 DB 불변식 시험

- 앱 역할이 마스터 판본·변경 이력과 `admin_actions`에 직접 쓰지 못한다.
- 이력·영수증의 UPDATE·DELETE·TRUNCATE가 거절된다.
- 다른 매장 이력과 사용자 정보를 읽거나 복구하지 못한다.
- 무변경 저장은 복구 이력을 만들지 않는다.
- 식재료·메뉴 저장 한 번이 정확히 한 correlation으로 기록된다.
- 레시피 부모와 구성 행의 전후 payload가 같은 요청에 묶인다.
- schema version이 다른 이력도 정규화해 diff를 생성한다.
- 동일 멱등키 재호출이 원장과 revision을 늘리지 않는다.

### 14.2 도메인별 복구 시험

- 식재료 이름·단가·단위·카테고리·메모를 각각 과거 값으로 새 revision 복구한다.
- 구매 옵션 복구 시 부모 식재료와 단가 검산이 유지된다.
- 메뉴 구성 복구가 재료비 미리보기와 이후 신규 판매에만 반영된다.
- 과거 매출의 이름·원가 snapshot은 메뉴 복구로 바뀌지 않는다.
- 삭제된 참조 재료가 필요한 메뉴 복구는 차단된다.
- 설정 복구가 과거 영업일 snapshot을 수정하지 않는다.
- 판매 감소가 E9를 만들고 같은 목표 재호출은 사건을 추가하지 않는다.
- 입고 취소가 E11을 만들며 부분 입고 회차를 혼동하지 않는다.
- 실사 컷오프 전후 판매·입고·폐기 정정이 현재 계약을 지킨다.
- `pending_inventory_resolution`이 필요한 복구는 자동 완료로 위장하지 않는다.

### 14.3 경합 시험

- 두 운영자가 같은 항목을 같은 preview로 복구하면 한 건만 성공한다.
- 점주 저장과 관리자 복구가 동시에 실행되면 revision 충돌 또는 직렬화된 결과만 나온다.
- 매출 완료와 관련 메뉴 복구가 동시에 실행돼도 원장 합계가 보존된다.
- 동일 푸시 캠페인 동시 실행이 기기당 한 번만 발송된다.
- Edge Function 재시도와 DB RPC 재시도가 같은 영수증을 반환한다.

### 14.4 보안 시험

- 일반 사용자 JWT로 모든 admin endpoint 호출이 거절된다.
- MFA `aal1` 운영자는 조회와 실행 모두 거절된다.
- 역할별 허용·거절 매트릭스를 테스트한다.
- 응답·로그·오류에 이메일 원문, 푸시 토큰, JWT가 포함되지 않는다.
- 어드민 번들에서 service role 문자열이 검출되지 않는다.
- Edge Function이 임의 RPC 이름·임의 JSON DML을 받지 않는다.

### 14.5 복구 훈련

스테이징 합성 매장에서 다음 시나리오를 순서대로 실행하고 RPO·RTO·누락을 기록한다.

1. 식재료 단가 오입력 후 선택 복구
2. 메뉴 구성 오입력 후 참조 차단과 선행 복구
3. 완료 매출 수량 오입력 후 새 정정 판본 생성
4. 입고 취소와 재입고 회차 구분
5. 전체 실사 이후 과거 판매 정정
6. 복구 도중 동시 점주 수정
7. 중복 네트워크 재시도
8. 관리자 권한 회수 직후 실행 차단
9. 푸시 무효 토큰과 부분 성공
10. DB 전체 복구와 Storage 객체 복구의 별도 절차
11. 운영 프로젝트 삭제를 가정한 독립 DB dump 복원
12. 복원 프로젝트의 cron·webhook 무발송과 key 회전
13. 한 매장의 원장·판본 전체 삭제 후 매장 단위 선택 복원
14. Auth 사용자만 삭제된 상태에서 기존 내부 사용자·매장 관계 재연결
15. PITR 미사용 상태에서 최근 7일 내 프로젝트 삭제와 독립 일일 dump 복원
16. 말일 휴무·미작성·작성 중 상태를 포함한 월말 후보 생성
17. 다음 달에 완료한 전월 매출과 전월 정정이 원래 월말본을 바꾸지 않는지 확인
18. 삭제표보다 오래된 backup 복원 뒤 최신 독립 삭제 원장 재적용
19. 독립 삭제 원장이 없거나 서명·sequence가 오래된 경우 접근 개방 차단
20. 매장별 장기 export 생성 뒤 해당 매장 탈퇴 시 객체·key 물리 파기 검증
21. 외부 호출 작업이 포함된 물리 복원을 차단하고 논리 복원 경로 사용
22. 외부 삭제 원장 writer 실패 뒤 `deletion_outbox` 미승인 사건이 최종 물리 삭제를 차단하고 재시도되는지 확인
23. 매장 원장 import 중 이력·basis publish·guard trigger가 새 사건을 만들지 않으며 sequence/UUID 충돌 시
    전체 rollback하는지 확인. 일반 `service_role` 세션이 같은 GUC를 설정하고 DML하면 trigger가 반드시
    거절하는지도 함께 확인
24. 서울·뉴욕 매장의 `sales_recommended_date` 전환 시각이 달라도 각각 올바른 일별 dump에 월말 후보가
    지정되는지 확인
25. 논리 복원 프로젝트에 `cron.job`·`net.*` queue·Function hook·Vault secret이 없고 custom role
    membership·owner·새 자격증명이 복구된 뒤에만 검산이 통과하는지 확인
26. 매주 무작위로 고른 독립 일일 dump를 빈 프로젝트에 단독 복원하고 manifest 불변식 실패가 경보되는지 확인
27. 탈퇴→외부 `ACCESS_BLOCKED` ACK→유예 철회→`REACTIVATED` ACK 뒤 지연 삭제 재시도와 과거 backup
    복원을 실행해, 최신 lifecycle revision이 계정 재삭제를 막는지 확인

## 15. 구현 단계

### 단계 A — 계약 확정과 이력 공백 조사

- 식재료·구매 옵션·메뉴·구성·설정·판매 채널의 현재 저장 RPC와 revision을 표로 확정한다.
- 기존 이력에 before/after가 충분한 도메인과 부족한 도메인을 구분한다.
- 복구 지원·차단·수동 조사 대상을 확정한다.
- 운영자 역할·MFA·CS 티켓 형식을 결정한다.

완료 조건:

- 모든 복구 대상이 하나의 권위 저장 RPC와 연결된다.
- 직접 UPDATE가 필요한 항목이 0개다.
- 원장 사건별 실사 컷오프 처리표가 완성된다.

### 단계 B — 마스터 이력과 관리자 감사

- 신규 migration으로 `master_data_payloads`, `master_data_versions`, `master_data_history`,
  `admin_actions` 계약을 추가한다.
- 기존 저장 RPC 내부 또는 안전한 내부 트리거에서 이력을 기록한다.
- 앱·service role 직접 DML을 회수하고 전용 실행자 경계를 둔다.
- DB 타입을 재생성한다.

완료 조건:

- append-only·매장 격리·무변경·schema version 시험 통과
- 기존 저장·조회·원장 합계 회귀 없음

### 단계 C — 읽기 전용 어드민

- `apps/admin`을 별도 패키지로 추가한다.
- `admin-api`가 MFA·역할·allowlist를 검사한다.
- 사용자 검색, 매장 요약, 변경 타임라인, 관리자 감사 화면을 구현한다.
- 이메일과 토큰 마스킹 시험을 추가한다.

완료 조건:

- 일반 점주 계정과 `aal1` 운영자는 접근 불가
- 지원 담당자는 DB 콘솔 없이 필요한 조회 가능

### 단계 D — 복구 미리보기

- 도메인별 복구 후보 조회와 diff 정규화를 구현한다.
- preview hash·현재 revision·차단 사유를 반환한다.
- 읽기 전용이므로 이 단계에서는 업무 데이터를 바꾸지 않는다.

완료 조건:

- 지원·차단 결과가 실제 RPC 계약과 일치
- 오래된 preview 실행이 확실히 차단됨

### 단계 E — 지원되는 선택 복구

우선순위:

1. 설정·고정 지출처럼 기존 CAS 복구가 있는 항목
2. 식재료·구매 옵션
3. 메뉴·레시피 구성
4. 기존 매출 정정 RPC 연결
5. 입고·폐기·실사 컷오프 분기

각 도메인은 독립적으로 구현·검증한다. 모든 도메인을 한 번에 여는 전체 복구 버튼을 만들지 않는다.

완료 조건:

- dry-run과 실행 결과가 일치
- 모든 실행에 `admin_actions` 영수증 존재
- 원장 합계·현재 상태·판본 검산 통과

### 단계 F — 개별 운영 푸시

- 기기 등록·동의·토큰 무효화 계약을 구현한다.
- 캠페인 outbox와 Edge consumer를 추가한다.
- 개별 사용자·매장 대상 즉시·예약 발송만 제공한다.
- receipt 조회와 제한 재시도를 구현한다.

완료 조건:

- 중복 발송 0건
- 무동의 사용자 발송 0건
- 무효 토큰 자동 비활성화
- 운영자·대상·내용·결과 감사 가능

### 단계 G — 운영 복구 준비

- 스테이징 복구 훈련을 수행한다.
- 운영 Supabase backup·PITR RPO를 실제 사용자 시작 전에 확정한다.
- 신규 migration으로 `deletion_outbox`와 불변 trigger를 추가하고 계정 탈퇴·매장 최종 삭제를 외부
  `DELETE_REQUESTED` → archive/outbox commit → `ACCESS_BLOCKED` ACK → 유예 중 선택적
  `REACTIVATED` ACK 또는 만료 뒤 `FINAL_DELETE_COMMITTED` ACK → Auth·원문 물리 삭제의 fail-closed
  lifecycle로 바꾼다.
- 전용 backup runner·전체 읽기 역할·IP 허용목록·비밀 회전·단일 snapshot dump·manifest 계약을
  코드와 runbook으로 만들고 운영 프로젝트와 다른 보안 주체에 일일 암호화 dump를 저장한다.
- `admin_import_store_ledger`, 전용 LOGIN/NOLOGIN 역할, 보호 session row와 일회성 transaction token,
  충돌 전체 실패와 transaction 내부 검산을 migration·DB 시험으로 구현한다.
- `costkeep.fixed_cost_restore`, `costkeep.sales_finalize`를 포함한 기존 GUC 우회 경로를 전수 조사하고,
  역할·transaction·보호 session row 검증 없는 플래그는 같은 migration에서 권한 경계로 사용하지 못하게
  보강한다.
- 논리 복원 제외 목록, custom role 재생, outbox/외부 삭제 원장 대조와 외부 tail 재적용을 자동화한다.
- Storage 객체가 생기면 별도 사본·versioning과 복구 훈련을 수행한다.
- 분기마다 새 격리 프로젝트에서 전체 복구 RTO를 실측한다.
- 독립 dump는 매주 무작위 일자를 자동 복원하고, 전체 복구는 분기마다 실측한다.
- 장기 월말 보존 필요성이 승인된 뒤에만 최대 12개월의 매장별 암호화 export를 추가한다.

## 16. 배포와 중단 조건

배포 순서:

```text
새 migration과 DB 시험
→ 로컬 fresh DB·경합·upgrade 검사
→ admin-api 단위·보안 시험
→ 어드민 웹 타입·번들·접근성 검사
→ 스테이징 합성 복구 훈련
→ 독립 검수
→ staging 적용
→ 정확한 SHA의 보호 CI
→ production 계획 확인
→ 사람 승인 뒤 production 적용
```

다음 중 하나면 운영 적용을 중단한다.

- 직접 DB UPDATE가 필요한 복구 경로가 남음
- 원장 합계와 현재 상태가 일치하지 않음
- 다른 매장 데이터 조회 가능
- 동일 요청 재시도에서 사건·판본 중복 발생
- 실사 컷오프 이후 재고 처리 결과가 불명확
- 미리보기와 실행 diff가 다름
- 관리자 MFA·역할·감사 영수증 중 하나라도 우회 가능
- 운영 backup/PITR·Storage 복구 책임자가 확정되지 않음
- `deletion_outbox`와 외부 삭제 원장의 hash-chain·ACK가 불일치함
- 삭제·재활성화 worker가 실행 직전 최신 `lifecycle_revision`과 유예 만료를 재검증하지 못함
- 독립 dump의 같은 snapshot manifest 검산 또는 주간 단독 복원이 실패함
- 논리 복원 프로젝트에서 cron·net queue·Function hook·Vault secret이 활성 상태임
- 일반 `service_role` 또는 앱 세션이 사용자 정의 GUC만 설정해 이력·guard trigger를 우회할 수 있음

## 17. 운영 지표

출시 뒤 다음 값을 매월 확인한다.

| 지표                              | 초기 목표                         |
| --------------------------------- | --------------------------------- |
| 지원 도메인 dry-run 생성 성공률   | 99% 이상                          |
| stale preview 충돌률              | 측정 후 5% 초과 시 UX·잠금 재검토 |
| 같은 멱등키의 중복 원장·판본      | 0건                               |
| 복구 후 원장 합계 불일치          | 0건                               |
| 타 매장 조회·실행                 | 0건                               |
| 관리자 감사 누락                  | 0건                               |
| 단일 항목 복구 RTO                | 정상 조건 10분 이내               |
| 복구 가능한 변경 이력 RPO         | 권위 저장과 같은 트랜잭션, 0      |
| 푸시 기기당 중복 발송             | 0건                               |
| 푸시 무효 토큰 재시도             | 비활성화 뒤 0건                   |
| 독립 일일 dump 성공·manifest 검산 | 매일 1건, 실패 시 즉시 경보       |
| 무작위 독립 dump 단독 복원        | 주 1회, 불변식 불일치 0건         |
| 삭제 outbox 외부 ACK 지연         | 15분 이내, 미승인 물리 삭제 0건   |

저장 비용은 복사본 개수만으로 판단하지 않는다. 매장별 새 판본 수, 판본 payload의 p50·p95·최댓값,
인덱스를 포함한 월 증가량, 논리 export 크기, 복구 요청 건수와 운영자 수동 처리 시간을 함께 측정한다.

예시로 한 매장이 하루 20번 기준정보를 수정하고 중복 제거된 판본 하나가 평균 2KB라면 원문 payload는
연간 약 14.6MB다. 1,000개 매장은 약 14.6GB이며 실제 DB 크기는 인덱스·행 메타데이터 때문에 더
커진다. 이 수치는 용량 보장이 아니라 관측 기준이며, 실제 p95가 16KB를 계속 넘거나 온라인 이력 크기가
예산을 넘으면 오래된 복구 이력을 cold archive로 옮기고 온라인 자동 복구 기간을 재검토한다.

## 18. 사람 결정 대기

구현 전에 사람이 확정해야 하는 항목:

1. 코스트킵 내부 어드민 배포 URL과 접근 네트워크 범위
2. 코스트킵 운영자 역할별 실제 담당자와 MFA·퇴사자 세션 회수 절차
3. CS 티켓 시스템의 형식과 `ticket_ref` 검증 방식
4. 운영 PITR 사용 여부와 승인 가능한 최대 RPO
5. 마스터 판본·변경 이력의 온라인 1년 이후 보관·파기 정책
6. 푸시 공급자 보안 설정, 운영 알림 동의 문구와 국가별 개인정보 검토
7. 매장 논리 export를 실제로 도입할지 판단할 측정 기준
8. 독립 재해복구 저장소·암호화 key escrow·복구 승인 담당자

이 결정이 없더라도 단계 A의 읽기 전용 이력 공백 조사는 가능하다. 권한·보존·운영 비용을 확정하지
않은 상태에서는 production 어드민과 복구 실행 기능을 열지 않는다.

## 19. 완료 기준

1차 어드민을 완료했다고 말하려면 다음을 모두 만족해야 한다.

- 사용자 UUID·로그인 방식·가린 이메일·매장·상태를 안전하게 조회한다.
- 점주 앱과 어드민 웹이 권한·배포 단위로 분리돼 있다.
- 식재료·메뉴·설정의 변경 전후가 복구 가능한 형태로 보존된다.
- 복구 전 diff와 영향 범위를 확인할 수 있다.
- 복구는 새 revision·정정 판본·반대 이벤트로만 수행된다.
- 현재 재고와 과거 판본을 직접 덮어쓰는 경로가 없다.
- 관리자 작업의 사유·티켓·전후 revision·결과가 남는다.
- 개별 푸시는 동의·멱등·receipt·무효 토큰 처리를 갖춘다.
- 도메인별 경합·실사 컷오프·재시도 시험이 통과한다.
- 전체 `corepack pnpm verify`의 실제 범위와 advisory 실패를 구분해 보고한다.
- 운영 적용은 정확한 SHA와 별도 사람 승인을 거친다.

## 20. 최종 제품 결정

어드민의 데이터 복구는 백업 파일을 과거 값으로 덮어쓰는 기능이 아니다. 이미 보존된 원장·판본과
마스터 변경 이력을 읽어 **현재 시점에 유효한 새 정정 사건을 만드는 기능**이다.

비용을 줄이는 방법은 보관본을 하루치 한 개로 줄이는 것이 아니라, 이미 불변으로 보존되는 데이터를
다시 복사하지 않고 변경 가능한 데이터만 의미 단위로 기록하는 것이다. 이 구조가 저장 비용, 개발 비용,
CS 조사 시간과 데이터 정합성을 함께 줄인다.
