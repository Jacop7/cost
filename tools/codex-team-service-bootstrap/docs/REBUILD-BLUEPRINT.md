# AI 팀 서비스 유실 재제작 설계서 v0.2.0

상태: `IMPLEMENTATION_CANDIDATE_OPUS_RECHECK_PENDING`

목표는 플러그인, adapter, 템플릿, 검사기, 문서 8개 영역이 모두 유실돼도 원시 채팅에 의존하지 않고
동일 의미의 패키지를 다시 만드는 것이다. runtime 비밀과 실제 endpoint는 재제작 대상이 아니라
재결속 대상이다.

## 1. 재제작 정본과 우선순위

1. 이 문서와 `PORTABLE-TEAM-SERVICE-ARCHITECTURE.md`
2. machine-readable package contract와 schema
3. release manifest·dependency lock·파일 SHA inventory
4. acceptance test의 입력·기대 결과
5. 샘플 프로젝트의 golden output

구체적인 재제작 입력은 다음 파일 자체이며 이름만 존재하는 산출물이 아니다.

- `schemas/project-profile.schema.json`
- `schemas/capability-policy.schema.json`
- `schemas/install-receipt.schema.json`
- `schemas/generated-files.schema.json`
- `schemas/host-evidence-admission.schema.json`
- `profiles/default-11-role-profile.json`
- `golden/portable-v1-vectors.json`
- `scripts/portable-team-service-design.test.mjs` (저장소 루트 기준)

원시 대화, UI 스크린샷, 기억, 특정 PC의 절대경로는 재제작 입력이 아니다.

## 2. 복구 가능한 소스 트리

```text
codex-team-service-bootstrap/
├─ .codex-plugin/plugin.json
├─ README.md
├─ LICENSE
├─ RELEASE-MANIFEST.json
├─ COMPATIBILITY.json
├─ skills/team-service-bootstrap/SKILL.md
├─ schemas/
│  ├─ project-profile.schema.json
│  ├─ capability-policy.schema.json
│  ├─ install-receipt.schema.json
│  ├─ generated-files.schema.json
│  └─ host-evidence-admission.schema.json
├─ templates/
│  ├─ default-11-role-profile.json
│  └─ project/
├─ scripts/
│  ├─ doctor.mjs
│  ├─ init.mjs
│  ├─ verify-install.mjs
│  ├─ no-send-harness.mjs
│  ├─ coverage-audit.mjs
│  ├─ migrate.mjs
│  └─ recover.mjs
├─ migrations/<from>-to-<to>.mjs
├─ harness/no-send-{normal,forbidden,dynamic-import}.mjs
├─ fixtures/minimal-project/
└─ tests/
```

플러그인 manifest는 `.codex-plugin/plugin.json`에 두며, 본체는 최소 하나의 skill을 포함한다. 로컬
개발 배포는 personal marketplace를 기본으로 하고 팀 배포는 별도 GitHub marketplace 경로로 검증한다.

## 3. 구성요소별 재제작 계약

| 구성요소 | 필수 입력 | 결정적 출력 | 실패 폐쇄 조건 |
| --- | --- | --- | --- |
| manifest | 이름·semver·설명·skill 경로 | 유효 `plugin.json` | schema/asset/path 불일치 |
| bootstrap skill | 책임 경계·순서·금지 행동 | `SKILL.md` | 기존 4개 정책 복제·수정 지시 |
| schemas | 필드·enum·추가필드 정책 | JSON schema | unknown authority field 허용 |
| templates | schema SHA·profile | 상대경로 프로젝트 파일 | 절대경로·endpoint·계정 유입 |
| doctor | host/tool/dependency probes | tier 근거와 진단 JSON | 자기 선언으로 tier 상승 |
| init | plan→apply·충돌 목록 | byte-identical 파일 set | 기존 파일 덮어쓰기·부분 성공 |
| receipt | 본체/입력/출력/runtime init hash | sealed install receipt | pin 재계산 실패 |
| harness | closure allowlist·fake transport | no-send evidence | dynamic/forbidden import·호출 1회 이상 |
| coverage audit | profile·manifest·policy | finding 목록 | 누락을 PASS로 축약 |
| migration | old/new schema·fixture | forward/rollback evidence | rollback hash 불일치 |
| recovery | release receipt·project inventory | 재설치/재결속 계획 | runtime 비밀 또는 endpoint 추측 |

