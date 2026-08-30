
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
