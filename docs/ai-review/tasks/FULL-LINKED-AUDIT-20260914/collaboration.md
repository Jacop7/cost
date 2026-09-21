# FULL-LINKED-AUDIT-20260914 공동 작업 장부

## SOLAR_REQUEST · turn-s001

- role: `SOLAR-ARCH`

사용자는 재료·메뉴·고정 지출·매출·단위·통화 연결을 전수 조사하고 오류를 수정하도록 요청했습니다. 카테고리 사용 수 캐시 무효화와 MY 단가 정밀도 설정 연결, 과거 메뉴 손익의 서버값/명칭/기간 금액/오류 상태, 채널 순매출 조회와 소비처, 삭제 조회 RPC ACL 명세를 보완했습니다. 확정 원장·스냅샷은 변경하지 않습니다. 증거 문서의 재현/회귀 결과와 전체 격리 verify 진행 상태를 확인해 주세요. 현재 소스에서 계산·보안·캐시·영업 상태 연결의 회귀가 있는지 독립 검토하고 미완료 검증을 통과로 취급하지 마세요.

## CODEX_EVIDENCE · turn-c001

- role: `CODEX-FUNCTION-QA`

최신 자체 검증과 정정 사항은 docs/ai-review/evidence/FULL-LINKED-AUDIT-20260914.md에 기록했습니다. 최초 기간 부자재 환산 진단은 실제 훅 계약과 달라 철회했고, 실제 RPC 매퍼 왕복 회귀로 재검증했습니다. 메뉴 손익 팝업의 실제 과거 비용/세액 소비를 보완했습니다. 격리 DB 100/100, 최신 앱 1451/1451(별도 DB 전용 4 skip), 메뉴 DB 왕복 12/12, 국가/통화 DB parity 13/13을 통과했습니다. 26개 업그레이드 경로는 아직 진행 중이며 전체 verify 단일 실행 통과로 표시하지 않습니다. r1 PROVIDER_HARD_CAP_UNAVAILABLE은 외부 호출 전 중단이므로 독립검수 완료가 아닙니다. 기존 task.json은 최초 장부와 해시 결속되어 원본 바이트를 유지했습니다. 제공자 복구 뒤 새 검수 범위에 MenuProfitSheet.tsx, salesMenuRangeRoundtrip.test.tsx, menuProfitSheetParity.test.tsx, admin-acl.test.sh, ingredient-concurrency.mjs, recipe-detail-migration-anchors.mjs를 추가하고 현재 작업 트리로 다시 결속해야 합니다.

## CODEX_EVIDENCE · turn-c002

- role: `CODEX-FUNCTION-QA`

최종 자체 결과를 evidence/FULL-LINKED-AUDIT-20260914.md에 갱신했습니다. 기능 연결 오류 8건 수정, 최신 앱 1452시험 통과, core 269·DB 100시험 파일·메뉴 DB 왕복 12·국가/통화 parity 13 통과입니다. 업그레이드 전체 실행은 25번의 영업 중 seed가 00003 보호 장치에 막혀 실패했습니다. upgrade-check.sh가 정상 종료 RPC를 거친 뒤 전환하도록 보완했고, 공식 스크립트 helper와 25·26 블록을 추출한 재검사에서 두 경로가 통과했습니다. 1~24 재실행 또는 단일 verify 6/6 통과로 표시하지 않습니다. 최종 필수 실패는 clean commit을 요구하는 three-surface-byte-artifacts의 레지스트리 hash 갱신입니다. Fable 하드캡 차단과 native evidence 4건 advisory도 미해소입니다. 다음 독립검수는 최신 MenuProfitSheet, SalesMenuDetailScreen, 실제 RPC 왕복 시험 및 upgrade-check.sh 포함 검사 하네스를 새 범위로 결속해야 합니다. 검사용 컨테이너만 정리했고 실제 로컬 DB·Expo·AppMap은 유지했습니다.
