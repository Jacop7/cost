
<!-- fable-review:r001 sha256=f0d466c6c4a967a3076d96c274b50a7aeb096cbcc495161f2b5255cb2fc93dfd -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `f0d466c6c4a967a3076d96c274b50a7aeb096cbcc495161f2b5255cb2fc93dfd`
- target_commit_sha: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`
- input_files_sha256: `f6ba82b9e7a433e28324f2904dea8d0cb158bb1cd8552a986f7e2f5a03e91542`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: INTL1A-IMP-TAXCATEGORY-DOMAIN
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INTL-1A 초기 검수 결과 PASS다. (1) INTL-1A-001~003: packages/types/src/international.ts가 5개국·5개 통화·5개 업무 로케일과 minor unit(KRW=0, 나머지 2)을 한 곳에 고정하고, AppLanguageCode('ko'|'en')를 매장 시장 metadata와 분리했으며, 시장/세금 프로필 ID·revision·적용 구간, 구성 항목 계산 기준(TaxCalculationBasis), 항목×채널 납부 주체(TaxComponentChannelRemittance), 판매 세금 스냅샷(SaleTaxSnapshot)의 다음 단계 타입만 정의한다 — 저장 표나 금액 원장은 만들지 않는다. (2) INTL-1A-004~005: 0178은 app_capabilities()만 추가하며 read_enabled/write_enabled 모두 false, minimum_write_app_version null을 반환하고 migration 내부 do 블록이 JSON 계약과 권한을 자체 검증한다. 0090의 tax_of/save_store_tax/판매·손익 경로는 건드리지 않는다. (3) INTL-1A-006: PUBLIC·anon revoke 후 authenticated·service_role만 grant, ACL 허용 목록에 app_capabilities() 정확 시그니처 추가(facade 66개·미승인 authenticated 0개 계약 유지, 비-mobile 예외 명시). (4) INTL-1A-007: DB 시험 37이 capability 계약·권한·12,000원 포함가 10/110 불변을 검증하고, upgrade-check 시나리오 14가 0177→0178 전후 tax_of 불변과 capability 상태 문자열을 판별하며, internationalDbParity.test.ts가 verify ④의 새 DB에서 실제 DB JSON↔APP_CAPABILITIES_BASELINE parity를 대조한다. 생성 타입에도 app_capabilities가 반영됐다. (5) INTL-1A-008: 기획안과 작업큐 모두 'Fable 구현 재검수와 동일 SHA 보호 CI는 아직 남아 있다'를 명시해 과장이 없다. 차단 결함은 없고, SaleTaxSnapshot.taxCategory·regionCode의 자유 문자열 값 영역을 INTL-1B 전에 문서화하라는 Improvement 1건만 남긴다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN이다.

### 공동 편집 제안 색인

- EDIT-INTL1A-TAXCATEGORY-DOC: COMMENT `packages/types/src/international.ts` ·   taxCategory: string; · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
