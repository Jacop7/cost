
<!-- fable-review:r001 sha256=9603071201067921b627ec74cf7ca3d9adb5f6299cd69ad5174afad213988857 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `9603071201067921b627ec74cf7ca3d9adb5f6299cd69ad5174afad213988857`
- target_commit_sha: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`
- input_files_sha256: `33cfb34cd1c4fb4b0bb3726c353c2c39c0d8a7bda1e2cdf7cbbfa59715ec3ee3`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P05-0135-EVIDENCE-SHA-BINDING-001
- 선택 미종결 Finding: P05-0135-HOSTED-ROLE-CHAIN-PRECHECK-001, P05-0135-DENIAL-SOURCE-PIN-001
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

0135 사후 확인 블록의 anon 전환 판별력 보정은 보안 관점에서 올바르다. `set local role anon`(l.141)이 예외 서브블록 밖으로 나왔으므로 전환 자체의 42501은 더 이상 `v_ok`를 세우지 못하고 migration을 즉시 중단시키며, `current_user <> 'anon'` 사후조건(l.142-144)이 남은 틈을 막는다. `v_ok`를 true로 바꿀 수 있는 유일한 경로는 서브블록 안의 `perform public.purge_entity_changes()`(l.145-149)뿐이라 공허한 통과는 제거됐다. 서브트랜잭션 의미론도 맞다 — role GUC를 서브블록 이전에 바꿨으므로 42501 롤백이 role을 되돌리지 않고, `set local role %I` 명시 복원과 복원 사후조건(l.153-156)이 `session_user`가 아닌 시작 역할로 돌아간다. SET ROLE 멤버십은 session_user 기준으로 검사되므로 login(NOINHERIT)→postgres→anon→postgres 체인은 login이 postgres의, postgres가 anon의 멤버이면 성립한다. 파괴 경로 분석: l.146이 실제로 행을 지우려면 anon에 EXECUTE가 있어야 하는데 l.127-129 정적 검사가 그 전에 중단시키고, 설령 도달해도 `v_ok=false`로 l.157에서 예외가 나 migration 트랜잭션 전체가 롤백된다. anon·PUBLIC 회수(l.74-75, 82-85, 108-109)와 authenticated·service_role 실행 계약(l.77, 110, 133-135, 168-175)은 약화되지 않았다. 0136(참조)의 기본권한 보정과도 충돌하지 않는다.

한계와 남은 항목: (1) 참조 경로 `P0-5-RPC-LEAST-PRIVILEGE-006/r002/candidate-review.json`은 스냅샷에 실체화되지 않아 읽지 못했고, 스냅샷에는 0135·0136만 있어 0001~0134 불변은 코드로 확인할 수 없고 증거 문서 진술에 의존한다. (2) 그 증거 문서의 새 절(l.112-138)은 verify 6/6, "0135 한 파일뿐" diff, 역할 체인 관측을 기술하지만 같은 문서의 앞 절(l.4-6, 67-76, 100)과 달리 commit SHA·blob OID·관측값을 전혀 결속하지 않았고 l.6의 "기준 commit"은 이 과제의 baseline과 다른 `817b6b3`이다 — Minor 1건으로 등록하고 결속 문안을 proposed_edits로 제안했다. (3) 개선 2건: 호스티드 세션 역할 체인 사전 관측(스테이징 재적용 전), 잡은 42501을 `sqlerrm`으로 청소 함수에 고정. Minor 1건이 남아 CHANGES_REQUIRED이며, 코드 자체의 보안 속성은 충족됐다.

### 공동 편집 제안 색인

- P05-0135-EVIDENCE-BIND-EDIT-001: ADD `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md` · ### anon 전환과 실행 거부를 분리한 후속 보정 · 원문은 review.md 참조
- P05-0135-DENIAL-PIN-EDIT-001: REPLACE `packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql` ·   exception when insufficient_privilege then · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
