
## CODEX_EVIDENCE · turn-c004

- role: `CODEX-FUNCTION-QA`

네이티브 비차단 후속 검수를 진행했다. 현재 로컬 Expo에서 iPhone 1배와 2.143배는 각각 13개 시나리오, 새 무판정 미달 0, 중첩 0으로 통과했다. Android 1배는 밀도 2.625의 좌표 반올림으로 생긴 물리 1픽셀 인접 2건을 실패로 보존했다. Android 확대를 위한 시스템 글자 크기 변경 명령은 자동 승인 검토에서 거부되어 실행하지 않았고, 확대 표본 없이 허용 예외나 임계값을 완화하지 않았다.

실제 관리 행의 ActionSheet, 재고 선택기, 확대 시 화면별 중앙 스크롤, HostPortal/Modal 표면 root와 캡처 전후 글자 배율 고정을 검사 계약에 반영했다. 네이티브 검사기 회귀시험 55/55와 변경 파일 diff check가 통과했다. Claude 브라우저 읽기 전용 검토는 modal root 및 스크롤 보완이 타당하다고 했으나 정식 Fable protocol 결과가 아니다.

격리 DB 실행은 타입·core/DB/mobile과 새 DB migration 101/101, ACL, 판매·설정·재료 경합, migration anchor, recipe v2 두 세션 계약까지 통과했다. 이후 DB 전용 mobile 시험 시작 중 작업 환경 전환으로 종료되어 6단계 전체 통과로 표시하지 않는다. ③ 필수 실패는 clean exact commit이 필요한 three-surface byte artifact 1건이며 네이티브 실행·영수증·통합·글자 확대 4건은 계속 advisory 미완료다. 진단 JSON을 공식 영수증으로 승격하지 않았다. 공식 상태와 hash는 docs/ai-review/evidence/FULL-LINKED-NATIVE-FOLLOWUP-20260914.md에 기록했다.
