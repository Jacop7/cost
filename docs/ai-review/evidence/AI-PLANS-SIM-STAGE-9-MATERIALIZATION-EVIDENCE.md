---
evidence_id: AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE
task_id: AI-ORCH-PLANS-SIM-1
stage: 9
status: AWAITING_EXACT_SHA_REVIEW
observed_at: 2026-09-03T08:05:45.6183493Z
activation_commit: 8cadeb7
operations_commit: be83a41030a95b8bb44073356acaea82de1e4fee
decision_id: DEC-AI-STAGE-8-ACTIVATION-APPROVAL-027
---

# AI-PLANS-SIM-STAGE-9-MATERIALIZATION-EVIDENCE

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `AWAITING_EXACT_SHA_REVIEW`

## 9단계 물질화 실행 증거

이 문서는 9단계의 저장소·Codex 앱 외부 상태·플러그인 신뢰 확인 결과만 기록한다. 실제 thread ID,
대화 원문, 계정 식별자, 비밀, 운영 환경 값은 보관하지 않는다. 완료 판정은 exact-SHA Fable 검수와
로컬 게이트가 끝난 뒤 작업큐에서 수행한다.

## 1. 저장소 물질화

| 경계 | commit | 결과 |
|---|---|---|
| 단계 8 결정 기록 | `c4f021a` | 외부 상태 범위와 다섯 문서 대상 hash 결속 |
| 독립 graph gate | `d01807e`, `d5aa261` | planned tree·activation·사보타주 검사 준비 |
| 원자 활성화 | `8cadeb7` | 네 후속 기획안 ACTIVE, 역할 5개·팀 6개·중앙 장부·19개 A0 컨텍스트 동시 생성 |
| 운영 진입점 | `be83a41030a95b8bb44073356acaea82de1e4fee` | 운영 문서 7개 생성, 실제 incident 전 `POSTMORTEMS` 미생성 |

`docs/team/RISKS.md`는 디렉터리 중앙 권위 목록과 다른 문서의 소유 선언이 수렴하지 않아 만들지
않았다. 이 fail-closed 결과는 별도 정합화 Task 대상이며 단계 9가 임의로 새 권위를 발행하지 않는다.

## 2. 문서 그래프 검증

- `node scripts/docs-graph-check.mjs --activation`: PASS
  - 검사 파일 29개
  - ROLE_CONTEXT 19개
  - 역할/팀 manifest의 context version·content hash·route hash·policy hash 재계산 검증
  - Learning migration 4:4와 legacy/candidate 상태 제약 검증
- `node --test scripts/docs-graph-check.test.mjs`: 12/12 PASS
  - registry content hash 변조
  - route/policy hash 변조
  - 미승인 A단계 승격
  - 필수 manifest·운영 진입점 누락
  - 조기 `POSTMORTEMS` 생성
  - 기타 권위·연결 사보타주를 실패 폐쇄
- `corepack pnpm ai:plans:simulate`: 71/71 PASS

## 3. Codex 앱 외부 상태

Codex 앱 API의 생성·이동·순서 응답으로 다음 두 section과 정확한 제목 11개를 확인했다. 모두 기존
저장소 직접 사용 환경의 A0 셸이며 최초 입력은 준비 상태 확인만 허용한다.

### MarginCook · 마스터 작업

1. `01 통합 작업큐 · 사람 결정`
2. `02 마스터 오케스트레이션`
3. `03 부 오케스트레이션 · 토큰/컨텍스트 관리`
4. `04 개발·스테이징 배포 검증`
5. `05 운영 배포 · 복구 게이트`

### MarginCook · 부서 그룹

1. `00 모든 팀 상황실`
2. `01 Product · Mobile`
3. `02 Data · Backend`
4. `03 Server · Supabase · Operations`
5. `04 Quality · Review`
6. `05 Knowledge · Orchestration`

공통 셸 계약은 Task Packet·edit lease·Study Gate 확인 전 변경 금지, 권한 밖 HUMAN-CHIEF 이관,
계정·모델 selector 제어 주장 금지다. `04 개발·스테이징`은 운영 DB·운영 비밀을 금지하고, `05 운영
배포`는 사람의 명시적 승인·exact SHA·보호 CI·스테이징·복구 증거가 없으면 실행하지 않는다. 상설
Quality 셸은 독립검수 엔진으로 가장하지 않는다.

## 4. 세 전역 플러그인 독립 확인

세 플러그인은 통합하거나 채팅별로 복제하지 않았다. canonical source와 설치 cache의 핵심 파일을
SHA-256으로 비교하고 자체 시험을 실행했다.

| 플러그인 | 설치 cache version | source/cache 확인 | 자체 시험 | 실행 상태 |
|---|---|---|---:|---|
| Account Continuity | `0.1.0+codex.20260903072936` | policy·hook·CLI 일치 | 10/10 | `ACCOUNT_CONTINUITY_READY`; raw account identifier 저장 없음 |
| Mission Relay | `0.1.0+codex.20260903073720` | policy·hook·CLI 일치 | 29/29 | hook/CLI 신뢰 확인; 현재 미션 롤오버를 새로 만들지 않음 |
| Project Orchestrator | `0.1.0+codex.20260903073010` | hook·CLI 일치; policy는 설치본 복제 없이 canonical 외부 경로 직접 사용 | 9/9 | `MODEL_PLAN_VERIFIED` |

확인한 hook SHA-256은 Account Continuity
`ed83ddb504d216d3444a212ac715d67fc28ce88119ef81199ddc5c7ba450fd87`, Mission Relay
`350f736297d597e974396c6c4294571ce36fb7cb3c0d746b9fe222c8a5d7654d`, Project Orchestrator
`038bfc2cc0d07d6053405c3b65d55bba50ffebc6b4c3b752c6c8ef265eadf6e3`이다.

Project Orchestrator가 검증한 현재 model plan SHA-256은
`da855b3632bad90bed880e770b8e5e83415c361c9e1186a67d178c10b07bfd69`이며 차이는 0개다. 이 결과는
현재 앱의 모델 selector를 플러그인이 바꾼다는 뜻이 아니다.

## 5. 독립검수·비용 계보

- `AI-ORCH-PLANS-STAGE-9-PREFLIGHT-AUDIT-027/r001`: `budget_exhausted`, 판정 없음, 실제 USD
  `6.338000`; 실패 원본 보존
- 축소 successor `AI-ORCH-PLANS-STAGE-9-PREFLIGHT-COMPACT-028/r001`: Fable PASS, 필수 OPEN
  Finding 0개, 실제 USD `2.677106`
- 선택 Improvement 2개는 checker와 사보타주에 반영했다.
- 단계 9 현재 누적 Fable 실비: USD `9.015106`
- 같은 목적의 Opus 동시 호출은 하지 않았다.

이 증거가 결속된 commit을 대상으로 마지막 Fable exact-SHA 감사를 한 번 수행한다. 새 필수 Finding이
없고 로컬 게이트가 통과할 때만 단계 9를 완료하고 단계 10으로 넘긴다.

## 6. 소유권 분리

이번 단계 commit에는 `apps/mobile/**`, `scripts/prototype_server.py`, `docs/prototypes/**`, 사용자의 별도
미추적 검수·플러그인 문서와 `.codex-share/`, `.tmp/`를 포함하지 않았다. 이 파일들은 사용자 또는 다른
작업의 소유 변경으로 계속 제외한다.
