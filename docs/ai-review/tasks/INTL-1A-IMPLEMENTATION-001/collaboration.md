# INTL-1A-IMPLEMENTATION-001 공동 작업 장부

> 이 장부는 국제 출시 1A의 공용 타입·비활성 capability·회귀시험·공식 문서를 솔라와 페이블이 함께
> 개선하는 append-only 기록이다. 직접 편집은 이 최초 패킷 작성까지만이며 이후 턴은
> `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`
- artifact_hashes: 실행기의 manifest와 WORKING snapshot이 정확한 파일별 SHA-256을 봉인한다.
- changed_artifact_paths: `task.json`의 `artifact_paths` 13개 파일
- 충족해야 할 요구사항·불변식: `INTL-1A-001..008`, DB RPC 계산 권위, 시점 보존, 전진 migration, RPC 최소 권한
- 이번에 바꾼 내용: 5개국·5개 통화·업무 로케일과 다음 단계 시장/세금/스냅샷 타입을 공용 패키지에 정의했다. 0178은 인증 클라이언트용 `app_capabilities()`를 추가하되 국제 세금 읽기·쓰기를 모두 비활성으로 유지한다. DB·core·upgrade·ACL·parity 시험과 verify 연결을 추가하고 공식 문서에 현재 상태를 기록했다.
- 집중 검토 질문: 공용 타입이 기획 결정과 어긋나거나 다음 단계에서 갈릴 필드를 만드는가? 비활성 capability가 구 앱을 잘못 활성화하거나 최소 권한을 넓히는가? 현행 0090 세금 계산·저장이 실제로 불변인가? 새 DB와 0177→0178 업그레이드 검증이 주장에 판별력을 갖는가? 문서가 아직 남은 Fable·CI 게이트를 과장하지 않는가?
- 실행한 테스트·현재 증거: `corepack pnpm verify` 6/6 — DB 37/37, core 183(3 skipped), mobile 212, ACL 승인 RPC 66·미승인 0, 새 DB·2세션 경합·국제 DB parity, upgrade 14/14, 웹 번들. `corepack pnpm db:types`로 생성 타입도 갱신했다.
- 사람 결정이 필요한 항목: 실제 국제 세금 계산·저장 활성화, 새 KRW 검산값 승격, 스테이징 cutover와 production 적용은 INTL-1B~1F 및 별도 사람 승인 범위다.
- next_review_request: `FABLE_REVIEW`


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

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`
- changed_artifact_paths: `packages/types/src/international.ts`, `docs/작업큐.md`

### INTL1A-IMP-TAXCATEGORY-DOMAIN

- disposition: `APPLIED`
- 적용 위치: `packages/types/src/international.ts`, `docs/작업큐.md`
- 적용 내용: `TaxRegionCode`와 `TaxCategoryCode` 별칭을 만들고 사용자 자유 입력이나 표시 이름이 아니라 INTL-1B 카탈로그가 소유하는 불변 코드임을 명시했다. 하위 관할은 표준 코드가 있으면 ISO 3166-2를 우선하며 판매 스냅샷은 판매 시점 과세 분류 코드를 그대로 보존한다.
- 반박 또는 부분 적용 근거: 없음. 저장 카탈로그와 허용값 시험은 Finding 완료 조건대로 INTL-1B에서 구현한다.
- 실행한 테스트: `@margincook/types typecheck` exit 0, core 183 passed·3 skipped, `git diff --check` exit 0.
- 필요한 재검수: 같은 Finding의 소유권·값 영역 문서화 충족 여부

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`
- finding_ids: `INTL1A-IMP-TAXCATEGORY-DOMAIN`
- 실행 명령: `corepack pnpm --filter @margincook/types typecheck`; `corepack pnpm --filter @margincook/core test`; `git diff --check`
- 종료 코드·결과: 모두 exit 0. core 183 passed·3 skipped. 앞선 전체 `corepack pnpm verify`도 6/6(DB 37/37, mobile 212, 새 DB·경합·parity, upgrade 14/14, 웹 번들) 통과.
- 증거 파일·로그 위치: `packages/types/src/international.ts`, `docs/작업큐.md`, `docs/ai-review/tasks/INTL-1A-IMPLEMENTATION-001/rounds/r001/review.json`
- 미실행 항목과 이유: 주석·타입 별칭만 추가했으므로 전체 DB 재구축은 반복하지 않고 영향 범위 typecheck/core와 diff를 재검증했다.
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r002 sha256=b250abbcae4e0ffc6d5958b40bbf95297f40a4cf036038f83c98904ee3ba97d0 -->
## FABLE_RECHECK · turn-f002 · r002

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `b250abbcae4e0ffc6d5958b40bbf95297f40a4cf036038f83c98904ee3ba97d0`
- target_commit_sha: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`
- input_files_sha256: `bcd4d37cdee5f0005671fba9c1c9ae86255fd47299914e64b0358196561a1ded`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INTL-1A RECHECK 결과 PASS다. 이전 라운드(r001)의 유일한 Finding인 INTL1A-IMP-TAXCATEGORY-DOMAIN(Improvement)은 turn-s002 적용으로 해소되어 VERIFIED로 전환한다. (1) packages/types/src/international.ts 36~46행에 TaxRegionCode·TaxCategoryCode 별칭이 추가되어 값 영역 소유 주체를 한 곳에 고정했다: TaxRegionCode는 사용자 자유 입력이 아니라 INTL-1B 관할 카탈로그가 소유하고 표준 코드가 있는 지역은 ISO 3166-2를 우선하며, TaxCategoryCode는 표시 이름이 아닌 세금 프로필 카탈로그의 불변 코드이고 판매 스냅샷은 판매 시점 코드를 그대로 보존한다. StoreMarketProfile.regionCode, StoreTaxProfile.regionCode, SaleTaxSnapshot.regionCode·taxCategory가 모두 이 별칭을 사용해 이전에 지적한 비대칭과 requiresTaxRegion 주석의 미정의 코드 체계 문제가 함께 해소됐다. (2) docs/작업큐.md 142~144행이 같은 소유권 결정(regionCode=INTL-1B 관할 카탈로그·ISO 3166-2 우선, taxCategory=세금 프로필 카탈로그 불변 코드)을 공식 기록으로 남겼다. (3) Codex 증거(turn-c001): 타입 별칭·주석만 추가된 변경이므로 @margincook/types typecheck exit 0, core 183 passed·3 skipped, git diff --check exit 0의 영향 범위 재검증이 적절하고, 앞선 전체 corepack pnpm verify 6/6(DB 37/37, mobile 212, 새 DB·2세션 경합·국제 DB parity, upgrade 14/14, 웹 번들)과 상충하지 않는다. 수용 기준 2(리터럴 유니언/브랜드 타입으로 좁힘)와 허용 값 계약 시험은 Finding 원문대로 INTL-1B 카탈로그 구현 시점의 조건부 후속 항목이며 작업큐에 재검수 계획으로 기록돼 있다. 새 Finding은 없고 remaining_required_finding_ids는 비어 있다. PASS와 VERIFIED는 외부 게이트를 닫지 않으며 gate_state는 OPEN이다. 동일 SHA 보호 CI 게이트가 남아 있다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->
