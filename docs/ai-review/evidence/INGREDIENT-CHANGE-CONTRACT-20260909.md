# 식재료 수정 내역 — 실제 기능 대조 및 보완

## 기준

- 기능: `docs/식재료-레시피-수정내역-최종기획.md` §§2,5–10,13.
- 시각: 루트 `docs/prototypes/0_full-page-flow-prototype-ui-applied.html?screen=ingredient_changes`와 `popup=ingredient_change_detail` 직접 열기.
- 사용자 최신 결정: 재고내역과 공용 행 스타일, 실제 Expo와 같은 AppMap 기본 데이터.
- 작업 브랜치 `codex/prototype-expo-parity-r2`, 기준 HEAD `03f385cee92730b6156c31ca1ec3e28409f5334f`. 기존 dirty 변경 보존. 커밋/운영 배포/공식 독립검수 완료를 의미하지 않음.

## 발견과 반영

| 항목 | 실제 상태 및 변경 | 검증 |
|---|---|---|
| 식재료 직접 저장 | 기존 기록 함수 존재. 동일값/메모만 변경은 제외 | DB 13 |
| 입고·취소 및 레시피 전파 | 기존 동일 correlation_id 기록/단가 전후값/상태 판정 존재 | DB 03,13,15 |
| 입고 입력값 누락 | 0193으로 실입고량/결제금액 입력 스냅샷 추가. 이전 사건 역산·덮어쓰기 없음 | DB 52 |
| 구매 링크 기록 누락 | 0194 트리거로 추가/수정/삭제 기록. 변경 필드만 한 사건, 재고/단가 불변 | DB 53, authenticated 실제 facade 포함 |
| 저장 후 수정내역 캐시 | 구매 링크 성공 훅에서 상세+수정내역 무효화 | purchaseOptionChangeHooks / changeHistoryInvalidation |
| 자동 갱신 상태 재조회 | 고정지출 변경 시 레시피 수정내역, 영업일 변경 시 수정내역+상세 재조회 | changeHistoryInvalidation |
| AppMap 데이터 혼동 | 기본 실제 모드. 명시적 data=sample에서만 예시 변환 | .tmp/verify-appmap-real.mjs / AppMap 시험 |
| 과거 누락 데이터 | 실제 화면에 기록 없음/누락 안내. 1kg 등 임의 값으로 복원하지 않음 | changeHistoryResponsive |

## 실제 실행 증거

- 로컬 지정 Docker `supabase_db_margincook`의 개발 DB에 0193·0194 적용, schema_migrations 기록. 원격 변경 없음.
- 현재 사용자 데이터로 AppMap 기본 실제 모드·예시 주입 없음·예시 배너 숨김·일반 Expo 상세 팝업 텍스트 동일성을 브라우저에서 확인: `.tmp/non-ingredient-parity/ingredient-change-real-check.json`.
- 사용자 데이터 생성/삭제 대신 DB 시험은 모두 트랜잭션 롤백. 이전 입고 기록을 변경하지 않음.
- 신규 구매 링크 DB 시험 17단언 통과. 새 DB 전체 스위트 53/53 통과(verify ② 및 ④).
- 모바일 전체 753/753 통과 후 저장/삭제 실제 훅 성공/실패 시험 2개 추가 통과. 타입 검사 통과.
- AppMap 모델/예시 시험 25/25 통과.
- 웹 번들 별도 실행 통과: `EXPO_OFFLINE=1 corepack pnpm exec expo export --platform web --output-dir ../../.tmp/ingredient-change-web-check-20260909` (apps/mobile). 출력 `index.html` 존재 확인.
- Supabase 2.116.0 타입 생성 실행 확인: 신규 trigger-return 함수는 생성 RPC 타입에서 제외됨. 기존 RPC 인자/반환 서명은 변하지 않음. 미적용 국제화가 있는 로컬 타입 출력으로 기존 통합 타입 파일을 덮어쓰지 않음.

## 전체 게이트 경계

- `pnpm verify` ④: DB 53/53 이후 ACL 감사에서 기존 `revert_latest_stock_event`, `stock_revert_candidates`와 모바일 허용 목록 불일치로 실패. 두 RPC는 이번 0193/0194의 새 공개 API가 아님. 보안 검사를 완화하지 않음.
- 위 실패로 ④의 이후 경합/locale parity는 실행되지 않음. 전체 6/6 통과나 운영 종결로 표현하지 않음.
- ⑤ 23개 업그레이드 시나리오 검사는 진행 중 중단했으므로 미완료. 해당 verify 프로세스 종료와 일회용 `fresh_upgrade_check_875_14538` DB 제거를 확인함. 개발 DB/사용자 기록은 삭제하지 않음.
- ⑥은 전체 verify 프로세스에서 실행되지 않았고, 같은 웹 export 검사를 별도로 실행해 통과함. ① 타입·② 시험·③ 계약 검사는 통과.
- 기존 로컬 DB만 대상으로 실행한 16/34 실패는 누락 국제세금 schema/정책 상태와 연관됨. 모든 migration을 적용한 일회용 DB 스위트에서는 16/34 포함 53/53 통과.
- 공식 독립검수·운영 반영은 별도 미완료.
