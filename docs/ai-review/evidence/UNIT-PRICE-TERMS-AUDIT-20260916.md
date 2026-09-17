# 단가 명칭 전수 검수 — 2026-09-16

요청: `기준 단가`를 `단가`로 줄여도 되는지 전수 조사. 제품 문구·계산·DB·매출관리 전환 소스는 변경하지 않았다. 이 문서는 검수 결과이며 새 제품 계약이나 변경 승인으로 취급하지 않는다.

## 결론

일반 재료 화면의 기본 표시명은 `단가`가 적절하다. 다만 비교 문맥은 `현재 단가`, `입고 후 단가`, `이번 입고 단가`, `평균 입고 단가`로 출처·시점을 구분해야 한다. 모든 값을 평균으로 명명하거나 원장 문자열까지 일괄 치환하지 않는다. 아래 F1/F2 때문에 제목 치환만으로 의미 검수가 끝나지 않는다.

## 범위와 방법

- `apps/mobile/src`, `app`, `tests`, `packages/core`, DB migration·tests, `scripts`, `docs`, 루트 AGENTS/ARCHITECTURE/README의 텍스트 소스를 검색했다. 공백 유무를 포함한 `기준\s*단가`, 관련 평균·구매·입고 단가를 대조했다.
- 캐시·node_modules·빌드 산출물, 과거 바이너리 Word/PDF 내부는 조사 수치에 포함하지 않는다. 과거 문서는 검색 집계에 포함했지만 현재 명칭의 권위로 사용하지 않았다.
- 모바일 TS AST에서 주석을 제외한 문자열/JSX/템플릿을 추출: **16파일 22개 리터럴 위치**. 화면 개수나 사용자 노출 총횟수가 아니다. 서버에서 전달되는 이력 문구는 별도 조사했다.
- 그중 구형 Material* 3파일/3위치에는 현재 app 라우트·외부 import 참조가 검색되지 않았다. 삭제하거나 활성 화면으로 단정하지 않는다. 매출 도메인 1파일/2위치는 읽기 전용 검수다. 나머지는 12파일/17위치다.
- 실행 중인 로컬 DB의 `pg_get_functiondef`를 읽어 `base_unit_price`, `current_ingredient_unit_price`, `ingredient_detail`, `ingredient_list_v2`, `quick_inbound_preview`, `order_board`, `day_unit_price`를 대조했다. 운영 DB를 조회하거나 변경하지 않았다.
- 로그/목록: `.codex/order-candidate-style-20260916/unit-price-audit-inventory.json`, `unit-price-runtime.sql`, `unit-price-audit-tests.log`. 이번 전수 검수는 정적 코드·로컬 함수 정의·단위 검증이며 모든 화면의 기기 실측 완료를 뜻하지 않는다.

## 발견 사항

### F1 · P2 — 현재 적용 단가를 ‘실입고 기준’이라고 표시

`BasePriceCard.tsx:46`은 `basePrice` 위에 `실입고 기준`을 표시한다. 부모 `IngredientDetailScreen.tsx:197`은 `g.basePrice`를 전달한다. 로컬 `ingredient_detail`의 `base_price`는 `current_ingredient_unit_price(i.id)`이며, 이 함수는 `menu_unit_price_override`가 있으면 실제 입고 평균보다 우선한다. 근거: `20260912000214_current_ingredient_cost.sql:6`, ARCHITECTURE §5.

따라서 직접 수정값이 남아 있는 경우 `실입고 기준` 설명은 정확하지 않다. 권고: 기본 제목은 `단가`, 설명은 `현재 적용 단가`로 하거나 서버가 출처를 내려줄 때만 실제 출처를 표시한다. 입고 평균으로 단정하지 않는다.

### F2 · P2 — 상세 ‘가중평균’이 입고량 가중 공식과 다름

`BasePriceCard.tsx:52`의 `가중평균` 값은 `purchase.avg`다. 실행 중인 `ingredient_detail`은 `Σ((amount / volume) × received_qty) / Σ(received_qty)`를 반환한다. 실제 입고 기준 공식 `base_unit_price`는 `Σ(amount × received_qty) / Σ(volume × received_qty)`다.

서로 다른 용량의 예: 1kg 5,300원 1팩 + 20kg 80,000원 1팩. 읽기 전용 VALUES 검산 결과 상세 purchase.avg는 **4.6500원/g**, 입고량 가중평균은 **4.0619원/g**이다. 근거: 실행 DB 함수, `20260820000072_volume_weighted_price.sql`, `packages/db/tests/14_volume_weighted.sql`.

`평균 입고 단가`라고 이름만 바꾸기 전에 서버의 해당 요약값을 입고량 기준으로 맞출지 결정·수정·DB 회귀검증이 필요하다. 기존 평균 원장 계산 자체가 틀렸다는 판정은 아니며, 문제 범위는 상세 purchase.avg 요약이다. 이번 검수에서 SQL은 수정하지 않았다.

### F3 · P2 — ‘입고 전으로 되돌아가요’는 취소 효과를 과하게 단순화

