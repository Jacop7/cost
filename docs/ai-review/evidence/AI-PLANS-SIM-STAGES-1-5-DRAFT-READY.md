# AI-PLANS-SIM-STAGES-1-5-DRAFT-READY

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: 1~5단계 외부 묶음 검수 제출 준비 완료(`DRAFT_READY`)

- 작성 역할: `SOLAR-AI-DEPUTY` (`Terra xhigh` 주 실행 경로)
- 대상: 권위 작업 루트의 2026-09-03 working-tree candidate
- 판정: 1~5단계 모두 외부 묶음 검수에 제출 가능한 `DRAFT_READY`
- 비판정: 네 후보 문서의 `REVIEWED`·`ACTIVE`, 사람 최종 승인, 실제 디렉터리 물질화

## 공통 기준선

- 브랜치: `codex/ai-team-knowledge-orchestration-plans`
- HEAD: `6e99bd93b737bf291f14a8d3a6465a1d5110fa6c`
- 모델 계획: `.codex/mission-relay/model-plan.json`
- 봉인 SHA-256: `28e055c550b7ec5d15d13da5ac01b0ed2d2af10b7a4776f4f4e6f02c282d550c`
- 경로 원칙: 공식 작업 루트만 사용하고 사용자 소유 모바일·프로토타입 변경은 대상에서 제외한다.
- 상태 원칙: 팀 구성안은 사람 승인된 `CONFIRMED`를 유지하고, 나머지 네 문서는 8단계 사람 승인 전까지
  `DRAFT`를 유지한다. `DRAFT_READY`는 이번 묶음 검수의 준비 상태이지 새 front matter 상태가 아니다.

## 단계별 판정

### 1. 팀 구성안 확정

- 공식본: `docs/팀구성_상세기획안.md` v1.6, `CONFIRMED`
- 정규화 SHA-256: `e6e53e0326c33039173e30da880600044e45ff18aa711b8cd991593b3c16807f`
- 확인 범위: 사람/마스터 AI/부 오케스트레이터/Context Steward의 권한 분리, 다섯 팀 그룹,
  `01 통합 작업큐 · 사람 결정` → `02 마스터 오케스트레이션` →
  `03 부 오케스트레이션 · 토큰/컨텍스트 관리` → `04 개발·스테이징` → `05 운영 배포` 번호 계약,
  Data·Backend와 Server·Supabase·Operations 경계, 사람 운영 승인 불변식.
- 검수 라우팅: Terra 주 실행, Sol 묶음 구조 checkpoint, Fable 기본 독립검수, allowlist 소진 때만
  계약 검증된 Opus successor, 동일 목적 동시 호출·자동 배수 증액 금지.
- 판정: `DRAFT_READY`. §15 체크리스트의 실제 컨텍스트·운영 인스턴스·배포 준비 항목은 9~12단계
  구현·운영 게이트이며, 이미 승인된 역할 설계 자체를 미확정으로 되돌리지 않는다.

### 2. 온톨로지 확정 후보

- 공식본: `docs/AI-지식-온톨로지-기획안.md` v0.3, `DRAFT`
- 정규화 SHA-256: `d6b82bef48cdffdf883b807ec809e27dcf496dd18365567c3e34988040a47d5e`
- 확인 범위: Request→Normalized Request→Task 정규화, Decision/Risk/Finding/Evidence/Learning/HANDOFF
  노드, 관계 방향, L0~L4 복원 순서, Task별 단조 증가 HANDOFF 판본, DRAFT→REVIEWED→ACTIVE 수명주기.
- 권위 경계: 역할·승인은 팀 구성안, 실행 라우팅은 오케스트레이션, 물리 배치는 디렉터리안,
  평가·승격은 품질안에 위임하며 중복 `TOUCHES` 관계를 만들지 않는다.
- 판정: `DRAFT_READY`. 미결 저장 매체·ID 형식·보존 기간은 구현 선택으로 남기며 현재 의미 계약과
  fail-closed 복원을 막지 않는다.

### 3. 오케스트레이션 확정 후보

- 공식본: `docs/AI-오케스트레이션-상세기획안.md` v0.6, `DRAFT`
- 정규화 SHA-256: `069344e6933911d9240f566f6d8e83894d3fe2feb8db5a6863a24f73297649b6`
- 확인 범위: 요청 수신·판정·Task 생성, 마스터/부 오케스트레이션 책임, 팀 그룹 라우팅, 사람 Decision
  연결, edit lease·stale writer 차단, HANDOFF 복원, 외부 검수와 실행 증거 분리.
- 채팅 경계: `01`은 Decision 권위 파일에 연결되는 통합 보기·중앙 접점, `02`는 AI 마스터 조정,
  `03`은 사람이 개입하지 않는
  부 오케스트레이션·토큰/컨텍스트 관리다. 사람은 `04`·`05`에서 결정을 직접 말할 수 있으나 해당
  Decision은 `01`에 한 번 연결되고 운영 승인으로 자동 확대되지 않는다.
- 판정: `DRAFT_READY`. protocol 1.2가 아직 프로젝트 envelope 소진 후 successor와 재시도 횟수 봉인을
  모두 구현하지 못한 공백은 명시적으로 fail-closed 처리되어 있으며, 후속 구현 전 임의 Opus fallback을
  합성하지 않는다.

