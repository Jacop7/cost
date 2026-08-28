# P1-1-ACL-SUPPORT-SOURCE-003 Fable 검수 — r001

- 판정: **CHANGES_REQUIRED**
- 역할: `FABLE-SEC`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `474d087fa341a70bb792cd10bd9f6907985e6617`

## 요약

P1-1 ACL 지원 시험(admin-acl-audit.test.mjs) 확정 commit 474d087과 독립 증거 파일을 보안 관점에서 초기 검수했다.

요구사항 대조 결과:
- FINAL-1(장부↔0/2 연동): 177-182행이 to_regclass로 장부 존재를 별도 조회해 present→'2', absent→'0'만 허용하며, SQL 52-63행의 DO 블록과 의미가 일치한다. 충족.
- FINAL-2(소스 스캔): 89-135행이 src·app 아래 [cm]?[jt]sx? 파일을 TypeScript AST로 파싱해 소스 0개(93-95행), 비리터럴 인자(107-112행), `['rpc']` 요소 접근(102-105행), `.rpc` 별칭(116-128행)을 모두 exit 1로 보낸다. 옵셔널 체이닝·템플릿 리터럴·괄호 감싼 호출·`.call` 우회도 AST 구조상 잡힌다. 충족. 다만 `const { rpc } = client` 구조 분해와 `client[key](...)` 비리터럴 계산 키 호출은 여전히 조용히 통과하는 잔여 우회가 남는다(Improvement).
- FINAL-3(부채 metric): 204-214행이 `/^\d+$/`(ASCII 숫자만)와 ceiling 32/87 비교를 함께 적용해 빈 문자열·소수·지수 표기·증가를 모두 차단한다. 충족.
- FINAL-4(독립 증거): 증거 파일이 원문 3건 SHA-256, 사보타주 14건 exit 1(신규 4건 37-40행 포함), 복구 후 SQL SHA `c47665…aaa4`(input_files의 admin-acl-audit.sql sha256과 정확히 일치), verify 6/6 exit 0, fresh_* 0개를 담고 있다. 실체화는 확인했으나, 33-34행의 "핵심 실패 출력"이 현재 시험의 실제 문자열(`누락 metric:`, `중복 metric:`)과 다르고, 사보타주가 실행된 시험 파일 SHA·commit SHA가 기록되지 않아 어느 판본의 시험이 그 결과를 냈는지 증거만으로는 구분할 수 없다. 이를 Minor 1건으로 등록한다.

보안 실행 표면: CONTAINER·DATABASE는 정규식으로 제한되고 docker/psql은 shell 없이 argv로 호출되며 SQL은 stdin으로 전달된다. 명령 주입·경로 주입 경로는 없다. 사람 결정대로 호스티드 audit와 32/87 축소는 P0-5 R3 범위로 두며 본 검수에서 판단하지 않는다. 이전 검수 원문 SHA(증거 14-16행)는 실행기 입력에서 제외돼 스냅샷 안에서 대조할 수 없다.

판정: Minor 1건(증거 원문성·판본 결속) 미해결로 CHANGES_REQUIRED. Improvement 3건은 게이트를 막지 않는다. 증거 파일은 evidence_paths이므로 편집을 제안하지 않고 별도 증거 보강 Task를 요청한다.

## Findings

### P1-1-SUPPORT-003-EVIDENCE-VERBATIM-BINDING — Minor / OPEN

- 범주: DATA_INTEGRITY
- 영향: R3 보안 증거 파일이 '전진 보존' 목적인데 사보타주 결과가 어느 시험 판본에서 나왔는지 증거만으로 구분할 수 없고, 일부 출력이 원문이 아니어서 후속 검수자가 exit 1 결과를 재현·대조할 때 현재 시험과 문자열이 어긋난다. 증거의 검증 가능성이 떨어져 P1-1-SUPPORT-002-EVIDENCE-NOT-MATERIALIZED의 취지를 부분적으로만 만족한다.
- 근거: docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:33, packages/db/scripts/admin-acl-audit.test.mjs:148, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:42, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:1
- 완료 조건: 증거 파일(또는 별도 Task의 후속 증거 파일)에 사보타주를 실행한 admin-acl-audit.test.mjs SHA-256과 target commit SHA를 기록한다. / '핵심 실패 출력' 열은 현재 판본 시험의 실제 stderr 문자열을 그대로 인용하거나, 의역임을 열 이름·주석으로 명시하고 실제 문자열과 대응시킨다. / 다른 판본에서 실행된 행이 있다면 어느 판본(해시)에서 실행했는지 행 단위로 표기한다. / 증거 파일은 evidence_paths이므로 본 검수의 proposed_edits로 고치지 않고 별도 증거 보강 Task로 반영한다.
- 필요한 테스트: 증거에 기록된 시험 파일 SHA-256이 target commit의 packages/db/scripts/admin-acl-audit.test.mjs blob sha256과 일치하는지 대조 / 증거의 각 사보타주 행 문자열을 현재 시험의 fail 메시지(148·152·181·185·194·200·212행 등)와 grep 대조

