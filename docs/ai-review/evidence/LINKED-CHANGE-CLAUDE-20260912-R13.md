# LINKED-CHANGE 검수 R13 — 업그레이드 시나리오 ㉓ CRLF 델타 (0217 앵커 정규화) (Claude/Fable, 읽기 전용)

- 작성: 2026-09-12 · 검수자: Claude (Fable 5.1) · 방식: Windows MCP PowerShell 읽기 전용
- 대상 HEAD: `d33b3fa0aca0b76edbe426684a5668e76f156f23` (작업 트리 미커밋). 개발 DB 는 0229 까지 적용 상태이며 0217 은 재적용하지 않고 정규화 결과 함수의 동일성만 확인 예정(ROOT). full verify 결과는 ROOT 보고대로 ①②⑥ PASS, ③ 기존 commit byte proof FAIL, ④ 중간 0225 JSON null seed FAIL(0227 fresh 전체 재검증 PASS), ⑤ 시나리오 ㉓ CRLF → 0217 market guard anchor FAIL — **전체 게이트 통과를 주장하지 않는다**. "확인" 은 파일·로그 대조, "추정" 은 미실행 추론.
- 제약: 소스/DB/Git/설정 변경 없음, 시험 실행 없음. R1~R12 원문 보존, 본 문서 1개만 신규. 범위: 0217 델타, `upgrade-check.sh` 델타, 실행 로그 1건.
- 입력 지문: `packages/db/supabase/migrations/20260912000217_atomic_tax_configuration.sql` 6,741 B · 18:21:02 · sha256 `ef7eeab7615b0497a70dc7dfc4c57f9c963f83305d567d2067149c2263c1d227`(미추적, 파일 자체 CRLF 0) · `packages/db/scripts/upgrade-check.sh` 66,598 B · 18:21:19 · `6b9ecf20764ed06e`(diff +3/−3) · `.codex/material-history-20260912/run-crlf-upgrade.cjs` 736 B · 18:21:37 · `crlf-upgrade-final.log` 5,868 B · 18:22:54(63줄, **시드 완료까지만 기록 — 결과 미출력, 진행 중**).

## 1. 결론 요약

- **0217 델타 적절(확인)**. L42 에서 `save_store_market_profile` 본문을 `E'\r\n'→E'\n'` 로 정규화한 뒤 이름만 `tax_market_apply_v2` 로 바꾸고(L43), 멀티라인 앵커 `a`(L44–46) 와 치환문 `$new$`(L48–51) 도 같은 방식으로 정규화한다. 정확히-1회 가드(L47) 는 그대로다. 원본 `save_store_market_profile` 은 `execute` 대상이 아니므로(사본만 생성) 줄끝이 어떻든 변경되지 않는다. 다른 부분(L27–38 의 프로필 사본) 은 단일 라인 앵커라 줄끝에 무관하고, 그 입력은 0215 가 이미 `chr(13)` 제거로 정규화해 실행한 함수다.
- **실패 원인과 일치(추정)**. 시나리오 ㉓ 은 0188 상태에서 public PL/pgSQL 함수 전체를 CRLF 로 재정의한 뒤(L1105–1121) 최신까지 적용한다. 0186 이 만든 `save_store_market_profile` 도 CRLF 본문이 되고, 0217 의 옛 코드는 두 줄짜리 앵커를 LF 로만 들고 있어 `count<>1` → raise. 0189~0229 의 나머지 함수 패치는 (a) 단일 라인 앵커거나 (b) `chr(13)` 제거로 정규화(0211·0213·0214·0215·0218) 하므로 같은 원인으로 막힐 곳은 코드 읽기상 남지 않는다.
- **`upgrade-check.sh` 델타 적절(확인)**. 시나리오 ㉓ 의 사후 행동 시험 목록에 77(원자 세금 저장)·86(종료 후 메뉴 과세) 을 추가하고 안내 문구만 바꿨다. 적용 범위(`apply_after "$D" "$BASE23"` = 최신까지) 와 사전·사후 조건(`before23` CRLF 전제, `state23` 5값) 은 그대로다.
- **실행 로그는 미완(확인)**. `crlf-upgrade-final.log` 는 fresh DB `fresh_upgrade_check_330_13417` 생성·0188 적용·시드 완료까지만 있고 CRLF 전제·적용·시험 결과 줄이 아직 없다. `run-crlf-upgrade.cjs` 는 공식 스크립트의 헤더와 시나리오 ㉓ 구간을 그대로 잘라 bash 로 실행하며 `fresh-db.sh` 를 쓰므로 fresh 전용이다(추정). 결과는 ROOT 확인 사항.
- 신규 P1/P2 없음. P4 메모 2건.

