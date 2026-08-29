# P0-5-0135-ANON-SWITCH-002 Fable 검수 — r001

- 판정: **PASS**
- 역할: `FABLE-SEC`
- 검수 엔진: `FABLE`
- 검수 모델: `claude-fable-5`
- 모드: `RECHECK`
- 스냅샷: `COMMIT`
- 대상 SHA: `325c3a477c6d529e928cd25996f7b3c5d8b3f362`

## 요약

P0-5-0135-ANON-SWITCH-001 r001의 Finding 3건을 같은 ID로 재검수했다.

코드(0135 l.137-161): 이전 라운드의 구조(전환을 서브블록 밖에서 수행 → `current_user='anon'` 사후조건 → 서브블록 안 `perform` → `set local role %I` 명시 복원 → 복원 사후조건 → `v_ok` 검사)는 유지됐고, 새로 l.148-151이 잡힌 42501의 `sqlerrm`에 `purge_entity_changes`가 없으면 원문을 포함한 자체 예외로 중단한다. 함수 EXECUTE 거부 메시지(`permission denied for function purge_entity_changes`)만 통과하고 스키마 USAGE 거부(`permission denied for schema public`)는 걸러진다. 핸들러 안의 `raise exception`은 서브블록 밖으로 전파돼 DO 블록과 migration 트랜잭션 전체를 중단시키므로 fail-closed다. anon에 EXECUTE가 있으면 l.127-129 정적 검사가 먼저 막고, 도달하더라도 `v_ok=false`로 l.161에서 예외가 나 삭제는 롤백된다. anon·PUBLIC 회수(l.74-75, 82-85, 108-109)와 authenticated·service_role 실행 계약(l.77, 110, 133-135, 172-179)은 변경 없음. 0136(참조)과의 충돌 없음.

증거(문서 l.140-181): 기준 9559b3b·첫 분리 03cd363·최종 구현 bb1ecc5, 0135 blob OID `034a47fb…`·SHA-256 `009190fa…`가 명시됐고, 이 값은 이번 스냅샷 input_files의 0135 blob OID·SHA-256과 정확히 일치한다. 정상 체인 4단계 관측값(l.157-162), 사보타주 `42501: permission denied to set role "anon"`(l.166-168), 스키마 USAGE 사보타주의 자체 오류(l.173-176), 재확인 시각(l.142), 두 SHA 사이 diff 주장(l.150), 절 범위 명시(l.180-181)가 모두 채워져 SHA-BINDING-001의 수용 기준 4개를 충족한다 → VERIFIED. DENIAL-SOURCE-PIN-001도 제안 편집과 동일하게 구현되고 요구한 사보타주 시험이 기록돼 VERIFIED. HOSTED-ROLE-CHAIN-PRECHECK-001은 SOLAR가 스테이징 적용 직전 관측 항목으로 유지한다고 답해 아직 수행되지 않았으므로 OPEN(Improvement, 비차단).

한계: (1) 참조 `P0-5-RPC-LEAST-PRIVILEGE-006/r002/candidate-review.json`은 이번에도 스냅샷에 실체화되지 않았다. (2) 스냅샷에는 0135·0136만 있어 "기준 이후 migration 변경 0135 하나"와 verify 6/6은 문서·장부 진술이며, 증거 절의 최종 구현 commit(bb1ecc5)과 검수 target(325c3a4)이 다르므로 Codex가 bb1ecc5..325c3a4 사이에도 migration 변경이 없고 0135 blob이 `034a47fb…`인지 확인해야 한다. (3) evidence_paths가 비어 있어 Codex 실행 증거는 별도 게이트에서 결속돼야 한다. 필수 등급의 미해결 Finding이 없어 PASS이나, 외부 게이트·스테이징 적용 승인은 열려 있다.

## Findings

### P05-0135-EVIDENCE-SHA-BINDING-001 — Minor / VERIFIED

