# TEAM-SERVICE P2b 선작업 Opus 검수 001

- 대상: `TEAM-SERVICE-P2B-PREWORK-CANDIDATE-001`
- 대상 SHA-256: `33715961de11a11c7e2bd2ea38aa6c08d5eb55e29ae0c91dbd851ede3f730ac1`
- 방식: 기존 `AI 팀 지식망 스터디·인계` Cowork의 Claude Opus 5 high 직접 독립 자문
- 판정: `CHANGES_REQUIRED`
- 저장소 수정·시험 실행: 검수자 0건
- formal CLI receipt / provider attestation: 없음

## OPEN_BLOCKING

1. `B-1`: 공유 canonical interpreter 이관 대상에 `scripts/team-service-state-contract.test.mjs`가 빠져 있어 복제 구현 금지 규칙과 5개 대상 목록이 모순이다. 6번째 대상으로 포함하는 방식을 권고했다.
2. `B-2`: `service-flow-acceptance.json`의 P2b gate에 `ac24_run_requirement`가 없고 AC-24 시나리오에도 P2b 완료 프로파일이 없다. 구현 허용 전에 completion-only P2B 프로파일을 고정해야 한다.

## OPEN_NONBLOCKING

- 후보의 `stage_15_only` 표기는 stage 14의 `active → completed` 전이를 함께 명시해야 한다.
- AC-24 번들에서 수용 카탈로그 SHA를 pin해야 한다.
- A07 effect uniqueness 소유자와 AC-18-A05 회귀를 계약에서 참조해야 한다.
- A04에 blind retry 및 예약 전 UUID 발급 거부 음성 증거를 요구해야 한다.
- 계획의 구성·소유권 표에 P2b intent store를 추가해야 한다.
- P2b 로컬 mock PASS가 실제 Router CLI get-or-prepare 지원이 아님을 명시해야 한다.
- 미추적 선작업은 AC-24가 소비하기 전에 커밋해야 한다.

## 범위 제한

이 판정은 실제 전송, Team Router runtime·정책·endpoint 변경, host 인증, `service_ready`, 전체 `pnpm verify` 통과 또는 P2b 구현을 승인하지 않는다. 위 차단 두 건을 닫은 정확한 변경 바이트를 재검수해야 한다.