## 4. machine-readable 계약의 최소 필드

- `schema_version`, `package_id`, `release_version`
- `layers`: plugin/project/runtime의 허용·금지 데이터
- `dependencies`: plugin 이름, version 범위, 소비 schema, fail action
- `tiers`: 증거 조건, 허용 명령, 금지 주장
- `generated_files`: template SHA, target relative path, mode, overwrite policy
- `receipt_fields`: file hash, probe hash, tier, runtime initialization reference
- `activation_envelope`: candidate/review/Decision/epoch
- `acceptance_tests`: ID, platform, fixture, assertion, evidence mode
- `migrations`: from/to, forward, rollback, compatibility window

unknown 필드는 기본 거부한다. 정렬 key·NFC·compact UTF-8 canonical JSON을 해시 입력으로 사용한다.
default profile은 selector의 ordered Cartesian product와 `exclude_self` 규칙으로 전체 edge 요구를
결정적으로 확장한다. adapter가 팀 수를 바꾸면 요구 집합도 profile에서 함께 바뀌며 전역 revision을
하드코딩하지 않는다.

## 5. 처음부터 재제작하는 순서

1. 빈 디렉터리에서 source tree를 만든다.
2. schema와 canonical JSON helper를 먼저 구현하고 golden vector로 검증한다.
3. default profile·template을 만들고 두 번 생성해 byte identity를 확인한다. canonical JSON,
   install receipt, target 내부 금지 호출 무발송 golden vector도 먼저 통과시킨다.
4. doctor를 구현하되 실제 메시지를 보내지 않는 schema/read probe만 허용한다.
5. compatibility matrix와 fail-closed 검사를 구현한다.
6. init의 `--plan`과 원자적 `--apply`를 구현한다. 임시 파일 검증 뒤 rename하며 부분 성공을 금지한다.
7. install receipt 생성·재검산을 구현한다.
8. 무발송 harness와 coverage audit를 구현한다.
9. forward/rollback migration과 recovery를 구현한다.
10. plugin scaffold validator, 전체 acceptance, clean-profile 설치 시험을 통과한다.
11. 정확한 release manifest SHA를 독립 검수하고 설치 후보를 만든다.

## 6. runtime 유실과 source 유실을 구분한 복구

- source만 유실: release manifest와 golden tests로 동일 version을 재빌드하고 모든 파일 hash를 대조한다.
- 프로젝트 파일만 유실: 같은 profile 입력으로 재생성하되 repository history와 충돌을 확인한다.
- runtime만 유실: `RUNTIME_RESTORE_REQUIRED`; endpoint를 추측하지 않고 각 논리 채팅의 초기 결속 또는
  Mission Relay successor 복원을 다시 수행한다.
- receipt만 유실: 현재 상태를 승인된 과거로 소급하지 않는다. 새 install/recovery receipt를 만든다.
- 4개 dependency 중 하나 유실: bootstrap은 대체 구현하지 않고 dependency restore 안내와 진단 실패를 낸다.
- 전부 유실: source 재빌드 → plugin validation → clean install → project regeneration → runtime 새 초기화 →
  simulation → 별도 endpoint 재결속 순서다.

## 7. 최소 portability acceptance