### 4. 디렉터리·문서 신경망 확정 후보

- 공식본: `docs/디렉터리-문서신경망-재설계-기획안.md` v0.4, `DRAFT`
- 정규화 SHA-256: `9de09a13645a076d996cb17cae00f5012036a44557d7737566af8bed128d3ac7`
- 확인 범위: 중앙 권위 노드와 가까운 README 분리, 각 MD 목표 위치, `AUTHORITY_REF`와
  `DELEGATED_PENDING` 방향, 탐색 강연결과 권위 DAG 비순환 분리, 파일 이동·옛 참조·사용자 파일 보호.
- 물질화 경계: 8단계 사람 승인과 graph checker 전에는 `docs/team/` 권위 인스턴스나 팀별 MD를 만들지
  않는다. 이번 단계는 위치·연결 방향만 확정 후보로 만든다.
- 판정: `DRAFT_READY`. front matter 대 별도 manifest, 생성 색인 추적 여부, 앵커 계산기 선택은
  9~10단계 구현에서 증거로 확정할 선택이다.

### 5. 품질·학습·자율성 확정 후보

- 공식본: `docs/AI-품질-학습-자율성-평가기획안.md` v0.4, `DRAFT`
- 정규화 SHA-256: `98fc82d82cc6b6f78fffc148a8bf7dbbdb0e5b5816aa9c01f94c6f7e68434f9b`
- 확인 범위: Run/Task/Finding/Gate 상태 분리, 요청·복원·라우팅·컨텍스트·구현·실패 폐쇄 평가,
  Learning CANDIDATE→VERIFIED→RETIRED, champion/challenger, A0~A4 승격·자동 강등, 사람 개입 품질.
- 비용·검수 경계: 21회 하한, Fable 5회 기본·Opus 0회 기준선, 동일 bytes/hash인 8단계 패킷만 1회
  생략, 기술 상한 실패와 프로젝트 envelope 소진 구분, R0/R1과 R2/R3·운영 종결 차등.
- 판정: `DRAFT_READY`. 표본 수·보존 기간·저장 형식은 파일럿 관측 뒤 정하는 구현 파라미터이며,
  자율성 확대를 선승인하지 않는다.

## 로컬 검증

| 검사 | 결과 | 의미 |
|---|---|---|
| `corepack pnpm ai:plans:simulate` | `71/71 PASS` | 강연결 탐색망, 비순환 권위 DAG, 상태·lease·HANDOFF·검수·비용 사보타주 적중 |
| `corepack pnpm fable:check` | `PASS` | Claude Code 2.1.250 연결 및 로그인 상태 확인; 외부 모델 호출·판정 아님 |
| Project Orchestrator `verify` | `MODEL_PLAN_VERIFIED` | 21회 계획과 SHA-256 sidecar 일치 |

`AGENTS.md`와 `docs/ai-review/README.md`의 정규화 SHA-256은 각각
`3ba1d03dedab3b7a810d0418ce1d08eb552e4f760ed636a250b033bece5cf341`,
`8db9867e5c3277742edb9a50aead9fbc26cc2ed667bb1436c385f5a519e04170`이다.

## 외부 묶음 검수 입력과 종료 조건

1. Sol high는 다섯 공식본과 이 증거를 대상으로 권위 중복, 역할 충돌, 누락된 게이트를 구조 검토한다.
2. Sol의 필수 Finding을 같은 공식본에 반영하거나 근거와 함께 반박하고 로컬 검사를 다시 실행한다.
3. Fable은 정확히 같은 최종 bytes를 독립 검수한다. 프로젝트 검수 envelope는 사람 Decision으로 pin된
   범위만 사용하고 같은 목적의 Opus를 동시에 호출하지 않는다.
4. Fable이 `CHANGES_REQUIRED`이면 필수 Finding을 반영한 변경 diff만 재검수한다. `PASS` 또는 모든
   필수 Finding `VERIFIED` 전에는 1~5단계 묶음 검수 완료를 선언하지 않는다.
5. 외부 검수 통과 후에도 네 후보 문서는 `REVIEWED` 승격 후보일 뿐이다. `ACTIVE` 전환은 8단계 사람
   최종 승인과 원자적 활성화 계약을 따른다.

## Sol high 구조 checkpoint

- 최초 판정: `CHANGES_REQUIRED` — Critical 2, Major 3, Minor 1
- 반영: Task 경로 역할 분리, `MANDATORY_MUTUAL + FABLE-ARCH` 정합화, 본 증거의 Task 결속,
  `authority_link_state`와 파생 관계 어휘 명시, Opus fallback 절 참조 교정, `01` 채팅 권위 표현 교정
- 재검수 판정: `PASS`
- Finding 상태: 아래 6건 모두 `VERIFIED`
  - `SOL-A-PATH-ROLE-001`
  - `SOL-A-ROUTE-ROLE-002`
  - `SOL-A-EVIDENCE-BINDING-003`
  - `SOL-A-RELATION-VOCAB-004`
  - `SOL-A-FALLBACK-REF-005`
  - `SOL-A-CHAT-AUTHORITY-006`
- 재검수 실행 증거: `corepack pnpm ai:plans:simulate` 독립 재실행 `71/71 PASS`
- 잔여 경계: 외부 Fable 호출 전 `review_budget_envelope_approved` 사람 Decision 필요
