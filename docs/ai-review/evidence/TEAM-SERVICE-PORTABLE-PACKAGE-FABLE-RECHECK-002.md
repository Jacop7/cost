# 휴대형 AI 팀 서비스 설계 Fable 재검수 002

## 결속

- 후보: `TEAM-SERVICE-PORTABLE-PACKAGE-RECHECK-CANDIDATE-002.json`
- 후보 SHA-256: `bc7421f4b18d3875ae0bc16029a4b6b836f30523a83bb7b15bcd00220c2f4ca0`
- 대상 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 입력 pin: 6/6 실측 일치(Fable 보고)
- 성격: direct Fable Cowork 자문, formal CLI receipt 아님

## 판정

- `overall_verdict`: `CHANGES_REQUIRED`
- `rebuild_blueprint_sufficient`: `NO`
- `ready_for_separate_implementation_admission`: `NO`

## 차단

1. `R-1`: tier를 봉인했지만 activation 검증기와 Router policy/receipt 대조라는 집행 지점이 부족하다.
2. `R-2`: 유실 재제작 입력인 schema 4종, 전체 기본 profile edge 요구, canonical/receipt/harness golden vector가 실제 파일로 필요하다.
3. `R-3`: dependency별 실제 소비 artifact, schema selector, 검증 방식이 계약에 없다.

## 조건과 비차단 보강

- 무발송 harness를 denylist가 아닌 builtin allowlist와 fs deny stub으로 정의하고 target 내부 금지 호출
  음성 fixture를 추가한다.
- edge 요구 집합은 project profile이 소유하고 profile↔manifest↔Router policy를 삼자 대조한다.
- install receipt는 `previous_receipt_sha256`으로 append-only update chain을 만든다.
- activation envelope에 단일 current epoch의 expected-epoch CAS를 추가한다.
- Node/Python 범위, 추적 정책, runtime ACL 음성 AT-16, tier 결정성 AT-17을 추가한다.
- bootstrap의 activation 명령은 envelope 준비·검증만 하고 실제 스위치는 Team Router가 소유한다.

## 반영

위 finding을 아키텍처·재제작·운영 문서와 machine contract에 반영하고 다음 실제 재제작 입력을 추가한
뒤 3차 exact 후보로 재검수한다.

- `schemas/project-profile.schema.json`
- `schemas/capability-policy.schema.json`
- `schemas/install-receipt.schema.json`
- `schemas/generated-files.schema.json`
- `profiles/default-11-role-profile.json`
- `golden/portable-v1-vectors.json`

