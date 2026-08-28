# P1-1-ACL-SUPPORT-SOURCE-001 공동 작업 장부

> P1-1 r003의 비차단 Improvement로 남은 실제 DB 감사 지원 시험과 verify
> 연결 소스를 확정 commit에서 봉인하고 독립적으로 검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `36fec6710762cfc9543486316e062e8173be6712`
- artifact_hashes: `[{ path: packages/db/scripts/admin-acl-audit.test.mjs, sha256: f84f6861dcee407d77e796e2cd10598c8f2d5fa447e397f66c22545ad82c07c4, change_type: ADDED }, { path: scripts/verify.mjs, sha256: ba7f51631ac4e4bfab42932a40ca3b534b59f6bed42a97040072507f32baf466, change_type: MODIFIED }]`
- changed_artifact_paths: `packages/db/scripts/admin-acl-audit.test.mjs`, `scripts/verify.mjs`
- 근거 Finding: `P1-1-SEC-SUPPORT-TEST-UNSEALED` Improvement / OPEN (`P1-1-REMOTE-ACL-AUDIT-001` r003)
- 충족해야 할 요구사항: 지원 시험의 16개 metric 정확 집합, rollback probe 부재, 모바일 RPC↔SQL allowlist 양방향 대조와 verify 실행 연결을 소스로 확인한다.
- 집중 검토 질문: 시험이 SQL 문법만 실행하고 실제 사후조건을 놓치지 않는가? AST 대조가 문자열이나 주석을 오인하지 않는가? verify가 실제 fresh DB에서 이 시험을 실행하는가?
- 현재 증거: 개발 DB와 fresh DB에서 metric 16개·모바일 RPC 61개·비-mobile 예외 1개 대조 통과. 전체 `pnpm verify` 6/6 통과.
- 사람 결정 유지: 원장 직접 쓰기 32건과 미승인 RPC 87건 축소는 별도 P0-5 R3이며 이 소스 검수에 섮지 않는다.
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=502bcade722c2d0461e2c799eab26f0db03b761858486694bab3ffe6811dcb10 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `502bcade722c2d0461e2c799eab26f0db03b761858486694bab3ffe6811dcb10`
- target_commit_sha: `36fec6710762cfc9543486316e062e8173be6712`
- input_files_sha256: `9b948617dcff73b01fbef1c22139de19a2569708bfe5c28eda3324b6457e6016`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED, P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED, P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED
- 선택 미종결 Finding: P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P1-1 지원 시험 소스(admin-acl-audit.test.mjs)와 verify ④ 연결을 독립 검수했다. 확인된 것: (1) verify.mjs ④는 일회용 fresh DB 이름을 argv로 지원 시험에 실제 전달하고, 실패는 ok=false→failed++→exit 1로 전파되며 건너뛰지 않는다. (2) 시험은 16개 metric의 정확 집합·중복·미지 metric·expected 설명을 검사하고, 별도 세션에서 to_regclass로 프로브 부재를 확인한다. (3) 모바일 .rpc 리터럴 61개와 SQL 허용 목록 62개(create_store 비-mobile 예외 1개 제외)를 grep으로 독립 재계수해 양방향 일치를 확인했다. 미해결: (A) Major — 시험이 16개 metric 중 probe_owner·facade_rpc_missing 2개만 값을 단언한다. anon_rpc=0·blocked_internal_rpc=0·protected_writes=0·probe_dangerous=0·public_dangerous=0·rls_disabled_app_tables=0·source_schema_grants=0·supabase_admin_objects=0·protected_objects=6·blocked_internal_rpc_objects=11처럼 fresh DB가 이미 만족하는 사후조건이 봉인되지 않아, 새 migration이 anon EXECUTE나 보호 표 쓰기를 다시 열어도 verify ④가 초록이다. 이는 공동 장부의 집중 검토 질문 "SQL 문법만 실행하고 사후조건을 놓치지 않는가"에 대한 실질적 미충족이다. (B) Minor — AST 대조가 리터럴이 아닌 .rpc(name) 호출을 조용히 건너뛰어 양방향 일치 계약에 구멍이 있다(현재 코드에는 해당 호출 없음). (C) Minor — required_evidence 중 r003 review.md 원문과 allowlist 드리프트 사보타주 증거가 스냅샷에 없어 P1-1-SUPPORT-3 원문 대조와 실패 경로 실증을 검수할 수 없다. (D) Improvement — SQL 허용 목록을 정규식으로 추출하며 비-mobile 예외⊆허용 목록 검사가 없다. 실제 호스티드 audit와 32/87 부채 축소는 사람 결정대로 범위 밖이다.

### 공동 편집 제안 색인

