# 변경 이력 작업 종류 검수 — 2026-09-14

## 대상과 현재 판정

등록·삭제까지 모두 ‘직접 수정’으로 표시한다는 사용자 제보를 서버 기록, 공개 조회,
최근 변경, 목록 건수, 상세 전후값까지 대조했다. FN-ING-018/019, FN-RCP-015,
FN-MY-034/035와 해당 이력을 생성하는 등록·편집·삭제·자동 전파가 대상이다.

현재 후보는 관련 앱·DB 검사 및 로컬 적용을 마쳤다. 정식 독립검수와 전체 후보 검증은
미완료이며 모든 이력·출시 검수 완료를 뜻하지 않는다. 실제 사용자 거래를 시험하지 않았다.

## 발견과 보완

| 발견 | 보완 |
| --- | --- |
| 출처가 direct이면 등록·삭제도 수정 배지 | source와 operation을 분리. 직접 사건은 등록/수정/삭제/변경, 다른 출처는 자동 갱신 |
| 최근 변경 응답에서 작업 종류 유실 | 목록 사건과 같은 메타데이터를 최근 변경에도 전달·파싱 |
| 식재료·메뉴 실제 삭제의 사건 누락 | 삭제 트랜잭션 안에서 한 번 append. 반복 삭제는 추가 기록 없음 |
| 구매 옵션 삭제와 부모 삭제 혼동 가능 | operation_subject_type/id로 실제 옵션을 식별. 메뉴 재료 제거는 메뉴 수정 |
| 설정의 source를 자동 전파 출처와 혼동 | 설정 source는 설정 종류로 유지하고 source_type=direct 명시 |
| 식별자 없는 배열을 위치·이름으로 짝지어 가짜 금액 변경 | 고유 key가 있을 때만 항목 대조. 없는 배열은 원본 전후 구성을 표시하고 단순 순서 변경을 구분 |
| 같은 이름·다른 key의 재정렬이 화면에서 구분되지 않음 | 이름이 충돌하는 순서 표시에는 원래 key를 함께 표시 |
| 전후 변경이 없는 설정 사건을 적용 시점 변경으로 단정 | 구조화된 변경 근거가 없으면 중립 안내 |

한 사건 안의 사용자 입력과 파생 계산은 ‘입력 변경/계산 결과’로 구분한다.
`direct_count`는 등록·수정·삭제를 포함한 직접 변경 사건 수다. 파생 행을 별도 자동 사건으로
중복 집계하지 않는다. 하나의 설정 저장이 두 종류의 원장 사건을 만드는 기존 계약은 유지한다.

## 과거 기록과 권한

- 00011은 기존 두 이력 표에 nullable 메타데이터 열을 추가하며 과거 행 UPDATE나 backfill을 하지 않는다.
- 직접 사건의 단일 created 필드 null→값, 통합 전 같은 부자재 ID의 active true→false만 구조적 근거로 읽는다. 제목·번역·현재 상태는 분류 근거가 아니다.
- 나머지 과거 작업 종류는 unknown이다. 직접 또는 출처 미상 사건은 ‘변경’으로 표시하며 출처를 임의로 direct로 채우지 않는다.
- 새 세금 프로필의 before=null만으로 최초 등록이라고 판단하지 않는다. 월 고정 지출의 첫 저장은 해당 월을 대상으로 기록한다.
- 기존 조회 기간·20건 커서·합계·영업 적용 상태·원본 시각·ID·전후값을 유지한다. 통합 전 최근 사건은 같은 필터에서 가장 최근 행을 선택해 원본 대상을 전달한다.
- 새 내부 helper는 public/anon/authenticated/service_role의 직접 실행을 허용하지 않는다. 공개 writer/reader의 실행 역할은 기존 costkeep_rpc_executor이고 제한된 설정 기록 함수는 기존 definer를 유지한다.
- 과거 record_entity_change에 남아 있던 service_role 직접 실행 권한은 새 helper 실행 권한을 부여하지 않는다. 저장소에서 해당 내부 직접 호출 사용은 발견되지 않았다. 운영 health 호출은 ops_health_status만 사용한다. 외부의 문서화되지 않은 내부 함수 호출까지 검증한 것은 아니다.

## 실행과 판본

근거 경로는 `.codex/full-function-audit-20260914/` 아래다.

| 실행 | 결과·파일 |
| --- | --- |
| 서버 수정 전 | 신규 종류 기대값이 null로 반환되어 실패. history-before.log, history-before-input.json |
| 서버 수정 후 | history-after.log: 31개 assertion 통과. 생성·수정·삭제·반복 요청·입고와 연계 메뉴 자동 전파·과거 보존·타 매장·원장 쓰기 및 내부 helper 차단 |
| DB 전체 회귀 | db-all-after-history.log: 105/106 통과. 1실패는 마지막 통합 전 사건 선택 방식이 바뀐 뒤 옛 SQL 문자열을 요구한 누적 검사 |
| 누적 계약 보완 | 최신 행 선택·시각 대입·메타데이터 투영 각 1회로 검사 갱신. history-cumulative-after.log 1/1 통과. 이를 단일 실행 106/106으로 쓰지 않음 |
| 앱 수정 전 | change-classification-before.log 6실패. 제로 변경 UI와 동명 항목 순서 반례는 change-classification-ui-before.log 및 change-classification-duplicate-name-before.log |
| 앱 수정 후 | change-classification-after-v2.log: 11파일 207시험 통과. 이후 동명 key 순서 수정의 영향 2파일35시험은 change-classification-after-final.log 통과 |
| 앱 최종 입력 | change-classification-final-inputs.json의 13개 파일 SHA256. manifest SHA256: 14205762a8fefbe0340dd0fdb3c889ad45018df1f85f61ccfacd387144b88cbe |
| 로컬 적용 | history-local-plan.log에서 미적용 00011만 확인, history-local-migrate.log에서 CLI 2.116.0 migration up --local 성공 |
| 생성 타입·타입 검사 | history-db-types.log 공식 생성 완료. history-stock-typecheck.log mobile 타입 통과 |

SQL11 SHA256은 `6546e90c33fc3a8f2d3a6d321cbdc049a53785f26cc8e02af1e01ca46a011ceb`,
최종 99_change_history_operations.sql은 `b628b196fdc522db177fe1cba68f54e80888f7609367ba705d3209c12a8197d3`이다.
수정 전 시험 이후 fixture의 서버 시각과 자동 전파·권한 항목이 추가됐으므로 수정 전후 시험 SHA가 같다고 주장하지 않는다.

격리 시험은 네트워크·공개 포트 없는 합성 DB에서 실행했다. 실제 로컬 앱 DB에는 스키마·함수만 적용했다.
독립 코드 대조에서는 기존 재무·페이지네이션·적용 상태 계산이 유지됨을 확인했으나 Fable 검수를 대신하지 않는다.
정식 Fable `CHANGE-HISTORY-KINDS-20260914` r1은 실제 결제 하드캡 확인 불가로 외부 호출 전에 중단됐다(`PROVIDER_HARD_CAP_UNAVAILABLE`, exit 64). `history-fable.log`와 원본 공동 장부를 보존하며 이번 후보의 정식 PASS는 없다.
전체 verify는 이번 변경 전에 시작한 실행이어서 현재 후보로 승계하지 않는다.
