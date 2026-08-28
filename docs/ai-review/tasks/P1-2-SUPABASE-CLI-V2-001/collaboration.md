# P1-2-SUPABASE-CLI-V2-001 공동 작업 장부

> 이 장부는 Supabase CLI v2 전환과 로컬 DB 초기화·ACL 복구 계약을
> 검수하는 append-only 기록이다. 이 최초 패킷 이후 비-Fable 턴은
> `corepack pnpm fable:append`로만 추가한다.

## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `4403ae2fdf0a4de9c755e191f274e75a1dcae3b9`
- changed_artifact_paths: `packages/db/package.json`, `package.json`, `packages/db/scripts/reset-local.mjs`, `packages/db/scripts/cli-contract.test.mjs`, `scripts/verify.mjs`, `packages/db/supabase/config.toml`, `packages/db/src/database.types.ts`, `README.md`, `ARCHITECTURE.md`, `packages/db/README.md`, `docs/브랜치-DB-운영-기획안.md`, `docs/서버-확장-아키텍처-기획안.md`, `docs/작업큐.md`
- 충족해야 할 요구사항·불변식: `P1-2-1..6`, `AGENTS:full-local-gate`, `AGENTS:remote-acl-not-yet-applied`, `WORK-QUEUE:P1-2`
- 이번에 바꾼 내용: Supabase CLI를 `2.116.0`으로 고정하고, 루트 스크립트가 항상 저장소의 pnpm `9.12.0`을 통하도록 고정했다. CLI v2 `db reset`이 끝난 뒤 `supabase_admin` 기본 ACL이 다시 열리는 실측 공백을 발견해, 로컬 reset 래퍼가 `admin-acl.sh fix`와 `check`를 순서대로 실행하게 했다. 마이그레이션·시드·타입·verify 계약과 문서를 현행화했다.
- 집중 검토 질문: CLI v2 고정과 pnpm 실행 경로가 재현 가능한가? reset 후 ACL fix/check가 실패 폐쇄되고 비밀번호·운영 접속을 우회하지 않는가? CLI v2 타입 변화가 스키마 변경으로 위장되지 않았는가? verify·CI·운영 미적용 표현이 각자의 실제 범위와 일치하는가?
- 실행한 테스트·현재 증거: CLI `2.116.0`, migration list `161/161`, push dry-run `0`, db:types 반복 해시 일치, db reset 후 ACL fix/check·시드 `19/7/22`, `corepack pnpm verify` 6/6, `fresh_*` 0건. 운영·스테이징은 적용하지 않았다.
- 사람 결정이 필요한 항목: 이 회차의 읽기 전용 검수에는 없음. 운영 DB 연결·적용은 이 Task 권한 밖이다.
- applied_learning_ids: `LRN-ORCH-CI-001`, `LRN-OPS-BACKUP-001`
- excluded_learning_ids: `LRN-CODEX-TIME-001`(영업일 시간 독립 헬퍼는 직접 무관), `LRN-AUDIT-PIN-001`(CANDIDATE)
- next_review_request: `FABLE_REVIEW`

## HUMAN_DECISION · turn-h001 · r002

- role: `HUMAN`
- 결정: 페이블 실행 두 회차가 모두 runner의 회차 budget_exhausted로 결과를 만들지 못했고 승인된 Task 상한을 소진했으므로 추가 Fable 호출은 중단한다.
- 결정: P1-2는 Fable 판정 통과로 표현하지 않고, 이미 완료한 로컬 verify 6/6과 정확한 feature/main SHA의 보호 CI를 완료 근거로 계속 진행한다.
- 결정: 실패한 r001·r002 감사 원본과 OPEN 상태를 삭제·변조하지 않고 저장소에 보존한다.
