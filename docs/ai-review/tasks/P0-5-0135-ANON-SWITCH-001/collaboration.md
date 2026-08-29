# P0-5-0135-ANON-SWITCH-001 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`
- predecessor: `none`

계약 거부 후보 검수에서 찾은 0135 anon 전환 판별력 문제를 별도 공동 산출물 범위로 검수한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `03cd3634f18e1d2314c204fcfd7a33bb0c385ccc`
- changed_artifact_paths: `20260826000135_purge_and_anon_grants.sql`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: anon 전환 실패와 함수 실행 거부 분리, 시작 역할 복원 유지, 0001~0134 불변, 전체 로컬 게이트 유지
- 이번에 바꾼 내용: `set local role anon`을 함수 호출 예외 블록 밖으로 옮기고 `current_user='anon'`을 확인한 뒤, 함수 실행에서 발생한 insufficient_privilege만 성공 조건으로 센다. 정상·사보타주 역할 체인과 전체 0135 실행 증거를 공식 증거 문서에 추가했다.
- 집중 검토 질문: 전환을 예외 블록 밖으로 옮긴 구조가 공허한 42501 통과를 제거하는가? 정상 호스티드형 NOINHERIT 체인에서 시작 역할 복원이 가능한가? 기존 익명·PUBLIC 회수 및 authenticated 실행 계약을 약화하지 않는가?
- 실행한 테스트·현재 증거: 정상 `login→postgres→anon→postgres` 전환, 전환 권한 제거 시 즉시 42501, 0134 DB에서 수정 0135 전체 통과, `corepack pnpm verify` 6/6, 임시 DB 0개.
- 사람 결정이 필요한 항목: 없음. 스테이징 재적용과 P0-5-6 원격 audit는 이 코드 검수 뒤의 별도 운영 게이트다.
- next_review_request: `FABLE_REVIEW`

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

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `P0-5-0135-ANON-SWITCH-001`
- predecessor_round: `r001`
- predecessor_task_sha256: `6aff8a3994294e0266e4c22e607f93a36f8a8c225ed4ba6950f0f7dce250bd20`
- predecessor_manifest_sha256: `eed5ae16dabf00a6bd3fddbe3adb81df4a54a7c86aea1958ddea014cfa896d2c`
- predecessor_review_sha256: `9603071201067921b627ec74cf7ca3d9adb5f6299cd69ad5174afad213988857`
- predecessor_run_sha256: `aad406b0ccb882241fa02aecd51d84a8ef1852e8abea60da2640b6cce39c8bff`
- finding_registry_sha256: `21e162a6a9d49d387a7a01577683dc17ca859784fca1b63f4af64f6a97ea638f`
- successor_task_id: `P0-5-0135-ANON-SWITCH-002`
- successor_target_commit_sha: `325c3a477c6d529e928cd25996f7b3c5d8b3f362`
- next_review_request: `FABLE_RECHECK`
