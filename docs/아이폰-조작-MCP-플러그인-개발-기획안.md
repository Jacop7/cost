# 아이폰 조작 MCP 플러그인 개발 기획안

- 작성일: 2026-09-12
- 판본: v4 / v3 채팅 설계 PASS 후 선택 개선 명확화 / 최종 판정은 검수 처리표 참조 / 공식 Fable CLI 미실행
- 요청: 기존 아이폰 조작 도구를 재사용하는 플러그인의 개발 기획과 Fable 검수
- 이번 산출물: 기획 문서와 검수 준비 자료. 플러그인 구현·설치·기기 변경·운영 배포는 포함하지 않는다.
- 공식 기획은 이 문서 하나다. 검수 의견은 이 문서에 반영하고 원본 검수 기록은 보존한다.

## 1. 목표와 성공 기준

아이폰 연결 때마다 도구를 다시 찾거나 같은 실패를 반복하지 않고, 새 작업·재부팅 이후에도 연결 상태와 가능한 동작을 정확히 확인한다. 성공한 명령과 실제로 성공한 화면 조작을 구분한다.

MVP 대상은 Windows PC에 연결된 사용자 소유 아이폰 1대와 Costkeep 개발 앱이다. 기기 잠금 해제·신뢰 승인·개발자 모드 승인·서명 인증은 사용자가 직접 수행한다. 플러그인이 이를 우회하지 않는다.

완료 조건은 다음과 같다.

1. 기기 발견, 연결 진단, 허용된 앱 실행, 화면/접근성 조회가 각각 독립적으로 판정된다.
2. 실제 입력 백엔드가 확인된 경우에만 터치·스크롤·입력을 제공한다.
3. 연결 끊김·잘못된 기기·검은 캡처·모호한 대상·결과 불명 상태를 성공으로 보고하지 않는다.
4. 재부팅 뒤 새 세션으로 복구하되, 이전 입력을 자동 재실행하지 않는다.
5. PC 설정·다른 앱·실제 재고와 원장은 시험 때문에 변경하지 않는다.

## 2. 기존 증거와 재사용 범위

아래는 2026-09-11 작업 기록에 따른 과거 관측이다. 현재 연결 상태나 모든 iOS 버전에 대한 보장이 아니다.

| 기능 | 관측 결과 | 기획상 처리 |
|---|---|---|
| go-ios 기기 조회·터널 | 성공 기록 있음 | 설치된 버전과 드라이버를 먼저 확인하고 재사용 |
| 개발 앱 실행 | 현재 Metro 주소 지정 시 성공 기록 있음 | 주소·허용 앱·개발 환경을 확인한 뒤 실행 |
| USB 화면 캡처 | 이미지 생성 가능, 앱 내용이 검게 나온 사례 있음 | 캡처 생성과 화면 관측 가능을 별도 판정 |
| 앱 내부 런타임 측정 | 실제 기기에서 측정 성공 기록 있음 | `APP_INSTRUMENTED` 증거로만 분류 |
| 접근성 항목 조회 | 성공 기록 있음 | 조회와 초점 이동·활성화를 분리 |
| 접근성 활성화 | 요청 전송 후 팝업 열림 확인 실패 | 미검증. 터치 성공으로 간주하지 않음 |
| 좌표 입력 백엔드 | 당시 UI 서비스 연결 거부, 실행 가능한 runner 미확인 | 구현 전 선행 검증 필요 |

기존 Python 스크립트에는 조회뿐 아니라 초점 이동·활성화 경로가 있다. 이름이나 주석만으로 읽기 전용이라고 판단하지 않고, 조작 경로를 별도 도구로 분리한다. 기기 고유 ID·터널 포트·PID를 소스에 고정하지 않는다.

## 3. 범위와 제외 사항

포함: 연결 진단, 개발 앱 실행, 유효한 화면 조회, 접근성 조회, 검증된 입력, 조작 결과 확인, 작업 간 기기 독점, 재부팅 복구, 비밀정보를 제외한 시험 증거.

제외: 아이폰 전체 무제한 제어, 잠금·신뢰 우회, 개인 메시지/사진 탐색, Apple 계정 자동 로그인, 자동 프로비저닝, 임의 셸 명령 실행, 운영 DB 변경, 실제 결제, Android·iPad·원격 인터넷 제어, 네이티브 입력을 앱 내부 함수 호출로 대체한 합격 처리.

운영 앱 시험은 별도 승인 범위다. 최초 버전의 조작은 개발 앱·테스트 데이터 환경에서만 허용하며, 화면에 삭제/저장 버튼이 있다는 사실만으로 데이터 변경 권한이 있다고 보지 않는다.

## 4. 구성

```text
Codex plugin: manifest + 사용 스킬 + stdio MCP 설정
  └─ MCP gateway (클라이언트별): 스키마 검증 / 인증된 로컬 broker 호출
      └─ 사용자별 단일 device broker: 프로세스 간 기기 잠금 / 권한 / 영속 조작 원장
      ├─ process supervisor: 소유 프로세스·포트·수명 관리
      ├─ go-ios adapter: 기기·터널·앱 실행·캡처
      ├─ AX adapter: 조회 / 초점 이동 / 활성화 분리
      ├─ native input adapter: 준비된 WDA 또는 검증된 대안
      └─ app instrumentation adapter: 읽기 전용 환경 게이트·내부 검사, 입력 증거와 분리
```

