# INTL-1B-IMPLEMENTATION-001 공동 작업 장부

> 이 장부는 국제 출시 1B의 시장·세금 프로필, 판매 시점 세금 snapshot·append-only 이벤트 schema와
> 회귀시험·공식 문서를 솔라와 페이블이 함께 개선하는 append-only 기록이다. 직접 편집은 이 최초
> 패킷 작성까지만이며 이후 턴은 `corepack pnpm fable:append` 또는 검수 실행기로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- artifact_hashes: 실행기의 manifest와 WORKING snapshot이 정확한 파일별 SHA-256을 봉인한다.
- changed_artifact_paths: `task.json`의 `artifact_paths` 11개 파일
- 충족해야 할 요구사항·불변식: `INTL-1B-001..008`, DB RPC 계산 권위, 시점 보존, 전진 migration, RPC 최소 권한
- 이번에 바꾼 내용: 0179로 시장·세금 프로필, 구성 항목, 과세 카테고리·메뉴 override, 항목×판매 채널 납부 주체, 판매 계산선·구성 항목 snapshot과 append-only 세금 이벤트 표를 추가했다. 원본 프로필·구성 항목 경계를 trigger로 검증하고 새 표의 앱 롤 직접 권한을 닫았다. TypeScript 값 영역과 DB enum parity, DB 시험 38, ACL 원장 목록, 0178→0179 upgrade와 생성 타입을 함께 보강했다. 기존 한국 데이터와 0090 계산은 그대로이며 국제 capability도 비활성이다.
- 집중 검토 질문: 적용 구간·revision·교차 매장 경계가 후속 계산에서 갈릴 틈이 있는가? snapshot과 이벤트가 판매 시점 계산 입력·결과를 충분히 고정하며 조작 가능한 우회로가 없는가? 새 표의 ACL·RLS·trigger가 최소 권한과 append-only를 실제로 지키는가? 0179가 기존 데이터와 계산을 변경하지 않는다는 시험이 판별력을 갖는가? TypeScript 계약과 DB 값 영역이 일치하는가?
- 실행한 테스트·현재 증거: `corepack pnpm verify` 6/6 — DB 38/38, core 183(4 skipped), mobile 212, 승인 RPC 66·미승인 0, 새 DB·2세션 경합·국제/locale DB↔TypeScript parity, upgrade 15/15, 웹 번들. 개발 DB도 공식 reset으로 0179까지 재구축하고 생성 타입을 갱신했다.
- 사람 결정이 필요한 항목: 실제 데이터 감사·이관은 INTL-1C, 계산·snapshot/event 쓰기는 INTL-1D, 앱 연결과 capability 활성화는 INTL-1E, 스테이징 cutover와 production 적용은 별도 사람 승인 범위다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=7d073b300b12971b70b638e1a3c5d407f9329db4845bd197e54a3ac8d603a47d -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-ARCH`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `7d073b300b12971b70b638e1a3c5d407f9329db4845bd197e54a3ac8d603a47d`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- input_files_sha256: `92e489beaf1c066ed289493fadb5854279465ba912a31cd8a349a194d10dce24`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: INTL1B-EVENTS-CASCADE-PURGE-CONFLICT, INTL1B-PROFILE-REVISION-MUTABILITY, INTL1B-TEST-CROSS-STORE-GAP
- 선택 미종결 Finding: INTL1B-MINORUNIT-DUAL-SOURCE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

0179 스키마는 INTL-1B 요구 구조를 충실히 구현했다. 시장·세금 프로필의 매장 경계(복합 FK id+store_id)·적용 구간 비중첩(advisory lock+trigger)·5개국 국가·통화·업무 로케일 조합 check, 기본세 1개 제약, 카테고리/override 배타 저장, 항목×채널 납부 주체, snapshot 원본 등식 guard, append-only 이벤트 원장, 앱 롤 직접 권한 0건과 capability 비활성, 0090 tax_of 불변 사후조건을 확인했다. DB enum 11종과 TypeScript 상수의 값·순서 parity, 시험 38, upgrade 시나리오 ⑮의 전후 불변 판별, ACL 감사의 원장 13종 목록 확장, RPC 허용 목록 66 불변, 문서의 게이트 미완 명시(INTL-1B-008 충족)도 확인했다. 그러나 두 가지 Major 틈이 있다. (1) sales_tax_events는 stores·daily_sales_items를 on delete cascade로 참조하는데 cascade 삭제도 행 단위 BEFORE DELETE 트리거를 발화시켜 42501로 중단되므로, 이벤트가 쌓인 뒤에는 공식 보존 정책 문인 purge_archived_store와 판매행 삭제 경로가 영구 실패할 수 있다. 공식 삭제 의미론을 스키마 단계에서 결정·시험해야 한다. (2) 프로필·구성 항목 내용을 revision 변경 없이 UPDATE하는 것을 막는 장치가 없어 (profile_id, revision)이 내용을 유일하게 식별하지 못하고, snapshot 원본 등식 guard와 INTL-1B-001/002의 revision 보존 주장이 무력화될 수 있다. 시장 프로필 기간 축소 시 내부 세금 프로필 재검증도 없다. 추가로 required_evidence가 약속한 교차 매장 차단을 시험 38이 직접 재지 않는 Minor TEST_GAP과, guard의 minor_unit 매핑(KRW=0, 그 외 2)이 LAUNCH_MARKETS.minorUnit과 이중 소스인데 parity 시험이 대조하지 않는 Improvement가 있다. 제안 편집 3건(내용 불변 guard, 삭제 의미론 결정 주석, 교차 매장 raises 시험)을 첨부했다.

### 공동 편집 제안 색인

- E1-PROFILE-VERSION-IMMUTABLE: ADD `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql` · for each row execute function public.guard_tax_profile_range(); · 원문은 review.md 참조
- E2-EVENTS-DELETE-SEMANTICS-DECISION: COMMENT `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql` · create trigger sales_tax_events_immutable_truncate · 원문은 review.md 참조
- E3-CROSS-STORE-RAISES: ADD `packages/db/tests/38_international_tax_schema.sql` · do $rls$ · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- changed_artifact_paths: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/db/tests/38_international_tax_schema.sql`, `packages/core/tests/internationalDbParity.test.ts`, `packages/db/README.md`, `docs/국가-통화-세금-국제출시-기획안.md`, `docs/작업큐.md`, `packages/db/src/database.types.ts`

