# P2-6-ACL-AUDIT-EVIDENCE-002 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 모드: `SECURITY`
- 스냅샷: `COMMIT`
- 대상 SHA: `513686b86c915ebc4a6d6c78a57237cdfbb08a6f`

## 요약

P2-6 보안 검수(SECURITY, target 513686b8). 요구사항 4건의 핵심은 충족됐다. (P2-6-1) 구조 분해 `{ rpc }`·`{ rpc: call }`, `client[key]`, `.rpc` 별칭 추출, 비리터럴 첫 인자가 모두 실패 폐쇄되고 `handlers[key]()`는 오인하지 않는다. (P2-6-2) 누락 루트를 경로와 함께 던진다. (P2-6-3) 허용 목록은 감사 SQL의 마지막 rollback 앞에 임시 표 export를 끼워 같은 트랜잭션의 실제 행으로 읽고, `comment_only_rpc` 주석 표식 미포함을 단언하며, SQL 값 64개=facade_rpc_objects 64=모바일 62+비-mobile 2로 정합한다. (P2-6-4) stdout 두 줄은 test.mjs 177-178의 출력 형식과 원문 일치하고, P2-6 blob OID 38a74b1e는 봉인 입력과 같으며, 작업큐 954-957은 r001·r002 budget_exhausted를 PASS로 합성하지 않았다. 남은 Minor 3건: ① `const { 'rpc': call } = client`처럼 문자열 리터럴 속성명 구조 분해는 isIdentifier 검사만 있어 통과하고, 계산 키 감지가 객체 식 텍스트의 supabase/client 정규식에 의존해 `const sb = supabase; sb[key](...)`가 우회된다. ② Docker 없는 회귀시험 6개에 `client['rpc']('x')`·`const call = client.rpc`·spread 인자 사례가 없어 V2 사보타주 표에만 존재한다. ③ 증거 문서의 admin-acl-audit.sql SHA-256(b66f7a47)이 봉인 blob의 SHA-256(ed096d04)과 다르고 blob OID가 없어 CRLF 설명을 스냅샷에서 재현할 수 없으며, 32/87→0/0 전환 근거(P0-5)와 P2-6 verify 원문 블록도 빠져 있다. 원격 ACL 적용·운영 배포는 범위 밖임을 확인했다.

## Findings

### P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION — Minor / OPEN

- 범주: SECURITY
- 영향: 모바일 소스가 문자열 리터럴 속성명 구조 분해나 supabase/client가 아닌 이름의 별칭 변수로 rpc를 부르면 스캐너가 이름을 수집하지 못한 채 통과해, 허용 목록↔모바일 호출 양방향 일치 검증이 조용히 약화된다.
- 근거: packages/db/scripts/admin-acl-source-scan.mjs:65, packages/db/scripts/admin-acl-source-scan.mjs:18, packages/db/scripts/admin-acl-source-scan.mjs:56
- 완료 조건: BindingElement 검사에서 propertyName이 StringLiteralLike 'rpc'인 경우도 dynamic으로 처리한다. / 값 위치의 문자열 리터럴 'rpc'(예: `const key = 'rpc'`, `Reflect.get(x, 'rpc')`)를 대조 불가로 실패 폐쇄하되, 이미 처리한 `x['rpc']` argumentExpression은 중복 보고하지 않는다. / admin-acl-source-scan.test.mjs에 위 두 사례의 실패 회귀시험을 추가하고 기존 `handlers[key]()` 무오인 시험은 유지한다.
- 필요한 테스트: `const { 'rpc': call } = client; call('business_day_state');` → 리터럴이 아닌 .rpc 이름 오류 / `const sb = supabase; const key = 'rpc'; sb[key]('business_day_state');` → 리터럴이 아닌 .rpc 이름 오류 / `const key = 'save'; handlers[key](); client.rpc('get_settings');` → get_settings만 수집

### P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE — Minor / OPEN

- 범주: TEST_GAP
- 영향: 스캐너 리팩터링 시 bracket 리터럴·별칭 추출·비리터럴 인자 실패 폐쇄가 회귀해도 --no-db CI와 verify ③에서 감지되지 않고, 실제 DB 단계(④)까지 가야만 드러난다.
- 근거: packages/db/scripts/admin-acl-source-scan.test.mjs:42, packages/db/scripts/admin-acl-source-scan.mjs:50, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:49, scripts/verify.mjs:112
- 완료 조건: admin-acl-source-scan.test.mjs에 `client['rpc']('x')`, `const call = client.rpc`, `client.rpc(...args)`/`client.rpc(name)`, 루트는 있으나 파일 0개 사례의 실패 회귀시험을 추가한다. / 시험 총계 출력이 실제 통과 수를 반영하고 verify ③에서 실행된다.
- 필요한 테스트: `client['rpc']('business_day_state')` → 리터럴이 아닌 .rpc 이름 오류 / `const call = client.rpc; call('business_day_state')` → 리터럴이 아닌 .rpc 이름 오류 / `client.rpc(name)` → 리터럴이 아닌 .rpc 이름 오류 / src·app 디렉토리만 있고 소스 파일이 없을 때 → 모바일 소스를 하나도 찾지 못했습니다 오류

