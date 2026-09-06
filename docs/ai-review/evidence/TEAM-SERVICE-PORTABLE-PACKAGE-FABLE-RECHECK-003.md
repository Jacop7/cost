# 휴대형 AI 팀 서비스 설계 Fable 재검수 003

## 결속과 판정

- 후보: `TEAM-SERVICE-PORTABLE-PACKAGE-RECHECK-CANDIDATE-003.json`
- 후보 SHA-256: `20556698a05e7c20ac227b0323b8e4e95cac504e0aff54a8f3b980c65efe9a24`
- 입력 pin: 12/12 실측 일치(Fable 보고)
- 판정: `CHANGES_REQUIRED`
- `rebuild_blueprint_sufficient`: `NO` — G-1 정정 후 YES 가능
- `ready_for_separate_implementation_admission`: `NO` — G-1/G-2 정정 후 YES 가능
- 성격: direct Fable Cowork 자문, formal CLI receipt나 구현·설치·발송 승인이 아님

## 통과

- tier 집행 지점, Router cross-check, sealed tier와 expected epoch CAS
- dependency별 consumes 계약
- profile 소유 edge 요구와 profile↔manifest↔Router 삼자 대조
- AT-16/17과 추적/runtime 분리
- 기존 플러그인 소유권 비중복

## 남은 차단

1. `G-1`: golden canonical key 순서가 기존 참조 구현의 ECMAScript UTF-16 code-unit 순서가 아니라
   locale 순서로 작성됐다. 정렬 규칙 명문화, 벡터 수정, astral 벡터, 참조 구현 실행형 검사가 필요하다.
2. `G-2`: 무발송 음성 벡터 계수는 기존 AC-24 어휘인 `normal_dispatch_attempts=0`,
   `negative_fake_attempts>0`, `actual_provider_calls=0`을 사용해야 한다.

## 비차단 보강

schema-valid 전체 install receipt, dependency-free selector/`$ref` 검사, drive/UNC/backslash 거부,
Mission Relay symbolic artifact 경로 패턴, Quality peer consultation의 비권한 의미,
production `VERIFIED_STATUS` 비대칭 설명을 권고했다.

위 항목은 다음 후보에서 함께 반영한다.

