# Codex Team Service Bootstrap

다른 컴퓨터와 다른 프로젝트에 AI 팀 서비스 계약을 설치·진단·초기화하는 휴대형 플러그인이다.
기존 Mission Relay, Project Orchestrator, Team Router, Account Continuity의 정책과 상태를 복제하거나
수정하지 않는다. 기본 동작은 `LOCAL_CORE_ONLY`와 무발송이다.

```powershell
node scripts/team-service.mjs doctor --project C:\path\to\project
node scripts/team-service.mjs init --project C:\path\to\project --plan
node scripts/team-service.mjs init --project C:\path\to\project --apply
node scripts/team-service.mjs init-runtime --project C:\path\to\project
node scripts/team-service.mjs dry-run --project C:\path\to\project
node scripts/team-service.mjs verify-install --project C:\path\to\project
```

`doctor`, `dry-run`, `verify-install`, `prepare-activation`은 실제 채팅 메시지를 보내지 않는다.
이 플러그인은 Router 활성화 영수증을 생성하거나 endpoint를 추측하지 않는다.
