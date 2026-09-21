# CATEGORY-MENU-DELETE-20260914 공동 작업 장부

## SOLAR_REQUEST · turn-s001

- role: `SOLAR-ARCH`

카테고리 연결 및 메뉴 영업 중 삭제 차단 점검입니다. 카테고리의 판매 중지 메뉴 누락을 실패 시험으로 재현한 뒤 새 migration으로 조회와 삭제 검사의 active를 deleted_at is null로 변경했습니다. 기존 공개 잠금 facade와 권한은 유지했습니다. 카테고리 DB 11개 assertion, 메뉴 4상태 DB 시험, UI 52개 통과. 실제 앱맵 연결 카테고리 차단을 확인했습니다. 사용자 데이터를 삭제하지 않았습니다. 삭제 메뉴 기록 보존과 기존 재료 카테고리 차단 계약을 함께 검토해 주세요.