- 패키지는 `.codex-plugin/plugin.json`, `.mcp.json`, `skills/`, 서버 코드와 시험으로 구성한다. 기존 플러그인 생성 스킬의 manifest/검증 절차를 따른다.
- 소스는 권위 저장소의 `tools/iphone-control/`에 두고, 플러그인 루트는 그 아래 `plugin/`으로 설계한다. 별도 저장소나 권위 루트 밖 개발 사본을 만들지 않는다. 설치된 패키지는 빌드 산출물이지 작업 원본이 아니다. 이번 단계는 경로 설계만 하며 생성·설치하지 않는다.
- 이 기획은 문서 그래프의 설계 노드로 등록한다. 구현 시 tools 경로의 책임 README·시험 스크립트·루트 문서 그래프 및 AGENTS 문서 책임표를 함께 갱신하는 것을 W01 완료 조건에 포함한다. 다른 작업의 AGENTS 변경에 섞어 지금 임의 수정하지 않는다.
- 제품 Expo와 플러그인은 독립 배포하되 동일 저장소 CI로 검증한다. 플러그인 타입·단위·보안·패키지 검사를 루트 `pnpm verify`의 Docker 없는 필수 범위에 편입하고, 정확한 CI 성공 SHA와 패키지 해시로 설치 산출물을 결속한다. 개인 marketplace 등록은 plugin-creator의 기본 구조를 쓰며 팀 marketplace를 임의 추가하지 않는다.
- 환경 계측은 M2의 선행 의존이다. 개발 빌드 전용 읽기 전용 진입점으로 한정한다. 릴리스 빌드의 import graph·생성 bundle·설정에서 계측 모듈/엔드포인트/등록 코드가 제외됨을 웹 및 Android/iOS 릴리스 산출물에서 검사한다. 문자열 검사만으로 제외를 증명하지 않는다. 오염시킨 릴리스 fixture가 반드시 실패해야 하며, 해당 산출물 검사를 못 하면 그 산출물은 배포하지 않는다.
- pairing 자료, 기기 ID 매핑, 인증·임시 화면은 사용자 전용 ACL의 로컬 런타임 저장소에만 둔다. 패키지·Git·공유 검수 입력에 넣지 않는다.
- CLI/라이브러리는 확인된 버전과 해시를 고정한다. 인터넷 최신 버전이나 runner를 실행 중 자동 다운로드하지 않는다.
- runner는 별도 관리 자산이다. `source`, `artifact_sha256`, `runner_version`, `bundle_id`, `profile_expiry`, `device_binding_verified`, `installed_by_user`를 로컬에서 확인한다. 인증서/프로파일 원문·개인키는 반환하지 않는다. 만료 임박(72시간 이내)은 DEGRADED, 만료는 BLOCKED, 판독 불가/기기 결속 미확인은 UNVERIFIED로 하며 입력을 막는다. 기간은 무료/유료 구독 명칭으로 추정하지 않고 실제 자산 값을 읽는다. 사용자 주도의 서명·설치 준비 방법과 갱신 책임자를 M0 결과에 남긴다.

## 5. 도구 계약

아래 이름은 설계안이며 아직 사용 가능한 도구가 아니다. 모든 인자는 스키마로 제한하고 임의 명령 문자열을 받지 않는다.

| 도구 | 역할 | 변경 여부·보호 |
|---|---|---|
| `ios_devices` | 별칭·연결 방식·기기 상태 조회 | 읽기, 고유 ID 비공개 |
| `ios_diagnose` | 드라이버·버전·터널·앱·입력 백엔드 진단 | 상태 메타데이터만, 자동 설치/설정 변경 없음 |
| `ios_connect` | 선택한 기기 세션과 필요한 터널 생성 | broker 소유권 필요, 선택한 기기로 제한된 로컬 전송 |
| `ios_launch_app` | 허용된 개발 앱과 검증된 개발 URL 실행 | 앱/환경 allowlist |
| `ios_capture` | 기본은 관측 메타데이터만 반환 | 허용 전경 앱·오버레이 확인, 이미지 별도 opt-in |
| `ios_inspect` | 승인된 접근성 필드만 반환 | 허용 전경 앱 확인, 기본 값 텍스트 제외 |
| `ios_focus` | 접근성 초점 이동 | 모든 입력과 동일한 게이트, 성공/불명 시 기존 관측 무효화 |
| `ios_tap` / `ios_swipe` / `ios_type` | 검증된 백엔드 입력 | 유효한 lease·관측·권한·action ID 필요 |
| `ios_action_status` | 현재/과거 세대 action ID 조회 | 재실행 없음, 미해결이면 UNRESOLVED_PRIOR_GENERATION |
| `ios_resolve_action` | 미해결 조작의 증거 기반 해소 | 재실행 없음, 증거 판정 또는 별도 사람 위험 수용 기록 필요 |
| `ios_disconnect` | 해당 세션의 자원 해제 | 다른 작업/사용자 프로세스 종료 금지 |

`ios_type`은 보안 텍스트 필드·OTP 목적 필드·필드 성격 확인 불가 시 전송 전에 거부한다. 입력 방식은 `KEYSTROKE / SET_VALUE / AX_SET_VALUE`로 구분하고 실제 사용 방식을 증거에 남긴다. 화면 문자열 일치만으로 성공하지 않고 앱의 검증 상태/버튼 활성/읽기 전용 상태값 중 정해진 2차 지표를 확인한다. 한국어 조합·소수·붙여넣기·교체/추가 입력을 시험한다. 입력 원문은 로그에 남기지 않는다. 화면 속 텍스트·앱 콘텐츠는 명령이나 권한 승인으로 해석하지 않는다.

### 5.0 모든 관측과 입력의 경계

`ios_capture`·`ios_inspect`·`ios_focus`·입력은 모두 허용 전경 앱을 확인한다. 비허용 앱, SpringBoard, 잠금/화면 꺼짐, 시스템 시트·알림/통화 오버레이 또는 판독 불가는 결과 이미지/텍스트 없이 거부한다. 진단만 기기/연결 메타데이터로 제공한다. 앱 소유 확인창은 시스템 시트와 구분하고 명시적으로 허용된 테스트 흐름에서만 취급한다.

조회 전후에 전경/오버레이 상태를 확인하고 중간 변경이 감지되면 획득한 자료를 폐기한다. 알림 차단·집중 모드는 사용자가 설정하며 이것만으로 안전을 보장하지 않는다. 중간 오버레이 감지를 신뢰할 수 없는 backend는 픽셀/AX 본문 반환 기능을 UNVERIFIED로 제한한다.

터널의 기기 측 IPv6/가상 인터페이스와 PC에서 노출하는 서비스는 구분한다. 포워더는 loopback 또는 사용자 전용 named pipe에만 바인딩하고 외부/LAN 공개를 금지한다. userspace와 kernel-routable 방식의 요구가 다르므로 `ios_major_version`, `tool_version`, `tunnel_provider`, `transport_mode`, `requires_elevation`, `adapter_present`를 진단한다. 승격·드라이버 설치가 필요하면 자동 수행하지 않고 사용자 조치로 보고한다. backend가 비승격 userspace로 가능하면 승격을 요구하지 않는다.

