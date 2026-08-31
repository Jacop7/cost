
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `e09b858fd9f8f3786d49245569f5eb31d4d64aaa`
- finding_ids: `INTL1A-IMP-TAXCATEGORY-DOMAIN`
- 실행 명령: `corepack pnpm --filter @margincook/types typecheck`; `corepack pnpm --filter @margincook/core test`; `git diff --check`
- 종료 코드·결과: 모두 exit 0. core 183 passed·3 skipped. 앞선 전체 `corepack pnpm verify`도 6/6(DB 37/37, mobile 212, 새 DB·경합·parity, upgrade 14/14, 웹 번들) 통과.
- 증거 파일·로그 위치: `packages/types/src/international.ts`, `docs/작업큐.md`, `docs/ai-review/tasks/INTL-1A-IMPLEMENTATION-001/rounds/r001/review.json`
- 미실행 항목과 이유: 주석·타입 별칭만 추가했으므로 전체 DB 재구축은 반복하지 않고 영향 범위 typecheck/core와 diff를 재검증했다.
- next_review_request: `FABLE_RECHECK`