- `AT-01` 새 사용자 프로필·새 clone clean install과 receipt 재검산
- `AT-02` 두 PC에서 같은 입력의 프로젝트 생성 파일 hash 동일
- `AT-03` Git diff의 비밀·계정·endpoint·절대경로 누출 0
- `AT-04` closure pin과 fake transport를 포함한 무발송 정상 0·거부 attempt 양수·실제 provider 0
- `AT-05` host 근거 누락 시 tier 상향·send 거부
- `AT-06` PowerShell/Bash 오인 0, 실제 exit code 보존
- `AT-07` 기존 플러그인 지원 범위 밖 version에서 fail-closed
- `AT-08` schema forward→rollback 후 hash 원복
- `AT-09` 11→다른 팀 수/역할명 adapter 적용 후 coverage 처분
- `AT-10` exact envelope 없이는 ACK-only probe도 거부
- `AT-11` init 재실행 idempotency와 사용자 편집 충돌 무덮어쓰기
- `AT-12` runtime 삭제 시 자동 상향 복구 없이 restore-required
- `AT-13` Unicode·공백 경로와 CRLF/LF matrix
- `AT-14` plugin 제거 후 기존 4개 플러그인의 단독 회귀 없음
- `AT-15` release source를 빈 폴더에서 재빌드해 release manifest와 의미·시험 일치
- `AT-16` 다른 비관리자 principal이 runtime을 읽지 못하는 ACL 음성 시험
- `AT-17` 같은 host 입력의 tier hash 결정성과 capability-policy 편집 상향 거부

Windows가 v1 검증 플랫폼이다. 다른 OS는 해당 OS의 ACL·KnownFolder·Shell acceptance가 추가되기 전
`UNVERIFIED_PLATFORM`으로 남긴다.

## 8. 재제작 완료 증거

완료 bundle은 plugin validator 출력, source file inventory, dependency lock, golden output, AT-01~17
결과, release manifest, 독립 검수 결과를 exact SHA로 결속한다. 하나라도 없으면 `REBUILD_COMPLETE`를
선언하지 않는다.

설계 단계의 dependency-free 의미 검사는 `scripts/portable-team-service-design.test.mjs`가 수행한다.
UTF-16 canonical reference를 직접 실행해 expected text/hash를 대조하고, selector 참조와 67개 route-kind
requirement·64개 고유 source-target route
확장, 외부 `$ref` 대상, schema-valid 전체 install receipt, 경로의 drive/UNC/backslash/상위탈출 거부,
AC-24 관측 어휘를 검사한다. 텍스트와 그 텍스트 hash만 비교하는 자기참조 검사는 허용하지 않는다.

## 9. 구현 v0.2.0 정본 매핑

설계 정본을 실제 코드로 옮긴 첫 구현은 `tools/codex-team-service-bootstrap`이다.

- manifest와 skill: `.codex-plugin/plugin.json`, `skills/team-service-bootstrap/SKILL.md`
- 계약 입력: `contracts/`, `schemas/`, `profiles/`, `golden/`, `templates/`
- canonical·schema registry·경로/원자성 helper: `scripts/lib/core.mjs`
- doctor·init·runtime receipt·dry-run·verify·activation validation·migration·recovery:
  `scripts/team-service.mjs`
- 실행형 무발송 closure: `scripts/no-send-harness.mjs`, `harness/no-send-*.mjs`
- 다른 사용자/PC 설치와 업데이트 백업: `scripts/Install-TeamServiceBootstrap.ps1`
- marketplace형 release 생성: `scripts/Export-TeamServiceBootstrap.ps1`
- 실행 시험과 현재 판정: `tests/`, `contracts/acceptance-matrix.json`, `docs/IMPLEMENTATION-STATUS.md`

구현 v0.2.0에서 AT-08은 schema v1의 hash 보존 no-op와 0.1.x→0.2.0 프로젝트 파일 migration·runtime
backup을 검증한다. 더 오래된 미지 판본의 migration은 주장하지 않는다. AT-15의 빈 소스 재제작 drill과
AT-16의 다른 Windows principal 외부 시험은 차단 상태로
남긴다. 격리된 두 번째 사용자 프로필 시험은 실제 물리적 두 번째 PC 시험을 대신하지 않는다.