### 5.1 공통 상태와 응답

기능별 상태는 `READY / DEGRADED / BLOCKED / UNVERIFIED`로 나눈다. 연결 하나가 성공했다고 모든 기능을 `READY`로 만들지 않는다.

준비 상태와 현재 권한은 직교한다. `lease_state=FREE/OWNED_SELF/OWNED_OTHER/RECOVERY_REQUIRED`, `environment_state=TEST_VERIFIED/PRODUCTION/UNVERIFIED`, `output_permission=METADATA_ONLY/AX_LABELS/IMAGE_OPT_IN`을 별도로 반환한다. backend READY라도 lease/환경/출력 권한을 대신하지 않는다.

조작 상태는 `REQUESTED → DISPATCHED → VERIFIED`가 기본이다. 결과를 관측하지 못하면 `UNKNOWN`, 전송 전 거부는 `REJECTED`다. timeout으로 결과가 불명확한 경우 `FAILED`라고 단정하지 않는다.

응답에는 `device_alias`, `session_generation`, `app_id`, `backend`, `action_id`, `observation_id`, `result_state`, `reason_code`, `evidence_type`을 포함한다. 실제 터치 입력 증거는 `NATIVE_INJECTED`, 접근성 활성화는 `AX_ACTIVATED`, 앱 내부 조작은 `APP_INSTRUMENTED`로 구분한다. 어느 것도 사람의 직접 터치라고 표기하지 않는다.

### 5.2 좌표와 사후 확인

- 좌표는 바로 전 유효 관측의 화면 크기·방향·배율과 결합한다. points/pixels/정규화 좌표를 혼용하지 않는다.
- 화면 방향·전경 앱·키보드·세션이 바뀌거나 관측이 만료되면 다시 관측한다. 초기 관측 만료는 5초로 두고 테스트 결과로 조정한다.
- 접근성 selector가 0개 또는 여러 개와 일치하면 입력하지 않는다. 좌표 대체도 별도 관측과 대상 검증을 거친다.
- 백엔드 HTTP 성공이나 명령 종료 코드만으로 `VERIFIED`를 부여하지 않는다. 예상 팝업·값·화면 상태 변화를 확인한다.
- 입력 자체의 전달과 앱의 저장 완료는 별도 결과다. 팝업이 닫혔다고 서버 저장 성공으로 판단하지 않는다.
- 검은 캡처는 실제 앱의 검은 화면일 수도 있어 휴리스틱만으로 고장이라고 확정하지 않는다. 관측 불충분으로 좌표 조작을 막고 접근성/런타임 증거를 별도 제시한다.

`observation_id`는 session/app/generation과 캡처·AX·기기 메트릭의 각 수집 시각·출처를 결속하는 일관성 묶음이다. 다른 observation의 frame/배율을 섞지 않는다. OS가 동시 snapshot을 제공한다는 보장은 하지 않는다. 수집 전후 방향·논리 크기·전경·화면 revision을 비교하고, 최대 수집 시차 250ms 및 안정 표본 2회(100ms 이상 간격)를 초기 허용치로 둔다. 화면 revision 또는 동등한 안정성 판정이 불가하면 좌표 입력은 UNVERIFIED다. animation 중에는 거부하고 안정 후 새 관측한다.

배율·논리 좌표계·insets는 backend/device 메트릭에서 받고 출처를 남긴다. 축소 캡처 크기로 배율을 역산하지 않는다. 최초 버전은 crop/letterbox/resized 이미지 좌표 입력을 지원하지 않는다. 메트릭의 변환과 캡처 치수가 맞지 않으면 거부한다. 입력 직전 broker가 lease·환경·전경·오버레이·잠금·방향·논리 크기·대상 revision/selector를 다시 확인한다. 사전 확인 timeout은 REJECTED이며 전송하지 않는다. 5초 TTL은 이 확인을 대체하지 않는다.

확인과 OS 입력 사이의 완전한 원자성은 보장하지 못한다. 이 잔여 경쟁은 명시적으로 남기며, 테스트 환경 제한·재관측·가능한 의미 기반 대상 입력·사후 확인으로 완화한다. 이 한계 때문에 운영/민감 앱 조작 허용으로 확대하지 않는다.

## 6. 권한·중복 실행·복구

### 6.1 프로세스 간 단일 소유권

모든 stdio gateway는 직접 adapter를 실행하지 않고 사용자별 단일 broker에 요청한다. broker는 사용자 SID와 로컬 기기 키에 결속한 OS named mutex를 전용 소유 thread에서 유지하고, 사용자 전용 ACL named pipe로 인증된 gateway만 받는다. 다른 Windows 세션에서도 같은 사용자·기기 자원을 중복 생성하지 않도록 mutex namespace와 ACL을 시험한다. 단일 사용자 소유 PC가 범위이며 다른 사용자의 임의 도구/악성 프로세스까지 통제한다고 주장하지 않는다.

논리 lease는 task/session/expiry/fencing-generation을 가지며 broker가 요청마다 확인한다. 기본 heartbeat 5초·lease 30초. 만료되면 새 입력을 중지하고 진행 중 명령의 상태 확인/소유 helper 정리가 끝나기 전 재할당하지 않는다. 현재 시각의 만료만으로 OS mutex를 훔치지 않는다. abandoned mutex/PID 재사용/불명 helper 상태는 RECOVERY_REQUIRED로 전환하고 영속 원장·소유 PID+시작시각을 복구한 뒤에만 새 세대를 발행한다. helper는 가능하면 kill-on-close Job Object에 묶되 실제 하위 프로세스 종료를 시험한다.

heartbeat/취소 처리는 adapter의 동기·장시간 호출과 별도 실행 경로에서 유지한다. 60초 터널 대기 중에도 클라이언트 생존을 확인하고, pipe 단절/heartbeat 소실은 신규 입력 차단 후 소유 작업 정리로 처리한다. broker 스스로 가짜 heartbeat로 사용자 작업의 만료를 무기한 연장하지 않는다.

