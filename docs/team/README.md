# AI 팀 운영 문서 지도

이 디렉터리는 제품 정책을 복사하는 팀별 문서 묶음이 아니다. 사람 Decision, 역할 컨텍스트,
Learning, 릴리스 연결, 역할·팀 route manifest의 단일 탐색점이다.

## 중앙 장부

- [사람 Decision](./DECISIONS.md)
- [활성 역할 컨텍스트](./ROLE_CONTEXTS.md)
- [팀 Learning](./TEAM_LEARNING.md)
- [릴리스 게이트 인스턴스](./RELEASE_GATE.md)
- [일반 Task HANDOFF 경계](./handoffs/README.md)

`RISKS.md`는 아직 만들지 않는다. [디렉터리 기획안](../디렉터리-문서신경망-재설계-기획안.md)의
중앙 권위 표와 [온톨로지](../AI-지식-온톨로지-기획안.md)의 소유 선언이 같은 activation 후보에서
수렴하는 별도 정합화 Task 전에는 위험 장부 권위를 발행할 수 없다.

## 실행 manifest

- 역할: [ORCHESTRATION](./roles/ORCHESTRATION.md), [SOLAR](./roles/SOLAR.md),
  [CODEX](./roles/CODEX.md), [INDEPENDENT-AUDIT](./roles/INDEPENDENT-AUDIT.md),
  [OPERATIONS](./roles/OPERATIONS.md)
- 팀: [모든 팀 상황실](./teams/00-all-teams-room.md),
  [Product · Mobile](./teams/01-product-mobile.md), [Data · Backend](./teams/02-data-backend.md),
  [Server · Supabase · Operations](./teams/03-server-supabase-operations.md),
  [Quality · Review](./teams/04-quality-review.md),
  [Knowledge · Orchestration](./teams/05-knowledge-orchestration.md)

현재 Task·담당·의존·다음 행동은 오직 [작업큐](../작업큐.md)가 소유한다. 채팅 제목과 이 manifest는
승인 권한이나 edit lease를 만들지 않는다.

## 운영 진입점

[릴리스](../operations/RUNBOOK_RELEASE.md), [사고 대응](../operations/RUNBOOK_INCIDENT.md),
[복구](../operations/RUNBOOK_RECOVERY.md), [데이터 정정](../operations/DATA_CORRECTION_POLICY.md),
[관측](../operations/MONITORING_CATALOG.md), [지원](../operations/SUPPORT_PLAYBOOK.md),
[파일럿](../operations/PILOT_PLAN.md)은 상위 정책을 복사하지 않는 실행 진입점이다.
