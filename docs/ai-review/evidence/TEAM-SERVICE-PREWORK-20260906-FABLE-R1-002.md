# TEAM-SERVICE-PREWORK-20260906 Fable R1

- 검수 방식: `AI 팀 지식망 스터디·인계` Fable 5.1 중간 직접 Cowork 검수
- 대상 후보: `TEAM-SERVICE-PREWORK-20260906-CANDIDATE-002`
- 후보 SHA-256: `fb0c93f1a09d81ef8e8d77e89d57a968b9574a51faa6096c843a0ebc6e969447`
- 판정: `CHANGES_REQUIRED`
- 성격: 직접 Fable 자문. formal CLI receipt·구현·발송 승인이 아님

Fable은 HEAD, 후보, 입력 10/10, CURRENT pin, canonical model-plan, Router 4개 파일 hash 및 HOST-SCOPE-003 결속을 직접 대조했다.

## Findings

1. `R-1` 차단: PLAN-14가 verdict가 C1/C2 완료값이 아니면 `implementation_authorized=true`를 요구해 잘못된 승격 압력을 만든다. 항상 false를 단언하고 이후 승인은 별도 decision SHA 기반 필드로만 허용해야 한다.
2. `G-1` P1: bounded BF-COMPLETE는 PASS지만 상위 LC-ADMISSION은 NOT_EXECUTED다. catalog의 LC-ADMISSION에 C1/C2 한정 scoped admission 결정과 `satisfies_broader_lc_admission=false`를 명시해야 한다.
3. `H-1` P1: HOST-SCOPE-003 스크립트의 결과와 outcome이 상수이며, collector 구현 속성 3건을 host 기록 부재로 잘못 분류했다. 원본은 보존하고 correction-002로 3건을 NOT_EVALUABLE로 바꾸며 실제 결정 근거 2건만 남기고, 다음 스크립트는 metrics에서 판정을 도출해야 한다.
4. `RC-1` P1: Router coverage 증거가 44건 요약만 보존한다. raw 44건이 있는 baseline 또는 새 원출력, audit source SHA와 11개 manifest SHA를 결속해야 한다.
5. P2: checkpoint는 시점 스냅샷이므로 이후 후보가 인용할 때 현재 정본과 혼동하지 않도록 명시해야 한다.

Fable은 실제 전송·endpoint·Router 활성화·앱/DB/Supabase 변경이 없음을 확인했다.