## 2. 대조 표

| 항목 | 내용 | 판정 |
|---|---|---|
| 0217 L42 | `replace(pg_get_functiondef(market),E'\r\n',E'\n')` 뒤 이름 치환 | 사본 본문만 LF 화, 원본 무변경 |
| 0217 L44–46 | `$old$` 두 줄 앵커를 같은 규칙으로 정규화 | 파일이 CRLF 로 체크아웃되어도 성립 |
| 0217 L47 | `(length(d)-length(replace(d,a,'')))/length(a)<>1` | 정확히-1회 가드 유지 |
| 0217 L48–51 | `$new$` 도 정규화해 치환 | 결과 함수 본문 줄끝 일관 |
| 개발 DB 동일성 | 개발 DB 의 `tax_market_apply_v2` 는 LF 파일에서 만들어진 원본을 복사한 것이라 정규화 전후 본문이 같아야 함 | ROOT 의 동일성 확인으로 닫힘(본 검수 미실행) |
| upgrade-check.sh L1149 | `for test_no in 47 48 49 50 77 86` | 77/86 추가 |
| upgrade-check.sh L1101/L1159 | 안내 문구 | 동작 변화 없음 |

## 3. 발견 사항 (신규 P1/P2 없음)

### R13-1 · P4 · 줄끝 정규화 관용구가 두 가지
- 0211·0213·0214·0215·0218 은 `replace(…,chr(13),'')`, 0217 은 `replace(…,E'\r\n',E'\n')`. 결과는 같으나(고립된 CR 이 없다는 전제), 앞으로의 함수 패치 마이그레이션이 정규화를 빠뜨리면 ㉓ 에서만 늦게 드러난다. 공통 helper(예: `public.normalized_functiondef(regprocedure)`) 하나로 통일하거나, 마이그레이션 lint 에 "pg_get_functiondef 를 읽고 멀티라인 앵커를 쓰면 정규화 필수" 규칙을 두는 것을 권고.

### R13-2 · P4 · 시나리오 ㉓ 의 CRLF 주입이 PL/pgSQL 함수에 한정
- L1115 `l.lanname='plpgsql'` 만 CRLF 로 바꾼다. SQL 언어 함수(예: `tax_menu_change_basis`, helper 들) 는 CRLF 전제에서 빠지므로, SQL 함수를 `pg_get_functiondef` 로 읽어 패치하는 마이그레이션이 생기면 ㉓ 이 잡지 못한다. 현재 후보 중 SQL 함수를 앵커 패치하는 것은 없다(0218/0221 은 신규 생성, 0227 은 `create or replace`). 기록만.

## 4. 상태 표

| 항목 | 상태 |
|---|---|
| ⑤ ㉓ CRLF → 0217 market guard anchor FAIL | 원인 제거(0217 L40–51), 재실행 결과 대기(로그 미완) |
| ③ commit byte proof FAIL | 범위 밖, ROOT 보고 그대로 |
| ④ 0225 JSON null seed FAIL | 0227 로 해소, fresh 전체 재검증 PASS(ROOT 보고) |
| R4-1·R5-1·R6-1~3·R7-4·R7-5·R9-2·R11-1~2·R12-1~3 | 변동 없음 |