터널·runner 생성/종료·초점·앱 실행도 단일 소유권 대상이다. go-ios와 pymobiledevice3 터널을 같은 기기에 동시에 기동하지 않는다. 선택된 userspace 프로세스 밖에서 터널을 사용할 수 없는 경우 같은 adapter 내부 호출/검증된 relay를 사용하며, 다른 프로세스가 기기 주소만 재사용할 수 있다고 가정하지 않는다.

기기 식별은 로컬 비밀키 HMAC으로 전체 고유 ID를 내부 결속하고, 표시 별칭은 별도 무작위 ID로 매핑한다. 축약 해시 충돌로 다른 기기를 같은 대상으로 보지 않는다. USB 포트 변경은 별칭 유지·세대 증가, 다른 기기는 다른 별칭이다. 키/매핑 분실·변조 시 자동 재할당하지 않고 RECOVERY_REQUIRED로 중단한다.

권한은 기기·앱·개발 환경·허용 동작·시험 데이터 범위·만료에 결속한다. 현재 도구 정책이 조작을 금지하면 플러그인도 실행하지 않는다. 도구의 존재 자체가 권한 확대는 아니다.

정책 스키마는 계획상 `tools/iphone-control/schema/policy.schema.json`, 비밀 없는 기본값은 `policy/defaults.json`이 소유한다. 사용자 ACL 런타임의 서명/무결성 확인된 세션 허용 기록과 교집합으로 적용한다. 호스트 도구 정책·AGENTS·명시적 사용자 범위보다 넓힐 수 없고 모델이 임의 플래그로 승인 기록을 발행하지 못한다. 불명 정책/불일치는 거부한다.

이 승인 출처 규칙은 일반 제어 권한뿐 아니라 HUMAN_RELEASED_UNKNOWN·IMAGE_OPT_IN·AX_LABELS·지속 증거 보존에도 동일하게 적용한다. MCP schema에는 `human_accepted`, `approve`, `force`, 승인 파일 쓰기/가져오기/CLI 실행 경로를 두지 않는다. `ios_resolve_action`의 MCP 표면은 기존 action ID와 broker가 생성·검증한 증거 ID만 받으며 모델이 제공한 임의 파일 경로/판정값은 받지 않는다. 사람 위험 수용과 출력 허용은 broker가 현재 Windows 사용자 세션에 띄운 별도 확인 UI에서 범위·action ID·위험·만료를 사람이 확인한 뒤에만 생성된다. 확인 nonce는 일회용이고 해당 기기/앱/세대/내용 해시에 결속한다. broker만 영수증을 발행하며 gateway는 승인 대화 응답 endpoint를 호출할 수 없다. 출처 불명/재사용/만료 영수증은 거부한다. CLI 플래그만으로 사람 승인을 만들지 않는다. 모델은 이 확인 UI를 대신 승인하도록 지시받지 않는다. 동일 사용자 권한의 악성 코드/임의 UI 자동화까지 막는 신원 증명이라고 주장하지 않으며 호스트 정책의 사용자 직접 확인 경계를 유지한다.

기기 제어만으로 앱이 어떤 DB에 연결됐는지 신뢰성 있게 알 수 없는 경우가 있다. 따라서 최초 조작은 전용 테스트 앱/개발 빌드와 확인된 환경 증거를 요구한다. 환경 확인 불가 시 조회만 허용한다. 운영 원장 변경 및 권한 밖 저장·삭제는 차단한다. 알려지지 않은 동작을 안전하다고 추정하지 않는다.

환경 게이트의 입력은 전용 테스트 bundle/build 해시와 실제 활성 API 클라이언트의 정규화 base URL·Supabase project ref 해시·테스트 store 별칭·설정 revision이다. 정적 환경변수/앱 이름만으로 통과시키지 않는다. 별도 개발 전용 읽기 endpoint가 broker nonce·세션·시각에 결속해 반환하고, broker의 로컬 테스트 manifest와 모두 일치해야 TEST_VERIFIED다. 앱의 실제 요청 전송층도 테스트 endpoint/store allowlist 밖 요청을 거부하며 redirect/환경 전환 시 게이트를 폐기한다. 이는 검수된 협력 테스트 빌드에 대한 계약이고 임의 악성 앱의 자기보고를 신뢰하는 보안 attestation이 아니다.

최초 버전의 M0b/M2 변경 입력 시험은 JS가 내장된 전용 테스트 빌드로 한정한다. native binary와 실제 내장 JS bundle의 내용 해시·소스 SHA를 테스트 manifest에 함께 고정하고, Metro·Fast Refresh·원격 JS 교체·OTA 업데이트를 시험 빌드에서 비활성화한다. 런타임 bundle ID/해시를 읽을 수 없거나 manifest와 다르면 UNVERIFIED로 입력을 막는다. Metro로 실행한 개발 앱은 native shell 해시가 같아도 변경 입력을 허용하지 않고 제한된 조회만 제공한다. 향후 Metro 변경 입력 지원은 별도 설계/검수 범위다.

환경 endpoint는 선택한 물리 기기에 결속한 USB/usbmux/검증된 기기 터널의 포트 전달로만 접근한다. LAN IP·일반 hostname·다른 기기 relay를 통한 환경 확인은 거부한다. 기기 측 진단 endpoint는 loopback 한정이며 이 바인딩에 해당 USB 경로로 도달 가능한지는 M0에서 검증한다. 불가하면 LAN 공개로 완화하지 않고 해당 backend는 환경 게이트 미지원이다. 응답은 broker가 시작한 launch session의 일회 nonce·앱 instance ID와 OS가 조회한 대상 bundle/process 식별값에 일치해야 한다. 기존 앱을 안전하게 재실행할 권한이 없거나 instance 결속 확인이 안 되면 UNVERIFIED다. 재부팅·앱 재시작마다 instance/nonce를 폐기한다. 개발 빌드의 challenge 검증 정보는 해당 USB 세션에만 전달하고 로그/모델 응답에 노출하지 않는다.

