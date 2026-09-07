# 구현 상태

## 8개 패키지 구성

| 구성 | 구현 | 현재 증거 |
|---|---|---|
| 공통 플러그인 본체 | 완료 | plugin validator 통과, skill과 단일 CLI 포함 |
| 프로젝트 초기화 명령 | 완료 | `init --plan/--apply`, 원자적 생성, 충돌 무덮어쓰기 |
| 프로젝트 adapter/profile | 완료 | 기본 11역할·19 requirement·67 route-kind requirement·64 고유 논리 route |
| 설치 진단 | 완료 | OS·Node·Python·Shell·4개 의존·host evidence 읽기 전용 진단 |
| 안전 기본값 | 완료 후보 | VM closure가 정상 fixture를 실행하고 fetch·dynamic import를 효과 전에 거부, 0/1/0 실측 |
| 이식형 상태 저장 | 완료 | Git 밖 LocalAppData, ACL 적용, endpoint 미저장 |
| 업데이트·migration·rollback | 부분 완료 | 설치 업데이트 백업, v1 no-op, 0.1.x→0.2.0 migration·runtime backup 완료 |
| 샘플·자동시험·운영 매뉴얼 | 완료 | clean profile/export/reinstall 포함 로컬 자동시험과 3개 운영 문서 |

## 현재 범위

- 현재 PC personal marketplace 설치: 완료
- 현재 식자재관리앱 프로젝트 계약 생성 및 0.2.0 migration: 완료
- 실제 다른 PC 대신 격리된 두 번째 사용자 프로필 설치: 통과
- 물리적으로 다른 PC 설치와 다른 Windows principal ACL 음성 시험: 미실행
- 실제 채팅 발송·Team Router 활성화 변경: 미수행
- 현재 프로젝트는 runtime 경로 계약 변경으로 `RUNTIME_RESTORE_REQUIRED`이며, 기존 Router가
  `ACTIVE_DISPATCH`인 반면 새 doctor tier가 `LOCAL_CORE_ONLY`여서 `verify-install`과 `dry-run` 모두
  non-zero `TIER_POLICY_INCONSISTENT`로 실패폐쇄된다. 기존 Router 설정은 임의 변경하지 않는다.
- 다른 PC 의존 경로는 사용자별 Codex cache/personal plugin 탐색 또는 명시적 절대경로 매핑을 사용한다.
- `PHYSICAL_SECOND_PC_VALIDATED`, `HOST_AUTHENTICATED`, `SERVICE_READY`는 여전히 false다.

상세 판정은 `contracts/acceptance-matrix.json`을 사용한다. 설계서와 코드가 달라지면 새 candidate SHA와
독립검수를 다시 결속한다.
