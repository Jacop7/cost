# INTL-1A-IMPLEMENTATION-001 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `WORKING_TREE_HASHED`
- 대상 SHA: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`

## 요약

INTL-1A 초기 검수 결과 PASS다. (1) INTL-1A-001~003: packages/types/src/international.ts가 5개국·5개 통화·5개 업무 로케일과 minor unit(KRW=0, 나머지 2)을 한 곳에 고정하고, AppLanguageCode('ko'|'en')를 매장 시장 metadata와 분리했으며, 시장/세금 프로필 ID·revision·적용 구간, 구성 항목 계산 기준(TaxCalculationBasis), 항목×채널 납부 주체(TaxComponentChannelRemittance), 판매 세금 스냅샷(SaleTaxSnapshot)의 다음 단계 타입만 정의한다 — 저장 표나 금액 원장은 만들지 않는다. (2) INTL-1A-004~005: 0178은 app_capabilities()만 추가하며 read_enabled/write_enabled 모두 false, minimum_write_app_version null을 반환하고 migration 내부 do 블록이 JSON 계약과 권한을 자체 검증한다. 0090의 tax_of/save_store_tax/판매·손익 경로는 건드리지 않는다. (3) INTL-1A-006: PUBLIC·anon revoke 후 authenticated·service_role만 grant, ACL 허용 목록에 app_capabilities() 정확 시그니처 추가(facade 66개·미승인 authenticated 0개 계약 유지, 비-mobile 예외 명시). (4) INTL-1A-007: DB 시험 37이 capability 계약·권한·12,000원 포함가 10/110 불변을 검증하고, upgrade-check 시나리오 14가 0177→0178 전후 tax_of 불변과 capability 상태 문자열을 판별하며, internationalDbParity.test.ts가 verify ④의 새 DB에서 실제 DB JSON↔APP_CAPABILITIES_BASELINE parity를 대조한다. 생성 타입에도 app_capabilities가 반영됐다. (5) INTL-1A-008: 기획안과 작업큐 모두 'Fable 구현 재검수와 동일 SHA 보호 CI는 아직 남아 있다'를 명시해 과장이 없다. 차단 결함은 없고, SaleTaxSnapshot.taxCategory·regionCode의 자유 문자열 값 영역을 INTL-1B 전에 문서화하라는 Improvement 1건만 남긴다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN이다.

## Findings

### INTL1A-IMP-TAXCATEGORY-DOMAIN — Improvement / OPEN

- 범주: ARCHITECTURE
- 영향: INTL-1B가 이 타입 위에 저장 표를 만들 때 taxCategory·regionCode의 허용 값 체계가 구현마다 갈릴 수 있고, 스냅샷에 이미 기록된 자유 문자열은 시점 보존 원칙상 소급 정정이 어렵다. 현 단계에서는 저장 경로가 없어 실해가 없으므로 Improvement다.
- 근거: packages/types/src/international.ts:117, packages/types/src/international.ts:44
- 완료 조건: INTL-1B 착수 전에 taxCategory와 regionCode의 값 체계(코드 표준 또는 카탈로그 소유 주체)를 international.ts 주석 또는 기획안에 한 곳으로 고정한다. / 값 체계가 리터럴로 고정 가능해지면 타입을 유니언 또는 브랜드 타입으로 좁힌다.
- 필요한 테스트: INTL-1B에서 regionCode·taxCategory 허용 값을 검증하는 계약 시험 추가

## 공동 편집 제안

### EDIT-INTL1A-TAXCATEGORY-DOC — COMMENT

- 대상: `packages/types/src/international.ts`
- 위치:   taxCategory: string;
- 연결 Finding: INTL1A-IMP-TAXCATEGORY-DOMAIN
- 이유: 스냅샷에 기록되는 자유 문자열 필드의 값 체계 소유 주체를 다음 단계 전에 한 곳으로 고정한다.

    taxCategory 필드 위에 값 영역을 고정하는 주석을 제안한다: "/** 메뉴 과세 분류. 값 체계는 INTL-1B의 세금 프로필 카탈로그가 소유하며, 스냅샷에는 판매 시점 문자열을 그대로 보존한다. */" — regionCode에도 같은 방식으로 코드 표준(예: ISO 3166-2 하위 관할) 소유 주체를 명시하면 INTL-1B 구현이 갈리지 않는다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
