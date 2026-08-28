# P1-1-ACL-EVIDENCE-BINDING-005 공동 작업 장부

> 직전 검수에서 남은 최종 verify의 V2 판본 결속과 V1 문구 설명만 재검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `0670437a498ff6db86d66584217901ee01929485`
- artifact_hashes: `[{ path: docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md, sha256: 02bafc41c4ac705653460fa00e08801b574a8042690f7aadad35742c454336f3, change_type: MODIFIED }]`
- 근거 Finding: `P1-1-BINDING-004-FINAL-VERIFY-V2-UNBOUND`, `P1-1-BINDING-004-V1-WORDING-NOTE`
- 반영 내용: 최종 verify·fresh DB·보안 관측값을 V2 commit과 시험 SHA에 명시적으로 연결하고, V1과 V2의 부채 stderr 차이가 정수 검사 추가에 따른 것임을 기록했다.
- 검증: V1·V2 시험 파일 SHA-256을 각 commit blob과 대조했고, 증거 문서의 최종 검증 문장을 확정 commit에 고정했다.
- next_review_request: `FABLE_REVIEW`


<!-- fable-review:r001 sha256=6f7ddc95486f849dfd900ae0d3f11070458bb67dabb169ad20b19905ef1964d7 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- verdict: `PASS`
- review_sha256: `6f7ddc95486f849dfd900ae0d3f11070458bb67dabb169ad20b19905ef1964d7`
- target_commit_sha: `0670437a498ff6db86d66584217901ee01929485`
- input_files_sha256: `964c57c5f69e8d0a22386403cd658ce5f847a25fc96926a197d38f30911403dc`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: P1-1-BINDING-005-OBSERVED-STDOUT-VERBATIM
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

P1-1-ACL-EVIDENCE-BINDING-005 초기 검수(FABLE-SEC) 결과: 세 요구사항이 모두 충족돼 PASS다. (1) 005-1: 증거 문서 59-62행이 최종 verify 6/6을 V2 target commit 474d087…과 시험 SHA 380afade…a6575에 명시적으로 결속했고, 이 SHA는 현재 스냅샷의 admin-acl-audit.test.mjs blob(input_files sha256)과 정확히 일치한다. 53-54행의 SQL SHA c47665…도 스냅샷 admin-acl-audit.sql과 일치해 결속이 현재 판본에도 유효하다. (2) 005-2: 61-62행과 75-76행이 fresh_% DB 0개와 rls_disabled_app_tables=0·ledger_write_paths=32·unapproved_authenticated_rpc=87이 같은 V2 실행 값임을 명시했고, 값은 시험 163행(rls 고정 0)·205-206행(부채 상한 32/87)·217행(출력 형식)과 부합한다. (3) 005-3: 32-34행이 V1 '부채가 기준선을 넘었습니다'와 V2 '부채가 기준선을 넘었거나 정수가 아닙니다'의 차이를 정수 검사 추가로 설명했고, 시험 210-212행의 실제 문구 및 빈 문자열 입력 시 '관측= 기준선=32'(51행)와 정확히 일치한다. V2 사보타주 행 48-50의 stderr도 시험 181·133·102-104·116-118행과 대조해 일치함을 확인했다. 스냅샷에는 V1 시험 파일이 없어 V1 blob SHA 0596e56…은 문서의 기재와 공동 장부의 대조 진술로만 확인 가능하며, 이는 판정을 막지 않는다. 비차단 Improvement 1건(관측값 stdout 원문 미첨부·V1 blob 재현 경로 부재)을 제안 편집과 함께 기록했다. PASS는 외부 게이트를 닫지 않으며 gate_state는 OPEN으로 남는다.

### 공동 편집 제안 색인

- P1-1-BINDING-005-E1: REPLACE `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md` · 종료 후 `fresh_%` DB는 0개였다. 보안 관측값은 · 원문은 review.md 참조
- P1-1-BINDING-005-E2: COMMENT `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md` · | 판본 | target commit | `admin-acl-audit.test.mjs` SHA-256 | · 원문은 review.md 참조

- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
