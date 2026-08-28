
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
