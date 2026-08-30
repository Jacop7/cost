# P2-6-ACL-AUDIT-EVIDENCE-003 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `beefc06025126f210a61b56ece492a3e55c8f1b5`

## 요약

P2-6 successor RECHECK(SECURITY 경로, target beefc060). predecessor 필수 Finding 3건을 같은 ID로 재검증했고 모두 VERIFIED다. (SEC-001) admin-acl-source-scan.mjs 67행이 BindingElement propertyName의 StringLiteralLike 'rpc'를 dynamic으로 잡고, 87-92행이 값 위치의 'rpc' 문자열(`const key = 'rpc'`, `Reflect.get(x,'rpc')`)을 실패 폐쇄하되 ElementAccess argumentExpression·BindingElement propertyName은 중복 보고에서 제외한다. `const sb = supabase; sb[key]('x')`는 객체 이름 정규식과 무관하게 문자열 규칙으로 닫히고, `handlers[key]()` 무오인 시험(85-91)은 유지된다. (SEC-002) 시험 파일이 13개(문자열 속성명 구조 분해·별칭 계산 키·bracket literal·.rpc 함수 별칭·비리터럴 인자·spread 인자·빈 루트 포함)로 늘었고 verify.mjs 112행의 ③ 단계에서 Docker 없이 실행된다. (SEC-003) 증거 문서 108-113행의 네 파일 Git blob OID(38a74b1e·08532d91·9b19ce30·aed306cd)와 blob SHA-256(5db66c64·c58d3d5c·e926b252·ed096d04)이 봉인 input_files와 정확히 일치하고, 104-106행이 LF blob 기준임을 명시하며, 115-117행이 32/87→0/0 전환을 P0-5 최소 권한 폐쇄와 test.mjs 171-175 0 고정 계약으로 연결하고, 132-144행이 verify 결과 블록을 verify.mjs 199-217 출력 형식 그대로 보존한다(③ 라벨 `CLI 계약 · ACL 보안` 일치). 실제 DB stdout 두 줄(125-126)은 test.mjs 177-178 형식과 일치한다. 작업큐 954-957의 r001·r002 budget_exhausted 기록은 보존됐고 verify 6단계도 유지된다. 새 Improvement 1건(비차단): 증거 표의 Finding 반영 commit이 7자 약식 `52a32b5`이고 target beefc060과 다른 commit이라 스냅샷만으로 commit 결속을 재현할 수 없으며, verify 원문 블록 안의 `fresh_db_count=0`은 verify.mjs가 출력하지 않는 별도 쿼리 값이라 "실행기 원문"과 섞여 있다. blob OID 대조는 성립하므로 판정을 막지 않는다. 잔여 위험으로 `sb['r'+'pc']`처럼 문자열 연결로 만든 계산 키는 정적 스캐너가 원리상 잡지 못하며, 이는 P1-1-SUPPORT-003에서 이미 수용한 잔여 우회 범주다. 호스티드 원격 ACL 적용·운영 배포는 범위 밖이다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 남는다.

## Findings

### P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION — Minor / VERIFIED

- 범주: SECURITY
- 검증 엔진: FABLE
- 영향: 세 수용 기준이 모두 충족돼 문자열 리터럴 속성명 구조 분해와 별칭 변수 계산 키 우회가 닫혔다. 문자열 연결로 만든 키(`sb['r'+'pc']`)는 정적 스캐너의 원리적 잔여 범주로 남는다.
- 근거: packages/db/scripts/admin-acl-source-scan.mjs:65, packages/db/scripts/admin-acl-source-scan.mjs:85, packages/db/scripts/admin-acl-source-scan.test.mjs:61, packages/db/scripts/admin-acl-source-scan.test.mjs:85
- 완료 조건: BindingElement 검사에서 propertyName이 StringLiteralLike 'rpc'인 경우도 dynamic으로 처리한다. / 값 위치의 문자열 리터럴 'rpc'(예: `const key = 'rpc'`, `Reflect.get(x, 'rpc')`)를 대조 불가로 실패 폐쇄하되, 이미 처리한 `x['rpc']` argumentExpression은 중복 보고하지 않는다. / admin-acl-source-scan.test.mjs에 위 두 사례의 실패 회귀시험을 추가하고 기존 `handlers[key]()` 무오인 시험은 유지한다.
- 필요한 테스트: `const { 'rpc': call } = client; call('business_day_state');` → 리터럴이 아닌 .rpc 이름 오류 / `const sb = supabase; const key = 'rpc'; sb[key]('business_day_state');` → 리터럴이 아닌 .rpc 이름 오류 / `const key = 'save'; handlers[key](); client.rpc('get_settings');` → get_settings만 수집

