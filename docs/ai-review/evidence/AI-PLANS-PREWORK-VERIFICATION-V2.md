# AI 기획 12단계 선작업 검증 영수증 v2

> 상태: `PREWORK_VERIFIED_EXECUTION` · 비권위 실행 증거
> 실행일: 2026-09-02 Asia/Seoul
> Task: `AI-ORCH-PLANS-PREWORK-1`
> 명령 실행 commit: `43c7ca42c9eacabb6bda2eaf29830209b948078c`
> 명령 실행 tree: `82b893878366446cbff0cbf4d94cd3f0ae8541a3`
> 영수증 봉인 commit: 이 파일을 최초 추가한 후속 commit. `git log --diff-filter=A --format=%H -- docs/ai-review/evidence/AI-PLANS-PREWORK-VERIFICATION-V2.md`의 첫 결과로 결정한다.

이 문서는 첫 영수증의 실행 시점과 봉인 시점 혼재를 바로잡는다. 첫 영수증과 Opus r1은 감사 원본으로
보존하며 수정하거나 PASS로 합성하지 않는다. `명령 실행 commit`은 아래 명령을 실제 실행한 Git 기준선이고,
`영수증 봉인 commit`은 그 결과를 담은 이 파일이 처음 추적된 별도 commit이다.

## 1. Opus r1 Finding 보완

| Finding | 보완 | 재현 조건 |
|---|---|---|
| F-01 Git blob 해시 | 기준선의 다섯 문서 해시를 `git show <target>:<path>` 바이트로 다시 계산 | 기준선 표의 5개 SHA-256 일치 |
| F-02 사용자 원본 manifest | 사용자 소유 57개 경로의 status·content SHA를 JSON으로 봉인 | `entries_sha256=9ad03c3420154ce94ad9c941ab1f71736231188a9beee38d22052702d31c12df` |
| F-03 3분할 판정식 | exact/prefix/glob 규칙과 미분류·중복 즉시 실패 검사기 추가 | 아래 상태 명령 exit 0, 미분류 0, 중복 0 |
| F-04 실행·봉인 SHA | 실행 commit·tree, 영수증 경로, 후속 봉인 commit을 서로 다른 필드로 기록 | 작업큐 `last_verified_sha`는 실행 commit만 가리킴 |

## 2. 명령 실행 결과

모든 명령은 위 `43c7ca42...`를 HEAD로 둔 동일한 혼합 worktree에서 실행했다. 사용자 소유 WIP는
시험 입력에 포함될 수 있으므로 `verify --no-db` 결과를 clean-commit 단독 재현으로 과장하지 않는다.

### 상태 3분할과 사용자 변경 보존

```text
node scripts/ai-plan-prework-status-check.mjs --compare-user-manifest docs/ai-review/evidence/AI-PLANS-PREWORK-USER-STATE.json
exit 0
USER_OWNED=57
AI_OWNED_UNCOMMITTED=12
IN_SCOPE=2
unclassified=0
multiplyClassified=0
userManifestMatch=true
```

`IN_SCOPE=2`는 아직 봉인 전이던 Fable review Task의 `task.json`과 `collaboration.md`다. 검사기는 새
경로가 어느 규칙에도 속하지 않거나 둘 이상에 속하면 exit 1로 실패한다.

### 실행형 기획망 시뮬레이션

```text
corepack pnpm ai:plans:simulate
exit 0
tests=70, pass=70, fail=0
```

### 필수 로컬 게이트의 DB 제외 범위

```text
corepack pnpm verify --no-db
exit 0
① 타입=통과
② core=13 files, 194 passed, 12 skipped
② mobile=28 files, 233 passed
③ CLI·ACL·보호 gate=통과
④ 새 DB=건너뜀
⑤ 업그레이드 경로=건너뜀
⑥ 웹 번들=통과
```

판정은 선택 범위 `4/6` 통과다. 전체 `corepack pnpm verify` 통과가 아니다.

### Fable 연결과 diff 위생

```text
corepack pnpm fable:check
exit 0
Claude Code CLI=2.1.250
authentication=logged in

git diff --check
exit 0
```

`fable:check`는 연결 preflight이며 유효한 Fable review 결과를 뜻하지 않는다.

## 3. 선작업 1~11 검수 입력

1. Git blob 기준 변경 전 기준선과 다섯 문서 해시
2. 모든 status 경로의 user-owned·AI-owned-uncommitted·in-scope 3분할
3. 새 브랜치 없이 기존 브랜치의 fast-forward 계보
4. 사용자 소유 57개 경로의 원본 manifest와 현재 일치
5. `AI-ORCH-PLANS-SIM-1` lease 및 다섯 공식 문서 무변경
6. 기존 Fable 실패 불변 보존과 successor 필요성·후속 Task 정합
7. 롤오버 v2 RC-01~08과 다섯 단일 소유 문서 patch map
8. 사람 승인 전용 10개 Decision 대기표
9. 미분류·중복·사용자 fingerprint 불일치 시 실패하는 완료 판정기
10. 시뮬레이션 70/70·로컬 게이트 4/6·Fable 연결 결과의 범위 제한
11. 명령 실행 commit과 영수증 봉인 commit의 2단계 SHA 결속

## 4. 본작업 경계

이 영수증은 12단계 본작업을 승인하지 않는다. 기존 `AI-ORCH-PLANS-SIM-1` lease 인계와
`ONTOLOGY-005` successor 발행은 사람 Decision/HANDOFF가 필요한 별도 조건이다. 다섯 공식 기획안,
실제 팀 디렉터리, `pnpm verify` 그래프 연결, 파일럿, 스타터 키트는 이 선작업에서 변경하지 않았다.
