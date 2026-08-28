
<!-- fable-review:r001 sha256=d213cf10a36f200a8c5cb6177bd28f73e281793ac9a523bf625317315cccb054 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `d213cf10a36f200a8c5cb6177bd28f73e281793ac9a523bf625317315cccb054`
- target_commit_sha: `d1942efdbe5ebaa01e858cc9813ef9763ffd9b61`
- input_files_sha256: `9c6adc7a947449121a4dd60f6ac50dcafd063395451760f60852d06969d76f9f`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P1-1-BINDING-004-FINAL-VERIFY-V2-UNBOUND
- 선택 미종결 Finding: P1-1-BINDING-004-V1-WORDING-NOTE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

증거 문서의 판본·해시·stderr 결속을 스냅샷 기준으로 대조했다. (1) V2 시험 SHA `380afade…`는 target commit의 `admin-acl-audit.test.mjs` blob SHA-256과 정확히 일치하고, 복구 후 SQL SHA `c47665ca…`도 target의 `admin-acl-audit.sql`과 일치한다(P1-1-EVIDENCE-1·3 전반 충족). (2) V2 행 4건(migrations 장부, `client['rpc']` 요소 접근, `client.rpc` 별칭, `ledger_write_paths` 빈 문자열)의 stderr는 현재 `fail()` 문구(test.mjs 133·181·212행)와 글자 단위로 일치하며, V1 행 10건도 현재 문구와 형식이 같다. 단 V1 38행의 `부채가 기준선을 넘었습니다`는 현재 문구(`넘었거나 정수가 아닙니다`)와 다른데, 이는 V1(`d0051c17…`)이 정수 검사 이전 판본이면 자연스럽지만 이 스냅샷에는 V1 blob이 없어 Codex가 `git show`로 실측해야 한다(P1-1-EVIDENCE-2는 V2 범위에서 충족, V1은 검증자 확인 필요). (3) 필수 지적 1건: `## 최종 검증` 절(55~71행)은 `corepack pnpm verify` 6/6·exit 0·fresh DB 0개·보안 관측값을 기록하면서도 어느 판본(V2 commit·시험 SHA)에서 실행했는지 명시하지 않아 P1-1-EVIDENCE-3의 "최종 verify 결과가 V2에 연결된다"를 문서만으로 입증하지 못한다. 관측값 87·32가 V2 DEBT_CEILING과 같다는 간접 정황만 있다. 해당 절에 V2 결속 문장을 추가하면 해소된다. 비차단 Improvement 1건(V1 38행 문구 차이 주석)은 별도 후속 범위다.

### 공동 편집 제안 색인

- P1-1-BINDING-004-EDIT-FINAL-VERIFY-V2: REPLACE `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md` · `corepack pnpm verify` 종료 코드는 0이었다. · 원문은 review.md 참조
- P1-1-BINDING-004-EDIT-V1-WORDING-NOTE: ADD `docs/ai-review/evidence/P1-1-ACL-SUPPORT-SOURCE-002.md` · `실제 stderr`는 `admin-acl audit 회귀시험 실패:` 접두사부터 검수가 출력한 문자열을 그대로 적었다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
