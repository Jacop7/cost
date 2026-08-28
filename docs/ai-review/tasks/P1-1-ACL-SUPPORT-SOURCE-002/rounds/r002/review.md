# P1-1-ACL-SUPPORT-SOURCE-002 Fable 검수 — r002

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `d0051c17bb6f842e28b48813616114fefc50913c`

## 요약

보안 관점 초기 검수(INITIAL) 결과다. 소스 자체는 r001 지적을 대체로 충실히 반영했다. (1) P1-1-SUPPORT-1: EXPECTED_METRICS 16개가 SQL 출력·admin-acl.sh 필수 목록과 정확히 일치하고, 누락·중복·미지 metric·추가 열을 모두 실패시키며, fresh DB 사후조건 10개 값(rls_disabled_app_tables=0, protected_objects=6, blocked_internal_rpc_objects=11 등)과 probe_owner=postgres·facade_rpc_missing=0을 고정한다. (2) P1-1-SUPPORT-2: TypeScript AST로 `.rpc(` 첫 인자가 StringLiteral/NoSubstitutionTemplateLiteral이 아니면 실패하고, 비-mobile 예외⊆허용 목록, (허용−예외)↔모바일 호출 양방향 차집합을 모두 실패 조건으로 둔다. (3) P1-1-SUPPORT-3: verify ④가 run.mjs 뒤·concurrency 앞에 지원 시험을 실제로 실행하고 ok 체인으로 실패를 전파하며 finally에서 DB를 정리한다. 컨테이너 이름·DB 식별자 정규식 검증으로 argv 주입도 막았다. (4) P1-1-SUPPORT-4: 부채 32/87을 ceiling으로만 두어 0 위장 없이 증가만 차단한다.

그러나 필수 증거가 스냅샷에 없다. 패킷이 evidence_paths로 선언한 r001 review.md·collaboration.md·REMOTE-ACL-AUDIT r003 review.md 세 파일이 input_files·매니페스트·스냅샷 어디에도 실체화되지 않았고, required_evidence의 사보타주 exit 1 증거·verify 6/6·fresh_* 0개 증거도 공동 장부의 한 줄 주장 외에는 없다. 불변식 P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED가 이번 라운드에도 재현된 것이므로 Major로 연다. 그 밖에 migrations 0/2 계약이 '장부는 있으나 0166·0167이 빠진 DB'를 0으로 통과시키는 점(Minor), `client['rpc'](x)` 요소 접근·별칭 호출이 동적 RPC 거부를 우회하고 스캔 루트가 `apps/mobile/src`의 .ts/.tsx로만 고정된 점(Minor), 부채 값 파싱이 Number() 기반이라 정수 정규식으로 엄격화할 여지(Improvement)를 기록했다. 세 Minor/Major는 proposed_edits로 구체 수정안을 제시했다. 실제 호스티드 audit와 32/87 축소는 사람 결정대로 별도 P0-5 R3 범위로 유지한다.

## Findings

### P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED — Major / OPEN

- 범주: OPERATIONS
- 영향: R3 MANDATORY_MUTUAL 경로에서 r001의 필수 3건·선택 1건이 각각 어떤 코드 줄로 닫혔는지, 사보타주 5종이 실제로 exit 1이었는지를 검수자가 독립 확인할 수 없다. 불변식 P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED가 이번 라운드에도 재현된 것이며, 이 상태로 PASS하면 '주장=증거'가 된다.
- 근거: COLLABORATION_LOG:0
- 완료 조건: evidence_paths로 선언한 세 문서가 다음 라운드 스냅샷 input_files에 EVIDENCE 역할로 실체화되고 sha256이 매니페스트에 기록된다. / r001 Finding ID별로 반영 커밋·파일·줄 범위를 적은 장부(collaboration.md 또는 round 문서)가 스냅샷 안에 존재한다. / GRANT·동적 RPC·allowlist·metric·rollback 사보타주 5종의 명령·exit code·핵심 출력과 복구 후 corepack pnpm verify 6/6 exit 0·fresh_* 0개 결과가 Codex 검증 산출물로 스냅샷에 포함된다.
- 필요한 테스트: CODEX-FUNCTION-QA가 사보타주 5종(GRANT 추가·.rpc(변수)·허용 목록 항목 삭제·metric 행 삭제·rollback→commit)을 각각 적용해 node packages/db/scripts/admin-acl-audit.test.mjs <fresh_db> exit 1을 기록하고 복구한다. / corepack pnpm verify 전체 실행 로그와 실행 후 컨테이너의 fresh_% DB 목록 0건을 첨부한다.

