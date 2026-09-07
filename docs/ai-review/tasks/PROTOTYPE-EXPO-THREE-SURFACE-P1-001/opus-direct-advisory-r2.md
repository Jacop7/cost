# P1 Opus 직접 자문 R2

- 성격: `OPUS_DIRECT_ADVISORY` (Fable 및 공식 R2/R3 종결 아님)
- 대상: `af316a0e600f00f719194a8d1bf08045af5621f9`
- R1 대상: `1bb9b523fd22f62563b8569575aa30a36d5779fa`
- 모델: Claude Opus 5, high
- 계약: 읽기 전용
- 판정: `PASS`

## 확인된 종결

- spec-only 및 unsupported catalog projection 계약
- Windows separator·대소문자 비구분 dev 경계
- 상대·tsconfig alias import의 fail-closed 해석과 `.js`·platform suffix·template import·`require`·type-only·re-export
- route 이름 중복, 실제 stub registry, route import graph의 source component 도달성
- code-unit 정렬, P1 floor hash 고정, LF·고정점 계약
- top-level prototype registry 1개, spread·shorthand·중복 key 거부, prototype metadata와 locator/binding 대조

자체 실행 증거는 동기화 64/53/185·orphan 0, 음성시험 49/49, byte 시험 9/9, 모바일 233/233,
typecheck PASS다. Opus는 전달된 소스를 읽어 구조를 검수했으며 실행 증거를 독립 재현한 것은 아니다.

## R2/R3 잔여 위험

1. `packages/*` 경유 dev import를 graph root가 읽지 않는다.
2. tsconfig `extends`를 따라 alias를 합성하지 않는다.
3. platform 후보에 `.web`이 없다.
4. Expo Router에서 `x`와 `x/index`의 route 이름을 아직 정규화하지 않는다.
5. symlink root의 realpath 일관성과 임시 예외 만료 형식 검증이 남아 있다.

이 항목은 P2 착수 전/초기 검사기 보강 backlog로 승계하며 P1 PASS를 Fable 독립검수나 공식 R2/R3
종결로 확대 해석하지 않는다.
