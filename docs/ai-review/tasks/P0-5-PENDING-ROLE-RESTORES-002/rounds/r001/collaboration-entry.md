
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
