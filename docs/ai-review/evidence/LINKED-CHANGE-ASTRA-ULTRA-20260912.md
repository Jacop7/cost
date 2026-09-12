# 연결 변경 Astra Ultra 독립 검수 — 2026-09-12

## 판정과 권한

최초 P2 6건과 수정분 재검수에서 추가한 P2 1건은 아래 최종 후보에서 모두 해결 확인했다. 마지막 0224/시험 83 델타에서 새 P1/P2는 발견하지 못했다. 이 판정은 확인한 반례와 검수 범위에 한정하며 모든 조합의 완전성이나 운영 배포 승인을 뜻하지 않는다.

사용자가 **이번 검사에 한해서 Astra Ultra 독립 검수**를 명시 요청한 예외다. 프로젝트의 상시 모델·추론 계획이나 Fable 기본 독립검수 정책을 변경하지 않았으며, 다른 검수 엔진을 호출하지 않았다. 검수자는 소스·설정·Git·DB를 변경하거나 시험을 실행하지 않았다. 마지막 요청에서 허용한 이 보고서 한 파일만 작성했다.

- 정본 작업 루트: `C:\Users\jacop\프로젝트\식자재관리앱`
- 검수 시작 기준 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23`
- 후보는 미커밋 변경을 포함한다. HEAD가 후보 전체 내용을 식별한다고 간주하지 않았으며 기존 대량 변경을 이번 구현으로 분류하지 않았다.
- 검수 방법: 소스·실제 호출자·격리 DB의 설치된 함수 본문 조회, 순수 세금 계산 SELECT, ROOT가 생성한 재현 시험 및 실행 로그 대조.
- 적용 상태는 ROOT가 전달한 기준으로 사용자 개발 DB 0214, 후보는 격리 fresh DB에 적용, 원격 미배포다. 검수자가 배포·적용을 수행하거나 운영 상태를 별도 감사하지 않았다.

## 발견 사항의 최종 처리

### ASTRA-01 — P2 · 종료 시 순매출만 달라지는 세금 변경 누락 · 해결

110원 메뉴의 포함 10%→미포함 9.09%는 세금이 모두 10원이지만 순매출이 100→110원이다. 기존 종료 비교는 가격·재료비·부자재비·세금·고정비만 비교하여 영업 중 보류한 순이익 추세를 종료 때도 만들지 않았다. 이 금액은 검수자의 순수 계산 SELECT로 확인했다.

[0220:10](../../../packages/db/supabase/migrations/20260912000220_close_net_sales_trend.sql#L10)은 최종 견적과 시작 스냅샷의 순매출을 비교하고 세금 원인으로 분류한다. [시험 80](../../../packages/db/tests/80_close_net_only_change.sql)은 open/break에서 이전 금액 유지, 종료 후 추세 1건, 세금 원인을 확인한다. `astra-net-before.log`의 수정 전 실패와 `astra-final-db-all.log`의 수정 후 통과를 확인했다.

### ASTRA-02 — P2 · 세금 먼저 변경한 뒤 원가 변경 이력의 날짜 불일치 · 해결

세금 변경 후 식재료·메뉴·입고·취소를 저장하면 기존 변경 이력은 오늘 또는 입고 날짜의 옛 세금 프로필을 읽어 현재/대기 구성의 손익과 달랐다.

[0221:4](../../../packages/db/supabase/migrations/20260912000221_pending_change_tax_basis.sql#L4)은 변경 이력용 `pending_recipe_tax_quote_for_price`를 만들고 명시한 다섯 호출 위치만 교체한다. 과거 판매·재고 평가의 날짜 계산 경로는 교체하지 않는다. [시험 81](../../../packages/db/tests/81_tax_first_cost_combination.sql)은 세금을 먼저 바꾼 순서에서 4개 영업 상태의 식재료·메뉴·입고·취소 이력과 최종 손익을 확인한다. `tax-first.log`의 36개 단언 통과를 확인했다. 시험 23의 기대값도 현재 변경 이력용 견적에 맞춘 수정이며 과거 원장 수치를 재작성하는 변경이 아니다.

### ASTRA-03 — P2 · 서버 영업 전환 시 판매 입력 기준 캐시 누락 · 해결

기존 제외 조건은 `businessDay` 접두 전체를 제외하여 하위 `menus` 쿼리도 갱신하지 않았다.

[queryClient.ts:141](../../../apps/mobile/src/lib/queryClient.ts#L141)은 키 길이와 구성 요소를 함께 비교해 상태 쿼리 하나만 제외한다. [영업 전환 시험](../../../apps/mobile/tests/recipeTaxBusinessDayInvalidation.test.tsx)은 실제 `useDayMenuBasis`를 연결하여 서버 종료 관측 후 메뉴 기준 재조회, 상태가 그대로인 재조회에서는 중복 갱신 없음까지 확인한다.

### ASTRA-04 — P2 · 국가 화면의 시장 단독 저장 경로 · 해결

`/my/country`가 구형 시장 writer를 단독 호출하여 MY 세금 화면과 가격 기준 저장 가능 여부가 달랐고, 시장과 세금 저장의 원자성을 우회했다.

[MyCountryScreen.tsx:1](../../../apps/mobile/src/features/my/screens/MyCountryScreen.tsx#L1)은 공통 `InternationalTaxScreen`을 재사용한다. [국가 화면 시험](../../../apps/mobile/tests/myCountry.test.tsx)은 두 판본을 포함한 원자 저장, 완결된 세금 입력, 실패 시 부분 성공 표시 없음, 쓰기 capability 차단을 확인한다. `astra-country-ui-second.log`에서 국가 화면 4건과 영업 전환 5건 통과를 확인했다. 실제 입고 이력 이후 국가 변경 차단과 가격 기준 수정 허용은 [시험 77](../../../packages/db/tests/77_atomic_tax_configuration.sql) 및 `tax-real-ledger.log`로 대조했다.

### ASTRA-05 — P2 · 매장 기본값 선택이 이후 기본값을 상속하지 않음 · 해결

기존 기본값 복귀는 당시 과세 상태를 복사 저장했고 프로필 교체 시 이를 명시 예외처럼 승계했다.

[0222:4](../../../packages/db/supabase/migrations/20260912000222_menu_tax_default_inheritance.sql#L4)은 신규 쓰기의 `inherit_default`를 기록한다. 과거 행은 false로 보존하며 선택 의도를 추정하지 않는다. writer의 판본·무변경 비교에 상속 여부가 포함되고, 새 프로필로 승계할 때 상속 행만 새 기본값으로 해석하며 앱에는 기본값 선택을 null로 반환한다. [시험 82](../../../packages/db/tests/82_tax_inheritance_pending_scope.sql)와 `tax-inheritance.log`에서 상속·미선택·명시 과세·명시 면세·분류의 구분, 오래된 판본 거부, 무변경, 분류 삭제 후 복구하지 않음을 확인했다.

### ASTRA-06 — P2 · 영향 없는 메뉴에도 세금 반영 대기 표시 · 해결

기존 `last_entity_change`의 매장 전체 세금 fallback은 실제 메뉴 기준이 같은 명시 면세 메뉴도 대기로 표시했다.

[0223:8](../../../packages/db/supabase/migrations/20260912000223_tax_pending_menu_scope.sql#L8)은 이 세금 fallback만 제거하고 메뉴별 전파 사건에 결속한다. [시험 82](../../../packages/db/tests/82_tax_inheritance_pending_scope.sql)는 기본 과세→면세 변경에서 영향 없는 명시 면세 메뉴의 추가 이력·대기 없음과 영향 있는 상속 메뉴의 대기를 함께 확인한다. 고정지출·부자재 fallback을 제거하는 변경은 아니다.

### ASTRA-07 — P2 · 미래 예약을 앞당길 때 메뉴 예외 설정 유실 · 해결

프로필과 명시 예외가 D+2부터인 상태를 D로 앞당기면 기존 carry는 D까지만 읽었다. 뒤이은 프로필 삭제로 실제 저장된 예외가 유실됐다.

[0224:9](../../../packages/db/supabase/migrations/20260912000224_promoted_tax_override_carry.sql#L9)은 읽는 끝 날짜를 `greatest(p_date, 기존 프로필 effective_from)`으로 한정한다. 프로필 시작 이후의 임의 미래 선택을 모두 끌어오거나 과거 의도를 추정하지 않는다. 저장된 면세·분류·상속·판본·수정 시각을 기존 복구 경로로 새 적용일에 승계한다.

[시험 83](../../../packages/db/tests/83_future_tax_override_carry.sql)은 공개 writer로 D+2 예약과 세 종류 override를 만든 뒤 합성 영업일 fixture만 제거하여 앞당김을 재현한다. 0223 기준 `future-carry-before-fixed-fixture.log`에서 승계 단언 실패, 0224 기준 `future-carry-final.log`에서 tax-only와 미래 시장의 atomic 두 경로 합계 6개 단언 통과를 확인했다. 기존 활성 경계 D+2는 유지하며 해당 경계의 면세·영세·상속 금액을 검사한다.

마지막 델타 파일 SHA-256:

- 0224: `624c590928a71abebefbfb1e81730d7b251dfd524e1c08f1226901ec5a779045`
- 시험 83: `4895ee6cae8c22577e997e5fe9916f07f878eec3fa4abbc1e9b88410acc85b65`

## 증거와 미확인 범위

로그의 공통 위치는 [.codex/material-history-20260912](../../../.codex/material-history-20260912)다. 실행 주체는 ROOT이며 검수자는 로그를 읽고 소스·단언과 대조했다. 최신 `astra-final-db-all.log`의 **85/85 통과**를 확인했다. 앞선 `astra-delta-db.log`는 **81/82**이며 시험 23 실패를 포함하므로 전체 통과 증거로 사용하지 않는다.

검수 범위는 최초 후보 0215~0219 및 관련 0206~0214/기존 계산·writer, 실제 앱 호출자, 수정 후보 0220~0224, 시험 75~83과 관련 캐시·화면 시험이다. 0206~0214 전체를 새로 작성된 변경으로 간주하지 않았다.

최종 전체 `pnpm verify`, 업그레이드 경로 전체, 실기기 증빙, 원격 적용, 모든 날짜·국가·조합·동시성의 완전 탐색은 이번 독립검수의 실행 범위가 아니다. 이전 경합 로그와 표적 재현 시험을 읽었다는 사실을 최종 후보의 모든 동시성 조합이 검증됐다는 뜻으로 확대하지 않는다. 별도의 운영 게이트와 배포 판정은 이 보고서로 대체하지 않는다.
