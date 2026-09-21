
## CODEX_EVIDENCE · turn-c001 · r001

- role: `CODEX-FUNCTION-QA`
- 기능 문서: v2.1 SHA256 `9df37945c5e5ea39de0390a204785454124582cbc017b5c7c45404c6ecb134eb`; 기능 103, 연계 99, 시나리오 334, 상세 103/103, 로컬 링크 227 모두 검사 통과.
- DB: 최신 전체 migration과 111/111 통과. `fixed_cost_basis_result`를 비공개 SECURITY INVOKER로 수정해 내부 서버 호출의 RLS 문맥 손실을 제거했고, 앱 공개 `get_fixed_cost_basis`의 SECURITY DEFINER 경계와 앱의 내부 함수 직접 실행 차단을 보존했다.
- 경합: 고정 지출 저장/종료 4조합, 식재료 15조합, 입고·차감·폐기·취소·발주 입고·레시피 2세션, 실제 DB 왕복, locale/international parity 통과.
- 기타 게이트: 타입, core 269/13제외, mobile 136파일 1639/4제외, ACL 지표 22·모바일 RPC 90·비모바일 예외 1·미승인 0, 터치 미달 0·형제 중첩 0·감사기 66/66, 업그레이드 26/26, 웹 번들 통과.
- 미완료: exact commit 경계와 three-surface 산출물 SHA 3개가 필수 실패다. 네이티브 기기 증빙 4종은 배포 비차단 advisory다. 사용자 작업 중인 제외 파일 3개는 수정하지 않았다.
- Fable 실행 상태: 외부 호출 전 `PROVIDER_HARD_CAP_UNAVAILABLE`로 중단되어 독립검수 결과는 없다. soft budget 우회는 사용하지 않았다.
- next_review_request: `FABLE_REVIEW`
