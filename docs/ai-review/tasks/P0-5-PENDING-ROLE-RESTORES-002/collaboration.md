# P0-5-PENDING-ROLE-RESTORES-002 공동 작업 장부

- protocol: `1.2`
- route: `SECURITY`
- target: `8466d12f20572c4590c5678f96130d080cd717ef`
- predecessor: `null`
- failed-attempt-evidence: `P0-5-PENDING-ROLE-RESTORES-001/r001`

같은 구현 SHA의 선행 검수는 `$4.130274` 환산 사용량에서 구조화 결과를 만들기 전에
`error_max_budget_usd`로 끝났다. 실패 run과 입력 hash를 그대로 보존하고, 사용자가 승인한 새 Task
상한에서 보안 결론을 다시 요청한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `null`
- target_commit_sha: `8466d12f20572c4590c5678f96130d080cd717ef`
- changed_artifact_paths: `0137`, `0138`, `0139`, `0144`, `0145`, `0150`, `0151`, `0158`, `0163`, `0165`, `P0-5 evidence`
- 충족해야 할 요구사항·불변식: migration 시작 역할 명시 복원, 역할 전환과 대상 행동 거부 분리, 정확한 거부 원천 확인, Windows CRLF/LF 동일 적용, 0001~0136 불변, 제품 계약 불변, 원격 게이트 미완료의 정직한 표시
- 이번에 바꾼 내용: 아직 스테이징에 미적용인 역할 검사 네 파일에서 `reset role`을 제거하고 시작 역할을 보존·명시 복원했다. clean Windows checkout에서 실패한 함수 정의 조각 비교 일곱 파일은 정의와 anchor를 LF로 정규화했다. 실패·재현·집중 시험·전체 verify를 기존 증거 문서에 추가했다.
- 집중 검토 질문: 역할 전환 실패나 무관한 42501을 행동 거부로 오인할 길이 남았는가? 명시 복원이 트랜잭션의 원래 실행 권한을 정확히 되돌리는가? 줄끝 정규화가 실제 SQL 코드 의미나 치환 범위를 넓히지 않는가? 0139 재적용 표식이 주석·부분 문자열에 공허하게 통과할 수 있는가? 증거가 아직 미완료인 스테이징 재적용·원격 audit을 과장하는가?
- 실행한 테스트·현재 증거: NOINHERIT 역할 체인 집중 시험 통과, CRLF clean checkout에서 각 파일 첫 적용 통과, 지원 파일 재적용 통과, 전체 migration·seed 성공, 최종 target의 `corepack pnpm verify` 6/6과 업그레이드 9/9, `fresh_%` 0개.
- 사람 결정이 필요한 항목: 없음. 운영은 범위 밖이며 스테이징 적용과 원격 audit은 이 검수·보호 CI 뒤 별도 게이트다.
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- reply_to_turn_id: `turn-s001`
- finding_ids: `[]`
- decision_id: `P0-5-PENDING-ROLE-RESTORES-BUDGET-20260829`
- task_budget_usd_approved: `6.00`
- 결정: 선행 검수 실패 기록을 보존하고 같은 구현 SHA를 새 FABLE-SEC Task로 재검수한다.
- 허용 범위·기한: `P0-5-PENDING-ROLE-RESTORES-002` 읽기 전용 검수, 2026-08-29 현재 작업 완료까지.
- 근거: 사용자가 선행 `$4` 상한 종료를 확인한 뒤 추가 `$6` 상한을 승인했다.
- 승인자·시각: `USER · 2026-08-29T19:23:00+09:00`
- next_review_request: `FABLE_REVIEW`

<!-- fable-review:r001 sha256=c91e44fcc1970bdbe280d911bf888a7c6dc1e6a33b95d5096bff6e50a195c3a5 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `c91e44fcc1970bdbe280d911bf888a7c6dc1e6a33b95d5096bff6e50a195c3a5`
- target_commit_sha: `8466d12f20572c4590c5678f96130d080cd717ef`
- input_files_sha256: `102acb26d4c8ddf0a9ada800a8605e251cfc4def323469c5b71a0f2ea7d0d24d`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P0-5-PRR-002-SEC-001, P0-5-PRR-002-SEC-002
- 선택 미종결 Finding: P0-5-PRR-002-SEC-003, P0-5-PRR-002-SEC-004
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

