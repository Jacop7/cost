# 배포 기록

`packages/db/scripts/deploy-guard.mjs`가 스테이징·운영 적용 성공 뒤 만드는 감사 기록을 보관한다.
기록에는 대상 project ref, 정확한 `main` SHA, `protected-gate` 실행 ID, 적용 예정·적용 migration과
CLI 출력의 SHA-256만 들어간다. 비밀번호·access token·DB URL은 기록하지 않는다.

계획 모드는 출력만 남기고 저장소 파일을 만들지 않는다. 계획 파일 때문에 worktree가 더러워져 같은
SHA의 적용이 막히는 일을 피하기 위해서다. `APPLIED` 기록도 백업·ACL 감사·스테이징 검증을 대신하지
않으며 [브랜치·DB 운영 기획안](../브랜치-DB-운영-기획안.md)의 배포 절차와 함께 커밋한다.
