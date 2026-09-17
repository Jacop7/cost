# 전체 연결 감사 — 네이티브 후속 검수

2026-09-14 현재 로컬 Expo를 USB iPhone과 Android 에뮬레이터에서 읽기 전용으로 측정했다. 이 문서는 진단 결과와 검사기 보완을 기록하며, clean commit에 결속되는 공식 기기 영수증을 대신하지 않는다.

## 결과

| 범위 | 결과 | 근거 |
|---|---|---|
| iPhone 1배 | PASS, 중첩 0 | `.codex/remaining-verify-20260914/ios-1x-final.{json,log}` |
| iPhone 확대 | PASS, 중첩 0 | `.codex/remaining-verify-20260914/ios-2x-final.{json,log}` |
| Android 1배 | FAIL, 인접 경계 2건 | `.codex/remaining-verify-20260914/android-1x-stable.{json,log}` |
| Android 확대 | 미실행 | 시스템 글자 크기 변경 명령이 자동 승인 검토에서 거부됨 |
| 검사기 회귀 | 55/55 PASS | `.codex/remaining-verify-20260914/native-current-final-tests.log` |

Android 1배의 두 결과는 밀도 2.625에서 각각 약 0.3809dp, 즉 물리 1픽셀만큼 맞닿은 행 경계다. 대상은 재료 관리 목록의 인접 행과 판매가 시뮬레이션 세금 카드의 `접기`/`자세히 보기`다. 확대 표본이 없으므로 허용 예외나 임계값 완화를 추가하지 않았다.

## 검사기 보완

- 실제 재료 관리 흐름대로 행의 세로 메뉴를 연 뒤 `수정`·`삭제`를 측정한다. 삭제 동작은 실행하지 않는다.
- 재고 내역 선택기는 실제 선택 행을 열어 측정한다.
- 매출관리와 판매가 시뮬레이션은 확대 상태에서 각 대상이 있는 구간으로 중앙 스크롤한 뒤 측정한다.
- React Native `HostPortal`에서 조상 탐색을 끊고 modal 내부의 전체 창 View를 표면 root로 사용한다. 다른 화면의 frame을 modal 터치 영역으로 잘못 합산하지 않는다.
- 각 화면 단계의 캡처 전후 글자 배율이 같음을 확인해 측정 중 배율 복원을 실패로 잡는다.

변경 파일 SHA-256:

| 파일 | SHA-256 |
|---|---|
| `scripts/native-current-contract.test.mjs` | `ff78970b6539f5660c593dd446691b85ac0443e4a96e4aab8656e4c045a72878` |
| `scripts/native-touch-runtime-audit.mjs` | `e32ef41f4c0dca652aab2b126c62208c619a990d7672445aa14ea560ee4c4486` |
| `scripts/native-touch-runtime-audit.test.mjs` | `bb827786faec071c850b6447db5101489a84f9bb404e6a4c11c42ca4e50d5c95` |
| `scripts/native-touch-runtime-contract.json` | `3753f8bfd22fe385062f489eae923bdc53e8420ec49326364dd2e1a0744ac14a` |

## 공통 검증 상태

격리 DB 실행에서 타입 검사와 core·DB·mobile 시험이 통과했고, 새 DB 전체 migration 101/101, ACL, 판매·설정·재료 경합, migration anchor와 recipe v2 두 세션 계약까지 통과했다. 실행은 이후 DB 전용 mobile 시험을 시작한 시점에 작업 환경 전환으로 종료되어 6단계 전체 통과로 표시하지 않는다. 원본은 `.codex/remaining-verify-20260914/verify-final.log`이며 SHA-256은 `c2f96ed358c3cb1001d66e8a8bf4b276529111e4a43097faca2b6dd7bbd264da`다.

③의 필수 실패는 `three-surface-byte-artifacts-check.mjs` 1건이다. 현재 작업 트리에 여러 작업의 변경이 함께 있어 공식 생성기가 요구하는 clean exact commit을 만들 수 없다. 네이티브 실행·영수증·통합·글자 확대 4건은 계속 `ADVISORY_FAIL`이다. 이번 진단 JSON은 공식 영수증으로 승격하지 않는다.

Claude 브라우저 읽기 전용 검토는 modal root 보완과 실제 화면별 스크롤 단계가 타당함을 확인했다. Android 1픽셀 결과는 확대 표본 없이 예외 처리하지 않는 판정을 유지했다. 이는 Fable protocol 완료 판정이 아니다.
