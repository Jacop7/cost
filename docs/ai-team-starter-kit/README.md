# AI 팀 운영 스타터 키트 v0.5

이 디렉터리는 다중 AI 팀의 요청→Task→검수→사람 결정→HANDOFF 흐름을 새 저장소에 이식하기 위한
**비권위 템플릿**이다. 현재 저장소의 제품·DB·배포 정책을 대체하지 않으며, 적용 대상 저장소의
루트 `AGENTS.md`와 Task 장부가 항상 우선한다.

v0.5는 실제 R1 문서 그래프 verify 게이트 파일럿에서 확인한 구조만 반영한다. 빈 저장소 fixture와
프로젝트 adapter를 통한 전체 이식 검증은 v1.0 범위다.

- [시작 절차](./START-HERE.md)
- [공통 계약](./CORE-CONTRACT.md)
- [재사용 템플릿](./templates/README.md)
- [일반 Chat Manifest](./templates/CHAT-MANIFEST.md)
- [Team Router 무발송 정책 템플릿](./templates/TEAM-ROUTER-POLICY.json)
- [프로젝트 adapter/profile 경계](./adapters/README.md)
- [휴대형 팀 서비스 아키텍처](./PORTABLE-TEAM-SERVICE-ARCHITECTURE.md)
- [플러그인·adapter 유실 재제작 설계서](./REBUILD-BLUEPRINT.md)
- [공통 플러그인 설치·운영 설계](./PLUGIN-OPERATIONS.md)
- [휴대형 패키지 기계 판독 계약](./portable-package-contract.json)
- [프로젝트 profile schema](./schemas/project-profile.schema.json)
- [capability policy schema](./schemas/capability-policy.schema.json)
- [설치 영수증 schema](./schemas/install-receipt.schema.json)
- [생성 파일 inventory schema](./schemas/generated-files.schema.json)
- [host evidence admission schema](./schemas/host-evidence-admission.schema.json)
- [기본 11역할 profile](./profiles/default-11-role-profile.json)
- [재제작 golden vector](./golden/portable-v1-vectors.json)
- [검수된 설계 기준선](../ai-review/evidence/TEAM-SERVICE-PORTABLE-PACKAGE-DESIGN-BASELINE-001.json)
- [Fable 최종 설계 재검수 004](../ai-review/evidence/TEAM-SERVICE-PORTABLE-PACKAGE-FABLE-RECHECK-004.md)
- [플러그인 정본 소스](../../tools/codex-team-service-bootstrap/README.md)
- [구현 상태](../../tools/codex-team-service-bootstrap/docs/IMPLEMENTATION-STATUS.md)
- [AT-01~17 판정표](../../tools/codex-team-service-bootstrap/contracts/acceptance-matrix.json)

현재 휴대형 패키지는 **로컬 구현 후보·Opus 재검수 대기** 상태다. 공통 플러그인 구현, 현재 PC 설치,
격리된 clean profile 설치와 무발송 시험은 통과했다. 물리적으로 다른 PC·다른 Windows principal ACL,
host 인증 채팅 왕복과 실제 발송은 미검증이며 서비스 준비 완료로 주장하지 않는다.

여러 장기 채팅을 쓸 때는 프로젝트마다 봉인 모델 계획 하나를 두고, 각 채팅은 자기 Mission Relay
상태·1.7 경제성·HANDOFF 계보만 별도로 보존한다. 채팅마다 계획 사본을 만들거나 한 채팅의 rollover를
다른 채팅으로 전파하지 않는다.

교차 채팅 라우팅이 필요하면 각 manifest의 v2 edge와 프로젝트별 Team Router 정책을 함께 검증한다.
공통 키트는 실제 발송을 켜지 않으며, 구현 승인과 별도의 활성화 Decision 전에는 simulation만 허용한다.

## 포함하지 않는 것

- 제품 요구사항, 고객·계정 데이터, 비밀정보, 운영 credential
- 특정 DB·배포 공급자 설정과 실행 명령
- 사람 승인·운영 배포를 자동화하는 권한
- 원 저장소의 공식 정책이나 검수 원본 복제

각 새 프로젝트는 이 템플릿을 복사한 뒤 adapter/profile을 작성하고, 자신의 공식 문서·검사기·독립검수
결과를 통해서만 활성화한다.
채팅방의 exact title·개수·컨텍스트 대응은 공통 core가 아니라 각 프로젝트 adapter가 정하며, manifest는 그 권위를 링크로만 참조한다.