`OrdersHomeScreen.tsx:505`의 취소 안내는 단가와 재고가 입고 전으로 돌아간다고 표현한다. E11은 대상 발주의 현재 입고 회차만 반전하며, 이후 다른 거래와 남은 입고는 유지된다. 과거 상태 전체 복원이 아니다.

권고 문구: `해당 입고를 제외해 재고와 단가를 다시 계산해요.` 단순히 기준이라는 두 글자만 제거하면 이 의미 문제는 남는다. 근거: ARCHITECTURE §4 및 `20260914000009_inbound_reversal_cycles.sql`.

### F4 · 연동 주의 — 이력·AppMap·검증 마커

- 변경 이력의 `unit_price`/`base_price` 및 구형 `material.cost`는 서버/저장 문자열을 노출한다. `changes/hooks.ts:76`과 `productTerms.ts`에는 최소재고 등 표시 매핑만 있으며 단가 매핑은 없다. UI 파일만 바꾸면 과거 이력에는 이전 명칭이 남는다.
- 변경 시 의미 키와 알려진 시스템 문구만 표시 단계에서 매핑해야 한다. 사용자 이름·메모·전후값, 원장 원문, 이미 적용된 migration은 보존한다. `입고 단가 반영` 이벤트 제목을 비교하는 `ChangeHistoryScreen.tsx:141`도 유지해야 한다.
- `scripts/appmap/navigation.mjs:59`는 `재고와 기준단가가` 문자열로 취소 팝업을 확인한다. 문구 변경과 함께 마커를 맞춰야 한다.
- 3표면 캡처 스크립트 2개, AppMap samples, 현재 프로토타입의 화면·용어사전, current-spec, features README와 생성 registry도 영향 대상이다. 생성 파일은 생성 경로를 통해 동기화하고 과거 검수 자료를 일괄 수정하지 않는다.

## 권장 표시 계약

| 문맥 | 권고 |
|---|---|
| 재료 상세·관리·메뉴 재료 선택·재고 요약 | 단가 |
| 현재 값과 입고 결과를 비교 | 현재 단가 / 입고 후 단가 |
| 해당 입고 한 건의 가격 | 이번 입고 단가 유지 |
| 입고 전체의 양 가중평균 | 평균 입고 단가 — F2 해소 후 적용 |
| 구매 링크 옵션 | 구매 단가 또는 단위 포함 수치 유지 |
| 매출의 과거 값 | 판매 당시 단가 등 시점 구분; 매출 담당 범위 |
| 산출되지 않은 값 | 단가 산출 전 / 단가 없음; 실제 0원과 구분 |
| 의미 식별자·계산 함수·원장 원문 | 변경하지 않음 |

## 모바일 리터럴 전수 목록

아래는 검색 시점 줄 번호다. 구형 화면과 매출도 누락 없이 포함했다. 실제 변경은 사용 경로·데이터 의미별로 적용해야 한다.

