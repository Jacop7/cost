# 화면 진입 복구 중간 검증 — 2026-09-11

## 범위와 환경

- 사용자의 우선순위: 화면이 열리지 않는 부분만 먼저 복구·검증하고 최소 범위로 운영 배포. 나머지 개발은 별도 지속.
- 기준 HEAD: c015c56. 실제 Expo Metro 8094와 AppMap proxy 8091. 샘플이 아닌 실제 로컬 데이터.
- 이번 조회 검사에서는 저장·취소·삭제를 실행하지 않았다. 원장과 기존 재고는 변경하지 않았다.
- 운영 환경 재현이나 전체 기능 인증이 아니다. 팝업 123개 전체 검사는 아직 아니다.

## 직접 진입한 페이지

| 영역 | 확인한 화면 | 결과 |
|---|---|---|
| 식재료 | 메인, 추가, 상세, 수정 메뉴, 재고 내역, 구매 이력, 수정 내역, 식재료 수정 직접 경로 | 데이터 표시 확인 |
| 레시피 | 메인, 상세, 추가, 재료 검색, 부자재 검색/관리, 레시피/부자재 카테고리, 수정 내역, 손익 변동, 고정 지출/수정 | 데이터 또는 정상 빈 상태 표시 확인 |
| 레시피 수정 | 기존 제육볶음 수정 | edit_revision 등 서버 쓰기 계약 누락으로 차단. 차단 유지 필요 |
| 판매가 시뮬레이션 | 기존 제육볶음 | 읽기 화면에 수정 판본 요구 → 수정 후 입력 표시. 계산 RPC 누락은 미해결 |
| 매출관리 | 메인, 분석, 일 손익, 손익 전체 자세히, 매출 상세, 채널별 손익, 재료 원가, 부자재, 폐기 손실, 고정/추가 지출, 세금, 재고 확인, 과거 판매 수정 | 표시 확인 |
| 메뉴 손익 | 제육볶음, 당일 판매 없음 | 수정 전 판본 오류. readOnly 적용 후 실제 화면 표시 확인 |
| 발주 | 메인, 상세, 입고 상세, 직접 발주 | 표시 확인 |
| MY | 메인, 고정 지출/수정, 카테고리, 식재료/레시피/부자재 카테고리, 부자재 관리, 세금, 언어·통화, 단위, 구매처, 판매 채널, 영업시간, 알림, 계정 | 표시 확인 |

식재료 add-stock 직접 경로에는 이전 미확인 입고 요청 복구 안내가 표시된다. 이번 검사에서 해당 요청 재시도는 실행하지 않았다. 이 상태를 정상 신규 입고 폼 검사 완료로 계산하지 않는다.

## 수정 및 시험

- RecipePriceSimulationScreen의 legacy/international 조회를 readOnly로 지정.
- SalesMenuDetailScreen 조회를 readOnly로 지정. 기존 장부 계산 소스는 변경하지 않음.
- 쓰기 화면 RecipeAddScreen의 필수 판본 검사는 유지.
- 회귀시험: 읽기 화면은 edit_revision/category_id/material_id/qty 누락을 허용하되 금액 정보 오류와 쓰기 계약 검사는 유지.
- 3개 테스트 파일 22/22 PASS: recipeEditContractUi, recipePriceSimulationScreen, recipeSimulationParity.
- mobile typecheck PASS.
- Fable 독립검수 및 전체 verify는 이번 변경 SHA 대상으로 아직 미완료.

## 남은 실제 장애와 배포 경계

- 로컬 migration 조회 최신: 20260911000201.
- 20260911000202 international_tax_current_context, 203 recipe_price_simulation, 204 recipe_write_contract는 로컬에 미적용.
- simulation은 `public.recipe_price_simulation(p_price,p_recipe,p_store)` schema cache missing을 실제로 표시함. 입력 표시만으로 기능 복구 완료가 아님.
- origin/main에는 RecipePriceSimulationScreen.tsx 자체가 없음. 이번 변경만 main으로 옮기는 단순 cherry-pick으로 시뮬레이션을 배포할 수 없음.
- 현재 브랜치 전체를 핫픽스로 간주하거나 보호 게이트를 우회하지 않았다. 운영 배포 미실행.
- 후속: 남은 직접 라우트 로딩 완료 확인, 최소 소스/DB 의존 범위 산출, 동일 SHA 전체 게이트·독립검수, 승인된 main에서 대상별 배포 가드 실행.
