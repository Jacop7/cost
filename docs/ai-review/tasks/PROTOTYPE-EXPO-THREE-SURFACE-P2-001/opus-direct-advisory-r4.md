# P2 Opus 직접 자문 R4

대상: 92d5123fe3d22043dcc944413946ae057eeab667

판정: PASS

> Fable 공식 독립검수의 대체물이 아니라 승인된 provider 제한에서 동일한 읽기 전용 계약으로 수행한 Opus 승계 자문이다. exact SHA의 clean 상태를 확인하고 파일은 수정하지 않았다.

## 확인 결과

- successor SHA, P0 baseline 결속, byte manifest의 해시가 일치한다.
- component transfer 6 · P3 backlog 48 · COMMON4/MY15/RECIPES17/SALES12가 실측과 일치한다.
- `MyHomeScreen` 8건은 전부 P3-MY로 복원됐고 transfer source에서도 제거됐다.
- component transfer는 `delta.added`만 허용하며, HubHeader~Select 구현 범위 안에서 owner needle을 검사한다.
- P0 regression 654와 successor P3 backlog 48은 서로 다른 gate finding 집합이며 합산 open 702다.
- `--structural-only`는 P0 숫자 측정에서만 사용되고 전체 `verify`는 영수증을 요구하므로 우회가 아니다.
- 실행서, R3 영수증, P0/backlog 결속과 exact 영수증 파싱은 R3 요구를 충족한다.

## P3 전 잔여 조건

1. successor 최초 판본은 무모순이나, 후속 2판은 현재 source P0 baseline의 빈 S4 failureLines를 입력으로 삼아 만들 수 없다. `predecessorSuccessorBlob !== null`이면 직전 successor의 `sealedRawFailures`를 old source로 사용하고, P0 blob 검사는 초판 전용으로 분기한다. 개선·악화 양쪽 음성 시험을 추가해야 한다.
2. `combinedUniqueOpen`은 단순 덧셈이 아니라 두 finding 집합의 교집합 0을 기계 단언하거나 합집합으로 계산한다.
3. 네이티브 증거 9종은 P3 진입 exact SHA에서 실제 Android/iOS로 재측정한다.
4. R2·R3 운영 게이트에는 Fable 복구 표본 재감사 또는 exact SHA에 결속된 사람의 명시적 위험 수용이 별도로 필요하다.

## 결론

P2 S4 successor R3 보완은 PASS다. 다만 위 조건 1·2와 네이티브 9종이 닫히기 전에는 P3를 시작하지 않는다.
