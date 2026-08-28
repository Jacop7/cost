
<!-- fable-review:r001 sha256=9f6e10d6a1bda2cf805b1b01700c11b576c8fc5af8def3c1989f72338dec90bc -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `9f6e10d6a1bda2cf805b1b01700c11b576c8fc5af8def3c1989f72338dec90bc`
- target_commit_sha: `474d087fa341a70bb792cd10bd9f6907985e6617`
- input_files_sha256: `3568e289e1676d3060577293b8f081193a0f4b09e142a8a6aef471583d4a0255`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P1-1-SUPPORT-003-EVIDENCE-VERBATIM-BINDING
- 선택 미종결 Finding: P1-1-SUPPORT-003-RPC-SCAN-RESIDUAL-EVASION, P1-1-SUPPORT-003-MOBILE-ROOT-MISSING-UNCAUGHT, P1-1-SUPPORT-003-ALLOWLIST-REGEX-PARSE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P1-1 ACL 지원 시험(admin-acl-audit.test.mjs) 확정 commit 474d087과 독립 증거 파일을 보안 관점에서 초기 검수했다.

요구사항 대조 결과:
- FINAL-1(장부↔0/2 연동): 177-182행이 to_regclass로 장부 존재를 별도 조회해 present→'2', absent→'0'만 허용하며, SQL 52-63행의 DO 블록과 의미가 일치한다. 충족.
- FINAL-2(소스 스캔): 89-135행이 src·app 아래 [cm]?[jt]sx? 파일을 TypeScript AST로 파싱해 소스 0개(93-95행), 비리터럴 인자(107-112행), `['rpc']` 요소 접근(102-105행), `.rpc` 별칭(116-128행)을 모두 exit 1로 보낸다. 옵셔널 체이닝·템플릿 리터럴·괄호 감싼 호출·`.call` 우회도 AST 구조상 잡힌다. 충족. 다만 `const { rpc } = client` 구조 분해와 `client[key](...)` 비리터럴 계산 키 호출은 여전히 조용히 통과하는 잔여 우회가 남는다(Improvement).
- FINAL-3(부채 metric): 204-214행이 `/^\d+$/`(ASCII 숫자만)와 ceiling 32/87 비교를 함께 적용해 빈 문자열·소수·지수 표기·증가를 모두 차단한다. 충족.
- FINAL-4(독립 증거): 증거 파일이 원문 3건 SHA-256, 사보타주 14건 exit 1(신규 4건 37-40행 포함), 복구 후 SQL SHA `c47665…aaa4`(input_files의 admin-acl-audit.sql sha256과 정확히 일치), verify 6/6 exit 0, fresh_* 0개를 담고 있다. 실체화는 확인했으나, 33-34행의 "핵심 실패 출력"이 현재 시험의 실제 문자열(`누락 metric:`, `중복 metric:`)과 다르고, 사보타주가 실행된 시험 파일 SHA·commit SHA가 기록되지 않아 어느 판본의 시험이 그 결과를 냈는지 증거만으로는 구분할 수 없다. 이를 Minor 1건으로 등록한다.

보안 실행 표면: CONTAINER·DATABASE는 정규식으로 제한되고 docker/psql은 shell 없이 argv로 호출되며 SQL은 stdin으로 전달된다. 명령 주입·경로 주입 경로는 없다. 사람 결정대로 호스티드 audit와 32/87 축소는 P0-5 R3 범위로 두며 본 검수에서 판단하지 않는다. 이전 검수 원문 SHA(증거 14-16행)는 실행기 입력에서 제외돼 스냅샷 안에서 대조할 수 없다.

판정: Minor 1건(증거 원문성·판본 결속) 미해결로 CHANGES_REQUIRED. Improvement 3건은 게이트를 막지 않는다. 증거 파일은 evidence_paths이므로 편집을 제안하지 않고 별도 증거 보강 Task를 요청한다.

### 공동 편집 제안 색인

- P1-1-SUPPORT-003-EDIT-DESTRUCTURE-COMPUTED: ADD `packages/db/scripts/admin-acl-audit.test.mjs` ·       // `const call = client.rpc` 처럼 별칭으로 빼는 경로도 조용히 건너뛰지 않는다. · 원문은 review.md 참조
- P1-1-SUPPORT-003-EDIT-IMPORT-EXISTS: REPLACE `packages/db/scripts/admin-acl-audit.test.mjs` · import { readFileSync, readdirSync } from 'node:fs'; · 원문은 review.md 참조
- P1-1-SUPPORT-003-EDIT-ROOT-CHECK: REPLACE `packages/db/scripts/admin-acl-audit.test.mjs` ·   const files = MOBILE_ROOTS.flatMap(filesBelow); · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