### P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE — Minor / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: 스캐너 리팩터링 시 bracket 리터럴·별칭 추출·비리터럴/spread 인자·빈 루트 실패 폐쇄 회귀가 verify ③과 --no-db CI에서 감지된다.
- 근거: packages/db/scripts/admin-acl-source-scan.test.mjs:69, packages/db/scripts/admin-acl-source-scan.test.mjs:97, packages/db/scripts/admin-acl-source-scan.test.mjs:42, scripts/verify.mjs:109
- 완료 조건: admin-acl-source-scan.test.mjs에 `client['rpc']('x')`, `const call = client.rpc`, `client.rpc(...args)`/`client.rpc(name)`, 루트는 있으나 파일 0개 사례의 실패 회귀시험을 추가한다. / 시험 총계 출력이 실제 통과 수를 반영하고 verify ③에서 실행된다.
- 필요한 테스트: `client['rpc']('business_day_state')` → 리터럴이 아닌 .rpc 이름 오류 / `const call = client.rpc; call('business_day_state')` → 리터럴이 아닌 .rpc 이름 오류 / `client.rpc(name)` → 리터럴이 아닌 .rpc 이름 오류 / src·app 디렉토리만 있고 소스 파일이 없을 때 → 모바일 소스를 하나도 찾지 못했습니다 오류

### P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING — Minor / VERIFIED

- 범주: DATA_INTEGRITY
- 검증 엔진: FABLE
- 영향: 봉인 스냅샷에서 감사 SQL을 포함한 네 파일의 blob OID·SHA-256을 되짚을 수 있고, 보안 기준선 32/87→0/0 전환 근거와 verify 원문이 문서에 결속됐다.
- 근거: docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:108, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:104, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:115, packages/db/scripts/admin-acl-audit.test.mjs:171, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:132
- 완료 조건: 판본 고정 표에 네 파일 모두의 Git blob OID를 기록하거나 최소 admin-acl-audit.sql·스캐너 두 파일의 blob OID를 추가한다. / SHA-256 표의 각 값이 LF blob 기준인지 CRLF 작업 트리 기준인지 파일별로 명시한다. / V2 32/87에서 P2-6 0/0으로 바뀐 근거(P0-5 최소 권한 폐쇄)를 한 문장으로 연결한다. / P2-6 `corepack pnpm verify` 검증 결과 블록을 V2와 같은 원문 형식으로 보존한다.
- 필요한 테스트: 증거 표의 blob OID가 target commit의 `git ls-tree` 값과 일치 / 증거 표의 SHA-256이 명시된 기준(blob 또는 작업 트리)으로 재계산 시 일치

### P2-6-SEC-004-EVIDENCE-COMMIT-REF-AND-VERBATIM-BLOCK — Improvement / OPEN

- 범주: DATA_INTEGRITY
- 영향: blob OID 대조가 성립해 판정을 막지 않지만, 약식 commit과 혼합 원문 블록은 장기 재현성과 P1-1-BINDING-005의 원문성 관례를 약화한다.
- 근거: docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:102, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:129, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:143, scripts/verify.mjs:199
- 완료 조건: 판본 고정 표의 Finding 반영 commit을 40자 SHA로 적고 target beefc060…과의 관계(같은 blob을 포함하는 후속 commit 등)를 한 줄로 명시한다. / verify 원문 블록에는 실행기 출력과 호출 셸이 남긴 VERIFY_EXIT까지만 두고, `fresh_db_count=0`은 별도 쿼리 결과로 블록 밖 또는 별도 코드 블록에 분리한다.
- 필요한 테스트: 증거 표의 40자 commit SHA에서 `git ls-tree`로 네 blob OID가 재현됨

## 공동 편집 제안

### P2-6-SEC-E006-EVIDENCE-FULL-COMMIT-AND-SPLIT-BLOCK — COMMENT

- 대상: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 위치: | P2-6 Finding 반영 | `52a32b5` | `38a74b1ef1e2dcf48b046e1250bf112bb915039a` |
- 연결 Finding: P2-6-SEC-004-EVIDENCE-COMMIT-REF-AND-VERBATIM-BLOCK
- 이유: 약식 commit과 혼합 원문 블록을 분리해 장기 재현성과 원문성을 맞춘다. 비차단 개선 제안이다.

    ① 이 행과 108행 표 머리글의 `52a32b5`를 40자 commit SHA로 바꾸고, 검수 target `beefc06025126f210a61b56ece492a3e55c8f1b5`가 같은 네 blob을 포함하는 후속 commit임을 한 줄로 적어 달라(`git ls-tree beefc060 -- packages/db/scripts/...`로 동일 OID 재현). ② 132-144행 코드 블록에서 `fresh_db_count=0` 줄을 빼고, 블록 뒤에 `select count(*) from pg_database where datname like 'fresh_%';` 결과 `0`을 별도 코드 블록으로 두어 실행기 원문과 별도 쿼리 결과를 분리해 달라. 값 자체는 작성자가 실제 실행 결과로 재확인해야 한다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
