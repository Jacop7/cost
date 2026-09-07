# P2 Opus 직접 자문 R3

대상: fd22a746f3517a12ba2a2a9ba87efb7d3409977a

판정: CHANGES_REQUIRED

> 이 문서는 Fable 공식 독립검수의 대체물이 아니라, 승인된 provider 제한에서 동일한 읽기 전용 계약으로 수행한 Opus 승계 자문 영수증이다.

## Major 1 — S4 successor 소유권 분류 오류

`MyHomeScreen.tsx`의 S4 실패 8건은 P2가 새로 만든 차이가 아니라 이전 P0 baseline의 48건에 이미 포함된 실패다. 따라서 `component-transfer`로 분류할 수 없고 `P3-MY` backlog로 유지해야 한다. 올바른 합계는 component transfer 6건, P3 backlog 48건이며 backlog 소유 분포는 COMMON 4 / MY 15 / RECIPES 17 / SALES 12다.

완료 조건:

- `component-transfer`는 반드시 P2 delta의 `added`에 있는 실패선만 허용한다.
- 이전 baseline에서 상속된 실패를 component transfer로 바꾸면 FAIL하는 음성 시험을 추가한다.
- owner needle은 소유 파일 전체가 아니라 `HubHeader`/`HubHeaderAction` 구현 범위 안에서 확인한다.

## Major 2 — 네이티브 증거 9종 재측정 필요

`verify.mjs`의 단락 평가 때문에 최초 stale 실패 뒤의 iOS text-scale 증거까지 출력되지 않았다. P3 진입 exact SHA에서 Android/iOS touch 1x·2x 4종, Android/iOS tap probe 2종, Android receipt 1종, iOS text-scale 1x·2x 2종을 실제 기기에서 다시 측정해야 한다. `productCommit` 문자열만 갱신하거나 예외 처리할 수 없다.

## Minor 1 — 실행서 현행화

세부 실행서 §6에 successor overlay, 정정된 6/48 분포, 갱신 정책, P0 regression 708→654 재기준선과 현재 상태를 기록한다.

## Minor 2 — P0 backlog와 successor 결속

P0 regression backlog와 successor의 P3 backlog가 별도 장부로 흩어져 있다. P0 checker가 successor 경로·해시·P3 backlog 48건과 합산 잔여를 검증하도록 연결한다.

## Minor 3 — successor 자기 체인

P3 개선 때 기존 source P0 blob만 계속 참조하지 않도록 successor 자체에 sealed raw failures를 보존하고, 다음 판본이 이전 successor Git blob OID와 old→new delta를 결속하는 갱신 절차와 음성 시험을 둔다.

## Minor 4 — 검수 영수증 exact 결속

R2 영수증은 successor overlay를 승인하지 않았다. 보완 후 R4가 정확한 대상 SHA를 재검수해야 하며, 영수증은 전용 `대상: <40hex>` 및 `판정: PASS` 행으로 파싱한다.

## 결론

S4 successor의 기계적 방향은 타당하지만 분류 사실과 네이티브 증거가 닫히지 않아 P3 착수를 승인하지 않는다.
