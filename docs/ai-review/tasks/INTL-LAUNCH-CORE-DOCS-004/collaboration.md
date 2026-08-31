# INTL-LAUNCH-CORE-DOCS-004 공동 작업 장부

> 이 장부는 국제 출시·브랜치/DB·서버 개정판 3종을 검수하는 append-only 기록이다.
> 비-Fable 턴은 `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `99cd21f272d08465e91b685b80989a04a0c5d6af`
- changed_artifact_paths: `docs/국가-통화-세금-국제출시-기획안.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`
- 충족해야 할 요구사항·불변식: `INTL-CORE-001..008`, DB RPC 계산 권위, 시점 스냅샷, 전진 migration, 현재 구현과 계획 상태 분리
- 이번에 바꾼 내용: 다섯 국가·두 언어 출시 범위, 국가별 통화·로케일·시간대·세금 용어, 기본세 포함 여부와 추가세별 계산 기준, 확정 스냅샷, 브랜치·DB 전진 배포·복구, 서버 확장 보류 판단을 세 공식 개정판에 연결했다.
- 집중 검토 질문: 세 문서 사이에 출시 범위·상태·구현 순서 모순이 있는가? 포함·미포함 및 추가세 수식에 이중 과세·누락 가능성이 있는가? DB 권위·revision·스냅샷·복구 계약이 충분한가? 제품이 세율을 자동 판정하거나 신고를 대행한다고 오인할 표현이 있는가?
- 실행한 테스트·현재 증거: Markdown 링크 확인, 프로토타입 스크립트 문법 확인, `git diff --check`, `corepack pnpm fable:check`, `corepack pnpm fable:self-test` 통과. 문서·프로토타입 전용 변경이라 제품 전체 `corepack pnpm verify`는 실행하지 않았다.
- 사람 결정이 필요한 항목: 국가·지역별 실제 세율과 신고 규칙은 출시 전 공식 기관·현지 전문가 확인이 필요하다.
- prior_attempt_note: 넓은 패킷과 앞선 핵심 문서 패킷은 모델 결과 생성 전 회차 상한 초과로 `RUN_FAILED`가 됐고 verdict는 없다. 사용자가 추가 실행 한도 최대 4.00 USD를 승인했으므로 이번 신규 패킷은 첫 회차에 3.90 USD를 배정한다.
- applied_learning_ids: 없음
- excluded_learning_ids: `LRN-ORCH-CI-001`, `LRN-CODEX-TIME-001`, `LRN-OPS-BACKUP-001`, `LRN-AUDIT-PIN-001`(사유는 task.json)
- next_review_request: `HUMAN_DECISION`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: 없음
- decision_id: `INTL-FABLE-EXTRA-BUDGET-20260831`
- 결정: 앞선 페이블 회차들이 구조화 판정 생성 전 기본 회차 상한을 초과했다는 보고를 확인하고, 국제 출시 핵심 개정판 3종의 페이블 검증을 위해 추가 실행 한도 최대 `4.00 USD`를 승인한다.
- 허용 범위·기한: `INTL-LAUNCH-CORE-DOCS-004`의 읽기 전용 Fable 검수, 2026-08-31 현재 요청에 한함
- 근거: 사용자 메시지 `승인`
- 승인자·시각: 사용자, 2026-08-31 Asia/Seoul
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=0aaed6c3a50929fa115a23004070544b1732c17cb943a3b3ac92472ecbf31b9f -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `0aaed6c3a50929fa115a23004070544b1732c17cb943a3b3ac92472ecbf31b9f`
- target_commit_sha: `99cd21f272d08465e91b685b80989a04a0c5d6af`
- input_files_sha256: `9060e51e12ff45d9cf1f18b82795968e915d0d2122ba06770692cf8e7904ce1e`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: ARCH-INTL004-OPS-STATUS-CONTRADICTION, ARCH-INTL004-TAX-TREATMENT-FORMULA, ARCH-INTL004-BRANCH-NAMING
- 선택 미종결 Finding: ARCH-INTL004-LEGACY-FORMULA-DESC, ARCH-INTL004-PRICE-BASIS-OWNER
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

INTL-LAUNCH-CORE-DOCS-004 초기 FABLE-ARCH 검수 결과 CHANGES_REQUIRED. 세 기획안은 한국·미국·영국·호주·캐나다 5개국과 한국어·영어 출시 범위, DB RPC 계산 권위, 0090 현재 계약과 INTL-1 향후 계약의 구분, 전진 migration·명시적 전환, 1차 서버 확장 보류와 향후 분리 조건, 세무 자동 판정·신고 대행 부인 경계를 서로 모순 없이 유지한다(INTL-CORE-001·002·004·006·007·008 충족). §3.4 공통 공식은 M=1+r0+Σ(ri×bi) 구조로 세금 포함·미포함 순방향·역산이 내부 정합하며, 추가세 간 중첩을 배제해 이중 과세를 막고, §4.3 판매 시점 스냅샷과 §5.3 revision·무변경 계약이 시점 보존 불변식을 지킨다. 다만 (1) Major: 브랜치 문서 머리말과 서버 문서 채택 상태의 "스테이징 0164~0174 적용·ACL 실측·P0-5 폐쇄 완료" 선언이 같은 브랜치 문서 §4.5의 "접근 가능한 호스티드 프로젝트 없음·원격 실행 미확인·P0-5 배포 차단 사유" 서술, 서버 문서의 "원격 셸 감사 자격 대기·호스티드 audit 실측 별도 필요" 서술, ARCHITECTURE.md의 "스테이징 적용 이력 미확인"과 모순돼 배포·복구 단일 출처의 게이트 판단 기준이 갈린다(INTL-CORE-005 위험). (2) Minor: 과세 상태 zero_rated·exempt가 §3.4 공식과 어떻게 결합하는지(유효 r0 치환, bi·M 변화, 추가세 부과 여부)와 과세 상태의 소유 단위가 미정의이고 §10 구현 전 확정 게이트에도 없다. (3) Minor: codex/international-launch·codex/international-tax-legacy-cleanup 브랜치명이 브랜치 문서 §2.2·§8.1 명명 체계에 없는 접두어라 같은 문서 안에서 규칙과 계획이 어긋난다. Improvement 2건: §5.1 현재 tax_of() 서술의 ÷100 누락(요율은 퍼센트 포인트), price_basis의 시장·세금 프로필 이중 기재로 인한 소유 불명. 산출물 3종에 앵커 기반 proposed_edits 8건(모순 지점 코멘트 2건, 공식·게이트·명명·서술 보강 6건)을 제안한다. PASS·VERIFIED가 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- EDIT-OPS-STATUS-BRANCH-DOC: COMMENT `docs/브랜치-DB-운영-기획안.md` · 사유다. 접근 가능한 호스티드 프로젝트가 아직 없어 **실제 원격 실행은 미확인**이다. · 원문은 review.md 참조
- EDIT-OPS-STATUS-SERVER-DOC: COMMENT `docs/서버-확장-아키텍처-기획안.md` · authenticated 함수 87개를 실측했다. P0-5가 뒤의 두 공격면을 폐쇄해 `main`·스테이징 검증을 · 원문은 review.md 참조
- EDIT-TAX-TREATMENT-FORMULA: ADD `docs/국가-통화-세금-국제출시-기획안.md` · 공식의 입력 미리보기와 SQL 대조 시험만 제공한다. · 원문은 review.md 참조
- EDIT-TAX-TREATMENT-GATE-ITEM: ADD `docs/국가-통화-세금-국제출시-기획안.md` · 6. 구 앱 쓰기 호환 기간 또는 최소 앱 버전 차단 정책 · 원문은 review.md 참조
- EDIT-TAX-GATE-COUNT: REPLACE `docs/국가-통화-세금-국제출시-기획안.md` · 이 여섯 항목과 DB 스키마 초안, SQL↔core 검산 예시가 승인되면 `INTL-1`을 구현 단계로 전환한다. · 원문은 review.md 참조
- EDIT-BRANCH-NAMING-RULE: ADD `docs/브랜치-DB-운영-기획안.md` · `docs/server-evolution`, `test/webhook-idempotency`. · 원문은 review.md 참조
- EDIT-LEGACY-FORMULA-DESC: REPLACE `docs/국가-통화-세금-국제출시-기획안.md` · - 현재 `tax_of()`는 `판매가 × Σ(tax_items.rate)`로 계산한다. · 원문은 review.md 참조
- EDIT-PRICE-BASIS-OWNER: ADD `docs/국가-통화-세금-국제출시-기획안.md` · 기본세의 `calculation_basis`는 항상 세금 제외 판매가이므로 저장하지 않거나 고정값으로 검증할 수 있다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `0aaed6c3a50929fa115a23004070544b1732c17cb943a3b3ac92472ecbf31b9f`
- remediation_commit_sha: `5e4ffab90ccb0313d5de4c41271f8c8ea969c084`
- changed_artifact_paths: `docs/국가-통화-세금-국제출시-기획안.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`
- supporting_official_path: `docs/작업큐.md`

### ARCH-INTL004-OPS-STATUS-CONTRADICTION

- disposition: `APPLIED`
- 적용 위치: 브랜치 문서 머리말·§2.2·§4.5, 서버 문서 채택 상태, 작업큐 `INTL-DOC-SYNC-1`
- 적용 내용: 스테이징 사실을 `0164~0174 적용 + SQL Editor 앱 ACL 감사 완료`로 고정하고, 직접 libpq 자격이 필요한 원격 셸 래퍼는 대기, production은 미적용으로 분리했다. P0-5 완료 지표와 배포·ACL 증거 JSON을 직접 링크했다. `ARCHITECTURE.md` 기준선 동기화는 별도 문서 작업 `INTL-DOC-SYNC-1`로 등록했다.
- 필요한 재검수: 세 기획안에서 스테이징 SQL 실측·원격 셸 대기·production 미적용이 한 가지 사실로 유지되는지 확인

### ARCH-INTL004-TAX-TREATMENT-FORMULA

- disposition: `APPLIED`
- 적용 위치: 국제 출시 기획안 §3.4·§4.2·§7·§10
- 적용 내용: `r0_effective`, 과세 상태별 활성 추가세 집합 `A(treatment)`, `bi`, `M`을 정의했다. 추가세마다 `applies_to_treatments`를 명시하고 누락·모호함은 실패 폐쇄한다. 과세 상태 override의 소유 단위와 우선순위를 구현 전 7번째 게이트로 등록했다.
- 필요한 재검수: zero_rated·exempt × 포함·미포함 × 추가세 기준 조합이 공식과 검증 행렬에 1:1로 대응하는지 확인

### ARCH-INTL004-BRANCH-NAMING

- disposition: `APPLIED`
- 적용 위치: 브랜치 문서 §2.2·§8.1
- 적용 내용: Codex가 만드는 단명 작업의 `codex/<기능영역>-<변경목적>`을 허용 접두어로 등록하고 `codex/international-launch`·`codex/international-tax-legacy-cleanup`이 같은 slug 규칙을 따르도록 했다.
- 필요한 재검수: §2.2·§3.3·§8.1과 국제 출시 기획안의 브랜치명 문자열 일치 확인

### ARCH-INTL004-LEGACY-FORMULA-DESC

- disposition: `APPLIED`
- 적용 위치: 국제 출시 기획안 §5.1
- 적용 내용: 현재 `tax_of()`를 `판매가 × (Σ tax_items.rate ÷ 100)`으로 바로잡고 `rate`가 퍼센트 포인트임을 명시했다.
- 필요한 재검수: AGENTS.md·ARCHITECTURE.md의 0090 공식과 단위 일치 확인

### ARCH-INTL004-PRICE-BASIS-OWNER

- disposition: `APPLIED`
- 적용 위치: 국제 출시 기획안 §4.1~§4.3
- 적용 내용: `price_basis` 소유 원본을 시장 프로필 하나로 고정하고 세금 프로필의 중복 필드를 제거했다. 판매 스냅샷에 `market_profile_revision`을 추가해 출처를 고정했다.
- 필요한 재검수: 두 revision이 갈릴 수 있는 복제 경로가 제거됐는지 확인

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- verified_commit_sha: `5e4ffab90ccb0313d5de4c41271f8c8ea969c084`
- finding_ids: `ARCH-INTL004-OPS-STATUS-CONTRADICTION`, `ARCH-INTL004-TAX-TREATMENT-FORMULA`, `ARCH-INTL004-BRANCH-NAMING`, `ARCH-INTL004-LEGACY-FORMULA-DESC`, `ARCH-INTL004-PRICE-BASIS-OWNER`
- artifact_hashes: `docs/국가-통화-세금-국제출시-기획안.md=bb75ca688506a0505e5dc89dfc26e41ac2ed186c41e295ca7ca1ba0a0193fd08`, `docs/브랜치-DB-운영-기획안.md=593a5edf19b36fc2f9d241f3075151a5de1f200dbf6fd18bd5dc794b5833d7d0`, `docs/서버-확장-아키텍처-기획안.md=10f230d035f9b14f14406941d53ddb822ead517ee8181d26900c237ffda53163`, `docs/작업큐.md=97027b50cd9cee1d1042c32d722f7dec6cf2cdc800fa99022955499d88ff9034`
- 실행 명령: `git diff --check`; 변경 문서 상대 링크·배포 증거 파일 존재 검사; 운영 상태·브랜치명·공식·price_basis 문자열 전수 대조; Node 단독 공식 검산
- 종료 코드·결과: 모두 0. 배포·ACL 증거 파일 2개 존재, 깨진 로컬 링크 0개. `taxable`은 `M=1.172`, `zero_rated`·`exempt`는 같은 활성 추가세 집합에서 `M=1.070`이며 포함가 역산이 원래 `N`으로 돌아옴을 확인했다.
- 증거 파일·로그 위치: `docs/deployments/2026-08-29T12-36-00-620Z-staging-f165e23.json`, `docs/deployments/2026-08-29T12-51-42-staging-acl-audit.json`, `docs/ai-review/tasks/INTL-LAUNCH-CORE-DOCS-004/rounds/r001/review.json`
- 미실행 항목과 이유: 문서·프로토타입 전용 수정이므로 제품 전체 `corepack pnpm verify`는 실행하지 않았다. SQL↔core 조합 시험은 INTL-1 구현 완료 조건으로 유지한다.
- remaining_required_finding_ids: r001 기준 3건이며 successor Fable 재검수에서 같은 ID로 확인 요청
- remaining_optional_finding_ids: r001 기준 2건이며 모두 적용 후 successor 재검수 요청
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `INTL-LAUNCH-CORE-DOCS-004`
- predecessor_round: `r001`
- predecessor_task_sha256: `65c017e5a4502d9d2c6cec5d752ac0ff9b674ff7d2db3970be3b8b68789b82cd`
- predecessor_manifest_sha256: `3c956adce0d4c94c0fe59f1ec57de782bbb0fc7f93bf1808ceef65942825f993`
- predecessor_review_sha256: `0aaed6c3a50929fa115a23004070544b1732c17cb943a3b3ac92472ecbf31b9f`
- predecessor_run_sha256: `c5a595e32835f7bc5ce2154b94ad41bb912547300e4555c3d043f48bef685734`
- finding_registry_sha256: `49ffa45551ca5821ddee8715aff524edd127cc43d592e06471293c9143fa25c8`
- successor_task_id: `INTL-LAUNCH-CORE-DOCS-005`
- successor_target_commit_sha: `e7a7fd0811257cb34dd3b55f3453542d97e73df5`
- next_review_request: `FABLE_RECHECK`
