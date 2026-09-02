# AI 기획 선작업 1~11 Claude Opus 검수 r1

> 상태: `OPUS_DIRECT_ADVISORY`
> 판정: `CHANGES_REQUIRED`
> 실행일: 2026-09-02 Asia/Seoul
> 대상 commit: `a6d085c8a1758792fe45ca3a2ec507bda731a125`
> 대상 tree: `6659ebc4586316fc561a8741ae08ff59db18ff64`
> 모델: `claude-opus-5`
> Claude Code CLI: `2.1.250`
> session: `5df74106-2e37-449c-985b-4418c1ee3847`
> terminal reason: `completed`
> reported cost: `$1.668547`
> 권위 제한: 이 자문은 공식 Fable 완료 검수나 보호 원격 gate를 대체하지 않는다.

## 1. 전체 판정

Critical은 0건이다. 실행 방향 왜곡, 실패·미확인의 PASS 합성, 사용자 소유 변경 침범, PREWORK-1과
SIM-1의 lease 충돌은 발견되지 않았다. 그러나 증거 재현성 Major 4건 때문에 본작업 진입은
`CONDITIONAL HOLD`다.

## 2. 항목별 판정

| # | 항목 | 판정 | 요약 |
|---|---|---|---|
| 1 | 변경 전 기준선 | `CHANGES_REQUIRED` | 팀 구성안 SHA-256 한 건에 worktree CRLF 값 혼입 |
| 2 | 경로 3분할 | `PASS` | 사용자·별도 AI 스터디·선작업 경계와 미스테이징 확인 |
| 3 | 기존 브랜치 fast-forward | `PASS` | `cd5d54c`가 `022840a`의 조상이며 신규 브랜치 없음 |
| 4 | 사용자 fingerprint 동일성 | `CHANGES_REQUIRED` | 차이 0 결과만 있고 경로별 원본 manifest가 없음 |
| 5 | SIM-1 lease 경계 | `PASS` | 기존 lease와 공식 기획안은 무변경, Task별 lease 병존 가능 |
| 6 | Fable Task 정합 | `PASS` | 다섯 task SHA 정확, ONTOLOGY 실패·구 AGENTS와 후속 네 건 확인 |
| 7 | 롤오버 patch map | `PASS` | RC-01~08 8/8과 17개 요구를 단일 소유 후보에 연결 |
| 8 | 사람 Decision 표 | `PASS` | 10개 Decision 후보의 질문·권고·시점·승인자·상태 존재 |
| 9 | 기계식 완료 조건 | `CHANGES_REQUIRED` | 새 PREWORK review Task 경로가 분류 규칙에 없어 재실행 불가 |
| 10 | 세 검증 실행 | `PASS` | 70/70·4/6·연결 preflight 표현은 범위를 과장하지 않음 |
| 11 | exact commit 재봉인 | `CHANGES_REQUIRED` | 실행 commit·영수증 commit·last_verified_sha와 상태 표현이 혼재 |

## 3. Finding

### F-01 · Major · Git blob 해시 기준 혼입

- 근거: 기준선의 팀 구성안 SHA가 worktree CRLF 바이트 기준이었다. target commit blob 기준 값은
  `29520df8333a62e87bde77405862dfe5c3ab0fbc7dd9c63d60bcfe792018ea3d`다.
- 수정: 다섯 문서 해시는 `git show <sha>:<path>`의 blob 바이트로만 계산하고 산출식을 문서에 적는다.
- 수용: 다섯 행 모두 같은 명령으로 재현된다.

### F-02 · Major · 사용자 변경 전후 원본 manifest 부재

- 근거: fast-forward 전후 fingerprint 차이 0이라는 결과만 있고 경로·status·해시 원본이 없다.
- 수정: 사용자 소유 경로별 `path + status + sha256`을 저장하고 현재 상태와 비교하는 판정기를 둔다.
- 수용: 저장 manifest와 현재 worktree 비교가 차이 0으로 재현된다.

### F-03 · Major · 3분할 판정식 부재

- 근거: 문서의 경로 목록만으로는 새 PREWORK review Task 두 파일을 분류하지 못했다.
- 수정: glob·exact allowlist와 미매칭 즉시 실패를 구현하고 명령·기대 출력을 완료 조건에 넣는다.
- 수용: 새 파일이 생겨도 결정적으로 통과 또는 실패하고 미분류·중복이 0이다.

### F-04 · Major · 실행 SHA와 봉인 상태 혼재

- 근거: 명령 실행 대상 `a093b08`, 첫 영수증 commit `a6d085c`, 작업큐 `last_verified_sha 022840a`가
  서로 다른 의미인데 구분되지 않았다. 같은 commit에서 이미 tracked인 영수증을 미추적으로 적었다.
- 수정: 명령 실행 commit과 증거 봉인 commit을 분리하고, `last_verified_sha`·worktree 상태·미추적
  목록을 최신 검증 대상에 맞춘다. 원문 또는 재현 가능한 판정 증거를 남긴다.
- 수용: 봉인된 파일만으로 실행 대상·결과·증거 위치를 모순 없이 재구성한다.

## 4. 사용자 변경·lease 판정

- 사용자 소유 변경 침범: `없음`
- PREWORK-1과 SIM-1 lease 충돌: `없음`
- 이유: 두 Task의 lease는 Task 단위이며, PREWORK-1은 다섯 공식 기획안과 SIM-1 lease를 바꾸지 않았다.
- 보완: 공유 레지스터인 `docs/작업큐.md`의 서로 다른 Task 블록만 편집했다는 예외를 계속 명시한다.

## 5. 다음 요청

F-01~04를 수정하고 선작업 1~11 전체를 새 exact commit에서 Opus로 재검수한다. r1을 수정하거나 PASS로
합성하지 않는다.

