# AI 기획 12단계 실행 전 기준선

> 상태: `PREWORK_BASELINE v1` · 비권위 실행 증거
> 관측 시각: 2026-09-02T21:52:29+09:00
> Task: `AI-ORCH-PLANS-PREWORK-1`
> 권위 제한: 이 파일은 다섯 기획안·작업큐·Fable 원본을 대체하지 않는다.

## 1. Git 기준선

| 항목 | 값 |
|---|---|
| branch | `codex/ai-team-knowledge-orchestration-plans` |
| HEAD | `022840ab627b1653e94c97e8208b9268399e36ea` |
| tree | `4b1f0930dcd086e4eb667f90daaa22b854648a57` |
| AGENTS blob | `c32214b5528752a91f0f1545fea8c735d5fae7fa` |
| origin branch HEAD | `c1b595f74f2fc7824b480bf8457e3026c0f1d6dc` |
| origin relation | 로컬 HEAD가 57커밋 앞섬 |
| exact-HEAD CI | GitHub CLI 미설치·공개 API 결과 없음. `미실행 또는 미확인`으로 보존 |

브랜치 정합 전에 기록한 dirty 경로·내용 fingerprint와 fast-forward 뒤 fingerprint의 차이는 0건이었다.
새 브랜치를 만들지 않았고 기존 AI 기획 브랜치를 `cd5d54c`에서 `022840a`까지 fast-forward했다.

## 2. 다섯 문서 SHA-256

| 문서 | 상태 | SHA-256 |
|---|---|---|
| `docs/팀구성_상세기획안.md` | `CONFIRMED v1.3` | `29520df8333a62e87bde77405862dfe5c3ab0fbc7dd9c63d60bcfe792018ea3d` |
| `docs/AI-지식-온톨로지-기획안.md` | `DRAFT v0.2` | `217a3d308bdad63940f8473318b992cc07df63664a27c26823bf10cf3f13f995` |
| `docs/AI-오케스트레이션-상세기획안.md` | `DRAFT v0.2` | `25b53a068273268b6e820bdf77b85cd850cefe77b681e6db7caddb06ba4846ea` |
| `docs/디렉터리-문서신경망-재설계-기획안.md` | `DRAFT v0.2` | `81796a6b5ccde312a1e4eb376728195dcca53fcbd630137f844f260495a7498c` |
| `docs/AI-품질-학습-자율성-평가기획안.md` | `DRAFT v0.2` | `acbfaa650728437dd355ba7002cbaf2e47c8f2b168a04892847785c486662295` |

## 3. 작업 트리 완전 3분할

### 사용자 소유·이번 작업 제외

- `apps/mobile/src/components/kit/**`
- `apps/mobile/src/features/**`
- `apps/mobile/src/theme/tokens.ts`
- `apps/mobile/src/lib/appAlert.ts`
- `scripts/prototype_server.py`
- `docs/prototypes/**`
- `docs/ai-review/tasks/PROTOTYPE-TERMINOLOGY-001/**`
- `.codex-share/**`
- `.tmp/**`
- `.claude/settings*.json`

### AI 미커밋·이번 선작업 제외

- `docs/ai-review/evidence/AI-CONTEXT-CROSS-STUDY-*.md`

이 파일들은 별도 교차 스터디의 진행·실패·질의응답 원본이다. 완결 여부와 소유 Task를 확인하기 전
스테이징하거나 이번 선작업의 완료 근거로 사용하지 않는다.

### 이번 선작업 입력·산출물

- `docs/ai-review/evidence/AI-CONTEXT-MISSION-CONTINUITY-V1.md`
- `docs/ai-review/evidence/AI-CONTEXT-MISSION-CONTINUITY-V2.md`
- `docs/ai-review/evidence/AI-CONTEXT-MISSION-CONTINUITY-OPUS-R1.md`
- `docs/ai-review/evidence/AI-PLANS-PREWORK-BASELINE.md`
- `docs/ai-review/evidence/AI-PLANS-PREWORK-PATCH-MAP.md`
- `docs/ai-review/evidence/AI-PLANS-PREWORK-DECISIONS.md`
- `docs/작업큐.md`

