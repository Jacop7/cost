# INTL-1A-COMMIT-001 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-ARCH`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `04bebf2788d8e389549a6be764004ff214e034e5`

## 요약

INTL-1A-COMMIT-001 INITIAL 검수 결과 PASS다. 확정 commit 04bebf2는 WORKING 스냅샷의 의미를 온전히 포함하며 새 Finding은 없다. (1) COMMIT-001: packages/types/src/international.ts 8~152행이 5개국·5개 통화·5개 업무 로케일의 일대일 출시 metadata, 시장/세금 프로필, 세금 구성 항목×채널 납부 주체, SaleTaxSnapshot 계산선 계약을 공용 타입으로 소유하고 index.ts 8행이 export한다. 앱 언어는 시장 metadata에 없고 core 계약 시험이 이를 고정한다. (2) COMMIT-002: 0178은 app_capabilities()만 생성하며 read_enabled/write_enabled 모두 false, minimum_write_app_version null이고 migration 내 do 블록이 응답·권한을 자체 검증한다. DB 시험 37의 18~20행이 현행 0090 포함가 12,000원 세금 10/110 계산 불변을 검산한다. (3) COMMIT-003: anon revoke·authenticated/service_role grant(0178 26~27행, 시험 37 24~29행), 시험 34의 승인 facade 정확히 66개, admin-acl-audit.sql의 app_capabilities 승인 등록(international-contract-bootstrap 사유), upgrade-check.sh ⑭단계의 0177→0178 경로 검증, internationalDbParity.test.ts와 verify.mjs ④단계의 살아 있는 DB↔TypeScript 기준선 대조, database.types.ts 1709행의 생성 타입이 모두 target commit에 함께 고정돼 있다. (4) COMMIT-004: 고정된 r002 review.json은 INTL1A-IMP-TAXCATEGORY-DOMAIN VERIFIED·미해결 필수 Finding 0건이고, international.ts 36~46행의 TaxRegionCode·TaxCategoryCode 소유권 보정(INTL-1B 카탈로그 소유·ISO 3166-2 우선)과 작업큐 142~145행의 공식 기록이 commit에 반영됐다. (5) COMMIT-005: 작업큐는 INTL-1A를 '병합 대기·동일 SHA 보호 CI 대기'로, 기획안 9~14행은 '동일 SHA 보호 CI와 main 선형 합류는 아직 남아 있다'로 기록해 외부 게이트 전 상태를 과장하지 않는다. LRN-ORCH-CI-001과 일치한다. 새 RPC는 권한을 넓히지 않고 현행 세금 계산을 바꾸지 않으며, 검증은 새 DB(37/37)와 중간 upgrade(14/14) 양쪽에서 판별력을 갖는다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN이다. 동일 SHA 보호 CI와 main 선형 합류가 남은 외부 게이트다.

## Findings

없음

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
