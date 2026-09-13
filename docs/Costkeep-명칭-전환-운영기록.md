# Costkeep 명칭 전환 운영 기록

- 작업일: 2026-09-13~14
- 사용자 표시명: **코스트킵**
- 영문·코드 네임스페이스: **Costkeep / `costkeep`**
- 범위: 로컬 소스, 패키지, 개발 DB 계약, 로컬 Supabase 스택, AppMap·프로토타입
- 제외: 운영·스테이징 Supabase, EAS 원격 프로젝트, 앱스토어 등록·자격 증명, 배포·커밋·푸시

## 보존 원칙

기존 매장·사용자·재고·원장·손익 데이터의 식별자와 행은 바꾸지 않는다. 이미 적용된 migration,
검수 원본, 배포 영수증, 네이티브 캡처의 옛 명칭도 당시 판본을 증명하므로 수정하지 않는다.
현재 실행 계약은 migration `0240`으로 전진하고, 검증 중 발견한 실행 함수 보안 설정은 후속
migration `0241`로 보강한다. 재료 통합 이후 재고 관리 여부를 숨길 수 있는 구형 목록 facade는
migration `0242`에서 직접 앱 실행 권한을 닫는다.

## 변경 분류

| 영역 | 현재 계약 | 보존 또는 후속 조건 |
|---|---|---|
| 제품 표시 | 코스트킵 | 앱, AppMap, 공식 프로토타입에 적용 |
| 코드 | `@costkeep/*`, `COSTKEEP_*`, `costkeep` | 패키지명·import·헤더·현재 스크립트·문서에 적용 |
| DB | `costkeep_rpc_executor`, `x-costkeep-app-version`, `costkeep.*`, `costkeep-*` Cron | migration `0240`이 role OID/권한과 함수·Cron 동작을 보존해 전환 |
| DB 함수 보안 | 묶음 단위 RPC 3개의 `search_path=public, pg_temp` | migration `0241`이 함수 본문·소유자·권한을 유지하며 검색 경로만 고정 |
| 구형 재료 목록 | `ingredient_list_v2(uuid)`만 앱에 공개 | migration `0242`가 `ingredient_list(uuid)`의 Data API 실행 권한을 회수해 `stock_tracking` 누락을 차단 |
| 로컬 인프라 | Supabase project/container/volume 접미사 `costkeep` | 이전 `margincook` volume은 삭제하지 않고 정지 상태로 보존 |
| 원격 서비스 | 변경 없음 | 별도 승인과 대상 확인 전에는 EAS·Supabase·스토어를 변경하지 않음 |
| 네이티브 앱 ID | `com.jacop7223.costkeep` | 저장소의 Expo `owner=jacop7223`을 소유 근거로 iOS/Android를 함께 변경 |

## 백업과 복구 근거

전환 직전 논리 백업은 `.codex/costkeep-rename-20260913/backup-before-rename/`에 있다.

| 파일 | SHA-256 |
|---|---|
| `postgres.dump` | `E8B34C8FF87D4F9EE70CE311FF80D34EA22E6518C2C502E74362E3DB33B3034B` |
| `globals.sql` | `5E4FC8A355A1A6FDCAD80A84DAD3D8255972432EA9AF02590FAAC0C45F9BD440` |
| `baseline-counts.txt` | `69537FF6200B27973DDE72360C49DD12F2D33410C76A3085668B5C2CD8C33CFA` |

물리 복구는 기존 volume을 복제한 `supabase_db_costkeep`, `supabase_storage_costkeep`,
`supabase_edge_runtime_costkeep`으로 기동해 확인했다. 원본
`supabase_db_margincook`, `supabase_storage_margincook`,
`supabase_edge_runtime_margincook`도 삭제하지 않았다. PostgreSQL image/version은 기존 데이터와 같은
`15.8.1.085`를 사용했다.

논리 dump의 같은 인스턴스 복원 연습은 Supabase의 `pg_cron` 확장이 `postgres` DB에만 설치될 수
있다는 제약에서 중단됐다. 따라서 논리 dump 파일과 해시는 복구 자산으로 보존하지만, 이 연습을
성공으로 기록하지 않는다. 실제 전환 판단은 복제 volume의 정상 기동과 전후 행 수 일치에 근거한다.

## 데이터 검산

| 테이블 | 전환 전 | 전환 후 |
|---|---:|---:|
| `auth.users` | 5 | 5 |
| `public.stores` | 5 | 5 |
| `public.ingredients` | 38 | 38 |
| `public.recipes` | 15 | 15 |
| `public.inventory_events` | 869 | 869 |
| `public.profit_trends` | 264 | 264 |
| `storage.objects` | 0 | 0 |

로컬 시드 사용자는 UUID와 소유 관계를 유지한 채 이메일만 `demo@costkeep.local`로 바꿨다.
`inventory_events`를 비롯한 append-only 원장은 수정하거나 재작성하지 않았다.

## 검증 기록

