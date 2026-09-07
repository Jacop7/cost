# P2 Opus 직접 자문 R6

대상: edb60d8e59f753c8445b6c86d2c575f248044c41

판정: PASS

> Fable 공식 판정의 대체물이 아니라 승인된 provider 제한에서 동일한 읽기 전용 계약으로 수행한 Opus 승계 자문이다. exact SHA 기준으로 읽었으며 파일은 수정하지 않았다.

## R5 Minor 종결

- `predecessorSuccessorCommit`과 blob/commit 쌍 불변식, HEAD 조상 관계, 해당 커밋의 계약 파일 blob exact 대조가 도달 불가 Git blob 공격을 막는다.
- 후속 successor는 최초 P0 blob·decision 계보를 predecessor와 동일하게 유지한다.
- 임시 Git repo에서 고아 blob을 주입하는 음성 시험이 정확한 공격 경로를 재현해 FAIL한다.
- 후속 predecessor에서 P3 backlog였던 항목을 component transfer로 뒤집는 분기 전용 시험이 세탁을 차단한다.
- S4/P0 baseline/byte manifest 해시와 제품 freeze가 exact SHA에서 일치한다.

## 판정

P2 S4 successor 계약을 최종 종결하고 네이티브 9종 재측정 단계로 넘어가도 된다. 계약은 개선·악화·세탁·위조 네 방향에서 fail-closed이며 raw 54건, P2 transfer 6건, P3 backlog 48건과 P0 합집합 702건을 보존한다.

P3 진입 전에는 이 영수증을 별도 커밋하고, Android/iOS 네이티브 증거 9종을 exact SHA의 실제 기기에서 재측정하며, Fable 복구 표본 재감사 또는 exact SHA에 결속된 사람의 명시적 위험 수용을 추가해야 한다.
