# 식재료 전체 기능 정밀 점검 — 2026-09-09

## 결론

화면 전체가 빈 껍데기인 상태는 아니다. 실제 조회·저장·원장·취소 RPC가 연결돼 있다.
그러나 **모든 기능 구현 완료라고 판단할 수 없다.** 입력해도 저장되지 않는 항목과 실제 재고를 틀리게 만들 수 있는 저장 계약 문제가 확인됐다.

점검 목록은 **44개 = 화면 13개 + 팝업/상태 31개**다. 현재 노출 대상 40개와 숨김 3개, 폐기된 더보기 1개를 포함했다.
실제 독립 페이지 수와 팝업/동일 화면 상태를 합친 수를 혼동하지 않는다. ‘약 50개’를 맞추기 위해 없는 페이지를 만들지 않았다.

## 점검 기준과 한계

- 실제 실행 작업본: `C:/Users/jacop/프로젝트/식자재관리앱/.tmp/prototype-expo-parity-r2`
- 브랜치: `codex/prototype-expo-parity-r2`, HEAD: `03f385cee92730b6156c31ca1ec3e28409f5334f`.
- 점검 시작/보고서 작성 직전 모두 기존 dirty 경로 133개. HEAD만이 아니라 현재 작업 파일을 점검했다.
- `http://localhost:8091/appmap/`의 식재료 44개 URL/상태를 직접 열고 실제 Expo iframe의 내용을 확인했다.
- 기본 대파, 링크가 있는 쌀의 실제 로컬 데이터로 확인. 구매 링크 유무는 각각 실데이터를 골라 관측했다.
- 권위 루트의 서비스 전체 페이지 흐름 프로토타입을 8092에서 직접 열어 수정 폼·입고·구매처·폐기 입력을 대조했다. 원본 파일의 식재료 목록 및 폼 정의도 읽었다.
- ‘연결됨’ = 화면의 실제 처리 경로가 확인됐다는 뜻. 모든 저장/동시성/기기 검증을 끝냈다는 의미가 아니다.
- **실제 데이터의 저장·입고·차감·폐기·취소·삭제는 이 점검에서 실행하지 않았다.** 저장은 소스/실행 중 DB 함수/기존 격리 테스트로 분석했다.
- 입고 실패만 DB 쓰기를 차단하는 샘플 모드에서 오류 UI를 관측했다. 실제 장애 복구의 종단 검증과 다르다.
- Android/iOS 실기기, 운영 DB, 전체 verify, 외부 독립 검수는 이번 진단에서 실행하지 않았다.
- 제품 코드를 수정하지 않았다. 점검 당시 꺼져 있던 기존 로컬 AppMap/Expo 개발 서버를 시작했고 이 보고서만 추가했다.

## 페이지별 판정

