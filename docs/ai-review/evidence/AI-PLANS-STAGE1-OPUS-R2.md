# AI 기획안 누적 교차검수 — Stage 1 / Opus r2

> 상태: `OPUS_DIRECT_ADVISORY`
> 실행일: 2026-09-01
> 모델: `claude-opus-5`
> Claude Code: `2.1.250`
> 세션: `9dc5aa51-356a-4dd8-9ff4-488ce421534d`
> 사용 상한: `$2.00`
> 보고 사용액: `$1.391394`
> verdict: `CHANGES_REQUIRED`

r1의 28개 Finding은 모두 수정된 원문에서 해결된 것으로 재검증됐다. 다음 누적 3문서 검수에서
아래 신규 Finding의 수정 결과를 다시 확인한다.

| ID | 등급 | 요약 | 반영 |
|---|---|---|---|
| GATE-CI-30 | Major | G3가 full-db-required·protected-gate를 누락 | 상위 AGENTS의 구성 job 전체 성공 참조로 수정 |
| LEARN-SECR1-31 | Major | SECURITY 학습 주입이 r001과 registry 기준으로 충돌 | predecessor registry 유무 기준으로 통일 |
| MAP-FIELD-32 | Major | 완료 조건·역할·의존성 매핑 누락 | YAML·매핑표·Task Packet 연결 추가 |
| RISK-STATE-33 | Minor | Risk 고유 상태와 수용 승인 조건 부재 | 노드별 상태 enum·ACCEPTED 승인 조건 추가 |
| LIFECYCLE-ENUM-34 | Minor | 문서 수명주기의 REVIEWED가 enum에 없음 | 공통 상태에 REVIEWED 추가 |
| SECT-NUM-35 | Minor | §8 하위 절 번호가 7.1·7.2 | 8.1·8.2로 수정 |
| LEARN-EXCL-36 | Minor | SECURITY 후속의 선언과 모델 주입이 혼재 | task 선언과 컨텍스트 주입을 분리 |
| PKT-TERM-37 | Improvement | 제거된 AGENTS version 표현 잔존 | blob/content hash로 통일 |
| UNTRACKED-38 | Improvement | 요청받지 않은 미추적 파일의 복원 계약 누락 | 사용자 소유 변경 범위와 중단 규칙에 포함 |

이 회차보다 앞선 동일 r2 시도는 `max_turns=8`로 구조화 결과 없이 종료됐으며
`AI-PLANS-STAGE1-OPUS-R2-FAILED.md`에 별도 보존했다.