운영 ref/비허용 endpoint는 BLOCKED(ENV_PRODUCTION/ENV_NOT_ALLOWED), 응답 없거나 오래된 증거는 UNVERIFIED로 입력 금지다. 이때도 조회는 §5.0·§7의 앱/출력 경계 안에서만 가능하다. 환경 차단 시험은 mock transport로 운영 ref를 주입하고 실제 운영 DB에 요청하지 않는다. 무DB 테스트 harness로 M0 입력 가능성을 먼저 확인하고, Costkeep의 저장 시험은 M2 환경 게이트 후 격리 테스트 DB에서만 수행한다.

### 6.2 미해결 조작 원장

`action_id`는 broker의 영속 원장에서 세션 세대를 넘어 유일하다. 원장은 기기 키·앱·의도 코드·최소 인자 fingerprint(개인 입력 원문 제외, 로컬 비밀키 HMAC 사용, 단순 해시 금지)·이전 세대·시각·상태·증거 참조를 보존한다. 전송 전에 PREPARED를 내구 저장하고, 전송 경계를 지난 후 확인 못 한 PREPARED/DISPATCHED는 재시작 시 UNKNOWN으로 승격한다. 같은 ID/다른 fingerprint는 거부하고, 같은 ID 재호출은 상태만 반환한다. 원장 쓰기·flush·무결성 확인 실패면 입력하지 않는다.

UNKNOWN은 재부팅/세대 변경/lease 만료로 삭제되지 않는다. 같은 기기·앱에 대한 새 ID의 모든 변경 입력도 UNRESOLVED_ACTION으로 막는다. OS 전송이 완료될 가능성이 남은 동안은 다른 앱으로의 제어 전환도 막는다. 읽기 전용 `ios_action_status`는 과거 세대도 조회하며 미해결은 UNRESOLVED_PRIOR_GENERATION이다.

`ios_resolve_action`은 (a) 신뢰 가능한 동작/서버 결과 증거로 APPLIED 또는 NOT_APPLIED를 확정하거나 (b) 사람이 해당 action ID의 불확실성·중복 위험을 명시적으로 수용한 경우에만 해제한다. (b)는 VERIFIED로 바꾸지 않고 HUMAN_RELEASED_UNKNOWN으로 남긴다. OS/runner 명령이 아직 실행될 수 있으면 사람 수용만으로도 해제하지 않는다. 모델의 '저장 안 된 것 같다'는 판단, 단순 화면 동일성은 NOT_APPLIED 증거가 아니다. UI/DB exactly-once를 보장하지 않는다. 모든 입력은 기본 재시도 0회이며 누적/멱등 동작 구분으로 이 기본값을 완화하지 않는다.

미해결 항목은 자동 보존 기한 없이 최소 메타데이터로 유지한다. 해결 항목은 기본 30일 후 정책에 따라 정리한다. 원장/키 분실은 새 상태로 초기화하지 않고 복구 필요로 차단한다.

프로세스는 생성 시 PID·시작 시각·소유 토큰을 기록한다. 종료할 때 다시 일치 여부를 확인한다. 포트가 이미 사용 중이면 주체를 확인하고, 모르는 프로세스를 죽이거나 기존 PID 번호만으로 종료하지 않는다. Windows 백그라운드 helper는 숨김 실행한다.

### 6.3 재개와 진단

공통 복구 순서는 `도구 버전 → 기기 동일성 → 미해결 원장/소유권 복구 → 잠금·신뢰 → 새 터널 → 앱/환경 → 새 관측`이다. 입력 큐를 재생하지 않지만 미해결 원장은 반드시 승계한다.

| 중단 | 처리 |
|---|---|
| PC 재부팅/broker 재시작 | PID/포트/lease 재사용 금지, helper와 원장 복구, 새 세대·권한 |
| 아이폰 재부팅 | 기기 ID 재확인, 최초 잠금 해제 전 후보 상태 DEVICE_LOCKED_SINCE_BOOT 구분. 정보 불충분이면 LOCK_STATE_UNKNOWN으로 보고하고 재페어링을 자동 요구하지 않음 |
| 앱 재실행/환경 변경 | 앱/환경 증거·관측 무효, 원장 유지, 동일 기기에 새 앱 세대 |

runner 만료·기기 결속 불일치·승격 필요는 반복 재시도하지 않고 사용자 조치 1건으로 보고한다. 서명 자산의 기존 프로파일을 자동 재발행하거나 인증서를 폐기하지 않는다.

기본 deadline은 열거 10초, AX/캡처 20초, 앱 실행 30초, 터널 수립 60초다. 상태 조회만 최초 실행 이후 최대 2회 재시도하며 입력·앱 실행·터널 생성은 timeout 후 소유/결과 확인 없이 재실행하지 않는다. 모든 대기는 취소 가능하고 60초 내 진행 상태를 알린다. 실제 장치 시험으로 timeout 프로파일을 고정한다.

## 7. 개인정보와 증거

- 로그 기본값은 기기 별칭·동작 종류·버전·시간·상태·오류 코드만 보존한다. 입력 문자열·pairing 자료·토큰·환경변수 전체 출력은 금지한다.
- 기본 캡처는 메모리에서만 처리하고 응답에는 관측 ID·크기·방향·유효성만 반환한다. 이미지 바이트·파일 경로·resource 링크를 기본 MCP 응답에 포함하지 않는다. 도구 반환도 모델 제공자/대화 기록으로의 전달임을 설명한 세션별 명시적 IMAGE_OPT_IN에서만 허용 앱의 검증된 프레임을 반환한다. 로컬 파일 삭제로 이미 전달된 대화 기록이 삭제된다고 설명하지 않는다.
- AX 기본 반환은 안정 ID·role·frame·enabled 등 비내용 메타데이터다. UI 라벨은 별도 AX_LABELS 범위에서 승인된 테스트 앱 정적 라벨만 반환한다(항목당 128자, 100개, 총 16KiB 제한). value/free text·알림/보안 필드·전체 트리 원문은 제외한다. 문자열 마스킹만으로 동적 사용자 데이터를 정적 라벨로 판정하지 않는다.
- adapter가 평문 임시 파일을 반드시 남기는 경로라면 기본 이미지 기능을 제공하지 않는다. 명시적 로컬 보존 선택 시만 세션별 암호화 임시 저장을 쓰고 복호키는 메모리에만 둔다. 정상 종료 또는 만료 시 키 폐기, 다음 시작 때 안전한 루트 내 암호문을 정리한다. 기본 보존 상한은 24시간이나 PC 전원 꺼짐 중 물리 삭제 시각은 보장하지 않는다. 지속 보존 증거는 별도 승인된 비식별 결과만 허용한다. process/core dump에 이미지가 남는 설정도 배포 점검 대상이다.
- 화면 마스킹은 완전성을 보장하지 않는다. Fable 등 외부 검수에는 기본적으로 기획과 비식별 텍스트 증거만 전달한다. 원본 화면 전달은 별도 범위 확인이 필요하다.
- 증거는 도구/앱 버전·화면 관측·동작·사후 관측을 연결한다. 검증 불가 결과를 삭제하거나 정상 결과로 덮어쓰지 않는다.

