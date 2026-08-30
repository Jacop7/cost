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
