# P2-6-ACL-AUDIT-EVIDENCE-003 공동 작업 장부

> `P2-6-ACL-AUDIT-EVIDENCE-002` r001의 필수 Finding 3건을 같은 ID로 승계해 수정 commit을
> Fable SECURITY 역할이 재검증하는 append-only 장부다. predecessor 기록은 고치거나 지우지 않는다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-o001`
- target_commit_sha: `beefc06025126f210a61b56ece492a3e55c8f1b5`
- changed_artifact_paths: `packages/db/scripts/admin-acl-source-scan.mjs`, `packages/db/scripts/admin-acl-source-scan.test.mjs`, `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 충족해야 할 요구사항·불변식: predecessor의 `P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION`, `P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE`, `P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING`을 같은 ID로 재검증하고 해결된 경우에만 VERIFIED로 반환한다.
- 이번에 바꾼 내용: StringLiteralLike `rpc` 구조 분해 속성명과 별칭 계산 키 우회를 실패 폐쇄했다. bracket literal·함수 별칭·비리터럴·spread·빈 루트까지 소스 스캔 시험을 13개로 늘렸다. 최종 Git blob OID·blob SHA-256, P0-5 전환, verify 원문을 증거에 결속했다.
- 집중 검토 질문: 세 Finding의 원래 재현 경로가 모두 닫혔는가? 일반 객체 계산 키 오탐은 없는가? 증거 표의 네 blob과 실행 원문이 target commit에서 재현되는가?
- 실행한 테스트·현재 증거: 소스 스캔 13/13, 실제 DB 감사 metric 21·모바일 RPC 62·비-mobile 2, `corepack pnpm verify` 6/6. DB 34/34·경합·locale parity·업그레이드 10/10·웹 번들, `fresh_%` 0개.
- 사람 결정: 2026-08-30 successor Fable 재검수 한 번을 최대 `$3.00` 상한으로 승인했다.
- task_budget_usd_approved: `3.00`
- next_review_request: `FABLE_RECHECK`

<!-- fable-review:r001 sha256=8cbc06cbeac3b7c8bd00452a559e00059d886770e36e187a94caf2b4f632bdf9 -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `8cbc06cbeac3b7c8bd00452a559e00059d886770e36e187a94caf2b4f632bdf9`
- target_commit_sha: `beefc06025126f210a61b56ece492a3e55c8f1b5`
- input_files_sha256: `7ff41214d5aed5660bc04173a9b330c0745352ae14011233cca38d5edb550d4a`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: P2-6-SEC-004-EVIDENCE-COMMIT-REF-AND-VERBATIM-BLOCK
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P2-6 successor RECHECK(SECURITY 경로, target beefc060). predecessor 필수 Finding 3건을 같은 ID로 재검증했고 모두 VERIFIED다. (SEC-001) admin-acl-source-scan.mjs 67행이 BindingElement propertyName의 StringLiteralLike 'rpc'를 dynamic으로 잡고, 87-92행이 값 위치의 'rpc' 문자열(`const key = 'rpc'`, `Reflect.get(x,'rpc')`)을 실패 폐쇄하되 ElementAccess argumentExpression·BindingElement propertyName은 중복 보고에서 제외한다. `const sb = supabase; sb[key]('x')`는 객체 이름 정규식과 무관하게 문자열 규칙으로 닫히고, `handlers[key]()` 무오인 시험(85-91)은 유지된다. (SEC-002) 시험 파일이 13개(문자열 속성명 구조 분해·별칭 계산 키·bracket literal·.rpc 함수 별칭·비리터럴 인자·spread 인자·빈 루트 포함)로 늘었고 verify.mjs 112행의 ③ 단계에서 Docker 없이 실행된다. (SEC-003) 증거 문서 108-113행의 네 파일 Git blob OID(38a74b1e·08532d91·9b19ce30·aed306cd)와 blob SHA-256(5db66c64·c58d3d5c·e926b252·ed096d04)이 봉인 input_files와 정확히 일치하고, 104-106행이 LF blob 기준임을 명시하며, 115-117행이 32/87→0/0 전환을 P0-5 최소 권한 폐쇄와 test.mjs 171-175 0 고정 계약으로 연결하고, 132-144행이 verify 결과 블록을 verify.mjs 199-217 출력 형식 그대로 보존한다(③ 라벨 `CLI 계약 · ACL 보안` 일치). 실제 DB stdout 두 줄(125-126)은 test.mjs 177-178 형식과 일치한다. 작업큐 954-957의 r001·r002 budget_exhausted 기록은 보존됐고 verify 6단계도 유지된다. 새 Improvement 1건(비차단): 증거 표의 Finding 반영 commit이 7자 약식 `52a32b5`이고 target beefc060과 다른 commit이라 스냅샷만으로 commit 결속을 재현할 수 없으며, verify 원문 블록 안의 `fresh_db_count=0`은 verify.mjs가 출력하지 않는 별도 쿼리 값이라 "실행기 원문"과 섞여 있다. blob OID 대조는 성립하므로 판정을 막지 않는다. 잔여 위험으로 `sb['r'+'pc']`처럼 문자열 연결로 만든 계산 키는 정적 스캐너가 원리상 잡지 못하며, 이는 P1-1-SUPPORT-003에서 이미 수용한 잔여 우회 범주다. 호스티드 원격 ACL 적용·운영 배포는 범위 밖이다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 남는다.

### 공동 편집 제안 색인

