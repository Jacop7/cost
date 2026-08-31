# INTL-1A-COMMIT-001 공동 작업 장부

> 이 장부는 WORKING 검수 r002를 반영한 INTL-1A 확정 commit을 Fable이 독립적으로 다시 검수하는
> append-only 기록이다. 직접 편집은 이 최초 패킷 작성까지만이며 이후 턴은 검수 실행기나
> `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `04bebf2788d8e389549a6be764004ff214e034e5`
- artifact_hashes: 실행기의 COMMIT manifest가 target commit의 정확한 Git blob·SHA-256을 봉인한다.
- changed_artifact_paths: `task.json`의 `artifact_paths` 13개 파일과 생성 타입·WORKING 검수 증거
- 충족해야 할 요구사항·불변식: `INTL-1A-COMMIT-001..005`, 서버 계산 권위, 전진 migration, RPC 최소 권한, 정확한 SHA CI 전 main 합류 금지
- 이번에 바꾼 내용: 공용 국제 계약, 0178 비활성 capability, DB/core/ACL/upgrade/parity 검증과 공식 문서 상태를 하나의 commit에 고정했다. WORKING r001의 유일한 Improvement는 타입·작업큐에 반영했고 r002가 VERIFIED했다.
- 집중 검토 질문: 확정 commit이 WORKING 스냅샷의 의미를 온전히 포함하는가? 새 RPC가 권한을 넓히거나 현행 세금 계산을 바꾸는가? 검증이 새 DB와 중간 upgrade 양쪽에서 판별력을 갖는가? 문서가 외부 게이트 전 상태를 과장하는가?
- 실행한 테스트·현재 증거: `corepack pnpm verify` 6/6 — DB 37/37, core 183(3 skipped), mobile 212, ACL 승인 RPC 66·미승인 0, 새 DB·경합·parity, upgrade 14/14, 웹 번들. 후속 타입 주석은 types typecheck·core test·diff check로 재확인했다.
- 사람 결정이 필요한 항목: 없음. 실제 계산 활성화와 스테이징·production 적용은 INTL-1B~1F와 별도 사람 승인 범위다.
- next_review_request: `FABLE_REVIEW`


<!-- fable-review:r001 sha256=600002504807ce2830a374ec69973cf2adc792a85316ed210e7ad6ebd283a082 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `600002504807ce2830a374ec69973cf2adc792a85316ed210e7ad6ebd283a082`
- target_commit_sha: `04bebf2788d8e389549a6be764004ff214e034e5`
- input_files_sha256: `49c226e5036186f049b9ef4783c6ac22b344c1b7a63cab8478e5615ebc5b3d3f`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INTL-1A-COMMIT-001 INITIAL 검수 결과 PASS다. 확정 commit 04bebf2는 WORKING 스냅샷의 의미를 온전히 포함하며 새 Finding은 없다. (1) COMMIT-001: packages/types/src/international.ts 8~152행이 5개국·5개 통화·5개 업무 로케일의 일대일 출시 metadata, 시장/세금 프로필, 세금 구성 항목×채널 납부 주체, SaleTaxSnapshot 계산선 계약을 공용 타입으로 소유하고 index.ts 8행이 export한다. 앱 언어는 시장 metadata에 없고 core 계약 시험이 이를 고정한다. (2) COMMIT-002: 0178은 app_capabilities()만 생성하며 read_enabled/write_enabled 모두 false, minimum_write_app_version null이고 migration 내 do 블록이 응답·권한을 자체 검증한다. DB 시험 37의 18~20행이 현행 0090 포함가 12,000원 세금 10/110 계산 불변을 검산한다. (3) COMMIT-003: anon revoke·authenticated/service_role grant(0178 26~27행, 시험 37 24~29행), 시험 34의 승인 facade 정확히 66개, admin-acl-audit.sql의 app_capabilities 승인 등록(international-contract-bootstrap 사유), upgrade-check.sh ⑭단계의 0177→0178 경로 검증, internationalDbParity.test.ts와 verify.mjs ④단계의 살아 있는 DB↔TypeScript 기준선 대조, database.types.ts 1709행의 생성 타입이 모두 target commit에 함께 고정돼 있다. (4) COMMIT-004: 고정된 r002 review.json은 INTL1A-IMP-TAXCATEGORY-DOMAIN VERIFIED·미해결 필수 Finding 0건이고, international.ts 36~46행의 TaxRegionCode·TaxCategoryCode 소유권 보정(INTL-1B 카탈로그 소유·ISO 3166-2 우선)과 작업큐 142~145행의 공식 기록이 commit에 반영됐다. (5) COMMIT-005: 작업큐는 INTL-1A를 '병합 대기·동일 SHA 보호 CI 대기'로, 기획안 9~14행은 '동일 SHA 보호 CI와 main 선형 합류는 아직 남아 있다'로 기록해 외부 게이트 전 상태를 과장하지 않는다. LRN-ORCH-CI-001과 일치한다. 새 RPC는 권한을 넓히지 않고 현행 세금 계산을 바꾸지 않으며, 검증은 새 DB(37/37)와 중간 upgrade(14/14) 양쪽에서 판별력을 갖는다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN이다. 동일 SHA 보호 CI와 main 선형 합류가 남은 외부 게이트다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
