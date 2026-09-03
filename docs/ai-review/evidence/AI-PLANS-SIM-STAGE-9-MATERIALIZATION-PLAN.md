---
doc_id: ai-plans-sim-stage-9-materialization-plan
doc_type: execution_plan
status: DRAFT
authority: none
owner: AI-DEPUTY-ORCHESTRATOR
approver: HUMAN-CHIEF
version: 0.2
target_task: AI-ORCH-PLANS-SIM-1
target_stage: 9
baseline_commit: d14ce2a838e003a57983c3772fb8b3a5b730fc0a
---

# AI 팀 운영 9단계 물질화 실행기획안

> 이 문서는 기존 다섯 공식 기획안의 단계 9 실행 투영이다. 역할·권한·경로·상태·검수 정책을 새로
> 소유하지 않으며, 충돌하면 `AGENTS.md`와 다섯 공식 기획안이 우선한다. Fable 검수와 사람의 실행
> 판단 전에는 이 문서를 근거로 팀 디렉터리·채팅·플러그인을 생성하지 않는다.

## 1. 목표와 완료 정의

9단계의 목표는 승인된 AI 팀 구조를 저장소와 Codex 앱의 실제 운영 표면에 최소권한으로 물질화하는
것이다. 완료는 다음을 모두 만족할 때만 주장한다.

1. 네 DRAFT 기획안과 필수 `docs/team` preflight 산출물이 한 activation commit에서 함께 효력을 얻고
   부분 활성화나 필수 파일 부재 중간 상태가 없다.
2. `docs/team`의 중앙 장부, 역할 manifest, 팀 manifest가 단일 권위 경계를 침범하지 않는다.
3. 기존 `ROLE_CONTEXTS.md`와 `TEAM_LEARNING.md`의 과거 기록·의미를 보존한 schema 이관이 끝난다.
4. 모든 기존 route가 `ROLE_CONTEXTS.md`에 등록되고 승인 기록이 없으면 `A0`으로 시작한다.
5. 마스터 5개 채팅과 부서 6개 채팅이 서로 다른 목적의 독립 컨텍스트로 생성된다.
6. 세 전역 플러그인은 조건별로 독립 사용되며 새 통합 플러그인·공용 실행 hook이 생기지 않는다.
7. 사람 Decision·운영 Go/No-Go·독립검수 권한은 AI 채팅이나 플러그인에 위임되지 않는다.
8. 사용자 소유 변경이 stage 9 commit에 포함되지 않고 모든 산출물이 정확한 SHA와 검증 증거에 묶인다.

## 2. 공식 근거 투영

| 실행 항목 | 공식 소유 문서·절 | 9단계 해석 |
|---|---|---|
| 채팅 이름·사람/마스터/부 경계 | 팀 구성안 §1.4, 오케스트레이션 §2.1 | 채팅 이름은 탐색 앵커이며 권한이 아니다. |
| `docs/team` 경로 | 팀 구성안 §11, 디렉터리 기획안 §4.2·§5.1 | 새 정책이 아니라 장부·manifest·링크만 둔다. |
| HANDOFF 위치·계보 | 온톨로지 §3, 디렉터리 기획안 §7.1 | 일반 Task 원본은 `docs/team/handoffs/<TASK-ID>/*.md`, 작업큐는 pointer만 둔다. |
| 위험 인스턴스 경로 | 팀 구성안 §11, 온톨로지 §3 | `docs/team/RISKS.md`가 위험 인스턴스만 소유하되 디렉터리 기획안의 중앙 노드 목록과 activation 전에 수렴시킨다. |
| Learning schema·A단계 | 품질 기획안 §6.1~§8 | schema 이관과 기존 route A0 등록을 activation 전 preflight에서 수행한다. |
| 활성화 원자성 | 디렉터리 기획안 §11 단계 6 | graph 검사 성공 뒤 네 문서를 한 commit에서 ACTIVE로 바꾼다. |
| 모델·토큰 경로 | 오케스트레이션 §6.3, 봉인 model plan | Terra xhigh 실행, Sol 구조 checkpoint, Fable 독립검수를 유지한다. |
| 작업·미션 연속성 | 작업큐, Mission Relay 정책 | 작업큐가 현재 Task 권위이고 Mission Relay는 구조화 미션·인계 계보를 유지한다. |

현재 문서 사이의 순환처럼 보이는 조건은 다음 순서로 해소한다.

