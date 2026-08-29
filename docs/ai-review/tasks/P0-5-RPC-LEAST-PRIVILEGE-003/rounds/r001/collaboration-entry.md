
<!-- fable-review:r001 sha256=7838da4bf6cf538f94c0745a4a84d40c688ebcae928aa14c0472bad56bfb7924 -->
## FABLE_REVIEW · turn-f001 · r001

- role: `FABLE-SEC`
- reviewer_engine: `FABLE`
- reviewer_model: `claude-fable-5`
- verdict: `CHANGES_REQUIRED`
- review_sha256: `7838da4bf6cf538f94c0745a4a84d40c688ebcae928aa14c0472bad56bfb7924`
- target_commit_sha: `bebf4488306d0d6e4b3fe49169cde0298717e459`
- input_files_sha256: `0dc06cd3b0fabcefbdd0ca8b3433dffd9c6bbc95b3749c23ce984aee1dddf363`
- 원본 검수: [r001/review.md](./rounds/r001/review.md)
- 필수 미종결 Finding: P05-SEC-EVIDENCE-HASH-MISMATCH, P05-SEC-EXECUTOR-BLANKET-EXECUTE, P05-SEC-FACADE-CROSS-STORE-TEST-GAP
- 선택 미종결 Finding: P05-SEC-HOSTED-ADMIN-OPTION-NOTE
- 닫힌 Finding: 없음
- 재개방 Finding: 없음

### 요약

0174 설계 자체는 건전하다. sikjae_rpc_executor는 NOLOGIN·NOBYPASSRLS이고 authenticated→executor 멤버십이 없어 앱이 SET ROLE로 전환할 수 없으며, executor가 authenticated를 INHERIT하므로 `to authenticated` RLS 정책이 executor definer facade 안에서도 그대로 적용된다. 표 소유자는 postgres라 executor에 RLS가 강제되고, auth.uid()는 요청 GUC를 읽어 definer 전환 후에도 원 사용자를 식별한다. my_store_ids() 인라인은 0173의 정의(owner_id = auth.uid() and archived_at is null)와 동일 술어이며, 사후조건이 잔존 호출·소유 facade의 prosecdef/search_path·64개 정확 시그니처·미래 함수 기본 권한을 실제 객체로 검증한다. 함수 몸통에 동적 SQL(execute format)이 없어 definer 승격 후 주입 경로도 확인되지 않았다.

그러나 세 가지를 요구한다. (1) Major: 증거 문서가 구현 커밋 59077f01을 가리키고, admin-acl-audit.sql·.test.mjs의 SHA-256(7f08…, 226f…)이 이번 봉인 대상 blob(069ea4…, 198ff1…)과 다르다. 즉 34/34·metric 20개·사보타주 3종은 검수 대상과 다른 감사 스크립트로 얻은 결과이며, 원격 적용도 없어 P0-5-6은 증거상 판정 불가다. 같은 target commit에서 증거를 재생성해야 한다. (2) Minor: `grant execute on all functions … to sikjae_rpc_executor`와 기본 권한이 purge_archived_store·schedule_store_purge·purge_entity_changes·close_due_business_days 같은 postgres definer 유지보수 함수까지 실행 역할에 열어 최소 권한 원칙에 어긋난다. 현재 facade 몸통이 이를 부르지 않아 즉시 우회로는 아니지만, 60여 facade의 실행 컨텍스트가 매장 파괴 함수 실행권을 가질 이유가 없다. (3) Minor: 34번은 authenticated로 facade를 통과한 교차 매장 거부(P0-5-4의 핵심 성질)를 재지 않고 stores 직접 SELECT만 확인한다. 사보타주도 플래그 검사에 그쳐 executor에 bypassrls가 붙었을 때 행동 단언이 잡는지 증거가 없다. 운영 참고: PG16+ 호스티드에서 `grant authenticated to sikjae_rpc_executor`는 postgres의 ADMIN OPTION에 의존하므로 스테이징 적용 시 rpc_executor_role=1을 먼저 확인해야 한다.

### 공동 편집 제안 색인

- P05-EDIT-EXECUTOR-REVOKE-MAINT: ADD `packages/db/supabase/migrations/20260829000174_rpc_least_privilege.sql` ·   grant execute on all functions in schema public to sikjae_rpc_executor, service_role; · 원문은 review.md 참조
- P05-EDIT-TEST34-CROSS-STORE: ADD `packages/db/tests/34_rpc_least_privilege.sql` · -- ── 3. 내부 몸통은 PostgREST에서 직접 호출할 수 없다 ─────────────────────── · 원문은 review.md 참조

- next_review_request: `SOLAR_RESPONSE`

> 다음 담당자는 이 아래에 같은 공동 산출물의 수정 내용·Finding별 답변·검증 증거를 새 턴으로 추가합니다. 이전 턴은 고치거나 지우지 않습니다.
<!-- /fable-review:r001 -->