### P1-1-SUPPORT-003-RPC-SCAN-RESIDUAL-EVASION — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 의도적으로 난독화한 호출은 허용 목록↔소스 양방향 대조를 우회할 수 있다. DB 측 unapproved_authenticated_rpc ceiling이 신규 GRANT는 막으므로 권한 확대는 아니지만, 87건 부채 집합의 RPC를 모바일이 허용 목록 갱신 없이 쓰는 드리프트는 감지되지 않는다. 우발적 코드 경로는 현재 탐지로 충분히 잡히므로 Improvement로 둔다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:102, packages/db/scripts/admin-acl-audit.test.mjs:116
- 완료 조건: BindingElement의 propertyName 또는 name이 식별자 'rpc'이면 대조 불가로 실패시킨다. / 계산 키(문자열·숫자 리터럴이 아닌 argumentExpression)로 멤버를 호출하는 CallExpression을 실패시키거나, 모바일 src·app에 정당한 계산 키 호출이 있어 오탐이 나면 객체 이름 휴리스틱(/supabase|client/i)으로 범위를 좁히고 그 근거를 주석에 남긴다.
- 필요한 테스트: 임시 소스에 `const { rpc } = client; rpc('business_day_state')` 추가 → exit 1 / 임시 소스에 `const k = 'rpc'; client[k]('business_day_state')` 추가 → exit 1 / 복구 후 corepack pnpm verify ④ 통과

### P1-1-SUPPORT-003-MOBILE-ROOT-MISSING-UNCAUGHT — Improvement / OPEN

- 범주: CODE
- 영향: exit 코드는 1이라 게이트는 막히지만, 실패 원인이 시험 계약 메시지가 아닌 Node 스택으로 나와 verify 출력에서 원인 식별이 늦어진다. 보안 영향 없음.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:81
- 완료 조건: MOBILE_ROOTS 각 경로의 존재를 먼저 확인하고 없으면 fail()로 경로를 명시해 종료한다.
- 필요한 테스트: apps/mobile/app을 임시로 옮긴 뒤 실행 → `admin-acl audit 회귀시험 실패:` 접두 메시지와 exit 1

### P1-1-SUPPORT-003-ALLOWLIST-REGEX-PARSE — Improvement / OPEN

- 범주: TEST_GAP
- 영향: 현재 SQL에는 그런 항목이 없어 실질 영향은 없으나, 두 파서(정규식·SQL)가 같은 파일을 다르게 읽을 여지가 남는다.
- 근거: packages/db/scripts/admin-acl-audit.test.mjs:68, packages/db/scripts/admin-acl-audit.sql:10
- 완료 조건: 허용·예외 목록을 SQL 출력 행으로 내보내 시험이 DB가 인식한 집합을 직접 사용하거나, 정규식 추출 전에 주석 줄을 제거한다.
- 필요한 테스트: insert 본문에 주석 처리된 서명 한 줄 추가 → 시험 결과가 SQL 판정과 동일해야 함

## 공동 편집 제안

### P1-1-SUPPORT-003-EDIT-DESTRUCTURE-COMPUTED — ADD

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치:       // `const call = client.rpc` 처럼 별칭으로 빼는 경로도 조용히 건너뛰지 않는다.
- 연결 Finding: P1-1-SUPPORT-003-RPC-SCAN-RESIDUAL-EVASION
- 이유: 구조 분해 별칭과 비리터럴 계산 키 호출이 현재 스캔을 조용히 통과하는 잔여 우회를 닫는다. 앵커 주석 바로 앞에 삽입한다.

          // `const { rpc } = client` / `const { rpc: call } = client` 구조 분해 별칭도 대조 불가로 실패시킨다.
          if (ts.isBindingElement(node)) {
            const bound = node.propertyName ?? node.name;
            if (ts.isIdentifier(bound) && bound.text === 'rpc') {
              const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
              dynamic.push(`${path}:${line + 1}`);
            }
          }
          // `client[key](...)`처럼 계산된 키로 멤버를 부르면 rpc 여부를 정적으로 알 수 없다.
          // 키가 문자열·숫자 리터럴이 아닌 호출은 실패시킨다. 오탐이 나면 객체 이름 휴리스틱으로 좁히고 근거를 적는다.
          if (ts.isCallExpression(node)
              && ts.isElementAccessExpression(node.expression)
              && !ts.isStringLiteralLike(node.expression.argumentExpression)
              && !ts.isNumericLiteral(node.expression.argumentExpression)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            dynamic.push(`${path}:${line + 1}`);
          }
    

### P1-1-SUPPORT-003-EDIT-IMPORT-EXISTS — REPLACE

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치: import { readFileSync, readdirSync } from 'node:fs';
- 연결 Finding: P1-1-SUPPORT-003-MOBILE-ROOT-MISSING-UNCAUGHT
- 이유: 루트 존재 확인에 existsSync가 필요하다.

    import { existsSync, readFileSync, readdirSync } from 'node:fs';

### P1-1-SUPPORT-003-EDIT-ROOT-CHECK — REPLACE

- 대상: `packages/db/scripts/admin-acl-audit.test.mjs`
- 위치:   const files = MOBILE_ROOTS.flatMap(filesBelow);
- 연결 Finding: P1-1-SUPPORT-003-MOBILE-ROOT-MISSING-UNCAUGHT
- 이유: 루트 부재를 readdirSync 예외 대신 시험 계약 메시지로 실패시킨다.

      const missingRoots = MOBILE_ROOTS.filter((dir) => !existsSync(dir));
      if (missingRoots.length) fail(`모바일 소스 루트가 없습니다: ${missingRoots.join(', ')}`);
      const files = MOBILE_ROOTS.flatMap(filesBelow);

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: P1-1-SUPPORT-003-EVIDENCE-VERBATIM-BINDING

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
