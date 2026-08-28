# P1-1-ACL-SUPPORT-SOURCE-001 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `36fec6710762cfc9543486316e062e8173be6712`

## 요약

P1-1 지원 시험 소스(admin-acl-audit.test.mjs)와 verify ④ 연결을 독립 검수했다. 확인된 것: (1) verify.mjs ④는 일회용 fresh DB 이름을 argv로 지원 시험에 실제 전달하고, 실패는 ok=false→failed++→exit 1로 전파되며 건너뛰지 않는다. (2) 시험은 16개 metric의 정확 집합·중복·미지 metric·expected 설명을 검사하고, 별도 세션에서 to_regclass로 프로브 부재를 확인한다. (3) 모바일 .rpc 리터럴 61개와 SQL 허용 목록 62개(create_store 비-mobile 예외 1개 제외)를 grep으로 독립 재계수해 양방향 일치를 확인했다. 미해결: (A) Major — 시험이 16개 metric 중 probe_owner·facade_rpc_missing 2개만 값을 단언한다. anon_rpc=0·blocked_internal_rpc=0·protected_writes=0·probe_dangerous=0·public_dangerous=0·rls_disabled_app_tables=0·source_schema_grants=0·supabase_admin_objects=0·protected_objects=6·blocked_internal_rpc_objects=11처럼 fresh DB가 이미 만족하는 사후조건이 봉인되지 않아, 새 migration이 anon EXECUTE나 보호 표 쓰기를 다시 열어도 verify ④가 초록이다. 이는 공동 장부의 집중 검토 질문 "SQL 문법만 실행하고 사후조건을 놓치지 않는가"에 대한 실질적 미충족이다. (B) Minor — AST 대조가 리터럴이 아닌 .rpc(name) 호출을 조용히 건너뛰어 양방향 일치 계약에 구멍이 있다(현재 코드에는 해당 호출 없음). (C) Minor — required_evidence 중 r003 review.md 원문과 allowlist 드리프트 사보타주 증거가 스냅샷에 없어 P1-1-SUPPORT-3 원문 대조와 실패 경로 실증을 검수할 수 없다. (D) Improvement — SQL 허용 목록을 정규식으로 추출하며 비-mobile 예외⊆허용 목록 검사가 없다. 실제 호스티드 audit와 32/87 부채 축소는 사람 결정대로 범위 밖이다.

## Findings

### P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED — Major / OPEN

- 범주: TEST_GAP
- 영향: 필수 로컬 게이트(pnpm verify ④)가 fresh DB의 앱 롤 공격면 사후조건을 실제로 봉인하지 않는다. 0165~0167이 닫은 anon RPC·내부 몸통 EXECUTE·보호 표 직접 쓰기·위험 테이블 권한이 후속 migration에서 회귀해도 로컬에서는 감지되지 않고, 호스티드 audit(현재 87건 부채로 항상 실패)에서만 드러나므로 회귀와 기존 부채가 구분되지 않는다. 서버 권위 원칙(AGENTS §절대 원칙 3)의 실효 경계인 DB grant 계약이 시험으로 보호되지 않는다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:114, packages/db/scripts/admin-acl-audit.test.mjs:138, packages/db/scripts/admin-acl-audit.sql:172, packages/db/scripts/admin-acl.sh:159, packages/db/README.md:104, scripts/verify.mjs:131
- 완료 조건: admin-acl-audit.test.mjs가 fresh DB에서 이미 만족하는 metric(probe_dangerous·public_dangerous·rls_disabled_app_tables·protected_writes·source_schema_grants·supabase_admin_objects·anon_rpc·blocked_internal_rpc=0, protected_objects=6, blocked_internal_rpc_objects=11)의 값을 정확히 단언하고 불일치 시 exit 1 한다. / migrations는 하네스 계약({0,2}) 밖의 값이면 실패하고, platform_default_open은 informational로 유지한다. / P0-5 부채 metric(ledger_write_paths·unapproved_authenticated_rpc)은 성공으로 위장하지 않되, fresh DB 실측 기준선을 코드에 기록하고 그 값을 초과하면 실패한다(축소는 허용). / verify.mjs ④ 주석과 시험 헤더 주석이 '값 단언 포함'으로 갱신된다.
- 필요한 테스트: fresh DB에서 pnpm verify ④ 통과(값 단언 포함) 실행 로그 / 사보타주: fresh DB에 grant execute on function public.close_business_day to authenticated 적용 후 지원 시험이 blocked_internal_rpc 불일치로 exit 1 하는 증거 / 사보타주: 임의 public 함수에 grant execute to anon 적용 후 anon_rpc 불일치로 exit 1 하는 증거 / 부채 기준선 초과(unapproved_authenticated_rpc 기준선+1) 시 실패하고, 축소 시 통과하는 증거