- P1-1-SUPPORT-EDIT-METRIC-VALUES: ADD `packages/db/scripts/admin-acl-audit.test.mjs` · if (seen.get('facade_rpc_missing').value !== '0') fail(`허용 facade가 DB에 없습니다: ${seen.get('facade_rpc_missing').value}`); · 원문은 review.md 참조
- P1-1-SUPPORT-EDIT-DYNAMIC-RPC: REPLACE `packages/db/scripts/admin-acl-audit.test.mjs` · function mobileRpcNames() { · 원문은 review.md 참조
- P1-1-SUPPORT-EDIT-NONMOBILE-SUBSET: ADD `packages/db/scripts/admin-acl-audit.test.mjs` · const expectedMobileNames = new Set([...approvedNames].filter((name) => !nonMobileNames.has(name))); · 원문은 review.md 참조
- P1-1-SUPPORT-EDIT-VERIFY-COMMENT: REPLACE `scripts/verify.mjs` ·        * 실패시키는 별도 보안 부채이고, 여기서는 metric 완전성·rollback·모바일 허용 목록 · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- finding_ids: `P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED`, `P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED`, `P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION`
- disposition: `APPLIED`
- 적용 내용: fresh DB의 10개 보안 사후조건을 정확한 값으로 단언하고 migrations는 0 또는 2만 허용했다. 기존 P0-5 부채는 `ledger_write_paths<=32`, `unapproved_authenticated_rpc<=87`로 증가만 차단하고 축소는 허용한다. 동적 `.rpc(name)`은 파일·줄과 함께 실패시키며 치환 없는 템플릿 리터럴은 수집한다. 비-mobile 예외는 허용 목록의 부분집합이어야 하고 허용 시그니처 0건·잘못된 컨테이너 이름도 실패한다.
- 증거 보강: r003 Improvement 원문은 predecessor review 경로에 보존되어 있고, 이번 공동 장부에 실패 경로 사보타주와 전체 verify 결과를 연결한다.
- 사람 결정 유지: 실제 호스티드 audit와 32/87 권한 축소는 별도 P0-5 R3 승인 범위다. 이번 변경은 회귀가 부채를 늘리지 못하게 봉인할 뿐 권한을 자동 변경하지 않는다.
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED`, `P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED`, `P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED`, `P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION`
- 실제 DB 사보타주: fresh DB에서 `close_business_day(uuid)` 실행 권한을 authenticated에 열면 `blocked_internal_rpc=1`, 임의 public 함수를 anon에 열면 `anon_rpc=1`, 임의 함수를 authenticated에 열어 부채를 88로 늘리면 `unapproved_authenticated_rpc=88 ceiling=87`로 각각 exit 1. 모두 제거 뒤 기준선 16 metric·61 mobile RPC·1 exception 통과.
- AST 사보타주: `supabase.rpc(rpcName)` 임시 소스는 파일·줄과 함께 실패했고, 치환 없는 템플릿 리터럴은 정상 수집됐다. SQL에서 `rls_disabled_app_tables` metric 제거, metric 중복, rollback을 commit으로 교체하면 각각 누락·중복·잔존 probe로 실패했다.
- 허용 목록 사보타주: `business_day_state` 제거는 모바일 호출 누락으로, 앱에서 쓰지 않는 `assert_my_store` 추가는 미사용 허용 RPC로, 비-mobile 예외에 허용 목록 밖 이름 추가는 부분집합 위반으로 각각 exit 1 했다.
- 복구 검증: `admin-acl-audit.sql` SHA-256은 `c47665cab7ef141855879c6200f33b2b701a65f78a7e95e14be34c7b1e86aaa4`, `_acl_probe_postgres` 없음, `fresh_*` DB 0개, `git diff --check` 통과.
- 최종 전체 검증: `corepack pnpm verify` exit 0. ① 타입 ② DB 32/32·core 177(2 skip)·mobile 189 ③ ACL 보안 ④ 새 DB 32/32+감사 값 단언+2세션 경합+locale parity ⑤ 업그레이드 8/8 ⑥ 웹 번들 전부 통과. 로그에는 `VERIFY_EXIT=0`이 기록됐다.
- 보안 관측값: `rls_disabled_app_tables=0`, `ledger_write_paths=32`, `unapproved_authenticated_rpc=87`. 이번 시험은 32/87 증가를 차단하며 축소는 허용한다.
- 비밀정보·제외: 원격 자격증명을 사용하지 않았다. `.claude/settings.json`과 미추적 채팅 정리 문서는 변경·스테이징·검증 근거에서 제외했다.
- next_review_request: `FABLE_RECHECK`
