# TEAM-SERVICE P2 입장 전 전체 검증 실패 처분 001

## 판정 범위

- 대상 후보: `.codex/mission-relay/candidates/team-service-local-core-004.json`
- 후보 SHA-256: `ad24cc7fff9e616c70d9e672600a92b2b8c749e39ab1f3722121095183a266b9`
- 실행 기준 HEAD: `fe96c3c196d4c3211024c1ecbe18e9d358a230b8`
- 실행 증거: `docs/ai-review/evidence/TEAM-SERVICE-VERIFY-P2-ADMISSION-20260906-001.json`
- 실행 증거 SHA-256: `e8f89b5368011875099e7fc3ec710150b5fd024705ad29f01aa89298b05072b6`
- 검증 입력 변경: `0건`
- 전체 검증 판정: **FAIL — 실패 2단계**

이 문서는 실패를 통과로 바꾸거나 면제하지 않는다. P2의 두 로컬 대상 파일과 무관한 실패인지 독립검수자가 판단할 수 있도록 소유권·영향·재검증 조건을 분리한다.

## ② 시험 실패 — 개발 DB 상태 불일치

관측된 실패는 다음 세 묶음이다.

1. `01_checksums.sql`: 제육볶음 순이익 기대값 `4046.69`, 실제값 `4046.60`.
2. `04_ledger.sql`: 청양고추 재고 `870g`, 원장 합계 `869g`으로 `1g` 불일치.
3. `08_write_paths.sql`: 국제 세금 적용 뒤 기타매출에 판매 채널이 없어 `ETC_SALES_CHANNEL_REQUIRED`.

같은 실행의 ④ 새 DB 단계는 전체 migration, DB 시험 50건, ACL, 경합, locale parity를 통과했고 ⑤ 업그레이드 경로 23건도 통과했다. 따라서 현재 증거가 직접 지지하는 결론은 **소스 전체의 새 DB 재현 실패가 아니라 기존 개발 DB의 상태·기준선 불일치**라는 점이다. 다만 개발 DB의 정확한 오염 원인은 이 문서에서 확정하지 않는다.

- 상태: `KNOWN_OPEN_NOT_WAIVED`
- 소유자: `02 Data · Backend` 및 개발 DB 기준선 관리자
- P2 대상과의 경계: P2 후보는 `docs/team/service-flow-state-contract.json`과 `scripts/team-service-state-contract.test.mjs`만 대상으로 하며 DB·migration·Supabase를 수정하지 않는다.
- 재검증 조건: 권한 있는 DB 소유자가 개발 DB 기준선을 복원하거나, 개발 DB 실패를 별도 결함으로 수정한 뒤 `corepack pnpm verify`를 다시 실행한다.
- 금지된 주장: 새 DB 통과를 근거로 기존 개발 DB 실패를 해소·면제·통과로 표현하지 않는다.

## ③ CLI 계약·ACL·색 대비·문서 그래프 실패 — 디자인 결정 계보 불일치

색 대비 게이트가 다음 결정 커밋이 현재 HEAD의 조상이 아니라고 거부했다.

- `f351058f30aa`
- `9ffba3176f11`
- `0d9f437782d6`

- 상태: `KNOWN_OPEN_NOT_WAIVED`
- 소유자: `01 Product · Mobile`, `04 Quality · Review`, 디자인 토큰 기준선 관리자
- P2 대상과의 경계: 위 실패는 디자인 결정 계보·봉인 문제이며 P2 상태·권한·이벤트 스키마 대상 파일과 직접 중첩되지 않는다.
- 재검증 조건: 올바른 결정 커밋을 현재 계보에 포함하거나, 현재 계보의 새 결정 SHA로 계약과 봉인을 재생성한 뒤 전체 검증을 다시 실행한다.
- 금지된 주장: P2 로컬 범위가 독립 입장되더라도 ③ 단계 또는 전체 `pnpm verify`가 통과했다고 표현하지 않는다.

## P2 입장에 대한 제한적 요청

독립검수자는 아래를 별도로 판단해야 한다.

1. 고정된 전체 검증 입력과 `changed_inputs=[]`가 `VERIFY_RUN_PINNED_INPUTS`에 충분한가.
2. 두 실패가 P2의 정확한 대상 파일 검증을 오염시키지 않는다는 처분이 타당한가.
3. `FAILURE_DISPOSITION_INDEPENDENTLY_REVIEWED`를 충족시킬 수 있는가.
4. 기존 AC-24 관측을 P2 대상 모듈에 재사용할 수 있는가, 아니면 P2 전용 allowlist·run이 먼저 필요한가.

이 문서 자체는 LC-ADMISSION, P2 구현 착수, 서비스 준비, 실제 전송을 승인하지 않는다.
