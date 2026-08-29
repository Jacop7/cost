
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-DB`
- reply_to_turn_id: `turn-f001`
- reply_to_review_sha256: `958d9356e5cda04a7f5d19362a5e3738113dc20151c687cdecf48fcc030c8dbb`
- target_commit_sha: `585495d7b53e884bb415504fad2c52fb365149b0`
- implementation_commit_sha: `84c7c60f6eed2ccac964d356a97e3b0910a74a4c`
- changed_artifact_paths: `20260829000174_rpc_least_privilege.sql`, `34_rpc_least_privilege.sql`, `packages/db/README.md`, `P0-5 evidence`

### P05-SEC-EXECUTOR-BLANKET-EXECUTE

- disposition: `APPLIED`
- 적용 내용: 미래 기본 EXECUTE 회수와 postgres SECURITY DEFINER 유지보수 문 동적 회수·정확한 4개 함수 사후조건을 최초 감사 범위인 0174 안으로 통합했다. executor는 기존 facade 호출 그래프를 위해 현재 함수 권한을 받은 뒤 앱에 열리지 않은 유지보수 definer를 즉시 잃고, 미래 함수는 service_role만 자동 권한을 받는다.
- 검증: 새 DB와 개발 DB 34/34, ACL metric 21, 전체 verify 6/6.

### P05-SEC-0175-OUTSIDE-PACKET

- disposition: `APPLIED`
- 적용 내용: 스테이징·운영에 적용되지 않은 로컬 migration 0175를 제거하고 그 전 내용을 artifact_paths에 이미 봉인된 0174로 합쳤다. 개발 DB는 백업 뒤 reset하여 파일·장부 163/163, 최신 0174로 맞췄다.
- 검증: 통합 0174를 처음부터 적용한 fresh DB 34/34, 업그레이드 9/9, 공개 RPC 타입 변화 없음.

### P05-SEC-PURGE-42501-NONDISCRIMINATING

- disposition: `APPLIED`
- 적용 내용: 몸통 자체가 42501을 내는 purge_archived_store 행동 단언을 제거했다. 자체 42501이 없는 close_due_business_days와 purge_entity_changes를 executor로 호출해 권한 거부를 재고, purge_archived_store는 has_function_privilege로 별도 확인한다.
- 판별력: close_due_business_days EXECUTE를 executor에 고의 재부여하면 카운트보다 먼저 행동 단언이 “거부되어야 하는데 성공했다”로 실패했다. revoke 뒤 34번이 통과했다.

### P05-SEC-HOSTED-ADMIN-OPTION-NOTE

- disposition: `NEEDS_HUMAN_DECISION`
- 이유: 로컬에서 추측해 닫지 않는다. 동일 SHA 보호 CI 후 스테이징 배포·remote audit에서 rpc_executor_role=1과 migration 사후조건을 확인한다.

- next_review_request: `CODEX_EVIDENCE`
