# iPhone Control W01 / M0a 시작 증거

날짜: 2026-09-12. 기준 HEAD: `38d91a9c730a3bbd1264ebe5d48f010ef00751fa`.
권위 루트의 기존 다른 작업 변경은 보존했다. 이 보고서는 기획 v4 이후 사용자 구현 진행 요청에 따른다.
공식 기획 SHA-256: `18c27260d937debfce95516cddd723db5782096399e61bb30b03b61a405332d2`.
모델 계획은 Codex가 CLI로 자체 검증 후 W01 단계만 추가·봉인: `356061155d94a121a2471ba7579e3ae713b07cfa35ee6a2578c43b5ebf387ff9`.
Claude 기획 PASS는 `47035f13…`에 결속돼 있다. 현재 기획 `18c27260…`은 절 참조 표기만
정정한 후속본이며 별도 채팅 재검수 해시가 아니다. 상세는 기획 검수 처리표에 보존했다.
새 외부 유료 호출·계정 변경·앱/DB 변경·설치·서명·터널 생성은 하지 않았다.

## 실제 읽기 관측

| 항목 | 관측 | 한계/다음 조건 |
|---|---|---|
| Windows | Windows 11 Pro / 10.0.26200 | 현재 호스트 |
| Node | 24.15.0 | 다른 지원 판본은 CI 필요 |
| Python 기본 | 3.13.14 | 기본 interpreter에는 pymobiledevice3 없음 |
| 기존 AX 가상환경 | pymobiledevice3 11.12.4 | 패키지 metadata만 확인, 전체 CLI/기기 동작 통과 아님 |
| go-ios | 1.3.2 | SHA-256 `c99b04f1d615fa716637efae457d5c554f32259f9d249375de0086e3cc1a1df5` |
| 기기 열거 | 성공, `deviceList` 0개 | 연결/드라이버/신뢰 중 원인 미확정; iOS 버전 읽기 불가 |
| runner/서명 | UNVERIFIED | 현재 연결 기기와 사용자 준비 runner 자산 확인 필요 |
| USB loopback 환경 endpoint | UNVERIFIED | 전용 테스트 빌드와 선택 기기 연결 후 실제 도달 경로 확인 |
| 실제 입력 | BLOCKED | broker와 최소 안전층·runner·환경 확인 미완료 |

M0a 전체 완료가 아니다. 설치된 도구로 메타데이터 진단은 가능하지만 실기 전제는 미확인이다.
옛 기록의 기기 ID/PID/포트/서버 주소는 재사용하지 않았으며 이 문서에 복사하지 않았다.
CodexTools 하위 파일명 조사에서는 IPA/runner/DeviceKit/WebDriver/mobileprovision/p12 자산을
찾지 못했다. 다른 위치와 기기 내 설치 여부까지 전수 확인한 결과는 아니다.
go-ios pin은 기존 설치본 drift 탐지용 관측 해시이며 upstream 서명/릴리스 체크섬 출처 검증은 미완료다.

## 구현된 범위

- `tools/iphone-control/src/contracts.ts`: 진단 typed contract.
- `src/diagnostics.mjs` + `scripts/diagnose.mjs`: 개발자용 읽기 진단, version/list 고정 명령만 실행.
- 실행 전/명령 사이/종료 후 binary 해시 비교, 각 실행 10초·64KiB·재시도0·shell 비사용.
- 출력 projection: 고유 ID/기기 이름/CLI stderr·원오류 미반환, proxy/agent/Node/Python 주입 환경 미승계.
- 기기 발견과 제어·캡처·AX·환경 준비 상태 분리. MCP gateway는 아직 없다.
- plugin-creator로 `tools/iphone-control/plugin/iphone-control` scaffold 생성. 폴더/name 일치.
  서버/skills/hooks/capability를 허위 등록하지 않았고 marketplace·설치본은 변경하지 않았다.
- verify ③ Docker 없는 필수 검사에 단위 시험·typecheck 추가.

## 로컬 검증

- `node --test tools/iphone-control/tests/diagnostics.test.mjs`: 27/27 PASS.
- `node --test scripts/verify-contracts.test.mjs`: 7/7 PASS. 플러그인 unit/type 실패를
  주입하면 전체 계약 단계가 실패하는 회귀시험 포함. 두 스위트 통합 34/34 PASS.
