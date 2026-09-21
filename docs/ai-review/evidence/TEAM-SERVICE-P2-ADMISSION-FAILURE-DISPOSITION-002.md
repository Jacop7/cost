# TEAM-SERVICE P2 입장 전 전체 검증 실패 처분 002

## 결속

- 대상 후보005: `.codex/mission-relay/candidates/team-service-local-core-005.json`
- 후보005 SHA-256: `f15b2f2928583a342516e3ae6a1772ac4927ad0a457d048450b455ac6cf80ed5`
- 후보 상태: `SEALED`, CLI `verify` 통과, canonical active plan은 변경하지 않음
- 실행 기준 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 전체 검증 증거: `docs/ai-review/evidence/TEAM-SERVICE-VERIFY-P2-ADMISSION-20260906-001.json`
- 전체 검증 증거 SHA-256: `e8f89b5368011875099e7fc3ec710150b5fd024705ad29f01aa89298b05072b6`
- 입력 변화: `changed_inputs=[]`, HEAD 전후 동일
- 전체 판정: **FAIL — ②·③ 실패, ①·④·⑤·⑥ 통과**

이 문서는 001을 덮어쓰지 않는 후속 처분이다. 실패를 면제하지 않으며 P2 전용 독립검수 입력으로만 사용한다.

## ② 시험 — 기존 개발 DB 퇴행 및 상태 불일치

직전 2026-09-05 관측은 DB 시험 `43/50`이었고 이번 실행은 `42/50`이다. 새로 드러난 퇴행은 `04_ledger.sql`의 청양고추 재고 `870g` 대 원장 합계 `869g` 불일치다. 나머지 관측 실패는 다음과 같다.

1. `01_checksums.sql`: 제육볶음 순이익 기대 `4046.69`, 실제 `4046.60`.
2. `04_ledger.sql`: 청양고추 재고와 원장 합계 `1g` 불일치 — 직전 실행 대비 신규 실패.
3. `08_write_paths.sql`: 국제 세금 적용 뒤 기타매출 판매 채널 누락, `ETC_SALES_CHANNEL_REQUIRED`.

같은 실행에서 ④ 새 DB는 migration 전체와 DB 시험 `50/50`, ACL, 2세션 경합, locale parity를 통과했고 ⑤ 업그레이드 경로 `23/23`도 통과했다. 이 대비는 기존 개발 DB 상태·기준선의 불일치를 강하게 시사하지만 오염 원인을 확정하지는 않는다.

- 상태: `KNOWN_OPEN_NOT_WAIVED`
- 소유자: `02 Data · Backend` 및 개발 DB 기준선 관리자
- P2 경계: 후보005는 `docs/team/service-flow-state-contract.json` 수정과 `scripts/team-service-state-contract.test.mjs` 생성만 제안한다. DB·migration·Supabase는 범위 밖이다.
- 재검증: 권한 있는 소유자의 개발 DB 기준선 복원 또는 별도 결함 수정 뒤 전체 `corepack pnpm verify`를 다시 실행한다.

## ③ CLI·ACL·색 대비·문서 그래프 — 디자인 결정 계보 불일치

색 대비 게이트는 결정 커밋 `f351058f30aa`, `9ffba3176f11`, `0d9f437782d6`이 현재 HEAD의 조상이 아니라고 거부했다.

- 상태: `KNOWN_OPEN_NOT_WAIVED`
- 소유자: `01 Product · Mobile`, `04 Quality · Review`, 디자인 토큰 기준선 관리자
- P2 경계: 디자인 결정 계보·봉인 실패는 P2 상태·권한·이벤트 스키마 파일과 직접 중첩되지 않는다.
- 재검증: 올바른 결정을 현재 계보에 포함하거나 현재 계보 기준으로 새 결정·봉인을 생성한 뒤 전체 검증을 다시 실행한다.

## 증거 수집 한계

전체 검증 증거는 실행 전후 저장소 입력 594개를 해시로 대조했지만 수집기의 명시적 인벤토리에 `docs/**` 전체와 `.codex/team-router/**` 전체가 포함되는 것은 아니다. 따라서 `changed_inputs=[]`는 수집기에 포함된 입력의 무변경을 뜻하며 저장소 모든 바이트의 무변경을 뜻하지 않는다. 이 한계는 P2 입장 검수자가 별도로 평가해야 한다.

## 요청 가능한 제한 판정

독립검수자는 위 실패를 열린 상태로 유지하면서, 그 실패가 정확한 P2 두 대상 파일의 로컬 구현·AC-18 검증을 오염시키지 않는지 판정할 수 있다. 제한 입장이 허용되더라도 다음은 계속 거짓이다.

- `pnpm verify` 전체 통과
- `service_ready`
- host 통합 또는 실제 11개 채팅 왕복 완료
- 실제 메시지 전송 권한
- Router·앱·DB·Supabase·스테이징·운영 변경 승인