## 8. 단계별 개발과 중단 기준

| 단계 | 착수 조건 | 작업·종료 조건 |
|---|---|---|
| M0a 읽기 조사 | 구현 착수 승인, 기기/도구 메타데이터 조회 범위 확인 | OS/iOS/Node/Python/도구 판본·서명/터널·USB loopback 도달 경로를 가능/조건부/불가로 확정. 전제 부족과 기술 불가를 구분 |
| M0b 입력 spike | M0a 가능 또는 조건 해소, 사용자 준비 runner·개발자 모드·잠금 해제, 무DB/무네트워크 harness, 알림 차단, 소유권/관측/원장 최소 안전층 | harness에서 3점·scroll·type과 사후 변화 확인. 불가하면 M1 조회 전용 경로만 허용 |
| M1 진단 MVP | M0a 결론 문서화, 정책/패키지/CI 기본 계약 | 포장·진단·실행·허용 조회, 재부팅/재연결 실패 시험. native input 미검증 상태는 유지 |
| M2 입력 MVP | M0b·M1 통과, broker/영속 원장/환경 게이트/출력 동의/runner 자산 검증, 격리 테스트 DB | 전체 입력 도구와 실패 시험 구현·통과 |
| M3 복구·보안 | M2의 단위·계약/기본 장치 시험 통과 | 독립 프로세스·강제 종료·UNKNOWN·privacy 회귀 시험. 다른 프로세스 영향/중복 입력 0건 |
| M4 제품 검수 연동 | M3 통과, 테스트 데이터·검수 시나리오 확정, 계측 릴리스 제외 게이트 | 식재료·메뉴 테스트 흐름, 웹/Android/iOS 릴리스 제외 증거, 필수 검수 지적 해소 |

M0에서 runner 설치·서명·개발자 승인 등이 필요하면 명시적으로 보고한다. 자동 인증서 생성·외부 바이너리 다운로드로 우회하지 않는다. M1이 완료돼도 M2 없이 ‘아이폰 조작 완료’라고 보고하지 않는다. 일정은 M0 결과 후 산정한다.

M0b 최소 안전층에도 §5–7의 권한·privacy·미해결 동작 보호가 적용된다. spike 스크립트는 출하 패키지에 포함하지 않는다. M1 조회 전용 완성과 M4 조작 제품 완성은 별도 결과이며, 전자를 후자로 대체하지 않는다.

자동 입력 시험 중 사용자는 기기를 동시에 조작하지 않도록 안내한다. 예상하지 않은 물리 입력/화면 revision 변화가 관측되면 해당 trial 증거를 무효화하고 입력을 중단한다. 물리 터치의 부재 자체를 앱 계측만으로 완벽하게 증명한다고 주장하지 않는다.

## 9. 필수 시험

| 시험 | 기대 결과 |
|---|---|
| 앱 실행·3개 테스트 버튼·스크롤·텍스트 입력 | 실제 입력과 예상 상태 변화 각각 증거 확보 |
| 전송 전/후 케이블 분리·서버 timeout·재부팅 | 전송 전 거부와 전송 후 결과 불명 구분, 자동 중복 입력 없음 |
| 잘못된 기기·다른 앱·확인 불가 환경 | 입력 거부 |
| 회전·해상도/배율 변경·키보드 표시·오래된 화면 | 이전 좌표 거부, 새 관측 요구 |
| selector 중복/없음·검은 캡처 | 추측 클릭 금지 |
| 두 채팅의 동시 입력·만료 lease | 한 소유자만 허용, 기존 입력 임의 재생 금지 |
| 이미 쓰는 포트·PID 재사용 | 다른 프로세스에 영향 없음 |
| URL/경로/명령 인젝션·화면 속 지시문 | allowlist·스키마·권한 경계로 거부 |
| 로그/검수 패킷 검사 | ID·토큰·입력 원문·DB 덤프 제외 |
| 저장 버튼 timeout | 서버 성공을 추정하지 않음, 관측 후 별도 판단 |
| 독립 stdio 프로세스 2개·broker 강제 종료·abandoned mutex | 1개 소유자만 전송, 새 소유자는 원장/잔여 helper 복구 전 입력 금지 |
| UNKNOWN 뒤 재연결·새 action ID·원장 분실 | 과거 세대 상태 조회, 새 입력 차단, 분실 시 자동 초기화 금지 |
| 테스트/운영 ref/환경 응답 누락 모의 | 테스트만 허용, 운영 ref는 실네트워크 요청 전 BLOCKED |
| 비허용 앱·전경 확인 불가·알림 오버레이 | 캡처/AX 내용 반환과 입력 모두 거부 |
| 기본/opt-in 출력·보안/동적 AX 값 | 기본 이미지 0바이트, 범위 밖 본문 반환 없음 |
| runner 만료·판독 불가·기기 결속 불일치 | 입력 차단, 만료 반복 재시도 0회 |
| userspace/승격 필요/두 tunnel 제공자 | 실제 선택 경로에 맞는 진단, 무단 승격/중복 터널 없음 |
| observation 교차·축소/레터박스·animation·전송 직전 전경 변경 | 좌표 거부, 사전 확인 timeout은 REJECTED |
| 한글 SET_VALUE/KEYSTROKE·보안/OTP 필드 | 앱 상태 2차 확인, 금지 필드는 전송 안 함 |
| PC 재부팅·아이폰 BFU·앱 재시작 | 각각 별도 복구, BFU 후보에서 무조건 재페어링 요구 안 함 |
| 다른 USB 포트·다른 기기·별칭 매핑 손실 | 같은 기기만 동일성 유지, 다른 기기로 lease 승계 안 함 |
| 단계별 전제 하나씩 누락 | 해당 단계만 착수 거부, 조회 조사까지 불필요하게 막지 않음 |
| 고의 실패 plugin test·오염된 릴리스 import | 필수 CI 실패·설치/배포 후보 제외 |
| MCP 사람 승인 플래그·가짜 증거·승인 nonce 재사용/만료 | schema/출처 검사에서 거부. broker 확인 UI의 실제 영수증만 해당 범위 허용 |
| 같은 native shell + 다른 Metro JS/OTA/내장 bundle 해시 누락 | TEST_VERIFIED 부여 안 함, 변경 입력 거부 |
| 동일 앱의 다른 기기/시뮬레이터·LAN 환경 응답·오래된 launch nonce | 기기/instance 결속 불일치로 입력 거부 |
| 60초 터널 대기와 30초 lease·동시 취소 | heartbeat는 별도 동작, 클라이언트 소실 후 새 입력 차단 |
| 시험 중 물리 터치·외부 화면 revision 변경 | trial 증거 무효, 이전 좌표 사용 금지 |