- 범주: POLICY
- 검증 엔진: FABLE
- 영향: 이 과제의 보안 판정 근거(정상 체인·사보타주 42501·스키마 USAGE 사보타주·0134 DB 전체 실행·verify 6/6·0001~0134 불변)가 어느 commit·blob에 대한 것인지 재현·감사할 수 있게 됐다. 남는 것은 최종 구현 commit(bb1ecc5)과 검수 target(325c3a4) 사이 migration 무변경 확인과 Codex의 독립 재실행이며, 이는 외부 게이트 항목이다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:140, COLLABORATION_LOG:0, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:155, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:150, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:178, AGENTS.md:24
- 완료 조건: 후속 보정 절에 기준 commit·구현 commit과 0135 blob OID·SHA-256을 명시한다(문서 l.143-148로 충족, 스냅샷 manifest와 일치). / 정상 체인의 관측된 (session_user, current_user) 4단계와 사보타주 역할의 정확한 오류 문구·SQLSTATE를 실제 출력 그대로 적는다(l.157-168로 충족). / '기준 commit 이후 migration 변경 파일이 0135 하나뿐' 주장을 비교한 두 SHA와 함께 적고 verify 6/6 확인 시각을 기록한다(l.142, l.150-153으로 충족). / 문서 머리의 확인 시각·검증 commit이 최신 절과 절별 SHA로 구분된다(l.180-181로 충족).
- 필요한 테스트: Codex: target 325c3a477c6d529e928cd25996f7b3c5d8b3f362에서 0135 blob OID가 034a47fb0af9c9f0820dcb08a76205f1e4a74a87인지 확인 / Codex: 9559b3b..325c3a4(bb1ecc5..325c3a4 포함) 사이 packages/db/supabase/migrations 변경 파일 목록이 0135 하나인지 확인 / Codex: 325c3a4에서 corepack pnpm verify 6/6과 fresh_% 잔여 0개 재실행

### P05-0135-HOSTED-ROLE-CHAIN-PRECHECK-001 — Improvement / OPEN

- 범주: SECURITY
- 영향: 스테이징 재적용이 0135 l.141 또는 l.150에서 중단될지 여부가 실제 적용 시점에야 드러난다. 안전 방향(fail-closed)이라 보안 위험은 아니지만 배포 계획 가시성이 낮다. PASS를 막지 않는다.
- 근거: docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:91, packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql:141, docs/브랜치-DB-운영-기획안.md:284, COLLABORATION_LOG:0
- 완료 조건: 스테이징 재적용 계획 단계에서 같은 접속 경로로 session_user, current_user, pg_has_role(session_user,'anon','member'), pg_has_role(session_user,'postgres','member'), has_schema_privilege('anon','public','usage')를 읽기 전용으로 관측해 기록한다. / 관측 결과 anon 전환 또는 public USAGE가 불가능하면 0135를 적용하기 전에 별도 결정으로 회부한다.
- 필요한 테스트: 스테이징 읽기 전용 세션에서 위 5개 값 조회(변경 없음)

### P05-0135-DENIAL-SOURCE-PIN-001 — Improvement / VERIFIED

- 범주: TEST_GAP
- 검증 엔진: FABLE
- 영향: 행동 증거가 '청소 함수 실행 거부'를 특정해 증명하게 됐다. 정적 검사(l.127-129)와 결합해 anon 실행 차단의 보안 결론이 이중으로 고정된다.
- 근거: packages/db/supabase/migrations/20260826000135_purge_and_anon_grants.sql:145, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:170, docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md:150
- 완료 조건: insufficient_privilege 처리에서 sqlerrm에 'purge_entity_changes'가 포함될 때만 v_ok를 세우고, 그렇지 않으면 원문 메시지를 포함해 예외로 중단한다(l.147-152로 충족). / 로컬 fresh DB와 업그레이드 경로에서 0135가 그대로 통과한다(증거 l.150-153으로 충족).
- 필요한 테스트: Codex: 325c3a4에서 anon의 public USAGE 일시 회수 사보타주로 0135가 '청소 함수가 아닌 곳' 메시지로 실패하는지 재확인 후 원복

## 공동 편집 제안

없음

## 상태 변경

- 닫힘: 없음
- 재개방: 없음
- 필수 미해결: 없음

> 이 문서는 Claude의 원시 출력을 복사한 것이 아니라, Codex 실행기가 판본·스키마·증거 경로를 검증해 정규화한 기록입니다.