- P2-6-SEC-E006-EVIDENCE-FULL-COMMIT-AND-SPLIT-BLOCK: COMMENT `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md` · | P2-6 Finding 반영 | `52a32b5` | `38a74b1ef1e2dcf48b046e1250bf112bb915039a` | · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `8cbc06cbeac3b7c8bd00452a559e00059d886770e36e187a94caf2b4f632bdf9`
- target_commit_sha: `7354c5a`
- changed_artifact_paths: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- resulting_input_files_sha256: `필수 Finding은 봉인 target beefc060에서 VERIFIED; 비차단 Improvement는 후속 문서 commit 7354c5a에 반영`

### P2-6-SEC-004-EVIDENCE-COMMIT-REF-AND-VERBATIM-BLOCK

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 적용 내용: Finding 반영 commit을 `52a32b5ef7037c66e92282dabf6e89c48b876d9c` 40자 SHA로 고정하고 Fable target `beefc06025126f210a61b56ece492a3e55c8f1b5`가 같은 네 blob을 포함하는 후속 commit임을 명시했다. verify 실행기 원문 블록에서 `fresh_db_count=0`을 분리해 별도 쿼리·별도 블록으로 기록했다.
- 실행한 테스트: `git merge-base --is-ancestor 52a32b5 beefc06` exit 0, 네 blob OID 대조, `git diff --check` 통과.
- 필요한 재검수: 비차단 Improvement이며 필수 Finding 3건의 PASS·VERIFIED 판정을 바꾸지 않는다. 다음 증거 감사 시 문서의 40자 SHA와 분리 블록을 대조한다.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `beefc06025126f210a61b56ece492a3e55c8f1b5`
- verified_input_files_sha256: `7ff41214d5aed5660bc04173a9b330c0745352ae14011233cca38d5edb550d4a`
- artifact_hashes: `target manifest와 증거 문서의 네 Git blob OID·blob SHA-256을 대조해 일치`
- finding_ids: `P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION`, `P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE`, `P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING`, `P2-6-SEC-004-EVIDENCE-COMMIT-REF-AND-VERBATIM-BLOCK`
- 실행 명령: `node packages/db/scripts/admin-acl-source-scan.test.mjs`; `node packages/db/scripts/admin-acl-audit.test.mjs postgres`; `corepack pnpm verify`; Git blob OID·SHA-256 대조.
- 종료 코드·결과: source scan 13/13, 실제 DB audit metric 21·모바일 RPC 62·비-mobile 2, 전체 verify 6/6 exit 0, DB 34/34, 업그레이드 10/10, 웹 번들 통과.
- 증거 파일·로그 위치: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`; Fable r001 review/run SHA `8cbc06cbeac3b7c8bd00452a559e00059d886770e36e187a94caf2b4f632bdf9` / `8279333079d19d7cf611e533a4824c3b491d20e8f9240d444ed3fd38dfd5f543`.
- 미실행 항목과 이유: 호스티드 원격 ACL 적용·운영 배포는 Task 범위 밖. `fresh_%` 일회용 DB는 0개.
- Fable 판정: PASS, predecessor 필수 Finding 3건 모두 같은 ID로 VERIFIED, 필수 미해결 0건. 비차단 Improvement는 후속 문서 commit `7354c5a`에 반영했다.
- next_review_request: `AI_DEPUTY_GATE_REVIEW`

## BACKLOG_DISPOSITION · turn-o001

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-f001`
- optional_finding_ids: `P2-6-SEC-004-EVIDENCE-COMMIT-REF-AND-VERBATIM-BLOCK`
- backlog_id: `P2-6-SEC-004-POST-PASS-EVIDENCE-CLEANUP`
- owner: `SOLAR-DB`
- 재검토 조건·시점: 제안된 문서 수정은 commit `7354c5a`에 즉시 반영했다. 다음 ACL 증거 감사에서 40자 commit과 분리된 fresh DB 쿼리 블록을 대조한다.
- 공식 산출물 반영 여부: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`에 반영 완료.
- review_state_effect: `NON_BLOCKING`

## AI_DEPUTY_GATE_DECISION · turn-o002

- role: `AI-DEPUTY-ORCHESTRATOR`
- reply_to_turn_id: `turn-c001`
- verified_review_sha256: `8cbc06cbeac3b7c8bd00452a559e00059d886770e36e187a94caf2b4f632bdf9`
- verified_run_sha256: `8279333079d19d7cf611e533a4824c3b491d20e8f9240d444ed3fd38dfd5f543`
- verified_input_files_sha256: `7ff41214d5aed5660bc04173a9b330c0745352ae14011233cca38d5edb550d4a`
- artifact_hashes: `target manifest와 evidence의 Git blob OID·SHA-256으로 봉인·대조`
- gate_anchor_commit_sha: `beefc06025126f210a61b56ece492a3e55c8f1b5`
- required_external_gate: `protected ref + required check on exact decision commit SHA`
- open_required_finding_ids: `[]`
- optional_finding_backlog_ids: `P2-6-SEC-004-POST-PASS-EVIDENCE-CLEANUP`
- Codex 실행 증거: `turn-c001`; verify 6/6·source scan 13/13·DB 34/34·upgrade 10/10·fresh DB 0개. Improvement는 commit 7354c5a에 반영.
- requested_outcome: `CLOSE`
- 종결 요청 또는 사람 이관 근거: 필수 Finding 3건이 모두 VERIFIED이고 Fable PASS다. 이 턴을 포함한 최종 feature SHA의 보호 원격 필수 체크가 성공한 뒤 main fast-forward로 종결한다.

> 이 턴 자체는 로컬 status를 닫지 않는다. 정확한 최종 decision commit의 보호 원격 체크와 main 반영이 외부 종결 증거다.