모의 adapter 시험은 실제 기기 시험을 대신하지 않는다. 실제 시험은 격리된 테스트 앱/테스트 데이터에서 수행한다. 프로젝트 전체 배포·접근성 검수 완료를 이 플러그인의 시험만으로 선언하지 않는다.

## 10. Fable 검수 요청

검수 대상은 이 기획의 실현 가능성·권한·중복 입력·증거·개인정보·복구 설계다. 코드 실행이나 기기 조작을 요청하지 않는다.

중점 질문:

1. Windows 기존 도구 재사용과 WDA/대안의 준비 조건을 과장한 부분이 있는가?
2. 입력 요청 성공과 실제 화면/서버 결과를 충분히 구분했는가?
3. 관측 결속·lease·전송 결과 불명 처리에 오조작/중복 위험이 남는가?
4. 앱/DB 환경 검증과 개인정보 보호가 실행 가능한 계약인가?
5. M0 실패 시 조회 전용 MVP로 한정하는 기준과 필수 시험에 누락이 있는가?

현재 경로는 사용자가 지정한 ‘아이폰 조작 플러그인’ Claude Cowork 채팅 자문이다. v1 해시 `239ae40e9768a41a0b2c49167a5e601d6693be22e21fda7dacf28df6392c158a`에 대한 CHANGES_REQUIRED(필수 16·선택 8)를 수신했고 v2에 보완했다. 채팅 출처/대상 해시/지적/처리 근거를 증거에 남기며 CLI 공식 회차로 위장하지 않는다. 검수에 나온 기술 주장도 자체 근거 확인 후 수용한다.

향후 공식 CLI 사용 시 예정 task `IPHONE-CONTROL-DESIGN-001`, R2, SOLAR-ARCH/FABLE-ARCH, MANDATORY_MUTUAL, INITIAL, 문서 `WORKING_TREE_HASHED`, 최소 snapshot의 single-pass를 제안한다. 실제 schema/권위는 `docs/ai-review/README.md`와 실행기이며, task의 기준 commit·AGENTS·artifact hash 일치 확인이 선행된다. 결과 어휘는 PASS/CHANGES_REQUIRED/DISPUTED/BLOCKED다. US$2.00은 제안 소프트캡으로 실제 과금 상한 보장이 아니다. `soft_budget_overrun_risk_accepted: r001@2.00` 형식의 정확한 실제 사람 결정을 받기 전 CLI 호출하지 않고 승인 문구를 추정 생성하지 않는다. 브라우저 채팅 요청은 이 CLI 비용 승인이나 공식 운영 gate 승계가 아니다.

## 11. 기술 참고

