
<!-- fable-review:r003 sha256=8ca6d87fcb6bdeb9cf99a0103ff6a06b3e9d43ecaa8082adc25591d4a4e7eac2 -->
## FABLE_RECHECK · turn-f003 · r003

- role: `FABLE-SEC`
- verdict: `PASS`
- review_sha256: `8ca6d87fcb6bdeb9cf99a0103ff6a06b3e9d43ecaa8082adc25591d4a4e7eac2`
- target_commit_sha: `d5aeafd7098836c73e29c362386b8250f8476431`
- input_files_sha256: `105a5dd1059821a584961d873e4192f802107bf469adc10615481234058effc1`
- 원본 검수: [r003/review.md](./rounds/r003/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: P1-1-SEC-SUPPORT-TEST-UNSEALED
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P1-1 원격 ACL 읽기 전용 audit 도구 FABLE-SEC 재검수(r003). 이전 필수 finding 5건과 선택 1건을 스냅샷 원문으로 대조한 결과 모두 수용 기준을 충족해 VERIFIED로 기록한다. (1) MISSING-METRIC-FAIL-OPEN: admin-acl.sh 153~177행이 seen 추적·duplicate_metric·16개 필수 metric(platform_default_open 포함) missing_metric 검사를 bash 내장만으로 수행하고, test.sh 210~223행이 부분·빈·중복 출력 사보타주를 exit 1로 고정한다. (2) RLS-LEDGER-WRITE-PATH-GAP: audit SQL 80~90행 rls_disabled_app_tables(프로브 제외), 111~134행 ledger_write_paths(README 권위 데이터 10개 표, GRANT×RLS 비활성 또는 PUBLIC/롤 대상 쓰기 정책)를 추가했고 셸 165행이 0을 요구하며 성공 문구(186행)는 측정 범위로 한정됐다. 개발 DB 실측 0/32/87은 README·브랜치 §4.5·서버-확장 서문에 배포 차단·P0-5 연결로 숨김 없이 기록됐다. (3) SIGNATURE-SEARCH-PATH: SQL 4행 set local search_path 고정, anon_rpc·unapproved가 prokind ('f','p')로 확장, Codex가 호출자 search_path=pg_catalog 조건에서 통과를 확인했다. (4) TEST-GAP-ALLOWLIST-REALDB: SQL 45~47행 create_store 비-mobile 예외 명시, 7행 시험 파일·verify ④ 지정, 본 검수에서 evidence 훅 10개의 .rpc 이름 61개 유일 집합 + create_store = allowlist 62개가 양방향 일치함을 재확인했다. (5) DOC-AUDIT-MODE-STALE: README 27~30행 구조표 갱신; AGENTS.md 138행은 reference라 별도 동기화 작업으로 남긴다(스냅샷은 UNCHANGED). (6) SQLPATH-SSL: 슬래시 없는 호출 처리·기대 경로 출력·verify-full 권장 문서화 완료. 새 항목 1건(Improvement, 비차단): 게이트를 지탱하는 admin-acl-audit.test.mjs와 verify ④ hunk가 이 패킷의 artifact에 없어 소스가 봉인·검수되지 않았다. 잔여 위험 방향은 모두 실패 폐쇄이므로 PASS를 막지 않지만 다음 패킷에서 봉인을 요청한다. 실제 호스티드 audit 미실행과 32/87 축소는 사람 결정대로 별도 R3(P0-5) 과제이며, PASS는 도구 구현 검수 통과일 뿐 원격 ACL 게이트(gate_state)는 OPEN으로 유지된다.

### 공동 편집 제안 색인

- E12-SERVER-DOC-DUP-PHRASE: REPLACE `docs/서버-확장-아키텍처-기획안.md` · 저장소 문서와 공용 RPC 변환 경계의 기준선 동기화(P1-3)는 `01c5358`에서 완료했다. 다음 서버 운영 · 원문은 review.md 참조
- E13-SQL-SUPPORT-TEST-SEAL-NOTE: COMMENT `packages/db/scripts/admin-acl-audit.sql` · -- 이 파일은 admin-acl.sh --remote audit와 verify ④의 admin-acl-audit.test.mjs가 함께 사용한다. · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r003 -->
