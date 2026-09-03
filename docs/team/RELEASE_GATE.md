# 릴리스 게이트 인스턴스 장부

릴리스 후보의 exact SHA, 환경, 기존 배포 증거 경로, 사람 승인 결과만 연결한다. 배포 정책은
[브랜치·DB 운영 기획안](../브랜치-DB-운영-기획안.md), 실제 환경 적용 증거는 `docs/deployments/`가
소유한다. 이 파일은 어느 것도 복사하거나 운영 승인을 자동 생성하지 않는다.

<!-- release-gate-registry:v1 -->
```json
{
  "schema_version": "1.0",
  "releases": []
}
```
<!-- /release-gate-registry:v1 -->

첫 릴리스 인스턴스는 대상 SHA의 보호 CI, 스테이징 증거, 백업·복구 근거와 `HUMAN-CHIEF`의 명시적
운영 Go/No-Go가 모두 있을 때 추가한다.
