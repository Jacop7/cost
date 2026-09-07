# P0 Opus 직접 자문 R2

- 권위: `OPUS_DIRECT_ADVISORY`
- 대상 커밋: `06bc5cd448f287f79ace66141bd56b45911b8d8c`
- 판정: `PASS` (Blocker 0 · Major 0 · Minor 3)
- 경계: Fable 판정 또는 R2/R3 공식 종결 증거를 대체하지 않는다.

## 확인된 정정

- BL-1, MJ-1, MJ-2, mn-1은 해소됐다.
- mn-2는 자문자가 모바일 전체 스위트를 1회 재현했다. 작성자 측 10회 반복은 같은 SHA에서 별도로 재현했다.

## 후속 Minor

1. `mn-3`: 분류·inventory 변경 시 Git 이력의 직전 값과 현재 값을 대조하고, 실제 write 입력 SHA에 결속된 migration token을 요구한다. migration 삭제 음성 시험을 둔다.
2. `mn-4`: baseline에 보호된 `--write` provenance, write 시점 HEAD, 사용 token을 보존하고 검사한다.
3. `mn-5`: 자문 장부의 `evidencePaths`가 회차 상수가 되지 않도록 회차 Finding 수에 비례한 provenance 집합 하한을 둔다.

P0 종결 자체는 허용됐지만 위 세 항목은 P1 전에 보강하라는 권고를 받았다.
