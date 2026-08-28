# P1-1-ACL-EVIDENCE-BINDING-005 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 모드: `INITIAL`
- 스냅샷: `COMMIT`
- 대상 SHA: `0670437a498ff6db86d66584217901ee01929485`

## 요약

P1-1-ACL-EVIDENCE-BINDING-005 초기 검수(FABLE-SEC) 결과: 세 요구사항이 모두 충족돼 PASS다. (1) 005-1: 증거 문서 59-62행이 최종 verify 6/6을 V2 target commit 474d087…과 시험 SHA 380afade…a6575에 명시적으로 결속했고, 이 SHA는 현재 스냅샷의 admin-acl-audit.test.mjs blob(input_files sha256)과 정확히 일치한다. 53-54행의 SQL SHA c47665…도 스냅샷 admin-acl-audit.sql과 일치해 결속이 현재 판본에도 유효하다. (2) 005-2: 61-62행과 75-76행이 fresh_% DB 0개와 rls_disabled_app_tables=0·ledger_write_paths=32·unapproved_authenticated_rpc=87이 같은 V2 실행 값임을 명시했고, 값은 시험 163행(rls 고정 0)·205-206행(부채 상한 32/87)·217행(출력 형식)과 부합한다. (3) 005-3: 32-34행이 V1 '부채가 기준선을 넘었습니다'와 V2 '부채가 기준선을 넘었거나 정수가 아닙니다'의 차이를 정수 검사 추가로 설명했고, 시험 210-212행의 실제 문구 및 빈 문자열 입력 시 '관측= 기준선=32'(51행)와 정확히 일치한다. V2 사보타주 행 48-50의 stderr도 시험 181·133·102-104·116-118행과 대조해 일치함을 확인했다. 스냅샷에는 V1 시험 파일이 없어 V1 blob SHA 0596e56…은 문서의 기재와 공동 장부의 대조 진술로만 확인 가능하며, 이는 판정을 막지 않는다. 비차단 Improvement 1건(관측값 stdout 원문 미첨부·V1 blob 재현 경로 부재)을 제안 편집과 함께 기록했다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 남는다.

## Findings

### P1-1-BINDING-005-OBSERVED-STDOUT-VERBATIM — Improvement / OPEN

- 범주: OTHER
- 영향: 현재 결속은 유효하지만, 관측값이 산문이어서 후속 판본에서 시험 출력 형식이 바뀌어도 문서가 그대로 남을 수 있고, V1 blob 대조는 문서 기재를 신뢰하는 방식에 머문다. 판정을 막는 결함은 아니다.
- 근거: docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:75, packages/db/scripts/admin-acl-audit.test.mjs:216, docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md:27
- 완료 조건: 최종 검증 절에 admin-acl-audit.test.mjs 216-217행 형식의 실제 stdout 두 줄을 원문 그대로 첨부한다. / V1·V2 판본 표에 각 시험 파일의 git blob oid 열을 추가해 commit별 대조 경로를 남긴다.
- 필요한 테스트: 문서 변경만이므로 별도 시험 없음. 첨부한 stdout 줄이 시험 216-217행 형식과 일치하는지 육안 대조.

## 공동 편집 제안

### P1-1-BINDING-005-E1 — REPLACE

- 대상: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 위치: 종료 후 `fresh_%` DB는 0개였다. 보안 관측값은
- 연결 Finding: P1-1-BINDING-005-OBSERVED-STDOUT-VERBATIM
- 이유: 시험 216-217행의 고정 stdout 형식을 원문으로 첨부해 관측값과 시험 판본의 연결을 산문이 아닌 출력으로 고정한다. metric·RPC 개수는 실제 실행 출력으로 치환해야 한다.

    종료 후 `fresh_%` DB는 0개였다. 같은 V2 실행에서 `admin-acl-audit.test.mjs`가 낸 stdout은 다음과 같다.
    
    ```text
    admin-acl audit 실제 DB 계약 통과 — metric 16개 · 모바일 RPC 61개 · 비-mobile 예외 1개
      관측값: rls_disabled_app_tables=0 ledger_write_paths=32 unapproved_authenticated_rpc=87
    ```
    
    보안 관측값은

### P1-1-BINDING-005-E2 — COMMENT

- 대상: `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md`
- 위치: | 판본 | target commit | `admin-acl-audit.test.mjs` SHA-256 |
- 연결 Finding: P1-1-BINDING-005-OBSERVED-STDOUT-VERBATIM
- 이유: V1 시험 SHA는 현재 스냅샷에서 독립 재현이 불가하므로 commit-blob 대조 경로를 문서에 남긴다.

    판본 표에 `git blob oid` 열을 추가해 V1(d0051c1)·V2(474d087) 각 commit의 admin-acl-audit.test.mjs blob oid를 기재하면, 스냅샷에 V1 파일이 없어도 후속 재검수가 `git cat-file`로 SHA-256 대조를 재현할 수 있다. V2 blob oid는 현재 스냅샷 기준 9da5001f312deb7a6a291a1e334059f0e22fca26이다.

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
