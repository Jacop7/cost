
## CODEX_EVIDENCE · turn-c004 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c003`
- tested_commit_sha: `4bdce8541d42221198a48fc9a0c694fbde8c5aa3`
- branch: `codex/international-tax-schema`
- local_verification: `corepack pnpm verify` 6/6 — DB 38/38, core 184·4 skipped, mobile 212, 새 DB·경합·국제/locale parity, upgrade 15/15, 웹 번들.
- remote_verification: GitHub Actions run `33393774923`에서 Node 20.19.4·Node 24·`full-db-required`·`protected-gate` 모두 `success`.
- deployment_state: feature 브랜치만 push했다. `main` 병합, 스테이징·production 적용, 국제 세금 capability 활성화는 하지 않았다.
- review_state: 별도 Opus 보조 재검수 PASS는 기록했지만 공식 Fable r002 `RUN_FAILED`와 미종결 Finding 상태는 유지한다. 목요일 Fable 재개 시 이 commit을 대상으로 successor 재검수한다.
- next_review_request: `FABLE_SUCCESSOR_RECHECK_AFTER_RESET`