```text
독립 실행 graph checker 준비
→ activation 전 허용된 기존 장부 schema 이관과 필수 중앙 노드·manifest를 커밋되지 않은 후보로 조립
→ planned tree에 graph checker 실행
→ 네 기획안·AGENTS·작업큐·필수 preflight 산출물을 한 원자 ACTIVE commit으로 봉인
→ 별도 구현 commit에서 `docs/operations` 최소 문서와 잔여 링크 물질화
→ 채팅 shell 생성
```

`ROLE_CONTEXTS.md`와 `TEAM_LEARNING.md`는 이미 존재하므로 activation 전에는 파일의 새 권위를
발행하는 대신 schema 이관·과거 항목 보존·기존 route A0 등록 후보를 만든다. 디렉터리 기획안 §11
단계 2에 따라 `docs/team/README.md`·`RELEASE_GATE.md`·역할/팀 manifest·`handoffs/README.md`도 같은
materialization preflight 창에서 한 번에 조립한다. 이 후보만 별도로 commit하지 않고 planned tree
검사가 통과한 뒤 네 기획안의 ACTIVE 변경과 같은 activation commit에 포함한다. 따라서 저장소에는
`DRAFT+실제 권위 파일` 또는 `ACTIVE+필수 파일 부재` 중간 commit이 남지 않는다. 첫 일반 HANDOFF
원본만 단계 11 파일럿 Task에서 생성한다. 단계 10은 9단계에서 독립 실행으로 사용한 checker를
`pnpm verify`에 연결하는 작업만 소유한다.

## 3. 범위와 비범위

### 3.1 포함

- 단계 8 사람 activation Decision의 exact SHA·다섯 문서 hash·시각과, 두 sidebar section·11개 A0
  채팅 shell 등 Codex 앱 외부 상태 생성 허용 범위의 명시 기록
- `docs/team` 중앙 장부·역할/팀 manifest·HANDOFF 경계 물질화
- `docs/operations`의 최소 운영 문서 골격과 단일 권위 링크
- Codex 앱의 마스터 5개·부서 6개 채팅 shell과 역할별 초기 지시 설정
- 세 전역 플러그인의 설치·버전·hook·정책 경로 읽기 전용 확인
- 독립 실행 문서 graph checker와 stage 9 전용 검증 증거

### 3.2 제외

- `apps/mobile`, `packages`의 소스 디렉터리 이동·이름 변경·기능 수정
- 다섯 공식 기획안을 `docs/plans`로 이동
- 새 통합 플러그인, 채팅별 플러그인 복제, 공용 실행 hook
- 계정 전환·로그인 자동화, 모델 selector UI 자동 변경
- Fable을 상설 Quality 채팅 안에서 실행하거나 사람 승인을 자동 생성하는 기능
- 스테이징·운영 배포, DB migration 적용, 운영 비밀·운영 데이터 접근
- 현재 사용자가 수정 중인 모바일·프로토타입·미추적 작업의 stage 9 commit 포함

## 4. 진입 게이트

| ID | 확인 항목 | 통과 기준 | 실패 시 행동 |
|---|---|---|---|
| S9-G01 | 단계 8 승인 | `d14ce2a...`와 다섯 문서 hash 및 두 sidebar section·11개 A0 shell 생성 범위를 명시한 HUMAN_DECISION | 범위가 없으면 저장소 물질화와 9.6을 각각 중단 |
| S9-G02 | 브랜치 기준 | `codex/ai-team-knowledge-orchestration-plans`, main 대비 behind 0 | 재기준화 계획만 제시 |
| S9-G03 | 모델 계획 | `MODEL_PLAN_VERIFIED`, SHA-256 `eac43ac...` | 다중 모델 실행 중단 |
| S9-G04 | 단계 1~7 증거 | Fable 유효 chain·Sol 구조 checkpoint·71/71 시뮬레이션 | 미충족 단계로 복귀 |
| S9-G05 | 작업트리 소유권 | 사용자 변경 allowlist와 stage 9 edit allowlist 분리 | 겹치는 경로 수정 금지 |
| S9-G06 | 전역 플러그인 | 세 canonical source와 설치본·hook 신뢰 상태 확인 | 재설치하지 않고 제약 보고 |
| S9-G07 | Fable 계획 검수 | 본 실행기획안의 필수 Finding 0 | Finding 반영 전 실행 중단 |
| S9-G08 | RISKS 경로 수렴 | 팀 구성안 §11·온톨로지 §3의 `RISKS.md`와 디렉터리 기획안 중앙 노드 목록이 같은 activation 후보에서 일치 | `RISKS.md`를 만들지 않고 공식 문서 정합화 Task로 분리 |

