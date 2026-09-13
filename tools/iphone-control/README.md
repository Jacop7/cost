# iPhone Control — W01 개발 기반

권위: [개발 기획안](../../docs/아이폰-조작-MCP-플러그인-개발-기획안.md).
현재는 **로컬 읽기 진단과 계약 시험**이다. MCP 서버·broker·기기 터치·캡처·설치는 아직 제공하지 않는다.
이 폴더가 소스 책임 경계이며 제품 Expo/DB 코드를 변경하지 않는다.

## 실행

저장소 루트에서:

```powershell
node tools/iphone-control/scripts/diagnose.mjs
node --test tools/iphone-control/tests/diagnostics.test.mjs
node node_modules/typescript/bin/tsc --project tools/iphone-control/tsconfig.json
```

진단은 Windows 사용자 `LOCALAPPDATA/CodexTools/go-ios/v1.3.2/ios.exe`의 해시를 먼저 확인하고
`version`, `list`만 실행한다. 각 호출 제한 10초·최대 출력 64KiB·자동 재시도 0회다.
명령행 인자·임의 executable 옵션은 CLI에서 받지 않는다. 호스트 LOCALAPPDATA 기준 고정 상대경로이며
그 환경값이 달라져도 실행파일 해시 불일치 시 차단한다. 명시적 외부 네트워크 서비스 호출,
터널 생성, 신뢰 승인, 서명, 설치, 앱 실행, 화면 조회, 기기 입력은 하지 않는다.

출력은 개수·버전·상태뿐이다. UDID·기기 이름·CLI stderr/오류 원문을 반환하지 않는다.
`NO_DEVICE`는 usbmux 열거 결과 0대이며, iOS 지원 불가나 드라이버 고장이라고 단정하지 않는다.
열거 결과가 USB 연결만을 뜻하지는 않으며 Wi-Fi 페어링/연결 방식 분류는 후속 작업이다.
기기를 찾더라도 control은 BLOCKED, 캡처/AX/환경은 UNVERIFIED를 유지한다.
소스 내부 시험용 의존 주입은 MCP 인자/사용자 권한 발행 경로가 아니다.

## 경로

- `src/contracts.ts`: 기능별 상태/진단 응답 타입.
- `src/diagnostics.mjs`: 고정 read-only adapter와 비내용 출력 필터.
- `scripts/diagnose.mjs`: 개발자용 M0a CLI. gateway가 아니다.
- `tests/diagnostics.test.mjs`: 오탐·민감정보·잘못된 도구·실패·주입 방어 시험.
- `plugin/iphone-control/.codex-plugin/plugin.json`: **미출하 scaffold**.
  기획의 `plugin/` 아래 실제 패키지 디렉터리 이름을 manifest 이름과 같은 `iphone-control`로 구체화했다.
  W02 broker 전까지 MCP 설정/서버를 등록하지 않는다. 사용자 marketplace도 아직 변경하지 않았다.

## 남은 작업

W01: 연결 기기 iOS/서명/USB loopback 가능성, 문서 그래프 등록·독립검수.
W02: 사용자별 Windows broker, ACL/mutex/lease, 내구 원장.
그 뒤 W03–W07은 기획 순서대로 수행한다. 현재 시험 통과는 M1/M2 완료나 실기 조작 성공이 아니다.
기본 실행파일 hash 확인은 실수/판본 불일치 탐지이며 동일 사용자 악성 교체에 대한 보안 증명은 아니다.
현재 pin은 기존 설치본의 로컬 관측 해시다. upstream 서명/릴리스 체크섬에 의한 출처 검증은 아직 하지 않았다.
골든 fixture는 2026-09-12 관측한 비민감 version·빈 deviceList JSON이며 연결 기기 출력 계약 검증은 미완료다.
