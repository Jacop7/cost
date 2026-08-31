# INTL-LAUNCH-CORE-DOCS-005 공동 작업 장부

> 이 장부는 `INTL-LAUNCH-CORE-DOCS-004` r001의 Finding 5건을 수정 커밋에서 재검수하는
> append-only 기록이다. 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-o001`
- target_commit_sha: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`
- predecessor_task_id: `INTL-LAUNCH-CORE-DOCS-004`
- predecessor_round: `r001`
- predecessor_review_sha256: `0aaed6c3a50929fa115a23004070544b1732c17cb943a3b3ac92472ecbf31b9f`
- changed_artifact_paths: `docs/국가-통화-세금-국제출시-기획안.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`
- 충족해야 할 요구사항·불변식: predecessor Finding 5건의 동일 ID 재확인, DB RPC 계산 권위, 시점 스냅샷, 전진 migration, 현재 구현과 계획 상태 분리
- 이번에 바꾼 내용: 스테이징 SQL 실측·원격 셸 대기·production 미적용 상태를 증거 링크로 통일했다. 과세 상태별 `r0_effective`·`A(treatment)`·`bi`·`M`과 추가세 적용 과세 상태를 정의했다. `codex/`를 허용 브랜치 접두어로 등록하고, 현재 세금 공식의 ÷100과 `price_basis` 시장 프로필 단일 소유를 명시했다.
- 집중 검토 질문: `ARCH-INTL004-*` Finding 5건의 완료 조건이 모두 충족됐는가? 새 공식이나 운영 상태 서술이 다른 불변식을 깨뜨렸는가?
- 실행한 테스트·현재 증거: `git diff --check`, 상대 링크·배포 증거 존재 검사, 운영 상태·브랜치명·공식·price_basis 문자열 대조, 과세 상태별 Node 숫자 검산 모두 통과. 제품 전체 verify는 문서 전용 변경이라 실행하지 않았다.
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `ARCH-INTL004-OPS-STATUS-CONTRADICTION`, `ARCH-INTL004-TAX-TREATMENT-FORMULA`, `ARCH-INTL004-BRANCH-NAMING`, `ARCH-INTL004-LEGACY-FORMULA-DESC`, `ARCH-INTL004-PRICE-BASIS-OWNER`
- decision_id: `INTL-FABLE-RECHECK-BUDGET-20260831`
- 결정: r001 Finding 반영판의 최종 페이블 재검수를 위해 추가 실행 한도 최대 `4.00 USD`를 승인한다.
- 허용 범위·기한: `INTL-LAUNCH-CORE-DOCS-005`의 읽기 전용 Fable 재검수, 2026-08-31 현재 요청에 한함
- 근거: 사용자 메시지 `승인`
- 승인자·시각: 사용자, 2026-08-31 Asia/Seoul
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r001 sha256=fc8548fead8082df0e5a39f1d493b048efa718388e736546431e44d0d2c2e995 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `fc8548fead8082df0e5a39f1d493b048efa718388e736546431e44d0d2c2e995`
- target_commit_sha: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`
- input_files_sha256: `dd84c6bd7e758e4f3e5c240f85d383b129344e818a60d8df53dd1611906dc6b3`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INTL-LAUNCH-CORE-DOCS-005 FABLE-ARCH RECHECK 결과 PASS. predecessor r001의 Finding 5건이 커밋 e7a7fd0의 세 기획안에서 모두 수용 기준을 충족해 VERIFIED로 전환한다. (1) ARCH-INTL004-OPS-STATUS-CONTRADICTION: 브랜치 문서 머리말·§4.5와 서버 문서 채택 상태가 '스테이징 cvfvmpzcldyqurcrappu에 0164~0174 배포 가드 적용, SQL Editor 경로 앱 ACL 감사 4개 지표 0건 실측(배포·ACL 증거 JSON 링크 고정), admin-acl.sh --remote audit 셸 경로는 작업큐 P1-1 대기, production 접근·적용 없음·실측 없으면 배포 중단'이라는 하나의 사실로 통일됐고, ARCHITECTURE.md 옛 기준선은 소급 수정 없이 작업큐 INTL-DOC-SYNC-1 별도 동기화 과업으로 등록됐다. 단 스냅샷에는 산출물·참조 6개 파일만 실체화돼 docs/deployments/*.json과 작업큐.md 링크 대상의 실재는 SOLAR가 협업 장부에 보고한 상대 링크·증거 존재 검사 통과에 의존했다. (2) ARCH-INTL004-TAX-TREATMENT-FORMULA: §3.4가 r0_effective(taxable→r0, zero_rated·exempt→0)·A(treatment)·bi(미포함 1, 포함 1+r0_effective)·M=1+r0_effective+Σ(i∈A)(ri×bi)를 정의하고 applies_to_treatments 명시·빈 값 실패 폐쇄, override 소유 단위·우선순위는 §10 7번 게이트로 등록됐으며 항목 수 표기도 '일곱 항목'으로 일치한다. 숫자 검산 정합: r0=10%·추가세 5% 기본세 포함이면 M=1.155로 미포함 10,000→결제 11,550, 포함 11,550→N 10,000이고 zero_rated는 bi=1·M=1.05, exempt에 적용 추가세가 없으면 M=1이다. 검증 행렬(298행)이 r0_effective·A(treatment)와 1:1 대응한다. (3) ARCH-INTL004-BRANCH-NAMING: §2.2·§8.1이 codex/를 허용 작업유형으로 등록하고 두 INTL-1 계획 브랜치가 slug 규칙(2~4단어, 20~40자)을 따르며 두 문서의 표기가 동일하다. (4) ARCH-INTL004-LEGACY-FORMULA-DESC: §5.1이 판매가 × (Σ tax_items.rate ÷ 100)·퍼센트 포인트로 AGENTS.md 권위 계약과 일치한다. (5) ARCH-INTL004-PRICE-BASIS-OWNER: §4.2가 price_basis 소유 원본을 시장 프로필 하나로 확정하고 세금 프로필 중복 저장을 금지하며 판매 스냅샷도 시장 프로필 값을 굳힌다. DB RPC 계산 권위·시점 스냅샷·전진 migration·현재/계획 상태 분리 불변식은 유지되고 새 모순은 발견하지 못했다. VERIFIED는 로컬 확인이며 PASS·VERIFIED가 외부 게이트를 닫지 않고 gate_state는 OPEN으로 유지된다. 정식 CLOSED 전환은 향후 P0-2 보호 게이트 절차의 몫이다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-f001`
- verified_target_commit_sha: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`
- verified_review_sha256: `fc8548fead8082df0e5a39f1d493b048efa718388e736546431e44d0d2c2e995`
- verified_run_sha256: `d2552921b8fe842e391c2c7da92cc3586910d522fbdea6ce363693da2edc83ae`
- finding_ids: `ARCH-INTL004-OPS-STATUS-CONTRADICTION`, `ARCH-INTL004-TAX-TREATMENT-FORMULA`, `ARCH-INTL004-BRANCH-NAMING`, `ARCH-INTL004-LEGACY-FORMULA-DESC`, `ARCH-INTL004-PRICE-BASIS-OWNER`
- Fable 결과: `PASS`, 다섯 Finding 모두 `VERIFIED`, 필수·선택 미해결 0건, 새 Finding 0건
- 보조 증거 실재 확인: 스테이징 배포 JSON SHA-256 `20f34131bc3ca31cb10b6422675364f86534231296ac15e5b6b65a0cedc9333f`, ACL 감사 JSON SHA-256 `1a1483177ff82f64d892c4795ccbee3445190fa92341f5fdee82791269817316`, 작업큐 SHA-256 `97027b50cd9cee1d1042c32d722f7dec6cf2cdc800fa99022955499d88ff9034`
- 로컬 검증: `git diff --check`, 변경 문서 상대 링크·증거 파일 존재 검사, 운영 상태·브랜치명·공식·price_basis 문자열 대조, 과세 상태별 숫자 검산 모두 exit 0
- 미실행 항목과 이유: 문서·프로토타입 전용 변경이므로 제품 전체 `corepack pnpm verify`는 실행하지 않았다.
- gate_state: `OPEN`; 로컬 PASS·VERIFIED는 보호 원격 CLOSED 또는 production 배포 승인을 뜻하지 않는다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`
