
## CODEX_EVIDENCE · turn-c002 · r001

- role: `CODEX-FUNCTION-QA`
- reply_to_turn_id: `turn-c001`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- advisory_classification: `SEPARATE_OPUS_ADVISORY_NOT_FABLE`
- 공식 상태: Fable r002는 `TASK_CAP_APPROVAL_REQUIRED`로 `RUN_FAILED`이며 verdict가 없다. 아래 Opus 자문은 Fable 재검수·PASS·Finding VERIFIED를 대신하지 않고 공식 미종결 Finding 상태도 바꾸지 않는다.

### 별도 Opus 자문과 적용

- canonical Claude Code CLI의 `claude-opus-5`를 새 읽기 전용 세션(`Read/Grep/Glob`)으로 실행했다. 결과 본문은 생성됐지만 두 CLI 호출 모두 설정한 사용 상한에서 종료됐으며, 로컬 세션 원본에서 완성된 자문을 회수했다. 이는 protocol successor가 아닌 사용자가 요청한 별도 보조 검토다.
- Opus가 새로 지적한 필수 보완 세 건을 적용했다.
  1. 수량 0 정정은 판매행을 삭제하지 않고 tombstone으로 보존하며, snapshot 금액을 0으로 만들고 반대 부호 세금 이벤트를 추가해 이벤트 합계를 0으로 만든다. 시험 38이 행·snapshot 보존과 이벤트 합계 0을 직접 잰다.
  2. `tax_region_catalog`는 `margincook_rpc_executor`에 SELECT만 허용한다. migration 사후조건과 시험 38이 INSERT/UPDATE/DELETE/TRUNCATE 직접 권한 0을 확인한다.
  3. 세금 이벤트와 두 snapshot 표의 소유자 TRUNCATE도 명시적 statement trigger로 42501 거부한다. 시험 38이 owner 직접 TRUNCATE를 실행해 차단을 확인한다.
- 후속 계산 단계에 속하는 구성 항목 합계 DB 제약과 `reverses_event_id`의 같은 판매선 검증은 `INTL-1D`, TypeScript `StoreTaxProfile`의 국가·지역 파생 계약은 `INTL-1C`에 남겼다. INTL-1B schema-only 범위에서 계산·이관·앱 활성화를 앞당기지 않았다.

### 최신 실행 증거

- 실행 명령: `node packages/db/tests/run.mjs 38`; `corepack pnpm db:reset`; `corepack pnpm db:types`; `corepack pnpm verify`; `git diff --check`
- 결과: 모두 exit 0. 전체 verify 6/6 — DB 38/38, core 184 passed·4 skipped, mobile 212, CLI/ACL 보안, 새 DB 전체 migration·실제 2세션 경합·국제/locale parity, upgrade 15/15, Metro 웹 번들.
- 기존 0090 한국 세금 계산과 판매·재고 원장은 불변이며 국제 세금 capability는 `read=false`, `write=false`다. 스테이징·운영 적용은 하지 않았다.
- next_review_request: `FABLE_RECHECK`