| 번호 | 페이지·팝업 | 판정 | 확인 내용 / 남은 문제 |
|---|---|---|---|
| 1 | [메인](http://localhost:8091/appmap/?screen=ingredient_main&data=real) | 연결됨 · 일부 표시 문제 | 실제 19개 식재료 조회, 카테고리 필터와 정렬 연결. 알림 점은 실제 미확인 알림 수와 무관하게 항상 표시됨(F7). |
| 2 | [정렬 기준](http://localhost:8091/appmap/?screen=ingredient_main&popup=sort&data=real) | 연결됨 | 추천/잔여량/단가/이름 정렬 코드가 있고, 실제 ‘잔여 적은 순’ 선택 후 목록 순서 변경 확인. 단위가 다른 g·ml·개를 숫자 그대로 비교하는 정책은 별도 검토 필요. |
| 3 | [식재료 추가](http://localhost:8091/appmap/?screen=ingredient_add&data=real) | 부분 구현 | 이름·카테고리·용량·안전재고·최소 발주는 저장 RPC 연결. 구매 가격은 저장되지 않는 미리보기 입력(F4). |
| 4 | [추가 > 카테고리 선택](http://localhost:8091/appmap/?screen=ingredient_add&popup=add_category&data=real) | 연결됨 | 실제 매장 카테고리 조회, 선택값을 폼에 전달. 조회 오류·빈 목록·재시도 처리 존재. |
| 5 | [추가 > 단위 선택](http://localhost:8091/appmap/?screen=ingredient_add&popup=add_unit&data=real) | 연결됨 · 계약 검토 | kg/g/L/ml/박스/개 선택과 최소단위 환산 존재. 포장 단위 ‘박스’도 식재료 기본단위 선택에 섞여 있어 제품 표시 규칙과 정리 필요(F2). |
| 6 | [식재료 상세](http://localhost:8091/appmap/?screen=ingredient_detail&data=real) | 연결됨 | 실제 재고·기준단가·구매 링크·입고/재고 내역·최근 수정 조회. 메뉴와 상세 이동 연결. 오래된 수정 기록 누락은 F5. |
| 7 | [상세 > 구매 링크 있음](http://localhost:8091/appmap/?screen=ingredient_detail&popup=ingredient_option_filled&data=real) | 연결됨 · 데이터 조건 | 실제 쌀의 구매 링크 2개 및 자세히보기 확인. 링크 카드 메뉴 연결. 독립 팝업이 아니라 데이터에 따른 상세 화면 상태. |
| 8 | [상세 > 구매 링크 없음](http://localhost:8091/appmap/?screen=ingredient_detail&popup=ingredient_option_empty&data=real) | 연결됨 · 데이터 조건 | 실제 대파에서 빈 상태와 ‘구매 링크 추가’ 확인. 표시를 위해 데이터를 만들거나 지우지 않음. |
| 9 | [수정 메뉴](http://localhost:8091/appmap/?screen=ingredient_edit_menu&data=real) | 연결됨 | 식재료 수정·재고 수정·메모 수정·구매 링크 수정·식재료 삭제 5개 동작 연결. |
| 10 | [식재료 수정](http://localhost:8091/appmap/?screen=ingredient_edit&data=real) | 부분 구현 · 중요 오류 | 저장 RPC 연결. 구매 가격은 불러오거나 저장하지 않음(F4). 기본단위 종류를 바꿀 때 기존 원장 환산/보호가 없음(F2). |
| 11 | [수정 > 카테고리 선택](http://localhost:8091/appmap/?screen=ingredient_edit&popup=edit_category&data=real) | 연결됨 | 현재 카테고리 표시와 실제 목록 선택 연결. 추가 화면과 공용 컴포넌트. |
| 12 | [수정 > 단위 선택](http://localhost:8091/appmap/?screen=ingredient_edit&popup=edit_unit&data=real) | 오류 있음 | 무게 식재료에도 부피·개수 단위가 노출됨. 기존 재고/구매 이력/레시피 사용량을 함께 환산하지 않은 채 base_unit 변경 가능(F2). |
| 13 | [재고 내역](http://localhost:8091/appmap/?screen=stock&data=real) | 연결됨 | 실제 원장·서버 잔량·월별 목록·유형별 합계·취소 후보 조회. 삭제/취소 버튼은 해당 원장의 후보 조건을 사용. |
| 14 | [재고 > 기간](http://localhost:8091/appmap/?screen=stock&popup=stock_period&data=real) | 연결됨 | 1·3·6개월/전체 선택 → 서버 매장 날짜로 조회 범위 변경. 공용 선택 시트. |
| 15 | [재고 > 유형](http://localhost:8091/appmap/?screen=stock&popup=stock_type&data=real) | 연결됨 | 전체/입고/판매 소진/차감/폐기 필터 구현. 서버 원장을 유형별로 필터링. |
| 16 | [재고 > 정렬](http://localhost:8091/appmap/?screen=stock&popup=stock_order&data=real) | 연결됨 | 최신순/오래된순 구현. 서버가 준 각 행 잔량을 유지하며 목록 순서만 변경. |
| 17 | [재고 > 최근 기록 더보기](http://localhost:8091/appmap/?screen=stock&popup=stock_event_more&data=real) | 폐기된 항목 | 현재 메뉴에서 제거됐고 옛 URL은 재고 내역으로 이동. 기능 미구현으로 세지 않음. 과거 전체 카탈로그에는 식별자가 남음. |
| 18 | [재고 > 기록 취소 확인](http://localhost:8091/appmap/?screen=stock&popup=stock_event_revert&data=real) | 연결됨 · 실행 검증 제한 | 실제 취소 확인창과 revert_latest_stock_event RPC 존재. 최신 유형별 후보·7일·재취소 방지는 서버 판정. 실제 취소는 실행하지 않음. |
| 19 | [재고 수정](http://localhost:8091/appmap/?screen=stock_change&data=real) | 연결됨 · 하위 오류 | 입고/차감/폐기 실제 화면의 통합 진입. 아래 F1~F3 문제를 공유. |
| 20 | [재고 수정 > 입고](http://localhost:8091/appmap/?screen=stock_change&popup=stock_inbound&data=real) | 오류 있음 | 실제 미리보기·저장·확인·토스트 연결. 같은 날 같은 수량/용량/금액의 별도 입고가 중복 처리될 수 있음(F1). |
| 21 | [재고 수정 > 차감](http://localhost:8091/appmap/?screen=stock_change&popup=stock_deduct&data=real) | 오류 위험 | 사유·수량·확인·저장·토스트 연결. 사용자가 입력한 차감량이 아니라 조회 당시 계산한 ‘남을 총량’을 보내므로 동시 변경에 취약(F3). |
| 22 | [재고 수정 > 폐기](http://localhost:8091/appmap/?screen=stock_change&popup=stock_discard&data=real) | 부분 구현 · 오류 위험 | 폐기량/손실 미리보기·확인·저장·토스트 존재. 폐기 사유 저장은 명시적 미지원(F4). 동시 변경 문제도 존재(F3). |
| 23 | [입고 > 구매처 선택](http://localhost:8091/appmap/?screen=stock_change&popup=stock_option&data=real) | 연결됨 | 실제 구매 옵션 선택, 직접 입력, 구매 링크 추가 연결. 옵션 없는 대파에는 직접 입력/추가가 표시됨. |
| 24 | [입고 > 입고 확인](http://localhost:8091/appmap/?screen=stock_change&popup=stock_confirm&data=real) | 연결됨 · 데이터 조건 | 실제 쌀 옵션으로 식재료/입고량/입고 후 재고 확인창 확인. 대파처럼 옵션 없는 데이터에서는 AppMap 자동 진입이 멈추므로 수동 입력 필요. |
| 25 | [입고 > 실패 안내](http://localhost:8091/appmap/?screen=stock_change&popup=stock_error&data=real) | 연결됨 · 모의 오류 검증 | 실제 모드에서는 강제 저장하지 않고 안내. 쓰기 차단된 샘플 모드에서 실제 입고 실패 UI 확인. 실제 서버 장애를 일으켜 보지는 않음. |
| 26 | [메모 수정](http://localhost:8091/appmap/?screen=memo_edit&data=real) | 연결됨 · 동시 수정 위험 | 메모 입력·완료·저장 RPC 연결. 메모는 수정내역 제외가 현재 확정안. 메모만 바꾸는 대신 식재료 전체 값을 보내므로 동시 편집 덮어쓰기 위험(F8). |
| 27 | [구매 이력](http://localhost:8091/appmap/?screen=purchase&data=real) | 연결됨 | 실제 과거 입고·구매 데이터 및 당시 단가, 포장 구성/총량/금액 표시. 삭제 요청한 안내·지출 합계 문구는 노출되지 않음. |
| 28 | [구매 이력 > 기간](http://localhost:8091/appmap/?screen=purchase&popup=purchase_period&data=real) | 연결됨 | 1·3·6개월/전체 공용 필터. 선택값이 purchase_history의 조회 범위에 전달됨. |
| 29 | [폐기 내역](http://localhost:8091/appmap/?screen=discard&data=real) | 숨김 · 구형 로직 잔존 | 직접 URL에서는 실데이터 화면이 열림. 과거 손실을 현재 기준단가로 다시 계산하는 문제와 구형 삭제 경로가 남아 있음(F6). |
| 30 | [폐기 내역 > 유형](http://localhost:8091/appmap/?screen=discard&popup=discard_type&data=real) | 숨김 · 연결됨 | 전체/조리 전/조리 후 실제 필터와 건수 표시. 현재 주 흐름에서 숨긴 화면의 하위 기능. |
| 31 | [폐기 내역 > 기간](http://localhost:8091/appmap/?screen=discard&popup=discard_period&data=real) | 숨김 · 구형 UI | 실제 기간 변경은 연결. 오늘/1년/적용 버튼을 포함한 구형 PeriodSheet여서 현재 공용 4개 즉시선택 스타일과 다름. |
| 32 | [수정 내역](http://localhost:8091/appmap/?screen=ingredient_changes&data=real) | 연결됨 · 검증 미정리 | 최근 7일 실제 변경 원장·직접 수정/자동 갱신 집계·페이지 이어받기 구현. 월별 제목을 기대하는 테스트 2개가 현재 실패(F9). |
| 33 | [수정 내역 > 수정 상세](http://localhost:8091/appmap/?screen=ingredient_changes&popup=ingredient_change_detail&data=real) | 연결됨 · 과거 데이터 누락 | 실제 사건의 직접/파생 전후값 표시. 옛 입고 기록의 실입고량·결제금액은 기록 없음으로 표시. 신규 저장용 보완 migration은 존재하고 로컬 적용됨(F5). |
| 34 | [구매 링크 수정/목록](http://localhost:8091/appmap/?screen=options&data=real) | 연결됨 | 실제 옵션 목록·최저/최고·카드 메뉴·추가 연결. 저장/삭제는 실제 RPC를 사용. |
| 35 | [구매 링크 > 링크 목록](http://localhost:8091/appmap/?screen=options&popup=option_list&data=real) | 연결됨 · 동일 화면 | options 목록과 같은 실제 화면. 별도 완성 페이지로 중복 계산하지 않아야 함. |
| 36 | [구매 링크 > 추가](http://localhost:8091/appmap/?screen=options&popup=option_add&data=real) | 연결됨 · 단위 오류 | URL 접두사와 /뒤 경로 없이 example.com만으로 필수값 충족 시 추가 버튼 활성 확인. 단위 종류 검증 누락(F2). 실제 저장은 실행하지 않음. |
| 37 | [구매 링크 > 수정](http://localhost:8091/appmap/?screen=options&popup=option_edit&data=real) | 연결됨 · 단위 오류 | 기존 값 읽기·수정·save_purchase_option 연결. 편집 상태 보호 코드 존재. 서로 다른 단위 종류 선택 문제 공유(F2). |
| 38 | [구매 링크 > 구매처 선택](http://localhost:8091/appmap/?screen=options&popup=option_vendor&data=real) | 앱 연결됨 · AppMap 오판 | 실제 구매처 목록/발주 건수/선택 연결. AppMap은 ‘거래처 선택’을 찾지만 실제 제목은 ‘구매처 선택’이라 경고가 나옴(F7). |
| 39 | [구매 링크 > 새 구매처](http://localhost:8091/appmap/?screen=options&popup=option_vendor_new&data=real) | 연결됨 | 이름 입력·빈값 차단·실제 구매처 저장 훅·실패 안내 존재. 추가 후 목록에서 다시 선택하는 흐름이며 실제 추가 실행은 안 함. |
| 40 | [구매 링크 > 단위 선택](http://localhost:8091/appmap/?screen=options&popup=option_unit&data=real) | 중요 오류 | 무게 식재료 대파에 1L/4,000원 입력 시 4.00원/g으로 계산되고 나머지 필수값 입력 후 저장 버튼까지 활성화됨(F2). 저장은 안 함. |
| 41 | [구매 링크 > 카드 메뉴](http://localhost:8091/appmap/?screen=options&popup=option_card_menu&data=real) | 연결됨 | 실제 카드에서 링크 열기/수정 메뉴 확인. Linking.openURL과 잘못된 URL/열기 실패 안내 연결. 외부 사이트 접속 완료는 미검증. |
| 42 | [구매 링크 > 더보기](http://localhost:8091/appmap/?screen=options&popup=option_more&data=real) | 연결됨 | 실제 편집 화면의 더보기 → 구매 옵션 삭제 메뉴 확인. |
| 43 | [구매 링크 > 삭제 확인](http://localhost:8091/appmap/?screen=options&popup=option_delete&data=real) | 연결됨 · 실행 검증 제한 | 실제 확인창과 delete_purchase_option 연결, 중복 클릭 보호 존재. 과거 입고 기록 보존. 실제 삭제는 실행하지 않음. |
| 44 | [식재료 삭제](http://localhost:8091/appmap/?screen=ingredient_delete&data=real) | 앱 연결됨 · AppMap 오판 | 실제 삭제 확인창 존재. 활성 메뉴에서 사용하는 식재료는 서버가 차단하고, 허용 시 비활성화로 목록 제외. AppMap 옛 문구 검사 오류(F7). 물리 원장 삭제가 아님. |

## 우선순위별 상세 근거

### F1. 중요 — 같은 조건의 별도 입고가 누락될 수 있음

- 위치: `QuickInboundScreen.tsx:161`, `ingredients/hooks.ts:122`, migration `20260820000074_quick_inbound.sql:51`.
- 입고 중복 방지 키가 식재료 ID + 날짜 + 용량 + 금액 + 수량으로 고정된다. 거래처와 ‘이번 입고’의 고유 식별자는 포함되지 않는다.
- 같은 날 같은 상품을 같은 가격·수량으로 두 번 구매해도 동일 키다. DB는 이전 키를 발견하면 `duplicate:true`를 반환하고 새 입고를 만들지 않는다.
- 앱 훅은 응답 data를 읽지 않고 error만 확인하므로 이 경우에도 ‘입고 처리했어요.’ 토스트를 띄운다.
- 이는 단순 연속 클릭 방지와 다른 문제다. 새로 연 폼에서 별도의 정상 입고를 등록하는 경우까지 합쳐진다.
- 소스와 실행 중 DB 함수의 계약으로 확인한 결함. 실제 사용자 재고에 두 번 입고하는 파괴적 재현은 하지 않았다.

### F2. 중요 — 단위 종류 검증과 기존 원장 보호가 빠짐

- 위치: `PurchaseOptionScreen.tsx:110,141,356`, `IngredientFormScreen.tsx:107,207`, `UnitPickerSheet.tsx`.
- 공용 단위 선택기에는 base별 제한 기능이 있지만 두 호출 화면에서 제한값을 전달하지 않는다.
- **실제 대파(g) 구매 링크 추가에서 L을 선택하고 1 / 4000을 입력하자 4.00원/g이 표시됐다.** 필수 이름·구매처·example.com을 채우면 추가 버튼도 활성화됐다. 저장은 하지 않았다.
- 구매 옵션 저장에는 환산한 volume만 전달되고 선택한 단위 종류는 전달되지 않는다. 1L가 1000이라는 숫자로 바뀌어 무게 식재료의 1000g처럼 해석된다.
- 식재료 수정은 base_unit 자체를 바꾼다. 실행 중 save_ingredient 함수와 ingredients 트리거를 읽었고, 종류 변경을 막거나 기존 원장 전체를 환산하는 보호를 찾지 못했다. ingredients 사용자 트리거는 updated_at 갱신뿐이었다.
- 기존 1000g 재고의 단위를 ml/개로 바꾸는 것은 단순 화면 표기 변경이 아니다. 재고·구매 옵션·레시피 사용량의 의미가 바뀔 수 있다.
- ‘박스’는 포장 정보와 기본 계량 단위가 섞인 선택이다. 구매 옵션에는 박스당 환산량 입력도 없으므로 같은 정책 정리가 필요하다.

### F3. 중요 — 차감·폐기 입력은 상대 수량인데 서버에는 절대 잔량을 보냄

- 위치: `StockChangeScreen.tsx:40–46`, `ingredients/hooks.ts:541,554`.
- 실행 중 DB의 `e5_stock_adjusted`, `e2_discard` 정의까지 확인했다.
- 앱은 조회 시점 재고에서 입력 수량을 빼서 ‘변경 후 총량’을 전송한다. 조회 버전/예상 재고 검증은 없다.
- 예: 재고 1000g을 보고 100g 차감을 준비 → 다른 작업으로 재고가 1200g이 됨 → 앱이 900g을 제출하면 실제 차감이 300g이 된다.
- 폐기도 서버가 ‘지금 재고 − 전달받은 잔량’으로 폐기량을 역산하므로 같은 문제가 있다.
- DB 행 잠금은 실행 자체를 직렬화하지만, 사용자가 의도한 100g이라는 상대 수량까지 보존하지는 못한다.
- 위 수치는 코드/DB 계약에서 도출한 동시성 시나리오이며 이번에 두 세션의 실제 재고를 바꿔 재현한 결과는 아니다.
- 삭제한 ‘재고 맞추기’ UI를 다시 만든 것은 아니지만, 내부적으로는 기존 절대 재고 조정 RPC를 재사용하고 있다.

### F4. 명확한 부분 미구현 — 폐기 사유 / 구매 가격

**폐기 사유**

- `StockChangeScreen.tsx:69–77`: 입력칸 disabled, ‘사유 저장 미지원’ 표시.
- `ingredients/hooks.ts:541`: E2 호출에 사유 파라미터 없음.
- 원본 프로토타입 `stock_discard`에는 필수 폐기 사유와 ‘유통기한 경과’ 입력이 있다.
- 수량 저장과 예상 손실 기능은 구현돼 있지만 사유 기록은 구현돼 있지 않다.

**식재료 추가·수정의 구매 가격**

- `IngredientFormScreen.tsx:65,88,101–116,172`: 수정 진입 시 가격을 비우고, 화면 계산에만 사용하며 저장 payload에서 제외한다.
- 화면에서 입력할 수 있어도 다음에 다시 열면 그 가격은 복원되지 않는다.
- 서버 권위 규칙상 이 값을 단순히 기준단가에 덮어쓰면 안 된다. 구매 옵션 가격으로 저장할지, 계산 전용 입력임을 명확히 할지 제품 계약을 정해야 한다.
- ‘전체 폼 저장 미구현’은 아니고 **해당 입력 항목의 지속 저장 기능이 없는 상태**다.

### F5. 수정내역은 구현돼 있으나 과거 기록의 입력 스냅샷이 없음

- 실제 대파의 최근 7일 기록 2건과 상세 팝업 확인. 입고의 기준단가 전후값은 나오지만 실입고량/결제금액은 기록 없음.
- `20260909000193_inbound_change_inputs.sql`은 이후 입고에서 두 값을 같은 변경 사건에 저장하도록 보완한다.
- `20260909000194_purchase_option_change_history.sql`은 구매 링크 추가/수정/삭제의 전후값 기록 트리거를 추가한다.
- 로컬 DB migration 목록에 0193/0194 적용 확인.
- 이전 기록을 현재 가격으로 역산해 채우지 않는 것은 올바르다. 다만 과거 데이터가 온전하게 복원된 상태라고 말할 수는 없다.
- 최근 7일 조회, 직접/자동 그룹, 캐시 무효화 경로는 존재한다. 직접 수정과 자동 갱신 전체가 ‘미구현’인 것은 아니다.
- 메모·판매 소진·일반 재고 변동이 수정내역에 없는 것은 현 확정안의 의도된 제외다. 재고 원장에서 확인한다.

### F6. 숨긴 폐기 내역에 구형 금액·취소 로직이 남음

- `DiscardHistoryScreen.tsx:122,191`: 과거 폐기량에 **현재** 기준단가를 곱해 합계/행 금액을 표시한다.
- 과거 확정 손실을 표시해야 한다면 당시 원장 금액을 사용해야 한다. 현재 단가가 바뀔 때 과거 손실 표시도 변할 수 있는 구조다.
- 같은 파일 `:80–105,201`에 조리 전·7일 이내 건의 구형 더보기/삭제 경로가 남아 있다.
- 새 재고 내역의 ‘유형별 최신 1건 취소’ UI와 별개다. 숨김만으로 경로가 사라진 것은 아니므로 재노출 전 정리가 필요하다.
- 기간 선택도 구형 ‘오늘/1년/적용’ 양식이다.
- 현재 주 동선에서 숨겼으므로 이를 다시 구현해야 할 신규 화면으로 계산하지는 않는다.

### F7. 실제 기능과 AppMap 상태 표시가 어긋나는 곳

- `scripts/appmap/navigation.mjs:81`: 구매처 선택의 기대 문구는 ‘거래처 선택’. 실제 앱 제목은 ‘구매처 선택’. 실제 시트가 열려 있는데도 AppMap은 확인 실패를 표시했다.
- 같은 파일 `:20`: 식재료 삭제에서 ‘과거 입고·판매 기록은 남고’를 검사한다. 실제 문구는 최신 요청대로 ‘삭제하시겠습니까? / 삭제 시, 복구가 불가합니다.’라 오판한다.
- 옵션 없는 재료에서 입고 확인 자동 진입은 선택할 옵션을 못 찾아 멈출 수 있다. 옵션 있는 쌀로 바꾸면 실제 확인창이 열린다.
- 구매 링크 있음/없음은 실제 데이터 상태이며, 강제로 조작하지 않는 안내가 존재한다. 그 안내만 보고 미구현이라고 판정하면 안 된다.
- 메인 알림 점은 `IngredientListScreen.tsx:85`에서 unconditional `dot`이다. 실제 미확인 알림 유무와 연결된 표시로 보기는 어렵다.
- AppMap 전체 숫자는 과거 카탈로그/숨김/동일 화면 상태를 포함하므로 ‘숫자만큼 모두 완성’의 근거가 아니다.

### F8. 메모·식재료 수정의 동시 편집 보호 부족

- `IngredientDetailScreen.tsx` 메모 저장은 메모만 보내지 않고 화면이 가진 식재료의 이름·단위·안전재고·구매처 등 전체 값을 save_ingredient에 전달한다.
- 식재료 수정 폼도 최초 로드한 값으로 전체 payload를 보낸다. 서버 save_ingredient에 settings.revision 같은 판본 검사는 없다.
- 다른 화면/기기가 먼저 고친 필드를 이후의 메모 저장이나 오래 열린 수정 폼이 덮어쓸 가능성이 있다.
- 같은 앱 인스턴스의 정상 저장 후 React Query 무효화는 존재한다. 이것과 동시 편집 충돌 검사는 다른 기능이다.
- 별도 브라우저/기기 간 즉시 푸시 동기화는 해당 기능 코드에서 확인하지 못했다. 동일 컴포넌트 사용을 ‘항상 즉시 양방향 실시간 동기화’로 표현하면 안 된다.

### F9. 테스트와 출시 검증 상태가 최신 UI를 따라가지 못함

실행한 명령:

```text
corepack pnpm --filter @margincook/mobile test -- ingredient quickInbound stockChangeScreen stockRevertAction purchaseOptions purchaseOptionLifecycle purchaseOptionChangeHooks changeHistory vendorPickerFailure
```

- 18개 파일, 총 257개 테스트.
- **255 통과 / 2 실패**. 실패 파일: `changeHistoryPagination.test.tsx`.
- 두 실패는 ingredient/recipe 각각 옛 월별 ‘2030년 9월’ 제목을 기대하는 검증이다. 현재 UI는 요청대로 ‘최근 7일간’을 쓴다.
- 이 두 실패만으로 페이지 이어받기 자체가 미구현이라고 단정할 수는 없다. 다만 최신 요구사항과 회귀 검증의 정리가 완료된 상태도 아니다.

추가 실행:

```text
node --test scripts/appmap/samples.test.mjs
```

- 13/13 통과. 샘플 쓰기 차단과 실제 모드의 원래 처리 경로 유지 포함.
- 실제 모드의 서버 저장 성공까지 검증하는 종단 테스트는 아니다.
- 기존 0193/0194 작업 증거에는 전체 verify의 DB ACL 게이트 실패가 기록돼 있다. 이번 점검에서 전체 verify를 재실행하지 않았으므로 현재 전체 통과 여부는 미확인이다.

## /appmap과 실제 Expo의 관계

현재 확인한 화면은 AppMap 전용 가짜 화면이 아니라 **Expo 라우트/컴포넌트를 iframe으로 불러오는 구조**다.
따라서 그 컴포넌트의 기능 결함은 기본 Expo에도 존재한다.

단, 두 모드는 분리해야 한다.

- 실제 로컬 데이터: 원래 조회/쓰기 경로를 사용한다.
- 샘플 미리보기: 일부 조회 응답을 예시로 바꾸고 쓰기를 차단한다. 여기서 저장 성공을 검증할 수 없다.

UI 컴포넌트를 공유한다는 사실이 네이티브 기기 검증·운영 DB 배포·여러 기기의 즉시 동기화까지 보장하는 것은 아니다.

## 수정 우선순위 제안

1. 재고·수량을 틀리게 할 수 있는 입고 중복 키, 단위 종류 변경, 차감/폐기 절대 잔량 제출 문제.
2. 폐기 사유 저장과 구매 가격 입력의 실제 저장 계약.
3. 메모/식재료 동시 수정 보호.
4. AppMap 옛 문구 판정, 숨김 폐기 화면의 구형 경로, 최신 요구사항에 맞춘 테스트.
5. 격리 DB에서 정상 저장 → 원장 → 목록/상세/이력 → 취소까지 종단 검증.

**현재 결론은 ‘기능 골격은 있으나 핵심 저장 계약과 일부 필드가 미완성’이다. 전체를 폐기하고 처음부터 다시 만들어야 한다는 근거는 없다.**