### INTL1B-EVENTS-CASCADE-PURGE-CONFLICT

- disposition: `APPLIED`
- 적용 위치: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/db/tests/38_international_tax_schema.sql`, `packages/db/README.md`, `docs/국가-통화-세금-국제출시-기획안.md`
- 적용 내용: 일반 UPDATE·DELETE·TRUNCATE는 계속 42501로 거부하되, 기존 보존 정책의 유일한 공식 문인 `purge_archived_store`가 보존 종료·승인·백업을 확인하고 트랜잭션 로컬 `margincook.store_purge_id`를 설정한 같은 매장 cascade DELETE만 허용한다. 직접 판매행 삭제는 세금 이벤트가 있으면 실패하고, 취소·정정은 반대 부호/목표 차이 이벤트로 남긴다. 깨끗한 별도 매장에 실제 판매행·snapshot·구성 항목 snapshot·세금 이벤트를 만든 뒤 service role 공식 purge가 성공하고 `store_lifecycle_events` 물리 삭제 감사가 남는 시험을 추가했다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: 공식 purge와 직접 판매행 삭제가 서로 다른 결과를 내고 append-only 불변식과 매장 보존 정책이 함께 성립하는지.

### INTL1B-PROFILE-REVISION-MUTABILITY

- disposition: `APPLIED`
- 적용 위치: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/db/tests/38_international_tax_schema.sql`, `docs/국가-통화-세금-국제출시-기획안.md`
- 적용 내용: 시장·세금 프로필은 `effective_to` 마감 외 모든 내용 UPDATE를 거부하고 새 내용은 새 행·revision으로 만들도록 했다. 시장 프로필 마감이 하위 세금 프로필을 범위 밖에 남기면 거부한다. 세금 구성 항목은 표시용 `sort_order`만, 과세 카테고리는 표시 이름·활성 상태만 바꿀 수 있고 계산 의미는 불변이며, 채널 납부 주체 UPDATE는 전부 거부한다. 시험 38이 가격 기준·기본 과세·세율·카테고리 과세·납부 주체의 제자리 변경과 기간 이탈을 각각 실패 폐쇄하고 `sort_order` 양성 경로도 확인한다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: 같은 ID+revision의 계산 내용이 바뀌지 않고 마감 가능한 유일한 예외가 문서·시험과 일치하는지.