- [go-ios CLI 원문](https://github.com/danielpaulus/go-ios/blob/main/main.go): `ui run`의 WDA/DeviceKit 실행·포트 전달 경로. 명령 존재가 로컬 runner 준비 완료를 뜻하지 않는다. upstream main과 설치 버전은 구현 때 대조한다.
- [go-ios 프로젝트](https://github.com/danielpaulus/go-ios): 플랫폼 지원과 기능 범위 참고. 현재 기기에서의 성공은 별도 시험한다.
- [pymobiledevice3 iOS 17+ 터널 안내](https://github.com/doronz88/pymobiledevice3/blob/master/docs/guides/ios17-tunnels.md): iOS 버전에 따른 연결 절차의 차이를 adapter 진단에 반영한다.
- [pymobiledevice3 문제 해결](https://doronz88.github.io/pymobiledevice3/guides/troubleshooting/): Windows 기기 지원 구성 점검 참고. 자동 설치 권한으로 해석하지 않는다.
- [Appium XCUITest 설정](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/capabilities.md): 실제 기기 서명/실행 구성 참고. Windows 단독 신규 서명 가능성을 보장하지 않는다.
- 내부 권위: `AGENTS.md`, `docs/ai-review/README.md`. 기존 관측의 비식별 요약은 `docs/ai-review/evidence/IPHONE-CONTROL-DESIGN-BASELINE-20260912.md`.

### 11.1 1차 검수 권고의 기술적 보정

- iOS 17+가 항상 Windows 승격/TUN을 요구한다고 단정하지 않는다. 위 pymobiledevice3 문서는 iOS 17.4+ userspace와 구버전/공유 kernel tunnel 경로를 구분한다. 설치 판본에 똑같이 적용된다는 뜻은 아니므로 M0에서 고정한다.
- go-ios upstream CLI에는 기존 P12/profile을 이용하는 `ui install` 경로가 있다. 신규 runner 빌드, 재서명, 기기 설치를 구분하며 'Windows는 미리 서명된 파일만 가능'으로 단정하지 않는다. 이 프로젝트는 자동 서명/설치를 제공하지 않고 사용자 준비 자산만 검증한다.
- abandoned mutex는 잠금 획득 가능과 공유 상태 정상 여부가 다르다. [Microsoft 문서](https://learn.microsoft.com/en-us/windows/win32/sync/using-mutex-objects)에 따라 정상 승계가 아니라 복구 필요로 취급한다.
- 여러 device API의 동시 원자 snapshot을 약속하지 않는다. §5.2의 제한된 일관성 검사와 잔여 경쟁 설명을 적용한다. '정수배만 맞으면 정확하다'는 검증도 사용하지 않는다.

## 12. 개발 작업 분해와 인수 기준

| 작업 | 산출물 | 의존·검수 |
|---|---|---|
| W01 계약·M0a | typed schema, capability/버전 매트릭스, 실제 준비 조건 | 기획 채팅 지적 해소 후 구현 승인. 조회 결과의 미검증 표시 |
| W02 broker/원장 | named mutex/pipe, ACL, lease/fencing, 내구 원장·복구 | W01, 독립 프로세스/강제 종료 시험 |
| W03 adapters/M0b | pinned adapter, runner/tunnel 진단, 무DB harness | W02 최소 안전층, native 입력 사후 증거 |
| W04 MCP/M1 | 표준 plugin manifest, 도구 응답/권한/출력 필터 | W01–02, 스키마·패키지 validator |
| W05 환경·M2 | dev-only 환경 endpoint·request allowlist·입력 계약 | W03–04, 모의 운영 ref 차단·테스트 DB 검산 |
| W06 복구·M3 | 중단/UNKNOWN/민감정보/프로세스 소유 시험 | W05, 기기/PC/앱 재시작 각각 검증 |
| W07 검수·M4 | 도메인 테스트 증거·release exclusion·설치 rollback 안내 | W06, 정확한 SHA CI·필수 Finding 해소 |

계획 담당은 Codex 작성·Claude 채팅 자문, 구현 담당은 후속 승인된 작업, 기기 잠금/신뢰/서명 준비 담당은 사용자다. 구현자는 작업마다 소스 SHA·도구/앱 판본·시험 명령/결과·실행하지 못한 시험을 인계한다. 별도 구현 작업 생성/설치/운영 승인은 이번 기획 완성 요청에서 추정하지 않는다.

설치 패키지는 CI 통과 SHA·내용 해시를 확인하고 사용자 범위에만 등록한다. 초기 버전은 background 자동 시작/hook 없이 명시적 MCP 사용 시 기동한다. 업데이트는 활성 lease/UNKNOWN이 없을 때만 하고, broker 종료·패키지 교체·schema 호환 확인 후 재시작한다. downgrade가 새 원장을 읽지 못하면 거부하며 원장을 삭제하지 않는다. 제거 시 기기 세션과 소유 helper를 정상 해제하고 비밀/원장 보존 또는 삭제 범위를 사용자에게 확인한다.

기획 완료는 계약과 필수 시험이 정의되고 채팅 재검수의 필수 지적이 해소된 상태다. 구현 완료·실기 성공·공식 CLI 검수/운영 승인과 분리한다. M0에서 확정할 OS/iOS/서명/adapter 가능성은 계획의 명시적 조사 과제이며 검증된 사실로 채우지 않는다.

### 12.1 최종 구현 해석과 선택 개선

1. **번들 해시(O-1)**: §6.1의 런타임 bundle 확인값은 빌드 시 주입한 build ID·소스 SHA·내장 bundle 식별값이다. bundle이 자기 내용 해시 문자열을 포함해야 한다는 뜻이 아니다. native/JS 내용 해시는 배포 artifact(IPA)의 실제 bytes에서 계산해 별도 manifest에 기록한다. 설치 artifact의 식별과 런타임 build/bundle ID의 결속을 확인하고, 이를 입증하지 못하면 UNVERIFIED다. 런타임 자기보고만으로 임의 설치물을 신뢰하지 않는다.
2. **진행 중 명령 종료(O-2)**: §6.1의 lease 재할당 및 §6.2의 미해결 입력 차단 해제 전에는 해당 command의 backend terminal 상태 또는 확인된 기기 재부팅 등으로 이후 기기 입력이 발생할 수 없음을 확인해야 한다. PC helper 종료만으로 기기 측 XCTest/runner 명령까지 끝났다고 추정하지 않는다. 종료/취소 확인 불가면 차단을 유지한다. 기기 입력 종료 확인도 서버 저장 결과의 APPLIED/NOT_APPLIED를 증명하지 않으므로 UNKNOWN 해소는 별도로 수행한다.
3. **승인 UI 부재(O-3)**: 대화형 사용자 데스크톱이 없는 서비스/원격 컨텍스트에서는 새 승인 발행이 불가하다. 자동 승인·CLI 우회·다른 사용자 세션으로 대체하지 않고 APPROVAL_UI_UNAVAILABLE로 반환한다. 이미 유효한 허용 범위가 없는 작업은 실행하지 않는다.
4. **정적 라벨 출처(O-4)**: §7의 AX_LABELS allowlist는 테스트 빌드 소스의 정적 리소스에서 빌드 시 생성하고 element ID·정적 문자열·locale·build ID 및 내용 해시를 manifest에 결속한다. 동적 이름/메모/서버 데이터는 포함하지 않으며, allowlist 누락·불일치는 텍스트를 반환하지 않는다.
5. **CLI 계약(O-5)**: 2026-09-12 로컬 `scripts/fable-review.mjs`의 REVIEW_MODES에 INITIAL, validateTask route에 MANDATORY_MUTUAL, snapshot enum에 WORKING_TREE_HASHED가 있음을 확인했다. `docs/ai-review/templates/task-v12-primary.example.json`의 역할 조합도 대조했다. 이 확인은 task 실행/검수 승인이 아니며 실제 CLI 실행 전 현재 schema로 재검증한다.

추가 시험: 자기참조 해시 없이 IPA/런타임 결속 검사, helper만 종료하고 기기 command가 남은 모의에서 차단 유지, 승인 UI 부재 시 신규 허용 거부, 동적 문자열/다른 build의 정적 라벨에서 본문 반환 없음. 이들은 W01/W05/W06의 구현 시험에 포함한다.
