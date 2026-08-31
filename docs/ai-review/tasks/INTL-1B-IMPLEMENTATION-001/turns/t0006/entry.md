
## HUMAN_DECISION · turn-h001 · r001

- role: `HUMAN`
- decided_at: `2026-08-31T22:00:00+09:00`
- scope: `INTL-1B와 목요일 전 이어지는 국제 출시 작업 절차`
- decision: 목요일 초기화까지 기다리지 않고 남은 검수·병합 절차를 별도 Opus 검수로 계속 진행한다. 사용자가 이후 명시적으로 “Fable로 해줘”라고 요청할 때만 Fable을 다시 호출한다.
- evidence_rule: Opus 결과는 실제 엔진과 모델을 표시하며 Fable PASS·Fable VERIFIED로 가장하지 않는다. 기존 Fable r001·r002와 `RUN_FAILED` 이력은 보존한다.
- merge_authority: 별도 Opus 보조 재검수 PASS, 로컬 `pnpm verify` 6/6, 동일 정확 SHA의 Node 20.19.4·Node 24·`full-db-required`·`protected-gate` 성공이 모두 확인되면 INTL-1B를 main에 fast-forward 병합하도록 승인한다.
- exclusions: 스테이징·production 적용, 국제 세금 capability 활성화, 미커밋 사용자 UI·프로토타입 파일의 스테이징·수정은 승인 범위가 아니다.
- next_review_request: `CODEX_EVIDENCE_AND_OPUS_GATE`
