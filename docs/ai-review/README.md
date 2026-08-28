# 솔라·페이블 단일 산출물 공동 작성 및 독립 검수 규격

이 규격의 목적은 솔라와 페이블이 역할별 문서 사본을 따로 만드는 것이 아니라, **주제별 공식
산출물 하나**를 반복해서 개선하게 하는 것이다. 역할 컨텍스트는 독립성을 위해 분리하지만 공식
요구사항서·설계서·UX 문서·소스·테스트는 역할별로 분리하지 않는다.

권위 작업 루트는 `C:\Users\jacop\프로젝트\식자재관리앱` 하나다. 이 저장소를 OneDrive에 복사·
동기화·미러링하거나 OneDrive 쪽 파일·링크·작업공간을 공동 작성·검수·판정·복구 입력으로 사용하지
않는다. 다른 checkout도 동일하게 비권위다. 단, 보호 원격 CI가 origin의 정확한 decision commit
SHA를 임시 읽기 전용 checkout해 hash-chain만 검증하고 폐기하는 환경은 외부 게이트 전용 예외이며,
공동 작성·Fable 검수 입력·공식 작업본으로 사용하지 않는다. 로컬 실행기는 Windows에서 권위 경로가
아니거나 호출 CWD·실행기·Git 루트·실제 경로 구성요소에 `OneDrive` 또는 symlink/junction이 있으면 중단한다.

## 1. 단일 공식본과 감사 기록의 구분

작업 패킷은 입력을 세 역할로 분리한다.

| 구분 | 의미 | 페이블 수정 제안 |
|---|---|---|
| `artifact_paths` | 이번 작업에서 함께 개선할 유일한 공식 공동 산출물 | 허용 |
| `reference_paths` | `AGENTS.md`, 아키텍처, 결정 기록 등 읽기 전용 기준 | 금지 |
| `evidence_paths` | 테스트·fixture·로그 등 읽기 전용 증거 | 금지 |

`AGENTS.md`는 protocol 1.1의 모든 작업에서 `reference_paths`에만 둔다. 정책 문서 자체를 바꾸려면
그 변경만을 위한 별도 Task와 사람 승인 경로를 연다.

`docs/ai-review/tasks/**`는 기본적으로 실행 상태를 담는 제어 경로라 스냅샷에서 제외한다. 다만
Task가 그 아래의 정확한 파일을 `evidence_paths`로 선언하면 그 파일만 `EVIDENCE` 역할의 읽기 전용
입력으로 물질화한다. 선언하지 않은 Task 제어 파일은 계속 제외하며, 선언한 증거의 bytes/hash는
`input_files_sha256`에 포함된다.

공동 작성은 다음 의미의 **매개형 공동 작성**이다.

1. 솔라는 `artifact_paths`의 같은 파일을 실제로 작성·수정한다.
2. 페이블은 격리된 읽기 전용 판본을 검토하고 `Finding`과 적용 가능한 `proposed_edits`를 낸다.
3. 솔라는 제안을 같은 파일에 반영하거나 Finding별 근거를 붙여 반박한다.
4. Codex는 코드·DB·동작 변경의 실행 증거를 남긴다.
5. 페이블은 기존 `finding_id`로 다시 확인하고 종결 또는 재개방한다.

페이블은 제품 파일을 직접 쓰지 않으며, `proposed_edits`가 기록된 것만으로 공식 변경이 되지
않는다. 솔라가 같은 공식본에 반영하고 새 판본 hash와 검증 증거가 남은 뒤 재검수돼야 한다.

다음 파일은 공식 제품 문서의 경쟁 사본이 아니라 상호작용·복구·감사를 위한 기록이다.

- `collaboration.md`: 역할 간 append-only 대화·결정 장부
- `review.json`, `review.md`: 페이블이 실제 반환한 회차별 불변 검수 원본
- `artifact-snapshot.json`: 미커밋 공동 산출물의 회차별 복구 판본
- `input-snapshot.json`: WORKING 검수에 실제 전송한 artifact/reference/evidence 원문 전체
- `collaboration-entry.md`: 장부 원자 합류 전에 보존한 prepared Fable 턴
- `manifest.json`, `run.json`: 입력·실행·hash-chain 증거
- `candidate-review.*`: 공식 합류 전 실패 후보 원본. `NOT_MERGED`는 의미 검증을 통과한 결과이고,
  `VALIDATION_REJECTED`는 JSON Schema 뒤 저장소 의미 계약에서 거부된 격리 진단값이다.

`solar-*`, `fable-*`, `revised-*`처럼 역할명이나 수정 단계를 붙인 경쟁 공식 문서를 만들지 않는다.
한 작업이 여러 연동 파일을 가질 수는 있지만 각 파일의 공식 경로는 하나다.

## 2. 저장 구조

