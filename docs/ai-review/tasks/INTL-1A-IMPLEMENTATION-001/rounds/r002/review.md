# INTL-1A-IMPLEMENTATION-001 Fable 검수 — r002

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`

## 요약

INTL-1A RECHECK 결과 PASS다. 이전 라운드(r001)의 유일한 Finding인 INTL1A-IMP-TAXCATEGORY-DOMAIN(Improvement)은 turn-s002 적용으로 해소되어 VERIFIED로 전환한다. (1) packages/types/src/international.ts 36~46행에 TaxRegionCode·TaxCategoryCode 별칭이 추가되어 값 영역 소유 주체를 한 곳에 고정했다: TaxRegionCode는 사용자 자유 입력이 아니라 INTL-1B 관할 카탈로그가 소유하고 표준 코드가 있는 지역은 ISO 3166-2를 우선하며, TaxCategoryCode는 표시 이름이 아닌 세금 프로필 카탈로그의 불변 코드이고 판매 스냅샷은 판매 시점 코드를 그대로 보존한다. StoreMarketProfile.regionCode, StoreTaxProfile.regionCode, SaleTaxSnapshot.regionCode·taxCategory가 모두 이 별칭을 사용해 이전에 지적한 비대칭과 requiresTaxRegion 주석의 미정의 코드 체계 문제가 함께 해소됐다. (2) docs/작업큐.md 142~144행이 같은 소유권 결정(regionCode=INTL-1B 관할 카탈로그·ISO 3166-2 우선, taxCategory=세금 프로필 카탈로그 불변 코드)을 공식 기록으로 남겼다. (3) Codex 증거(turn-c001): 타입 별칭·주석만 추가된 변경이므로 @margincook/types typecheck exit 0, core 183 passed·3 skipped, git diff --check exit 0의 영향 범위 재검증이 적절하고, 앞선 전체 corepack pnpm verify 6/6(DB 37/37, mobile 212, 새 DB·2세션 경합·국제 DB parity, upgrade 14/14, 웹 번들)과 상충하지 않는다. 수용 기준 2(리터럴 유니언/브랜드 타입으로 좁힘)와 허용 값 계약 시험은 Finding 원문대로 INTL-1B 카탈로그 구현 시점의 조건부 후속 항목이며 작업큐에 재검수 계획으로 기록돼 있다. 새 Finding은 없고 remaining_required_finding_ids는 비어 있다. PASS와 VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN이다. 동일 SHA 보호 CI 게이트가 남아 있다.

## Findings

### INTL1A-IMP-TAXCATEGORY-DOMAIN — Improvement / VERIFIED

- 범주: ARCHITECTURE
- 검증 엔진: FABLE
- 영향: SaleTaxSnapshot의 taxCategory·regionCode 자유 문자열 값 영역이 INTL-1B 구현마다 갈릴 수 있고 스냅샷 기록은 시점 보존상 소급 정정이 어렵다는 문제였다. 값 체계 소유 주체가 타입 정의와 작업큐 한 곳에 고정되어 실질 위험이 해소됐다. 리터럴 유니언/브랜드 타입 좁힘과 허용 값 시험은 INTL-1B 카탈로그 구현 시점의 조건부 후속 항목이다.
- 근거: packages/types/src/international.ts:36, packages/types/src/international.ts:73, docs/작업큐.md:142
- 완료 조건: INTL-1B 착수 전에 taxCategory와 regionCode의 값 체계(코드 표준 또는 카탈로그 소유 주체)를 international.ts 주석 또는 기획안에 한 곳으로 고정한다. / 값 체계가 리터럴로 고정 가능해지면 타입을 유니언 또는 브랜드 타입으로 좁힌다.
- 필요한 테스트: INTL-1B에서 regionCode·taxCategory 허용 값을 검증하는 계약 시험 추가

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
