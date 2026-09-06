# Adapter와 Profile 경계

`adapters/`에는 특정 CI, DB, 배포, 공급자 도구의 연결 방법만 둔다. `profiles/`에는 대상 프로젝트의
경로·명령·도메인 계약만 둔다. 공통 템플릿에 특정 프로젝트 이름, 원격 ID, 비밀값, 운영 절차를 넣지
않는다.

각 adapter는 대상 프로젝트의 사람 승인·보호 게이트·복구 규칙을 대체하지 않고 링크만 제공한다.

채팅 adapter는 [`CHAT-MANIFEST`](../templates/CHAT-MANIFEST.md)의 정확한 title·개수·role context·team/role 대응을 프로젝트 단일 권위로 정하고, 공통 템플릿에는 연결 규칙만 남긴다. 특정 제품·context ID·DB 공급자 값을 core로 복사하지 않는다.
