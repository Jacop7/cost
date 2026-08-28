# P1-1-ACL-SUPPORT-SOURCE-002 공동 작업 장부

> 이전 지원 소스 검수 r001의 필수 Finding과 Improvement를 반영한 확정
> commit을 대상으로 보안 사후조건·실패 폐쇄·verify 연결을 재검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `d0051c17bb6f842e28b48813616114fefc50913c`
- artifact_hashes: `[{ path: packages/db/scripts/admin-acl-audit.test.mjs, sha256: 0596e56a314e6078445524a64544e5a4030719097c817c30e3daca4042b4ee21, change_type: MODIFIED }, { path: scripts/verify.mjs, sha256: 58c411764a58f195d439d2a92e5a4c56a329b49fda9140b1214fb01c49371ac7, change_type: MODIFIED }]`
- changed_artifact_paths: `packages/db/scripts/admin-acl-audit.test.mjs`, `scripts/verify.mjs`
- 근거 Finding: `P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED`, `P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED`, `P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION`
- 적용 요약: fresh DB 정확 값·부채 ceiling·migrations 계약, 동적 RPC 거부, 비-mobile 예외 부분집합, 컨테이너 이름 검증을 반영했다.
- 실행 증거: GRANT·RPC·allowlist·metric·rollback 사보타주가 모두 exit 1, 복구 후 `corepack pnpm verify` 6/6 exit 0, `fresh_*` 0개.
- 사람 결정 유지: 실제 호스티드 audit와 32/87 권한 축소는 별도 P0-5 R3이다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r002 sha256=1a1a22249c64b2a4ae4909c394c762f608b9daed3ce66f49ee1e30fee530c728 -->
## FABLE_REVIEW · turn-f002 · r002

- role: `FABLE-SEC`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `1a1a22249c64b2a4ae4909c394c762f608b9daed3ce66f49ee1e30fee530c728`
- target_commit_sha: `d0051c17bb6f842e28b48813616114fefc50913c`
- input_files_sha256: `38e700c6d86fde626eee328f824922d42ed8d59d1fbcf6fef41a5291df86b574`
- 원본 검수: [r002/review.md](./rounds/r002/review.md)
- 필수 미종결 Finding: P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED, P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS, P1-1-SUPPORT-002-RPC-SCAN-EVASION
- 선택 미종결 Finding: P1-1-SUPPORT-002-DEBT-VALUE-PARSING
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

보안 관점 초기 검수(INITIAL) 결과다. 소스 자체는 r001 지적을 대체로 충실히 반영했다. (1) P1-1-SUPPORT-1: EXPECTED_METRICS 16개가 SQL 출력·admin-acl.sh 필수 목록과 정확히 일치하고, 누락·중복·미지 metric·추가 열을 모두 실패시키며, fresh DB 사후조건 10개 값(rls_disabled_app_tables=0, protected_objects=6, blocked_internal_rpc_objects=11 등)과 probe_owner=postgres·facade_rpc_missing=0을 고정한다. (2) P1-1-SUPPORT-2: TypeScript AST로 `.rpc(` 첫 인자가 StringLiteral/NoSubstitutionTemplateLiteral이 아니면 실패하고, 비-mobile 예외⊆허용 목록, (허용−예외)↔모바일 호출 양방향 차집합을 모두 실패 조건으로 둔다. (3) P1-1-SUPPORT-3: verify ④가 run.mjs 뒤·concurrency 앞에 지원 시험을 실제로 실행하고 ok 체인으로 실패를 전파하며 finally에서 DB를 정리한다. 컨테이너 이름·DB 식별자 정규식 검증으로 argv 주입도 막았다. (4) P1-1-SUPPORT-4: 부채 32/87을 ceiling으로만 두어 0 위장 없이 증가만 차단한다.

