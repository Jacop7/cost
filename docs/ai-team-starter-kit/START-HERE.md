# 시작 절차

1. 대상 저장소의 루트 `AGENTS.md`에 단일 공식 권위와 사용자 소유 파일 제외 규칙을 정의한다.
2. `templates/TASK-PACKET.md`로 R0·R1 Task 하나를 등록하고 정확한 대상 SHA·허용 경로·중단 조건을 봉인한다.
3. `templates/ROLE-CONTEXT.md`와 `templates/TEAM-MANIFEST.md`를 적용 대상의 역할·입력·출력 경계로 채운다.
4. `templates/CHAT-MANIFEST.md`는 각 프로젝트 adapter에서 확정한 exact title·역할 context·권위 경로를 링크하는 얇은 진입점으로만 채운다.
5. 교차 채팅이 필요하면 `templates/TEAM-ROUTER-POLICY.json`을 `.codex/team-router/policy.json`으로
   복사해 프로젝트 값으로 바꾸고 `SIMULATION_ONLY`에서 manifest edge 전체를 검증한다.
6. 구현 전후 `templates/HANDOFF.md`로 복원 가능한 pointer만 남긴다. 대화 원문·계정 식별자·비밀값은 넣지 않는다.
7. 결정적 검사와 독립검수를 실행한 뒤, 사람 Decision이 필요한 활성화·배포·위험 수용을 별도 기록한다.

첫 적용은 읽기·문서·비파괴 분석 같은 R0·R1 범위로 제한한다. DB schema, 운영 배포, 권한, 결제,
사용자 소유 파일 변경은 별도 프로젝트 정책과 사람 승인 없이는 이 키트로 실행하지 않는다.
