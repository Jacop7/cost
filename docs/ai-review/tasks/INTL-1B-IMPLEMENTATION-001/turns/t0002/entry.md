
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-s002`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- finding_ids: `INTL1B-EVENTS-CASCADE-PURGE-CONFLICT`, `INTL1B-PROFILE-REVISION-MUTABILITY`, `INTL1B-TEST-CROSS-STORE-GAP`, `INTL1B-MINORUNIT-DUAL-SOURCE`
- 실행 명령: `node packages/db/tests/run.mjs 38`; `corepack pnpm db:reset`; `corepack pnpm db:types`; `corepack pnpm verify`; `git diff --check`; `docker exec supabase_db_margincook psql -U postgres -d postgres -At -c "select count(*) from pg_database where datname like ''fresh_%'';"`
- 종료 코드·결과: 모두 exit 0. 전체 verify 6/6 — DB 38/38, core 183 passed·4 skipped, mobile 212, CLI/ACL 보안, 새 DB 전체 migration·실제 2세션 경합·locale/국제 DB parity, upgrade 15/15, Metro 웹 번들. 업그레이드 ⑮은 0178→0179 뒤 기존 세금 계산·판매/재고 행 수·capability false와 새 국제 표 초기 0건을 확인했다. `fresh_%` 잔여 DB 0개, diff 오류 0건.
- Finding별 판별 증거: 시험 38이 (a) 세금 이벤트가 있는 판매행 직접 삭제 42501과 승인된 매장 purge 성공·lifecycle 감사 보존, (b) 같은 판본의 프로필/세율/카테고리/납부 주체 변경과 시장 기간 이탈 거부 및 sort_order 양성 경로, (c) 실제 다른 소유자·매장 프로필/카테고리 교차 참조 거부를 직접 실행한다. core parity는 실제 새 DB의 `international_currency_minor_unit` 결과를 TypeScript `LAUNCH_MARKETS.minorUnit`과 전 통화 대조한다.
- 증거 파일·로그 위치: `packages/db/tests/38_international_tax_schema.sql`, `packages/core/tests/internationalDbParity.test.ts`, `packages/db/scripts/upgrade-check.sh`, `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `docs/ai-review/tasks/INTL-1B-IMPLEMENTATION-001/rounds/r001/review.json`
- 미실행 항목과 이유: 스테이징·운영 적용과 capability 활성화는 INTL-1B 범위가 아니며 사람 승인 전 실행하지 않았다. 보호 CI는 작업 commit과 Fable 재검수 확정 뒤 정확한 SHA에서 실행한다.
- next_review_request: `FABLE_RECHECK`
