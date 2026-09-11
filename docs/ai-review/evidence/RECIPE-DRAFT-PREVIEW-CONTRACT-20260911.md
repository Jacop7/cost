# 레시피 추가·수정 하단 손익 복구 계약

상태: 구현 중. 입력 정규화 및 회귀시험 완료, 서버 견적·화면 연결·DB 검수·운영 배포 미완료.

## 원인

RecipeAddScreen의 국제 세금 분기는 ‘준비 중’ 안내만 렌더링한다. 0203의 recipe_price_simulation은 저장된 recipe_id와 판매가만 받으므로 작성 중 재료·부자재·인분 변경을 계산하지 못한다. 기존 함수에 저장된 메뉴 ID만 연결하는 것은 수정 초안을 무시하는 결함이다.

## 읽기 전용 입력

draftPreviewInput.ts는 recipe_id(신규 null), price, base_servings, target_profit_rate, lines(ingredient_id/input_qty), extras(material_id/qty/amount)만 투영한다. 이름·메모·캐시 단가는 보내지 않는다. 재료 input_qty는 기준 인분 전체, extra amount는 1인분 합계라는 기존 저장 계약을 유지한다.

빈 값·입력 중 문자열·비유한 숫자·음수·잘못된 UUID·반제품·잘못된 인분은 조회를 멈춘다. 0 판매가는 유효하며 나눗셈 결과 이익률은 null로 취급해야 한다. 캐시 단가 null은 서버의 현재 단가 조회를 막지 않는다. 서버에서도 같은 검증과 소유권 검사를 반드시 독립 수행한다.

## 서버 후속 구현 기준

- 별도 읽기 RPC는 서버 store_local_date의 활성 국가/세금 프로필/activation boundary를 사용한다. 예약 설정과 현재 설정을 섞지 않는다.
- 수정 메뉴는 현행 메뉴 override를 사용한다. 신규는 매장 default treatment를 사용한다. 저장이나 임시 메뉴 insert로 견적을 만들지 않는다.
- base_unit_price와 서버 부자재 unit_cost를 조회하고 재료·부자재·수정 대상의 매장 소유권을 검증한다. 원가가 없으면 0으로 숨기지 않는다.
- 세금은 calculate_international_tax의 구성 항목별 minor-unit 반올림을 재사용한다. 순이익은 quote.net_sales−재료−부자재−고정지출이다.
- 월 고정지출은 현재 서버 영업일 월의 fixed_cost_rate이며 누락을 0으로 확정하지 않는다.
- 응답에는 입력·매장·메뉴·서버 날짜·현재 market/tax 판본을 결속한다. 쿼리 키는 전체 입력과 actor/store 범위를 포함한다. 늦은 응답으로 최신 초안 결과를 덮지 않는다.
- 공개 함수는 executor 역할 계약을 유지하고 activation boundary 테이블 직접 권한을 추가하지 않는다. 내부 quote helper/ACL 변화도 독립검수 대상이다.
- UI는 1인분/기준 인분, 판매가·세금·고객 결제액·세전 순매출·재료·부자재·고정지출·순이익·목표 상태를 표시한다. 오류/미확정/입력 중은 구분하며 저장된 quote나 legacy 공식으로 대체하지 않는다.

## 필수 검증

입력 변환 15개 시험 PASS. 남은 검증: KR 포함가 12000→세금1091/순매출10909, USD 별도가12.34→세금1.23/결제13.57/순매출12.34, 다중세금/면세, 신규/수정 override, 단가 없음, 고정지출 없음, 인분·입력 경쟁, 다른 매장/잘못된 참조/비유한 값, 조회 전후 원장·레시피 불변, 실제 DB/HTTP·앱 통합·독립검수·전체 게이트.

관련 권위: ARCHITECTURE.md §계산, migrations 0036 부자재 저장 계약 및 0191/0203 세금 견적, draftStore.ts의 단위 주석.
