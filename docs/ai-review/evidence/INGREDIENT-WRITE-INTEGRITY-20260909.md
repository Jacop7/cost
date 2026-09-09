# 식재료 쓰기 무결성 우선 수정 — 2026-09-09

## 범위와 상태

- 사용자 요청: 이전 식재료 기능 감사의 **가장 먼저 고칠 문제 전부** 수정.
- 대상: 감사 F1~F4의 5개 구현 항목. 나머지 감사 항목 전부나 서비스 전체 완료를 뜻하지 않는다.
- 작업 위치: `C:/Users/jacop/프로젝트/식자재관리앱/.tmp/prototype-expo-parity-r2`.
- 기준 HEAD: `03f385cee92730b6156c31ca1ec3e28409f5334f`, 브랜치 `codex/prototype-expo-parity-r2`.
- 기존 사용자 변경을 보존했다. 커밋·스테이징·main 병합·원격 배포하지 않았다.
- 실제 Expo 화면 소스와 로컬 개발 DB에 반영. `/appmap?data=real`도 같은 소스/RPC를 사용한다.
- 공식 독립검수·전체 게이트 종결은 **미완료**다.

## 항목별 변경

| 우선 문제 | 수정 내용 | 주요 근거 |
|---|---|---|
| F1 같은 내용의 정상 입고가 중복 처리되어 누락 | 값 조합 키를 작업별 키로 교체. 같은 제출 재시도만 키를 유지하며 성공 후 새 작업은 새 키. 서버는 같은 키를 잠근 뒤 발주 생성 전 중복 확인하고 다른 payload 재사용은 거부 | `QuickInboundScreen.tsx`, `operationKey.ts`, migration 0195 |
| F2 단위 차원 혼합·기준단위 변경 | 식재료 수정/구매 링크는 기존 g/ml/ea 차원으로 제한. g↔kg·ml↔L 변경은 실물 수량을 보존. 환산 정의 없는 박스 선택 제거. DB도 기준 차원 변경과 구매 링크 payload 차원 불일치 거부 | `UnitPickerSheet.tsx`, `unitInput.ts`, 두 폼, DB trigger/RPC |
| F3 동시 재고 처리에서 의도보다 많이 차감 | 수량·확인 재고·사유·요청 키를 `change_stock_quantity`에 전달. 서버 행 잠금 후 확인 재고 불일치는 40001로 거절. 기존 E5/사유 포함 E2 계산으로 처리하고 재시도 영수증을 저장 | `StockChangeScreen.tsx`, `hooks.ts`, `stock_quantity_receipts` |
| F4 폐기 사유 입력·저장 불가 | 사유 필수 입력을 활성화하고 폐기 원장 INSERT에 note를 함께 저장. 실제 재고 이력 조회에 노출. 기존 원장은 수정하지 않음 | `discard_stock_noted`, DB 시험 54 |
| F4 식재료 추가/수정 구매 가격 미저장 | nullable `ingredients.purchase_price`에 개당 참고 구매 가격 저장·재조회·변경 이력 기록. 이 필드를 보내지 않는 기존 화면은 저장된 가격 보존 | `IngredientFormScreen.tsx`, `useSaveIngredient`, `ingredient_detail` |

참고 구매 가격은 실제 입고의 가중평균 기준단가가 아니다. 입력 가격으로 원장이나 기준단가를 덮어쓰지 않는다.
기존 자료에 참고 가격을 추측해 채우지 않았으므로 과거 식재료의 해당 입력은 첫 저장 전까지 비어 있다.
이미 손상됐을 수 있는 과거 수량·단위·누락 입고도 추측하여 보정하지 않았다.

## 재시도·동시성

- 통신 오류는 저장 성공 여부가 불명확하다. 화면이 재조회돼도 같은 차감/폐기 제출은 최초 키와 확인 재고를 유지한다.
- 서버가 40001로 **저장 전에 거절한 경우에만** 키를 폐기하고 재고 재조회 후 새 확인을 받는다.
- 영수증·폐기 내부 함수는 앱의 직접 테이블 쓰기/함수 호출에 열지 않는다. 공식 공개 RPC만 추가했다.
- 기존 `StockEditSheet`의 절대 목표 재고 계약은 보존한다. 새 차감/폐기 페이지는 수량 계약으로 분리했다.

## 검증 결과

| 검사 | 결과 |
|---|---|
| 최종 `corepack pnpm --filter @margincook/mobile typecheck` | PASS |
| 최종 모바일 전체 `corepack pnpm --filter @margincook/mobile test` | **78 파일, 762 테스트 PASS** |
| 관련 집중 테스트(ingredientWrite, quickInbound, stockChangeScreen, ingredientPickers, ingredientForm, purchaseOption, changeHistoryPagination) | **10 파일, 142 테스트 PASS** |
| `node scripts/appmap/samples.test.mjs` | 13 PASS. 샘플 쓰기 차단 및 실제 모드 통과 경로 보존 |
| 전체 migration → `fresh_ing_integrity_20260909` | PASS |
| 위 격리 DB의 `node packages/db/tests/run.mjs` | **54/54 파일 PASS** |
| 신규 DB 시험 54 | 실제 authenticated 역할로 참고가격 저장/재조회, 단위 거부, 정상 반복 입고, 재시도, stale 차감, 폐기사유 조회, 과다/음수/NaN 입력 거부 확인 |
| `node packages/db/tests/ingredient-concurrency.mjs fresh_ing_integrity_20260909` | **8개 경합 시나리오 PASS**. 두 실제 연결의 Lock 대기 관측, 원장 합계·재고·입고 건수 검증 |
| `node packages/db/scripts/admin-acl-audit.test.mjs fresh_ing_integrity_20260909` | PASS. metric 22개, 모바일 RPC 76개, 비-mobile 2개. 미승인 공개 RPC 0 |
| `git diff --check` | PASS |
| Expo Metro 웹 export | PASS, web entry 약 2.24 MB, index.html 생성 확인 |