### P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED — Minor / OPEN

- 범주: TEST_GAP
- 영향: 향후 도메인 훅이 supabase.rpc(fnName) 형태의 동적 호출을 추가하면 허용 목록 밖 RPC를 앱이 호출해도 지원 시험이 통과한다. 공동 장부의 '양방향 일치' 주장이 리터럴 호출에만 유효한 조건부 주장이 된다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:86, packages/db/scripts/admin-acl-audit.test.mjs:130, apps/mobile/src/features/sales/hooks.ts:937
- 완료 조건: 첫 인자가 문자열 리터럴(NoSubstitutionTemplateLiteral 포함)이 아닌 .rpc(...) 호출을 발견하면 파일:줄과 함께 실패한다. / 시험 헤더 주석에 '동적 .rpc 이름은 허용하지 않는다'는 계약을 명시한다.
- 필요한 테스트: 임시로 apps/mobile/src에 const n='x'; supabase.rpc(n) 형태를 추가했을 때 지원 시험이 exit 1 하는 사보타주 증거 / 치환 없는 템플릿 리터럴 .rpc(`sales_day`)는 정상 수집되는 증거

### P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED — Minor / OPEN

- 범주: OTHER
- 영향: 검수자는 시험의 성공 경로 소스만 확인할 수 있고, 실패 경로가 실제로 작동하는지와 r003 Improvement가 요구한 봉인 범위가 이 소스로 충족되는지를 원문 대조로 판정할 수 없다. 통과 주장만 있는 시험은 AGENTS '건너뛴 단계가 있으면 전체 통과라고 표현하지 않는다'의 취지상 봉인 근거로 부족하다.
- 근거: COLLABORATION_LOG:0, COLLABORATION_LOG:0, packages/db/scripts/admin-acl.test.sh:130
- 완료 조건: 다음 라운드 스냅샷에 r003 review.md가 실제 materialize되거나, 해당 Improvement 원문이 공동 장부 턴에 인용된다. / CODEX-FUNCTION-QA 검증 턴 또는 공동 장부에 사보타주 3종(허용 목록에서 항목 1개 제거→미허용 실패, 모바일 호출 없는 항목 추가→미사용 실패, SQL에서 metric 1개 제거→누락 실패)의 exit 1 출력이 기록된다.
- 필요한 테스트: 허용 목록 드리프트 양방향 각 1건이 exit 1 하는 실행 로그 / SQL metric 1개 삭제·중복 시 exit 1 하는 실행 로그 / rollback; 제거 시 프로브 잔존으로 exit 1 하는 실행 로그(별도 fresh DB에서, 이후 drop)

### P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION — Improvement / OPEN

- 범주: CODE
- 영향: 현재 통과 결과를 바꾸지 않는 견고성 문제다. 허용 목록 SQL 형식이 바뀌면 시험이 오탐으로 실패해 유지보수 비용이 늘고, 예외 목록 오타는 감지되지 않는다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:60, packages/db/scripts/admin-acl-audit.test.mjs:125, packages/db/scripts/admin-acl-audit.test.mjs:18, scripts/verify.mjs:143
- 완료 조건: 비-mobile 예외 이름이 허용 목록에 없으면 실패한다. / 추출된 시그니처 수가 0이거나 SQL의 values 행 수와 다르면 실패하는 자기 검증을 두거나, 시험이 같은 psql 세션 안에서 'select signature from _acl_approved_rpc'를 rollback 전에 실행해 DB 값으로 추출한다. / SUPABASE_DB_CONTAINER를 admin-acl.sh와 같은 정규식으로 검증한다.
- 필요한 테스트: _acl_non_mobile_rpc에 허용 목록 밖 이름을 추가한 사보타주에서 실패하는 증거

## 공동 편집 제안

