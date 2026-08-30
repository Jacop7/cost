# P2-6-ACL-AUDIT-EVIDENCE-002 공동 작업 장부

> 동일 판본의 앞선 검수 두 회차는 구조화 결과 없이 회차 상한에서 실패했다. 원본은 001 Task에
> 보존하고, 사람의 추가 호출 승인에 따라 입력 범위를 제품·시험·증거 파일로 좁혀 다시 검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `513686b86c915ebc4a6d6c78a57237cdfbb08a6f`
- changed_artifact_paths: `packages/db/scripts/admin-acl-source-scan.mjs`, `packages/db/scripts/admin-acl-source-scan.test.mjs`, `packages/db/scripts/admin-acl-audit.test.mjs`, `packages/db/scripts/admin-acl-audit.sql`, `scripts/verify.mjs`, `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 충족해야 할 요구사항·불변식: RPC 소스 우회 실패 폐쇄, 필수 루트 누락 진단, DB 인식 허용 목록, 실행 증거 판본 결속.
- 집중 검토 질문: 요구사항별 남은 우회·오탐, rollback·metric 계약 약화, 증거의 원문성과 재현성.
- 실행한 테스트·현재 증거: 로컬 verify 6/6과 원격 feature CI의 Node 20.19.4·24·full DB·protected gate 4개가 모두 성공했다.
- 사람 결정: 2026-08-30 추가 Fable 호출 한 번에 최대 `$3.00` 승인.
- next_review_request: `FABLE_REVIEW`


<!-- fable-review:r001 sha256=a801e4e7af621c9c16e74cad04284bf658fdfdf51c5d31977280b4efb1313a42 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `a801e4e7af621c9c16e74cad04284bf658fdfdf51c5d31977280b4efb1313a42`
- target_commit_sha: `513686b86c915ebc4a6d6c78a57237cdfbb08a6f`
- input_files_sha256: `7c4c11d315b2a5ed263021cd4e4b7c3570fe16be0f6c2e03d6cf9d6c54bf8dfd`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION, P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE, P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P2-6 보안 검수(SECURITY, target 513686b8). 요구사항 4건의 핵심은 충족됐다. (P2-6-1) 구조 분해 `{ rpc }`·`{ rpc: call }`, `client[key]`, `.rpc` 별칭 추출, 비리터럴 첫 인자가 모두 실패 폐쇄되고 `handlers[key]()`는 오인하지 않는다. (P2-6-2) 누락 루트를 경로와 함께 던진다. (P2-6-3) 허용 목록은 감사 SQL의 마지막 rollback 앞에 임시 표 export를 끼워 같은 트랜잭션의 실제 행으로 읽고, `comment_only_rpc` 주석 표식 미포함을 단언하며, SQL 값 64개=facade_rpc_objects 64=모바일 62+비-mobile 2로 정합한다. (P2-6-4) stdout 두 줄은 test.mjs 177-178의 출력 형식과 원문 일치하고, P2-6 blob OID 38a74b1e는 봉인 입력과 같으며, 작업큐 954-957은 r001·r002 budget_exhausted를 PASS로 합성하지 않았다. 남은 Minor 3건: ① `const { 'rpc': call } = client`처럼 문자열 리터럴 속성명 구조 분해는 isIdentifier 검사만 있어 통과하고, 계산 키 감지가 객체 식 텍스트의 supabase/client 정규식에 의존해 `const sb = supabase; sb[key](...)`가 우회된다. ② Docker 없는 회귀시험 6개에 `client['rpc']('x')`·`const call = client.rpc`·spread 인자 사례가 없어 V2 사보타주 표에만 존재한다. ③ 증거 문서의 admin-acl-audit.sql SHA-256(b66f7a47)이 봉인 blob의 SHA-256(ed096d04)과 다르고 blob OID가 없어 CRLF 설명을 스냅샷에서 재현할 수 없으며, 32/87→0/0 전환 근거(P0-5)와 P2-6 verify 원문 블록도 빠져 있다. 원격 ACL 적용·운영 배포는 범위 밖임을 확인했다.

### 공동 편집 제안 색인

- P2-6-SEC-E001-SCAN-STRING-PROPERTY-NAME: REPLACE `packages/db/scripts/admin-acl-source-scan.mjs` ·         if (ts.isIdentifier(bound) && bound.text === 'rpc') dynamic.push(location(source, path, node)); · 원문은 review.md 참조
- P2-6-SEC-E002-SCAN-RPC-LITERAL-VALUE: ADD `packages/db/scripts/admin-acl-source-scan.mjs` ·       ts.forEachChild(node, visit); · 원문은 review.md 참조
- P2-6-SEC-E003-SCAN-TESTS: ADD `packages/db/scripts/admin-acl-source-scan.test.mjs` · ok('일반 객체의 계산 키 호출은 RPC로 오인하지 않는다', () => withFixture( · 원문은 review.md 참조
- P2-6-SEC-E004-EVIDENCE-BLOB-OIDS: ADD `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md` · | `packages/db/scripts/admin-acl-audit.sql` | `b66f7a474d958c73753b7f72537dc2bd75cdbe9399387562e4ba33058b1802ff` | · 원문은 review.md 참조
- P2-6-SEC-E005-EVIDENCE-VERIFY-VERBATIM: COMMENT `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md` · ⑥ 웹 번들을 모두 통과했다. 종료 코드는 0이고 `fresh_%` 일회용 DB는 남지 않았다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `a801e4e7af621c9c16e74cad04284bf658fdfdf51c5d31977280b4efb1313a42`
- target_commit_sha: `c148e3d`
- changed_artifact_paths: `admin-acl-source-scan.mjs`, `admin-acl-source-scan.test.mjs`, `P1-1-ACL-SUPPORT-SOURCE-002.md`
- resulting_input_files_sha256: `successor r001 manifest에서 실행기가 봉인·검증 예정`

### P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION

- disposition: `APPLIED`
- 적용 위치: `packages/db/scripts/admin-acl-source-scan.mjs`
- 적용 내용: StringLiteralLike `rpc` 구조 분해 속성명과 값 위치의 `rpc` 리터럴을 실패 폐쇄해 `const { 'rpc': call }` 및 `const sb = supabase; const key = 'rpc'; sb[key]()` 우회를 닫았다. 직접 `x['rpc']`와 구조 분해 속성명은 중복 위치 보고에서 제외했다.
- 실행한 테스트: 문자열 속성명 구조 분해와 별칭 계산 키 회귀시험이 각각 실패 경로를 확인하고 전체 스캐너 13/13 통과.
- 필요한 재검수: 두 우회가 실패하고 일반 `handlers[key]()`는 오인하지 않는지 확인.

### P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE

- disposition: `APPLIED`
- 적용 위치: `packages/db/scripts/admin-acl-source-scan.test.mjs`
- 적용 내용: bracket 리터럴, `.rpc` 함수 별칭, 비리터럴 첫 인자, spread 인자, 빈 소스 루트와 Finding 001의 두 우회를 추가해 6개에서 13개로 늘렸다.
- 실행한 테스트: `node packages/db/scripts/admin-acl-source-scan.test.mjs` 13/13, verify ③에서 같은 13/13 실행.
- 필요한 재검수: 요구된 다섯 경로와 총계 출력·verify 연결 확인.

### P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING

- disposition: `APPLIED`
- 적용 위치: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 적용 내용: Finding 반영 commit `52a32b5`의 네 파일 Git blob OID와 blob bytes 기준 SHA-256을 기록하고 CRLF 작업 트리 해시가 아님을 명시했다. V2 32/87에서 P0-5 뒤 0/0으로 바뀐 근거와 `corepack pnpm verify` 최종 출력 원문, exit 0, fresh DB 0개를 추가했다.
- 실행한 테스트: blob OID·SHA-256을 `git rev-parse`·`git show` bytes로 재계산, 전체 verify 6/6, DB 34/34, 업그레이드 10/10, fresh 0.
- 필요한 재검수: 표의 OID·SHA와 target blob, 원문 블록, P0-5 연결 확인.

- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- verified_commit_sha: `c148e3d`
- finding_ids: `P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION`, `P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE`, `P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING`
- focused_contracts: 문자열 속성명 구조 분해·별칭 계산 키·bracket 리터럴·함수 별칭·비리터럴 및 spread 인자·빈 루트 실패 폐쇄, 일반 handlers 계산 키 무오인, PostgreSQL 임시 표 허용목록과 주석 표식 배제.
- full_gate: `corepack pnpm verify` 6/6 exit 0. DB 34/34, source scan 13/13, 실제 DB audit metric 21·모바일 RPC 62·비-mobile 2, 2세션 경합, locale parity, 업그레이드 10/10, 웹 번들 포함.
- audit_integrity: 네 파일의 Git blob OID·blob SHA-256과 실제 audit stdout·verify 원문을 증거 문서에 결속했다. r001 CHANGES_REQUIRED와 앞선 budget_exhausted 두 회차는 수정·삭제하지 않았다.
- cleanup: `fresh_%` DB 0개, 사용자 화면·프로토타입 변경은 스테이징·커밋하지 않았다.
- remaining_required_finding_ids: `P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION`, `P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE`, `P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING`
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `P2-6-ACL-AUDIT-EVIDENCE-002`
- predecessor_round: `r001`
- predecessor_task_sha256: `18c582a1370fddb20771b42cd424667a5ba43b4a27e7c30d5115474fab18df93`
- predecessor_manifest_sha256: `2563cd6ad67f5c02188e5af08fc1c68b24dfa80b11ef4d6db101afe17001c791`
- predecessor_review_sha256: `a801e4e7af621c9c16e74cad04284bf658fdfdf51c5d31977280b4efb1313a42`
- predecessor_run_sha256: `c3f5adf01e0964c0630fd40aaf0ddc4ffbd0281bd3c3aad6d2ef165fe6ace96f`
- finding_registry_sha256: `e0c416ee8fada01ce0c8a766915e9e34ee9101617009e3364278f9508fb279ec`
- successor_task_id: `P2-6-ACL-AUDIT-EVIDENCE-003`
- successor_target_commit_sha: `beefc06025126f210a61b56ece492a3e55c8f1b5`
- next_review_request: `FABLE_RECHECK`