DB 타입은 CLI **2.116.0**으로 전체 migration이 적용된 격리 DB에서 재생성했다. CLI 업데이트하지 않았다.
신규 경합 시험은 `scripts/verify.mjs`의 ④ 경로에도 연결했다. 이미 실행 중이던 verify 프로세스는 연결 전 버전이므로 신규 경합의 실행 증거는 위 별도 명령이다.

### 전체 verify 결과는 별도

`corepack pnpm verify` 실행 결과: ① PASS / ② FAIL / ③ FAIL / ④ PASS / ⑤ 미완료(중단) / ⑥ PASS, exit 1.

- ②는 기존 수정내역 테스트가 여전히 월별 머리글을 기대하여 실패했다. 실제 공통 화면의 확정된 `최근 7일간` 표시로 단언을 정정한 뒤, 모바일 전체 **762/762**를 별도로 재실행해 통과했다. 제품의 이력 표시를 되돌리지 않았다.
- ③ `three-surface-p0-check.mjs`가 현재 대규모 화면 변경을 **P0 제품 화면 변경 금지**로 거부했다. 승인 기준/영수증을 임의 변경해 우회하지 않았다.
- ④ 새 DB 54개 시험, ACL 감사, 기존 판매/마감 경합, locale/international DB parity 13개를 통과했다.
- ⑤ 과거 버전 23개 전체 업그레이드 경로는 4번째 시나리오 중 중단했다. 이번 변경의 격리 DB/로컬 적용 증거와 혼동하지 않으며 **23/23 통과가 아니다**.
- 위 사유로 전체 6/6 또는 릴리스 준비 완료라고 선언하지 않는다.

## 실제 화면 확인 — 저장하지 않음

브라우저 검증 전용 탭에서 다음 실제 URL을 직접 열었다.

- `/appmap/?screen=stock_change&popup=stock_discard&data=real`: 대파 재고 4.6kg, 폐기 사유 입력 활성, 100g 입력 시 잔량 4.5kg·예상 손실 400원. 확인창의 식재료/폐기량/폐기 후 재고 3행 확인 후 **취소**.
- `/appmap/?screen=ingredient_edit&data=real`: 구매 가격 입력과 수정 폼 렌더링. 무게 식재료 단위 팝업에 kg/g만 노출.
- `/appmap/?screen=options&popup=option_add&data=real`: 구매 링크 추가 폼 단위 팝업에도 kg/g만 노출.

브라우저에서 실제 입고·차감·폐기·가격 저장을 실행하지 않았다. 저장/재조회·실패·경합은 격리 DB 및 화면/실제 훅 테스트로 검증했다. 네이티브 기기 인증은 아니다.

## 로컬 DB 적용 및 보존

- 정확한 파일: `packages/db/supabase/migrations/20260909000195_ingredient_write_integrity.sql`.
- SHA-256: `5009ec59b08f279ea3d95bf1fa676ec8b653e5a853bdf94ecce9f72402da095b`.
- 대상: 로컬 Docker `supabase_db_margincook`, DB `postgres`만. 파일을 ON_ERROR_STOP 트랜잭션으로 적용 후 로컬 CLI migration history를 0195 applied로 기록.
- 적용 전후 및 브라우저 확인 후 원장 **865건**, 재고 수량 해시 **23c885325e9fab9ffc0f8285eed4b707**로 동일.
- 기존 개발 DB에는 0176~0191 국제화 migration 공백이 있다. 이 작업에서 그 공백을 임의 적용하지 않았다. 전체 새 DB 검증과 로컬 현재 DB 조건을 구분한다.
- 스테이징·운영에는 적용하지 않았다.
- 확인 후 이번 작업이 만든 `fresh_ing_integrity_20260909`, `fresh_upgrade_check_1120_11403` 두 일회용 DB만 삭제했다. 동일 migration·fixture로 재생성할 수 있으며 로컬 `postgres`는 보존했다.

## 독립검수 제한

`corepack pnpm fable:check`는 `권위 저장소 경로가 아닙니다. 필요한 경로: C:\Users\jacop\프로젝트\식자재관리앱`으로 **exit 77**.
현재 작업은 그 아래 별도 worktree이므로 실행기 경계를 우회하거나 다른 검수 엔진을 대신 호출하지 않았다.
독립검수 PASS를 생성하지 않았다. 이 기록은 Codex 실행 검증이며 Fable 검수 결과나 공식 종결 영수증이 아니다.