- `corepack pnpm -r typecheck`: 통과
- core 시험: 269개 통과, 13개 건너뜀
- mobile 시험: 1,429개 통과, 4개 건너뜀
- DB 브랜드 계약 시험 35: 1/1 파일 통과
- DB 최신 회귀 필터 99: 3/3 파일 통과
- 0236 재료 통합 이전 계약과 0239→0240 fresh DB 전진 사전검증: 통과
- 전체 업그레이드 경로: 25/25 시나리오 통과. 현재 seed를 쓰는 fresh DB에서도 실제 0239 설치의
  `demo@margincook.local` 상태를 명시적으로 재현한 뒤 0240 이메일 전환을 검증함
- 전체 검증의 ACL 감사에서 묶음 단위 RPC 3개의 `search_path=public`을 발견했다. migration
  `20260914000001_bundle_unit_search_path_hardening.sql`로 `public, pg_temp`를 고정한 뒤 현재 DB의
  ACL 지표(`rpc_executor_facades_invalid`, `facade_rpc_missing`,
  `unapproved_authenticated_rpc`)가 모두 0이고, ACL 셸 시험과 소스 스캔 13/13이 통과함
- 0240 fresh DB에 0241을 전진 적용한 집중 사전검증과 DB 필터 99: 3/3 파일 통과
- migration `20260914000002_retire_legacy_ingredient_list_facade.sql` 적용 후 앱 RPC 허용 목록은
  85개, 실제 모바일 호출은 83개, 비-mobile 예외는 2개이며 미승인 RPC는 0개. DB 필터 34와 99,
  ACL 셸·소스 스캔 13/13 통과
- 재료 통합 뒤 `stock_tracking=false` 원가 전용 재료를 경합 시험의 예상 재고 소진량에서도
  제외하도록 시험 기준을 생산 함수와 맞췄다. 격리 DB `fresh_costkeep_final`에서 평시·마감 경합
  전 항목이 통과했고 시험 DB 삭제까지 확인함
- `corepack pnpm verify`의 최신 전체 실행에서 ⑤ 업그레이드 경로 25/25와 ⑥ 웹 번들이 통과했다.
  이 실행에는 migration 0240·0241·0242가 모두 포함됨
- 최종 `corepack pnpm verify --no-db`: ① 타입, ② core 269개·mobile 1,429개,
  ⑥ 웹 번들 통과. 현재 터치 래칫과 네이티브 현재 계약도 통과
- 작성자 이메일 정정으로 재작성된 결정 커밋 5쌍은 제목과 tree SHA의 동일성과 새 SHA의 HEAD 조상
  여부를 확인했다. 현재 색상·S3d 봉인은 `docs/Git-이력재작성-SHA-대응표-20260914.md`의 새 SHA를
  참조하며 이전 커밋과 검수 영수증은 수정하지 않음
- AppMap 실제 데이터 화면: 코스트킵 제목, Expo 연결, `RCP-02b` 실제 수정 이력 확인

최신 전체 `corepack pnpm verify`는 ① 타입, ⑤ 업그레이드 25/25, ⑥ 웹 번들이 통과했고, ④의 fresh DB
전체 migration과 SQL 97/97도 통과했다. 실행 도중 발견한 ② DB 허용 목록 기대값과 ④ 경합 시험의
원가 전용 재료 기대값은 위 후속 검사에서 각각 통과했다. 최종 `verify --no-db`에서도 타입·core·mobile·
웹 번들, 현재 터치 래칫, 네이티브 현재 계약이 통과했다.

필수 ③의 Git 이력 재작성 참조는 동일 tree 대응표로 복구했다. 현재 남은 필수 항목은 3표면 선언·
생성물·문서 변경의 커밋 경계와 새 바이트 영수증이다. 네이티브 기기 캡처·영수증·글자 확대 증빙
4건도 advisory 실패로 보존한다. 따라서 새 커밋 경계 재검증 전에는 전체 필수 게이트나 현재 판본의
접근성 기기 검수가 완료됐다고 기록하지 않는다.

Fable 독립 검수용 `COSTKEEP-RENAME-20260913` 읽기 전용 패킷을 만들고 1회 실행했다. 실행기는
Claude Code의 `--max-budget-usd`가 실제 결제 하드캡으로 검증되지 않는다는
`PROVIDER_HARD_CAP_UNAVAILABLE` 판정으로 외부 호출 전에 중단했다. 검수 결과가 생성되지 않았으므로
독립 검수 완료로 기록하지 않는다.

## 배포 전 후속 조건

새 `scheme`은 `costkeep`이고 iOS `bundleIdentifier`와 Android `package`는 저장소의 Expo 소유자
`jacop7223`을 근거로 `com.jacop7223.costkeep`을 사용한다. 이 값을 실제 기기에 반영하려면 새 개발
빌드가 필요하다. EAS 프로젝트 연결, 인증서·프로비저닝, 외부 OAuth/deep-link 등록은 새 값으로
점검해야 한다. 이 기록은 그 원격 변경을 승인하지 않는다.