현재 사용자의 `진행` 응답은 단계 8 승인 의사로 해석됐지만 저장소 Decision에는 아직 물질화되지
않았다. 첫 변경은 그 결정을 정확한 대상 SHA·hash와 함께 기록하는 것이며, 이를 생략해 ACTIVE로
바꾸지 않는다.

## 5. 산출물 인벤토리

### 5.1 activation 전 preflight 산출물

| 경로 | 작업 | 소유 의미 |
|---|---|---|
| `docs/team/ROLE_CONTEXTS.md` | 과거 보존 schema 이관, 기존 route A0 등록 | 현재 역할 컨텍스트·자율성 단계 레지스트리 |
| `docs/team/TEAM_LEARNING.md` | `verifier_role`·사람 지정 Decision 필드 이관 | 검증된 Learning 인스턴스 장부 |
| `docs/team/DECISIONS.md` | 단계 8 activation Decision과 향후 승인 이력 초기화 | 사람 승인 이력만 소유 |
| `docs/team/RISKS.md` | 팀 구성안 §11·온톨로지 §3의 소유 근거를 디렉터리 기획안 중앙 노드 목록과 수렴시킨 뒤에만 미해결 위험·소유자·재검토 조건 초기화 | 위험 인스턴스만 소유 |
| `docs/team/README.md` | 중앙 장부·역할·팀·HANDOFF 탐색 링크 | 생성 가능한 비권위 탐색 지도 |
| `docs/team/RELEASE_GATE.md` | 릴리스 대상 SHA·증거·사람 승인 인스턴스 초기화 | 정책·배포 JSON을 복사하지 않는 연결 장부 |
| `docs/team/roles/*.md` | 다섯 역할 manifest 생성 | 입력·산출·인계·중단·검증 계약만 소유 |
| `docs/team/teams/*.md` | 여섯 팀 manifest 생성 | Task route·역할·권위·HANDOFF 경계만 소유 |
| `docs/team/handoffs/README.md` | 온톨로지·작업큐 lock 계약 링크 | 새 HANDOFF schema를 만들지 않는 경계 안내 |
| `scripts/docs-graph-check.mjs` | 독립 실행 최소 검사 | 상태를 고치지 않는 정적 검사기 |
| `scripts/docs-graph-check.test.mjs` | 누락·중복·권한 위조 사보타주 | checker 실패 폐쇄 증거 |

`package.json`과 `scripts/verify.mjs` 연결은 단계 10까지 하지 않는다.

### 5.2 activation commit

한 commit에서 다음을 원자적으로 갱신한다.

- 온톨로지·오케스트레이션·디렉터리·품질 기획안의 `status: ACTIVE`
- 각 문서의 `verified_by`와 activation Decision ID·대상 hash
- `AGENTS.md`의 네 문서 책임 경로
- 작업큐의 단계 8 완료·단계 9 진행 상태와 exact SHA 증거
- §5.1의 기존 장부 schema 이관과 필수 `docs/team` 중앙 노드·역할/팀 manifest·handoffs 골격

부분 ACTIVE, 서로 다른 activation commit, 필수 manifest가 빠진 activation SHA, 아직 생성되지 않은
파일에 대한 완료 주장은 거부한다. standalone checker는 커밋 전 planned tree와 생성된 activation
commit SHA를 모두 검사하고, 필수 manifest 부재 activation fixture를 실패시킨다.

### 5.3 activation commit에 포함할 `docs/team` 산출물

```text
docs/team/
├─ README.md
├─ DECISIONS.md
├─ RISKS.md
├─ RELEASE_GATE.md
├─ ROLE_CONTEXTS.md
├─ TEAM_LEARNING.md
├─ handoffs/
│  └─ README.md
├─ roles/
│  ├─ ORCHESTRATION.md
│  ├─ SOLAR.md
│  ├─ CODEX.md
│  ├─ INDEPENDENT-AUDIT.md
│  └─ OPERATIONS.md
└─ teams/
   ├─ 00-all-teams-room.md
   ├─ 01-product-mobile.md
   ├─ 02-data-backend.md
   ├─ 03-server-supabase-operations.md
   ├─ 04-quality-review.md
   └─ 05-knowledge-orchestration.md
```

`handoffs/README.md`는 새 HANDOFF schema를 만들지 않고 온톨로지와 작업큐 lock 계약만 링크한다. 첫
실제 HANDOFF 원본은 단계 11 파일럿 Task에서 생성한다.

activation 뒤 별도 구현 commit의 `docs/operations`는 다음 경로를 목표로 하되 9단계에서는 상위
권위와 내용이 겹치지 않는 최소 책임·진입점·검증 링크만 쓴다.

