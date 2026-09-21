# Team Router Opus 독립 재검수 006

> 대상: canonical root 수신 거절·복구 계약
>
> 검수: Claude Opus, read-only, high effort
>
> 결과: `CHANGES_REQUIRED` — 코드 변경 전 판정 원본 보존

## 판정 요약

- `REJECTED`가 terminal이고 동일 delivery token을 강제하는 점, amendment의 완전한 key 집합과
  receipt hash 결속, 재봉인 전 fail-closed 동작은 확인됐다.
- 다음 보강을 요구했다: envelope에 `project_id`를 포함해 receiver가 runtime root를 독립 대조할 것,
  모든 canonical root 실패 사유를 거절 계약에 포함할 것, root binding을 활성 Decision에 결속할 것,
  root runtime record의 schema를 엄격히 검증할 것, unsealed 상태에서도 이미 보낸 route의 terminal
  receipt를 append할 수 있게 할 것.
- rebind forward amendment, root-validation 실행 영수증, amendment timestamp의 엄격한 시간 검증,
  손상·미등록·terminal 후속 event의 추가 시험은 다음 재검수 범위로 남았다.

## 후속 적용 범위

이 Finding에 따라 Team Router 구현은 다음만 먼저 수정한다.

1. envelope의 `project_id`와 수신 prompt의 전체 root-failure 거절 규칙
2. `bind-canonical-root`의 active Decision 결속
3. `canonical-root.json`의 strict schema·경로 검증
4. `record-delivery`·`record-rejection`의 terminal audit append를 activation receipt 재봉인 전에도 허용

본 파일은 Opus의 원래 `CHANGES_REQUIRED` 판정을 `PASS`로 대체하지 않는다. 수정본은 별도 재검수와
exact hash 재봉인 뒤에만 활성 계약 후보가 된다.
