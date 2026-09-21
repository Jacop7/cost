# AI 채팅 Router capability spike 001

> 상태: `READ_ONLY · SIMULATION_ONLY`
>
> 확인일: `2026-09-04 Asia/Seoul`
>
> 권위 설계: `AI-CHAT-ROUTING-EXECUTION-DRAFT-001.md` v0.4
>
> 설계 SHA-256: `2e4a22ba69844dfdba1a2e23fb5797ede96e43a6bb3346e7f74bd765eda684a4`

## 목적

사람 Decision과 Router 구현 전에 현재 Codex 앱에서 11개 A0 채팅의 존재·제목·프로젝트 경계와
사용 가능한 읽기/전송 관련 surface를 비밀 없이 확인한다. 실제 메시지 전송, 새 채팅 생성,
manifest 수정, runtime state 생성은 하지 않는다.

## 관측 결과

- `MarginCook · 마스터 작업`: 5개
- `MarginCook · 부서 그룹`: 6개
- 총 11개 모두 `local` host와 권위 작업 루트
  `C:\Users\jacop\프로젝트\식자재관리앱`에서 조회됐다.
- 11개 제목은 다음 manifest title과 일치했다.
  - `01 통합 작업큐 · 사람 결정`
  - `02 마스터 오케스트레이션`
  - `03 부 오케스트레이션 · 토큰/컨텍스트 관리`
  - `04 개발·스테이징 배포 검증`
  - `05 운영 배포 · 복구 게이트`
  - `00 모든 팀 상황실`
  - `01 Product · Mobile`
  - `02 Data · Backend`
  - `03 Server · Supabase · Operations`
  - `04 Quality · Review`
  - `05 Knowledge · Orchestration`
- 현재 agent surface에는 task 목록, task 읽기, 기존 task 메시지 전송, 새 task 생성 기능이 노출된다.
- inaccessible host/source는 관측되지 않았다.

provider thread ID, 대화 preview, 계정 정보는 이 증거에 보존하지 않는다.

## 확인되지 않은 기능

- 항상 실행되는 background Router hook
- target task를 자동으로 깨우는 안정 API 계약
- 여러 채팅에 대한 원자 broadcast
- Mission Relay handoff와 Router endpoint generation을 연결하는 adapter
- shared runtime lock·CAS·dedupe의 실제 구현
- 새 task 생성 완료 전 endpoint 사용 가능성

따라서 이 spike는 `ACTIVE_DISPATCH` 근거가 아니며, 현재 허용 결과는 `SIMULATION_ONLY`다.

## fail-closed 판정

| 검사 | 판정 | 의미 |
| --- | --- | --- |
| 11개 논리 채팅 존재·제목 | `PASS` | manifest 후보 대상을 식별할 수 있음 |
| 동일 local project root | `PASS` | shared-runtime 구현 가능성만 있음 |
| background dispatch | `UNVERIFIED` | 자동 발송 금지 |
| lock·CAS·dedupe probe | `NOT_IMPLEMENTED` | 실제 전달 금지 |
| successor binding adapter | `NOT_IMPLEMENTED` | generation 전환 금지 |
| 사람 Decision | `MISSING` | manifest·plugin 구현 및 실제 발송 금지 |

