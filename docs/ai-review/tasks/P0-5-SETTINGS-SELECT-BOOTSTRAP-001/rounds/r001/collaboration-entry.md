
<!-- fable-review:r001 sha256=ca371309c71647464c619e9b9e3715d7d107bc2b345acf77e3ab3976b2e6ee0f -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `ca371309c71647464c619e9b9e3715d7d107bc2b345acf77e3ab3976b2e6ee0f`
- target_commit_sha: `ff342e0890c4d05562d62ebfd14c6bd9246f4dd2`
- input_files_sha256: `5f4438f72008f6fee2cc14b56c6a52aff4750beb63b9b06f1c49e00164f4ad34`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P0-5-SSB-001-SEC-001, P0-5-SSB-001-SEC-002, P0-5-SSB-001-SEC-003, P0-5-SSB-001-SEC-004
- 선택 미종결 Finding: 없음
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

0164의 권한 부트스트랩 자체는 보안상 건전하다. `grant select` 뒤 `revoke insert, update, delete, truncate`를 anon·authenticated 모두에서 수행하고, 쓰기 정책 3개와 동기화 트리거를 제거하며, save_settings·save_store_tax는 SECURITY DEFINER + `set search_path` + 첫 줄 `assert_my_store`로 매장 경계를 유지한다. `has_table_privilege`는 PUBLIC 경유 권한까지 반영하므로 사후조건이 호스티드 역할 구성에서도 실질 권한을 판정한다. 직접 쓰기 문 재개방이나 RLS 우회는 발견되지 않았고, 스테이징 0163 상태·보정 미적용·운영 미접근 기록은 과장 없이 정직하다. 그러나 (1) 증거 문서는 verify 6/6·업그레이드 10/10을 `fb5b4b08`에 결속하고 있어 task target `ff342e08`과 다르며, 0164·upgrade-check.sh의 Git blob OID·SHA-256 결속도 없다 — 요구사항 6 "정확한 target commit의 verify 6/6 증거"가 문서상 충족되지 않는다(Major). (2) 0164 사후조건은 TRUNCATE를 검사하지 않아 요구사항 2의 네 종 폐쇄를 migration 스스로 증명하지 못한다(Minor). (3) SELECT 부여가 의존하는 settings RLS 활성·읽기 정책 존재를 사후조건이 단언하지 않는다(Minor). (4) 업그레이드 ⑩은 사전 상태를 SELECT=f만 확인하고 쓰기 4종 열림(f|t|t|t|t)을 단언하지 않아 회수 절반이 공허 통과할 여지가 있다(Minor). Major 1건으로 CHANGES_REQUIRED.

### 공동 편집 제안 색인

- P0-5-SSB-001-EDIT-001: ADD `packages/db/supabase/migrations/20260826000164_settings_lockdown.sql` ·   if not has_table_privilege('authenticated', 'public.settings', 'select') then · 원문은 review.md 참조
- P0-5-SSB-001-EDIT-002: REPLACE `packages/db/scripts/upgrade-check.sh` ·   "select has_table_privilege('authenticated','public.settings','select');") · 원문은 review.md 참조
- P0-5-SSB-001-EDIT-003: ADD `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md` · ### 정확한 commit 전체 검증 · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
