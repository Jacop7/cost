# 서비스 총괄 라우팅 — Codex 1차 최종 결과

확정 시각: 2026-09-05 15:23 KST. 요청: Codex 1차 전체 시험 → Opus 2차 1회 검수.
검사 기준 HEAD: `6497666e655609a4f4bfe10bfaea6070dad01286`, 기존 미커밋 공유 작업본 포함.
판정: **1차 실행 완료 / 전체 게이트 FAIL / 실제 팀 자동 운영 미검증 / Opus 2차 미완료**.

이 문서는 Opus 요청 이후 완료된 시험 결과의 추가 기록이다. 당시 입력인
`TEAM-SERVICE-CODEX-TEST-001.md`, Opus 입력 스냅샷과 실행 원본은 변경하지 않았다.
아래 최종 결과가 Opus 검수를 받았다고 해석하지 않는다.

## 전체 실행 결과

`corepack pnpm verify`는 여섯 단계를 실행한 뒤 exit 1로 종료했다.

| 단계 | 결과 | 실행 시간 |
| --- | --- | --- |
| ① 타입 | PASS | 5.7초 |
| ② 시험 | FAIL: 기존 개발 DB 43/50 | 17.8초 |
| ③ CLI 계약·ACL 보안·색 대비·문서 그래프 | FAIL: setup-doctor에서 단락 | 8.4초 |
| ④ 새 DB 전체 migration·시험 | PASS | 134.7초 |
| ⑤ 업그레이드 경로 | PASS: 23/23 | 1837.1초 |
| ⑥ 웹 번들 | PASS | 7.3초 |

4/6 단계 통과이며 전체 PASS가 아니다. 별도 재실행 결과를 합쳐 실패 단계를 PASS로 바꾸지 않는다.

### 독립적으로 확인한 세부 결과

- core: 194 통과, live DB parity 조건부 12개 건너뜀. mobile: 233/233 통과.
- 새 일회용 DB SQL: 50/50. 새 DB ACL: metric 22 / mobile RPC 73 / 비-mobile 예외 2 계약 통과.
- 새 DB 두 세션 경합: 실제 잠금·마감 직렬화·원장 합계 통과. live locale parity: 13/13.
- 업그레이드: 23/23. 과거 원장·세액 보존, 권한, 중간 버전 호환성, CRLF 전진 경로 포함.
- 웹 번들: Metro export 성공, 번들 1개 생성. 실제 사용자 환경의 UI/E2E 시험을 대신하지 않는다.
- 라우팅 workflow·요구 감사·문서 그래프 node 시험: 42/42.
- Team Router Python 시험: 38/38.
- Fable 실행기 자체 시험: 52개 묶음, protocol 1.2 fallback 계약 22/22. 외부 Fable 호출은 없음.
- CLI 고정 계약, deploy guard 21/21, ACL source scan 13/13, CI 계약, protected gate 18/18,
  ruleset 선언, 운영 모니터링 계약, 실제 문서 그래프, ACL shell 보안 회귀시험: 별도 실행 PASS.
- setup-doctor 시험 7/7. 최초 실제 진단 실패 후 동일 진입점 재검사는 READY_LOCAL,
  PASS 15 / WARN 4 / FAIL 0. Supabase CLI 2.116.0 확인. 최초 실패 원인은 재현되지 않음.
- 색 대비 검사 별도 실행 FAIL: 결정 commit 3개가 현재 HEAD의 조상이 아닌 provenance 오류.

새 DB와 업그레이드 임시 DB는 시험 종료 후 정리됐다. 로컬 pg_database 읽기 전용 확인에서도
이번 실행의 두 임시 DB가 남지 않았음을 확인했다. 기존 개발 DB reset·원격 DB 적용·배포는 하지 않았다.

## 남은 실패와 구현 결함

