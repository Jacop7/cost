# Codex Team Service project contract

이 디렉터리는 `codex-team-service-bootstrap`이 생성한 추적 가능 프로젝트 계약이다.
provider endpoint, 계정 식별자, 인증정보, 원시 대화와 사용자 runtime은 저장하지 않는다.

- `project-profile.json`: 역할·selector·필수 edge의 단일 프로젝트 입력
- `capability-policy.json`: 기본 무발송과 tier 요구
- `chats/*.json`: 논리 역할 manifest. 실제 endpoint가 아니다.
- `generated-files.json`: 생성 입력과 파일 hash inventory

실제 라우팅 활성화는 별도 Team Router 정책과 사람의 exact-SHA Decision이 필요하다.