```text
docs/ai-review/
├─ README.md
├─ fixtures/
│  └─ shared-coauthoring-smoke.md 공동 작성 왕복 smoke 검증용 고정 입력(역할별 사본 아님)
├─ templates/
│  ├─ task.example.json
│  └─ collaboration.md
└─ tasks/<TASK-ID>/
   ├─ task.json                   불변 역할·범위·판본 계약
   ├─ collaboration.md            솔라↔페이블↔Codex append-only 장부
   ├─ status.json                 최신 상태 요약(자동 갱신)
   ├─ rounds/rNNN/
   │  ├─ manifest.json            실제 입력 파일·역할·SHA-256 봉인
   │  ├─ runner-source.mjs        이 회차를 판정한 실행기 원본
   │  ├─ schema-source.json       이 회차가 사용한 결과 스키마 원본
   │  ├─ artifact-snapshot.json   WORKING 모드 공식본 복구 판본
   │  ├─ input-snapshot.json      WORKING 모드에서 전송한 artifact/reference/evidence 전체 원문
   │  ├─ review.json              합류된 페이블 구조화 원본
   │  ├─ review.md                사람이 읽는 합류 검수 원본
   │  ├─ collaboration-entry.md   장부 합류 전에 보존한 prepared Fable 턴
   │  ├─ candidate-review.*       합류 실패 유효 후보 또는 의미 검증 거부 진단 원본
   │  └─ run.json                 CLI·모델·종료·사용량·장부 hash-chain
   └─ turns/tNNNN/
      ├─ entry.md                 정규화해 장부에 합류한 비-Fable 턴 원문
      ├─ runner-source.mjs        해당 append를 수행한 실행기 원본
      └─ run.json                 전·후 장부 hash·bytes와 수동 턴 hash-chain
```

해당 회차에 필요 없는 파일은 생기지 않는다. 회차 기록은 덮어쓰지 않는다. 실행기는 먼저 숨김
staging 디렉터리에 runner/schema, snapshot, review, `collaboration-entry.md`, 완성된 `run.json`을
포함한 prepared transaction 전체를 기록하고 모든 hash와 정규 렌더링을 검증한다. 그 뒤 작업별 공통
lock 아래에서 기존 장부를 통째로 바꾸지 않는 단일 OS append로 prepared 턴만 추가하고, 회차 staging은
같은 파일시스템의 디렉터리 rename으로 한 번에 공개한다. 솔라·Codex·사람·AI 부 O의 턴도 반드시
`pnpm fable:append`를 사용해 같은 lock과 append 경로를 공유한다. 검수 실행 중 직접 편집은 금지한다.
장부 합류 뒤 프로세스가 중단되면 다음 동일 명령이 prepared entry의 before/partial/after hash를 판별해
누락된 suffix만 추가하고 회차 공개를 자동 완결한다. 검증되지 않은 entry는 장부 변경 전에 거부하며,
판별 불가능한 staging은 자동 수정하지 않고 복구 대상으로 남긴다.

비-Fable 턴도 먼저 `turns/.tNNNN.stage-*`에 `entry.md`·당시 `runner-source.mjs`·완성된 `run.json`을
기록하고 검증한 뒤 장부에 append하고 `turns/tNNNN`으로 공개한다. 각 수동 `run.json`은 직전 수동
run hash와 장부 전·후 hash·bytes를 보존하고, Fable 회차와 수동 턴을 장부 byte 위치 순서로 합쳐
하나의 연속 chain으로 다시 검증한다. append 뒤 중단되면 같은 명령이 부분 entry의 안전한 suffix만
이어 붙이고 prepared 디렉터리를 공개하며, 이미 살아 있거나 다른 tail과 섞인 경우는 자동 수정하지 않는다.