그러나 필수 증거가 스냅샷에 없다. 패킷이 evidence_paths로 선언한 r001 review.md·collaboration.md·REMOTE-ACL-AUDIT r003 review.md 세 파일이 input_files·매니페스트·스냅샷 어디에도 실체화되지 않았고, required_evidence의 사보타주 exit 1 증거·verify 6/6·fresh_* 0개 증거도 공동 장부의 한 줄 주장 외에는 없다. 불변식 P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED가 이번 라운드에도 재현된 것이므로 Major로 연다. 그 밖에 migrations 0/2 계약이 '장부는 있으나 0166·0167이 빠진 DB'를 0으로 통과시키는 점(Minor), `client['rpc'](x)` 요소 접근·별칭 호출이 동적 RPC 거부를 우회하고 스캔 루트가 `apps/mobile/src`의 .ts/.tsx로만 고정된 점(Minor), 부채 값 파싱이 Number() 기반이라 정수 정규식으로 엄격화할 여지(Improvement)를 기록했다. 세 Minor/Major는 proposed_edits로 구체 수정안을 제시했다. 실제 호스티드 audit와 32/87 축소는 사람 결정대로 별도 P0-5 R3 범위로 유지한다.

### 공동 편집 제안 색인

- P1-1-SUPPORT-002-EDIT-MIGRATIONS-LEDGER: REPLACE `packages/db/scripts/admin-acl-audit.test.mjs` · // psql fresh harness는 CLI 장부가 없어 0, CLI로 구축한 DB는 둘 모두 적용돼 2다. · 원문은 review.md 참조
- P1-1-SUPPORT-002-EDIT-RPC-ELEMENT-ACCESS: COMMENT `packages/db/scripts/admin-acl-audit.test.mjs` ·         // StringLiteral과 NoSubstitutionTemplateLiteral만 허용한다. · 원문은 review.md 참조
- P1-1-SUPPORT-002-EDIT-DEBT-STRICT-PARSE: REPLACE `packages/db/scripts/admin-acl-audit.test.mjs` ·   const observed = Number(seen.get(metric).value); · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r002 -->

## SOLAR_RESPONSE · turn-s002 · r002

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f002`
- finding_ids: `P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS`, `P1-1-SUPPORT-002-RPC-SCAN-EVASION`, `P1-1-SUPPORT-002-DEBT-VALUE-PARSING`
- disposition: `APPLIED`
- 적용 내용: 마이그레이션 장부 존재 여부를 별도 질의해 장부가 없으면 0, 있으면 2만 허용한다. 모바일 스캔을 `src`와 expo-router `app` 전체 및 TS/JS 계열로 확장하고, 소스 0개·요소 접근 RPC·RPC 별칭을 모두 실패시킨다. 부채 값은 숫자 문자열만 허용한다.
- 증거 실체화: task 제어 경로는 실행기가 의도적으로 입력에서 제외하므로, 원문 경로·SHA와 사보타주 명령·exit·핵심 출력·최종 verify를 `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`에 독립 증거로 고정했다. 다음 commit 검수에서 EVIDENCE 역할로 포함한다.
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c002 · r002

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS`, `P1-1-SUPPORT-002-RPC-SCAN-EVASION`, `P1-1-SUPPORT-002-DEBT-VALUE-PARSING`
- 사보타주: fresh DB에 빈 `supabase_migrations.schema_migrations`를 만들면 `관측=0 장부=present 기대=2`로 exit 1. 임시 `client['rpc'](...)`와 `const callRpc=client.rpc`는 각각 파일·줄로 exit 1. `ledger_write_paths` 빈 값은 `정수가 아닙니다`로 exit 1.
- 복구: fresh DB 기준 16 metric·모바일 RPC 61·비-mobile 예외 1 통과. audit SQL SHA-256 `c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4`, 프로브 없음, fresh DB 0개.
- 최종 전체 검증: `corepack pnpm verify` exit 0. 타입, DB 32/32·core 177(2 skip)·mobile 189, ACL 보안, 새 DB+감사+경합+parity, 업그레이드 8/8, 웹 번들 6단계 전부 통과.
- next_review_request: `FABLE_RECHECK`