### P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS — Minor / OPEN

- 범주: TEST_GAP
- 영향: CLI로 구축돼 supabase_migrations 장부가 있는 DB에서 ACL migration 0166·0167이 누락돼도 지원 시험이 migrations=0으로 통과한다. 다른 metric이 효과를 간접 측정하므로 즉시 위험은 낮지만, '0/2 단언'이 실제로는 '장부 존재 여부와 무관한 0 허용'이어서 사후조건 값 봉인이 불완전하다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:152, packages/db/scripts/admin-acl-audit.sql:49, packages/db/scripts/admin-acl.sh:161
- 완료 조건: 시험이 supabase_migrations.schema_migrations 존재 여부를 별도 질의로 확인하고, 장부가 있으면 migrations='2'만, 없으면 '0'만 통과시킨다. / 실패 메시지에 장부 존재 여부와 기대값을 함께 출력한다.
- 필요한 테스트: fresh DB에 supabase_migrations.schema_migrations 빈 표를 임시로 만든 뒤 시험이 migrations 불일치로 exit 1인지 확인하고 표를 제거한다. / 표가 없는 fresh DB에서는 migrations=0으로 통과하는지 확인한다.

### P1-1-SUPPORT-002-RPC-SCAN-EVASION — Minor / OPEN

- 범주: TEST_GAP
- 영향: 동적 RPC 이름 거부(P1-1-SUPPORT-2)를 요소 접근·별칭 한 줄로 우회할 수 있어, 허용 목록 밖 RPC를 호출하는 모바일 소스가 '미허용' 방향에서 감지되지 않는다. 역방향(미사용) 검사는 여전히 실패하므로 허용 목록 과대는 잡히지만, 호출 측 드리프트는 놓친다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:92, packages/db/scripts/admin-acl-audit.test.mjs:18, packages/db/scripts/admin-acl-audit.test.mjs:78
- 완료 조건: ElementAccessExpression으로 'rpc'를 접근하는 호출은 인자가 리터럴이어도 동적 호출로 취급해 실패시킨다. / 스캔 루트에서 수집한 파일이 0개면 즉시 실패한다. / expo-router 라우트 디렉터리가 apps/mobile/src 밖에 있다면 스캔 루트에 포함하거나, 없음을 시험 주석에 명시한다. / 수집 확장자를 .ts/.tsx/.js/.jsx/.mjs/.cjs로 넓히거나 .js 계열 부재를 실패 조건으로 둔다.
- 필요한 테스트: 임시로 apps/mobile/src에 client['rpc']('save_sale') 호출을 추가해 시험이 exit 1인지 확인하고 되돌린다. / MOBILE_SRC를 빈 디렉터리로 바꿔 실행했을 때 '파일 0개'로 실패하는지 확인한다.

### P1-1-SUPPORT-002-DEBT-VALUE-PARSING — Improvement / OPEN

- 범주: CODE
- 영향: SQL이 바뀌어 빈 문자열이나 공백 포함 값을 내면 부채 ceiling 검사가 0으로 오인해 통과할 수 있다. 현재 위험은 없으나 값 봉인의 방어선이 얇다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:181
- 완료 조건: 부채 값은 /^\d+$/ 정규식으로 검증한 뒤 ceiling과 비교한다. / P0-5로 부채가 줄면 DEBT_CEILING을 그 값으로 내리는 규칙을 주석에 남긴다.
- 필요한 테스트: SQL을 임시로 수정해 ledger_write_paths 값을 빈 문자열로 내보냈을 때 시험이 실패하는지 확인한다.

## 공동 편집 제안