원시 CLI 로그·잠금·임시 snapshot은 저장소 밖 `%LOCALAPPDATA%\Sikjae\ClaudeReview\`에 둔다.
`LOCALAPPDATA`가 `%USERPROFILE%\AppData\Local`과 다르거나 실제 경로가 symlink/junction·OneDrive·
제품 저장소와 겹치면 실행하지 않는다.
task lock에는 로컬 host·PID·고유 token을 기록한다. 강제 종료 뒤 같은 host의 PID가 확실히 종료된
lock만 로컬 runtime의 `locks/stale/`에 원본 격리한 뒤 재획득하며, 살아 있거나 소유자를 판별할 수
없는 lock은 자동 해제하지 않는다. prepared transaction 복구는 새 Claude 호출이 아니므로 현재 CLI의
설치·버전·로그인 검사보다 먼저 수행한다. 새 검수를 시작할 때만 CLI 검사를 요구한다.

## 3. 파일별 책임

| 파일 | 갱신 주체 | 규칙 |
|---|---|---|
| 공식 공동 산출물 | 솔라가 실제 반영, 페이블이 문구·패치 제안, Codex가 검증 | 같은 경로를 다음 회차가 재검수 |
| `task.json` | AI 부 오케스트레이터 | r001 이후 byte 단위 불변. 범위 변경은 새 Task ID |
| `collaboration.md` | 모든 비-Fable 역할은 `fable:append`, 실행기는 페이블 턴 추가 | 공통 task lock 사용. 직접 편집·과거 prefix 수정·삭제 금지 |
| `manifest.json`, `runner-source.mjs`, `schema-source.json` | 실행기 | 회차 입력과 당시 실행기·스키마 원문을 봉인, 불변 |
| `artifact-snapshot.json`, `input-snapshot.json` | 실행기 | WORKING 공식본 복구판과 Claude에 전송한 모든 입력 원문을 hash로 봉인 |
| `collaboration-entry.md` | 실행기 | 장부 합류 전 prepared transaction에 넣고 run의 bytes/hash와 재검증 |
| `review.*`, `candidate-review.*` | 실행기 | 페이블 원본 보존, 직접 수정·삭제 금지 |
| `turns/tNNNN/{entry.md,runner-source.mjs,run.json}` | append 실행기 | 비-Fable 턴 원문·당시 실행기·장부 전후 hash를 봉인하고 순번·chain을 재검증 |
| `run.json`, `status.json` | 실행기 | 실행·검수·Finding 상태와 외부 게이트 대기 상태를 구분. 수동 편집 금지 |

페이블이 먼저 아이디어를 제안한 경우에도 솔라가 구현 가능성·도메인 정책·통합 영향을 역검수한 뒤
같은 공식 산출물에 반영한다. 페이블 제안을 별도 전략 문서로 확정하지 않는다.

비-Fable 턴은 PowerShell에서 UTF-8 본문을 표준입력으로 전달한다. PowerShell 7(`pwsh`)을
권장한다. Windows PowerShell 5.1을 사용한다면 네이티브 프로세스 파이프 인코딩도 UTF-8로
명시한 뒤 실행한다.

```powershell
$utf8 = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding = $utf8
Get-Content -Raw -Encoding utf8 .\turn.md | corepack pnpm fable:append -- --task TASK-ID
```

`turn.md`는 전송용 초안일 뿐 공식 기록이 아니며 권위 저장소 또는 고정 로컬 runtime에서만 만들고
처리 뒤 제거한다. OneDrive, symlink/junction/hardlink, 비밀정보가 포함된 입력은 허용하지 않는다.

## 4. 반복 상호작용

### 솔라 선행 작업

```text
SOLAR_REQUEST + 같은 공식본 수정
→ FABLE_REVIEW + Finding/수정 문구
→ SOLAR_RESPONSE + 같은 공식본 반영 또는 반론
→ CODEX_EVIDENCE + 실행·회귀 증거
→ FABLE_RECHECK(같은 finding_id)
↺ 필수 Finding이 모두 `VERIFIED`가 될 때까지 반복
→ AI 부 오케스트레이터 종결 결정(anchor·decision commit)
→ 보호 원격/외부 attestation 게이트 검증
→ P0-2 구축 뒤 최초 발견 역할의 closure successor 재검수에서만 `CLOSED`
```

### 페이블 선행 제안

```text
FABLE_REVIEW + Finding/수정 문구
→ SOLAR_RESPONSE(정책·구현 가능성·통합 영향 역검수)
→ 같은 공식본 반영 또는 근거 있는 반론
→ CODEX_EVIDENCE
→ FABLE_RECHECK(같은 finding_id)
↺ 필수 Finding이 모두 `VERIFIED`가 될 때까지 반복
→ AI 부 오케스트레이터 종결 결정(anchor·decision commit)
→ 보호 원격/외부 attestation 게이트 검증
→ P0-2 구축 뒤 최초 발견 역할의 closure successor 재검수에서만 `CLOSED`
```

사람을 거치는 업무도 상호검수 회전을 먼저 끝낸 뒤 결정 패킷을 올린다. 다만 사람의 정책 선택,
미해결 위험 수용, 운영 배포·복구 승인은 AI 상호검수로 대체하지 않는다.

`CHANGES_REQUIRED`의 프로세스 종료 코드 `20`은 연결 실패가 아니다. 솔라가 같은 공식본을 수정하고
장부에 응답한 뒤 `--round 2`, `--round 3`처럼 다음 회차를 실행한다. 실행 실패 회차가 사이에
있어도 실행기는 마지막 성공 검수의 미종결 Finding을 계속 계승한다.

## 5. 장부 턴과 hash 연결

`templates/collaboration.md`의 턴 유형을 사용한다.

- `SOLAR_REQUEST`
- `FABLE_REVIEW` — 실행기가 원본 링크·hash·Finding ID를 자동 추가
- `SOLAR_RESPONSE`
- `CODEX_EVIDENCE`
- `HUMAN_DECISION`
- `FABLE_RECHECK`
- `BACKLOG_DISPOSITION`
- `AI_DEPUTY_GATE_DECISION`
- `AI_DEPUTY_SUCCESSOR_HANDOFF` — 새 COMMIT Task가 이전 Finding을 재검수하도록 승인하는 기계 판독 턴
- `AI_DEPUTY_FALLBACK_HANDOFF` — protocol 1.2 예약. 페이블 소진 successor에 predecessor
  run·사유·registry·장부 판본을 잇는 기계 판독 턴이며 `AI-REVIEW-2` 완료 전 protocol 1.1 append는
  거부된다

솔라 응답은 각 Finding마다 `APPLIED | PARTIAL | REJECTED | NEEDS_HUMAN_DECISION`을 표시한다.
Codex 증거는 명령, 종료 결과, 검증한 SHA, 증거 경로를 기록한다. Improvement를 즉시 반영하지
않으면 단일 작업 큐 ID·담당·재검토 조건을 남긴다.

각 `run.json`은 task·schema·runner·manifest·review·입력 파일 hash와 장부 append 전·추가 턴·
append 후의 bytes/hash를 봉인한다. 다음 회차의 `manifest.json`은 `previous_run_sha256`으로 직전
`run.json`까지 연결한다. 실행기는 모든 과거 회차를 시간순으로 다시 읽어 run hash 연속성, 장부
bytes 단조 증가, 저장된 입력 metadata 구조·hash, 당시 보존된 실행기·스키마 원문과 Finding 상태
전이를 재검증한다. 과거 턴이 한
글자라도 바뀌거나, 과거 필수 Finding이 결과에서 사라지거나, 실패 회차가 마지막 성공 검수를
잃으면 `STALE`로 중단한다.

가장 마지막 `run.json`의 hash는 `status.json`에도 요약하지만, 다음 회차 또는 Git anchor가 생기기
전의 tail은 외부 봉인이 아니다. 당시 runner/schema 원본과 회차 전체를 보존해 재현 가능하게 하고,
공식 진위는 아래의 anchor·decision commit과 저장소 밖 보호 게이트가 확정한다. protocol 1.1 도입
초기의 보존 회차 중 `source_archive_version`이 없는 기록은 task/round별 기존 manifest·run hash가
정확히 allowlist와 일치할 때만 역사 자료로 읽는다. 해당 Task는 종결 상태로 고정해 새 회차를 금지한다.
그 밖의 새 회차에는 runner/schema와 WORKING 전체 입력 원문 archive가 필수다.

이 로컬 hash-chain은 실수나 일부 파일 변조를 탐지하는 **일관성 증거**이지, 저장소를 쓸 수 있는
주체가 모든 연결 파일을 한꺼번에 다시 만든 경우까지 막는 외부 진위 증명은 아니다. 공식 게이트는
다음 2단계 Git 봉인과 저장소 밖 검증을 사용한다.

1. **Anchor commit**: 마지막 `review.json`·`run.json`·장부와 검수된 공식 산출물을 한 commit에 고정한다.
2. **Decision commit**: `AI_DEPUTY_GATE_DECISION` 턴이 anchor commit과 review/run/input/artifact hash를
   참조하도록 추가하고 별도 commit으로 고정한다.

보호 원격의 필수 체크는 decision commit의 실행 환경이 제공하는 정확한 SHA를 대상으로 anchor 포함
여부와 hash-chain을 다시 검증하고, 동일 SHA의 성공 결과와 보호 ref 반영을 외부 종결 증거로 남긴다.
decision commit은 자신의 SHA를 본문에 쓰지 않는다. 사람에게 승인된 별도
서명/attestation 시스템이 decision commit SHA 전체에 서명하는 경우에만 이를 대체할 수 있다. 기능
CI 하나나 로컬 Git ref만으로는 외부 봉인이 아니다.

## 6. 작업 패킷 protocol 1.1

`task.json`은 역할, 세 종류의 경로, baseline/target commit과 tree, 기준 `AGENTS.md` blob/hash,
요구사항·불변식·필수 증거·사람 결정, route·risk·mode·snapshot mode를 고정한다. 승인 범위는
`REPOSITORY_READ_ONLY_REVIEW`다.

알 수 없는 필드, 비밀정보 가능 경로, 중복 역할 경로, 권위 저장소 밖 경로는 거부한다. r001 뒤
`task.json`, schema 또는 runner가 달라지면 같은 Task ID로 이어가지 않는다.

`FINAL_INDEPENDENT`는 `AI-DEPUTY-ORCHESTRATOR / FABLE-FINAL / FINAL / COMMIT` 조합과 별도
`independent_request`를 강제한다. 다른 route의 `independent_request`는 반드시 `null`이다.

확정 commit을 바꿔 같은 Finding을 재검수해야 하면 기존 `task.json`을 고치지 않고 successor Task를
만든다. 먼저 successor가 검수할 target commit을 고정한 뒤 predecessor 장부 끝에
`AI_DEPUTY_SUCCESSOR_HANDOFF`를 `fable:append`로 추가한다. successor의 `predecessor_review`는 그
handoff만 추가한 별도 source commit, predecessor 최신 성공 회차의 task/manifest/run/review/전체
Finding registry hash, handoff turn/entry/run hash를 모두 고정한다. source commit은 successor target
이후 기존 턴을 수정·삭제하지 않고 predecessor의 `collaboration.md`와 지정 handoff 턴 파일 3개만 추가한
commit이어야 한다. 두 Task는 같은 route·`review_mode`·`reviewer_role`의 `COMMIT` 검수 경로여야
하고 successor baseline은 predecessor target이어야 한다. 이 승계는 `FINAL_INDEPENDENT`뿐 아니라
`SECURITY`처럼 같은 검수 lane에서 확정 commit을 바꿔 기존 Finding을 재검수할 때도 사용한다.
successor가 `predecessor_review`를 선언했는데
이 상호 handoff가 없거나 hash·범위·회차가 다르면 실행기는 실패 폐쇄한다. `status.json`은 권위 입력이
아니라 봉인된 회차에서 재생해 대조하는
요약일 뿐이다.

보호 체크 성공 뒤 `CLOSED` 재검수는 위 `FABLE-FINAL` 전용 commit 변경 successor나 §8 소진
successor와 별도인 closure successor 계약을 사용한다. 모든 `reviewer_role`에서 원 route·역할·검수
범위를 유지하고, predecessor 최신 성공 회차의 전체 Finding registry hash를 승계하며, target은
보호 체크가 성공한 정확한 decision commit 또는 그 commit을 포함하는 승인된 후속 commit인 `COMMIT`
snapshot이어야 한다. 보호 체크의 정확한 SHA·check context·성공 결과와 보호 ref 포함 증거를
입력으로 봉인하지 않으면 `CLOSED` 반환을 거부한다. 이 계약의 protocol 1.2 schema·runner 구현은
`AI-REVIEW-2`, 보호 원격 validator·ruleset 결합과 부정 시험은 `P0-2`가 소유한다. 두 작업 완료
전에는 FINAL 외 route를 포함한 어떤 Finding도 `CLOSED`로 전환하지 않는다.

신규 Task는 protocol `1.1` 또는 `1.2`를 허용한다. `1.2`는 reviewer engine·model·작업 전체 상한과
fallback/closure 계약을 추가하고 구조화 결과 schema `2.0`을 사용한다. 기존 protocol `1.1` Task와
결과 schema `1.0`은 당시 감사 원본으로 byte 단위 보존하며 필드를 덧붙여 재사용하지 않는다. 과거
protocol `1.0` 디렉터리도 원본으로만 보존하고 새 회차를 실행하지 않는다.

`AI-REVIEW-2`가 protocol `1.2`의 reviewer engine·fallback·closure 기반 계약을 구현했고,
`TEAM-LEARNING-1`은 같은 버전에 `applied_learning_ids`와 `{ learning_id, reason }` 배열인
`excluded_learning_ids`를 추가했다. 대상 commit에 `docs/team/TEAM_LEARNING.md`가 존재하는 신규
protocol 1.2 Task는 두 필드를 모두 선언하고, 결과 schema 2.0·manifest·task hash가 같은 값을
봉인한다. 기존 protocol 1.1과 활성화 전 protocol 1.2 Task는 당시 감사 원본으로만 보존하며 필드를
덧붙여 재사용하지 않는다.

실행기는 대상 commit의 장부를 읽어 등록 여부·`VERIFIED` 상태·`review_by`·상호 충돌과 제외 사유를
검증한다. 만료는 target commit 날짜와 실행 UTC 날짜 중 늦은 날짜로 판정한다. baseline과 target에서
장부가 달라지면 검수 경로에 장부를 선언하고, 같은 commit에서 바뀐 항목은 즉시 적용하지 못한다.
manifest는 target 장부 blob·내용 hash와 적용 집합 hash를 봉인한다. `CANDIDATE`·`RETIRED`·기한
초과·충돌 ID는 실패 폐쇄한다. 일반 검수에는 검증된 ID의
범위·금지 재사용·체크리스트만 주입한다. predecessor가 있는 보안 후속 Task에는 ID 목록만 전달하고
제외 사유를 포함한 학습 요약은 전달하지 않는다. fallback successor는 predecessor와 같은 적용·제외
집합 및 그 hash를 가져야 한다. `FINAL_INDEPENDENT` 모든 Task와 predecessor가 없는 최초 `SECURITY`
Task는 적용·제외 배열이 모두 비어 있어야 한다. 두 경로의 Task 요청·요구·사람 결정·필수 증거와
공동 장부 전체에 Learning ID·학습 요약 표식이 있어도 실행기와 append 경로가 거부한다.
상세 역할 규칙은 [`docs/team/ROLE_CONTEXTS.md`](../team/ROLE_CONTEXTS.md),
학습 원장은 [`docs/team/TEAM_LEARNING.md`](../team/TEAM_LEARNING.md)가 소유한다.

## 7. 격리 스냅샷

### `WORKING_TREE_HASHED` — 공동 초안

문서와 빠른 왕복에 사용한다. 명시된 artifact/reference/evidence 파일만 별도 snapshot으로
물질화한다. untracked 파일도 명시적 artifact라면 포함할 수 있지만 ignored 파일, 비밀정보, 다른
저장소, 고객·운영 데이터는 포함하지 않는다. 삭제된 산출물은 `DELETED` tombstone으로 기록한다.

미커밋 artifact 내용은 `artifact-snapshot.json`에, Claude에 전송한 reference/evidence를 포함한
전체 원문은 `input-snapshot.json`에 회차별로 보존해 검수 당시 판본과 인용을 재현할 수 있게 한다.
이는 새로운 공식 문서가 아니라 같은 입력의 content-addressed 감사 판본이다.

### `COMMIT` — 확정 게이트

코드·DB·RLS·보안·릴리스 후보와 최종 감사에 사용한다. 전체 repository worktree를 넘기지 않는다.
정확한 target commit의 Git blob 중 명시된 artifact/reference/evidence만 로컬 격리 snapshot에
물질화한다. 따라서 prompt 지시뿐 아니라 실제 Claude 작업 폴더에도 허용 파일만 존재한다.

두 모드 모두 symlink·junction·hardlink, OneDrive와 `OneDrive - 조직명` 경로, `.env`, 키·자격증명·
DB dump, 바이너리, 민감정보 패턴을 거부한다. Task에 넓은 glob이 있어도 실제 매칭된 각 경로를 다시
금지 규칙으로 검사한다. 현재 Task의 `docs/ai-review/tasks/**` 감사 파일은 넓은 glob에도 입력으로
재포함하지 않는다.

## 8. 실행과 자체 검증

```powershell
# 연결·인증
corepack pnpm fable:check

# 외부 모델 호출 없는 안전장치 사보타주 테스트
corepack pnpm fable:self-test

# 첫 검수와 재검수
corepack pnpm fable:review -- --task TASK-ARCH-001 --round 1
corepack pnpm fable:review -- --task TASK-ARCH-001 --round 2
```

PowerShell 진입점도 같은 실행기를 호출한다.

```powershell
.\scripts\fable-review.ps1 --task TASK-ARCH-001 --round 1
```

| 종료 코드 | 의미 |
|---:|---|
| `0` | PASS — 필수 Finding 없음, 게이트 종결 검토 가능 |
| `20` | CHANGES_REQUIRED — 같은 공식본 수정 후 재검수 |
| `21` | DISPUTED — 사람 결정 패킷 필요 |
| `22` | BLOCKED — 필요한 입력·증거 없음 |
| `64` 이상 | 입력·인증·판본·보안·실행 오류 |
| `124` | 시간 제한 초과 |

현재 자동 경로는 로컬에서 격리 옵션을 확인한 공식 Claude Code `2.1.248` 또는 `2.1.250` allowlist,
기본 `claude-fable-5`와 소진 시 `claude-opus-5`, high effort, 기본 회차 상한 `$2.00`, 작업 전체
기본 상한 `$4.00`, 새 세션, 빈 MCP, `Read/Glob/Grep`만 사용한다.
실제 실행 버전과 실행 파일 hash는 매 run에 기록한다. `--restricted`, `--safe-mode`를 해제하지 않는다.

### 페이블 소진과 Opus 연속성 경로

팀 운영 목표는 페이블 모델의 예산·사용량·속도·용량이 소진됐을 때 Opus 신규 클린 컨텍스트가
같은 독립 감사 역할을 이어받는 것이다. 감사 역할과 실행 모델을 분리하며, 실제 결과에는
`primary_reviewer_engine`, `reviewer_engine`, 정확한 model ID와 CLI·runner hash를 기록한다.

허용되는 승계 사유는 `MODEL_BUDGET_EXHAUSTED`, `MODEL_RATE_LIMITED`,
`MODEL_CAPACITY_UNAVAILABLE`뿐이다. `MODEL_BUDGET_EXHAUSTED`는 모델 제공자·구독 한도가 구조화된
terminal reason 또는 오류 코드로 소진됐다는 뜻이다. runner가 정한 회차 `--max-budget-usd` 상한의
`budget_exhausted`는 승계 사유가 아니며 재실행 또는 사람 승인에 따른 상한 조정 대상이다. 공식 CLI의
일시적 모델 미제공도 구조화된 `MODEL_CAPACITY_UNAVAILABLE`로 보고된 경우에만 포함한다. 자유 텍스트
매칭은 금지한다. 인증 실패, CLI 버전 allowlist·모델 ID 설정 오류, 권위 경로·target commit·hash-chain
불일치, 허용 경로 위반, schema·저장소 의미 계약 위반은 승계 사유가 아니며 Opus로 우회하지 않는다.

승계는 실패한 회차를 덮어쓰거나 같은 Task의 모델만 바꾸는 방식이 아니다. 불변 실패 run을 남기고
새 successor Task에 다음을 봉인한다.

- predecessor task·round·run SHA-256과 승계 사유
- 동일 target commit, artifact/input hash와 Finding registry hash
- inherited finding ID, 허용·제외 경로와 읽기 전용 권한
- Opus의 정확한 model ID와 작업 전체 사용 상한의 남은 범위
- 고위험 `FABLE-SEC`·`FABLE-FINAL` 결과의 페이블 복구 후 표본 재감사 조건
- predecessor `collaboration.md`의 append 후 bytes/hash, `AI_DEPUTY_FALLBACK_HANDOFF`
  turn/entry/run hash, handoff 직전 base commit과 handoff만 추가한 source commit SHA

이 소진 승계는 §6의 `predecessor_review`와 다른 별도 handoff 계약이다. §6은 확정 commit을 바꿔
`FABLE-FINAL` Finding을 재검수하는 경로이고, 소진 승계는 모든 `reviewer_role`에서 predecessor와
같은 baseline·target commit을 유지한 채 allowlist 사유의 `RUN_FAILED` run을 기점으로 이어진다.
predecessor 장부 끝에 `AI_DEPUTY_FALLBACK_HANDOFF` 턴을 `fable:append`로 추가하고 successor
protocol 1.2 Task에 predecessor task·round·run hash와 실패 사유를 봉인한다. predecessor에 성공
회차가 있으면 최신 성공 회차의 전체 Finding registry hash를 승계해 `RECHECK`로 실행하고, 첫 회차가
소진되어 성공 회차가 없으면 inherited Finding 0건인 `INITIAL`로 실행한다. 실패 run의 실제 사용액은
작업 전체 상한에서 먼저 차감한다. 예시는 `templates/task-v12-primary.example.json`과
`templates/task-v12-fallback.example.json`에 있으며 protocol 1.1 장부는 fallback handoff를 거부한다.

successor의 `task_budget_usd`는 predecessor와 같아야 한다. 기본 상한 `4.00`을 넘는 Task는 실행 전에
같은 Task 장부의 `HUMAN_DECISION` 턴에 `task_budget_usd_approved` 금액 pin이 정확히 하나 있어야 하며,
fallback은 predecessor의 그 승인까지 검증한다. pin이 없거나 금액이 다르면
`TASK_CAP_APPROVAL_REQUIRED`로 중단한다. 회차 비용은 각 값을 센트로 반올림해 정수로 합산하고,
CLI envelope가 없어 `total_cost_usd=null`이면 그 회차의 `max_budget_usd` 전액을 사용한 것으로
보수적으로 차감한다.

승인 턴에는 다음 줄을 정확히 한 번 기록한다. `<승인금액>`은 `task.json`의
`task_budget_usd`와 센트 단위로 같아야 한다.

```md
- task_budget_usd_approved: `<승인금액>`
```

`artifact_set_sha256`은 실패 회차 `manifest.json`의 `input_files` 중 `path_role=ARTIFACT`인 항목만
`path` 오름차순으로 정렬하고, 각 항목을 `path`, `change_type`, `size`, `git_blob_oid`, `sha256`
순서의 객체로 만든 배열을 JSON 직렬화한 뒤 끝에 LF 한 바이트를 붙인 UTF-8 bytes의 SHA-256이다.
사람이 파일 목록을 다시 해석해 만든 값이나 다른 JSON 정렬 규칙은 받지 않는다.

여기서 `INITIAL`·`RECHECK`는 inherited registry 유무에 따른 승계 의미다. `FABLE-SEC`·
`FABLE-FINAL` successor의 실제 `task.review_mode`는 route가 정한 `SECURITY`·`FINAL`을 유지한다.
`MANDATORY_MUTUAL`·`CONDITIONAL` successor의 `task.review_mode`는 route 기본값 `INITIAL`을 유지하고,
결과·manifest의 `RECHECK`는 inherited registry에서 실행기가 파생한다. successor가
`task.review_mode=RECHECK`를 직접 선언하면 거부한다.
`FINAL_INDEPENDENT` route successor는 registry 승계 여부와 무관하게 predecessor 장부를 받지 않고
`independent_request`와 predecessor registry hash 블록만 받는다. 그 밖의 `MANDATORY_MUTUAL`·
`CONDITIONAL`·`SECURITY` route에서는 registry를 승계한 successor가 봉인된 predecessor 장부 전체를
읽기 전용 입력으로 받고, 성공 회차가 없는 successor는 predecessor `SOLAR_REQUEST`까지만 받는다.

Opus도 기존과 같은 새 세션, 빈 MCP, `Read/Glob/Grep`, `--restricted`, `--safe-mode`, 제품 파일 쓰기
금지 규칙을 사용한다. 결과가 같은 구조·의미 계약을 통과하면 실제 엔진 출처를 표시한 채 로컬
`VERIFIED`까지 진행할 수 있지만 보호 원격·사람 승인·`CLOSED` 규칙을 바꾸지 않는다. Opus도 사용할
수 없으면 더 약한 모델로 연쇄 하향하지 않는다. 모델 결과 없는 실행은 `review.json`이나 verdict를
합성하지 않고 `run_state=RUN_FAILED`, 사유 `FALLBACK_UNAVAILABLE`로 남겨 `status.json` 요약을 통해
사람에게 보고한다. 비승계 오류도 `NOT_FALLBACK_ELIGIBLE` 사유의 `RUN_FAILED`로 남긴다.

엔진 출처는 결과 schema 승격 뒤 `review.json`, `run.json`, `status.json`의 회차 요약과 장부
`FABLE_REVIEW`·`FABLE_RECHECK` 턴 헤더에 모두 필수로 기록한다. `reviewer_role`은 승계한 원 역할
ID(`FABLE-ARCH` 등)를 유지하고 `OPUS-FALLBACK`은 컨텍스트 ID일 뿐 역할 값이 아니다. Finding의
`VERIFIED` 권한은 엔진이 아니라 원 `reviewer_role`을 따른다. Opus가 검증한 Finding에는
`verified_by_engine`을 남기며, `FABLE-SEC`·`FABLE-FINAL` 결과는 페이블 복구 후 표본 재감사 전까지
게이트 종결 요청의 근거로 쓰지 않는다. 엔진 필드 누락이나 primary 엔진 위장은 검증 거부 대상이다.

수동으로 model만 바꾼 결과는 공식 검수로 합류할 수 없다. 실행기는 실패 run·handoff-only source
commit·장부 bytes/hash·입력/산출물/registry hash·실사용액을 검증한 새 protocol 1.2 successor만 받는다.
fallback handoff는 실제 최신 `RUN_FAILED` 소진 회차와 모든 pin·비용이 일치할 때 한 번만 append할 수
있다. 그 뒤 원 Task의 Fable 회차는 재개하지 않고 봉인된 successor Task만 실행한다. 잘못된 handoff는
append 전에 거부하므로 append-only 장부를 오염시킨 뒤 다시 시도하는 경로를 만들지 않는다.
closure 구조 계약도 protocol 1.2가 소유하지만 실제 실행은 P0-2 보호 원격 validator가 결합될 때까지
명시적으로 중단한다.

`fable:review`는 네트워크·모델 판단이 포함된 상호검수다. 재현 가능한 기계 게이트
`corepack pnpm verify`에 합치지 않으며, 둘 다 필요한 작업은 각각의 증거를 남긴다.

## 9. 상태와 종결 권한

- `finding.review_state`: `OPEN | VERIFIED | CLOSED | DISPUTED`; 최초 발견 역할만 Finding을
  `VERIFIED`로 전환하며, P0-2 구축 뒤에만 `CLOSED` 전환을 요청함
- `run_state`: `RESULT_RECEIVED | RUN_FAILED | STALE`; CLI·판본 실행 상태
- `defect_state`: 기능 QA 결함 상태; Fable 검수 상태와 별도
- `gate_state`: 로컬 실행기는 `OPEN`을 유지하며 외부 게이트 종결과 혼동하지 않음

verdict `BLOCKED`는 모델이 유효한 구조화 결과로 반환했을 때만 사용한다. 인증 실패, 비승계 오류,
대체 엔진 부재처럼 모델 결과가 없는 실행 상태를 표현하기 위해 합성하지 않는다.

`status.json`은 실행기만 갱신하며 필수 미해결, 선택 미해결, 누적 종결 Finding을 분리한다.
`OPEN`·`DISPUTED`는 미해결이고, 완료 조건과 Codex 증거를 최초 발견 역할이 확인한 `VERIFIED`는
로컬 해결 상태라 `remaining_required_finding_ids`와 `PASS` 차단 집계에서 제외한다. `PASS`는
필수 미해결 Finding이 없다는 페이블 판정이며 task/gate의 자동 `CLOSED`가 아니다. AI 부
오케스트레이터가 증거를 확인해 외부 게이트에 종결 결정을 요청한다.
정책·위험·운영 승인은 필요한 사람이 별도로 결정한다.

새 회차의 `manifest.json`은 Finding 해결 의미 버전을 함께 봉인한다. 이 표식이 없는 과거 회차와
그때 생성된 `status.json`은 당시 계약(`VERIFIED`도 미종결 집계)에 따라 재생하며 소급해 다시 쓰지
않는다. 표식이 있는 새 회차부터 위의 현재 계약을 적용한다.

PASS 뒤 AI 부 오케스트레이터는 같은 판본을 `COMMIT` 모드로 최종 확인하고 anchor commit을 만든
다음, `AI_DEPUTY_GATE_DECISION` 턴에 검증한 review/run/artifact/input hash, anchor commit SHA,
필수 Finding 0건, 선택 Finding의 백로그 ID, Codex 실행 증거와 요청 근거를 기록해 decision commit을
만든다. 로컬 실행기의 `status.json`은 이 과정에서도 `gate_state=OPEN`을 유지하며 수동으로 닫지 않는다.

공식 `CLOSED`의 권위는 decision commit SHA에 대해 성공한 보호 원격 필수 체크와 해당 보호 ref 반영
기록의 조합이다. 대체 수단은 사람이 사전 승인한 외부 서명/attestation뿐이다. 위험 등급상 사람
승인이 필요하면 먼저 `HUMAN_DECISION`을 decision commit에 포함한다. 현재 `P0-2`의 GitHub ruleset과
필수 체크가 구축되기 전에는 Finding `review_state`를 `VERIFIED`까지만 올리고 `CLOSED`로 전환하지
않으며 공식 gate `CLOSED`도 선언하지 않는다. `CLOSED` 전환은 decision commit의 보호 원격 필수
체크 성공 기록이 있는 뒤 최초 발견 역할이 §6의 closure successor(`COMMIT`, registry hash 승계)로
재검수할 때만 허용한다.

## 10. 보존과 정정

- `rounds/rNNN`과 원본 검수는 append-only다. 같은 회차를 재실행하거나 덮어쓰지 않는다.
- 틀린 검수도 삭제하지 않는다. 다음 회차에서 같은 ID를 `VERIFIED`로 확인하고, P0-2 구축 뒤에는
  `CLOSED`로 전환하거나 재개방·분쟁 처리한다.
- 유효한 Claude 결과 뒤 입력 STALE 또는 snapshot 정리 실패가 나면 `candidate-review.*`로 보존하고
  공식 장부에는 합류하지 않는다.
- JSON Schema는 통과했지만 저장소 의미 계약에서 거부된 결과는 `VALIDATION_REJECTED`로 별도 보존한다.
  이 값은 정규 JSON과 안전 코드만 진단에 쓰며 `review.json`·Finding registry·공동 장부·후속 입력으로
  승격하지 않는다. 민감정보 또는 파일 크기 검사를 통과하지 못하면 원문은 보존하지 않는다.
- 후보·읽기용 review·prepared entry·WORKING snapshot도 run/manifest hash에 연결하며 다음 회차가
  존재·내용을 다시 확인한다.
- `review.json`이 자동 처리 권위 원본이고 `review.md`는 같은 결과의 읽기용 렌더링이다.
- 공식 정책은 `AGENTS.md`와 사람 결정 기록이 우선한다. 감사 제안은 공식본에 반영되기 전까지
  정책 출처가 아니다.

## 11. 독립 종합 감사 예외

`FABLE-FINAL`은 새 세션과 `COMMIT` snapshot으로 실행한다. 최초 회차에는 솔라의 자기변호가 담긴
공동 장부를 보내지 않고, 별도 `independent_request`, 승인 명세, 권위 문서, 소스와 원시 테스트
증거만 제공한다. 최초 보고서를 불변 원본으로 봉인한 뒤 솔라가 같은 공식 산출물을 수정하고 장부에
답변한다. 다음 회차부터 페이블이 기존 Finding ID로 재감사한다.

수정 commit이 기존 Task의 불변 target과 달라 새 successor Task를 쓰는 경우에도 첫 successor 회차는
`RECHECK`다. 독립 감사 요청은 계속 사용하되 predecessor 원본 review hash와 전체 Finding registry
hash를 서로 다른 블록으로 제공한다. 원본 review를 변형한 뒤 옛 hash를 붙이지 않으며, predecessor의
모든 non-CLOSED Finding을 같은 ID·심각도·범주로 다시 반환해야 한다. P0-2 전에는 CLOSED Finding을
successor로 승계하지 않는다. 기존 Finding의 `previous_finding_id`는 같은 `finding_id`여야 하며,
재검수에서 새로 발견한 Finding만 `previous_finding_id=null`과 `review_state=OPEN`을 사용한다.

독립 감사 보고서는 경쟁 제품 문서가 아니라 공동 편집 전의 독립 증거다. 출시 Go/No-Go와 잔여
위험 수용은 사람이 결정한다.

## 12. 사용자 승인 범위 — 2026-08-28

사용자는 이 권위 저장소의 필수·조건부 검수 route가 발동할 때 Codex가 호출마다 다시 묻지 않고
공식 Claude Code CLI를 실행하는 것을 승인했다.

승인 범위:

- 명시된 공식 산출물·참고 문서·테스트 증거의 읽기 전용 snapshot 전달
- 설치된 공식 Claude Code와 현재 사용자의 Claude 인증 사용
- 회차별 검수 원본·판본·실행 증거·공동 장부 저장
- 페이블 제안을 솔라가 같은 공식본에 반영하기 위한 입력으로 사용

승인하지 않은 범위:

- 비밀정보, 고객·개인정보, 운영 DB dump, 동기화 사본, 다른 저장소 전송
- Claude의 제품 파일 직접 수정, shell, commit, push, 배포, 운영 데이터 접근
- 권한 우회, IDE·브라우저·원격 제어
- 정책 선택, 미해결 위험 수용, 프로덕션 배포·복구의 사람 책임 대체
