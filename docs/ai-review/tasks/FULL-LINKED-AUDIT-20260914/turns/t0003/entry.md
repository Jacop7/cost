
## CODEX_EVIDENCE · turn-c002

- role: `CODEX-FUNCTION-QA`

최종 자체 결과를 evidence/FULL-LINKED-AUDIT-20260914.md에 갱신했습니다. 기능 연결 오류 8건 수정, 최신 앱 1452시험 통과, core 269·DB 100시험 파일·메뉴 DB 왕복 12·국가/통화 parity 13 통과입니다. 업그레이드 전체 실행은 25번의 영업 중 seed가 00003 보호 장치에 막혀 실패했습니다. upgrade-check.sh가 정상 종료 RPC를 거친 뒤 전환하도록 보완했고, 공식 스크립트 helper와 25·26 블록을 추출한 재검사에서 두 경로가 통과했습니다. 1~24 재실행 또는 단일 verify 6/6 통과로 표시하지 않습니다. 최종 필수 실패는 clean commit을 요구하는 three-surface-byte-artifacts의 레지스트리 hash 갱신입니다. Fable 하드캡 차단과 native evidence 4건 advisory도 미해소입니다. 다음 독립검수는 최신 MenuProfitSheet, SalesMenuDetailScreen, 실제 RPC 왕복 시험 및 upgrade-check.sh 포함 검사 하네스를 새 범위로 결속해야 합니다. 검사용 컨테이너만 정리했고 실제 로컬 DB·Expo·AppMap은 유지했습니다.
