# AI 팀 서비스 공통 플러그인 설치·운영 설계 v0.2.0

상태: `IMPLEMENTATION_CANDIDATE_OPUS_RECHECK_PENDING`

## 1. 배포 형태

개발 중에는 personal local marketplace에 설치한다. 팀 공용 배포는 검증된 GitHub marketplace를
별도 사용한다. 플러그인은 skill과 로컬 helper를 묶되 실제 host 메시지 전송 MCP를 새로 소유하지 않는다.
설치 후 새 채팅에서만 새 skill과 도구가 로드된 것으로 간주한다.

## 2. 사용자 흐름

사용자는 다음 의미의 작업을 요청한다.

1. `doctor`: 설치 전 환경과 기존 4개 플러그인의 호환성을 읽기 전용 진단
2. `init --plan`: 생성/충돌/보존 파일을 미리보기
3. `init --apply`: 새 파일만 원자적으로 생성
4. `verify-install`: install receipt와 생성 파일을 재검산
5. `dry-run`: profile↔manifest↔Router message-kind coverage audit와 VM 무발송 harness 실행
6. `activate probe-only`: 별도 exact envelope가 있을 때 ACK-only 1회용 envelope 준비·검증
7. `pilot`: probe 성공 뒤 별도 사람 Decision의 제한 파일럿 envelope 준비·검증
8. `migrate` / `rollback`: schema version 변경과 복구 시험
9. `recover`: source/project/runtime 유실 유형별 fail-closed 복구

helper의 실제 CLI 이름과 옵션은 구현 후보에서 고정한다. 본 문서는 존재하지 않는 명령의 실행 성공을
주장하지 않는다.

실제 dispatch mode 변경과 message send는 Team Router가 검증된 envelope를 소비해 수행한다.
bootstrap은 Router policy나 activation receipt를 직접 만들거나 수정하지 않는다.

## 3. 설치 영수증

`install-receipt.json`은 다음을 canonical JSON으로 봉인한다.

- 실행 중인 플러그인의 exact `plugin_version`(개발 설치의 cachebuster 포함)과 manifest SHA

- plugin name/version/source manifest SHA
- 이전 install receipt SHA 또는 최초 설치의 null
- compatibility matrix SHA와 dependency 실측 version/schema hash
- project profile과 template SHA
- 생성 파일의 상대경로·SHA·mode
- doctor raw evidence SHA와 계산된 tier
- runtime 초기화의 비민감 reference와 ACL 검사 결과
- no-send·coverage audit 결과 SHA
- 생성 시각의 승인된 clock provenance 또는 `UNVERIFIED_TIME`

영수증은 비밀·실제 endpoint·계정·원시 대화를 담지 않는다. verify가 하나라도 재현하지 못하면 설치는
`DRIFTED_OR_INCOMPLETE`다.

## 4. 안전한 초기화와 병합

- `--plan` 없는 apply를 금지한다.
- 기존 파일은 hash와 schema를 읽고 `UNCHANGED`, `MERGE_REQUIRED`, `CONFLICT`, `CREATE`로 분류한다.
- merge는 자동 덮어쓰기가 아니라 제안 diff를 만들며 사용자 파일을 보존한다.
- 생성 set은 전부 검증된 뒤 원자적으로 반영한다. 부분 성공이면 새 파일을 되돌리고 기존 파일은 건드리지 않는다.
- 재실행은 같은 입력에서 no-op이어야 한다.

## 5. 활성화와 회수

simulation은 설치 기본값이다. `PROBE_ONLY`와 `PILOT`은 서로 다른 Decision과 envelope를 쓴다.
capability tier가 요구 수준보다 낮거나 dependency/runtime/receipt가 drift하면 활성화를 거부한다.

STOP은 미래 send를 막는 fence다. 이미 외부에 전달된 효과를 되돌렸다고 주장하지 않는다. 관측 오류나
stale generation이 발견되면 해당 결과와 모든 의존 결과를 재개방한다.

## 6. 업데이트와 rollback

- manifest semver와 Codex cachebuster를 구분한다.
- update 전 compatibility·migration plan·백업 hash를 만든다.
- forward 적용 후 전체 receipt를 새로 만들고 구 receipt는 append-only로 보존한다.
- rollback은 schema와 runtime을 함께 시험하되 이미 발송된 외부 효과를 삭제하지 않는다.
- unsupported dependency version은 조용히 downgrade하지 않고 설치를 중단한다.

## 7. 삭제

plugin 삭제는 프로젝트 파일과 runtime을 자동 삭제하지 않는다. 사용자에게 다음을 분리해 보여준다.

- plugin 본체 제거
- 프로젝트 생성 파일 보존/수동 제거
- runtime 백업/폐기
- endpoint 재결속 필요 여부

민감 runtime을 폐기했다면 복구 불가 여부를 기록한다.

## 8. 운영 상태 문구

- `설치됨`: plugin manifest를 읽을 수 있음
- `초기화됨`: project files 생성과 receipt 검증 완료
- `무발송 검증됨`: 현재 closure에서 정상 dispatch 0·거부된 fake attempt 양수·실제 provider call 0을 실행으로 관측
- `로컬 조정 가능`: `LOCAL_CORE_ONLY`
- `관측 협업 가능`: `COOPERATIVE_OBSERVED`; 인증·사람 승인 아님
- `인증 흐름 가능`: exact positive host evidence가 있는 범위만 `AUTHENTICATED`
- `시각 미검증`: `UNVERIFIED_TIME`; 만료·순서에 신뢰 시각이 필요한 활성화 금지
- `서비스 준비`: 별도 전체 acceptance와 운영 게이트를 통과한 경우만

## 9. 구현 v0.2.0 명령

정본 소스는 `tools/codex-team-service-bootstrap`이며 개인 설치본은 사용자 홈의
`plugins/codex-team-service-bootstrap`이다. 다음 명령은 정본 소스 또는 설치본에서 실행한다.

```powershell
node scripts/team-service.mjs doctor --project C:\path\to\project
node scripts/team-service.mjs init --project C:\path\to\project --plan
node scripts/team-service.mjs init --project C:\path\to\project --apply
node scripts/team-service.mjs init-runtime --project C:\path\to\project
node scripts/team-service.mjs dry-run --project C:\path\to\project
node scripts/team-service.mjs verify-install --project C:\path\to\project
```

`prepare-activation`은 envelope와 tier·epoch·Router 일관성을 검증할 뿐 Router를 활성화하거나 메시지를
보내지 않는다. 설치본 업데이트는 기존 폴더를 사용자 홈의 `.backups`에 보존한 뒤 교체하며, plugin
cachebuster와 Codex 재설치는 plugin-creator 표준 절차를 따른다.

의존 플러그인은 사용자별 Codex cache와 personal plugin 경로에서 exact version을 탐색한다. 별도 설치
위치는 `CODEX_TEAM_SERVICE_DEPENDENCY_ROOTS` JSON 환경변수에 네 플러그인의 절대경로를 매핑한다.
하나라도 없거나 판본이 다르면 `INCOMPATIBLE_DEPENDENCY`와 non-zero exit로 runtime 봉인을 거부한다.

`dry-run`은 정상 fixture를 VM module closure 안에서 실행하고 `fetch`와 dynamic import 음성 fixture를
실제 효과 전에 각각 `NO_DISPATCH:fetch`, `NO_DISPATCH:dynamic-import`로 거부한다. 67은 message-kind가
결속된 requirement 수이고, source-target만 합친 고유 논리 route는 64다.