### INTL1B-TEST-CROSS-STORE-GAP

- disposition: `APPLIED`
- 적용 위치: `packages/db/tests/38_international_tax_schema.sql`
- 적용 내용: 실제 다른 소유자·매장의 시장/세금 프로필, 과세 카테고리, 구성 항목, 채널 납부 주체를 만든다. 외국 매장 프로필로 현재 매장 판매 snapshot을 만드는 경로와 다른 프로필의 카테고리를 현재 프로필 override에 붙이는 경로가 복합 FK·guard에서 거부됨을 판별한다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: fixture가 존재하지 않는 UUID가 아니라 실제 교차 매장·교차 프로필 참조를 사용하며 실패 SQLSTATE를 확인하는지.

### INTL1B-MINORUNIT-DUAL-SOURCE

- disposition: `APPLIED`
- 적용 위치: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/core/tests/internationalDbParity.test.ts`, `packages/db/src/database.types.ts`
- 적용 내용: 통화 소수 자릿수 매핑을 DB 함수 `international_currency_minor_unit` 한 곳으로 모으고 snapshot guard가 이 함수를 쓴다. 새 DB parity 시험은 DB enum 전 통화의 함수 결과를 TypeScript `LAUNCH_MARKETS.minorUnit`과 직접 대조한다. 함수는 앱 롤에서 회수하고 내부 executor·service role만 실행할 수 있다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: DB guard와 TypeScript metadata가 같은 실제 DB 함수 결과로 연결됐는지.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- finding_ids: `INTL1B-EVENTS-CASCADE-PURGE-CONFLICT`, `INTL1B-PROFILE-REVISION-MUTABILITY`, `INTL1B-TEST-CROSS-STORE-GAP`, `INTL1B-MINORUNIT-DUAL-SOURCE`
- 실행 명령: `node packages/db/tests/run.mjs 38`; `corepack pnpm db:reset`; `corepack pnpm db:types`; `corepack pnpm verify`; `git diff --check`; `docker exec supabase_db_margincook psql -U postgres -d postgres -At -c "select count(*) from pg_database where datname like ''fresh_%'';"`
- 종료 코드·결과: 모두 exit 0. 전체 verify 6/6 — DB 38/38, core 183 passed·4 skipped, mobile 212, CLI/ACL 보안, 새 DB 전체 migration·실제 2세션 경합·locale/국제 DB parity, upgrade 15/15, Metro 웹 번들. 업그레이드 ⑮은 0178→0179 뒤 기존 세금 계산·판매/재고 행 수·capability false와 새 국제 표 초기 0건을 확인했다. `fresh_%` 잔여 DB 0개, diff 오류 0건.
- Finding별 판별 증거: 시험 38이 (a) 세금 이벤트가 있는 판매행 직접 삭제 42501과 승인된 매장 purge 성공·lifecycle 감사 보존, (b) 같은 판본의 프로필/세율/카테고리/납부 주체 변경과 시장 기간 이탈 거부 및 sort_order 양성 경로, (c) 실제 다른 소유자·매장 프로필/카테고리 교차 참조 거부를 직접 실행한다. core parity는 실제 새 DB의 `international_currency_minor_unit` 결과를 TypeScript `LAUNCH_MARKETS.minorUnit`과 전 통화 대조한다.
- 증거 파일·로그 위치: `packages/db/tests/38_international_tax_schema.sql`, `packages/core/tests/internationalDbParity.test.ts`, `packages/db/scripts/upgrade-check.sh`, `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `docs/ai-review/tasks/INTL-1B-IMPLEMENTATION-001/rounds/r001/review.json`
- 미실행 항목과 이유: 스테이징·운영 적용과 capability 활성화는 INTL-1B 범위가 아니며 사람 승인 전 실행하지 않았다. 보호 CI는 작업 commit과 Fable 재검수 확정 뒤 정확한 SHA에서 실행한다.
- next_review_request: `FABLE_RECHECK`

## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c001`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- advisory_classification: `SEPARATE_OPUS_ADVISORY_NOT_FABLE`
- 공식 상태: Fable r002는 `TASK_CAP_APPROVAL_REQUIRED`로 `RUN_FAILED`이며 verdict가 없다. 아래 Opus 자문은 Fable 재검수·PASS·Finding VERIFIED를 대신하지 않고 공식 미종결 Finding 상태도 바꾸지 않는다.

### 별도 Opus 자문과 적용

- canonical Claude Code CLI의 `claude-opus-5`를 새 읽기 전용 세션(`Read/Grep/Glob`)으로 실행했다. 결과 본문은 생성됐지만 두 CLI 호출 모두 설정한 사용 상한에서 종료됐으며, 로컬 세션 원본에서 완성된 자문을 회수했다. 이는 protocol successor가 아닌 사용자가 요청한 별도 보조 검토다.
- Opus가 새로 지적한 필수 보완 세 건을 적용했다.
  1. 수량 0 정정은 판매행을 삭제하지 않고 tombstone으로 보존하며, snapshot 금액을 0으로 만들고 반대 부호 세금 이벤트를 추가해 이벤트 합계를 0으로 만든다. 시험 38이 행·snapshot 보존과 이벤트 합계 0을 직접 잰다.
  2. `tax_region_catalog`는 `margincook_rpc_executor`에 SELECT만 허용한다. migration 사후조건과 시험 38이 INSERT/UPDATE/DELETE/TRUNCATE 직접 권한 0을 확인한다.
  3. 세금 이벤트와 두 snapshot 표의 소유자 TRUNCATE도 명시적 statement trigger로 42501 거부한다. 시험 38이 owner 직접 TRUNCATE를 실행해 차단을 확인한다.
- 후속 계산 단계에 속하는 구성 항목 합계 DB 제약과 `reverses_event_id`의 같은 판매선 검증은 `INTL-1D`, TypeScript `StoreTaxProfile`의 국가·지역 파생 계약은 `INTL-1C`에 남겼다. INTL-1B schema-only 범위에서 계산·이관·앱 활성화를 앞당기지 않았다.

### 최신 실행 증거

- 실행 명령: `node packages/db/tests/run.mjs 38`; `corepack pnpm db:reset`; `corepack pnpm db:types`; `corepack pnpm verify`; `git diff --check`
- 결과: 모두 exit 0. 전체 verify 6/6 — DB 38/38, core 184 passed·4 skipped, mobile 212, CLI/ACL 보안, 새 DB 전체 migration·실제 2세션 경합·국제/locale parity, upgrade 15/15, Metro 웹 번들.
- 기존 0090 한국 세금 계산과 판매·재고 원장은 불변이며 국제 세금 capability는 `read=false`, `write=false`다. 스테이징·운영 적용은 하지 않았다.
- next_review_request: `FABLE_RECHECK`

