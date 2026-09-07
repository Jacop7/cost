# P1 Opus 직접 자문 R1

- 성격: `OPUS_DIRECT_ADVISORY` (Fable 및 공식 R2/R3 종결 아님)
- 대상: `1bb9b523fd22f62563b8569575aa30a36d5779fa`
- 기준: `dabcccc2c4d84cfe191cb37f7a05bcd376f089c4`
- 모델: Claude Opus 5, high
- 계약: 읽기 전용
- 판정: `CHANGES_REQUIRED`

## 호출 이력

1. 도구 기반 첫 호출은 USD 2.00 soft cap을 넘어 유효 판정 없이 종료됐다.
2. 축소 도구 호출은 8턴 상한에 도달해 유효 판정 없이 종료됐다.
3. 검사기·음성시험·사람 선언을 직접 입력한 단일턴 호출에서 아래 판정을 받았다.

실패한 두 호출은 검수로 계산하지 않는다.

## Finding

1. **High** — `specOnly`가 `catalogMode` 없이도 catalog projection에 들어가 malformed entry를 만들 수 있다.
2. **High** — route 파일의 `/index.ts` 비교가 Windows separator에서 달라진다.
3. **High** — Windows의 대소문자 비구분 경로에서 `src/DEV`가 `within()`과 graph key를 우회할 수 있다.
4. **High** — 해석하지 못한 상대·alias import를 조용히 버리고 `.js`·platform suffix·template import 등을 놓친다.
5. **Medium** — route group 제거 후 같은 route 이름이 되는 두 파일을 중복으로 거부하지 않는다.
6. **Medium** — 기본 `states` 상속 때문에 `catalogMode=unsupported`가 실제로 도달 불가능하다.
7. **Medium** — `stubName`이 실재 registry에 결속되지 않고 `sourceComponent`가 route import graph에서 도달 가능한지 확인하지 않는다.
8. **Low–Medium** — locale 의존 정렬, 변경 가능한 baseline floor, 생성 JSON의 LF 계약을 점검하라.

연관 보완으로 top-level registry 선언만 읽기, object spread·shorthand 거부, prototype 메타데이터 검증,
명시 `routeBinding`과 README locator 불일치 거부도 요구됐다.

## 완료 조건

각 Finding의 음성시험을 추가하고, 검사기·고정점·모바일 typecheck를 다시 통과한 exact SHA를 같은 범위로
Opus에 재검수한다.
