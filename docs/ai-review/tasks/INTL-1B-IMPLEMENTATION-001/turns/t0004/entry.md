
## CODEX_EVIDENCE · turn-c003 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c002`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- advisory_classification: `SEPARATE_OPUS_ADVISORY_RECHECK_NOT_FABLE`
- 공식 상태: 이 턴은 사용자가 목요일 초기화 전까지 요청한 별도 Opus 보조 재검수 기록이다. Fable r002의 `RUN_FAILED`, 공식 미종결 Finding, gate OPEN 상태를 바꾸지 않으며 Fable PASS로 해석하지 않는다.

### Opus 재검수 결과

- engine/model: canonical Claude Code CLI · `claude-opus-5`
- execution: 기존 별도 자문 세션을 읽기 전용 `Read/Grep/Glob`으로 재개했으며 제품 파일 쓰기·웹 검색·하위 에이전트 호출은 없었다.
- terminal result: 정상 완료(`is_error=false`, `terminal_reason=completed`).
- advisory verdict: `PASS`.
- H1 수량 0/append-only: `VERIFIED` — 수량 0은 판매행·snapshot tombstone을 보존하고 금액을 0으로 만든 뒤 반대 부호 이벤트 합을 0으로 맞추는 계약과 실행 시험이 일치한다. 1B capability 비활성 상태에서 현행 판매행 삭제는 영향받지 않는다.
- M2 `tax_region_catalog` 권한: `VERIFIED` — 실행 역할은 SELECT만 가지며 migration 사후조건과 시험 38이 쓰기 권한 0을 확인한다.
- M3 owner TRUNCATE: `VERIFIED` — 이벤트와 두 snapshot 표의 statement trigger가 owner TRUNCATE를 42501로 거부하고 시험 38이 세 표를 실제 실행한다.
- 범위 판단: 구성 항목 합계 제약과 `reverses_event_id` 계약은 INTL-1D, TypeScript 프로필의 국가·지역 파생 계약과 미국·캐나다 지역 카탈로그 적재는 INTL-1C가 맞다.

### 후속 비차단 조건 반영

- `docs/작업큐.md`와 국제 출시 기획안에 미국·캐나다 지역 카탈로그 양성 경로, capability 쓰기 활성화 전 합계 제약, `reverses_event_id` 필수화/제거 결정, TypeScript 국가·지역 출처 확정을 각각 INTL-1C/1D 조건으로 명시했다.
- 신설 TRUNCATE trigger 존재를 migration 사후조건에서도 세는 것은 선택 보강이다. 시험 38이 owner 실행으로 동작을 직접 재므로 현재 INTL-1B 차단 사유로 올리지 않았다.
- 최신 로컬 검증은 직전 `turn-c002`와 동일하게 `pnpm verify` 6/6(DB 38/38, core 184·4 skipped, mobile 212, upgrade 15/15, 웹 번들)이고 `fresh_%` 잔여는 0개다.
- next_review_request: `FABLE_RECHECK_AFTER_RESET`
