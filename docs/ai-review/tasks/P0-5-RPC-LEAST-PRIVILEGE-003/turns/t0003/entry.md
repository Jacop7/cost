
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `7838da4bf6cf538f94c0745a4a84d40c688ebcae928aa14c0472bad56bfb7924`
- target_commit_sha: `e8e22dbce1b778a74061d5c1fb801eec2402d906`
- changed_artifact_paths: `packages/db/supabase/migrations/20260829000175_rpc_executor_narrowing.sql`, `packages/db/tests/34_rpc_least_privilege.sql`, `packages/db/scripts/admin-acl-audit.sql`, `packages/db/scripts/admin-acl-audit.test.mjs`, `packages/db/tests/16_change_retention.sql`, `packages/db/tests/26_auto_close_sweep.sql`, `packages/db/tests/33_account_retention.sql`, `packages/db/README.md`, `docs/ai-review/evidence/P0-5-RPC-LEAST-PRIVILEGE-001.md`

### P05-SEC-EVIDENCE-HASH-MISMATCH

- disposition: `APPLIED`
- 적용 내용: 검증 commit을 `e8e22db`로 고정해 전체 `pnpm verify` 6/6을 다시 실행했다. 증거 문서는 이 commit의 Git blob bytes에서 계산한 OID와 SHA-256을 기록하며 ACL metric은 현재 21개다.
- 원격 범위: P0-5-6은 통과로 위장하지 않는다. 동일 SHA 보호 CI와 FABLE-SEC 재검수 뒤 스테이징에 적용하고 원격 audit을 별도 판정한다는 사람 결정으로 보류 상태를 명시했다.
- 필요한 재검수: successor COMMIT snapshot에서 증거 문서 해시와 봉인 artifact blob을 대조한다.

### P05-SEC-EXECUTOR-BLANKET-EXECUTE

- disposition: `APPLIED`
- 적용 내용: 0175에서 executor의 미래 함수 기본 EXECUTE를 회수하고, 앱에 열리지 않은 postgres SECURITY DEFINER 전부를 executor에서 회수했다. 매장 파괴·전역 스위프 4개 시그니처의 명시적 사후조건도 추가했다.
- 테스트: ACL metric `rpc_executor_privileged_maintenance=0`, 34번의 동일 단언과 `purge_archived_store` 직접 42501, 미래 함수의 executor 자동 공개 금지를 추가했다.
- 판별력: 유지보수 함수 EXECUTE를 재개방하면 ACL 감사와 34번이 실패하고 원복 뒤 통과한다.

### P05-SEC-FACADE-CROSS-STORE-TEST-GAP

- disposition: `APPLIED`
- 적용 내용: 실제 authenticated 역할로 다른 사장님의 매장·식재료를 만든 뒤 `get_settings`·`save_category`·`ingredient_detail` facade의 빈 결과 또는 42501을 행동으로 확인한다.
- 판별력: executor에 BYPASSRLS를 부여하면 단순 역할 플래그보다 앞의 실제 `get_settings(foreign_store)` 행동 단언이 실패한다. 원복 뒤 `rolbypassrls=false`와 34번 통과를 확인했다.

### P05-SEC-HOSTED-ADMIN-OPTION-NOTE

- disposition: `NEEDS_HUMAN_DECISION`
- 결정: 스테이징 적용 전에는 완료로 표시하지 않는다. 정확한 SHA의 보호 CI와 FABLE-SEC 재검수 후 스테이징 적용에서 `rpc_executor_role=1`과 원격 audit을 기록한다.
- 재검토 조건: 스테이징 배포 계획·적용 시점.

- next_review_request: `CODEX_EVIDENCE`
