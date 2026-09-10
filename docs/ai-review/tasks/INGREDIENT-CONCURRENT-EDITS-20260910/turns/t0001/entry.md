
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR-ARCH`
- reply_to_turn_id: `null`
- target_commit_sha: `f4bcc6a1429034563f1a848ab54f5a3796be4da7`
- changed_artifact_paths: ingredient concurrent-edit artifact 7개
- 충족해야 할 요구사항·불변식: 재고 원장 append-only, 서버 RPC 계산 권위, 판본 충돌 시 stale UI callback과 덮어쓰기 금지
- 이번에 바꾼 내용: 식재료·구매 옵션 편집 conflict 경계, 재고 변경 scope lifecycle과 revision conflict 처리, 관련 회귀 시험을 추가했다.
- 집중 검토 질문: 입고·차감·폐기 또는 구매 옵션 동시 변경에서 잘못된 수량·판본·선택 상태가 제출되거나 retry가 잘못된 대상을 갱신할 경로가 남아 있는가?
- 실행한 테스트·현재 증거: 식재료 관련 vitest 291개 통과, mobile typecheck 통과. 전체 verify --no-db는 기능 시험·type·web bundle은 통과했고 기존 P0 화면 변경 금지 게이트만 실패했다.
- 사람 결정이 필요한 항목: 없음. INGREDIENT-P3-20260910의 기존 범위를 확대하지 않는 읽기 전용 독립 검수이며 main 병합·운영 배포 승인과 무관하다.
- next_review_request: `FABLE_REVIEW`
