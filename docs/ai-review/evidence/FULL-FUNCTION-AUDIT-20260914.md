# 전체 기능 정의·연계 전수감사 — 2026-09-14

## 판정

첫 오픈 기능의 공식 범위와 검수 단위는 `docs/기능정의서.md` v2.1로 정리했다. 현재 문서는 기능 103개, 기능 간 연계 99개, 시나리오 334개, 상세 정의 103/103, 로컬 근거 링크 227개를 포함한다. 한국 초대형 파일럿 범위는 필수 94개, 공개 출시 후속 8개, 상위 집계 1개다.

기능 구현과 서버 계약은 분리 검증 기준으로 통과했다. 전체 `corepack pnpm verify`의 6/6 통과 판정은 아직 아니다. 필수로 남은 것은 clean exact commit에서 생성해야 하는 three-surface 결속 산출물 3개다. 네이티브 기기 캡처·터치 영수증·글자 확대 증빙 4종은 운영 지침에 따른 배포 비차단 미완료다.

## 이번 감사에서 고친 계약

- 고정 지출 기준은 대상 월을 제외한 직전 완료 1·2·3개월 중 설정값 N개월을 사용한다. 모든 월의 구성과 0보다 큰 계산용 매출이 있을 때만 `Σ고정 지출 ÷ Σ계산용 매출`을 적용한다. 월평균 합계와 키별 항목 평균도 같은 N개월을 사용하며 영업 시작 시 함께 동결한다.
- `fixed_cost_basis_result`가 `SECURITY DEFINER`로 실행되면서 서버 내부 호출에서 RLS가 기준 설정과 월별 입력을 가린 문제를 재현했다. 이 함수는 호출자 권한의 비공개 `SECURITY INVOKER`로 바꾸고 앱 역할 실행 권한을 회수했다. 앱 공개 조회 `get_fixed_cost_basis`의 서버 실행 권한은 유지했다.
- 설정 저장과 영업 종료의 동시 실행은 직전 완료 월 자료로 고정해 4개 순서 조합을 검증했다. 저장 선행과 종료 선행 모두 새 현재 기준을 반영하고 이미 종료된 영업일 기준과 추이는 한 번만 보존한다.
- 식재료 삭제가 먼저 성공한 뒤 뒤늦은 수정이 거절되는 경우, 삭제 감사 이벤트 한 건은 남는 현행 계약에 맞춰 경합 시험의 오래된 기대값을 바로잡았다. 제품 동작과 원장은 바꾸지 않았다.
- 현재 앱 소스에 맞춰 터치 감사 재고를 다시 산출했다. 선언상 미달 0, 형제 중첩 0이며 감사기 회귀시험 66/66이 통과했다. 사용자 작업 중인 고정지출 상세 화면 자체와 관련 보기 함수·화면 시험 파일은 수정하지 않았다.

## 검증 결과

| 구분 | 현재 결과 | 근거 |
| --- | --- | --- |
| 기능정의서 구조 | PASS — 기능 103, 연계 99, 시나리오 334, 상세 103/103, 링크 227 | `.codex/full-function-audit-20260914/definition-check-latest.json` |
| 타입 | PASS | `.codex/full-function-audit-20260914/verify-no-db-final.log` |
| core | PASS — 269, 제외 13 | 같은 로그 |
| mobile | PASS — 136파일 1,639, 제외 4 | 같은 로그 |
| 새 DB·DB 스위트 | PASS — migration 전체, 111/111 | `.codex/full-function-audit-20260914/stage4-current-final-pass.log` |
| ACL | PASS — 지표 22, 모바일 RPC 90, 비모바일 예외 1, 미승인 0 | 같은 로그 |
| 경합·DB 왕복·locale parity | PASS — 고정 지출 4조합, 식재료 15조합, 입고·재고·발주·레시피·국제 세금 포함 | `.codex/full-function-audit-20260914/stage4-current-final-remaining.log` |
| 업그레이드 | PASS — 26/26 | `.codex/full-function-audit-20260914/upgrade-check-final-invoker.log` |
| 웹 번들 | PASS | `.codex/full-function-audit-20260914/verify-no-db-final.log` |
| 계약 게이트 | 필수 FAIL 2개 — three-surface commit 경계와 산출물 SHA 3개 | `.codex/full-function-audit-20260914/verify-contracts-final.log` |
| 네이티브 기기 증빙 | ADVISORY_FAIL 4종 | 같은 로그 |
| Fable 독립검수 | 미실행 — 외부 호출 전 `PROVIDER_HARD_CAP_UNAVAILABLE` | `.codex/full-function-audit-20260914/fable-final.log` |

## 출시 진행 기준

기능을 추가할 때마다 새 문서를 늘리지 않는다. `docs/기능정의서.md`의 해당 기능 상세·시나리오·REL/INT 연결을 수정하고, `docs/작업큐.md`의 같은 기능 행에서 구현·검수·남은 게이트를 갱신한다. 화면 이동 자체는 AppMap과 `apps/mobile/src/features/README.md`, 계산·원장·전파는 `ARCHITECTURE.md`와 DB migration/RPC를 권위로 사용한다.

현재 구현 검증에서 남은 필수 작업은 변경 전체를 하나의 검토 가능한 커밋 경계로 정리한 뒤 three-surface 선언·생성 레지스트리·백로그의 SHA를 같은 exact commit에 결속하는 것이다. 그 다음 동일 SHA에서 전체 `corepack pnpm verify`와 독립검수를 다시 실행해야 오픈 승인 후보가 된다.