보안 핵심은 통과다. 0137·0138·0139·0144 네 파일 모두 0135와 같은 모양으로 (1) DO 블록 진입 시 `current_user`를 `v_original_role`에 보존하고, (2) `set local role authenticated`와 `current_user` 확인을 대상 호출의 예외 블록 **밖**에서 끝내며, (3) 예외 블록은 `insufficient_privilege`만 잡고 `sqlerrm`에 정확한 대상 이름(`close_due_business_days`·`close_business_day_row`·`business_day_revisions`)이 있어야 성공으로 세고, (4) `set local role %I`로 시작 역할을 명시 복원한 뒤 사후조건까지 확인한다. 전환 실패·스키마 USAGE 거부·무관한 42501은 모두 migration 중단으로 흐르며, 0144는 권한이 열렸더라도 트리거 42501 메시지에 표 이름이 없어 fail-closed다. 복원은 `set local`이라 트랜잭션 밖 세션 역할을 바꾸지 않고, 자기 자신·멤버 역할로의 SET ROLE 규칙상 NOINHERIT 로그인 체인에서도 성립한다. 0139 적용 표식은 4칸·7칸 들여쓰기의 두 코드 줄을 LF로 이어 확인하므로 주석·부분 문자열로는 통과하지 않고, 즉시 재적용 계약도 유지된다. 0145·0150·0151·0158·0163·0165의 CRLF 정규화는 비교용 문자열과 `pg_get_functiondef` 결과에만 적용되고 anchor 범위·치환 내용은 그대로라 계산·RPC·원장·판본 계약을 바꾸지 않는다. 증거 문서는 스테이징 재적용·원격 audit 미완료를 정직하게 적었다.

남은 것은 증거 결속 두 건(Minor)이다. ① 0144의 역할 전환·복원 검사는 `stores` 행이 없으면 통째로 건너뛰므로(179~180행) fresh DB에서는 실행되지 않고, "0137~0144 복원 확인" 집중 시험이 0144에 대해 공허했을 수 있다 — 매장 존재를 증거에 명시하거나 검사를 매장 의존 구간 앞으로 옮겨야 한다. ② 최종 검증 섹션은 `e41a927`에 결속돼 있고 검수 대상은 `8466d12`인데, 두 commit 간 migration blob 동일성과 "baseline 이후 변경 10개뿐" 주장이 앞 절들과 달리 blob OID·diff 없이 산문으로만 남아 있다. 개선 2건(0137의 raw 개행 분리자, 0145 §②-b 치환 무효 미검출)은 PASS를 막지 않는다.

### 공동 편집 제안 색인