- `node node_modules/typescript/bin/tsc --project tools/iphone-control/tsconfig.json`: exit0.
- plugin-creator `validate_plugin.py tools/iphone-control/plugin/iphone-control`: PASS.
- `node tools/iphone-control/scripts/diagnose.mjs`: discovery READY/NO_DEVICE/0, control BLOCKED,
  capture/AX/environment UNVERIFIED, METADATA_ONLY. 이는 실기 제어 성공이 아니다.

미완료: 문서 그래프/AGENTS 책임표 등록, full verify/정확 SHA CI, 코드 독립검수,
실기 M0a·M0b, W02 broker부터 W07까지. 기획 PASS를 구현 PASS로 승계하지 않는다.

## 코드 채팅 자문 요청

사용자가 지정한 기존 ‘아이폰 조작 플러그인’ Claude Cowork 채팅에 W01 제한범위 읽기 검수를
전송했고 작업 중 UI를 확인했다. 공식 CLI 회차가 아니며 응답 전 PASS라고 판단하지 않는다.
검수 대상 초기 hash:

- diagnostics.mjs: `a58d0acb9163f4ceffd3eab878a074929d99b0123840605d86fe2b45b8971e45`
- contracts.ts: `4b578b8619316f21240e0cbd357870cbfbc3def7f97acf56a79ca8a1ff9d190d`
- diagnostics.test.mjs: `c863fab98512d088f80b3477129366b7f6b508e197f57ab8d38a9dc070671318`

원시 대화/기기 식별자를 공식 장부에 복사하지 않는다.

## 1차 코드 자문과 반영

Claude 응답: **W01 제한범위 PASS(코드 자문), 필수0·선택6**. 위 초기 hash3개 일치를 확인했고
원문 읽기만 수행했다. 테스트 실행은 Codex 증거이며 Claude가 재실행한 결과가 아니다.

| 선택 | 처리 |
|---|---|
| S-1 실제 출력 fixture | 비민감 version/빈 목록 실제 JSON 2개 추가, golden 시험 추가. 연결 기기 출력은 미검증 유지 |
| S-2 중간 hash 읽기 실패 | 별도 catch로 TOOL_CHANGED/BLOCKED, 2·3번째 hash throw 시험 추가 |
| S-3 pin 출처 | 로컬 관측 해시이고 upstream 출처 미검증임을 README/본 문서에 명시 |
| S-4 경로 표현 | LOCALAPPDATA 기준 고정 상대경로+hash 차단으로 정확히 표현 |
| S-5 판본 출처 | Codex 자체 모델계획 검증과 Claude 기획 PASS 대상 해시를 구분 |
| S-6 표현/중복 | 출력은 PIN.version 참조, TypeScript의 허용 버전 literal은 닫힌 계약으로 유지. 미출하 prompt 명시·USB 한정 아님 명시 |

보완 후 로컬: plugin30+게이트7 = **37/37 PASS**, typecheck exit0, plugin validator PASS.
실제 diagnose 재실행도 NO_DEVICE/0이며 입력 BLOCKED 유지.
기존 문서 그래프 검사도 PASS(40파일), 단 새 플러그인의 그래프 등록 완료를 뜻하지 않는다.

보완 후 hash: diagnostics `2ba510a234ccf21c992b668ef781f3d0d03c28e0766ca57cbf3377f7798e25e3`,
tests `b402e2428a6260a4cd394d06c6cb30b26ac2fcc0f653acb4aa636e50c6fc1d58`.
보완본 채팅 재검수는 별도로 확인하며 초기 PASS를 자동 승계하지 않는다.

## 보완본 재검수 결과

Claude가 보완 후 diagnostics/tests hash 일치를 확인하고 **W01 제한범위 PASS 유지,
열린 필수0·선택0**으로 응답했다. S-1~6 및 필수게이트 회귀시험 변경분을 읽기 검수했다.
코드·패키지·문서만 확인한 채팅 자문이며 실기/테스트 재실행/공식 CLI/운영 gate 승인이 아니다.

다음 안전 작업: W01 문서 책임/그래프 정렬과 W02 Windows broker 계약 구현.
실기 M0a 재개에는 기기 열거 성공이 필요하며, 0대 상태로 iOS/runner/USB 경로 완료를 선언하지 않는다.