### P1-1-SUPPORT-EDIT-METRIC-VALUES — ADD

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치: if (seen.get('facade_rpc_missing').value !== '0') fail(`허용 facade가 DB에 없습니다: ${seen.get('facade_rpc_missing').value}`);
- 연결 Finding: P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED
- 이유: fresh DB가 이미 만족하는 10개 metric 값을 단언해 후속 migration의 grant 회귀를 verify ④에서 잡고, 부채 metric은 성공 위장 없이 기준선 초과만 실패시킨다.

    
    // 새 DB가 이미 만족하는 사후조건은 값까지 고정한다. 값을 단언하지 않는 항목은 하네스 의존
    // (migrations·platform_default_open)과 P0-5 부채(ledger_write_paths·unapproved_authenticated_rpc)뿐이다.
    const FRESH_DB_VALUES = new Map([
      ['probe_dangerous', '0'], ['public_dangerous', '0'], ['rls_disabled_app_tables', '0'],
      ['protected_objects', '6'], ['protected_writes', '0'], ['source_schema_grants', '0'],
      ['supabase_admin_objects', '0'], ['anon_rpc', '0'], ['blocked_internal_rpc', '0'],
      ['blocked_internal_rpc_objects', '11'],
    ]);
    for (const [metric, value] of FRESH_DB_VALUES) {
      if (seen.get(metric).value !== value) fail(`${metric} 사후조건 불일치: 관측=${seen.get(metric).value} 기대=${value}`);
    }
    // psql 기반 fresh harness는 CLI 장부가 없어 0, CLI 적용 DB는 2다. 그 밖의 값은 계약 밖이다.
    if (!['0', '2'].includes(seen.get('migrations').value)) fail(`migrations 값이 하네스 계약 밖입니다: ${seen.get('migrations').value}`);
    // P0-5 부채는 성공으로 바꾸지 않는다. 다만 기록된 fresh DB 기준선보다 커지면 회귀이므로 실패한다(축소는 허용).
    // ⚠ 기준선 숫자는 fresh DB 실측으로 확정한다(README의 32/87은 개발 DB 실측이다).
    const DEBT_CEILING = new Map([['ledger_write_paths', 32], ['unapproved_authenticated_rpc', 87]]);
    for (const [metric, ceiling] of DEBT_CEILING) {
      const observed = Number(seen.get(metric).value);
      if (!Number.isInteger(observed) || observed > ceiling) fail(`${metric} 부채가 기준선을 넘었습니다: 관측=${seen.get(metric).value} 기준선=${ceiling}`);
    }

### P1-1-SUPPORT-EDIT-DYNAMIC-RPC — REPLACE

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치: function mobileRpcNames() {
- 연결 Finding: P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED
- 이유: 함수 전체를 교체한다(anchor 줄부터 대응하는 닫는 중괄호까지). 동적 .rpc 이름 호출을 실패로 만들어 양방향 대조 계약을 무조건적으로 만든다.

    function mobileRpcNames() {
      const names = new Set();
      const dynamic = [];
      for (const path of filesBelow(MOBILE_SRC)) {
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node) => {
          if (ts.isCallExpression(node)
              && ts.isPropertyAccessExpression(node.expression)
              && node.expression.name.text === 'rpc') {
            const first = node.arguments[0];
            if (first && ts.isStringLiteralLike(first)) {
              names.add(first.text);
            } else {
              // 이름이 리터럴이 아니면 허용 목록과 대조할 수 없다. 조용히 건너뛰면 양방향 일치가 거짓이 된다.
              const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
              dynamic.push(`${path}:${line + 1}`);
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
      if (dynamic.length) fail(`리터럴이 아닌 .rpc 이름 — 허용 목록 대조 불가: ${dynamic.join(', ')}`);
      return names;
    }

### P1-1-SUPPORT-EDIT-NONMOBILE-SUBSET — ADD

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치: const expectedMobileNames = new Set([...approvedNames].filter((name) => !nonMobileNames.has(name)));
- 연결 Finding: P1-1-SUPPORT-SEC-ALLOWLIST-REGEX-EXTRACTION
- 이유: anchor 줄 바로 뒤에 추가한다. 예외 목록 오타와 정규식 추출 실패(0건)를 조용히 넘기지 않는다.

    const strayNonMobile = difference(nonMobileNames, approvedNames);
    if (strayNonMobile.length) fail(`비-mobile 예외가 허용 목록에 없습니다: ${strayNonMobile.join(', ')}`);
    if (approvedSignatures.length === 0) fail('허용 RPC 시그니처를 하나도 추출하지 못했습니다 — SQL 형식이 바뀌었는지 확인하세요');

### P1-1-SUPPORT-EDIT-VERIFY-COMMENT — REPLACE

- 대상: `scripts/verify.mjs`
- 위치:        * 실패시키는 별도 보안 부채이고, 여기서는 metric 완전성·rollback·모바일 허용 목록
- 연결 Finding: P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED
- 이유: ④ 단계 주석이 값 단언을 포함한 실제 검증 범위를 설명하도록 맞춘다(METRIC-VALUES 수정과 함께 반영).

           * 실패시키는 별도 보안 부채이고, 여기서는 metric 완전성·새 DB 사후조건 값·rollback·모바일 허용 목록

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P1-1-SUPPORT-SEC-METRIC-VALUES-UNSEALED, P1-1-SUPPORT-SEC-DYNAMIC-RPC-SKIPPED, P1-1-SUPPORT-SEC-EVIDENCE-NOT-MATERIALIZED

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
