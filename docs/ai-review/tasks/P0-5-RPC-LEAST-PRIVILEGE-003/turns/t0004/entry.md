
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- finding_ids: `P05-SEC-EVIDENCE-HASH-MISMATCH`, `P05-SEC-EXECUTOR-BLANKET-EXECUTE`, `P05-SEC-FACADE-CROSS-STORE-TEST-GAP`, `P05-SEC-HOSTED-ADMIN-OPTION-NOTE`
- verified_commit_sha: `e8e22dbce1b778a74061d5c1fb801eec2402d906`
- 전체 게이트: `corepack pnpm verify` 종료 코드 0, 6/6 통과. 타입, DB 34/34, core 177(2 skipped), mobile 199, CLI·ACL 보안, 새 DB 전체 migration·ACL metric 21·2세션 경합·locale parity, 업그레이드 9/9, 웹 번들을 포함한다.
- 대상 시험: 개발 DB의 DB 34/34와 `admin-acl-audit.test.mjs postgres`가 통과했다. 관측값은 `rls_disabled_app_tables=0`, `ledger_write_paths=0`, `unapproved_authenticated_rpc=0`, `facade_rpc_missing=0`, `rpc_executor_privileged_maintenance=0`이다.
- 판별력: 유지보수 함수 EXECUTE 재개방과 executor BYPASSRLS 부여가 각각 새 metric·실제 authenticated 교차 매장 facade 행동 단언을 실패시켰다. 각 원복 뒤 34번과 감사가 재통과했고 `rolbypassrls=false`를 확인했다.
- 판본 결속: 증거 문서에 검증 commit Git blob OID와 SHA-256을 기록했다. 0174=`a0f7e51e…/f3d4f111…`, 0175=`63347d89…/13a42e1e…`, test34=`b61c514f…/fb7c34b3…`, audit SQL=`526abbd2…/09fa1ece…`, audit test=`0b670ad8…/dcaadd9a…`다.
- 환경 정리: 전체 검증 종료 뒤 `fresh_%` 임시 DB 0개다.
- 미실행 항목: 스테이징 원격 적용·`admin-acl.sh --remote audit`은 정확한 SHA 보호 CI와 FABLE-SEC 재검수 뒤 실행한다. 현재 P0-5-6 또는 원격 ACL 통과로 판정하지 않는다.
- 증거 파일: `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`
- next_review_request: `AI_DEPUTY_SUCCESSOR_HANDOFF`
