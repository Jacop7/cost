# P0 구현 검수 — Opus 직접 자문 R1

- target: `3c59736cac12da202132c0b74dafb06b3a883359`
- verdict: `CHANGES_REQUIRED`
- scope: `IMPLEMENTATION_READ_ONLY`
- authority: `OPUS_DIRECT_ADVISORY`
- 성격: Fable 판정이나 R2/R3 종결을 대체하지 않는다.

## Finding

- `BL-1`: regression 768건 감소를 양방향 래칫하지 않고, baseline 삭제 커밋 뒤 `--write`로 보호 없이 재생성할 수 있음.
- `MJ-1`: 세 `three-surface` 검사기와 시험 파일이 byte 무결성 결속 및 역방향 발견 범위 밖임.
- `MJ-2`: 계획 자문 Finding 83건의 `evidencePaths`가 같은 두 문서 상수이고 장부 쓰기 경로가 보호되지 않음.
- `mn-1`: byte 역방향 발견이 P0 검수 task 디렉터리와 `scripts/three-surface-*`를 포함하지 않음.
- `mn-2`: 모바일 전체 시험 10회 연속은 작성자 증거만 있으며 이번 독립 자문에서 1회만 재현.

## 완료 조건

- 분류 수 변경은 `<사유ID>@<HEAD SHA>` 1회성 토큰으로만 허용하고, baseline 삭제 이력도 직전 Git blob에서 읽어 래칫한다.
- 세 검사기·세 시험·두 검수 task 디렉터리를 닫힌 byte manifest와 역방향 발견 범위에 포함한다.
- 일회성 장부 migration/backfill 경로를 폐쇄하고 projection 쓰기에 `--expect-commit`·clean·`--force`를 적용한다.
- 회차 안 Finding의 evidence path 집합이 모두 같으면 실패시킨다.

이 문서는 자문 결과의 보존 사본이다. 실제 해소 판정은 후속 exact-SHA 재검수 결과에 기록한다.