```text
docs/operations/
├─ RUNBOOK_RELEASE.md
├─ RUNBOOK_INCIDENT.md
├─ RUNBOOK_RECOVERY.md
├─ DATA_CORRECTION_POLICY.md
├─ MONITORING_CATALOG.md
├─ SUPPORT_PLAYBOOK.md
├─ PILOT_PLAN.md
└─ POSTMORTEMS/
```

`POSTMORTEMS`는 실제 incident 전 빈 권위 문서를 만들지 않는다. Git이 빈 디렉터리를 추적하지
않으므로 첫 사후분석이 생길 때 물질화한다.

## 6. 역할·팀 manifest 최소 필드

역할 manifest는 다음만 가진다.

- 역할 ID와 활성 컨텍스트 ID/version/hash
- 허용 route와 입력 allowlist
- 중앙 권위 문서 링크
- 필수 산출물과 검증 체크리스트
- HANDOFF 수신·발신 대상
- 중단 조건과 사람 escape

팀 manifest는 다음만 가진다.

- 팀 ID·표시 이름
- 입력 가능한 Task 유형과 담당 역할 ID
- 연결할 중앙 권위
- 허용 공지 채팅 이름
- 임시 Task 채팅 생성 조건
- HANDOFF 수신·발신 경계

제품 정책·DB 공식·토큰 임계값·현재 Task 상태·검수 결과를 manifest에 복사하지 않는다.

## 7. 채팅 물질화

9.0에서 기록된 activation Decision이 sidebar 외부 상태인 두 section·11개 A0 shell의 생성 범위를
명시한 경우에만 아래 shell을 정확한 제목으로 생성한다. 이 범위가 Decision에 없으면 9.6을 실행하지
않고 사람 결정을 요청한다.

```text
MarginCook · 마스터 작업
01 통합 작업큐 · 사람 결정
02 마스터 오케스트레이션
03 부 오케스트레이션 · 토큰/컨텍스트 관리
04 개발·스테이징 배포 검증
05 운영 배포 · 복구 게이트

MarginCook · 부서 그룹
00 모든 팀 상황실
01 Product · Mobile
02 Data · Backend
03 Server · Supabase · Operations
04 Quality · Review
05 Knowledge · Orchestration
```

각 shell의 최초 입력에는 역할 ID, 읽어야 할 manifest·권위, 금지 권한, Task 없는 변경 금지, 사람
escape만 넣는다. 전체 기획안 원문·과거 대화·비밀·실제 thread ID를 저장소에 복사하지 않는다.
상설 Quality 채팅은 일정·차단·결과 링크만 조정하고 Fable/Codex 독립검수는 회차별 클린 컨텍스트에서
실행한다.

새 shell은 A0 읽기·상태 복원만 허용한다. 실제 변경은 별도 Task Packet·edit lease·필요한 Mission
Relay 복원/Study Gate를 충족한 임시 Task 채팅에서만 시작한다. 여러 successor를 한 HANDOFF에
연결하지 않는다.

## 8. 플러그인 결합 계약

| 플러그인 | 호출 조건 | 주 소비 채팅 | 저장소가 보관하는 것 | 금지 |
|---|---|---|---|---|
| Account Continuity | 사용자가 계정을 바꾼 뒤 | `03` 부 오케스트레이션 | 영수증 경로·hash pointer | 계정·이메일·인증정보 저장, 자동 전환 |
| Project Orchestrator | 새 장기 프로젝트 또는 계획 변경 | `02` 마스터, `03` 부 | 봉인 model plan·sidecar | 현재 채팅 selector 변경 주장, 배포 승인 |
| Mission Relay | 장기 미션·컨텍스트 압력·복원 | `03` 부와 임시 Task | 미션 ID·증거 pointer·HANDOFF 계보 | 작업큐 대체, 계정 전환 판정 복제 |

세 플러그인을 매 채팅에서 항상 실행하지 않는다. role manifest는 호출 가능 조건과 정책 링크만
선언하며 플러그인 상태·판정 알고리즘을 복제하지 않는다. 새 통합 플러그인과 공용 hook은 만들지
않는다.

## 9. 실행 순서와 commit 경계

