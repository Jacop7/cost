# 발주 입고·반복 취소 검수 — 2026-09-14

## 대상과 판정

기능정의서의 발주 입고 확정·입고 취소와 직접 입고의 공통 E1 연결을 검수했다.
아래 세 오류를 수정했으며 현재 판정은 **격리 DB·앱 시험 통과, 통합 및 정식 독립검수 진행 중**이다.
기능 전체·배포·출시 완료 판정이 아니다. 사용자 거래를 재현 입력으로 사용하지 않았다.

| 발견 사항 | 재현 | 수정 |
| --- | --- | --- |
| 동일 발주의 두 번째 입고 취소가 과거 입고까지 다시 차감 | 1,000g 입고→취소→1,000g 재입고→취소에서 기대 1,000g/실제 2,000g 취소 | `00009`가 현재 회차 원본별로 반대 원장을 연결. 과거 무연결 취소 이후의 회차도 구분 |
| 부분 입고 응답 유실 후 재진입·입력 변경이 새 입고를 전송 | 실제 훅 시험에서 이전 결과 확인 대신 E1 재호출 | 사용자·매장·발주별 요청 키만 보관하고 서버 결과 확인. 미반영으로 종료된 키의 지연 E1 차단 |
| 잔여 수량 초과 입력에서 미리보기와 실제 반영량 불일치 | 잔여 3개에 4개가 제출되고 4개 미리보기 노출 | 잔여 초과 입력·미리보기 차단. 다른 기기의 입고로 서버 상한이 달라진 경우 실제 처리량 안내 |

## 변경 범위

- `20260914000009_inbound_reversal_cycles.sql`: E11과 최신 입고 취소 후보의 현재 회차 판단. 원본 입고 행·과거 보정 행을 수정하지 않는다.
- `20260914000010_order_inbound_resolution.sql`: `resolve_order_inbound(uuid,uuid,text)`와 종료 요청 기록, E1의 동일 잠금·요청 범위 검사. 기존 실제 수량 상한·금액 계산·단가 전파 보존.
- 발주 훅·입고 시트·요청 보관 모듈: 결과 확인·최신 발주 조회가 완료돼야 다음 별도 입고 허용. 과거 요청이 `recorded`여도 현재 재고에 그대로 남아 있다는 의미로 표시하지 않는다.
- 공개 RPC ACL 시험은 89개 명세와 새 resolver의 소유자·권한·종료 기록 직접 접근 차단을 검사한다.

## 실행 증거

모든 경로는 권위 작업 루트 기준이다. 실행 입력 SHA는 `.codex/full-function-audit-20260914/order-inbound-app-inputs.json`과 각 실행의 입력 기록을 참조한다.

| 실행 | 결과·근거 |
| --- | --- |
| 수정 전 E11 회귀 | FAIL 기대 1,000/실제 2,000. `.codex/full-function-audit-20260914/reversal-before.log`, `reversal-before-input.json` |
| 수정 전 앱 회귀 | 2실패/26통과. 하위 작업 도구 출력에 보존. 당시 소스 SHA를 미리 캡처하지 못했으므로 과거 판본을 추정해 봉인하지 않음 |
| 수정 후 앱 회귀 | 49/49 PASS. `order-inbound-app-tests.log`, 실행 전 `order-inbound-app-inputs.json` |
| 새 DB 기반 전진 적용 | 공식 `fresh-db.sh --until 20260914000008` 완료 후 00009·00010 순서 적용. `fresh-isolated-baseline.log`, `reversal-migration.log`, `order-resolution-migration.log` |
| E11 추가 회귀 | PASS. 3회 반복·여러 부분 입고·기존 무연결 취소·재고 내역 진입·영업 4상태·판매 후 음수·원장/스냅샷 보존. `reversal-after.log` |
| 입고 resolver·ACL | PASS. 미반영 종료·지연 E1 거부·다른 발주/매장 격리·반복 확인·현재 재고/원장 불변. `order-resolution-db.log`, `order-resolution-acl.log` |
| DB 전체 회귀 | 105/105 파일 PASS. `db-all-after-inbound.log` |
| 입고/취소 경합 | 3/3 PASS. 실제 잠금 대기 후 E11→E1, E1→E11, E11→E11의 최종 수량과 원본별 반전 연결 검사. `reversal-concurrency-after.log` |
| 입고/결과 확인 경합 | 4/4 PASS. E1 선행, resolver 선행, 동일 요청, 별도 요청의 잠금·원장·잔여 상한. `order-resolution-concurrency.log` |
| 로컬 앱 DB·생성 타입 | 미적용 migration이 00009·00010 두 개임을 검사한 뒤 고정 CLI 2.116.0의 `migration up --local`로 적용. `local-migration-plan.log`, `local-inbound-migrate.log`. `pnpm db:types` 생성 및 mobile 타입 PASS(`db-types.log`, `inbound-typecheck.log`) |

검사용 Docker 컨테이너 `costkeep-function-audit-20260914`는 외부 네트워크·공개 포트 없이 합성 seed만 사용한다. 검사용으로 실제 로컬 DB에서 읽은 것은 인증 표의 컬럼 모양과 함수 정의다. 검증 후 실제 로컬 앱 DB에는 위 두 migration의 스키마·함수 변경만 적용했으며 사용자 입고·취소 거래를 실행하지 않았다. 최초 공유 클러스터의 fresh 준비는 기존 upgrade 검사와 전역 역할이 겹칠 수 있어 중단했고 독립 클러스터로 전환했다. 실패를 통과로 치환하지 않는다.

경합 시험 최초 실패는 fixture가 내부 날짜 함수를 앱 권한으로 호출한 `42501`이었다. 날짜 준비만 fixture 조회로 분리하고 실제 E7·E1·E11의 authenticated 경계는 유지했다. `reversal-concurrency.log`를 원본으로 보존한다.

## 남은 경계

- 기존 버그로 이미 틀어진 재고는 자동 보정하지 않았다. 과거 원장과 실제 상태의 별도 대조가 필요하다.
- E11은 발주 ID만 받으므로 재입고 뒤 도착한 과거 취소 재시도를 식별하는 계약은 아직 없다. 이번 회차 수량 수정으로 이 문제까지 해결했다고 표시하지 않는다.
- 네이티브 저장소는 모의 시험이며 실제 기기 증빙이 아니다.
- 내부 교차검토에서 추가 근거가 있는 P0/P1/P2 반례는 확인되지 않았다. 실제 Web Locks 경로·저장소 읽기/삭제 실패·지연 중 세션 전환의 통합 실행 증거는 별도 미수집이다. Web Locks가 없는 브라우저의 여러 탭은 탭 간 직렬화를 보장하지 않는다.
- 정식 Fable `INBOUND-FUNCTION-AUDIT-20260914` r1은 `PROVIDER_HARD_CAP_UNAVAILABLE`로 모델 호출 전 중단됐다(exit 64). `inbound-fable.log`와 해당 task의 원본 장부를 보존한다. 내부 교차검토나 Claude 웹 의견으로 정식 검수를 대체하지 않는다.
- 전체 필수 verify는 별도 미완료다. 앞선 전체 verify는 이번 수정 전 시작한 실행이므로 현재 후보의 일괄 통과로 승계하지 않는다.
