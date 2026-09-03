# AI-PLANS-SIM-MASTER-DEPUTY-CURRENT-READY

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `CURRENT_BYTES_READY_FOR_INDEPENDENT_REVIEW`

## 현재 검수 대상

- `docs/팀구성_상세기획안.md`
  - SHA-256: `8b6d94c5ec52fb040f5c527c6d22384ffa1e7b1acf3858f65ee79b31bf604d73`
- `docs/AI-오케스트레이션-상세기획안.md`
  - SHA-256: `794fab2d3842fa3d74a6f09f2485d19b69f21fc62b12cd371d8cb00b2f02b5da`

## 독립 검토 기준

1. `01 통합 작업큐 · 사람 결정`은 사람의 정책·비용·위험·운영 결정 접점이어야 한다.
2. `02 마스터 오케스트레이션`은 AI 마스터가 목표 분해·순서·작업 그래프·담당 배정·라우팅 계획을 확정하는 컨텍스트여야 한다.
3. `03 부 오케스트레이션 · 토큰/컨텍스트 관리`는 AI 부 오케스트레이터가 요청 정규화·예비 판정·확정 경로 실행·상태/토큰/HANDOFF를 관리하는 컨텍스트여야 한다.
4. 마스터와 부 역할은 역할 ID·전용 컨텍스트·권한 상한에 등록되고 사람의 L2·L3 결정을 대체하면 안 된다.
5. 팀 구성안 §4.5의 R0·R1 자동 종결 조건 번호는 중복 없이 1~11이어야 한다.

## 로컬 검증

- 명령: `corepack pnpm ai:plans:simulate`
- 결과: `71/71 PASS`
- `git diff --check`: 오류 없음

이 증거는 현재 bytes의 독립 검수를 위한 입력이다. 이전 외부 검수의 판정이나 Finding 상태를
대신하지 않으며, Fable은 현재 문서에서 실제로 남은 결함만 새 Finding으로 보고한다.
