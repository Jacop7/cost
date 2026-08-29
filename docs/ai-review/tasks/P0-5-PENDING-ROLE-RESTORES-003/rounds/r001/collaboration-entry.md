
<!-- fable-review:r001 sha256=db8355cb5063770998fa18f18020b1a6d25568edbd81a493cb4a860f0bfc9f3c -->
## FABLE_RECHECK · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `PASS`
- review_sha256: `db8355cb5063770998fa18f18020b1a6d25568edbd81a493cb4a860f0bfc9f3c`
- target_commit_sha: `515845aa9c382c41f456bd9cf3a04e30b63ef608`
- input_files_sha256: `3debd47989eb7d155b49133348453bd1237a0f6b1f93d48be8bf527e5c2dbb35`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: 없음
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

predecessor r001의 Finding 네 건을 같은 ID·severity·category로 재검수했고 모두 target `515845a`에서 충족돼 VERIFIED로 판정한다.

① SEC-001(0144 매장 의존): 사후 확인 DO 블록에서 authenticated 전환 → `current_user` 확인 → `business_day_revisions` insert 거부(sqlerrm에 표 이름 필수) → `set local role %I` 명시 복원 → 복원 사후조건 검사가 179~200행으로 옮겨져 `select id into v_store … if v_store is null then return`(202~203행)보다 앞에 놓였다. fresh DB·매장 0개 스테이징에서도 반드시 실행된다. 증거 문서 276~292행은 `0143`까지 올린 일회용 DB에서 `stores=0`을 확인하고 `LOGIN NOINHERIT` 역할 체인(`cli_p0144_probe → set role postgres`)으로 0144를 적용해 전후 `current_user=postgres` 관측값을 기록했으며, 183행의 자체 단언이 통과했으므로 전환 분기가 실제 실행됐음이 증명된다.

② SEC-002(판본 결속): 증거 문서 299~310행의 10개 migration blob OID·SHA-256 표를 이번 입력 manifest(target `515845a`)와 대조한 결과 10개 모두 정확히 일치한다. predecessor 검수 target `8466d12`의 blob과 비교하면 0137·0144·0145 세 파일만 바뀌었고(문서 314행 기술과 일치), 0138·0139·0150·0151·0158·0163·0165는 동일하다. `git diff --name-only 9e4f502..022b476 -- migrations`가 10개뿐이며 0001~0136이 포함되지 않음도 기록됐다. 구현 commit `022b476`과 target 사이의 차이는 blob 동일성으로 결속된다.

③ SEC-003(0137 분리자): 246~247행이 `pg_get_functiondef` 결과의 CRLF를 LF로 정규화한 뒤 `chr(10)`으로 분리하도록 바뀌어 checkout 줄끝과 무관하다.

④ SEC-004(0145 치환 무효): 229~232행이 `v_old || chr(10) || '       and v_status <> ''closed'''` 두 줄 결합 anchor의 존재를 먼저 확인하고 없으면 예외로 중단한다. 0139가 `concat_ws(chr(10), …)`로 같은 두 줄(267~268행, 7칸 들여쓰기)을 LF로 넣으므로 첫 적용은 일치하고, 226행의 조기 return으로 재적용 계약도 유지된다.

세 파일의 변경은 사후 확인·표식 검사에 국한돼 제품 계산·RPC·원장·판본 계약을 바꾸지 않는다. 증거 문서 316~329행은 정확한 구현 commit clean checkout에서 verify 6/6·업그레이드 9/9·`fresh_%` 0개를 기록했고, 스테이징은 `0136`까지·보정 미적용·운영 미접근이라는 실패 폐쇄 상태를 정직하게 적었다(264~265행, 328~329행).

PASS는 로컬 검수 통과일 뿐이며 스테이징 재적용·원격 ACL audit(P1-1:REMOTE-ACL-AUDIT)·보호 CI 게이트는 여전히 OPEN이다. 새 Finding은 없다.

### 공동 편집 제안 색인

- 없음


- next_review_request: `AI_DEPUTY_GATE_REVIEW`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
