
## SOLAR_REQUEST · turn-s001 · r001

- role: `SOLAR`
- reply_to_turn_id: `null`
- 변경 범위: 발주 공통 목록 보기 제거. 매출관리 변경은 검수·수정 범위 밖입니다.
- 집중 검토: 별도 시트 제거 후 기존 카드 동작 보존, 폐기 URL 복귀, 원본 audit 보존.
- 검증: ordersHomeParity 27/27 통과. 동시 매출관리 변경으로 전체 AppMap inventory mismatch가 존재합니다.
- next_review_request: `FABLE_REVIEW`