### P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: 봉인 스냅샷에서 감사 SQL의 실행 바이트를 되짚을 수 없어 `git cat-file` 대조 재현이라는 P2-6 완료 조건이 SQL에 대해 성립하지 않고, 32/87→0/0 전환 근거 부재는 보안 기준선 변경을 독자가 추적할 수 없게 한다.
- 근거: docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:104, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:95, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:75, packages/db/scripts/admin-acl-audit.test.mjs:171, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:121
- 완료 조건: 판본 고정 표에 네 파일 모두의 Git blob OID를 기록하거나 최소 admin-acl-audit.sql·스캐너 두 파일의 blob OID를 추가한다. / SHA-256 표의 각 값이 LF blob 기준인지 CRLF 작업 트리 기준인지 파일별로 명시한다. / V2 32/87에서 P2-6 0/0으로 바뀐 근거(P0-5 최소 권한 폐쇄)를 한 문장으로 연결한다. / P2-6 `corepack pnpm verify` 검증 결과 블록을 V2와 같은 원문 형식으로 보존한다.
- 필요한 테스트: 증거 표의 blob OID가 target commit의 `git ls-tree` 값과 일치 / 증거 표의 SHA-256이 명시된 기준(blob 또는 작업 트리)으로 재계산 시 일치

## 공동 편집 제안

### P2-6-SEC-E001-SCAN-STRING-PROPERTY-NAME — REPLACE

- 대상: `packages/db/scripts/admin-acl-source-scan.mjs`
- 위치:         if (ts.isIdentifier(bound) && bound.text === 'rpc') dynamic.push(location(source, path, node));
- 연결 Finding: P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION
- 이유: `const { 'rpc': call } = client`의 StringLiteral propertyName도 구조 분해 별칭으로 실패 폐쇄한다.

            if ((ts.isIdentifier(bound) || ts.isStringLiteralLike(bound)) && bound.text === 'rpc') {
              dynamic.push(location(source, path, node));
            }

### P2-6-SEC-E002-SCAN-RPC-LITERAL-VALUE — ADD

- 대상: `packages/db/scripts/admin-acl-source-scan.mjs`
- 위치:       ts.forEachChild(node, visit);
- 연결 Finding: P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION
- 이유: 객체 이름 정규식에 의존하지 않는 보조 규칙으로 별칭 변수 계산 키 우회를 닫는다. forEachChild 앞에 삽입한다.

          // 'rpc' 문자열이 값으로 흘러가면(`const key = 'rpc'; sb[key](...)`, `Reflect.get(x, 'rpc')`)
          // 어떤 객체에서 호출되는지 정적으로 알 수 없으므로 대조 불가로 본다. `x['rpc']`는 위에서 처리했다.
          if (ts.isStringLiteralLike(node) && node.text === 'rpc'
              && !(ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node)
              && !(ts.isBindingElement(node.parent) && node.parent.propertyName === node)) {
            dynamic.push(location(source, path, node));
          }

### P2-6-SEC-E003-SCAN-TESTS — ADD

