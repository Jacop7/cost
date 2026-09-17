# 단가 표시명 적용 — 2026-09-16

사용자 결정: 입고 단가 / 단가 두 가지 표시명.

- 재료 상세·관리·재고·구매 내역·메뉴 재료 선택·발주 표시명 적용. 기존 구형 Material 화면의 정적 표시도 맞췄다. 매출관리 전환 파일은 제외했다.
- 입고 확인은 서버 inboundUnitPrice를 입고 단가로, basePriceBefore → basePriceAfter를 단가로 표시한다. 같은 useUnitPriceFormat과 MY 자릿수를 사용하며 계산을 다시 하지 않는다. 로딩/실패/수치 없음도 기존 경계를 유지한다.
- 상세의 실입고 기준 설명과 purchase.avg 요약을 제거했다. 현재 적용 단가, 최저/최고, 최근 입고는 유지한다. 서버 purchase.avg 공식 문제 자체를 수정한 것으로 간주하지 않는다.
- 이력은 unit_price/base_price/material.cost 의미 키의 알려진 시스템 라벨·요약만 표시 매핑한다. 원장·사용자 이름·메모·전후값은 보존한다.
- 취소 안내는 해당 입고를 제외해 재고와 단가를 다시 계산한다고 표현했다. 원장 반전 RPC·권한·무효화 변경 없음.
- 현재 프로토타입·current-spec·AppMap 팝업 마커·캡처 마커를 동기화했다. 역사 문서와 migration은 보존한다.

검증: 모바일 타입 검사 통과. 관련 11파일 중 최초 실행 9파일 118시험 통과, 변경 기대값을 수정한 2파일 재실행 51시험 통과(합계 169개 고유 시험). 실제 AppMap 재료 상세와 발주 입고 확인에서 단가/입고 단가 및 전후 화살표를 확인했다. 저장하지 않았다.

로그: .codex/order-candidate-style-20260916/two-unit-price-labels-tests.log, two-unit-price-retest.log, two-unit-price-typecheck.log. 전체 verify·DB 전체 회귀·독립검수 완료는 아니다. 앞선 Fable 제공자 한도 제한을 독립검수 통과로 바꾸지 않는다.

이번 변경의 주 파일: ingredients의 BasePriceCard, StockChangeOverview, StockRevertAction, IngredientDetail/Manage, PurchaseHistory, QuickInbound, StockChange; orders의 OrdersHome/OrderComplete; recipes의 재료 선택/구형 Material 표시; changes/hooks·configurationHistory; lib/productTerms. 관련 시험과 현재 프로토타입 문서/탐색 마커를 함께 조정했다.
