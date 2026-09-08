# P3 식재료 공용 우선 재접근 — Astra 내부 교차검수

앱 검수 대상: `703d46405a8df84f66458a0c9443160ea1b7ec69`.
측정 보완: `8f5ba28e73be81ed963e5bcccb376a5a415f19ab`,
`0af12e3b74f13b0bc3d6e2ccb99ebb27039f3ee5` (앱 diff 없음).

출처: 같은 Codex 작업의 독립 하위 검수자 `astra_p3_cross_review`의 코드·실렌더·PNG 검토.
이 기록은 Fable/Opus 공식 외부 검수 또는 P3 전체 최종 승인으로 사용하지 않는다.

## 발견·정정·재검수

| ID | 최초 대상 | Major 근거 | 정정 | 재검수 범위 판정 |
|---|---|---|---|---|
| A-F01 | 2de75fc | 320×720·font200%에서 ING-07 최신순 필터 right364.86, viewport보다44.86px 이탈 | ConditionRow 공용 래핑 | targeted web 해결 확인 |
| A-F02 | 2de75fc | 같은 조건 ING-05 폐기 탭 right359.53,39.53px 이탈 | 로컬 탭을 공용 ScrollTabs로 교체 | targeted web 해결 확인 |

검수자는 `candidate-4` 12화면+5상태 모두를 직접 보고 프로토타입12화면과 비교했다.
보통 크기에서 추가 Major 시각 결함을 발견하지 않았으며 Input 기본값·tone 우선순위·ING05
기능 계산과payload 보존·ING07 실제 정렬 상태 표시·ING10 공용Sheet 높이 조정을 확인했다.

`responsive-2` JSON과 핵심 PNG(ING05 세 탭, ING07)를 읽고 6/6 클릭·선택·도움말 도달·footer경계
결과와 행간 겹침 해소를 확인했다. `responsive-1`은 기하6/6이나 안내문 가독성은 FAIL이다.
RN 설치 소스 iOS Fabric `RCTAttributedTextUtils.mm:225`, Paper `RCTTextAttributes.mm:139`,
Android `TextAttributeProps.java:374–382`에서 lineHeight도 확대함을 확인했으므로 확정TYPE 행간을
이 웹 font-only 실험만으로 변경하지 않는 판단에 동의했다.

## 남은 범위

- Android/iOS 실제 확대·터치·키보드 회피
- 12화면 전체200%·긴 번역·모든 스크롤 구간·다양한 데이터
- ConditionRow 긴 라벨+right의 실브라우저 조합(현재 실제 소비처0)
- P3 승계 게이트·승인 시각 manifest·공식 외부 독립검수

## 게이트 별도 검토

`p3_gate_contract_review`는 읽기 전용으로 P0/P2 역사 검사와 P3 현재 검사의 모순을 확인했다.
P0검사322행 경로 금지만 지워도324행 스크립트hash와345–351행 현재 감사 출력 완전일치가 다시
충돌한다. P2시각검사도 헤더5화면 전용이므로 P3본문 승인으로 쓸 수 없다.

권고: 기존 baseline blob·측정tree·당시 검사기·분류를 보존하고 별도P3 successor가 정확한
변경 파일 전후blob·등록화면/상태·새/해소/유지 감사 Finding·시각 증거·검수target을 양방향 결속한다.
경로 예외/전체허용/glob 허용/동일개수 비교/조상PASS 재사용은 하지 않는다. 이 검토에서는 검사기나
임계값을 변경하지 않았고 실행 결과를 만들어 내지 않았다. 실행서P3 체크포인트에서 미해결로 추적한다.