- P0-5-PRR-002-EDIT-001: REPLACE `packages/db/supabase/migrations/20260826000144_amend_foundation.sql` ·   select id into v_store from public.stores limit 1; · 원문은 review.md 참조
- P0-5-PRR-002-EDIT-002: DELETE `packages/db/supabase/migrations/20260826000144_amend_foundation.sql` ·   -- 감사 기록을 앱 롤이 직접 못 쓴다. 권한 값이 아니라 **실제로** 확인한다. · 원문은 review.md 참조
- P0-5-PRR-002-EDIT-003: ADD `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md` · 이 결과는 스테이징 재적용 성공이나 원격 ACL 감사 완료를 뜻하지 않는다. 다음 단계는 이 정확한 · 원문은 review.md 참조
- P0-5-PRR-002-EDIT-004: REPLACE `packages/db/supabase/migrations/20260826000137_close_due_cron.sql` ·       cross join lateral regexp_split_to_table(pg_get_functiondef(p.oid), E' · 원문은 review.md 참조
- P0-5-PRR-002-EDIT-005: REPLACE `packages/db/supabase/migrations/20260826000145_amend_ended_business_day.sql` ·   -- 조건 첫 줄을 통째로 바꾼다. 뒤의 `and v_status <> 'closed'` 부터는 그대로다. · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->

## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- finding_ids: `P0-5-PRR-002-SEC-001`, `P0-5-PRR-002-SEC-002`, `P0-5-PRR-002-SEC-003`, `P0-5-PRR-002-SEC-004`
- disposition: `APPLIED`
- `P0-5-PRR-002-SEC-001`: `0144`의 authenticated 전환·감사 표 직접 쓰기 거부·시작 역할 복원을 매장 조회보다 앞으로 옮겨 매장 0개인 fresh migration에서도 실행되게 했다.
- `P0-5-PRR-002-SEC-002`: 증거 문서에 baseline 이후 migration diff 10개와 구현 commit의 Git blob OID·SHA-256을 모두 고정했다.
- `P0-5-PRR-002-SEC-003`: `0137`이 함수 정의의 CRLF를 LF로 정규화하고 `chr(10)`으로 줄을 나누게 했다.
- `P0-5-PRR-002-SEC-004`: `0145`가 두 줄 결합 anchor를 못 찾으면 예외로 중단하게 했다.
- 구현 commit: `022b476fc332c312bd79461f006190eeb7e8331e`
- next_review_request: `CODEX_EVIDENCE`

## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P0-5-PRR-002-SEC-001`, `P0-5-PRR-002-SEC-002`, `P0-5-PRR-002-SEC-003`, `P0-5-PRR-002-SEC-004`
- 매장 0개 집중 시험: `session_user=cli_p0144_probe`, 적용 전후 `current_user=postgres`, `stores=0`; 보정된 `0144` 적용 뒤 시작 역할 복원 확인. 이어 `0145` 첫 적용·재적용 모두 성공.
- 판본 결속: baseline `9e4f502`에서 구현 commit `022b476`까지 migration 변경은 증거 문서의 정확한 10개뿐이고 `0001~0136`은 포함되지 않는다. 각 파일의 Git blob OID·SHA-256을 증거에 기록했다.
- 전체 검증: 깨끗한 `022b476` checkout에서 `corepack pnpm verify` exit 0. DB `34/34`, core `177`(2 skip), mobile `199`, ACL, 새 DB·경합·locale parity, 업그레이드 `9/9`, 웹 번들까지 6/6. 종료 뒤 `fresh_%` 0개.
- 원격 상태: 운영은 미접근·미변경. 스테이징은 여전히 `0136`까지이며 보정 migration은 재적용하지 않았다.
- 증거 문서: `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`

## AI_DEPUTY_SUCCESSOR_HANDOFF · turn-o001 · r001

- role: `AI-DEPUTY-ORCHESTRATOR`
- predecessor_task_id: `P0-5-PENDING-ROLE-RESTORES-002`
- predecessor_round: `r001`
- predecessor_task_sha256: `fd173bd731f7deaf7a06645750ba439529a5cbf5cf0bd44d17d84d2ba7f8ae78`
- predecessor_manifest_sha256: `1c7dfb6181a133f199093268b792d791b6cff1e7f1f6c76a1db0327b6bb6c3c3`
- predecessor_review_sha256: `c91e44fcc1970bdbe280d911bf888a7c6dc1e6a33b95d5096bff6e50a195c3a5`
- predecessor_run_sha256: `e62bc50b34040e5604b4459db3716c45ea342ebb390254bb58813cb7ecc37e28`
- finding_registry_sha256: `9a72b4e14d9883b4e1b367da698c7c1b52c7d6566f7fbf4e63a840ae4a66c794`
- successor_task_id: `P0-5-PENDING-ROLE-RESTORES-003`
- successor_target_commit_sha: `515845aa9c382c41f456bd9cf3a04e30b63ef608`
- next_review_request: `FABLE_RECHECK`
