# AI-PLANS-SIM-CODEX-ULTRA-R5 — b4f79a6 실행·작업큐 스냅샷 재결속

> Task: `AI-ORCH-PLANS-SIM-1`
> 상태: `VERIFIED_WITH_OPEN_FABLE_FINDINGS`
> 검증 대상: `b4f79a6e9e3bfc830b4686a7b6ab861a37b26cf3`
> 대상 tree: `8afcb562aa8669c50b60e5d1a7c1adb3c6679903`
> 기준 구현: `c1b595f74f2fc7824b480bf8457e3026c0f1d6dc`
> 검증 시각: `2026-09-02T12:27:18+09:00`

## 1. exact commit 파일 결속

`b4f79a6`의 Git commit bytes를 다음 값으로 고정한다.

| 파일 | Git blob | SHA-256 |
|---|---|---|
| `scripts/ai-plan-network-simulation.mjs` | `aa5ef6136e8d7829aa0a765bddd936c69cf91999` | `83ACE8F4750B04D45F8270D2F2C5007BC9E1935E74F4FC99B9820263C8E446D4` |
| `scripts/ai-plan-network-simulation.test.mjs` | `4b43660ea2018e7ab872ff588de3cf46cce5374d` | `AF576889296EF8C1ADC40CA91B31E291F04655DC3E385634BD0A8D1A496F85DC` |

작업큐에 고정된 `candidate_manifest_sha256`은
`35ad0825091c367de12e6d1d019e23ba19493f2ee07debebd1c04ef511a5dd39`다. `canonicalArtifactSha()`는
CRLF를 LF로 정규화해 Windows 작업복사본과 Git commit bytes가 같은 후보 manifest를 만들게 한다.

## 2. 격리 실행 두 갈래

원 작업복사본의 사용자 변경을 입력에서 배제한 일회용 로컬 clone 두 개에서 실행했고, 실행 뒤 두
clone을 모두 제거했다.

첫 탐침은 exact `b4f79a6`을 detached HEAD로 checkout했다. Task의 `active_branch`는
`codex/ai-team-knowledge-orchestration-plans`인데 실제 브랜치 이름이 빈 문자열이므로 56/59로
실패했다. 실패 세 건은 모두 이 선행 계약 불일치에서 발생했다. 이 결과를 PASS로 세지 않는다.

두 번째 탐침은 같은 exact commit을 Task가 선언한 브랜치 이름으로 checkout했다.

```text
branch codex/ai-team-knowledge-orchestration-plans
commit b4f79a6e9e3bfc830b4686a7b6ab861a37b26cf3
tree 8afcb562aa8669c50b60e5d1a7c1adb3c6679903
node --test scripts/ai-plan-network-simulation.test.mjs
tests 59 · pass 59 · fail 0 · exit 0
```

따라서 `b4f79a6`의 업무 시뮬레이션은 commit만 같으면 되는 시험이 아니라 Task의 branch 재개 계약까지
같아야 통과한다. 성공과 실패를 둘 다 보존하며 성공 실행만 exact branch clone 증거로 사용한다.

## 3. 신규 Fable 회차

금액은 Claude CLI `run.json`의 `total_cost_usd` 사용량 지표이며 별도 API 청구를 단정하지 않는다.

| Task·회차 | 결과 | verdict | 사용량 지표 |
|---|---|---:|---:|
| `FINAL-WORKFLOW-005/r001` | `RESULT_RECEIVED` | `CHANGES_REQUIRED` | `$3.776037` |
| `FINAL-NETWORK-004/r001` | `RUN_FAILED / budget_exhausted` | 없음 | `$4.231238` |

R4까지의 `$11.790167`에 두 회차 `$8.007275`를 더한 기록 합계는 `$19.797442`다. 두 번째 회차는
판정이 없으므로 네트워크 검수나 PASS로 세지 않는다. 승인한 두 호출 이후 추가 외부 호출은 하지 않았다.

## 4. Finding 반영

`FW5-B4F79A6-RUN-EVIDENCE-002`의 실행·파일 hash 완료 조건은 이 문서로 충족한다. 작업큐는
`b4f79a6` 실행 결과와 R5를 가리키도록 갱신한다.

`FW5-QUEUE-SNAPSHOT-001`은 `untracked_in_scope_paths`에서 이미 추적된 R4를 제거하고 빈 목록으로
고쳤다. 시뮬레이터는 앞으로 이 목록의 각 경로를 `git ls-files --error-unmatch`로 대조해 추적 파일을
미추적으로 기록하면 실패한다. `worktree_state`는 공식 범위는 깨끗하고 제외된 사용자 작업만 섞여
있다는 두 경계를 한 문장으로 구분한다.

이 문서는 두 Finding을 스스로 CLOSED로 만들지 않는다. 같은 Fable 역할의 유효한 후속 closure review와
exact-SHA 보호 gate가 생기기 전까지 gate는 OPEN이고 네 DRAFT 문서의 ACTIVE 전환·디렉터리 생성은
금지된다.

## 5. 후속 수정 검증

R5·작업큐·검사기·시험을 함께 바꾼 작업복사본에서 `corepack pnpm ai:plans:simulate`는 59/59를
통과했다. CI와 같은 비-DB 범위 `corepack pnpm verify --no-db`도 타입·core/mobile 시험·CLI/ACL·
웹 번들 4/6을 통과했고 DB 두 단계는 명시적으로 건너뛰었다.

전체 `corepack pnpm verify`는 4/6이며 전체 통과로 표현하지 않는다. 공유 개발 DB가 국제 세금 최신
시드와 달라 44/50이고, 첫 자동 일회용 DB 회차는 생성 결과를 찾지 못해 실패했다. 사용자 데이터를
보호하기 위해 공유 개발 DB를 초기화하지 않았다.

대신 `fresh_ai_plans_r5` 일회용 DB를 Git Bash의 절대 경로로 새로 만들어 다음을 직접 확인했다.

- 전체 migration·시드 생성 완료
- DB 회귀시험 50/50
- ACL 실제 DB 계약 통과: metric 22개·모바일 RPC 73개·비-mobile 예외 2개
- 2세션 판매·마감·브레이크 경합 통과
- locale·international DB parity 13/13

검증 뒤 `fresh_ai_plans_r5`는 같은 이름 검증을 거쳐 삭제했다. 이 수동 분해 검증은 전체 verify 6/6을
대체하지 않으며, 공유 개발 DB 정합화는 사용자 데이터 보호 판단이 필요한 별도 작업으로 남긴다.
