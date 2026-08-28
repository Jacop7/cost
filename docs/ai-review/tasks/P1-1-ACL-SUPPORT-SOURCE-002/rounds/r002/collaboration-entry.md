
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
