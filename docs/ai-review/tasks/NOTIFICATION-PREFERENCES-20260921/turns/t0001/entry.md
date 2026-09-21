
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `3132560e07a1c035344a101df533ac84f2da59ab`
- changed_artifact_paths: 알림 정책 공식 문서, 설정 훅, MY 알림·홈 화면, 설정 RPC migration, 생성 DB 타입
- 충족해야 할 요구사항·불변식: 6개 독립 스위치, 매출 알림 단일 스위치, 푸시 OFF와 앱 상태 분리, 판본·권한·매장 격리 보존, 단가 급등 활성 계약 제거
- 이번에 바꾼 내용: 신규 3개 설정 열과 6개 알림 RPC 계약을 추가하고 화면·카운트·설명·테스트를 일치시켰다.
- 집중 검토 질문: UI·TS·DB 키가 정확히 일치하는가, 구형 단가 급등 설정이 다시 노출되는가, save/get_settings의 보안·판본 계약이 약화되는가, 매출 알림이 하위 설정으로 잘못 분리되는가?
- 실행한 테스트·현재 증거: typecheck PASS, mobile 150 files/1766 tests PASS, DB 122/122 PASS, fresh DB·26/26 upgrade·web bundle PASS, 실제 Expo에서 6→5→6 저장 복원 확인. 전체 verify ③은 이번 범위 밖 기존 203개 UI 변경의 touch/three-surface 기준선 미동기화로 FAIL.
- 사람 결정이 필요한 항목: 없음. 사용자가 매출 알림 4종을 한 스위치로 통합하도록 확정했다.
- next_review_request: `FABLE_REVIEW`