| 파일:줄 | 현재 문구 | 판정 |
|---|---|---|
| [SalesMaterialScreen.tsx:157](../../../apps/mobile/src/features/sales/screens/SalesMaterialScreen.tsx) | 기준단가 산출 전 | 과거 시점 구분 필요 · 읽기 전용 |
| [SalesMaterialScreen.tsx:157](../../../apps/mobile/src/features/sales/screens/SalesMaterialScreen.tsx) | 기준단가 | 과거 시점 구분 필요 · 읽기 전용 |
| [configurationHistory.ts:84](../../../apps/mobile/src/features/changes/configurationHistory.ts) | 기준 단가 | 시스템 표시명만 단가 |
| [IngredientDetailScreen.tsx:163](../../../apps/mobile/src/features/ingredients/screens/IngredientDetailScreen.tsx) | 기준 단가 | 기준 단가 → 단가 가능 |
| [IngredientManageScreen.tsx:67](../../../apps/mobile/src/features/ingredients/screens/IngredientManageScreen.tsx) | 기준 단가 | 기준 단가 → 단가 가능 |
| [PurchaseHistoryScreen.tsx:96](../../../apps/mobile/src/features/ingredients/screens/PurchaseHistoryScreen.tsx) | 기준단가 | 기준 단가 → 단가 가능 |
| [StockChangeScreen.tsx:256](../../../apps/mobile/src/features/ingredients/screens/StockChangeScreen.tsx) | 기준단가 없음 | 단가 없음 · 0원 변환 금지 |
| [RecipeIngredientSearchScreen.tsx:124](../../../apps/mobile/src/features/recipes/screens/RecipeIngredientSearchScreen.tsx) | 기준 단가 | 기준 단가 → 단가 가능 |
| [QuickInboundScreen.tsx:353](../../../apps/mobile/src/features/ingredients/screens/QuickInboundScreen.tsx) | 기준단가 | 기준 단가 → 단가 가능 |
| [QuickInboundScreen.tsx:490](../../../apps/mobile/src/features/ingredients/screens/QuickInboundScreen.tsx) | 입고 후 기준단가 | 입고 후 단가 |
| [QuickInboundScreen.tsx:517](../../../apps/mobile/src/features/ingredients/screens/QuickInboundScreen.tsx) | 기준단가 | 비교 행 현재 단가 또는 단가 |
| [QuickInboundScreen.tsx:529](../../../apps/mobile/src/features/ingredients/screens/QuickInboundScreen.tsx) | 입고를 완료하면 재고와 구매 내역이 추가되고, 기준 단가와 | 기준 단가 → 단가 가능 |
| [MaterialSearchScreen.tsx:92](../../../apps/mobile/src/features/recipes/screens/MaterialSearchScreen.tsx) | 기준 단가 | 구형 화면 · 현행 연결 확인 후 단가 |
| [MaterialManageScreen.tsx:76](../../../apps/mobile/src/features/recipes/screens/MaterialManageScreen.tsx) | 기준 단가 | 구형 화면 · 현행 연결 확인 후 단가 |
| [StockRevertAction.tsx:34](../../../apps/mobile/src/features/ingredients/components/StockRevertAction.tsx) | 재고와 기준 단가가 다시 계산됩니다. | 기준 단가 → 단가 가능 |
| [MaterialDetailScreen.tsx:41](../../../apps/mobile/src/features/recipes/screens/MaterialDetailScreen.tsx) | 기준 단가 | 구형 화면 · 현행 연결 확인 후 단가 |
| [StockChangeOverview.tsx:22](../../../apps/mobile/src/features/ingredients/components/StockChangeOverview.tsx) | 기준단가 | 기준 단가 → 단가 가능 |
| [OrdersHomeScreen.tsx:476](../../../apps/mobile/src/features/orders/screens/OrdersHomeScreen.tsx) | 입고 후 기준단가 | 입고 후 단가 |
| [OrdersHomeScreen.tsx:483](../../../apps/mobile/src/features/orders/screens/OrdersHomeScreen.tsx) | 저장하면 재고와 기준단가가 바뀌고 연결된 메뉴 원가도 다시 계산돼요. | 기준 단가 → 단가 가능 |
| [OrdersHomeScreen.tsx:505](../../../apps/mobile/src/features/orders/screens/OrdersHomeScreen.tsx) | 재고와 기준단가가 입고 전으로 되돌아가요. 이 재료를 쓰는 메뉴 원가도 함께 바뀝니다. | F3 안내 의미 함께 수정 필요 |
| [OrderCompleteScreen.tsx:199](../../../apps/mobile/src/features/orders/screens/OrderCompleteScreen.tsx) | 발주는 기록만 돼요. 재고와 기준단가는 발주 현황에서 | 기준 단가 → 단가 가능 |
| [BasePriceCard.tsx:42](../../../apps/mobile/src/features/ingredients/components/BasePriceCard.tsx) | 기준 단가 | 제목 단가 가능 · F1/F2 우선 |

## 검색 집계

주석·역사 문서까지 포함하는 문자열 발생 수이며 수정 대상 수가 아니다. 보고서 자신을 만들기 전의 집계다.

| 영역 | 파일 | 발생 |
|---|---:|---:|
| other | 3 | 9 |
| docs | 188 | 2807 |
| core | 5 | 10 |
| mobile-tests | 12 | 22 |
| mobile-source | 27 | 66 |
| db-tests | 17 | 34 |
| scripts | 5 | 8 |
| migrations | 36 | 97 |

## 검증 결과·범위

- 기존 모바일 관련 8파일 **125시험 통과**: 상세 미리보기, 반응형 계약, 취소 안내, 설정 이력, 표시 자릿수 전파, 발주 홈, 빠른 입고, 재고 수정.
- 기존 상세 시험은 서버가 준 basePrice와 purchase.avg를 각각 표시하는지 검증한다. F2의 서버 요약 공식 일치까지 검증하지 않으므로 시험 통과로 F1/F2를 해소했다고 보지 않는다.
- 로컬 DB 함수 정의는 읽기 전용으로 확인했고, 서로 다른 용량 평균은 VALUES SELECT로 재현했다. DB 쓰기·migration·계산 변경 없음.
- 제품 소스·테스트·기존 정책 문구 변경 없음. 신규 검수 문서와 로컬 조사 도구·결과만 작성했다.
- 전체 verify, DB 전체 회귀, 전 기기 화면 실측 및 새 독립검수는 실행하지 않았다. 기존 Fable 제공자 한도 문제를 이 검수의 독립 PASS로 간주하지 않는다.

## 재현 시점

동시 작업 중인 로컬 작업본 기준이다. 원격 CI exact SHA 완료 판정이 아니다. 주요 입력 SHA-256:

- `apps/mobile/src/features/ingredients/components/BasePriceCard.tsx`: `1855c827b966b744134f2053061693bac3958b98ad22264172f42d95877559d6`
- `apps/mobile/src/features/ingredients/hooks.ts`: `b32d4f0fa1108064b0b6d50aaee8009de551410eb9321a95a0698b1cbbe54390`
- `apps/mobile/src/features/orders/screens/OrdersHomeScreen.tsx`: `06688b66d57741d366c33e87ab4ede853867ec0f9caae90634209d22e6d44c76`
- `.codex/order-candidate-style-20260916/unit-price-runtime.sql`: `2d2fe45a5fa902ec607f30325333405566770d89d1d37cdfdc8591f284757aa6`