1. 기존 개발 DB 7개 실패는 동일 명령 재실행에서도 재현됐다. legacy 기대 순이익 4046.69와
   현재 확정 4046.60 차이, 기타매출 채널 요구, 판매 fixture 전제 차이가 포함된다.
   fresh DB 50/50과 대비되므로 기존 DB 상태 차이가 원인 후보이며 제품 계산식을 되돌릴 근거가 아니다.
2. setup-doctor 최초 실패는 재현되지 않았다. 색 대비 provenance 오류와는 별개다.
   결정 commit `f351058f30aa`, `9ffba3176f11`, `0d9f437782d6` 기준선 확인이 필요하다.
3. C1: workflow가 배열 taskId를 정규식 문자열 강제 변환으로 허용한다. 문자열 타입 검사가 필요하다.
4. C2: 동일 event의 JSON 키 순서만 바뀌어도 EVENT_ID_CONFLICT다. canonical 직렬화가 필요하다.

C1/C2는 직접 재현했으나 이번 시험·검수에서 기능 코드를 수정하지 않았다.
반례와 개발 DB 실패 목록은 `TEAM-SERVICE-CODEX-TEST-001.md`에 보존했다.

## 서비스 준비도

정책/manifest 검사 자체는 POLICY_VALID / ACTIVE_DISPATCH, 11 chats / 21 edges다.
그러나 새 조직 요구 감사는 REQUIREMENTS_NOT_MET다. CEO 직접 지시·결과 반환, 팀 간 협업,
상황실 공유, 전 역할의 사람 보고 등에 필요한 계약과 실행 연결이 남아 있다.

현재 workflow는 순수 상태 전이기다. 실제 전송 adapter, 실제 영수증 검증, 영구 outbox와
중단 후 복구가 연결되지 않았다. runtime 11 endpoint의 generation 1 / ACTIVE_INITIAL 표시는
successor 재결속 완료 증거가 아니다. 실제 채팅 왕복 메시지와 수신 ACK 파일럿을 실행하지 않았다.
따라서 **사람 → CEO → 서비스 총괄 → 팀 배정·보고가 자동 운영된다고 판정할 수 없다**.
상황실은 집계 역할이며 모든 배정의 필수 경유지로 강제하지 않는다.

## Opus 2차

사용자가 승인한 1회 / $2 soft cap·초과 위험 수용 조건으로 direct advisory를 호출했다.
240초 ETIMEDOUT, stdout/stderr 없음. 실제 모델 attestation·사용량·비용·검수 판정을 받지 못했다.
로그인 상태는 정상으로 확인했지만 timeout의 상세 원인은 불명이다.
비용은 미상이며 $0 또는 실제 $2 지출로 단정하지 않는다. 자동 재시도하지 않았다.

상세: `TEAM-SERVICE-OPUS-001.md`, `TEAM-SERVICE-OPUS-001.run.json`,
`TEAM-SERVICE-OPUS-001.input-snapshot.json`. Opus/Fable 공식 독립검수 게이트를 종결하지 않는다.

## 소스 동일성

검사 후 다음 SHA-256이 Opus 요청 스냅샷과 동일함을 확인했다.

| 파일 | SHA-256 |
| --- | --- |
| scripts/team-service-workflow.mjs | 18b44c3dd7d424eaa6f9fc19f7b4fa857cfac3a72df1133e7c8e8d1afcd1beb2 |
| scripts/team-service-workflow.test.mjs | 5fe77519a584322d2619da7e0af379678e82bd5964dfffa03460dfe8b546659f |
| scripts/team-routing-contract-audit.mjs | 8f829b203c25297a6069205971caeebbbc97ccbff205615731ae0231dffac6a8 |
| scripts/team-routing-contract-audit.test.mjs | d819f32dc5bd92406db4f389d2e9bf719b7cfc1a8f57b5b700232617634bf201 |

공유 작업본의 타 작업 변경을 stash·commit·이동하지 않았다. 라우터 정책 봉인·endpoint 결속·
실제 채팅 발송·운영 환경을 이번 검증에서 변경하지 않았다.