### P1-1-SUPPORT-002-EDIT-MIGRATIONS-LEDGER — REPLACE

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치: // psql fresh harness는 CLI 장부가 없어 0, CLI로 구축한 DB는 둘 모두 적용돼 2다.
- 연결 Finding: P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS
- 이유: 앵커 주석과 바로 아래 if 블록(현재 152~155행)을 이 블록으로 교체한다. migrations 0/2 계약을 장부 존재 여부에 결합해 '장부 있음+ACL migration 누락' 상태를 실패로 닫는다.

    // CLI 장부가 없으면 0만, 있으면 2만 허용한다. 장부가 있는데 0166·0167이 빠진 DB를 0으로 통과시키지 않는다.
    const ledger = psql("select case when to_regclass('supabase_migrations.schema_migrations') is null then 'absent' else 'present' end;").trim();
    const expectedMigrations = ledger === 'present' ? '2' : '0';
    if (seen.get('migrations').value !== expectedMigrations) {
      fail(`migrations 값이 하네스 계약 밖입니다: 관측=${seen.get('migrations').value} 장부=${ledger} 기대=${expectedMigrations}`);
    }

### P1-1-SUPPORT-002-EDIT-RPC-ELEMENT-ACCESS — COMMENT

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치:         // StringLiteral과 NoSubstitutionTemplateLiteral만 허용한다.
- 연결 Finding: P1-1-SUPPORT-002-RPC-SCAN-EVASION
- 이유: 동적 RPC 거부를 요소 접근으로 우회하는 경로를 막고, 스캔 루트 오지정 시 '허용 목록 전부 미사용'이라는 간접 실패 대신 명시적으로 실패하게 한다.

    visit 함수(현재 91~106행)를 아래처럼 바꿔 요소 접근 호출을 동적 호출로 취급하고, mobileRpcNames 진입부에서 수집 파일 0개를 실패시킨다.
    
    function mobileRpcNames() {
      const names = new Set();
      const dynamic = [];
      const files = filesBelow(MOBILE_SRC);
      if (files.length === 0) fail(`모바일 소스를 하나도 찾지 못했습니다: ${MOBILE_SRC}`);
      for (const path of files) {
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node) => {
          if (ts.isCallExpression(node)) {
            const callee = node.expression;
            const isRpcProperty = ts.isPropertyAccessExpression(callee) && callee.name.text === 'rpc';
            // client['rpc'](…) 요소 접근은 리터럴 검사 회피 경로이므로 인자와 무관하게 동적 호출로 본다.
            const isRpcElement = ts.isElementAccessExpression(callee)
              && ts.isStringLiteralLike(callee.argumentExpression)
              && callee.argumentExpression.text === 'rpc';
            if (isRpcProperty || isRpcElement) {
              const first = node.arguments[0];
              // StringLiteral과 NoSubstitutionTemplateLiteral만 허용한다.
              if (isRpcProperty && first && ts.isStringLiteralLike(first)) {
                names.add(first.text);
              } else {
                const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
                dynamic.push(`${path}:${line + 1}`);
              }
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
      if (dynamic.length) fail(`리터럴이 아닌 .rpc 이름 — 허용 목록 대조 불가: ${dynamic.join(', ')}`);
      return names;
    }
    
    또한 filesBelow의 확장자 정규식을 /\.(tsx?|jsx?|mjs|cjs)$/ 로 넓히고, expo-router 라우트 디렉터리가 src 밖에 있으면 스캔 루트 배열에 추가한다.

### P1-1-SUPPORT-002-EDIT-DEBT-STRICT-PARSE — REPLACE

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치:   const observed = Number(seen.get(metric).value);
- 연결 Finding: P1-1-SUPPORT-002-DEBT-VALUE-PARSING
- 이유: 앵커 줄과 바로 아래 if 블록(현재 182~185행)을 교체한다. 부채 ceiling 검사의 파서를 정수 정규식으로 엄격화한다.

      const raw = seen.get(metric).value;
      // 정수 문자열만 받는다. Number('')=0 같은 느슨한 변환으로 부채를 0으로 오인하지 않는다.
      if (!/^\d+$/.test(raw) || Number(raw) > ceiling) {
        fail(`${metric} 부채가 기준선을 넘었거나 정수가 아닙니다: 관측=${raw} 기준선=${ceiling}`);
      }

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED, P1-1-SUPPORT-002-MIGRATIONS-ZERO-AMBIGUOUS, P1-1-SUPPORT-002-RPC-SCAN-EVASION

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