표의 해시는 worktree 줄바꿈이 아니라 target commit의 Git blob 바이트를
`git show <target>:<path>`로 읽어 SHA-256을 계산한다. 분류는
`node scripts/ai-plan-prework-status-check.mjs --compare-user-manifest docs/ai-review/evidence/AI-PLANS-PREWORK-USER-STATE.json`
으로 판정한다. 새 경로가 어떤 규칙에도 맞지 않으면 자동 실패하며, 미분류·중복 분류가 모두 0이고
저장된 사용자 경로·status·해시가 현재 상태와 같을 때만 통과한다.

## 4. 검수 Task 기준선

| Task | target | AGENTS blob | task SHA-256 | 상태 |
|---|---|---|---|---|
| `AI-PLANS-V02-ONTOLOGY-005` | `7ff8b737` | `4c31bbf` | `a7e08013d0854f748b7dae4fb1674b63931eccaa95dc7f8ebb6b429b5ff62e6f` | `RUN_FAILED`, verdict 없음 |
| `AI-PLANS-V02-TEAM-POLICY-002` | `96e19638` | `c32214b` | `a9c1ae85e48f2b69203dd89409c28318807322a81fed64910a2c600477eb2dba` | 미실행 |
| `AI-PLANS-V02-ORCHESTRATION-003` | `96e19638` | `c32214b` | `f50c77ea068bb9c35d72839c9a82ff91d020284e9a50b066ddb5243ba23241b5` | 미실행 |
| `AI-PLANS-V02-DIRECTORY-003` | `96e19638` | `c32214b` | `f1694405326f46382419b231acaa97d433b5be403ec5bdcd142a7a2bba11cc82` | 미실행 |
| `AI-PLANS-V02-QUALITY-003` | `96e19638` | `c32214b` | `88b81e74780533c6344f40c2499a550b7f3e17a1248e779c77a90b43ebba5fad` | 미실행 |

`ONTOLOGY-005`의 `task.json`과 실패 회차는 불변으로 보존한다. 현재 `AGENTS.md`를 기준으로 다시
검수하려면 기존 Task를 덮어쓰지 않고 successor Task를 새 exact commit에 발행해야 한다.

열린 필수 Finding은 다음 세 개다.

- `ONT-003-HANDOFF-MUTABLE-STORE`
- `ONT-003-HANDOFF-VERSION-GAP`
- `ONT-003-LEASE-TAKEOVER-GAP`

## 5. lease 경계

`AI-ORCH-PLANS-SIM-1`의 현재 lease는 `SOLAR-AI-DEPUTY / SESSION-AI-PLANS-SIM-001`이며 2026-09-04
18:00+09:00까지다. 이 선작업은 다섯 공식 문서를 편집하지 않고 별도 `CODEX-QA` Task에서 증거만
준비한다. 본작업 시작 전에는 기존 소유자의 HANDOFF 또는 별도 사람 Decision을 기록해야 한다.

## 6. 기계식 완료 조건

| 조건 | 명령 | 기대 결과 | 증거 |
|---|---|---|---|
| 브랜치 | `git branch --show-current` | `codex/ai-team-knowledge-orchestration-plans` | 이 파일 §1 + 실행 출력 |
| 계획망 | `corepack pnpm ai:plans:simulate` | tests 70, pass 70, fail 0 | 실행 출력 + exact HEAD |
| 빠른 로컬 게이트 | `corepack pnpm verify --no-db` | 선택 범위 4/6 성공, skip 명시 | 실행 출력 + exact HEAD |
| Fable 연결 | `corepack pnpm fable:check` | exit 0, 연결 정상, 로그인됨 | 실행 출력 |
| 경로 분할 | status 분류 판정 | 미분류 0, 중복 0 | 이 파일 §3 + 실행 출력 |
| Task 준비 | Task/hash 대조 | immutable 실패 보존, successor 필요 여부 명시 | 이 파일 §4 |

`verify --no-db`는 전체 6/6 통과가 아니며 Docker DB·업그레이드 검사를 건너뛴 빠른 기준선으로만 쓴다.
