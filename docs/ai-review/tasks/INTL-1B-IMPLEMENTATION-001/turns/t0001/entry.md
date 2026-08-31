
## SOLAR_RESPONSE · turn-s002 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `turn-f001`
- target_commit_sha: `d39f0e4441434e1bc9713ecd71379d69f2828b8a`
- changed_artifact_paths: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/db/tests/38_international_tax_schema.sql`, `packages/core/tests/internationalDbParity.test.ts`, `packages/db/README.md`, `docs/국가-통화-세금-국제출시-기획안.md`, `docs/작업큐.md`, `packages/db/src/database.types.ts`

### INTL1B-EVENTS-CASCADE-PURGE-CONFLICT

- disposition: `APPLIED`
- 적용 위치: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/db/tests/38_international_tax_schema.sql`, `packages/db/README.md`, `docs/국가-통화-세금-국제출시-기획안.md`
- 적용 내용: 일반 UPDATE·DELETE·TRUNCATE는 계속 42501로 거부하되, 기존 보존 정책의 유일한 공식 문인 `purge_archived_store`가 보존 종료·승인·백업을 확인하고 트랜잭션 로컬 `margincook.store_purge_id`를 설정한 같은 매장 cascade DELETE만 허용한다. 직접 판매행 삭제는 세금 이벤트가 있으면 실패하고, 취소·정정은 반대 부호/목표 차이 이벤트로 남긴다. 깨끗한 별도 매장에 실제 판매행·snapshot·구성 항목 snapshot·세금 이벤트를 만든 뒤 service role 공식 purge가 성공하고 `store_lifecycle_events` 물리 삭제 감사가 남는 시험을 추가했다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: 공식 purge와 직접 판매행 삭제가 서로 다른 결과를 내고 append-only 불변식과 매장 보존 정책이 함께 성립하는지.

### INTL1B-PROFILE-REVISION-MUTABILITY

- disposition: `APPLIED`
- 적용 위치: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/db/tests/38_international_tax_schema.sql`, `docs/국가-통화-세금-국제출시-기획안.md`
- 적용 내용: 시장·세금 프로필은 `effective_to` 마감 외 모든 내용 UPDATE를 거부하고 새 내용은 새 행·revision으로 만들도록 했다. 시장 프로필 마감이 하위 세금 프로필을 범위 밖에 남기면 거부한다. 세금 구성 항목은 표시용 `sort_order`만, 과세 카테고리는 표시 이름·활성 상태만 바꿀 수 있고 계산 의미는 불변이며, 채널 납부 주체 UPDATE는 전부 거부한다. 시험 38이 가격 기준·기본 과세·세율·카테고리 과세·납부 주체의 제자리 변경과 기간 이탈을 각각 실패 폐쇄하고 `sort_order` 양성 경로도 확인한다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: 같은 ID+revision의 계산 내용이 바뀌지 않고 마감 가능한 유일한 예외가 문서·시험과 일치하는지.

### INTL1B-TEST-CROSS-STORE-GAP

- disposition: `APPLIED`
- 적용 위치: `packages/db/tests/38_international_tax_schema.sql`
- 적용 내용: 실제 다른 소유자·매장의 시장/세금 프로필, 과세 카테고리, 구성 항목, 채널 납부 주체를 만든다. 외국 매장 프로필로 현재 매장 판매 snapshot을 만드는 경로와 다른 프로필의 카테고리를 현재 프로필 override에 붙이는 경로가 복합 FK·guard에서 거부됨을 판별한다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: fixture가 존재하지 않는 UUID가 아니라 실제 교차 매장·교차 프로필 참조를 사용하며 실패 SQLSTATE를 확인하는지.

### INTL1B-MINORUNIT-DUAL-SOURCE

- disposition: `APPLIED`
- 적용 위치: `packages/db/supabase/migrations/20260831000179_international_tax_schema.sql`, `packages/core/tests/internationalDbParity.test.ts`, `packages/db/src/database.types.ts`
- 적용 내용: 통화 소수 자릿수 매핑을 DB 함수 `international_currency_minor_unit` 한 곳으로 모으고 snapshot guard가 이 함수를 쓴다. 새 DB parity 시험은 DB enum 전 통화의 함수 결과를 TypeScript `LAUNCH_MARKETS.minorUnit`과 직접 대조한다. 함수는 앱 롤에서 회수하고 내부 executor·service role만 실행할 수 있다.
- 반박 또는 부분 적용 근거: 없음.
- 필요한 재검수: DB guard와 TypeScript metadata가 같은 실제 DB 함수 결과로 연결됐는지.

- next_review_request: `CODEX_EVIDENCE`
