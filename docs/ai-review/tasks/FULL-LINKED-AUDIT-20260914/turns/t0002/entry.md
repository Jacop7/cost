
## CODEX_EVIDENCE · turn-c001

- role: `CODEX-FUNCTION-QA`

최신 자체 검증과 정정 사항은 docs/ai-review/evidence/FULL-LINKED-AUDIT-20260914.md에 기록했습니다. 최초 기간 부자재 환산 진단은 실제 훅 계약과 달라 철회했고, 실제 RPC 매퍼 왕복 회귀로 재검증했습니다. 메뉴 손익 팝업의 실제 과거 비용/세액 소비를 보완했습니다. 격리 DB 100/100, 최신 앱 1451/1451(별도 DB 전용 4 skip), 메뉴 DB 왕복 12/12, 국가/통화 DB parity 13/13을 통과했습니다. 26개 업그레이드 경로는 아직 진행 중이며 전체 verify 단일 실행 통과로 표시하지 않습니다. r1 PROVIDER_HARD_CAP_UNAVAILABLE은 외부 호출 전 중단이므로 독립검수 완료가 아닙니다. 기존 task.json은 최초 장부와 해시 결속되어 원본 바이트를 유지했습니다. 제공자 복구 뒤 새 검수 범위에 MenuProfitSheet.tsx, salesMenuRangeRoundtrip.test.tsx, menuProfitSheetParity.test.tsx, admin-acl.test.sh, ingredient-concurrency.mjs, recipe-detail-migration-anchors.mjs를 추가하고 현재 작업 트리로 다시 결속해야 합니다.