- 대상: `packages/db/scripts/admin-acl-source-scan.test.mjs`
- 위치: ok('일반 객체의 계산 키 호출은 RPC로 오인하지 않는다', () => withFixture(
- 연결 Finding: P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION, P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE
- 이유: 이 블록 앞에 삽입한다. `0 &&`로 비활성화한 별칭 계산 키 시험은 E001·E002 반영 후 `0 && `를 제거해 활성화한다. 나머지는 현재 스캐너에서 즉시 통과해야 한다.

    ok('문자열 속성명 구조 분해 별칭도 거부한다', () => expectFailure(
      { 'destructure-string.ts': `const { 'rpc': call } = client; call('business_day_state');\n` },
      /리터럴이 아닌 \.rpc 이름/,
    ));
    0 && ok('별칭 변수의 rpc 리터럴 계산 키를 거부한다', () => expectFailure(
      { 'alias-computed.ts': `const sb = supabase; const key = 'rpc'; sb[key]('business_day_state');\n` },
      /리터럴이 아닌 \.rpc 이름/,
    ));
    ok('bracket 리터럴 rpc 호출을 거부한다', () => expectFailure(
      { 'bracket.ts': `client['rpc']('business_day_state');\n` },
      /리터럴이 아닌 \.rpc 이름/,
    ));
    ok('.rpc 함수 별칭 추출을 거부한다', () => expectFailure(
      { 'alias.ts': `const call = client.rpc; call('business_day_state');\n` },
      /리터럴이 아닌 \.rpc 이름/,
    ));
    ok('비리터럴 첫 인자를 거부한다', () => expectFailure(
      { 'dynamic-arg.ts': `const name = 'business_day_state'; client.rpc(name);\n` },
      /리터럴이 아닌 \.rpc 이름/,
    ));

### P2-6-SEC-E004-EVIDENCE-BLOB-OIDS — ADD

- 대상: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 위치: | `packages/db/scripts/admin-acl-audit.sql` | `b66f7a474d958c73753b7f72537dc2bd75cdbe9399387562e4ba33058b1802ff` |
- 연결 Finding: P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING
- 이유: 봉인 입력 메타데이터의 blob OID·SHA-256으로 SQL 포함 네 파일의 재현 대조를 가능하게 하고 32/87→0/0 전환 근거를 연결한다. 작성자는 실제 `git ls-tree` 결과로 값을 재확인해야 한다.

    
    위 SHA-256 중 `admin-acl-audit.test.mjs`·`admin-acl-audit.sql`은 CRLF 작업 트리 바이트이고, 소스 스캔 두 파일은
    LF blob 바이트와 같다. 저장소 객체로 대조할 수 있도록 검수 봉인 target `513686b86c915ebc4a6d6c78a57237cdfbb08a6f`
    기준 Git blob OID를 함께 고정한다(`git ls-tree 513686b8 -- <path>`로 재현).
    
    | 파일 | Git blob OID | blob SHA-256 |
    | --- | --- | --- |
    | `packages/db/scripts/admin-acl-audit.test.mjs` | `38a74b1ef1e2dcf48b046e1250bf112bb915039a` | `5db66c6495b22cca08f69f6c1297d767806b2db9f0d1c73f03b3938e1646fb4a` |
    | `packages/db/scripts/admin-acl-source-scan.mjs` | `08f490ddec42cf7cb6f94b842abcb22981d5c78c` | `71d6edfe664669419b7bebbc43167808df27107e7049a4f9db87d19a9cb208f2` |
    | `packages/db/scripts/admin-acl-source-scan.test.mjs` | `17bd3bac1e0798ddfa6747502e1c52b37e46b1c2` | `300bfc242e047bb71bdca7d64520fb400adb3af9607d4f61cf275830230863ba` |
    | `packages/db/scripts/admin-acl-audit.sql` | `aed306cdf87a3bf017220f6f2a617fc1a0592361` | `ed096d04f8010a0eaaadc5f8073929f0569812c3514f3f490c81edfa44c47220` |
    
    V2의 `ledger_write_paths=32`·`unapproved_authenticated_rpc=87`은 P0-5 최소 권한 폐쇄 이후 0이 계약이며
    (`admin-acl-audit.test.mjs`의 0 고정 검사), P2-6 stdout의 `0`·`0`은 그 계약 아래의 실측값이다.

### P2-6-SEC-E005-EVIDENCE-VERIFY-VERBATIM — COMMENT

- 대상: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 위치: ⑥ 웹 번들을 모두 통과했다. 종료 코드는 0이고 `fresh_%` 일회용 DB는 남지 않았다.
- 연결 Finding: P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING
- 이유: P2-6 verify 실행 결과를 원문으로 결속한다.

    V2 절(64-73)과 같은 형식으로 P2-6 `corepack pnpm verify`의 `════ 검증 결과 ════` 블록 원문(③ 라벨은 현재 `③ CLI 계약 · ACL 보안`)과 `VERIFY_EXIT=0`, `fresh_%` 개수 쿼리 결과를 코드 블록으로 보존해 달라. 산문 요약만으로는 P1-1-BINDING-005의 원문성 요구를 만족하지 않는다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P2-6-SEC-001-RPC-SCAN-LITERAL-KEY-EVASION, P2-6-SEC-002-SOURCE-SCAN-TEST-COVERAGE, P2-6-SEC-003-EVIDENCE-SQL-HASH-BINDING

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
