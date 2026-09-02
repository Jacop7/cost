# AI 기획 12단계 선작업 검증 영수증

> 상태: `PREWORK_VERIFIED v1` · 비권위 실행 증거
> 실행일: 2026-09-02 Asia/Seoul
> Task: `AI-ORCH-PLANS-PREWORK-1`
> 검증 대상 commit: `a093b083b14bcda7d1a033de478957100d458a8c`
> 검증 대상 tree: `236321933238d08253a5aa63a6be5f43be966b4f`

## 1. 선작업 결과

| 항목 | 결과 | 판정 |
|---|---|---|
| 기존 브랜치 fast-forward | `codex/ai-team-knowledge-orchestration-plans`가 `022840a` 포함 | 통과 |
| 사용자 변경 보존 | fast-forward 전후 dirty 경로·내용 fingerprint 차이 0 | 통과 |
| 경로 3분할 | 최초 73항목: user-owned 57, AI 미커밋 10, in-scope 6, 미분류 0, 중복 0 | 통과 |
| 선작업 커밋 뒤 분할 | 67항목: user-owned 57, AI 미커밋 10, 미분류 0 | 통과 |
| 롤오버 반영 후보표 | 단일 소유·연결 방향·승인 주체·RC-01~08 disposition 후보 기록 | 통과 |
| 사람 Decision 패킷 | branch·lease·ontology·rollover·store·보존·NO_OWNER·정리·비용 항목 기록 | 통과 |
| Fable Task 대조 | ONTOLOGY-005 불변 실패 보존, successor 필요. 후속 4건 target/AGENTS/task hash 기록 | 통과 |

## 2. 실행 검증

### `corepack pnpm ai:plans:simulate`

- exit code: `0`
- tests: `70`
- pass: `70`
- fail: `0`
- 의미: 현재 브랜치에서 다섯 문서망·Task·lease·Finding·Learning·rollover 사보타주 기준선 통과

### `corepack pnpm verify --no-db`

- exit code: `0`
- ① 타입: 통과
- ② core: 13 files, 194 passed, 12 skipped
- ② mobile: 28 files, 233 passed
- ③ CLI·ACL·보호 gate: 통과
- ④ 새 DB: 건너뜀
- ⑤ 업그레이드 경로: 건너뜀
- ⑥ 웹 번들: 통과
- 최종 판정: 선택 범위 `4/6` 통과. 전체 `pnpm verify` 통과로 표현하지 않는다.
- 주의: 사용자 소유 모바일 WIP가 같은 worktree에 있으므로 이 결과는 커밋 단독 재현 증거가 아니라
  현재 혼합 worktree의 안전 기준선이다.

### `corepack pnpm fable:check`

- exit code: `0`
- Claude Code: `2.1.250`
- 연결: 정상
- 인증: 로그인됨
- 의미: 비과금 연결·인증 preflight만 확인. Fable 모델 용량·유효 review 결과·비용 승인은 확인하지 않음.

### `git diff --check`

- 출력 없음, exit code `0`

## 3. 원격·CI

- `origin/codex/ai-team-knowledge-orchestration-plans`: `c1b595f74f2fc7824b480bf8457e3026c0f1d6dc`
- 검증 대상 로컬 commit은 원격보다 58커밋 앞섰다.
- GitHub CLI는 설치돼 있지 않고 공개 Actions API에서 exact-HEAD run을 확인하지 못했다.
- 따라서 exact-HEAD CI는 `미실행 또는 미확인`이며 통과로 합성하지 않는다.
- push와 원격 CI는 이번 선작업 범위가 아니며 최종 병합·게이트 전에 별도로 수행한다.

## 4. 본작업 진입 상태

기술 기준선은 준비됐다. 다만 다음 두 권한 조건은 선작업이 자동 생성하지 않는다.

1. `AI-ORCH-PLANS-SIM-1`의 유효한 기존 lease를 유지할지 실행 주체에 인계할지 사람 Decision 또는
   기존 소유자 HANDOFF가 필요하다.
2. `ONTOLOGY-005`는 immutable 실패 원본이므로 현재 AGENTS blob과 새 target commit을 가진 successor
   Task를 발행해야 한다. 기존 task·round·status를 덮어쓰지 않는다.

따라서 선작업 자체는 완료됐고, 12단계 본작업은 위 두 조건이 기록된 뒤 `GO`다.

