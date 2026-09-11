# 배포 기록

`packages/db/scripts/deploy-guard.mjs`가 스테이징·운영 적용 성공 뒤 만드는 감사 기록을 보관한다.
기록에는 대상 project ref, 정확한 `main` SHA, `protected-gate` 실행 ID, 적용 예정·적용 migration과
CLI 출력의 SHA-256만 들어간다. 비밀번호·access token·DB URL은 기록하지 않는다.

계획 모드는 출력만 남기고 저장소 파일을 만들지 않는다. 계획 파일 때문에 worktree가 더러워져 같은
SHA의 적용이 막히는 일을 피하기 위해서다. `APPLIED` 기록도 백업·ACL 감사·스테이징 검증을 대신하지
않으며 [브랜치·DB 운영 기획안](../브랜치-DB-운영-기획안.md)의 배포 절차와 함께 커밋한다.

DB 배포의 작업 트리 검사는 모든 추적 변경과 미추적 배포 입력을 차단한다. 단, CLI가 읽지 않는
`.codex/`, `.tmp/`, `docs/`, `Claude outputs/`, 루트 `scripts/`, 루트 `supabase/.temp/` 및
정해진 `_tmp_<숫자>_<32자리 해시>` 작업자료는 원위치에 보존한다. `packages/db/`, `apps/`,
그 밖의 미추적 실행 입력은 예외가 아니다. 예외 자료의 수와 경로 목록 해시를 `workspace_audit`에
기록하며, 이 판정은 앱 빌드 입력 검증이나 저장소 전체가 깨끗하다는 주장을 대신하지 않는다.
