# AI 기획 선작업 1~11 Claude Opus 검수 r2

> 상태: `OPUS_DIRECT_ADVISORY`
> 판정: `CHANGES_REQUIRED`
> 실행일: 2026-09-02 Asia/Seoul
> 대상 commit: `aa3c55441592552410ae41434a3f97cf871c9e26`
> 대상 tree: `6af1a22af626aa08ef71b7fbdaf7c41766674eae`
> 모델: `claude-opus-5`
> Claude Code CLI: `2.1.250`
> session: `a540216a-bd41-4cac-88a4-c8a56a578ac1`
> terminal reason: `completed`
> reported cost: `$2.537088`
> 권위 제한: 이 자문은 공식 Fable 완료 검수나 보호 원격 gate를 대체하지 않는다.

## 1. 전체 판정

Critical 0건, Major 1건이다. Opus r1의 F-01~04는 해소됐으나 rename/copy 상태 파싱에서 새 경로와
원래 경로를 뒤바꾸는 F-05가 발견돼 전체 판정은 `CHANGES_REQUIRED`다.

## 2. 항목별 판정

| # | 항목 | 판정 | 요약 |
|---|---|---|---|
| 1 | 변경 전 기준선 | `PASS` | Git blob 기준 해시와 AGENTS blob 재확인 |
| 2 | 경로 3분할 | `PASS` | 현재 모든 경로 단일 분류, 중복 규칙 없음 |
| 3 | 기존 브랜치 fast-forward | `PASS` | 신규 브랜치·사용자 경로 커밋 없음 |
| 4 | 사용자 fingerprint 동일성 | `PASS` | 57개 path·status·SHA와 완전 일치 판정 확인 |
| 5 | SIM-1 lease 경계 | `PASS` | 기존 SOLAR lease와 공식 기획안 무변경 |
| 6 | Fable Task 정합 | `PASS` | 실패 원본·구 AGENTS·successor 필요 판단 일치 |
| 7 | 롤오버 patch map | `PASS` | RC-01~08과 17개 요구의 단일 소유 후보 연결 |
| 8 | 사람 Decision 표 | `PASS` | 10개 Decision의 승인자·시점·상태 확인 |
| 9 | 기계식 완료 조건 | `CHANGES_REQUIRED` | staging rename의 새 경로 미분류를 우회할 수 있음 |
| 10 | 실행 검증 | `PASS` | 70/70·4/6·연결 preflight 범위를 과장하지 않음 |
| 11 | exact commit 재봉인 | `PASS` | execution·receipt seal·binding commit을 모순 없이 복원 |

## 3. Finding

### F-05 · Major · rename/copy 새 경로와 원래 경로 역전

- 근거: `git status --porcelain=v1 -z`의 rename/copy는 `XY <새경로>\0<원래경로>\0` 순서인데,
  `scripts/ai-plan-prework-status-check.mjs`가 두 번째 값을 destination으로 취급했다.
- 영향: in-scope 또는 user-owned 파일을 분류 규칙 밖 새 경로로 staged rename하면 검사기가 옛 경로를
  분류해 `unclassified=0`으로 잘못 통과할 수 있다. 현재 worktree에는 rename이 없어 기존 57개 판정은
  오염되지 않았다.
- 수용 조건: 첫 레코드의 새 경로를 분류·해시하고 두 번째 경로는 source로만 보존한다. in-scope와
  user-owned에서 미분류 경로로 이동하는 fixture 두 개가 새 경로를 기준으로 실패함을 시험한다.

## 4. 비차단 관찰

- 최종 봉인본에는 실행한 status 검사기 blob OID를 명시하면 재현성이 더 선명하다.
- 중첩 Git 디렉터리 `.codex-share/ingredient-prototype/` 내부 변화는 현재 null SHA라 탐지하지 못한다.
- 기준선의 설명용 in-scope 목록과 검사기의 최신 exact 목록을 동기화하면 이해가 쉽다.

## 5. 경계 판정

- 사용자 변경 침범: `없음`
- SIM-1 lease 충돌: `없음`
- Fable: 최신 예산 실패와 기존 `ONTOLOGY-005` 실패는 모두 공식 PASS가 아니다.
- 다음 요청: F-05 수정과 두 rename fixture 통과 후 새 exact commit에서 9번을 재검수한다.