| 순서 | 작업 | commit/외부 상태 경계 |
|---:|---|---|
| 9.0 | 단계 8 Decision 기록, branch·dirty·hash 재확인 | decision 기록 commit |
| 9.1 | standalone graph checker와 사보타주 작성 | checker 준비 commit |
| 9.2 | 기존 장부 schema 이관·route A0 등록·`docs/team` README/RELEASE_GATE·역할/팀 manifest·handoffs 골격을 working tree 후보로 조립 | 별도 commit 금지 |
| 9.3 | planned tree 검사·Fable/Sol 구조 checkpoint | 변경 없는 검증 증거 |
| 9.4 | 네 문서·AGENTS·작업큐와 9.2 필수 산출물 원자 ACTIVE 승격 | activation commit |
| 9.5 | `docs/operations` 최소 문서 생성과 preflight 산출물의 잔여 링크 보정 | implementation commit |
| 9.6 | 두 section과 11개 A0 채팅 shell 생성 | Codex 앱 외부 상태 |
| 9.7 | 생성 결과 링크·검증 증거·stage 9 상태 기록 | evidence commit |

commit마다 stage 9 allowlist만 선택해 staging한다. 사용자 소유 파일과 본 단계 밖 미추적 파일은
포함하지 않는다. 새 브랜치를 만들지 않고 현재 branch를 유지하며, main 반영·push·배포는 하지 않는다.

## 10. 검사 항목

standalone checker와 수동 증거가 최소한 다음을 확인한다.

- 중앙 `doc_id`·주제 권위 중복 0
- Markdown 링크·필수 manifest·역할 ID 누락 0
- 팀 manifest가 가리키는 ROLE_CONTEXT version/hash 존재
- 채팅 이름을 승인 권한으로 사용하는 문구 0
- 미승인 route의 A단계가 A0 초과 0
- 작업큐와 별도 현재 Task 장부 0
- HANDOFF 원본과 작업큐 pointer 역할 혼동 0
- `RELEASE_GATE`와 deployment evidence 내용 복제 0
- role/team manifest의 플러그인 상태·판정 알고리즘 복제 0
- 새 통합 플러그인·공용 실행 hook 0
- Fable 상설 채팅 실행·제작 컨텍스트 주입 0
- 사용자 변경 stage 9 commit 포함 0
- 네 문서 ACTIVE 상태·activation Decision의 원자 일치

## 11. 실패·중단·복구

- graph checker가 없거나 실패하면 activation과 문서 생성 중단
- 장부 schema 이관에서 과거 항목 유실·재해석이 발생하면 원본을 유지하고 별도 migration Task로 분리
- 기존 플러그인 설치/hook이 확인되지 않으면 자동 재설치하지 않고 `ENVIRONMENT_UNVERIFIED`
- 같은 역할에 두 활성 context hash가 생기면 A0로 두고 사람 Decision 요청
- 채팅 생성 일부 실패 시 생성된 shell을 공식 완료로 쓰지 않고 누락 목록만 기록
- 단계 8 Decision에 sidebar section·11개 shell 생성 범위가 없으면 9.6을 실행하지 않음
- Fable timeout·budget failure를 PASS로 합성하거나 같은 입력을 자동 재호출하지 않음
- source directory·운영 환경·사용자 파일과 충돌하면 해당 경로를 제외하고 stage 9 범위를 확대하지 않음

## 12. 단계 9 종료 패킷

종료 패킷은 다음을 포함한다.

- activation Decision ID와 다섯 문서 before/after hash
- 단계 9 commit 목록과 각 commit의 허용 파일 manifest
- standalone checker·사보타주 실행 결과
- 역할/팀 manifest inventory와 ROLE_CONTEXT registry hash
- 생성된 sidebar section·채팅 제목 목록(실제 thread ID와 대화 원문 제외)
- 세 플러그인 확인 결과와 미설치·미신뢰 제약
- Fable/Sol Finding과 disposition
- 단계 10의 단일 다음 행동: checker를 기존 `pnpm verify`에 연결하되 6단계 분모를 바꾸지 않기;
  정확한 연결 단계 선택은 단계 10 Task가 소유

## 13. Fable 집중 검토 질문

1. 9.1 checker 준비 → 9.2 preflight → 9.4 ACTIVE → 9.5 구현 순서가 다섯 문서의 활성화 조건을 모순 없이 해소하는가?
2. activation 전 생성·수정해도 되는 장부와 activation 뒤에만 만들 파일의 경계가 정확한가?
3. 두 sidebar section과 11개 A0 shell이 Mission Relay의 단일 successor·Study Gate 규칙과 충돌하지 않는가?
4. role/team manifest가 별도 작업·승인·플러그인 상태 권위로 변질될 여지가 있는가?
5. 새 통합 플러그인 없이 세 전역 플러그인의 적용 누락을 탐지할 검증 계약이 충분한가?
6. 단계 9와 단계 10의 checker 책임 분리가 가능한가?
7. 누락된 필수 산출물·사람 Decision·원자 commit 경계가 있는가?