## CODEX_EVIDENCE · turn-c003 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c002`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- advisory_classification: `SEPARATE_OPUS_ADVISORY_RECHECK_NOT_FABLE`
- 공식 상태: 이 턴은 사용자가 목요일 초기화 전까지 요청한 별도 Opus 보조 재검수 기록이다. Fable r002의 `RUN_FAILED`, 공식 미종결 Finding, gate OPEN 상태를 바꾸지 않으며 Fable PASS로 해석하지 않는다.

### Opus 재검수 결과

- engine/model: canonical Claude Code CLI · `claude-opus-5`
- execution: 기존 별도 자문 세션을 읽기 전용 `Read/Grep/Glob`으로 재개했으며 제품 파일 쓰기·웹 검색·하위 에이전트 호출은 없었다.
- terminal result: 정상 완료(`is_error=false`, `terminal_reason=completed`).
- advisory verdict: `PASS`.
- H1 수량 0/append-only: `VERIFIED` — 수량 0은 판매행·snapshot tombstone을 보존하고 금액을 0으로 만든 뒤 반대 부호 이벤트 합을 0으로 맞추는 계약과 실행 시험이 일치한다. 1B capability 비활성 상태에서 현행 판매행 삭제는 영향받지 않는다.
- M2 `tax_region_catalog` 권한: `VERIFIED` — 실행 역할은 SELECT만 가지며 migration 사후조건과 시험 38이 쓰기 권한 0을 확인한다.
- M3 owner TRUNCATE: `VERIFIED` — 이벤트와 두 snapshot 표의 statement trigger가 owner TRUNCATE를 42501로 거부하고 시험 38이 세 표를 실제 실행한다.
- 범위 판단: 구성 항목 합계 제약과 `reverses_event_id` 계약은 INTL-1D, TypeScript 프로필의 국가·지역 파생 계약과 미국·캐나다 지역 카탈로그 적재는 INTL-1C가 맞다.

### 후속 비차단 조건 반영

- `docs/작업큐.md`와 국제 출시 기획안에 미국·캐나다 지역 카탈로그 양성 경로, capability 쓰기 활성화 전 합계 제약, `reverses_event_id` 필수화/제거 결정, TypeScript 국가·지역 출처 확정을 각각 INTL-1C/1D 조건으로 명시했다.
- 신설 TRUNCATE trigger 존재를 migration 사후조건에서도 세는 것은 선택 보강이다. 시험 38이 owner 실행으로 동작을 직접 재므로 현재 INTL-1B 차단 사유로 올리지 않았다.
- 최신 로컬 검증은 직전 `turn-c002`와 동일하게 `pnpm verify` 6/6(DB 38/38, core 184·4 skipped, mobile 212, upgrade 15/15, 웹 번들)이고 `fresh_%` 잔여는 0개다.
- next_review_request: `FABLE_RECHECK_AFTER_RESET`

## CODEX_EVIDENCE · turn-c004 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c003`
- tested_commit_sha: `4bdce8541d42221198a48fc9a0c694fbde8c5aa3`
- branch: `codex/international-tax-schema`
- local_verification: `corepack pnpm verify` 6/6 — DB 38/38, core 184·4 skipped, mobile 212, 새 DB·경합·국제/locale parity, upgrade 15/15, 웹 번들.
- remote_verification: GitHub Actions run `33393774923`에서 Node 20.19.4·Node 24·`full-db-required`·`protected-gate` 모두 `success`.
- deployment_state: feature 브랜치만 push했다. `main` 병합, 스테이징·production 적용, 국제 세금 capability 활성화는 하지 않았다.
- review_state: 별도 Opus 보조 재검수 PASS는 기록했지만 공식 Fable r002 `RUN_FAILED`와 미종결 Finding 상태는 유지한다. 목요일 Fable 재개 시 이 commit을 대상으로 successor 재검수한다.
- next_review_request: `FABLE_SUCCESSOR_RECHECK_AFTER_RESET`
